import Phaser from 'phaser';
import { SVG_ASSETS } from '../assets/SVGs';

/**
 * Xây dựng URL tuyệt đối từ đường dẫn tương đối, căn cứ vào base URL của app.
 */
function resolveUrl(relativePath: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const cleanPath = relativePath.replace(/^\.\//, '').replace(/^\//, '');
  return `${base}/${cleanPath}`;
}

/**
 * Fetch SVG bằng ArrayBuffer, validate byte-level, trả về blob URL.
 * Nếu server trả về HTML (SPA redirect/404) → bytes đầu không phải '<sv' → trả về null.
 */
async function fetchSvgAsBlobUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`⚠️ BootScene: HTTP ${response.status} for ${url}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Validate byte-level: SVG bắt đầu bằng '<sv' hoặc '<?x', HTML bắt đầu bằng '<!D' hoặc '<ht'
    const first3 = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
    if (first3 !== '<sv' && first3 !== '<?x') {
      console.warn(`⚠️ BootScene: Not SVG at ${url} (starts with "${first3}")`);
      return null;
    }

    const blob = new Blob([buffer], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error(`❌ BootScene: fetch failed for ${url}:`, err);
    return null;
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.cameras.main.setBackgroundColor('#E3F2FD');
  }

  async create() {
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

    // Bước 1: Pre-fetch và validate tất cả SVG file-path → blob URL
    const entries = Object.entries(SVG_ASSETS);
    const resolvedAssets: Record<string, string> = {};
    let done = 0;

    const fetchPromises = entries.map(async ([key, value]) => {
      if (value.startsWith('data:') || value.startsWith('blob:')) {
        // data URL inline → dùng thẳng
        resolvedAssets[key] = value;
      } else if (value.toLowerCase().endsWith('.svg') || value.toLowerCase().includes('.svg?')) {
        // SVG file path → fetch với absolute URL, validate, tạo blob URL
        const absoluteUrl = resolveUrl(value);
        const blobUrl = await fetchSvgAsBlobUrl(absoluteUrl);
        if (blobUrl) {
          resolvedAssets[key] = blobUrl;
        }
        // Nếu null → bỏ qua key này (không crash game)
      } else {
        resolvedAssets[key] = value;
      }
      done++;
      updateProgress((done / entries.length) * 0.7); // 0-70% cho fetch phase
    });

    await Promise.all(fetchPromises);

    // Bước 2: Nạp vào Phaser qua scene.load.image (KHÔNG dùng load.svg)
    await new Promise<void>((resolve) => {
      let needsLoad = false;

      for (const [key, url] of Object.entries(resolvedAssets)) {
        if (!this.textures.exists(key)) {
          this.load.image(key, url);
          needsLoad = true;
        }
      }

      if (needsLoad) {
        this.load.on('progress', (v: number) => updateProgress(0.7 + v * 0.3)); // 70-100%
        this.load.once('complete', () => resolve());
        this.load.start();
      } else {
        resolve();
      }
    });

    progressBar.destroy();
    progressBox.destroy();

    // Chuyển sang màn hình Menu chính
    this.scene.start('MainMenuScene');
  }
}
