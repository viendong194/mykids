export interface PlayStats {
  correct: number;
  incorrect: number;
  playtime: number;
  accuracy: number;
}

export class ProgressManager {
  private static instance: ProgressManager;

  private constructor() {}

  public static getInstance(): ProgressManager {
    if (!ProgressManager.instance) {
      ProgressManager.instance = new ProgressManager();
    }
    return ProgressManager.instance;
  }

  /**
   * Lưu thông số tương tác đúng của trẻ nhỏ
   */
  public recordCorrect(): void {
    // TODO: Tăng chỉ số đúng và cập nhật tỷ lệ chính xác
  }

  /**
   * Lưu thông số tương tác sai
   */
  public recordIncorrect(): void {
    // TODO: Tăng chỉ số sai và cập nhật tỷ lệ chính xác
  }

  /**
   * Theo dõi thời lượng chơi của trẻ
   */
  public addPlaytimeMinutes(_minutes: number): void {
    // TODO: Tăng thời lượng tích lũy tính bằng phút
  }
}

export const progressManager = ProgressManager.getInstance();
export default progressManager;
