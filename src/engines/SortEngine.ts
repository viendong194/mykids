import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class SortEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Khởi tạo các thùng phân loại (Categories) và vật phẩm cần phân loại
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Vẽ khay đựng và các giỏ phân loại (VD: To/Nhỏ, Đỏ/Vàng)
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: { itemKey: string; basketKey: string }): void {
    // TODO: Kiểm tra vật phẩm có được thả vào đúng giỏ phân loại phù hợp không
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default SortEngine;
