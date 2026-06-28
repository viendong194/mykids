import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import type { BaseLevelData, GameEngine } from '../types/engine';

export abstract class BaseEngine<T extends BaseLevelData> extends Phaser.GameObjects.Container implements GameEngine {
  protected levelData!: T;
  protected onCompleteCallback: () => void;
  protected interactiveLocked: boolean = false;
  private unsubscribeLang: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, levelData: T, onComplete: () => void) {
    super(scene, x, y);
    this.onCompleteCallback = onComplete;

    // 1. Đăng ký hiển thị trong Scene
    this.scene.add.existing(this);

    // 2. Chạy đúng chu kỳ GameEngine mới
    this.initialize();
    this.preload();
    this.loadLevel(levelData);

    // 3. Đăng ký sự kiện thay đổi ngôn ngữ
    this.unsubscribeLang = languageManager.onChange(() => {
      this.updateTextsAndVoice();
    });
  }

  /**
   * Khởi tạo các trạng thái ban đầu của Engine
   */
  public initialize(): void {
    this.interactiveLocked = false;
  }

  /**
   * Tiền nạp tài nguyên hoặc kiểm tra cache nếu cần (Engine con ghi đè nếu cần)
   */
  public preload(): void {}

  /**
   * Nạp cấu hình màn chơi hiện tại
   */
  public loadLevel(levelData: T): void {
    this.levelData = levelData;
  }

  /**
   * Tạo dựng đồ họa giao diện (Engine con phải triển khai)
   */
  public abstract create(): void;

  /**
   * Cập nhật logic theo chu kỳ game (Engine con ghi đè nếu cần)
   */
  public update(): void {}

  /**
   * Kiểm tra và đối sánh đáp án (Engine con phải triển khai)
   */
  public abstract checkAnswer(answer: any): void;

  /**
   * Đặt lại trạng thái màn chơi để chơi lại hoặc thử lại
   */
  public reset(): void {
    this.interactiveLocked = false;
  }

  /**
   * Cập nhật động cấu hình level từ bên ngoài (khi đổi ngôn ngữ)
   */
  public updateLevelData(newData: T) {
    this.loadLevel(newData);
    this.updateTextsAndVoice();
  }

  /**
   * Đọc câu hướng dẫn
   */
  public playPromptVoice() {
    if (this.interactiveLocked) return;
    const lang = languageManager.getLanguage();
    const promptText = this.levelData.voiceText;
    audioManager.speak(promptText, lang);
  }

  protected playPromptVoiceDelayed(delayMs: number = 500) {
    this.scene.time.delayedCall(delayMs, () => {
      this.playPromptVoice();
    });
  }

  /**
   * Đồng bộ lại chữ khi đổi ngôn ngữ
   */
  protected abstract updateTextsAndVoice(): void;

  /**
   * Giải phóng tài nguyên và dọn dẹp các sự kiện
   */
  public destroy(fromScene?: boolean) {
    if (this.unsubscribeLang) {
      this.unsubscribeLang();
    }
    super.destroy(fromScene);
  }

  public resize(_width: number, _height: number): void {
    // Sẽ được ghi đè bởi các Engine con để thay đổi tọa độ hiển thị
  }
}
export default BaseEngine;
