import Phaser from 'phaser';
import type { DragItem } from '../types/engine';

export class DragItemCard extends Phaser.GameObjects.Container {
  private shadow!: Phaser.GameObjects.Graphics;
  private bg!: Phaser.GameObjects.Graphics;
  private image!: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, itemSize: number, itemData: DragItem) {
    super(scene, x, y);

    // 1. Tạo bóng đổ nhạt
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.05);
    this.shadow.fillRoundedRect(-itemSize / 2 + 3, -itemSize / 2 + 5, itemSize, itemSize, 25);

    // 2. Tạo viền trắng nổi bật cho vật phẩm
    this.bg = scene.add.graphics();
    this.bg.fillStyle(0xFFFFFF, 1);
    this.bg.fillRoundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 25);
    this.bg.lineStyle(4, 0xFFE082, 1); // Viền cam nhạt
    this.bg.strokeRoundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 25);

    // 3. Tạo hình ảnh minh họa
    this.image = scene.add.image(0, 0, itemData.asset);
    const defaultScale = itemData.scale || 1;
    this.image.setDisplaySize((itemSize - 20) * defaultScale, (itemSize - 20) * defaultScale);

    this.add([this.shadow, this.bg, this.image]);

    // Gán dữ liệu kéo thả để dễ tra cứu trong Engine chính
    this.setData('itemData', itemData);
    this.setData('homeX', x);
    this.setData('homeY', y);

    // Thiết lập vùng tương tác kéo thả của Phaser
    this.setInteractive(
      new Phaser.Geom.Rectangle(-itemSize / 2, -itemSize / 2, itemSize, itemSize),
      Phaser.Geom.Rectangle.Contains
    );

    if (this.input) {
      this.input.cursor = 'grab';
    }

    scene.input.setDraggable(this);

    // Thêm container này vào màn chơi
    scene.add.existing(this);
  }
}
export default DragItemCard;
