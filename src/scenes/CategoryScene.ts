import Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { TRANSLATIONS } from '../data/translations';
import { ParentGate } from '../components/ParentGate';
import { HeaderUI } from '../components/HeaderUI';

interface CategoryData {
  id: string;
  title: Record<string, string>;
  sub: Record<string, string>;
  color: number;
  borderColor: number;
  asset: string;
  supportedAges: string[];
}

export class CategoryScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private parentButton!: Phaser.GameObjects.Container;
  private cards: Phaser.GameObjects.Container[] = [];
  private cardsContainer!: Phaser.GameObjects.Container;
  private unsubscribeLang!: () => void;
  private headerUI!: HeaderUI;
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private lastOrientation: 'portrait' | 'landscape' | null = null;

  constructor() {
    super('CategoryScene');
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.lastOrientation = width > height ? 'landscape' : 'portrait';

    // 1. Tạo hình nền Gradient dịu mát
    this.bgGraphics = this.add.graphics();
    this.bgGraphics.fillGradientStyle(0xE8F5E9, 0xE8F5E9, 0xE0F7FA, 0xE0F7FA, 1);
    this.bgGraphics.fillRect(0, 0, width, height);

    // 2. Tạo Header UI dùng chung (Quay lại AgeSelectionScene, Mở rộng cờ)
    this.headerUI = new HeaderUI(this, 'AgeSelectionScene');

    // 3. Tiêu đề chọn chủ đề
    this.titleText = this.add.text(width / 2, 130, '', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#00796B',
      align: 'center',
      shadow: { color: '#FFFFFF', blur: 10, fill: true, stroke: true }
    }).setOrigin(0.5);

    // 3.5. Tạo container gom nhóm các thẻ
    this.cardsContainer = this.add.container(0, 0);

    // 4. Tạo các thẻ chủ đề dựa trên nhóm tuổi đã chọn
    this.createCategoryCards(width, height);

    // 5. Nút phụ huynh bảo mật góc dưới bên trái
    this.createParentButton(height);

    // 6. Cập nhật đa ngôn ngữ
    this.updateTexts();
    this.unsubscribeLang = languageManager.onChange(() => {
      this.updateTexts();
    });

    // 7. Lắng nghe sự kiện xoay màn hình/thay đổi kích thước
    const resizeListener = (gameSize: Phaser.Structs.Size) => {
      if (!this.cameras || !this.cameras.main) return;
      const w = gameSize.width;
      const h = gameSize.height;
      
      this.cameras.main.setSize(w, h);
      
      this.bgGraphics.clear();
      this.bgGraphics.fillGradientStyle(0xE8F5E9, 0xE8F5E9, 0xE0F7FA, 0xE0F7FA, 1);
      this.bgGraphics.fillRect(0, 0, w, h);
      
      this.titleText.setPosition(w / 2, 130);
      this.headerUI.reposition(w, h);

      const currentOrientation = w > h ? 'landscape' : 'portrait';
      if (currentOrientation !== this.lastOrientation) {
        this.lastOrientation = currentOrientation;
        this.createCategoryCards(w, h);
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

  /**
   * Tạo các thẻ chủ đề tương ứng theo độ tuổi
   */
  private createCategoryCards(width: number, height: number) {
    // Dọn dẹp thẻ cũ nếu có để tránh rác RAM và chồng chéo
    this.cards.forEach(c => c.destroy());
    this.cards = [];

    const isLandscape = width > height;
    const selectedAge = localStorage.getItem('mykids_selected_age') || '2-3';

    // Toàn bộ danh sách chủ đề hệ thống (Dễ dàng thêm mới mà không ảnh hưởng tới code Engine)
    const allCategories: CategoryData[] = [
      {
        id: 'animals',
        title: { vi: 'ĐỘNG VẬT', en: 'ANIMALS', zh: '动物', ja: 'どうぶつ' },
        sub: { vi: 'Chạm vào con vật', en: 'Tap the correct animal', zh: '点击正确动物', ja: 'どうぶつタッチ' },
        color: 0xFFB74D,
        borderColor: 0xFF9800,
        asset: 'lion',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'insects',
        title: { vi: 'CÔN TRÙNG', en: 'INSECTS', zh: '昆虫', ja: 'こんちゅう' },
        sub: { vi: 'Tìm chú côn trùng nhỏ', en: 'Find the tiny insects', zh: '寻找昆虫', ja: 'こんちゅうタッチ' },
        color: 0x80DEEA,
        borderColor: 0x00ACC1,
        asset: 'ant',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'fruits',
        title: { vi: 'RAU QUẢ', en: 'FRUITS & VEG', zh: '果蔬', ja: 'やさいとくだもの' },
        sub: { vi: 'Tìm quả chín thơm ngon', en: 'Find delicious fruits', zh: '寻找新鲜果蔬', ja: 'くだものタッチ' },
        color: 0xFFD54F,
        borderColor: 0xFFB300,
        asset: 'strawberry',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'foods',
        title: { vi: 'ĐỒ ĂN', en: 'DELICIOUS FOOD', zh: '美味食物', ja: 'たべもの' },
        sub: { vi: 'Tìm món ăn bé yêu', en: 'Find tasty food', zh: '寻找美味食物', ja: 'たべものタッチ' },
        color: 0xFFAB91,
        borderColor: 0xFF7043,
        asset: 'pizza',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'shadows',
        title: { vi: 'GHÉP BÓNG', en: 'SHADOWS', zh: '匹配影子', ja: 'かげあわせ' },
        sub: { vi: 'Kéo thả ghép bóng hình', en: 'Drag to match shadows', zh: '拖曳匹配影子', ja: 'かげあわせパズル' },
        color: 0xF06292,
        borderColor: 0xE91E63,
        asset: 'rabbit',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'colors',
        title: { vi: 'MÀU SẮC', en: 'COLORS', zh: '颜色', ja: 'いろ' },
        sub: { vi: 'Tìm màu sắc tương đồng', en: 'Match the colors', zh: '匹配相同颜色', ja: 'いろあわせ' },
        color: 0x4DB6AC,
        borderColor: 0x009688,
        asset: 'star',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'numbers',
        title: { vi: 'CHỮ SỐ', en: 'NUMBERS', zh: '数字', ja: 'すうじ' },
        sub: { vi: 'Tập đếm con vật', en: 'Count the animals', zh: '数数看动物', ja: 'かずをかぞえよう' },
        color: 0x81C784,
        borderColor: 0x4CAF50,
        asset: 'panda',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'odd_one_out',
        title: { vi: 'KHÁC BIỆT', en: 'ODD ONE OUT', zh: '寻找不同', ja: 'ちがいさがし' },
        sub: { vi: 'Tìm con vật khác loại', en: 'Find the different animal', zh: '找出不同类动物', ja: 'ちがうどうぶつ' },
        color: 0xBA68C8,
        borderColor: 0xAB47BC,
        asset: 'butterfly',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'pairs',
        title: { vi: 'TÌM CẶP', en: 'MATCH PAIRS', zh: '寻找相同', ja: 'ペアさがし' },
        sub: { vi: 'Tìm con vật giống nhau', en: 'Find matching animals', zh: '找出相同动物', ja: 'おなじどうぶつ' },
        color: 0xFF8A80,
        borderColor: 0xFF5252,
        asset: 'cat-face',
        supportedAges: ['2-3', '4-6']
      },
      {
        id: 'alphabet',
        title: { vi: 'CHỮ CÁI', en: 'ALPHABET', zh: '英文字母', ja: 'アルファベット' },
        sub: { vi: 'Làm quen bảng chữ cái', en: 'Learn ABCs and words', zh: '学习英文字母', ja: 'もじあそび' },
        color: 0xBA68C8,
        borderColor: 0xAB47BC,
        asset: 'panda',
        supportedAges: ['4-6', '6-8']
      },
      {
        id: 'math',
        title: { vi: 'TOÁN ĐỐ', en: 'LOGIC MATH', zh: '数学逻辑', ja: 'さんすう' },
        sub: { vi: 'Cộng trừ cơ bản', en: 'Simple logic & math', zh: '基础加减乘除', ja: 'たしざん・ひきざん' },
        color: 0x7986CB,
        borderColor: 0x5C6BC0,
        asset: 'elephant',
        supportedAges: ['2-3', '4-6', '6-8']
      }
    ];

    // Lọc chủ đề được hỗ trợ bởi nhóm tuổi hiện tại
    const categories = allCategories.filter(cat => cat.supportedAges.includes(selectedAge));
    const numCards = categories.length;
    const spacing = isLandscape ? 260 : 140;
    const centerY = height * 0.55;

    const cardW = isLandscape ? 220 : Math.min(width * 0.85, 340);
    const cardH = isLandscape ? 260 : 100;

    // Reset container trước khi vẽ lại
    this.cardsContainer.removeAll(true);
    this.cardsContainer.setScale(1);

    categories.forEach((cat, idx) => {
      // Định vị local so với cardsContainer
      let lx = 0;
      let ly = 0;

      if (isLandscape) {
        // Layout 2 dòng ngang
        const C1 = Math.ceil(numCards / 2);
        const C2 = numCards - C1;
        const spacingX = 260;
        const spacingY = 290;
        
        if (idx < C1) {
          // Dòng 1: Căn giữa dòng
          lx = (idx - (C1 - 1) / 2) * spacingX;
          ly = -spacingY / 2;
        } else {
          // Dòng 2: Căn giữa dòng
          const idxInRow = idx - C1;
          lx = (idxInRow - (C2 - 1) / 2) * spacingX;
          ly = spacingY / 2;
        }
      } else {
        // Layout 1 cột dọc như cũ
        ly = (idx - (numCards - 1) / 2) * spacing;
      }

      const card = this.add.container(lx, ly);

      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.08);
      shadow.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 25);

      const bg = this.add.graphics();
      bg.fillStyle(cat.color, 1);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 25);
      bg.lineStyle(5, 0xFFFFFF, 1);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 25);

      // Thêm hình icon đại diện
      const iconSize = isLandscape ? 100 : 70;
      const imgX = isLandscape ? 0 : -cardW / 2 + 55;
      const imgY = isLandscape ? -45 : 0;
      const imageObj = this.add.image(imgX, imgY, cat.asset).setDisplaySize(iconSize, iconSize);

      // Chữ nhãn
      const textX = isLandscape ? 0 : 35;
      const titleY = isLandscape ? 40 : -15;
      const titleTextObj = this.add.text(textX, titleY, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        align: 'center'
      }).setOrigin(0.5).setName('catTitle');

      const subTextY = isLandscape ? 80 : 18;
      const subTextObj = this.add.text(textX, subTextY, '', {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '13px',
        color: '#FFFFFF',
        align: 'center',
        wordWrap: { width: cardW - (isLandscape ? 30 : 100) }
      }).setOrigin(0.5).setName('catSub');

      card.add([shadow, bg, imageObj, titleTextObj, subTextObj]);
      card.setData('catData', cat);

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
            // Khởi chạy các game đã có sẵn JSON config
            const readyCategories = ['animals', 'shadows', 'colors', 'numbers', 'math', 'odd_one_out', 'pairs', 'insects', 'fruits', 'foods', 'alphabet'];
            if (readyCategories.includes(cat.id)) {
              this.scene.start('GameScene', { age: selectedAge, category: cat.id });
            } else {
              this.showComingSoonNotification();
            }
          }
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
        ease: 'Back.easeOut'
      });

      this.cardsContainer.add(card);
      this.cards.push(card);
    });

    // Tự động scale-to-fit toàn bộ cardsContainer dựa trên kích thước lưới
    const C1 = Math.ceil(numCards / 2);
    const containerW = isLandscape ? ((C1 - 1) * spacing + cardW) : cardW;
    const containerH = isLandscape ? (290 + cardH) : ((numCards - 1) * spacing + cardH);

    const availW = width * 0.92;
    const availH = height - 260; // Bớt phần header trên và nút phụ huynh ở dưới

    const scaleX = availW / containerW;
    const scaleY = availH / containerH;
    const finalScale = Math.min(1, scaleX, scaleY);

    this.cardsContainer.setScale(finalScale);
    this.cardsContainer.setPosition(width / 2, centerY);

    // Cập nhật nhãn đa ngôn ngữ cho toàn bộ card vừa tạo
    this.updateTexts();
  }

  private repositionParentButton(_width: number, height: number) {
    if (this.parentButton) {
      this.parentButton.setPosition(90, height - 55);
    }
  }

  private layoutExistingCards(width: number, height: number) {
    const isLandscape = width > height;
    const numCards = this.cards.length;
    const spacing = isLandscape ? 260 : 140;
    const centerY = height * 0.55;

    const cardW = isLandscape ? 220 : Math.min(width * 0.85, 340);
    const cardH = isLandscape ? 260 : 100;

    // Reset container scale trước khi định vị lại các card con
    this.cardsContainer.setScale(1);

    this.cards.forEach((card, idx) => {
      let lx = 0;
      let ly = 0;

      if (isLandscape) {
        // Layout 2 dòng ngang
        const C1 = Math.ceil(numCards / 2);
        const C2 = numCards - C1;
        const spacingX = 260;
        const spacingY = 290;
        
        if (idx < C1) {
          // Dòng 1: Căn giữa dòng
          lx = (idx - (C1 - 1) / 2) * spacingX;
          ly = -spacingY / 2;
        } else {
          // Dòng 2: Căn giữa dòng
          const idxInRow = idx - C1;
          lx = (idxInRow - (C2 - 1) / 2) * spacingX;
          ly = spacingY / 2;
        }
      } else {
        // Layout 1 cột dọc như cũ
        ly = (idx - (numCards - 1) / 2) * spacing;
      }

      card.setPosition(lx, ly);
    });

    // Tính toán lại scale-to-fit
    const C1 = Math.ceil(numCards / 2);
    const containerW = isLandscape ? ((C1 - 1) * spacing + cardW) : cardW;
    const containerH = isLandscape ? (290 + cardH) : ((numCards - 1) * spacing + cardH);

    const availW = width * 0.92;
    const availH = height - 260;

    const scaleX = availW / containerW;
    const scaleY = availH / containerH;
    const finalScale = Math.min(1, scaleX, scaleY);

    this.cardsContainer.setScale(finalScale);
    this.cardsContainer.setPosition(width / 2, centerY);
  }

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
      new ParentGate(this, () => {
        this.scene.start('ParentScene');
      }, () => {});
    });

    this.addHoverTween(this.parentButton as any);
  }

  private showComingSoonNotification() {
    const lang = languageManager.getLanguage();
    const message = TRANSLATIONS[lang].coming_soon;
    
    audioManager.speak(message, lang);

    const toast = this.add.container(this.scale.width / 2, this.scale.height - 100);
    const tBg = this.add.graphics();
    tBg.fillStyle(0x37474F, 0.9);
    tBg.fillRoundedRect(-220, -25, 440, 50, 15);

    const tTxt = this.add.text(0, 0, message, {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    toast.add([tBg, tTxt]);
    toast.setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: this.scale.height - 120,
      duration: 300,
      yoyo: true,
      hold: 2000,
      onComplete: () => toast.destroy()
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

    this.cards.forEach(card => {
      const cat: CategoryData = card.getData('catData');
      const titleObj = card.getByName('catTitle') as Phaser.GameObjects.Text;
      const subObj = card.getByName('catSub') as Phaser.GameObjects.Text;

      if (titleObj) titleObj.setText(cat.title[lang]);
      if (subObj) subObj.setText(cat.sub[lang]);
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
export default CategoryScene;
