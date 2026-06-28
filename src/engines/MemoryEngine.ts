import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class MemoryEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Khởi tạo mảng các lá bài úp ngẫu nhiên
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Tạo các lá bài có thể lật (Flip Cards) và xếp lưới
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: { card1: Phaser.GameObjects.Container; card2: Phaser.GameObjects.Container }): void {
    // TODO: So sánh hai lá bài lật lên xem có giống nhau hay không
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default MemoryEngine;
