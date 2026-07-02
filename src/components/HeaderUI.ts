import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';

export class HeaderUI extends Phaser.GameObjects.Container {
  private backButton?: Phaser.GameObjects.Container;
  private soundButton?: Phaser.GameObjects.Image;
  private flags: Record<string, Phaser.GameObjects.Image> = {};
  private flagHighlights: Record<string, Phaser.GameObjects.Graphics> = {};
  private unsubscribeLang!: () => void;

  constructor(scene: Phaser.Scene, backSceneName?: string, showSoundButton: boolean = true) {
    super(scene, 0, 0);

    const width = scene.scale.width;

    // 1. Tạo nút quay lại (nếu có cấu hình backSceneName)
    if (backSceneName) {
      this.createBackButton(backSceneName);
    }

    // 2. Tạo nút loa mở/tắt âm thanh
    if (showSoundButton) {
      this.createSoundButton(backSceneName ? 140 : 60);
    }

    // 3. Tạo cụm cờ đa ngôn ngữ (VI, EN, ZH, JA)
    this.createLanguageFlags(width);

    // 4. Lắng nghe sự thay đổi ngôn ngữ toàn cục để tự cập nhật highlight cờ
    this.unsubscribeLang = languageManager.onChange(() => {
      this.updateLanguageHighlights();
    });

    scene.add.existing(this);

    // Giải phóng sự kiện khi component bị hủy
    scene.events.once('shutdown', () => this.destroy());
    scene.events.once('destroy', () => this.destroy());
  }

  private createBackButton(backSceneName: string) {
    this.backButton = this.scene.add.container(60, 60);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x00ACC1, 1);
    bg.fillCircle(0, 0, 32);
    bg.lineStyle(3, 0xFFFFFF, 1);
    bg.strokeCircle(0, 0, 32);

    const arrow = this.scene.add.graphics();
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

    this.backButton.add([bg, arrow]);
    this.backButton.setInteractive(new Phaser.Geom.Circle(0, 0, 32), Phaser.Geom.Circle.Contains);
    if (this.backButton.input) {
      this.backButton.input.cursor = 'pointer';
    }

    this.backButton.on('pointerdown', () => {
      audioManager.playTap();
      audioManager.stopSpeaking();
      this.scene.scene.start(backSceneName);
    });

    this.addHoverTween(this.backButton as any);
    this.add(this.backButton);
  }

  private createSoundButton(x: number) {
    const soundKey = audioManager.isMuted() ? 'sound_off' : 'sound_on';
    this.soundButton = this.scene.add.image(x, 60, soundKey)
      .setDisplaySize(68, 68)
      .setInteractive({ useHandCursor: true });

    this.soundButton.on('pointerdown', () => {
      audioManager.playTap();
      const isMuted = audioManager.toggleMute();
      this.soundButton?.setTexture(isMuted ? 'sound_off' : 'sound_on');
    });

    this.addHoverTween(this.soundButton);
    this.add(this.soundButton);
  }

  private createLanguageFlags(width: number) {
    const languages = ['en', 'vi'];
    languages.forEach((langCode, index) => {
      const fx = width - 60 - index * 80;
      const fy = 60;

      const flagImg = this.scene.add.image(fx, fy, `flag_${langCode}`)
        .setDisplaySize(60, 60)
        .setInteractive({ useHandCursor: true });

      flagImg.on('pointerdown', () => {
        audioManager.playTap();
        languageManager.setLanguage(langCode as any);
      });

      this.addHoverTween(flagImg);
      this.flags[langCode] = flagImg;

      const highlight = this.scene.add.graphics();
      this.flagHighlights[langCode] = highlight;
      this.add(highlight);
      this.add(flagImg);
    });

    this.updateLanguageHighlights();
  }

  private updateLanguageHighlights() {
    const activeLang = languageManager.getLanguage();

    for (const [langCode, highlight] of Object.entries(this.flagHighlights)) {
      highlight.clear();
      if (langCode === activeLang) {
        const flagImg = this.flags[langCode];
        highlight.lineStyle(4, 0xFFD700, 1);
        highlight.strokeCircle(flagImg.x, flagImg.y, 33);
      }
    }
  }

  private addHoverTween(image: Phaser.GameObjects.Image | Phaser.GameObjects.Container) {
    image.on('pointerover', () => {
      const baseX = image.scaleX;
      const baseY = image.scaleY;
      image.setData('baseScaleX', baseX);
      image.setData('baseScaleY', baseY);
      this.scene.tweens.add({ targets: image, scaleX: baseX * 1.15, scaleY: baseY * 1.15, duration: 150, ease: 'Back.easeOut' });
    });
    image.on('pointerout', () => {
      const baseX = image.getData('baseScaleX') ?? image.scaleX;
      const baseY = image.getData('baseScaleY') ?? image.scaleY;
      this.scene.tweens.add({ targets: image, scaleX: baseX, scaleY: baseY, duration: 150, ease: 'Sine.easeOut' });
    });
  }


  public reposition(width: number, _height: number) {
    if (this.backButton) {
      this.backButton.setPosition(60, 60);
    }
    if (this.soundButton) {
      this.soundButton.setPosition(this.backButton ? 140 : 60, 60);
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

  public destroy() {
    if (this.unsubscribeLang) {
      this.unsubscribeLang();
    }
    super.destroy();
  }
}
