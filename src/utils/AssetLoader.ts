import Phaser from 'phaser';

export class AssetLoader {
  /**
   * Nạp động danh sách các tài nguyên (ảnh hoặc Base64 SVG) vào Cache của Phaser.
   * Trả về Promise hoàn thành khi toàn bộ tài nguyên được nạp xong.
   * Nếu tài nguyên đã tồn tại trong Cache, tự động bỏ qua để tiết kiệm dung lượng và RAM.
   */
  public static loadAssets(scene: Phaser.Scene, assets: Record<string, string>): Promise<void> {
    return new Promise((resolve) => {
      let needsLoad = false;

      for (const [key, dataUrlOrPath] of Object.entries(assets)) {
        // Kiểm tra xem texture đã được nạp trước đó chưa
        if (!scene.textures.exists(key)) {
          if (dataUrlOrPath.toLowerCase().endsWith('.svg') || dataUrlOrPath.toLowerCase().includes('.svg?')) {
            // Nạp file SVG thông qua scene.load.svg để vẽ lại chính xác kích thước 256x256 sắc nét
            scene.load.svg(key, dataUrlOrPath, { width: 256, height: 256 });
          } else {
            scene.load.image(key, dataUrlOrPath);
          }
          needsLoad = true;
        }
      }

      if (needsLoad) {
        // Đăng ký lắng nghe sự kiện nạp xong một lần duy nhất
        scene.load.once('complete', () => {
          resolve();
        });
        
        // Khởi chạy tiến trình tải
        scene.load.start();
      } else {
        // Tất cả tài nguyên đã có sẵn, hoàn thành ngay lập tức
        resolve();
      }
    });
  }
}
export default AssetLoader;
