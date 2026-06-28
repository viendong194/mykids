export class SaveManager {
  private static instance: SaveManager;

  private constructor() {}

  public static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  /**
   * Lưu dữ liệu cặp khóa-giá trị bất kỳ vào bộ nhớ cục bộ
   */
  public save(_key: string, _value: any): void {
    // TODO: Ghi đệm chuỗi JSON vào localStorage
  }

  /**
   * Đọc dữ liệu từ bộ nhớ cục bộ
   */
  public load<T>(_key: string, defaultValue: T): T {
    // TODO: Đọc và giải tuần tự hóa JSON từ localStorage
    return defaultValue;
  }

  /**
   * Xóa một khóa hoặc toàn bộ dữ liệu lưu trữ của game
   */
  public clear(_key?: string): void {
    // TODO: Xóa khóa tương ứng hoặc dọn dẹp sạch sẽ
  }
}

export const saveManager = SaveManager.getInstance();
export default saveManager;
