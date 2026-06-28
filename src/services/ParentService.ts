class ParentService {
  private static instance: ParentService;
  private playtime: number = 0; // thời gian chơi tính bằng giây
  private correctCount: number = 0;
  private incorrectCount: number = 0;
  private lastActive: number = 0;

  private constructor() {
    this.load();
    this.lastActive = Date.now();
    
    // Tự động định kỳ cộng dồn thời gian chơi mỗi 5 giây
    setInterval(() => this.updatePlaytime(), 5000);
  }

  public static getInstance(): ParentService {
    if (!ParentService.instance) {
      ParentService.instance = new ParentService();
    }
    return ParentService.instance;
  }

  private load() {
    this.playtime = parseInt(localStorage.getItem('mykids_playtime') || '0', 10);
    this.correctCount = parseInt(localStorage.getItem('mykids_correct') || '0', 10);
    this.incorrectCount = parseInt(localStorage.getItem('mykids_incorrect') || '0', 10);
  }

  private save() {
    localStorage.setItem('mykids_playtime', String(this.playtime));
    localStorage.setItem('mykids_correct', String(this.correctCount));
    localStorage.setItem('mykids_incorrect', String(this.incorrectCount));
  }

  /**
   * Cập nhật thời gian chơi
   */
  public updatePlaytime() {
    const now = Date.now();
    const diff = Math.floor((now - this.lastActive) / 1000);
    
    // Nếu treo máy quá lâu (trên 5 phút) thì coi như bé không hoạt động, bỏ qua
    if (diff > 0 && diff < 300) {
      this.playtime += diff;
      this.save();
    }
    this.lastActive = now;
  }

  /**
   * Đánh dấu có hoạt động tương tác trong game để cập nhật mốc thời gian hoạt động cuối
   */
  public trackActive() {
    this.lastActive = Date.now();
  }

  /**
   * Tăng số lượng câu đúng
   */
  public trackCorrect() {
    this.correctCount++;
    this.save();
  }

  /**
   * Tăng số lượng câu sai
   */
  public trackIncorrect() {
    this.incorrectCount++;
    this.save();
  }

  /**
   * Lấy số liệu thống kê hiện tại
   */
  public getStats() {
    this.updatePlaytime();
    const totalAnswers = this.correctCount + this.incorrectCount;
    const accuracy = totalAnswers > 0 ? Math.round((this.correctCount / totalAnswers) * 100) : 100;
    
    return {
      playtime: Math.round(this.playtime / 60), // Số phút đã chơi
      correct: this.correctCount,
      incorrect: this.incorrectCount,
      accuracy
    };
  }

  /**
   * Reset dữ liệu thống kê
   */
  public resetStats() {
    this.playtime = 0;
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.save();
  }
}

export const parentService = ParentService.getInstance();
export default parentService;
