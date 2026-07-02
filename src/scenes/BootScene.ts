import Phaser from 'phaser';
import { SVG_ASSETS } from '../assets/SVGs';

/**
 * Rasterize một SVG text string lên Canvas 256×256,
 * sau đó thêm trực tiếp vào Phaser texture cache.
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
        console.warn(`⚠️ SVG canvas render failed for "${key}":`, e);
        resolve(false);
      }
    };

    img.onerror = (e) => {
      console.warn(`⚠️ SVG img load failed for "${key}":`, e);
      resolve(false);
    };

    img.src = dataUrl;
  });
}

/**
 * Fetch SVG text từ URL tuyệt đối và trả về chuỗi text SVG.
 * Validate rằng response thực sự là SVG (không phải HTML redirect).
 */
async function fetchSvgText(absoluteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(absoluteUrl);
    if (!res.ok) {
      console.warn(`⚠️ HTTP ${res.status}: ${absoluteUrl}`);
      return null;
    }
    const text = await res.text();
    // Byte-level check: SVG bắt đầu bằng '<sv' hoặc '<?x'
    // HTML bắt đầu bằng '<!D' (<!DOCTYPE) hoặc '<ht'
    const firstChars = text.trimStart().substring(0, 3);
    if (firstChars !== '<sv' && firstChars !== '<?x') {
      console.warn(`⚠️ Not SVG at ${absoluteUrl} (starts with "${firstChars}")`);
      return null;
    }
    return text;
  } catch (e) {
    console.error(`❌ fetch failed: ${absoluteUrl}`, e);
    return null;
  }
}

/**
 * Xây dựng URL tuyệt đối dựa trên window.location.origin.
 * Luôn đúng bất kể BASE_URL hay routing.
 */
function toAbsoluteUrl(relativePath: string): string {
  // Dùng window.location để construct URL tuyệt đối
  // Ví dụ: 'assets/animals/ant/asset.svg' → 'https://mykids.viendong.online/assets/animals/ant/asset.svg'
  const cleanPath = relativePath.replace(/^\.\//, '').replace(/^\//, '');
  return `${window.location.origin}/${cleanPath}`;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.cameras.main.setBackgroundColor('#E3F2FD');
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Thanh tiến trình tải
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0xBBDEFB, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 25, 320, 50, 15);

    const progressBar = this.add.graphics();

    const updateProgress = (ratio: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x2196F3, 1);
      progressBar.fillRoundedRect(width / 2 - 150, height / 2 - 15, 300 * ratio, 30, 10);
    };
    updateProgress(0);

    // Chạy async loading trong background — KHÔNG dùng async create()
    this._loadAllAssets(updateProgress).then(() => {
      progressBar.destroy();
      progressBox.destroy();
      this.scene.start('MainMenuScene');
    });

  }

  private async _loadAllAssets(onProgress: (ratio: number) => void): Promise<void> {
    const entries = Object.entries(SVG_ASSETS);
    let done = 0;

    // Xử lý song song nhưng chia thành batches để tránh quá tải mạng
    const BATCH_SIZE = 20;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async ([key, value]) => {
        if (this.textures.exists(key)) {
          // Texture đã tồn tại → bỏ qua
        } else if (value.startsWith('data:')) {
          // Inline data URL (flag, star, sound) → rasterize trực tiếp
          await addSvgTextureFromString(this.textures, key, this._extractSvgFromDataUrl(value));
        } else if (value.toLowerCase().endsWith('.svg') || value.toLowerCase().includes('.svg?')) {
          // SVG file path → fetch text → rasterize
          const absoluteUrl = toAbsoluteUrl(value);
          const svgText = await fetchSvgText(absoluteUrl);
          if (svgText) {
            await addSvgTextureFromString(this.textures, key, svgText);
          }
        }

        done++;
        onProgress(done / entries.length);
      }));
    }
  }

  /**
   * Trích xuất SVG text từ data:image/svg+xml;base64,... URL
   */
  private _extractSvgFromDataUrl(dataUrl: string): string {
    if (dataUrl.includes(';base64,')) {
      const base64 = dataUrl.split(';base64,')[1];
      try {
        return decodeURIComponent(escape(atob(base64)));
      } catch {
        return atob(base64);
      }
    }
    // data:image/svg+xml,<url-encoded-svg>
    const encoded = dataUrl.split(',')[1];
    return decodeURIComponent(encoded ?? '');
  }
}
