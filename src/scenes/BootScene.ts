import Phaser from 'phaser';
import { SVG_ASSETS } from '../assets/SVGs';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Thiết lập màu nền xanh bầu trời pastel dịu nhẹ trong lúc tải
    this.cameras.main.setBackgroundColor('#E3F2FD');

    // Tạo thanh hiển thị tiến trình tải (cho giao diện chuyên nghiệp)
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0xBBDEFB, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 25, 320, 50, 15);

    // Lắng nghe sự kiện tiến trình tải tài nguyên
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x2196F3, 1);
      progressBar.fillRoundedRect(width / 2 - 150, height / 2 - 15, 300 * value, 30, 10);
    });

    // Lắng nghe lỗi tải file (in ra chi tiết để dễ dàng debug)
    this.load.on('loaderror', (fileObj: any) => {
      console.error('❌ Phaser Loader Error! Failed to load asset:', {
        key: fileObj.key,
        url: fileObj.url,
        type: fileObj.type
      });
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
    });

    // Tải toàn bộ tài nguyên SVG lúc khởi động
    for (const key of Object.keys(SVG_ASSETS)) {
      const dataUrlOrPath = SVG_ASSETS[key];
      if (dataUrlOrPath.toLowerCase().endsWith('.svg') || dataUrlOrPath.toLowerCase().includes('.svg?')) {
        this.load.svg(key, dataUrlOrPath, { width: 256, height: 256 });
      } else {
        this.load.image(key, dataUrlOrPath);
      }
    }
  }

  create() {
    // Chuyển sang màn hình Menu chính
    this.scene.start('MainMenuScene');
  }
}
