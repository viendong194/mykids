import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { BaseLevelData } from '../types/engine';

export class SequenceEngine extends BaseEngine<BaseLevelData> {
  constructor(scene: Phaser.Scene, x: number, y: number, levelData: BaseLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
  }

  public initialize(): void {
    super.initialize();
    // TODO: Thiết lập chuỗi quy luật logic (VD: Tròn - Vuông - Tròn - ?)
  }

  public preload(): void {
    super.preload();
  }

  public create(): void {
    // TODO: Vẽ hàng dãy hình quy luật bị khuyết và các nút tùy chọn điền khuyết
  }

  public update(): void {
    super.update();
  }

  public checkAnswer(_answer: string): void {
    // TODO: Đối sánh giá trị bé điền vào ô trống xem có khớp quy luật logic hay không
  }

  protected updateTextsAndVoice(): void {
    this.playPromptVoice();
  }
}
export default SequenceEngine;
