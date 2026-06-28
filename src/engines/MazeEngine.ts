import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class MazeEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Khởi tạo lưới tọa độ của mê cung và đường đi chính xác
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Vẽ đường đi mê cung và vị trí xuất phát/đích
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: any): void {
    // TODO: Kiểm tra nhân vật/quả bóng đã di chuyển đến điểm đích chưa
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default MazeEngine;
