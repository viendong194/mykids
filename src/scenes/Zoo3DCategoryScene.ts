import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { TRANSLATIONS } from '../data/translations';
import { HeaderUI } from '../components/HeaderUI';
import { ParentGate } from '../components/ParentGate';
import type { Zoo3DGameId } from './Zoo3DScene';

interface Zoo3DGameCard {
  id: Zoo3DGameId;
  emoji: string;
  title: Record<'vi' | 'en' | 'zh' | 'ja', string>;
  sub: Record<'vi' | 'en' | 'zh' | 'ja', string>;
  color: number;
  borderColor: number;
}

const GAMES: Zoo3DGameCard[] = [
  {
    id: 'count',
    emoji: '🐘',
    title: { vi: 'ĐẾM THÚ', en: 'COUNT ANIMALS', zh: '数动物', ja: 'どうぶつを かぞえよう' },
    sub: { vi: 'Đếm xem có bao nhiêu con', en: 'Count how many there are', zh: '数一数有多少只', ja: 'なんびきいるかな' },
    color: 0x81c784,
    borderColor: 0x4caf50,
  },
  {
    id: 'hideseek',
    emoji: '🙈',
    title: { vi: 'TRỐN TÌM THÚ', en: 'HIDE AND SEEK', zh: '躲猫猫', ja: 'かくれんぼ' },
    sub: { vi: 'Tìm con vật đang trốn', en: 'Find the hidden animal', zh: '找出藏起来的动物', ja: 'かくれてる どうぶつを みつけよう' },
    color: 0xba68c8,
    borderColor: 0xab47bc,
  },
  {
    id: 'feed',
    emoji: '🥕',
    title: { vi: 'CHO THÚ ĂN', en: 'FEED THE ANIMALS', zh: '喂动物', ja: 'えさを あげよう' },
    sub: { vi: 'Chọn đúng món ăn', en: 'Pick the right food', zh: '选择合适的食物', ja: 'あう たべものを えらぼう' },
    color: 0xffb74d,
    borderColor: 0xff9800,
  },
  {
    id: 'herd',
    emoji: '🐑',
    title: { vi: 'LÙA THÚ VỀ CHUỒNG', en: 'HERD TO THE PEN', zh: '赶回围栏', ja: 'おりに つれていこう' },
    sub: { vi: 'Đưa các bạn thú về nhà', en: 'Bring the animals home', zh: '把动物们带回家', ja: 'どうぶつを おうちに かえそう' },
    color: 0x4db6ac,
    borderColor: 0x009688,
  },
  {
    id: 'daynight',
    emoji: '🌙',
    title: { vi: 'NGÀY VÀ ĐÊM', en: 'DAY AND NIGHT', zh: '白天和夜晚', ja: 'ひると よる' },
    sub: { vi: 'Ai còn thức, ai đang ngủ?', en: "Who's awake, who's asleep?", zh: '谁醒着，谁睡着了？', ja: 'だれが おきてる? だれが ねてる?' },
    color: 0x7986cb,
    borderColor: 0x5c6bc0,
  },
  {
    id: 'fishing',
    emoji: '🎣',
    title: { vi: 'BÉ CÂU CÁ', en: 'GO FISHING', zh: '小猫钓鱼', ja: 'つりを しよう' },
    sub: { vi: 'Tìm và câu các chú cá', en: 'Find and catch the fish', zh: '找出并钓起小鱼', ja: 'ただしい さかなを つろう' },
    color: 0x4fc3f7,
    borderColor: 0x03a9f4,
  },
];

/**
 * "Chọn game 3D" — mirrors CategoryScene's card-grid pattern for the 2D
 * topics, but for the 5 Vườn thú 3D games. Reached from AgeSelectionScene
 * (mode: 'zoo3d'); tapping a card starts Zoo3DScene with the chosen game id.
 */
export class Zoo3DCategoryScene extends Phaser.Scene {
  private age: string = '2-3';
  private titleText!: Phaser.GameObjects.Text;
  private parentButton!: Phaser.GameObjects.Container;
  private cards: Phaser.GameObjects.Container[] = [];
  private cardsContainer!: Phaser.GameObjects.Container;
  private unsubscribeLang!: () => void;
  private headerUI!: HeaderUI;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private lastOrientation: 'portrait' | 'landscape' | null = null;

  constructor() {
    super('Zoo3DCategoryScene');
  }

  init(data: { age?: string }) {
    this.age = data?.age === '4-6' ? '4-6' : '2-3';
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.lastOrientation = width > height ? 'landscape' : 'portrait';

    this.bgGraphics = this.add.graphics();
    this.bgGraphics.fillGradientStyle(0xe8f5e9, 0xe8f5e9, 0xe0f7fa, 0xe0f7fa, 1);
    this.bgGraphics.fillRect(0, 0, width, height);

    this.headerUI = new HeaderUI(this, 'AgeSelectionScene');

    this.titleText = this.add.text(width / 2, 130, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#00796B',
      align: 'center',
      shadow: { color: '#FFFFFF', blur: 10, fill: true, stroke: true },
    }).setOrigin(0.5);

    this.cardsContainer = this.add.container(0, 0);
    this.createCards(width, height);

    this.createParentButton(height);

    this.updateTexts();
    this.unsubscribeLang = languageManager.onChange(() => {
      this.updateTexts();
    });

    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      if (!this.cameras || !this.cameras.main) return;
      const w = gameSize.width;
      const h = gameSize.height;

      this.cameras.main.setSize(w, h);

      this.bgGraphics.clear();
      this.bgGraphics.fillGradientStyle(0xe8f5e9, 0xe8f5e9, 0xe0f7fa, 0xe0f7fa, 1);
      this.bgGraphics.fillRect(0, 0, w, h);

      this.titleText.setPosition(w / 2, 130);
      this.headerUI.reposition(w, h);

      const currentOrientation = w > h ? 'landscape' : 'portrait';
      if (currentOrientation !== this.lastOrientation) {
        this.lastOrientation = currentOrientation;
        this.createCards(w, h);
      } else {
        this.layoutExistingCards(w, h);
      }

      this.repositionParentButton(w, h);
    };

    this.scale.on('resize', resizeListener);

    this.events.on('destroy', () => {
      this.scale.off('resize', resizeListener);
      if (this.unsubscribeLang) this.unsubscribeLang();
    });
  }

  private createCards(width: number, height: number) {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];

    const isLandscape = width > height;
    const numCards = GAMES.length;
    const spacing = isLandscape ? 260 : 130;
    const centerY = height * 0.55;

    const cardW = isLandscape ? 220 : Math.min(width * 0.9, 360);
    const cardH = isLandscape ? 260 : 110;

    this.cardsContainer.removeAll(true);
    this.cardsContainer.setScale(1);

    GAMES.forEach((gameCard, idx) => {
      let lx = 0;
      let ly = 0;

      if (isLandscape) {
        const C1 = Math.ceil(numCards / 2);
        const C2 = numCards - C1;
        const spacingX = 260;
        const spacingY = 290;

        if (idx < C1) {
          lx = (idx - (C1 - 1) / 2) * spacingX;
          ly = -spacingY / 2;
        } else {
          const idxInRow = idx - C1;
          lx = (idxInRow - (C2 - 1) / 2) * spacingX;
          ly = spacingY / 2;
        }
      } else {
        ly = (idx - (numCards - 1) / 2) * spacing;
      }

      const card = this.add.container(lx, ly);

      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.08);
      shadow.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 25);

      const bg = this.add.graphics();
      bg.fillStyle(gameCard.color, 1);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 25);
      bg.lineStyle(5, 0xffffff, 1);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 25);

      const emojiSize = isLandscape ? 56 : 42;
      const emojiX = isLandscape ? 0 : -cardW / 2 + 55;
      const emojiY = isLandscape ? -45 : 0;
      const emojiText = this.add.text(emojiX, emojiY, gameCard.emoji, { fontSize: `${emojiSize}px` }).setOrigin(0.5);

      const textX = isLandscape ? 0 : 35;
      const titleY = isLandscape ? 40 : -18;
      const titleTextObj = this.add.text(textX, titleY, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        align: 'center',
        wordWrap: { width: cardW - (isLandscape ? 30 : 100) },
      }).setOrigin(0.5).setName('cardTitle');

      const subTextY = isLandscape ? 80 : 22;
      const subTextObj = this.add.text(textX, subTextY, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '13px',
        color: '#FFFFFF',
        align: 'center',
        wordWrap: { width: cardW - (isLandscape ? 30 : 100) },
      }).setOrigin(0.5).setName('cardSub');

      card.add([shadow, bg, emojiText, titleTextObj, subTextObj]);
      card.setData('gameData', gameCard);

      card.setInteractive(new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH), Phaser.Geom.Rectangle.Contains);
      if (card.input) {
        card.input.cursor = 'pointer';
      }

      card.on('pointerdown', () => {
        audioManager.playTap();
        this.tweens.add({
          targets: card,
          scaleX: 0.92,
          scaleY: 0.92,
          duration: 100,
          yoyo: true,
          onComplete: () => {
            this.scene.start('Zoo3DScene', { age: this.age, game: gameCard.id });
          },
        });
      });

      card.on('pointerover', () => {
        this.tweens.add({ targets: card, scaleX: 1.05, scaleY: 1.05, duration: 150 });
      });
      card.on('pointerout', () => {
        this.tweens.add({ targets: card, scaleX: 1.0, scaleY: 1.0, duration: 150 });
      });

      card.setScale(0);
      this.tweens.add({
        targets: card,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        delay: idx * 100,
        ease: 'Back.easeOut',
      });

      this.cardsContainer.add(card);
      this.cards.push(card);
    });

    const C1 = Math.ceil(numCards / 2);
    const containerW = isLandscape ? (C1 - 1) * spacing + cardW : cardW;
    const containerH = isLandscape ? 290 + cardH : (numCards - 1) * spacing + cardH;

    const availW = width * 0.92;
    const availH = height - 260;

    const scaleX = availW / containerW;
    const scaleY = availH / containerH;
    const finalScale = Math.min(1, scaleX, scaleY);

    this.cardsContainer.setScale(finalScale);
    this.cardsContainer.setPosition(width / 2, centerY);

    this.updateTexts();
  }

  private layoutExistingCards(width: number, height: number) {
    const isLandscape = width > height;
    const numCards = this.cards.length;
    const spacing = isLandscape ? 260 : 130;
    const centerY = height * 0.55;

    const cardW = isLandscape ? 220 : Math.min(width * 0.9, 360);
    const cardH = isLandscape ? 260 : 110;

    this.cardsContainer.setScale(1);

    this.cards.forEach((card, idx) => {
      let lx = 0;
      let ly = 0;

      if (isLandscape) {
        const C1 = Math.ceil(numCards / 2);
        const C2 = numCards - C1;
        const spacingX = 260;
        const spacingY = 290;

        if (idx < C1) {
          lx = (idx - (C1 - 1) / 2) * spacingX;
          ly = -spacingY / 2;
        } else {
          const idxInRow = idx - C1;
          lx = (idxInRow - (C2 - 1) / 2) * spacingX;
          ly = spacingY / 2;
        }
      } else {
        ly = (idx - (numCards - 1) / 2) * spacing;
      }

      card.setPosition(lx, ly);
    });

    const C1 = Math.ceil(numCards / 2);
    const containerW = isLandscape ? (C1 - 1) * spacing + cardW : cardW;
    const containerH = isLandscape ? 290 + cardH : (numCards - 1) * spacing + cardH;

    const availW = width * 0.92;
    const availH = height - 260;

    const scaleX = availW / containerW;
    const scaleY = availH / containerH;
    const finalScale = Math.min(1, scaleX, scaleY);

    this.cardsContainer.setScale(finalScale);
    this.cardsContainer.setPosition(width / 2, centerY);
  }

  private repositionParentButton(_width: number, height: number) {
    if (this.parentButton) {
      this.parentButton.setPosition(90, height - 55);
    }
  }

  private createParentButton(height: number) {
    this.parentButton = this.add.container(90, height - 55);

    const bg = this.add.graphics();
    bg.fillStyle(0x00796b, 1);
    bg.fillRoundedRect(-65, -24, 130, 48, 16);
    bg.lineStyle(3, 0xffffff, 1);
    bg.strokeRoundedRect(-65, -24, 130, 48, 16);

    const text = this.add.text(0, 0, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#FFFFFF',
    }).setOrigin(0.5).setName('parentText');

    this.parentButton.add([bg, text]);
    this.parentButton.setInteractive(new Phaser.Geom.Rectangle(-65, -24, 130, 48), Phaser.Geom.Rectangle.Contains);
    if (this.parentButton.input) {
      this.parentButton.input.cursor = 'pointer';
    }

    this.parentButton.on('pointerdown', () => {
      audioManager.playTap();
      new ParentGate(this, () => {
        this.scene.start('ParentScene');
      }, () => {});
    });
  }

  private updateTexts() {
    const lang = languageManager.getLanguage();

    if (this.titleText) {
      this.titleText.setText(TRANSLATIONS[lang].choose_topic);
    }

    if (this.parentButton) {
      const pText = this.parentButton.getByName('parentText') as Phaser.GameObjects.Text;
      if (pText) {
        pText.setText(TRANSLATIONS[lang].parents);
      }
    }

    this.cards.forEach((card) => {
      const gameCard: Zoo3DGameCard = card.getData('gameData');
      const titleObj = card.getByName('cardTitle') as Phaser.GameObjects.Text;
      const subObj = card.getByName('cardSub') as Phaser.GameObjects.Text;

      if (titleObj) titleObj.setText(gameCard.title[lang]);
      if (subObj) subObj.setText(gameCard.sub[lang]);
    });
  }
}
export default Zoo3DCategoryScene;
