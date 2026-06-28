import './style.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { AgeSelectionScene } from './scenes/AgeSelectionScene';
import { CategoryScene } from './scenes/CategoryScene';
import { GameScene } from './scenes/GameScene';
import { ParentScene } from './scenes/ParentScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  // Kích thước ban đầu bằng kích thước thực của cửa sổ trình duyệt
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#E0F2F1', // Xanh bạc hà dịu mắt cho bé
  antialias: true,
  scale: {
    // RESIZE: Phaser tự động đo container và phát sự kiện 'resize'
    // đến tất cả các scene mỗi khi cửa sổ hoặc màn hình thay đổi
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene, AgeSelectionScene, CategoryScene, GameScene, ParentScene]
};

// Khởi chạy game — Phaser.Scale.RESIZE tự xử lý toàn bộ sự kiện resize
window.addEventListener('load', () => {
  new Phaser.Game(config);
});
