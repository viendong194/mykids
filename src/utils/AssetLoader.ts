import Phaser from 'phaser';

/**
 * Xây dựng URL tuyệt đối từ đường dẫn tương đối, căn cứ vào base URL của app.
 * Điều này đảm bảo fetch() luôn gọi đúng URL bất kể game đang ở route nào.
 */
function resolveUrl(relativePath: string): string {
  // Lấy base URL của app (thư mục chứa index.html)
  // import.meta.env.BASE_URL = '/' khi dev, hoặc base path khi deploy
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const cleanPath = relativePath.replace(/^\.\//, '').replace(/^\//, '');
  return `${base}/${cleanPath}`;
}

/**
 * Fetch một file SVG từ URL tuyệt đối, validate nội dung thực sự là SVG,
 * rồi trả về object URL (blob URL) để Phaser load an toàn.
 */
async function fetchSvgAsBlobUrl(absoluteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      console.warn(`⚠️ AssetLoader: HTTP ${response.status} for ${absoluteUrl}`);
      return null;
    }

    // Dùng arrayBuffer để tránh vấn đề encoding
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Validate: 3 bytes đầu phải là '<sv' (0x3C 0x73 0x76) hoặc '<?x' (0x3C 0x3F 0x78)
    // Nếu là HTML thì sẽ bắt đầu bằng '<!D' hoặc '<ht'
    const firstBytes = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
    if (firstBytes !== '<sv' && firstBytes !== '<?x') {
      console.warn(`⚠️ AssetLoader: Not SVG content at ${absoluteUrl} (starts with "${firstBytes}...")`);
      return null;
    }

    // Tạo Blob và object URL — Phaser sẽ load từ blob URL này
    const blob = new Blob([buffer], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error(`❌ AssetLoader: fetch failed for ${absoluteUrl}:`, err);
    return null;
  }
}

// Track tất cả blob URLs để revoke sau khi không còn cần thiết
const _blobUrls: string[] = [];

export class AssetLoader {
  /**
   * Nạp động danh sách các tài nguyên vào Cache của Phaser.
   * SVG file-path được fetch trước, validate byte-level, rồi load qua blob URL.
   * Điều này ngăn Phaser crash khi server trả về HTML thay vì SVG.
   */
  public static async loadAssets(scene: Phaser.Scene, assets: Record<string, string>): Promise<void> {
    // Bước 1: Pre-fetch và validate tất cả SVG file-path → blob URL
    const resolvedAssets: Record<string, string> = {};

    const fetchPromises = Object.entries(assets).map(async ([key, dataUrlOrPath]) => {
      if (scene.textures.exists(key)) return; // Đã có trong cache

      // Nếu đã là data URL → dùng thẳng
      if (dataUrlOrPath.startsWith('data:') || dataUrlOrPath.startsWith('blob:')) {
        resolvedAssets[key] = dataUrlOrPath;
        return;
      }

      // Nếu là đường dẫn file SVG → fetch, validate, tạo blob URL
      if (dataUrlOrPath.toLowerCase().endsWith('.svg') || dataUrlOrPath.toLowerCase().includes('.svg?')) {
        const absoluteUrl = resolveUrl(dataUrlOrPath);
        const blobUrl = await fetchSvgAsBlobUrl(absoluteUrl);
        if (blobUrl) {
          resolvedAssets[key] = blobUrl;
          _blobUrls.push(blobUrl);
        }
        return;
      }

      // Các loại image khác → dùng thẳng
      resolvedAssets[key] = dataUrlOrPath;
    });

    await Promise.all(fetchPromises);

    // Bước 2: Nạp vào Phaser qua scene.load.image (không dùng load.svg)
    return new Promise((resolve) => {
      let needsLoad = false;

      for (const [key, url] of Object.entries(resolvedAssets)) {
        if (!scene.textures.exists(key)) {
          scene.load.image(key, url);
          needsLoad = true;
        }
      }

      if (needsLoad) {
        scene.load.once('complete', () => resolve());
        scene.load.start();
      } else {
        resolve();
      }
    });
  }

  /**
   * Giải phóng tất cả blob URLs đã tạo (gọi khi game destroy hoàn toàn)
   */
  public static revokeAll(): void {
    for (const url of _blobUrls) {
      URL.revokeObjectURL(url);
    }
    _blobUrls.length = 0;
  }
}

export default AssetLoader;
