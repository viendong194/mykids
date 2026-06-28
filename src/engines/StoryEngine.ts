import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class StoryEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Khởi tạo danh sách các trang truyện, nội dung đọc thoại và các điểm tương tác (Hotspots)
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Vẽ khung ảnh minh họa trang truyện, nút lật trang và bóng thoại lời kể
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: any): void {
    // TODO: Nếu truyện yêu cầu tìm hình vật dụng ẩn giấu, kiểm tra xem bé chạm có đúng tọa độ ẩn giấu không
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default StoryEngine;
