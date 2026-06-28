import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { TapLevelData } from '../types/engine';
import { audioManager } from '../managers/AudioManager';
import { Confetti } from '../components/Confetti';
import { parentService } from '../services/ParentService';

export class TapEngine extends BaseEngine<TapLevelData> {
  private optionElements: Phaser.GameObjects.Container[] = [];
  private voiceSpeakerBtn!: Phaser.GameObjects.Container;
  private speechText!: Phaser.GameObjects.Text;
  private speechBubble!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, levelData: TapLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
    this.create();
    this.playPromptVoiceDelayed(500);
  }

  /**
   * Khởi tạo UI (Phát sinh từ GameEngine.create)
   */
  public create() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // 1. Bóng thoại hướng dẫn
    this.createSpeechBubble(width);

    // 2. Loa phát giọng nói
    this.createSpeakerButton(width);

    // 2.5. Tạo hình minh họa trực quan sinh động nếu cấu hình yêu cầu
    if (this.levelData.illustration) {
      this.createIllustration(width);
    }

    // 3. Ô lưới chứa các đáp án
    this.createChoicesGrid(width, height);
  }

  /**
   * Đối sánh kết quả (GameEngine)
   * @param answer gồm id đáp án chạm và container đại diện
   */
  public checkAnswer(answer: { id: string; element: Phaser.GameObjects.Container }) {
    if (this.interactiveLocked) return;

    const { id, element } = answer;
    const isCorrect = id === this.levelData.correct;
    this.showResult(isCorrect, element);
  }

  /**
   * Đặt lại trạng thái (GameEngine)
   */
  public reset() {
    super.reset();
    this.optionElements.forEach(card => {
      card.setScale(1);
      card.setAlpha(1);
    });
  }

  /**
   * Trình diễn hiệu ứng Đúng/Sai
   */
  private showResult(isCorrect: boolean, targetObject: Phaser.GameObjects.Container) {
    if (isCorrect) {
      this.interactiveLocked = true;
      audioManager.playCorrect();
      parentService.trackCorrect();




      this.scene.tweens.add({
        targets: targetObject,
        y: targetObject.y - 65,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 250,
        yoyo: true,
        ease: 'Quad.easeOut',
        repeat: 2,
        onComplete: () => {
          const worldX = this.x + targetObject.x;
          const worldY = this.y + targetObject.y;
          Confetti.burst(this.scene, worldX, worldY);

          this.scene.time.delayedCall(1200, () => {
            this.onCompleteCallback();
          });
        }
      });
    } else {
      audioManager.playIncorrect();
      parentService.trackIncorrect();

      const startX = targetObject.x;
      this.scene.tweens.add({
        targets: targetObject,
        x: { from: startX - 15, to: startX + 15 },
        duration: 60,
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          targetObject.x = startX;
          this.playPromptVoice();
        }
      });
    }
  }

  private createSpeechBubble(width: number) {
    const hasIll = !!this.levelData.illustration;
    const bubbleWidth = Math.min(width * 0.8, 480);
    const bubbleHeight = hasIll ? 75 : 90;
    const bx = -bubbleWidth / 2;
    const by = hasIll ? -235 : -180;

    this.speechBubble = this.scene.add.graphics();
    this.speechBubble.fillStyle(0x000000, 0.08);
    this.speechBubble.fillRoundedRect(bx + 4, by + 4, bubbleWidth, bubbleHeight, 25);
    
    this.speechBubble.fillStyle(0xFFFFFF, 1);
    this.speechBubble.fillRoundedRect(bx, by, bubbleWidth, bubbleHeight, 25);

    this.speechBubble.fillTriangle(
      -15, by + bubbleHeight,
      15, by + bubbleHeight,
      0, by + bubbleHeight + 15
    );

    this.speechText = this.scene.add.text(0, by + bubbleHeight / 2, this.levelData.voiceText, {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: hasIll ? '22px' : '26px',
      fontStyle: 'bold',
      color: '#3E2723',
      align: 'center',
      wordWrap: { width: bubbleWidth - 30 }
    }).setOrigin(0.5);

    this.add([this.speechBubble, this.speechText]);
  }

  private createSpeakerButton(width: number) {
    const hasIll = !!this.levelData.illustration;
    const bubbleWidth = Math.min(width * 0.8, 480);
    const speakerX = bubbleWidth / 2 + 40;
    const speakerY = hasIll ? -195 : -135;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0xFF9800, 1);
    bg.fillCircle(0, 0, 32);
    bg.lineStyle(3, 0xFFFFFF, 1);
    bg.strokeCircle(0, 0, 32);

    const speakerIcon = this.scene.add.graphics();
    speakerIcon.fillStyle(0xFFFFFF, 1);
    speakerIcon.beginPath();
    speakerIcon.moveTo(-12, -6);
    speakerIcon.lineTo(-4, -6);
    speakerIcon.lineTo(6, -14);
    speakerIcon.lineTo(6, 14);
    speakerIcon.lineTo(-4, 6);
    speakerIcon.lineTo(-12, 6);
    speakerIcon.closePath();
    speakerIcon.fill();

    speakerIcon.lineStyle(3, 0xFFFFFF, 1);
    speakerIcon.beginPath();
    speakerIcon.arc(10, 0, 6, -Math.PI/3, Math.PI/3);
    speakerIcon.stroke();
    speakerIcon.beginPath();
    speakerIcon.arc(10, 0, 12, -Math.PI/3, Math.PI/3);
    speakerIcon.stroke();

    this.voiceSpeakerBtn = this.scene.add.container(speakerX, speakerY);
    this.voiceSpeakerBtn.add([bg, speakerIcon]);

    this.voiceSpeakerBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
    if (this.voiceSpeakerBtn.input) {
      this.voiceSpeakerBtn.input.cursor = 'pointer';
    }
    
    this.voiceSpeakerBtn.on('pointerdown', () => {
      this.playPromptVoice();
      this.scene.tweens.add({
        targets: this.voiceSpeakerBtn,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 100,
        yoyo: true
      });
    });

    this.add(this.voiceSpeakerBtn);
  }

  private createChoicesGrid(width: number, height: number) {
    const isLandscape = width > height;
    const numOptions = this.levelData.options.length;
    const hasIll = !!this.levelData.illustration;

    let colSpacing = Math.min(width * 0.44, 210);
    let rowSpacing = isLandscape ? Math.min(height * 0.38, 180) : Math.min(height * 0.22, 190);
    
    // Nếu có hình minh họa, dịch chuyển các card lựa chọn xuống dưới một chút
    const yOffset = hasIll ? 95 : 50;
    const finalRowSpacing = hasIll ? Math.min(rowSpacing, 130) : rowSpacing;

    let positions = [
      { x: -colSpacing / 2, y: yOffset },
      { x: colSpacing / 2, y: yOffset }
    ];

    if (numOptions > 2) {
      positions = [
        { x: -colSpacing / 2, y: -finalRowSpacing / 2 + yOffset },
        { x: colSpacing / 2, y: -finalRowSpacing / 2 + yOffset },
        { x: -colSpacing / 2, y: finalRowSpacing / 2 + yOffset },
        { x: colSpacing / 2, y: finalRowSpacing / 2 + yOffset }
      ];
    }

    const cardSize = Math.min(colSpacing - 20, 160);

    this.levelData.options.forEach((choiceKey, index) => {
      const pos = positions[index] || { x: 0, y: yOffset };
      const card = this.scene.add.container(pos.x, pos.y);

      const shadow = this.scene.add.graphics();
      shadow.fillStyle(0x000000, 0.06);
      shadow.fillRoundedRect(-cardSize / 2 + 4, -cardSize / 2 + 6, cardSize, cardSize, 30);

      const frame = this.scene.add.graphics();
      frame.fillStyle(0xFFFFFF, 1);
      frame.fillRoundedRect(-cardSize / 2, -cardSize / 2, cardSize, cardSize, 30);
      frame.lineStyle(6, 0xEEEEEE, 1);
      frame.strokeRoundedRect(-cardSize / 2, -cardSize / 2, cardSize, cardSize, 30);

      const elements: Phaser.GameObjects.GameObject[] = [shadow, frame];

      if (this.scene.textures.exists(choiceKey)) {
        const assetImage = this.scene.add.image(0, 0, choiceKey);
        assetImage.setDisplaySize(cardSize - 25, cardSize - 25);
        elements.push(assetImage);
      } else {
        // Nạp dạng chữ/số nổi bật cho các bài tập Toán hoặc Chữ cái
        const labelText = this.scene.add.text(0, -3, choiceKey, {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: '54px',
          fontStyle: 'bold',
          color: '#E65100', // Màu cam rực rỡ dễ thương
          align: 'center'
        }).setOrigin(0.5);
        elements.push(labelText);
      }

      card.add(elements);
      card.setInteractive(new Phaser.Geom.Rectangle(-cardSize / 2, -cardSize / 2, cardSize, cardSize), Phaser.Geom.Rectangle.Contains);
      
      if (card.input) {
        card.input.cursor = 'pointer';
      }

      card.on('pointerover', () => {
        if (this.interactiveLocked) return;
        this.scene.tweens.add({ targets: card, scaleX: 1.05, scaleY: 1.05, duration: 150 });
      });

      card.on('pointerout', () => {
        if (this.interactiveLocked) return;
        this.scene.tweens.add({ targets: card, scaleX: 1.0, scaleY: 1.0, duration: 150 });
      });

      card.on('pointerdown', () => {
        this.checkAnswer({ id: choiceKey, element: card });
      });

      card.setScale(0);
      this.scene.tweens.add({
        targets: card,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        delay: index * 100,
        ease: 'Back.easeOut'
      });

      this.optionElements.push(card);
      this.add(card);
    });
  }

  /**
   * Tạo hình ảnh minh họa cho câu hỏi (Dàn hàng ngang sinh động cho phép toán)
   */
  private createIllustration(width: number) {
    if (!this.levelData.illustration || !this.levelData.illustration.items) return;

    // Định vị vùng minh họa ở tọa độ y = -110 (nằm giữa bóng thoại và các card)
    const illContainer = this.scene.add.container(0, -115);
    
    const spacingBetweenGroups = 25;
    const imgSize = 45;
    const imgSpacing = 28;
    
    const elementsToLayout: { el: Phaser.GameObjects.GameObject; width: number }[] = [];

    this.levelData.illustration.items.forEach(item => {
      if (item.type === 'images' && item.asset && item.count) {
        // Tạo một container con chứa các hình ảnh đặt sát nhau
        const groupContainer = this.scene.add.container(0, 0);
        const count = item.count;
        const groupW = (count - 1) * imgSpacing + imgSize;
        
        for (let i = 0; i < count; i++) {
          const img = this.scene.add.image(
            -(groupW - imgSize) / 2 + i * imgSpacing,
            0,
            item.asset
          ).setDisplaySize(imgSize, imgSize);

          // Hiệu ứng nhún nhảy nhẹ cho các con vật/đồ vật thêm sống động
          this.scene.tweens.add({
            targets: img,
            y: img.y - 8,
            duration: 500 + Math.random() * 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: i * 150
          });

          groupContainer.add(img);
        }
        elementsToLayout.push({ el: groupContainer, width: groupW });
      } else if (item.type === 'text' && item.value) {
        const txt = this.scene.add.text(0, 0, item.value, {
          fontFamily: 'Fredoka, sans-serif',
          fontSize: '38px',
          fontStyle: 'bold',
          color: '#E65100'
        }).setOrigin(0.5);
        elementsToLayout.push({ el: txt, width: txt.width });
      }
    });

    // Dàn hàng ngang cân đối qua tâm x = 0
    const totalWidth = elementsToLayout.reduce((sum, item) => sum + item.width, 0) + 
                       (elementsToLayout.length - 1) * spacingBetweenGroups;
    
    // Nếu quá dài so với chiều rộng màn hình, thu nhỏ scale vùng minh họa lại
    const maxIllWidth = width * 0.85;
    if (totalWidth > maxIllWidth) {
      illContainer.setScale(maxIllWidth / totalWidth);
    }

    let startX = -totalWidth / 2;
    elementsToLayout.forEach(item => {
      const itemCenterOffset = item.width / 2;
      
      if (item.el instanceof Phaser.GameObjects.Container) {
        item.el.setPosition(startX + itemCenterOffset, 0);
      } else if (item.el instanceof Phaser.GameObjects.Text) {
        item.el.setPosition(startX + itemCenterOffset, 0);
      }
      
      illContainer.add(item.el);
      startX += item.width + spacingBetweenGroups;
    });

    this.add(illContainer);
  }


  protected updateTextsAndVoice() {
    if (this.speechText) {
      this.speechText.setText(this.levelData.voiceText);
    }
    this.playPromptVoice();
  }

  public resize(width: number, height: number) {
    const bubbleWidth = Math.min(width * 0.8, 480);
    const bubbleHeight = 90;
    const bx = -bubbleWidth / 2;
    const by = -190;

    if (this.speechBubble && this.speechBubble.active) {
      this.speechBubble.clear();
      this.speechBubble.fillStyle(0x000000, 0.08);
      this.speechBubble.fillRoundedRect(bx + 4, by + 4, bubbleWidth, bubbleHeight, 25);
      
      this.speechBubble.fillStyle(0xFFFFFF, 1);
      this.speechBubble.fillRoundedRect(bx, by, bubbleWidth, bubbleHeight, 25);
      this.speechBubble.fillTriangle(-15, by + bubbleHeight, 15, by + bubbleHeight, 0, by + bubbleHeight + 15);
    }

    if (this.speechText && this.speechText.active) {
      this.speechText.setPosition(0, by + bubbleHeight / 2);
      this.speechText.setWordWrapWidth(bubbleWidth - 30);
    }

    if (this.voiceSpeakerBtn && this.voiceSpeakerBtn.active) {
      const speakerX = bubbleWidth / 2 + 40;
      const speakerY = -145;
      this.voiceSpeakerBtn.setPosition(speakerX, speakerY);
    }

    const isLandscape = width > height;
    const numOptions = this.levelData.options.length;
    
    let colSpacing = Math.min(width * 0.88 / (numOptions + 0.5), 150);
    let rowSpacing = isLandscape ? 120 : 130;
    
    let positions: { x: number; y: number }[] = [];
    const choiceYStart = 110;

    if (numOptions <= 4) {
      const totalW = (numOptions - 1) * colSpacing;
      const startX = -totalW / 2;
      for (let i = 0; i < numOptions; i++) {
        positions.push({ x: startX + i * colSpacing, y: choiceYStart });
      }
    } else {
      const row1Count = Math.ceil(numOptions / 2);
      const row2Count = Math.floor(numOptions / 2);
      
      const r1TotalW = (row1Count - 1) * colSpacing;
      const r1StartX = -r1TotalW / 2;
      for (let i = 0; i < row1Count; i++) {
        positions.push({ x: r1StartX + i * colSpacing, y: choiceYStart - rowSpacing / 2 });
      }
      
      const r2TotalW = (row2Count - 1) * colSpacing;
      const r2StartX = -r2TotalW / 2;
      for (let i = 0; i < row2Count; i++) {
        positions.push({ x: r2StartX + i * colSpacing, y: choiceYStart + rowSpacing / 2 });
      }
    }

    this.optionElements.forEach((card, index) => {
      const pos = positions[index];
      if (pos && card && card.active) {
        card.setPosition(pos.x, pos.y);
      }
    });
  }

  public destroy(fromScene?: boolean) {
    this.optionElements.forEach(c => c.destroy());
    this.optionElements = [];
    super.destroy(fromScene);
  }
}
export default TapEngine;
