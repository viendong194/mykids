import Phaser from 'phaser';

export class AssetManager {
  private static instance: AssetManager;

  private constructor() {}

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /**
   * Nạp động tài nguyên của chủ đề bài học
   */
  public preloadAssets(_scene: Phaser.Scene, _assets: Record<string, string>): Promise<void> {
    // TODO: Nạp động tài nguyên SVG/PNG/Audio tĩnh ở runtime
    return Promise.resolve();
  }

  /**
   * Dọn dẹp cache texture của Phaser để chống rò rỉ bộ nhớ (Rule 7)
   */
  public unloadUnusedAssets(_scene: Phaser.Scene, _activeKeys: string[]): void {
    // TODO: Quét và giải phóng texture không sử dụng trong cache
  }
}

export const assetManager = AssetManager.getInstance();
export default assetManager;
