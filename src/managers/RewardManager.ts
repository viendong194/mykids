import Phaser from 'phaser';

export class RewardManager {
  private static instance: RewardManager;

  private constructor() {}

  public static getInstance(): RewardManager {
    if (!RewardManager.instance) {
      RewardManager.instance = new RewardManager();
    }
    return RewardManager.instance;
  }

  /**
   * Bắn pháo hoa Confetti chúc mừng bé hoàn thành tốt
   */
  public triggerConfetti(_scene: Phaser.Scene, _x: number, _y: number): void {
    // TODO: Tạo hiệu ứng pháo hoa xoắn ốc/vòng tròn rực rỡ
  }

  /**
   * Mở khóa Sticker thưởng lưu giữ trong bộ sưu tập
   */
  public unlockSticker(_stickerId: string): void {
    // TODO: Lưu trữ nhãn dán thưởng mở khóa vào bộ sưu tập lưu trữ
  }
}

export const rewardManager = RewardManager.getInstance();
export default rewardManager;
