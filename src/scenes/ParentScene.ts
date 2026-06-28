import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { TRANSLATIONS } from '../data/translations';
import { parentService } from '../services/ParentService';
import { HeaderUI } from '../components/HeaderUI';

export class ParentScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private resetBtn!: Phaser.GameObjects.Container;
  
  // Các text hiển thị thông số thống kê
  private playtimeText!: Phaser.GameObjects.Text;
  private accuracyText!: Phaser.GameObjects.Text;
  private correctText!: Phaser.GameObjects.Text;
  private unsubscribeLang!: () => void;

  private headerUI!: HeaderUI;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private boardElements: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [];

  constructor() {
    super('ParentScene');
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;

    // 1. Hình nền xanh lá pastel đậm chất giáo dục
    this.bgGraphics = this.add.graphics();
    this.bgGraphics.fillGradientStyle(0xE0F2F1, 0xE0F2F1, 0xB2DFDB, 0xB2DFDB, 1);
    this.bgGraphics.fillRect(0, 0, width, height);

    // 2. Tạo Header UI dùng chung (quay lại CategoryScene, mở rộng cờ)
    this.headerUI = new HeaderUI(this, 'CategoryScene');

    // 3. Tiêu đề chính
    this.titleText = this.add.text(width / 2, 130, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#004D40',
      align: 'center'
    }).setOrigin(0.5);

    // 4. Vẽ bảng thống kê trung tâm
    this.createStatsBoard(width, height);

    // 5. Đồng bộ văn bản
    this.updateStatsValues();
    this.updateTexts();

    this.unsubscribeLang = languageManager.onChange(() => {
      this.updateTexts();
    });

    // 6. Lắng nghe sự kiện xoay màn hình/thay đổi kích thước
    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      if (!this.cameras || !this.cameras.main) return;
      const w = gameSize.width;
      const h = gameSize.height;

      this.cameras.main.setSize(w, h);

      this.bgGraphics.clear();
      this.bgGraphics.fillGradientStyle(0xE0F2F1, 0xE0F2F1, 0xB2DFDB, 0xB2DFDB, 1);
      this.bgGraphics.fillRect(0, 0, w, h);

      this.headerUI.reposition(w, h);
      this.titleText.setPosition(w / 2, 130);
      
      this.recreateStatsBoard(w, h);
    };

    this.scale.on('resize', resizeListener);

    this.events.on('destroy', () => {
      this.scale.off('resize', resizeListener);
      if (this.unsubscribeLang) this.unsubscribeLang();
    });
  }

  /**
   * Tạo bảng thông tin thống kê trung tâm
   */
  private createStatsBoard(width: number, height: number) {
    const isLandscape = width > height;
    
    const boardW = Math.min(width * 0.85, 640);
    const boardH = Math.min(height * 0.65, 420);
    const centerY = height * 0.55;

    // Vẽ nền bảng chính
    const boardBg = this.add.graphics();
    // Bóng đổ bảng
    boardBg.fillStyle(0x000000, 0.1);
    boardBg.fillRoundedRect(width / 2 - boardW / 2 + 5, centerY - boardH / 2 + 8, boardW, boardH, 30);
    
    // Bảng chính màu trắng sữa
    boardBg.fillStyle(0xFFFFFF, 1);
    boardBg.fillRoundedRect(width / 2 - boardW / 2, centerY - boardH / 2, boardW, boardH, 30);
    boardBg.lineStyle(5, 0x00897B, 1);
    boardBg.strokeRoundedRect(width / 2 - boardW / 2, centerY - boardH / 2, boardW, boardH, 30);
    this.boardElements.push(boardBg);

    // Phân chia ô thông số (2 cột nếu Landscape, 3 hàng nếu Portrait)
    const cardSpacing = isLandscape ? boardW * 0.44 : boardH * 0.28;
    const statsY = centerY - 30;

    // 1. Thẻ Thời gian chơi
    const timeX = isLandscape ? width / 2 - cardSpacing / 2 : width / 2;
    const timeY = isLandscape ? statsY : centerY - boardH / 3 + 20;

    const timeCard = this.add.graphics();
    timeCard.fillStyle(0xE0F7FA, 1);
    timeCard.fillRoundedRect(timeX - 120, timeY - 70, 240, 110, 20);
    timeCard.lineStyle(2, 0x00E5FF, 1);
    timeCard.strokeRoundedRect(timeX - 120, timeY - 70, 240, 110, 20);
    this.boardElements.push(timeCard);

    const timeLabel = this.add.text(timeX, timeY - 50, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '16px',
      color: '#006064',
      align: 'center'
    }).setOrigin(0.5).setName('timeLabel');
    this.boardElements.push(timeLabel);

    this.playtimeText = this.add.text(timeX, timeY - 5, '0', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#00838F'
    }).setOrigin(0.5);
    this.boardElements.push(this.playtimeText);

    // 2. Thẻ Độ chính xác
    const accX = isLandscape ? width / 2 + cardSpacing / 2 : width / 2;
    const accY = isLandscape ? statsY : centerY + 10;

    const accCard = this.add.graphics();
    accCard.fillStyle(0xE8F5E9, 1);
    accCard.fillRoundedRect(accX - 120, accY - 70, 240, 110, 20);
    accCard.lineStyle(2, 0x00E676, 1);
    accCard.strokeRoundedRect(accX - 120, accY - 70, 240, 110, 20);
    this.boardElements.push(accCard);

    const accLabel = this.add.text(accX, accY - 50, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '16px',
      color: '#1B5E20',
      align: 'center'
    }).setOrigin(0.5).setName('accLabel');
    this.boardElements.push(accLabel);

    this.accuracyText = this.add.text(accX, accY - 5, '0%', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#2E7D32'
    }).setOrigin(0.5);
    this.boardElements.push(this.accuracyText);

    // Dòng chữ phụ chú (Số câu trả lời)
    const correctLabelY = isLandscape ? centerY + boardH / 2 - 130 : centerY + boardH / 2 - 140;
    this.correctText = this.add.text(width / 2, correctLabelY, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '16px',
      color: '#555555',
      align: 'center'
    }).setOrigin(0.5);
    this.boardElements.push(this.correctText);

    // 3. Nút xóa thống kê
    const resetY = centerY + boardH / 2 - 60;
    this.resetBtn = this.add.container(width / 2, resetY);
    
    const rBg = this.add.graphics();
    rBg.fillStyle(0xD84315, 1);
    rBg.fillRoundedRect(-110, -25, 220, 50, 15);
    rBg.lineStyle(3, 0xFFFFFF, 1);
    rBg.strokeRoundedRect(-110, -25, 220, 50, 15);

    const rText = this.add.text(0, 0, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#FFFFFF'
    }).setOrigin(0.5).setName('resetText');

    this.resetBtn.add([rBg, rText]);
    this.resetBtn.setInteractive(new Phaser.Geom.Rectangle(-110, -25, 220, 50), Phaser.Geom.Rectangle.Contains);
    if (this.resetBtn.input) {
      this.resetBtn.input.cursor = 'pointer';
    }

    // Sự kiện reset số liệu
    this.resetBtn.on('pointerdown', () => {
      audioManager.playTap();
      
      this.tweens.add({
        targets: this.resetBtn,
        scaleX: 0.92,
        scaleY: 0.92,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          parentService.resetStats();
          this.updateStatsValues();
        }
      });
    });

    this.addHoverTween(this.resetBtn as any);
    this.boardElements.push(this.resetBtn);
  }

  private recreateStatsBoard(width: number, height: number) {
    this.boardElements.forEach(el => el.destroy());
    this.boardElements = [];
    this.createStatsBoard(width, height);
    this.updateStatsValues();
    this.updateTexts();
  }

  /**
   * Lấy số liệu mới nhất từ Service để render
   */
  private updateStatsValues() {
    const stats = parentService.getStats();
    
    this.playtimeText.setText(String(stats.playtime));
    this.accuracyText.setText(`${stats.accuracy}%`);

    const lang = languageManager.getLanguage();
    const tStr = TRANSLATIONS[lang].attempts;
    // Replace placeholder {correct} và {incorrect}
    const formatted = tStr
      .replace('{correct}', String(stats.correct))
      .replace('{incorrect}', String(stats.incorrect));
    
    this.correctText.setText(formatted);
  }

  private updateTexts() {
    const lang = languageManager.getLanguage();

    if (this.titleText) {
      this.titleText.setText(lang === 'vi' ? 'BÁO CÁO PHỤ HUYNH 📊' : 'PARENT STATS REPORT 📊');
    }

    const timeLabel = this.children.getByName('timeLabel') as Phaser.GameObjects.Text;
    if (timeLabel) {
      timeLabel.setText(TRANSLATIONS[lang].total_playtime);
    }

    const accLabel = this.children.getByName('accLabel') as Phaser.GameObjects.Text;
    if (accLabel) {
      accLabel.setText(TRANSLATIONS[lang].accuracy);
    }

    if (this.resetBtn) {
      const rText = this.resetBtn.getByName('resetText') as Phaser.GameObjects.Text;
      if (rText) {
        rText.setText(TRANSLATIONS[lang].reset_stats);
      }
    }

    this.updateStatsValues();
  }

  private addHoverTween(image: Phaser.GameObjects.Image | Phaser.GameObjects.Container) {
    image.on('pointerover', () => {
      this.tweens.add({ targets: image, scaleX: 1.08, scaleY: 1.08, duration: 150 });
    });
    image.on('pointerout', () => {
      this.tweens.add({ targets: image, scaleX: 1.0, scaleY: 1.0, duration: 150 });
    });
  }
}
export default ParentScene;
