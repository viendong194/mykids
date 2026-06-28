import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { TRANSLATIONS } from '../data/translations';
import { Confetti } from './Confetti';

export class VictoryOverlay extends Phaser.GameObjects.Container {
  private congratsText!: Phaser.GameObjects.Text;
  private replayText!: Phaser.GameObjects.Text;
  private replayBtn!: Phaser.GameObjects.Container;
  private unsubscribeLang!: () => void;
  private onReplayCallback: () => void;

  constructor(scene: Phaser.Scene, onReplay: () => void) {
    const width = scene.scale.width;
    const height = scene.scale.height;

    super(scene, width / 2, height / 2);
    this.onReplayCallback = onReplay;

    // 1. Dựng giao diện
    this.createUI(width, height);

    // 2. Chạy pháo hoa rực rỡ và phát nhạc mừng
    audioManager.playVictory();
    Confetti.rain(this.scene);

    const lang = languageManager.getLanguage();
    audioManager.speak(TRANSLATIONS[lang].congrats, lang);

    // 3. Đăng ký sự kiện đổi ngôn ngữ để dịch lại
    this.unsubscribeLang = languageManager.onChange(() => {
      this.updateTexts();
    });

    this.scene.add.existing(this);

    // Hiệu ứng phóng to nhẹ xuất hiện
    this.setScale(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 350,
      ease: 'Back.easeOut'
    });
  }

  private createUI(width: number, height: number) {
    // Màn che mờ bóng tối sau bảng
    const bgShadow = this.scene.add.graphics();
    bgShadow.fillStyle(0x000000, 0.45);
    bgShadow.fillRect(-width / 2, -height / 2, width, height);

    // Ngăn tương tác với các thẻ phía sau bảng
    bgShadow.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);

    // Bảng quà tặng màu trắng sữa sữa
    const boardW = Math.min(width * 0.85, 450);
    const boardH = Math.min(height * 0.65, 410);

    const boardBg = this.scene.add.graphics();
    boardBg.fillStyle(0x000000, 0.15);
    boardBg.fillRoundedRect(-boardW / 2 + 5, -boardH / 2 + 8, boardW, boardH, 40);
    
    boardBg.fillStyle(0xFFFDE7, 1);
    boardBg.fillRoundedRect(-boardW / 2, -boardH / 2, boardW, boardH, 40);
    boardBg.lineStyle(8, 0xFFB300, 1);
    boardBg.strokeRoundedRect(-boardW / 2, -boardH / 2, boardW, boardH, 40);

    // Ngôi sao phần thưởng khổng lồ xoay tròn và nhún nhảy
    const prize = this.scene.add.image(0, -boardH * 0.14, 'star')
      .setDisplaySize(155, 155);

    this.scene.tweens.add({
      targets: prize,
      angle: 360,
      duration: 10000,
      repeat: -1,
      ease: 'Linear'
    });
    this.scene.tweens.add({
      targets: prize,
      scaleX: 1.15,
      scaleY: 1.15,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut'
    });

    // Chữ Chúc mừng
    this.congratsText = this.scene.add.text(0, boardH * 0.16, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#E65100',
      align: 'center',
      wordWrap: { width: boardW - 40 }
    }).setOrigin(0.5);

    // Tạo nút Chơi lại
    this.createReplayBtn(boardH);

    this.add([bgShadow, boardBg, prize, this.congratsText, this.replayBtn]);
    this.updateTexts();
  }

  private createReplayBtn(boardH: number) {
    this.replayBtn = this.scene.add.container(0, boardH * 0.36);

    // Tạo da cho nút Replay (nếu chưa có)
    this.createReplayBtnTexture();

    const btnBg = this.scene.add.image(0, 0, 'replay_btn_skin')
      .setDisplaySize(210, 75)
      .setInteractive({ useHandCursor: true });

    this.replayText = this.scene.add.text(0, -2, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#FFFFFF',
      shadow: { color: '#004D40', blur: 4, fill: true, stroke: true }
    }).setOrigin(0.5);

    this.replayBtn.add([btnBg, this.replayText]);

    btnBg.on('pointerdown', () => {
      audioManager.playTap();
      this.scene.tweens.add({
        targets: this.replayBtn,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          this.onReplayCallback();
          this.destroy();
        }
      });
    });

    this.scene.tweens.add({
      targets: this.replayBtn,
      scaleX: 1.08,
      scaleY: 1.08,
      yoyo: true,
      repeat: -1,
      duration: 800,
      ease: 'Sine.easeInOut'
    });
  }

  private createReplayBtnTexture() {
    if (this.scene.textures.exists('replay_btn_skin')) return;

    const width = 240;
    const height = 90;
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });

    graphics.fillStyle(0x004D40, 0.5);
    graphics.fillRoundedRect(4, 4, width, height, 30);

    graphics.fillStyle(0x009688, 1);
    graphics.fillRoundedRect(0, 0, width, height, 30);
    graphics.lineStyle(4, 0xFFFFFF, 1);
    graphics.strokeRoundedRect(0, 0, width, height, 30);

    graphics.generateTexture('replay_btn_skin', width + 8, height + 8);
    graphics.destroy();
  }

  private updateTexts() {
    const lang = languageManager.getLanguage();
    const trans = TRANSLATIONS[lang];

    if (this.congratsText) {
      this.congratsText.setText(trans.congrats);
    }
    if (this.replayText) {
      this.replayText.setText(trans.replay);
    }
  }

  public destroy() {
    if (this.unsubscribeLang) {
      this.unsubscribeLang();
    }
    super.destroy();
  }
}
export default VictoryOverlay;
