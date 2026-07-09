import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { CountLevelData } from '../types/engine';
import { audioManager } from '../managers/AudioManager';
import { Confetti } from '../components/Confetti';
import { parentService } from '../services/ParentService';

export class CountEngine extends BaseEngine<CountLevelData> {
  private choiceElements: Phaser.GameObjects.Container[] = [];
  private objectContainers: Phaser.GameObjects.Container[] = [];
  private objectsContainer!: Phaser.GameObjects.Container;
  
  private voiceSpeakerBtn!: Phaser.GameObjects.Container;
  private speechText!: Phaser.GameObjects.Text;
  private speechBubble!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, levelData: CountLevelData, onComplete: () => void) {
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
   * Tạo giao diện đếm số lượng (GameEngine.create)
   */
  public create() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // 1. Tạo bóng thoại hướng dẫn
    this.createSpeechBubble(width);
    this.createSpeakerButton(width);

    // 2. Tạo Container chứa các đối tượng cần đếm đặt ở trung tâm
    this.objectsContainer = this.scene.add.container(0, -35);
    this.add(this.objectsContainer);
    this.renderObjects(width, height);

    // 3. Tạo cụm các nút bong bóng chứa phím số lựa chọn
    this.createChoices(width);
  }

  /**
   * Đối sánh kết quả đếm (GameEngine)
   */
  public checkAnswer(answer: { value: number; element: Phaser.GameObjects.Container }) {
    if (this.interactiveLocked) return;

    const { value, element } = answer;
    const isCorrect = value === this.levelData.count;
    this.showResult(isCorrect, element);
  }

  /**
   * Đặt lại trạng thái màn chơi (GameEngine)
   */
  public reset() {
    super.reset();
    this.choiceElements.forEach(card => {
      card.setScale(1);
      card.setAlpha(1);
    });
  }

  /**
   * Hiệu ứng Đúng/Sai
   */
  private showResult(isCorrect: boolean, targetObject: Phaser.GameObjects.Container) {
    if (isCorrect) {
      this.interactiveLocked = true;
      audioManager.playCorrect();
      parentService.trackCorrect();




      // Hiệu ứng nhảy cao nảy nhún nhảy ăn mừng của nút số đúng
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

      // Rung lắc ngang nút chọn số sai
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
    const by = -230;

    this.speechBubble = this.scene.add.graphics();
    this.speechBubble.fillStyle(0x000000, 0.08);
    this.speechBubble.fillRoundedRect(bx + 4, by + 4, bubbleWidth, bubbleHeight, 25);
    
    this.speechBubble.fillStyle(0xFFFFFF, 1);
    this.speechBubble.fillRoundedRect(bx, by, bubbleWidth, bubbleHeight, 25);

    this.speechBubble.fillTriangle(-15, by + bubbleHeight, 15, by + bubbleHeight, 0, by + bubbleHeight + 15);

    this.speechText = this.scene.add.text(0, by + bubbleHeight / 2, this.levelData.voiceText, {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '24px',
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
    const speakerY = -185;

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

  /**
   * Vẽ lưới con vật tự động xuống dòng khi số lượng lớn (Rule 4 & 5)
   */
  private renderObjects(width: number, height: number) {
    const count = this.levelData.count;
    const assetKey = this.levelData.object.asset;
    const isLandscape = width > height;

    console.log("CountEngine Diagnostic:", {
      count,
      assetKey,
      textureExists: this.scene.textures.exists(assetKey),
      levelData: this.levelData
    });

    const maxColInRow = 5;
    const spacingX = Math.min(width * 0.9 / (Math.min(count, maxColInRow) + 0.5), 105);
    const spacingY = isLandscape ? 85 : 95;
    const itemSize = count <= maxColInRow ? 90 : 70;

    let itemsInfo: { x: number; y: number }[] = [];

    // Nếu <= 5 con vật, xếp thành 1 hàng ngang
    if (count <= maxColInRow) {
      const totalWidth = (count - 1) * spacingX;
      const startX = -totalWidth / 2;
      for (let i = 0; i < count; i++) {
        itemsInfo.push({ x: startX + i * spacingX, y: -10 });
      }
    } else {
      // Nếu > 5 con vật, bẻ đôi làm 2 hàng cân bằng để chống tràn
      const row1Count = Math.ceil(count / 2);
      const row2Count = Math.floor(count / 2);

      const r1TotalW = (row1Count - 1) * spacingX;
      const r1StartX = -r1TotalW / 2;
      for (let i = 0; i < row1Count; i++) {
        itemsInfo.push({ x: r1StartX + i * spacingX, y: -spacingY / 2 - 10 });
      }

      const r2TotalW = (row2Count - 1) * spacingX;
      const r2StartX = -r2TotalW / 2;
      for (let i = 0; i < row2Count; i++) {
        itemsInfo.push({ x: r2StartX + i * spacingX, y: spacingY / 2 - 10 });
      }
    }

    itemsInfo.forEach((pos, idx) => {
      // Bọc ảnh con vật trong Container con để chạy hiệu ứng scale độc lập
      const itemContainer = this.scene.add.container(pos.x, pos.y);
      
      const img = this.scene.add.image(0, 0, assetKey);
      img.setDisplaySize(itemSize, itemSize);
      itemContainer.add(img);

      // Hiệu ứng Pop-In xuất hiện nhún nhảy từ nhỏ tới lớn trên Container
      itemContainer.setScale(0);
      this.scene.tweens.add({
        targets: itemContainer,
        scaleX: 1,
        scaleY: 1,
        duration: 350,
        delay: idx * 60,
        ease: 'Back.easeOut'
      });

      this.objectContainers.push(itemContainer);
      this.objectsContainer.add(itemContainer);
    });
  }

  /**
   * Tạo các phím số lựa chọn to đẹp dưới dạng bong bóng
   */
  private createChoices(width: number) {
    const choices = this.levelData.choices;
    const numChoices = choices.length;
    const spacing = Math.min(width * 0.95 / (numChoices + 0.5), 110);
    const totalW = (numChoices - 1) * spacing;
    const startX = -totalW / 2;
    const posY = 100;
    const bubbleSize = Math.min(spacing - 15, 88);

    choices.forEach((choiceVal, index) => {
      const cx = startX + index * spacing;
      const card = this.scene.add.container(cx, posY);

      // Bóng đổ của bong bóng số
      const shadow = this.scene.add.graphics();
      shadow.fillStyle(0x000000, 0.05);
      shadow.fillCircle(3, 5, bubbleSize / 2);

      // Thân bong bóng số
      const body = this.scene.add.graphics();
      body.fillStyle(0xFFB74D, 1); // Cam sữa ấm áp
      body.fillCircle(0, 0, bubbleSize / 2);
      body.lineStyle(4, 0xFFFFFF, 1);
      body.strokeCircle(0, 0, bubbleSize / 2);

      // Nhãn chữ số
      const text = this.scene.add.text(0, -2, String(choiceVal), {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#FFFFFF',
        shadow: { color: '#E65100', blur: 4, fill: true, stroke: true }
      }).setOrigin(0.5);

      card.add([shadow, body, text]);
      card.setInteractive(new Phaser.Geom.Circle(0, 0, bubbleSize / 2), Phaser.Geom.Circle.Contains);
      
      if (card.input) {
        card.input.cursor = 'pointer';
      }

      card.on('pointerover', () => {
        if (this.interactiveLocked) return;
        this.scene.tweens.add({ targets: card, scaleX: 1.08, scaleY: 1.08, duration: 150 });
      });

      card.on('pointerout', () => {
        if (this.interactiveLocked) return;
        this.scene.tweens.add({ targets: card, scaleX: 1.0, scaleY: 1.0, duration: 150 });
      });

      card.on('pointerdown', () => {
        this.checkAnswer({ value: choiceVal, element: card });
      });

      card.setScale(0);
      this.scene.tweens.add({
        targets: card,
        scaleX: 1,
        scaleY: 1,
        duration: 450,
        delay: index * 60,
        ease: 'Back.easeOut'
      });

      this.choiceElements.push(card);
      this.add(card);
    });
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
    const by = -230;

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
      const speakerY = -185;
      this.voiceSpeakerBtn.setPosition(speakerX, speakerY);
    }

    // Căn lại các con vật cần đếm
    const count = this.levelData.count;
    const isLandscape = width > height;

    const maxColInRow = 5;
    const spacingX = Math.min(width * 0.9 / (Math.min(count, maxColInRow) + 0.5), 105);
    const spacingY = isLandscape ? 85 : 95;

    let itemsInfo: { x: number; y: number }[] = [];

    if (count <= maxColInRow) {
      const totalWidth = (count - 1) * spacingX;
      const startX = -totalWidth / 2;
      for (let i = 0; i < count; i++) {
        itemsInfo.push({ x: startX + i * spacingX, y: -10 });
      }
    } else {
      const row1Count = Math.ceil(count / 2);
      const row2Count = Math.floor(count / 2);

      const r1TotalW = (row1Count - 1) * spacingX;
      const r1StartX = -r1TotalW / 2;
      for (let i = 0; i < row1Count; i++) {
        itemsInfo.push({ x: r1StartX + i * spacingX, y: -spacingY / 2 - 10 });
      }

      const r2TotalW = (row2Count - 1) * spacingX;
      const r2StartX = -r2TotalW / 2;
      for (let i = 0; i < row2Count; i++) {
        itemsInfo.push({ x: r2StartX + i * spacingX, y: spacingY / 2 - 10 });
      }
    }

    this.objectContainers.forEach((container, idx) => {
      const pos = itemsInfo[idx];
      if (pos && container && container.active) {
        container.setPosition(pos.x, pos.y);
      }
    });

    // Căn lại các phím bong bóng lựa chọn
    const choices = this.levelData.choices;
    const numChoices = choices.length;
    const spacing = Math.min(width * 0.95 / (numChoices + 0.5), 110);
    const totalW = (numChoices - 1) * spacing;
    const startX = -totalW / 2;
    const posY = 100;

    this.choiceElements.forEach((card, index) => {
      if (card && card.active) {
        const cx = startX + index * spacing;
        card.setPosition(cx, posY);
      }
    });
  }

  public destroy(fromScene?: boolean) {
    this.choiceElements.forEach(c => c.destroy());
    this.objectContainers.forEach(c => c.destroy());
    this.choiceElements = [];
    this.objectContainers = [];
    super.destroy(fromScene);
  }
}
export default CountEngine;
