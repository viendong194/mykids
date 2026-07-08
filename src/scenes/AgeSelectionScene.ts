import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { TRANSLATIONS } from '../data/translations';
import { AGE_GROUPS, type AgeGroup } from '../config/gameConfig';

export class AgeSelectionScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Container;
  private ageButtons: Phaser.GameObjects.Container[] = [];
  
  // Các nút cờ và vòng highlight
  private flags: Record<string, Phaser.GameObjects.Image> = {};
  private flagHighlights: Record<string, Phaser.GameObjects.Graphics> = {};
  private unsubscribeLang!: () => void;
  private lastOrientation: 'portrait' | 'landscape' | null = null;
  private mode: 'game' | 'zoo3d' = 'game';

  constructor() {
    super('AgeSelectionScene');
  }

  init(data: { mode?: 'game' | 'zoo3d' }) {
    this.mode = data?.mode === 'zoo3d' ? 'zoo3d' : 'game';
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.lastOrientation = width > height ? 'landscape' : 'portrait';

    // 1. Tạo hình nền Gradient dịu mát
    const bgGraphics = this.add.graphics();
    bgGraphics.fillGradientStyle(0xFFF9C4, 0xFFF9C4, 0xE0F7FA, 0xE0F7FA, 1);
    bgGraphics.fillRect(0, 0, width, height);

    // 2. Tạo Header (Quay lại & Chọn ngôn ngữ)
    this.createHeaderUI(width);

    // 3. Tiêu đề: Bé mấy tuổi rồi?
    this.titleText = this.add.text(width / 2, 140, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#E65100',
      align: 'center',
      shadow: { color: '#FFFFFF', blur: 10, fill: true, stroke: true }
    }).setOrigin(0.5);

    // 4. Tạo các nút chọn nhóm tuổi
    this.createAgeButtons(width, height);

    // 5. Đồng bộ hóa ngôn ngữ và đăng ký listener phản hồi
    this.updateTexts();
    this.unsubscribeLang = languageManager.onChange(() => {
      this.updateTexts();
      this.updateLanguageHighlights();
    });

    // 6. Lắng nghe sự kiện xoay màn hình/thay đổi kích thước
    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      if (!this.cameras || !this.cameras.main) return;
      const w = gameSize.width;
      const h = gameSize.height;

      this.cameras.main.setSize(w, h);

      bgGraphics.clear();
      bgGraphics.fillGradientStyle(0xFFF9C4, 0xFFF9C4, 0xE0F7FA, 0xE0F7FA, 1);
      bgGraphics.fillRect(0, 0, w, h);

      this.repositionManualHeader(w);
      this.titleText.setPosition(w / 2, 140);

      const currentOrientation = w > h ? 'landscape' : 'portrait';
      if (currentOrientation !== this.lastOrientation) {
        this.lastOrientation = currentOrientation;
        this.recreateAgeButtonsIfNeeded(w, h);
      } else {
        this.layoutExistingAgeButtons(w, h);
      }
    };

    this.scale.on('resize', resizeListener);

    this.events.on('destroy', () => {
      this.scale.off('resize', resizeListener);
      if (this.unsubscribeLang) this.unsubscribeLang();
    });
  }

  /**
   * Tạo nút quay lại và cụm cờ chọn ngôn ngữ (VI, EN, ZH, JA)
   */
  private createHeaderUI(width: number) {
    // Nút Quay lại (Về Menu chính)
    this.backButton = this.add.container(60, 60);
    const backBg = this.add.graphics();
    backBg.fillStyle(0x00ACC1, 1);
    backBg.fillCircle(0, 0, 32);
    backBg.lineStyle(3, 0xFFFFFF, 1);
    backBg.strokeCircle(0, 0, 32);

    const arrow = this.add.graphics();
    arrow.fillStyle(0xFFFFFF, 1);
    arrow.beginPath();
    arrow.moveTo(8, -4);
    arrow.lineTo(8, 4);
    arrow.lineTo(-2, 4);
    arrow.lineTo(-2, 10);
    arrow.lineTo(-12, 0);
    arrow.lineTo(-2, -10);
    arrow.lineTo(-2, -4);
    arrow.closePath();
    arrow.fill();

    this.backButton.add([backBg, arrow]);
    this.backButton.setInteractive(new Phaser.Geom.Circle(0, 0, 32), Phaser.Geom.Circle.Contains);
    if (this.backButton.input) {
      this.backButton.input.cursor = 'pointer';
    }

    this.backButton.on('pointerdown', () => {
      audioManager.playTap();
      this.scene.start('MainMenuScene');
    });
    this.addHoverTween(this.backButton as any);

    // Vẽ 2 lá cờ ở góc phải màn hình
    const languages = ['en', 'vi']; // Sắp xếp từ trái qua phải
    languages.forEach((langCode, index) => {
      const fx = width - 60 - index * 80;
      const fy = 60;

      // Cờ tương ứng
      const flagImage = this.add.image(fx, fy, `flag_${langCode}`)
        .setDisplaySize(60, 60)
        .setInteractive({ useHandCursor: true });

      // Sự kiện chạm để chuyển ngôn ngữ
      flagImage.on('pointerdown', () => {
        audioManager.playTap();
        languageManager.setLanguage(langCode as any);
      });

      this.addHoverTween(flagImage);
      this.flags[langCode] = flagImage;

      // Highlight vòng tròn cho cờ được chọn
      const highlight = this.add.graphics();
      this.flagHighlights[langCode] = highlight;
    });

    this.updateLanguageHighlights();
  }

  /**
   * Tạo lưới các nút tuổi (Responsive)
   */
  private getAgeGroups(): AgeGroup[] {
    // Vườn thú 3D hiện chỉ dành cho bé 2-5 tuổi, ẩn bớt nhóm 6-8
    return this.mode === 'zoo3d' ? AGE_GROUPS.filter(g => g.id !== '6-8') : AGE_GROUPS;
  }

  private createAgeButtons(width: number, height: number) {
    const isLandscape = width > height;
    const groups = this.getAgeGroups();

    const spacing = isLandscape ? 260 : 140;
    const centerOffset = (groups.length - 1) / 2;
    const centerY = height * 0.56;

    const btnW = isLandscape ? 220 : Math.min(width * 0.85, 360);
    const btnH = isLandscape ? 240 : 100;

    groups.forEach((group: AgeGroup, idx: number) => {
      let bx = width / 2;
      let by = centerY;

      if (isLandscape) {
        bx = width / 2 + (idx - centerOffset) * spacing;
      } else {
        by = centerY + (idx - centerOffset) * spacing;
      }

      const container = this.add.container(bx, by);

      // Thân nút bo tròn có bóng đổ
      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.08);
      shadow.fillRoundedRect(-btnW / 2 + 4, -btnH / 2 + 6, btnW, btnH, 25);

      const frame = this.add.graphics();
      frame.fillStyle(group.color, 1);
      frame.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 25);
      frame.lineStyle(5, 0xFFFFFF, 1);
      frame.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 25);

      // Chữ hiển thị tuổi
      const textObj = this.add.text(0, 0, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        align: 'center'
      }).setOrigin(0.5).setName('label');

      container.add([shadow, frame, textObj]);
      container.setData('groupData', group);

      // Thiết lập vùng chạm
      container.setInteractive(new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH), Phaser.Geom.Rectangle.Contains);
      if (container.input) {
        container.input.cursor = 'pointer';
      }

      container.on('pointerdown', () => {
        audioManager.playTap();
        
        // Co bóp nhẹ rồi chuyển cảnh
        this.tweens.add({
          targets: container,
          scaleX: 0.93,
          scaleY: 0.93,
          duration: 100,
          yoyo: true,
          onComplete: () => {
            if (this.mode === 'zoo3d') {
              // Luồng Vườn thú 3D: sang màn chọn game 3D, không dùng chung key tuổi của luồng 2D
              this.scene.start('Zoo3DCategoryScene', { age: group.id });
            } else {
              // Lưu độ tuổi được chọn vào localStorage
              localStorage.setItem('mykids_selected_age', group.id);
              // Chuyển sang chọn chủ đề
              this.scene.start('CategoryScene');
            }
          }
        });
      });

      this.addHoverTween(container as any);

      // Hiệu ứng bay vào từ bên ngoài
      container.setScale(0);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        delay: idx * 100,
        ease: 'Back.easeOut'
      });

      this.ageButtons.push(container);
    });
  }

  /**
   * Cập nhật ngôn ngữ
   */
  private updateTexts() {
    const lang = languageManager.getLanguage();
    
    // Đổi chữ tiêu đề
    if (this.titleText) {
      this.titleText.setText(TRANSLATIONS[lang].select_age);
    }

    // Đổi chữ trên các nút tuổi
    this.ageButtons.forEach(btn => {
      const group: AgeGroup = btn.getData('groupData');
      const textObj = btn.getByName('label') as Phaser.GameObjects.Text;
      if (textObj) {
        textObj.setText(group.label[lang]);
      }
    });
  }

  /**
   * Cập nhật vòng tròn cờ hoạt động
   */
  private updateLanguageHighlights() {
    const activeLang = languageManager.getLanguage();

    for (const [langCode, highlight] of Object.entries(this.flagHighlights)) {
      highlight.clear();
      if (langCode === activeLang) {
        const flagImg = this.flags[langCode];
        highlight.lineStyle(4, 0xFFD700, 1); // Màu vàng gold lấp lánh
        highlight.strokeCircle(flagImg.x, flagImg.y, 33);
      }
    }
  }

  private repositionManualHeader(width: number) {
    if (this.backButton) {
      this.backButton.setPosition(60, 60);
    }
    const languages = ['en', 'vi'];
    languages.forEach((langCode, index) => {
      const flagImg = this.flags[langCode];
      if (flagImg) {
        const fx = width - 60 - index * 80;
        flagImg.setPosition(fx, 60);
      }
    });
    this.updateLanguageHighlights();
  }

  private recreateAgeButtonsIfNeeded(width: number, height: number) {
    this.ageButtons.forEach(btn => btn.destroy());
    this.ageButtons = [];
    this.createAgeButtons(width, height);
    this.updateTexts();
  }

  private layoutExistingAgeButtons(width: number, height: number) {
    const isLandscape = width > height;
    const spacing = isLandscape ? 260 : 140;
    const centerOffset = (this.ageButtons.length - 1) / 2;
    const centerY = height * 0.56;

    this.ageButtons.forEach((btn, idx) => {
      let bx = width / 2;
      let by = centerY;

      if (isLandscape) {
        bx = width / 2 + (idx - centerOffset) * spacing;
      } else {
        by = centerY + (idx - centerOffset) * spacing;
      }

      btn.setPosition(bx, by);
    });
  }

  private addHoverTween(image: Phaser.GameObjects.Image | Phaser.GameObjects.Container) {
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
}
