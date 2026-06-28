import Phaser from 'phaser';
import { languageManager } from '../managers/LanguageManager';
import { BaseEngine } from '../engines/BaseEngine';
import { TapEngine } from '../engines/TapEngine';
import { DragEngine } from '../engines/DragEngine';
import { MatchEngine } from '../engines/MatchEngine';
import { CountEngine } from '../engines/CountEngine';
import { HeaderUI } from '../components/HeaderUI';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { AssetLoader } from '../utils/AssetLoader';
import { SVG_ASSETS } from '../assets/SVGs';
import { generateRound } from '../services/LevelGenerator';
import type { LevelData } from '../types/engine';

export class GameScene extends Phaser.Scene {
  private selectedAge: string = '2-3';
  private selectedCategory: string = 'animals';
  
  private levels: LevelData[] = [];
  private currentLevelIndex: number = 0;
  private currentEngine: BaseEngine<any> | null = null;
  private progressStars: Phaser.GameObjects.Image[] = [];
  private unsubscribeLang!: () => void;
  private headerUI!: HeaderUI;
  private bgGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('GameScene');
  }

  init(data: { age: string; category: string }) {
    this.selectedAge = data.age || '2-3';
    this.selectedCategory = data.category || 'animals';
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;

    // 1. Nền Gradient
    this.bgGraphics = this.add.graphics();
    this.bgGraphics.fillGradientStyle(0xE0F2F1, 0xE0F2F1, 0xFFF3E0, 0xFFF3E0, 1);
    this.bgGraphics.fillRect(0, 0, width, height);

    // 2. Tạo Header UI dùng chung (quay lại CategoryScene, mở rộng cờ)
    this.headerUI = new HeaderUI(this, 'CategoryScene');

    // 3. Tải màn chơi và tài nguyên tương ứng
    this.loadLevelsAndAssets();

    // 4. Lắng nghe thay đổi ngôn ngữ để nạp lại dữ liệu văn bản hướng dẫn
    this.unsubscribeLang = languageManager.onChange(async () => {
      await this.reloadLanguageLevels();
    });

    // 5. Lắng nghe sự kiện xoay màn hình/thay đổi kích thước
    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      if (!this.cameras || !this.cameras.main) return;
      const w = gameSize.width;
      const h = gameSize.height;

      this.cameras.main.setSize(w, h);

      this.bgGraphics.clear();
      this.bgGraphics.fillGradientStyle(0xE0F2F1, 0xE0F2F1, 0xFFF3E0, 0xFFF3E0, 1);
      this.bgGraphics.fillRect(0, 0, w, h);

      this.headerUI.reposition(w, h);
      this.repositionProgressBar(w, h);

      if (this.currentEngine) {
        const centerY = h * 0.58;
        this.currentEngine.setPosition(w / 2, centerY);
        this.currentEngine.resize(w, h);
      }
    };

    this.scale.on('resize', resizeListener);

    this.events.on('destroy', () => {
      this.scale.off('resize', resizeListener);
      if (this.unsubscribeLang) this.unsubscribeLang();
      if (this.currentEngine) this.currentEngine.destroy();
    });
  }

  /**
   * Tải động cấu hình JSON và nạp các tài nguyên tương ứng
   */
  private async loadLevelsAndAssets() {
    const overlay = this.showLoadingOverlay();

    try {
      let lang = languageManager.getLanguage();
      let age = this.selectedAge;
      
      // 1. Cố gắng fetch theo ngôn ngữ và độ tuổi bé chọn
      let response = await fetch(`/content/${lang}/${age}/${this.selectedCategory}.json`);
      let contentType = response.headers.get("content-type");
      
      // 2. Nếu không có cấu hình ngôn ngữ này, chuyển sang Tiếng Anh của tuổi này
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        console.warn(`Level config for '${lang}' and age '${age}' not found. Falling back to English.`);
        lang = 'en';
        response = await fetch(`/content/en/${age}/${this.selectedCategory}.json`);
        contentType = response.headers.get("content-type");
        
        // 3. Nếu Tiếng Anh tuổi này cũng chưa có, chuyển về Tiếng Anh của nhóm tuổi mặc định 2-3
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
          console.warn(`English config for age '${age}' not found. Falling back to Age 2-3.`);
          age = '2-3';
          response = await fetch(`/content/en/2-3/${this.selectedCategory}.json`);
          contentType = response.headers.get("content-type");
          
          if (!response.ok || !contentType || !contentType.includes("application/json")) {
            throw new Error(`Failed to load any level config: ${response.status}`);
          }
        }
      }
      
      this.levels = await response.json();
      this.currentLevelIndex = 0;

      // Thu thập toàn bộ key ảnh Base64 được sử dụng trong các màn
      const categoryAssets: Record<string, string> = {};
      this.levels.forEach((lvl: any) => {
        if (lvl.type === 'tap') {
          if (SVG_ASSETS[lvl.correct]) categoryAssets[lvl.correct] = SVG_ASSETS[lvl.correct];
          lvl.options.forEach((opt: string) => {
            if (SVG_ASSETS[opt]) categoryAssets[opt] = SVG_ASSETS[opt];
          });
        } else if (lvl.type === 'drag') {
          lvl.items.forEach((item: any) => {
            if (SVG_ASSETS[item.asset]) categoryAssets[item.asset] = SVG_ASSETS[item.asset];
          });
          lvl.targets.forEach((target: any) => {
            if (SVG_ASSETS[target.asset]) categoryAssets[target.asset] = SVG_ASSETS[target.asset];
          });
        } else if (lvl.type === 'match') {
          if (lvl.target.type === 'asset' && SVG_ASSETS[lvl.target.value]) {
            categoryAssets[lvl.target.value] = SVG_ASSETS[lvl.target.value];
          }
          lvl.choices.forEach((choice: any) => {
            if (choice.type === 'asset' && SVG_ASSETS[choice.value]) {
              categoryAssets[choice.value] = SVG_ASSETS[choice.value];
            }
          });
        } else if (lvl.type === 'count') {
          if (SVG_ASSETS[lvl.object.asset]) {
            categoryAssets[lvl.object.asset] = SVG_ASSETS[lvl.object.asset];
          }
        }
      });

      // Nạp động assets vào bộ nhớ đệm
      await AssetLoader.loadAssets(this, categoryAssets);

      overlay.destroy();
      
      // Tạo thanh tiến trình (số sao tương đương số màn)
      this.createProgressBar();
      this.startLevel(this.currentLevelIndex);
    } catch (e) {
      console.error("Failed to load levels or assets:", e);
      overlay.destroy();
      this.showErrorNotification();
    }
  }

  /**
   * Nạp lại JSON khi thay đổi ngôn ngữ để cập nhật voiceText
   */
  private async reloadLanguageLevels() {
    try {
      let lang = languageManager.getLanguage();
      let age = this.selectedAge;
      
      let response = await fetch(`/content/${lang}/${age}/${this.selectedCategory}.json`);
      let contentType = response.headers.get("content-type");
      
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        console.warn(`Reload level config for '${lang}' failed. Falling back to English.`);
        lang = 'en';
        response = await fetch(`/content/en/${age}/${this.selectedCategory}.json`);
        contentType = response.headers.get("content-type");
        
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
          console.warn(`Reload English config for '${age}' failed. Falling back to Age 2-3.`);
          age = '2-3';
          response = await fetch(`/content/en/2-3/${this.selectedCategory}.json`);
          contentType = response.headers.get("content-type");
          if (!response.ok || !contentType || !contentType.includes("application/json")) {
            return;
          }
        }
      }

      this.levels = await response.json();
      // Cập nhật lại voiceText cho engine hiện tại mà không mất tiến trình chơi
      if (this.currentEngine && this.levels[this.currentLevelIndex]) {
        this.currentEngine.updateLevelData(this.levels[this.currentLevelIndex]);
      }
    } catch (e) {
      console.error("Failed to reload levels on language change:", e);
    }
  }

  private repositionProgressBar(width: number, _height: number) {
    const starCount = this.levels.length;
    const starSpacing = 42;
    const totalWidth = (starCount - 1) * starSpacing;
    const startX = width / 2 - totalWidth / 2;
    const posY = 135;

    this.progressStars.forEach((star, i) => {
      star.setPosition(startX + i * starSpacing, posY);
    });
  }

  private createProgressBar() {
    // Dọn sao cũ
    this.progressStars.forEach(s => s.destroy());
    this.progressStars = [];

    const starCount = this.levels.length;
    const starSpacing = 42;
    const totalWidth = (starCount - 1) * starSpacing;
    const startX = this.scale.width / 2 - totalWidth / 2;
    const posY = 135;

    for (let i = 0; i < starCount; i++) {
      const star = this.add.image(startX + i * starSpacing, posY, 'star')
        .setDisplaySize(35, 35)
        .setAlpha(0.3)
        .setTint(0x757575);
      
      this.progressStars.push(star);
    }
  }

  private startLevel(index: number) {
    if (this.currentEngine) {
      this.currentEngine.destroy();
      this.currentEngine = null;
    }

    const centerY = this.scale.height * 0.58;
    const currentLevel = this.levels[index];

    if (currentLevel.type === 'tap') {
      this.currentEngine = new TapEngine(
        this,
        this.scale.width / 2,
        centerY,
        currentLevel as any,
        () => this.handleLevelComplete()
      );
    } else if (currentLevel.type === 'drag') {
      this.currentEngine = new DragEngine(
        this,
        this.scale.width / 2,
        centerY,
        currentLevel as any,
        () => this.handleLevelComplete()
      );
    } else if (currentLevel.type === 'match') {
      this.currentEngine = new MatchEngine(
        this,
        this.scale.width / 2,
        centerY,
        currentLevel as any,
        () => this.handleLevelComplete()
      );
    } else if (currentLevel.type === 'count') {
      this.currentEngine = new CountEngine(
        this,
        this.scale.width / 2,
        centerY,
        currentLevel as any,
        () => this.handleLevelComplete()
      );
    }
  }

  private handleLevelComplete() {
    const star = this.progressStars[this.currentLevelIndex];
    if (star) {
      star.clearTint();
      star.setAlpha(1);
      
      this.tweens.add({
        targets: star,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 300,
        yoyo: true,
        ease: 'Back.easeOut'
      });
    }

    if (this.currentLevelIndex < this.levels.length - 1) {
      this.currentLevelIndex++;
      this.time.delayedCall(400, () => {
        this.startLevel(this.currentLevelIndex);
      });
    } else {
      // Bé thắng cuộc — hiện VictoryOverlay, nhấn replay sẽ tạo game MỚI
      this.time.delayedCall(500, () => {
        if (this.currentEngine) {
          this.currentEngine.destroy();
          this.currentEngine = null;
        }
        new VictoryOverlay(this, () => this.generateNewGame());
      });
    }
  }



  /**
   * Sinh ngẫu nhiên một round game mới tương ứng với chủ đề hiện tại.
   * - Nếu là animals: Tự sinh từ pool 131 con vật.
   * - Các chủ đề khác: Tải lại file JSON gốc và xáo trộn ngẫu nhiên thứ tự.
   */
  private async generateNewGame() {
    if (this.selectedCategory === 'animals') {
      const lang = languageManager.getLanguage();
      this.levels = generateRound(6, lang);
      this.currentLevelIndex = 0;

      // Thu thập asset cần load
      const newAssets: Record<string, string> = {};
      for (const lvl of this.levels) {
        const tapLvl = lvl as any;
        if (tapLvl.correct && SVG_ASSETS[tapLvl.correct]) {
          newAssets[tapLvl.correct] = SVG_ASSETS[tapLvl.correct];
        }
        if (tapLvl.options) {
          for (const opt of tapLvl.options) {
            if (SVG_ASSETS[opt]) newAssets[opt] = SVG_ASSETS[opt];
          }
        }
      }
      await AssetLoader.loadAssets(this, newAssets);
    } else {
      const overlay = this.showLoadingOverlay();
      try {
        let lang = languageManager.getLanguage();
        let age = this.selectedAge;
        
        let response = await fetch(`/content/${lang}/${age}/${this.selectedCategory}.json`);
        let contentType = response.headers.get("content-type");
        
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
          lang = 'en';
          response = await fetch(`/content/en/${age}/${this.selectedCategory}.json`);
        }

        const levelsData = await response.json() as LevelData[];
        
        // Trộn ngẫu nhiên thứ tự các câu hỏi để tạo sự mới lạ
        this.levels = Phaser.Utils.Array.Shuffle(levelsData);
        this.currentLevelIndex = 0;

        // Trộn các lựa chọn bên trong mỗi câu hỏi
        this.levels.forEach((lvl: any) => {
          if (lvl.options) {
            lvl.options = Phaser.Utils.Array.Shuffle(lvl.options);
          }
          if (lvl.choices) {
            lvl.choices = Phaser.Utils.Array.Shuffle(lvl.choices);
          }
        });

        // Thu thập toàn bộ key ảnh được sử dụng
        const categoryAssets: Record<string, string> = {};
        this.levels.forEach((lvl: any) => {
          if (lvl.type === 'tap') {
            if (SVG_ASSETS[lvl.correct]) categoryAssets[lvl.correct] = SVG_ASSETS[lvl.correct];
            lvl.options.forEach((opt: string) => {
              if (SVG_ASSETS[opt]) categoryAssets[opt] = SVG_ASSETS[opt];
            });
          } else if (lvl.type === 'drag') {
            lvl.items.forEach((item: any) => {
              if (SVG_ASSETS[item.asset]) categoryAssets[item.asset] = SVG_ASSETS[item.asset];
            });
            lvl.targets.forEach((target: any) => {
              if (SVG_ASSETS[target.asset]) categoryAssets[target.asset] = SVG_ASSETS[target.asset];
            });
          } else if (lvl.type === 'match') {
            if (lvl.target.type === 'asset' && SVG_ASSETS[lvl.target.value]) {
              categoryAssets[lvl.target.value] = SVG_ASSETS[lvl.target.value];
            }
            lvl.choices.forEach((choice: any) => {
              if (choice.type === 'asset' && SVG_ASSETS[choice.value]) {
                categoryAssets[choice.value] = SVG_ASSETS[choice.value];
              }
            });
          } else if (lvl.type === 'count') {
            if (SVG_ASSETS[lvl.object.asset]) {
              categoryAssets[lvl.object.asset] = SVG_ASSETS[lvl.object.asset];
            }
          }
        });

        await AssetLoader.loadAssets(this, categoryAssets);
      } catch (e) {
        console.error("Failed to regenerate game levels:", e);
      } finally {
        overlay.destroy();
      }
    }

    // Reset progress stars
    this.progressStars.forEach(star => {
      star.setTint(0x757575);
      star.setAlpha(0.3);
    });

    this.startLevel(this.currentLevelIndex);
  }

  private showLoadingOverlay(): Phaser.GameObjects.Container {
    const width = this.scale.width;
    const height = this.scale.height;
    
    const container = this.add.container(width / 2, height / 2);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.4);
    bg.fillRect(-width / 2, -height / 2, width, height);

    const spinner = this.add.image(0, -30, 'star').setDisplaySize(80, 80);
    this.tweens.add({
      targets: spinner,
      angle: 360,
      duration: 1000,
      repeat: -1,
      ease: 'Linear'
    });

    const lang = languageManager.getLanguage();
    const text = this.add.text(0, 40, lang === 'vi' ? 'Đang tải...' : 'Loading...', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#FFFFFF'
    }).setOrigin(0.5);

    container.add([bg, spinner, text]);
    return container;
  }

  private showErrorNotification() {
    const errorText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Error Loading Game Data', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '24px',
      color: '#D84315',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.time.delayedCall(3000, () => errorText.destroy());
  }
}
export default GameScene;
