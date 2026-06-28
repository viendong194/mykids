import Phaser from 'phaser';

export class AssetLoader {
  /**
   * Fetch một file SVG từ URL, validate nội dung, rồi trả về data URL base64.
   * Nếu server trả về HTML (SPA redirect) hoặc content không hợp lệ → throw Error.
   */
  private static async fetchSvgAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    const text = await response.text();

    // Validate: content phải bắt đầu bằng <svg hoặc <?xml và chứa </svg>
    const trimmed = text.trimStart();
    if ((!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) || !text.includes('</svg>')) {
      throw new Error(`Invalid SVG content from ${url} (got HTML redirect?)`);
    }

    // Convert sang base64 data URL để Phaser load an toàn qua scene.load.image
    const base64 = btoa(unescape(encodeURIComponent(text)));
    return `data:image/svg+xml;base64,${base64}`;
  }

  /**
   * Nạp động danh sách các tài nguyên (ảnh hoặc Base64 SVG) vào Cache của Phaser.
   * SVG file-path được fetch trước bằng JS, validate, rồi mới nạp vào Phaser.
   * Điều này ngăn Phaser crash khi server trả về HTML thay vì SVG (SPA routing).
   */
  public static async loadAssets(scene: Phaser.Scene, assets: Record<string, string>): Promise<void> {
    // Bước 1: Pre-fetch tất cả SVG file-path → chuyển thành data URL
    const resolvedAssets: Record<string, string> = {};

    const fetchPromises = Object.entries(assets).map(async ([key, dataUrlOrPath]) => {
      // Nếu đã là data URL → dùng thẳng, không cần fetch
      if (dataUrlOrPath.startsWith('data:')) {
        resolvedAssets[key] = dataUrlOrPath;
        return;
      }

      // Nếu là đường dẫn file SVG → fetch & validate trước
      if (dataUrlOrPath.toLowerCase().endsWith('.svg') || dataUrlOrPath.toLowerCase().includes('.svg?')) {
        try {
          resolvedAssets[key] = await AssetLoader.fetchSvgAsDataUrl(dataUrlOrPath);
        } catch (err) {
          console.error(`❌ AssetLoader: Failed to fetch SVG for key "${key}":`, err);
          // Bỏ qua asset lỗi — không thêm vào resolvedAssets → Phaser sẽ không load
        }
        return;
      }

      // Các loại image khác (png, jpg, ...) → dùng thẳng
      resolvedAssets[key] = dataUrlOrPath;
    });

    await Promise.all(fetchPromises);

    // Bước 2: Nạp vào Phaser — toàn bộ đều là data URL hoặc image path hợp lệ
    return new Promise((resolve) => {
      let needsLoad = false;

      for (const [key, dataUrl] of Object.entries(resolvedAssets)) {
        if (!scene.textures.exists(key)) {
          // Đã là data URL nên dùng scene.load.image thay vì scene.load.svg
          // → Phaser không cần parse XML nữa → không có crash
          scene.load.image(key, dataUrl);
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
}

export default AssetLoader;
