import { type GameLanguage } from './LanguageManager';

export class ContentManager {
  private static instance: ContentManager;

  private constructor() {}

  public static getInstance(): ContentManager {
    if (!ContentManager.instance) {
      ContentManager.instance = new ContentManager();
    }
    return ContentManager.instance;
  }

  /**
   * Tải động danh sách level cấu hình từ máy chủ (hoặc public folder)
   */
  public async fetchLevels(_lang: GameLanguage, _age: string, _category: string): Promise<any[]> {
    // TODO: Thực hiện HTTP GET fetch(/content/{lang}/{age}/{category}.json) ở runtime
    return [];
  }
}

export const contentManager = ContentManager.getInstance();
export default contentManager;
