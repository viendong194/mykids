import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';

export class ParentGate extends Phaser.GameObjects.Container {
  private overlay!: Phaser.GameObjects.Graphics;
  private board!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private questionText!: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Container[] = [];
  private closeButton!: Phaser.GameObjects.Container;
  
  private num1: number = 0;
  private num2: number = 0;
  private correctAnswer: number = 0;
  private options: number[] = [];

  private onSuccess: () => void;
  private onCancel: () => void;

  constructor(scene: Phaser.Scene, onSuccess: () => void, onCancel: () => void) {
    const width = scene.scale.width;
    const height = scene.scale.height;

    // Đặt container ở chính giữa màn hình
    super(scene, width / 2, height / 2);
    
    this.onSuccess = onSuccess;
    this.onCancel = onCancel;

    // Sinh bài toán đố ngẫu nhiên cho phụ huynh
    this.generateMathProblem();

    // Tạo giao diện
    this.createUI(width, height);

    // Thêm container vào scene
    this.scene.add.existing(this);

    // Hiệu ứng mở rộng bảng (Pop-in animation)
    this.setScale(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  /**
   * Sinh bài toán cộng ngẫu nhiên (VD: 8 + 7 = 15) và các đáp án nhiễu
   */
  private generateMathProblem() {
    this.num1 = Phaser.Math.Between(5, 12);
    this.num2 = Phaser.Math.Between(5, 12);
    this.correctAnswer = this.num1 + this.num2;

    const set = new Set<number>();
    set.add(this.correctAnswer);

    while (set.size < 3) {
      const offset = Phaser.Math.Between(-4, 4);
      const val = this.correctAnswer + offset;
      if (val > 0) {
        set.add(val);
      }
    }

    this.options = Array.from(set);
    Phaser.Utils.Array.Shuffle(this.options);
  }

  /**
   * Vẽ giao diện cửa sổ đối thoại
   */
  private createUI(screenWidth: number, screenHeight: number) {
    // 1. Tạo màn che mờ bảo vệ phía sau (Overlay)
    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.6);
    // Quy đổi về tọa độ tương đối của Container (tâm màn hình)
    this.overlay.fillRect(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight);
    
    // Ngăn chặn sự kiện chạm trúng các nút phía sau màn che
    this.overlay.setInteractive(
      new Phaser.Geom.Rectangle(-screenWidth / 2, -screenHeight / 2, screenWidth, screenHeight),
      Phaser.Geom.Rectangle.Contains
    );
    this.add(this.overlay);

    // 2. Tạo bảng thông tin chính
    const boardW = Math.min(screenWidth * 0.85, 480);
    const boardH = Math.min(screenHeight * 0.7, 380);

    this.board = this.scene.add.graphics();
    // Bóng đổ nhẹ
    this.board.fillStyle(0x000000, 0.2);
    this.board.fillRoundedRect(-boardW / 2 + 5, -boardH / 2 + 8, boardW, boardH, 35);
    
    // Thân bảng trắng
    this.board.fillStyle(0xFFFFFF, 1);
    this.board.fillRoundedRect(-boardW / 2, -boardH / 2, boardW, boardH, 35);
    // Viền xanh đậm
    this.board.lineStyle(6, 0x00ACC1, 1);
    this.board.strokeRoundedRect(-boardW / 2, -boardH / 2, boardW, boardH, 35);

    this.add(this.board);

    // 3. Tiêu đề hướng dẫn (Chỉ dành cho phụ huynh)
    this.titleText = this.scene.add.text(0, -boardH / 2 + 45, 'KHU VỰC PHỤ HUYNH', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#00796B',
      align: 'center'
    }).setOrigin(0.5);

    const subText = this.scene.add.text(0, -boardH / 2 + 85, 'Vui lòng giải phép tính bên dưới để tiếp tục:', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '16px',
      color: '#555555',
      align: 'center',
      wordWrap: { width: boardW - 60 }
    }).setOrigin(0.5);

    this.add([this.titleText, subText]);

    // 4. Phép toán câu hỏi
    this.questionText = this.scene.add.text(0, -15, `${this.num1} + ${this.num2} = ?`, {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#3E2723',
      align: 'center'
    }).setOrigin(0.5);
    
    this.add(this.questionText);

    // 5. Ba nút tùy chọn đáp án
    const btnW = 90;
    const btnSpacing = 110;
    const startX = -btnSpacing;
    const btnY = boardH / 2 - 80;

    this.options.forEach((val, idx) => {
      const bx = startX + idx * btnSpacing;
      const btn = this.scene.add.container(bx, btnY);

      // Vẽ hình dạng nút bong bóng đáp án
      const bg = this.scene.add.graphics();
      bg.fillStyle(0xFF9800, 1); // Màu cam rực rỡ
      bg.fillCircle(0, 0, btnW / 2);
      bg.lineStyle(4, 0xFFFFFF, 1);
      bg.strokeCircle(0, 0, btnW / 2);

      const valText = this.scene.add.text(0, 0, String(val), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#FFFFFF'
      }).setOrigin(0.5);

      btn.add([bg, valText]);

      // Vùng click
      btn.setInteractive(new Phaser.Geom.Circle(0, 0, btnW / 2), Phaser.Geom.Circle.Contains);
      if (btn.input) {
        btn.input.cursor = 'pointer';
      }

      btn.on('pointerdown', () => {
        this.handleSelection(val, btn);
      });

      // Hiệu ứng hover nhè nhẹ
      btn.on('pointerover', () => {
        this.scene.tweens.add({ targets: btn, scaleX: 1.1, scaleY: 1.1, duration: 150 });
      });
      btn.on('pointerout', () => {
        this.scene.tweens.add({ targets: btn, scaleX: 1.0, scaleY: 1.0, duration: 150 });
      });

      this.optionButtons.push(btn);
      this.add(btn);
    });

    // 6. Nút Đóng (Góc trên bên phải bảng)
    this.closeButton = this.scene.add.container(boardW / 2 - 15, -boardH / 2 + 15);
    const cBg = this.scene.add.graphics();
    cBg.fillStyle(0xE53935, 1); // Đỏ nổi bật
    cBg.fillCircle(0, 0, 22);
    cBg.lineStyle(2, 0xFFFFFF, 1);
    cBg.strokeCircle(0, 0, 22);

    const cText = this.scene.add.text(0, -1, 'X', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#FFFFFF'
    }).setOrigin(0.5);

    this.closeButton.add([cBg, cText]);
    this.closeButton.setInteractive(new Phaser.Geom.Circle(0, 0, 22), Phaser.Geom.Circle.Contains);
    if (this.closeButton.input) {
      this.closeButton.input.cursor = 'pointer';
    }

    this.closeButton.on('pointerdown', () => {
      audioManager.playTap();
      this.dismiss(this.onCancel);
    });

    this.add(this.closeButton);
  }

  /**
   * Xử lý lựa chọn đáp án
   */
  private handleSelection(val: number, btn: Phaser.GameObjects.Container) {
    audioManager.playTap();

    if (val === this.correctAnswer) {
      // Đúng: Phát tiếng Correct và mở khóa thành công cổng
      audioManager.playCorrect();
      this.dismiss(this.onSuccess);
    } else {
      // Sai: Rung lắc nút đáp án đó
      audioManager.playIncorrect();
      const startX = btn.x;
      this.scene.tweens.add({
        targets: btn,
        x: { from: startX - 10, to: startX + 10 },
        duration: 60,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          btn.x = startX;
        }
      });
    }
  }

  /**
   * Biến mất kèm hiệu ứng trượt/thu nhỏ
   */
  private dismiss(callback: () => void) {
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 250,
      ease: 'Back.easeIn',
      onComplete: () => {
        callback();
        this.destroy();
      }
    });
  }

  public destroy() {
    this.optionButtons.forEach(b => b.destroy());
    this.closeButton.destroy();
    super.destroy();
  }
}
