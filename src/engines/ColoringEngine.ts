import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class ColoringEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Khởi tạo bảng màu vẽ và các vùng tô màu
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Vẽ hình vẽ nét đen trắng và khay bút màu sắc
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: { zoneId: string; color: number }): void {
    // TODO: Chấm điểm xem màu sắc bé tô vào vùng có đúng với gợi ý mẫu không
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default ColoringEngine;
