import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { MatchLevelData, MatchItem } from '../types/engine';
import { audioManager } from '../managers/AudioManager';
import { Confetti } from '../components/Confetti';
import { parentService } from '../services/ParentService';

export class MatchEngine extends BaseEngine<MatchLevelData> {
  private choiceElements: Phaser.GameObjects.Container[] = [];
  private targetCard!: Phaser.GameObjects.Container;
  private voiceSpeakerBtn!: Phaser.GameObjects.Container;
  private speechText!: Phaser.GameObjects.Text;
  private speechBubble!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, levelData: MatchLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
    this.create();
    this.playPromptVoiceDelayed(500);
  }

  /**
   * Khởi tạo trạng thái ban đầu (GameEngine)
   */
  public initialize() {
    super.initialize();
  }

  /**
   * Khởi tạo giao diện của MatchEngine (GameEngine.create)
   */
  public create() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // 1. Tạo bong bóng hướng dẫn và loa
    this.createSpeechBubble(width);
    this.createSpeakerButton(width);

    // 2. Tạo đối tượng mẫu đặt ở chính giữa bên trên
    this.createTargetObject();

    // 3. Tạo lưới các tùy chọn đáp án xếp bên dưới
    this.createChoicesGrid(width, height);
  }

  /**
   * Kiểm tra đáp án (GameEngine)
   */
  public checkAnswer(answer: { choice: MatchItem; element: Phaser.GameObjects.Container }) {
    if (this.interactiveLocked) return;

    const { choice, element } = answer;
    const isCorrect = choice.id === this.levelData.target.id;
    this.showResult(isCorrect, element);
  }

  /**
   * Đặt lại màn chơi (GameEngine)
   */
  public reset() {
    super.reset();
    this.choiceElements.forEach(card => {
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




      // Hiệu ứng nhảy cao nảy nhún nhảy ăn mừng của ô màu đúng
      this.scene.tweens.add({
        targets: targetObject,
        y: targetObject.y - 60,
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

      // Rung lắc cảnh báo màu sai
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
    const bubbleWidth = Math.min(width * 0.8, 480);
    const bubbleHeight = 90;
    const bx = -bubbleWidth / 2;
    const by = -190;

    this.speechBubble = this.scene.add.graphics();
    this.speechBubble.fillStyle(0x000000, 0.08);
    this.speechBubble.fillRoundedRect(bx + 4, by + 4, bubbleWidth, bubbleHeight, 25);
    
    this.speechBubble.fillStyle(0xFFFFFF, 1);
    this.speechBubble.fillRoundedRect(bx, by, bubbleWidth, bubbleHeight, 25);

    this.speechBubble.fillTriangle(-15, by + bubbleHeight, 15, by + bubbleHeight, 0, by + bubbleHeight + 15);

    this.speechText = this.scene.add.text(0, by + bubbleHeight / 2, this.levelData.voiceText, {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#3E2723',
      align: 'center',
      wordWrap: { width: bubbleWidth - 30 }
    }).setOrigin(0.5);

    this.add([this.speechBubble, this.speechText]);
  }

  private createSpeakerButton(width: number) {
    const bubbleWidth = Math.min(width * 0.8, 480);
    const speakerX = bubbleWidth / 2 + 40;
    const speakerY = -145;

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

  private createTargetObject() {
    this.targetCard = this.scene.add.container(0, -45);
    const size = 150;
    
    this.renderItem(this.targetCard, this.levelData.target, size);

    // Hiệu ứng thở (nhấp nhô nhẹ kích thích bé chạm)
    this.scene.tweens.add({
      targets: this.targetCard,
      scaleX: 1.05,
      scaleY: 1.05,
      yoyo: true,
      repeat: -1,
      duration: 1500,
      ease: 'Sine.easeInOut'
    });

    this.add(this.targetCard);
  }

  private createChoicesGrid(width: number, height: number) {
    const isLandscape = width > height;
    const choices = this.levelData.choices;
    const numChoices = choices.length;

    let colSpacing = Math.min(width * 0.44, 180);
    let rowSpacing = isLandscape ? Math.min(height * 0.38, 120) : Math.min(height * 0.22, 130);

    let positions: { x: number; y: number }[] = [];
    const choiceYStart = 110;

    if (numChoices === 2) {
      positions = [
        { x: -colSpacing / 2, y: choiceYStart },
        { x: colSpacing / 2, y: choiceYStart }
      ];
    } else if (numChoices === 3) {
      positions = [
        { x: -colSpacing, y: choiceYStart },
        { x: 0, y: choiceYStart },
        { x: colSpacing, y: choiceYStart }
      ];
    } else if (numChoices === 4) {
      positions = [
        { x: -colSpacing / 2, y: choiceYStart - rowSpacing / 2 },
        { x: colSpacing / 2, y: choiceYStart - rowSpacing / 2 },
        { x: -colSpacing / 2, y: choiceYStart + rowSpacing / 2 },
        { x: colSpacing / 2, y: choiceYStart + rowSpacing / 2 }
      ];
    } else if (numChoices === 6) {
      positions = [
        { x: -colSpacing, y: choiceYStart - rowSpacing / 2 },
        { x: 0, y: choiceYStart - rowSpacing / 2 },
        { x: colSpacing, y: choiceYStart - rowSpacing / 2 },
        { x: -colSpacing, y: choiceYStart + rowSpacing / 2 },
        { x: 0, y: choiceYStart + rowSpacing / 2 },
        { x: colSpacing, y: choiceYStart + rowSpacing / 2 }
      ];
    }

    const cardSize = Math.min(colSpacing - 20, 115);

    choices.forEach((choice, index) => {
      const pos = positions[index] || { x: 0, y: choiceYStart };
      const card = this.scene.add.container(pos.x, pos.y);

      this.renderItem(card, choice, cardSize);

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
        this.checkAnswer({ choice, element: card });
      });

      card.setScale(0);
      this.scene.tweens.add({
        targets: card,
        scaleX: 1,
        scaleY: 1,
        duration: 500,
        delay: index * 80,
        ease: 'Back.easeOut'
      });

      this.choiceElements.push(card);
      this.add(card);
    });
  }

  /**
   * Phương thức vẽ tổng quát đối tượng màu sắc / ảnh tĩnh (Domain-Agnostic)
   */
  private renderItem(card: Phaser.GameObjects.Container, item: MatchItem, size: number) {
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.05);
    shadow.fillRoundedRect(-size / 2 + 3, -size / 2 + 5, size, size, 25);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0xFFFFFF, 1);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 25);
    bg.lineStyle(5, 0xEEEEEE, 1);
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 25);

    card.add([shadow, bg]);

    if (item.type === 'color') {
      const colorVal = parseInt(item.value.replace('#', '0x'), 16);
      const colorFill = this.scene.add.graphics();
      colorFill.fillStyle(colorVal, 1);
      colorFill.fillRoundedRect(-size / 2 + 10, -size / 2 + 10, size - 20, size - 20, 20);
      card.add(colorFill);
    } else {
      const img = this.scene.add.image(0, 0, item.value);
      img.setDisplaySize(size - 25, size - 25);
      card.add(img);
    }
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
    const choices = this.levelData.choices;
    const numChoices = choices.length;

    let colSpacing = Math.min(width * 0.44, 180);
    let rowSpacing = isLandscape ? Math.min(height * 0.38, 120) : Math.min(height * 0.22, 130);

    let positions: { x: number; y: number }[] = [];
    const choiceYStart = 110;

    if (numChoices === 2) {
      positions = [
        { x: -colSpacing / 2, y: choiceYStart },
        { x: colSpacing / 2, y: choiceYStart }
      ];
    } else if (numChoices === 3) {
      positions = [
        { x: -colSpacing, y: choiceYStart },
        { x: 0, y: choiceYStart },
        { x: colSpacing, y: choiceYStart }
      ];
    } else if (numChoices === 4) {
      positions = [
        { x: -colSpacing / 2, y: choiceYStart - rowSpacing / 2 },
        { x: colSpacing / 2, y: choiceYStart - rowSpacing / 2 },
        { x: -colSpacing / 2, y: choiceYStart + rowSpacing / 2 },
        { x: colSpacing / 2, y: choiceYStart + rowSpacing / 2 }
      ];
    } else if (numChoices === 6) {
      positions = [
        { x: -colSpacing, y: choiceYStart - rowSpacing / 2 },
        { x: 0, y: choiceYStart - rowSpacing / 2 },
        { x: colSpacing, y: choiceYStart - rowSpacing / 2 },
        { x: -colSpacing, y: choiceYStart + rowSpacing / 2 },
        { x: 0, y: choiceYStart + rowSpacing / 2 },
        { x: colSpacing, y: choiceYStart + rowSpacing / 2 }
      ];
    }

    this.choiceElements.forEach((card, index) => {
      const pos = positions[index];
      if (pos && card && card.active) {
        card.setPosition(pos.x, pos.y);
      }
    });
  }

  public destroy(fromScene?: boolean) {
    this.choiceElements.forEach(c => c.destroy());
    this.choiceElements = [];
    super.destroy(fromScene);
  }
}
export default MatchEngine;
