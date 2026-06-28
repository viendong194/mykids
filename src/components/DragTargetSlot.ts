import Phaser from 'phaser';
import type { DragTarget } from '../types/engine';

export class DragTargetSlot extends Phaser.GameObjects.Container {
  private border!: Phaser.GameObjects.Graphics;
  private targetImg!: Phaser.GameObjects.Image;
  private labelText!: Phaser.GameObjects.Text;
  private zone!: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene, x: number, y: number, targetSize: number, targetData: DragTarget) {
    super(scene, x, y);

    // 1. Vẽ viền nét đứt của giỏ/khuôn hình mục tiêu
    this.border = scene.add.graphics();
    this.border.fillStyle(0x000000, 0.04);
    this.border.fillRoundedRect(-targetSize / 2, -targetSize / 2, targetSize, targetSize, 35);
    
    this.border.lineStyle(6, 0x00ACC1, 0.4);
    this.border.strokeRoundedRect(-targetSize / 2, -targetSize / 2, targetSize, targetSize, 35);

    // 2. Hình bóng mờ mục tiêu (Shadow reference)
    this.targetImg = scene.add.image(0, -10, targetData.asset);
    const defaultScale = targetData.scale || 1;
    this.targetImg.setDisplaySize((targetSize - 35) * defaultScale, (targetSize - 35) * defaultScale);
    this.targetImg.setAlpha(0.65); // Bóng mờ gợi ý cho bé

    // 3. Nhãn chữ hiển thị tên tiếng Việt/Anh/Trung/Nhật
    this.labelText = scene.add.text(0, targetSize / 2 + 18, targetData.name, {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#00796B',
      align: 'center'
    }).setOrigin(0.5);

    this.add([this.border, this.targetImg, this.labelText]);

    // Gán dữ liệu định danh
    this.setData('id', targetData.id);
    this.setData('size', targetSize);

    // 4. Khởi tạo vùng va chạm thả DropZone quy đổi về tọa độ thế giới (world coordinate)
    const worldX = x;
    const worldY = y;
    
    this.zone = scene.add.zone(worldX, worldY, targetSize, targetSize)
      .setRectangleDropZone(targetSize, targetSize);
    
    this.zone.setData('targetContainer', this);

    scene.add.existing(this);
  }

  /**
   * Đồng bộ ngôn ngữ nhãn chữ từ xa
   */
  public updateLabel(newName: string) {
    if (this.labelText) {
      this.labelText.setText(newName);
    }
  }

  public destroy(fromScene?: boolean) {
    if (this.zone) {
      this.zone.destroy();
    }
    super.destroy(fromScene);
  }
}
export default DragTargetSlot;
