import Phaser from 'phaser';

/**
 * Rasterize SVG text string lên Canvas 256×256, add vào Phaser texture cache.
 * Trả về true nếu thành công.
 */
function addSvgTextureFromString(
  textures: Phaser.Textures.TextureManager,
  key: string,
  svgText: string,
  size = 256
): Promise<boolean> {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(svgText);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;

    const img = new Image();
    img.width = size;
    img.height = size;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, size, size);
        if (!textures.exists(key)) {
          textures.addCanvas(key, canvas);
        }
        resolve(true);
      } catch (e) {
        console.warn(`⚠️ AssetLoader: canvas render failed for "${key}":`, e);
        resolve(false);
      }
    };

    img.onerror = () => {
      console.warn(`⚠️ AssetLoader: img load failed for "${key}"`);
      resolve(false);
    };

    img.src = dataUrl;
  });
}

/**
 * Fetch SVG text từ absolute URL, validate là SVG thật sự.
 */
async function fetchSvgText(absoluteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(absoluteUrl);
    if (!res.ok) return null;
    const text = await res.text();
    const first3 = text.trimStart().substring(0, 3);
    if (first3 !== '<sv' && first3 !== '<?x') return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Xây dựng URL tuyệt đối từ đường dẫn tương đối.
 */
function toAbsoluteUrl(relativePath: string): string {
  const cleanPath = relativePath.replace(/^\.\//, '').replace(/^\//, '');
  return `${window.location.origin}/${cleanPath}`;
}

/**
 * Trích xuất SVG text từ data URL.
 */
function extractSvgFromDataUrl(dataUrl: string): string {
  if (dataUrl.includes(';base64,')) {
    const base64 = dataUrl.split(';base64,')[1];
    try { return decodeURIComponent(escape(atob(base64))); } catch { return atob(base64); }
  }
  return decodeURIComponent(dataUrl.split(',')[1] ?? '');
}

export class AssetLoader {
  /**
   * Nạp động danh sách tài nguyên vào Phaser texture cache.
   * SVG được fetch rồi rasterize lên Canvas → tránh hoàn toàn Phaser SVG loader crash.
   */
  public static async loadAssets(scene: Phaser.Scene, assets: Record<string, string>): Promise<void> {
    const promises = Object.entries(assets).map(async ([key, value]) => {
      if (scene.textures.exists(key)) return;

      if (value.startsWith('data:image/svg+xml')) {
        // Inline SVG data URL → extract và rasterize
        const svgText = extractSvgFromDataUrl(value);
        if (svgText) await addSvgTextureFromString(scene.textures, key, svgText);
      } else if (value.startsWith('data:')) {
        // Các data URL khác (png, jpg) → load qua Phaser bình thường
        await new Promise<void>((res) => {
          scene.load.image(key, value);
          scene.load.once('complete', () => res());
          scene.load.start();
        });
      } else if (value.toLowerCase().endsWith('.svg') || value.toLowerCase().includes('.svg?')) {
        // SVG file path → fetch → rasterize trên canvas
        const absoluteUrl = toAbsoluteUrl(value);
        const svgText = await fetchSvgText(absoluteUrl);
        if (svgText) await addSvgTextureFromString(scene.textures, key, svgText);
      } else {
        // Image file → load qua Phaser bình thường
        await new Promise<void>((res) => {
          scene.load.image(key, value);
          scene.load.once('complete', () => res());
          scene.load.start();
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Alias: giải phóng blob URLs đã tạo (không còn dùng blob URL nữa, giữ để tương thích)
   */
  public static revokeAll(): void { /* no-op */ }
}

export default AssetLoader;
