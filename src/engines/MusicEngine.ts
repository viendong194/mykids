import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class MusicEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Cấu hình dải âm nốt nhạc (Đồ - Rê - Mi - Pha - Son) và nhạc cụ
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Vẽ phím đàn sắc màu lớn dễ chạm và nút chỉ dẫn/hướng dẫn
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: string): void {
    // TODO: Nếu chế độ "Đàn theo bài mẫu", đối sánh xem bé nhấn đúng nốt nhạc chỉ dẫn tiếp theo hay không
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default MusicEngine;
