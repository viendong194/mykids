import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { TRANSLATIONS } from '../data/translations';
import { ParentGate } from '../components/ParentGate';

export class MainMenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private playText!: Phaser.GameObjects.Text;
  private playButton!: Phaser.GameObjects.Container;
  private soundButton!: Phaser.GameObjects.Image;
  private flagVi!: Phaser.GameObjects.Image;
  private flagEn!: Phaser.GameObjects.Image;
  private viHighlight!: Phaser.GameObjects.Graphics;
  private enHighlight!: Phaser.GameObjects.Graphics;
  
  private unsubscribeLang!: () => void;
  private parentButton!: Phaser.GameObjects.Container;

  constructor() {
    super('MainMenuScene');
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;

    // 1. Tạo hình nền Gradient động/mượt bằng Graphics
    const bgGraphics = this.add.graphics();
    bgGraphics.fillGradientStyle(0xE0F7FA, 0xE0F7FA, 0xFFE0B2, 0xFFE0B2, 1);
    bgGraphics.fillRect(0, 0, width, height);

    // Tạo các bong bóng trôi nổi phía sau làm nền động đáng yêu
    this.createFloatingBubbles(width, height);

    // 2. Tạo Texture cho nút PLAY (để không cần dùng file ảnh lớn)
    this.createPlayButtonTexture();

    // 3. Khởi tạo nút MUTE/SOUND (Góc trái)
    const soundKey = audioManager.isMuted() ? 'sound_off' : 'sound_on';
    this.soundButton = this.add.image(60, 60, soundKey)
      .setDisplaySize(75, 75)
      .setInteractive({ useHandCursor: true });
    
    this.soundButton.on('pointerdown', () => {
      audioManager.playTap();
      const isMuted = audioManager.toggleMute();
      this.soundButton.setTexture(isMuted ? 'sound_off' : 'sound_on');
    });

    // Thêm hiệu ứng nhấn (micro-interaction) cho nút âm thanh
    this.addHoverTween(this.soundButton);

    // 4. Khởi tạo các nút chọn ngôn ngữ (Góc phải)
    // Cờ Việt Nam
    this.flagVi = this.add.image(width - 60, 60, 'flag_vi')
      .setDisplaySize(65, 65)
      .setInteractive({ useHandCursor: true });
    
    // Cờ Anh
    this.flagEn = this.add.image(width - 145, 60, 'flag_en')
      .setDisplaySize(65, 65)
      .setInteractive({ useHandCursor: true });

    // Tạo vòng sáng bao quanh cờ đang chọn
    this.viHighlight = this.add.graphics();
    this.enHighlight = this.add.graphics();
    this.updateLanguageHighlights();

    // Sự kiện đổi ngôn ngữ
    this.flagVi.on('pointerdown', () => {
      audioManager.playTap();
      languageManager.setLanguage('vi');
    });
    this.flagEn.on('pointerdown', () => {
      audioManager.playTap();
      languageManager.setLanguage('en');
    });

    this.addHoverTween(this.flagVi);
    this.addHoverTween(this.flagEn);

    // 5. Tiêu đề Game
    this.titleText = this.add.text(width / 2, height * 0.3, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#FF6F00',
      align: 'center',
      shadow: { color: '#FFFFFF', blur: 15, stroke: true, fill: true }
    }).setOrigin(0.5);

    // 6. Nút PLAY Khổng Lồ
    this.playButton = this.add.container(width / 2, height * 0.65);
    
    const playBg = this.add.image(0, 0, 'play_btn_skin')
      .setDisplaySize(240, 100)
      .setInteractive({ useHandCursor: true });

    this.playText = this.add.text(0, -2, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '38px',
      fontStyle: '900',
      color: '#FFFFFF',
      shadow: { color: '#E65100', blur: 6, fill: true, stroke: true }
    }).setOrigin(0.5);

    this.playButton.add([playBg, this.playText]);

    // Hiệu ứng nhún nhảy (bouncing) cực kỳ đáng yêu cho nút Play
    this.tweens.add({
      targets: this.playButton,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Nhấn PLAY để bắt đầu game
    playBg.on('pointerdown', () => {
      // Bắt buộc kích hoạt AudioContext trong gesture người dùng
      audioManager.init();
      audioManager.playTap();

      // Hiệu ứng phóng to nhẹ khi nhấn
      this.tweens.add({
        targets: this.playButton,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 100,
        yoyo: true,
        repeat: 0,
        onComplete: () => {
          this.scene.start('AgeSelectionScene');
        }
      });
    });

    // 6.5. Tạo nút Phụ huynh ở góc dưới bên trái
    this.createParentButton(height);

    // 7. Đồng bộ hóa văn bản giao diện
    this.updateTexts();

    // Lắng nghe sự thay đổi ngôn ngữ toàn cục
    this.unsubscribeLang = languageManager.onChange(() => {
      this.updateTexts();
      this.updateLanguageHighlights();
    });

    // 8. Lắng nghe sự kiện xoay màn hình/thay đổi kích thước
    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      if (!this.cameras || !this.cameras.main) return;
      const w = gameSize.width;
      const h = gameSize.height;

      this.cameras.main.setSize(w, h);

      bgGraphics.clear();
      bgGraphics.fillGradientStyle(0xE0F7FA, 0xE0F7FA, 0xFFE0B2, 0xFFE0B2, 1);
      bgGraphics.fillRect(0, 0, w, h);

      this.soundButton.setPosition(60, 60);
      this.flagVi.setPosition(w - 60, 60);
      this.flagEn.setPosition(w - 145, 60);
      this.updateLanguageHighlights();

      this.titleText.setPosition(w / 2, h * 0.3);
      this.playButton.setPosition(w / 2, h * 0.65);
      this.parentButton.setPosition(90, h - 55);
    };

    this.scale.on('resize', resizeListener);

    this.events.on('destroy', () => {
      this.scale.off('resize', resizeListener);
      if (this.unsubscribeLang) this.unsubscribeLang();
    });
  }

  /**
   * Tạo bong bóng bay lơ lửng phía sau màn hình
   */
  private createFloatingBubbles(width: number, height: number) {
    const bubbleColors = [0xBBDEFB, 0xFFECB3, 0xF8BBD0, 0xC8E6C9];
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(height, height + 100);
      const radius = Phaser.Math.Between(15, 40);
      const color = Phaser.Utils.Array.GetRandom(bubbleColors);

      const circle = this.add.graphics();
      circle.fillStyle(color, 0.4);
      circle.fillCircle(0, 0, radius);
      
      const container = this.add.container(x, y, [circle]);
      
      this.tweens.add({
        targets: container,
        y: -100,
        x: x + Phaser.Math.Between(-80, 80),
        duration: Phaser.Math.Between(8000, 15000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 5000),
        ease: 'Linear'
      });
    }
  }

  /**
   * Tạo da (skin) cho nút Play bằng Phaser Graphics
   */
  private createPlayButtonTexture() {
    if (this.textures.exists('play_btn_skin')) return;

    const width = 260;
    const height = 110;
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Tạo bóng mờ phía dưới
    graphics.fillStyle(0xE65100, 0.5);
    graphics.fillRoundedRect(5, 5, width, height, 40);

    // Nền chính của nút (Màu cam rực rỡ)
    graphics.fillStyle(0xFF7043, 1);
    graphics.fillRoundedRect(0, 0, width, height, 40);

    // Viền trắng nổi bật
    graphics.lineStyle(5, 0xFFFFFF, 1);
    graphics.strokeRoundedRect(0, 0, width, height, 40);

    // Xuất ra thành texture dạng ảnh
    graphics.generateTexture('play_btn_skin', width + 10, height + 10);
    graphics.destroy();
  }

  /**
   * Tạo hiệu ứng scale nhỏ khi di chuột/chạm nút bấm
   */
  private addHoverTween(image: Phaser.GameObjects.Image) {
    image.on('pointerover', () => {
      const baseX = image.scaleX;
      const baseY = image.scaleY;
      image.setData('baseScaleX', baseX);
      image.setData('baseScaleY', baseY);
      this.tweens.add({ targets: image, scaleX: baseX * 1.15, scaleY: baseY * 1.15, duration: 150, ease: 'Back.easeOut' });
    });
    image.on('pointerout', () => {
      const baseX = image.getData('baseScaleX') ?? image.scaleX;
      const baseY = image.getData('baseScaleY') ?? image.scaleY;
      this.tweens.add({ targets: image, scaleX: baseX, scaleY: baseY, duration: 150, ease: 'Sine.easeOut' });
    });
  }

  /**
   * Cập nhật vòng tròn đánh dấu ngôn ngữ đang chọn
   */
  private updateLanguageHighlights() {
    const activeLang = languageManager.getLanguage();
    
    // Xóa vẽ cũ
    this.viHighlight.clear();
    this.enHighlight.clear();

    if (activeLang === 'vi') {
      this.viHighlight.lineStyle(5, 0xFFD700, 1); // Màu vàng gold
      this.viHighlight.strokeCircle(this.flagVi.x, this.flagVi.y, 36);
    } else {
      this.enHighlight.lineStyle(5, 0xFFD700, 1);
      this.enHighlight.strokeCircle(this.flagEn.x, this.flagEn.y, 36);
    }
  }

  /**
   * Cập nhật văn bản dịch thuật cho UI
   */
  private updateTexts() {
    const lang = languageManager.getLanguage();
    const trans = TRANSLATIONS[lang];

    if (this.titleText) {
      if (lang === 'vi') {
        this.titleText.setText("BÉ CHƠI\nBÉ HỌC 🧸");
      } else {
        this.titleText.setText("TODDLER\nLEARNING 🧸");
      }
    }
    
    if (this.playText) {
      this.playText.setText(trans.play);
    }

    if (this.parentButton) {
      const pText = this.parentButton.getByName('parentText') as Phaser.GameObjects.Text;
      if (pText) {
        pText.setText(lang === 'vi' ? 'PHỤ HUYNH ⚙' : 'PARENTS ⚙');
      }
    }
  }

  /**
   * Tạo nút bấm góc Phụ huynh được bảo mật
   */
  private createParentButton(height: number) {
    this.parentButton = this.add.container(90, height - 55);

    const bg = this.add.graphics();
    bg.fillStyle(0x00796B, 1);
    bg.fillRoundedRect(-65, -24, 130, 48, 16);
    bg.lineStyle(3, 0xFFFFFF, 1);
    bg.strokeRoundedRect(-65, -24, 130, 48, 16);

    const text = this.add.text(0, 0, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#FFFFFF'
    }).setOrigin(0.5).setName('parentText');

    this.parentButton.add([bg, text]);

    this.parentButton.setInteractive(new Phaser.Geom.Rectangle(-65, -24, 130, 48), Phaser.Geom.Rectangle.Contains);
    if (this.parentButton.input) {
      this.parentButton.input.cursor = 'pointer';
    }

    this.parentButton.on('pointerdown', () => {
      audioManager.playTap();
      // Kích hoạt toán đố trước khi cho phép mở trang cài đặt
      new ParentGate(this, () => {
        this.scene.start('ParentScene');
      }, () => {
        // Hủy
      });
    });

    this.addHoverTween(this.parentButton as any);
  }
}
