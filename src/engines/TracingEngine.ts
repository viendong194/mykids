import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class TracingEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Đọc tọa độ các điểm mốc (Waypoints) tạo thành hình mẫu/chữ cái mẫu
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Vẽ hình/chữ nét đứt mờ gợi ý và tạo bút vẽ
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: any): void {
    // TODO: Kiểm tra xem nét vẽ của bé có đi qua đúng tất cả các mốc (Waypoints) theo chiều chuẩn không
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default TracingEngine;
