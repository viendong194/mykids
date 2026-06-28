import Phaser from 'phaser';
import { SVG_ASSETS } from '../assets/SVGs';

/**
 * Fetch một file SVG từ URL, validate nội dung, rồi trả về data URL base64.
 * Nếu server trả về HTML (SPA redirect) → throw Error thay vì crash Phaser.
 */
async function fetchSvgAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`⚠️ BootScene: HTTP ${response.status} for ${url}`);
      return null;
    }
    const text = await response.text();
    const trimmed = text.trimStart();
    if ((!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) || !text.includes('</svg>')) {
      console.warn(`⚠️ BootScene: Invalid SVG content at ${url} — server returned HTML?`);
      return null;
    }
    const base64 = btoa(unescape(encodeURIComponent(text)));
    return `data:image/svg+xml;base64,${base64}`;
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
    // Thiết lập màu nền xanh bầu trời pastel dịu nhẹ trong lúc tải
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

    // ── Bước 1: Pre-fetch tất cả SVG file-path → data URL (bỏ qua data URL có sẵn) ──
    const entries = Object.entries(SVG_ASSETS);
    const resolvedAssets: Record<string, string> = {};
    let done = 0;

    const fetchPromises = entries.map(async ([key, value]) => {
      if (value.startsWith('data:')) {
        resolvedAssets[key] = value;
      } else if (value.toLowerCase().endsWith('.svg') || value.toLowerCase().includes('.svg?')) {
        const dataUrl = await fetchSvgAsDataUrl(value);
        if (dataUrl) {
          resolvedAssets[key] = dataUrl;
        }
      } else {
        resolvedAssets[key] = value;
      }
      done++;
      updateProgress(done / entries.length * 0.7); // 0-70% cho fetch phase
    });

    await Promise.all(fetchPromises);

    // ── Bước 2: Nạp vào Phaser qua scene.load.image (không có load.svg!) ──
    await new Promise<void>((resolve) => {
      let needsLoad = false;

      for (const [key, dataUrl] of Object.entries(resolvedAssets)) {
        if (!this.textures.exists(key)) {
          this.load.image(key, dataUrl);
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
