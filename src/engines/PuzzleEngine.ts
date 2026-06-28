import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class PuzzleEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Khởi tạo danh sách các mảnh ghép hình (Jigsaw pieces)
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Vẽ khung nền ghép hình và rải các mảnh ghép
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: any): void {
    // TODO: Đối sánh vị trí mảnh ghép được thả xem có đúng vị trí khớp mẫu không
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default PuzzleEngine;
