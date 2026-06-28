import Phaser from 'phaser';

export class Confetti {
  /**
   * Tạo texture ngôi sao động bằng Canvas đưa vào bộ nhớ đệm của Phaser
   */
  public static createStarTexture(scene: Phaser.Scene) {
    if (scene.textures.exists('confetti_star')) return;

    const size = 32;
    const half = size / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.translate(half, half);
      ctx.moveTo(0, -half * 0.9);
      for (let i = 0; i < 5; i++) {
        ctx.rotate(Math.PI / 5);
        ctx.lineTo(0, -half * 0.4);
        ctx.rotate(Math.PI / 5);
        ctx.lineTo(0, -half * 0.9);
      }
      ctx.closePath();
      ctx.fill();
      
      scene.textures.addCanvas('confetti_star', canvas);
    }
  }

  /**
   * Bắn pháo hoa hình tròn từ một điểm (ví dụ: khi bé chọn đúng con vật)
   */
  public static burst(scene: Phaser.Scene, x: number, y: number) {
    this.createStarTexture(scene);

    const colors = [
      0xFF2E93, // Hồng rực rỡ
      0xFF8E53, // Cam ấm áp
      0xFFF02E, // Vàng tươi sáng
      0x2EFF8B, // Xanh lá pastel
      0x2EC6FF, // Xanh dương tươi mát
      0xAB2EFF  // Tím mộng mơ
    ];

    // Tạo bộ phát hạt Phaser 3 Emitter
    const particles = scene.add.particles(x, y, 'confetti_star', {
      speed: { min: 200, max: 400 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 1000, max: 1500 },
      gravityY: 600,
      quantity: 40,
      tint: colors,
      blendMode: 'SCREEN',
      emitting: false
    });

    particles.explode(40);
    
    // Tự động giải phóng bộ nhớ sau khi phát xong hạt
    scene.time.delayedCall(1600, () => {
      particles.destroy();
    });
  }

  /**
   * Tạo cơn mưa sao rơi khắp màn hình khi hoàn thành game xuất sắc
   */
  public static rain(scene: Phaser.Scene) {
    this.createStarTexture(scene);

    const width = scene.cameras.main.width;
    const colors = [0xFF2E93, 0xFF8E53, 0xFFF02E, 0x2EFF8B, 0x2EC6FF, 0xAB2EFF];

    // Tạo bộ phát hạt rơi từ trên trời xuống
    const particles = scene.add.particles(0, -50, 'confetti_star', {
      x: { min: 0, max: width },
      speedY: { min: 100, max: 250 },
      speedX: { min: -50, max: 50 },
      angle: { min: 0, max: 360 },
      rotate: { start: 0, end: 360 },
      scale: { start: 1, end: 0.3 },
      lifespan: 4000,
      gravityY: 50,
      quantity: 3,
      frequency: 100,
      tint: colors,
      emitting: true
    });

    // Cho mưa rơi trong 3.5 giây
    scene.time.delayedCall(3500, () => {
      particles.stop();
      scene.time.delayedCall(4500, () => {
        particles.destroy();
      });
    });
  }
}
