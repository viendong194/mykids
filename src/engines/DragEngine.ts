import Phaser from 'phaser';
import { BaseEngine } from './BaseEngine';
import type { DragLevelData } from '../types/engine';
import { audioManager } from '../managers/AudioManager';
import { Confetti } from '../components/Confetti';
import { parentService } from '../services/ParentService';
import { DragItemCard } from '../components/DragItemCard';
import { DragTargetSlot } from '../components/DragTargetSlot';

export class DragEngine extends BaseEngine<DragLevelData> {
  private itemContainers: DragItemCard[] = [];
  private targetContainers: DragTargetSlot[] = [];
  private voiceSpeakerBtn!: Phaser.GameObjects.Container;
  private speechText!: Phaser.GameObjects.Text;
  private speechBubble!: Phaser.GameObjects.Graphics;
  private matchedCount: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, levelData: DragLevelData, onComplete: () => void) {
    super(scene, x, y, levelData, onComplete);
    this.create();
    this.playPromptVoiceDelayed(500);
  }

  /**
   * Khởi tạo các giá trị ban đầu (GameEngine)
   */
  public initialize() {
    super.initialize();
    this.matchedCount = 0;
  }

  /**
   * Tạo giao diện kéo thả (GameEngine)
   */
  public create() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // 1. Bong bóng hướng dẫn
    this.createSpeechBubble(width);
    this.createSpeakerButton(width);

    // 2. Tạo DropZone bên dưới
    this.createTargets(width, height);

    // 3. Tạo vật phẩm kéo thả bên trên
    this.createItems(width);

    // 4. Lắng nghe sự kiện kéo thả của Phaser
    this.setupDragDropEvents();
  }

  /**
   * Đối sánh câu trả lời (GameEngine)
   */
  public checkAnswer(answer: { targetId: string; item: DragItemCard; target: DragTargetSlot }) {
    const { targetId, item, target } = answer;
    const itemData = item.getData('itemData');
    const isCorrect = itemData.targetId === targetId;
    this.showResult(isCorrect, { item, target });
  }

  /**
   * Đặt lại trạng thái màn chơi (GameEngine)
   */
  public reset() {
    super.reset();
    this.matchedCount = 0;
    this.itemContainers.forEach(item => {
      this.scene.input.setDraggable(item, true);
      if (item.input) {
        item.input.cursor = 'grab';
      }
      const homeX = item.getData('homeX');
      const homeY = item.getData('homeY');
      this.scene.tweens.add({
        targets: item,
        x: homeX,
        y: homeY,
        scaleX: 1,
        scaleY: 1,
        duration: 300
      });
    });
  }

  /**
   * Hiệu ứng Đúng/Sai
   */
  private showResult(isCorrect: boolean, targetObject: any) {
    if (isCorrect) {
      const { item, target } = targetObject;
      this.scene.input.setDraggable(item, false);
      if (item.input) {
        item.input.cursor = 'default';
      }

      this.matchedCount++;
      audioManager.playCorrect();
      parentService.trackCorrect();

      this.scene.tweens.add({
        targets: item,
        x: target.x,
        y: target.y - 10,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 250,
        ease: 'Back.easeOut',
        onComplete: () => {
          Confetti.burst(this.scene, this.x + target.x, this.y + target.y - 10);
          this.scene.tweens.add({
            targets: item,
            scaleX: 0.95,
            scaleY: 0.95,
            duration: 150
          });

          if (this.matchedCount === this.levelData.items.length) {
            this.handleAllMatched();
          }
        }
      });
    } else {
      const item = targetObject;
      audioManager.playIncorrect();
      parentService.trackIncorrect();

      const startX = item.x;
      this.scene.tweens.add({
        targets: item,
        x: { from: startX - 12, to: startX + 12 },
        duration: 65,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          this.tweenBackToHome(item);
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

  private createTargets(width: number, height: number) {
    const targets = this.levelData.targets;
    const numTargets = targets.length;
    const spacing = Math.min(width * 0.9 / (numTargets + 0.5), 220);
    const totalWidth = (numTargets - 1) * spacing;
    const startX = -totalWidth / 2;
    const targetY = height > width ? 150 : 120;
    const targetSize = Math.min(spacing - 20, 150);

    targets.forEach((targetData, idx) => {
      const tx = startX + idx * spacing;
      const targetSlot = new DragTargetSlot(this.scene, this.x + tx, this.y + targetY, targetSize, targetData);
      
      this.targetContainers.push(targetSlot);
      this.add(targetSlot);
      
      targetSlot.x = tx;
      targetSlot.y = targetY;
    });
  }

  private createItems(width: number) {
    const items = this.levelData.items;
    const numItems = items.length;
    const spacing = Math.min(width * 0.9 / (numItems + 0.5), 180);
    const totalWidth = (numItems - 1) * spacing;
    const startX = -totalWidth / 2;
    const itemY = -30;
    const itemSize = Math.min(spacing - 20, 120);

    const shuffledIndices = Phaser.Utils.Array.NumberArray(0, numItems - 1) as number[];
    Phaser.Utils.Array.Shuffle(shuffledIndices);

    items.forEach((itemData, idx) => {
      const targetPosIdx = shuffledIndices[idx];
      const ix = startX + targetPosIdx * spacing;
      const itemCard = new DragItemCard(this.scene, this.x + ix, this.y + itemY, itemSize, itemData);
      
      this.itemContainers.push(itemCard);
      this.add(itemCard);

      itemCard.x = ix;
      itemCard.y = itemY;

      // Lưu trữ chỉ mục xáo trộn và toạ độ gốc tương đối phục vụ cho co dãn giao diện
      itemCard.setData('shuffledIdx', targetPosIdx);
      itemCard.setData('homeX', ix);
      itemCard.setData('homeY', itemY);
    });
  }

  private setupDragDropEvents() {
    this.scene.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
      if (this.interactiveLocked) return;
      this.bringToTop(gameObject);

      if (gameObject.input) {
        gameObject.input.cursor = 'grabbing';
      }

      audioManager.playTap();
      this.scene.tweens.add({ targets: gameObject, scaleX: 1.15, scaleY: 1.15, duration: 150 });
    });

    this.scene.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container, dragX: number, dragY: number) => {
      if (this.interactiveLocked) return;
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.scene.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container, dropped: boolean) => {
      if (gameObject.input) {
        gameObject.input.cursor = 'grab';
      }

      this.scene.tweens.add({ targets: gameObject, scaleX: 1.0, scaleY: 1.0, duration: 150 });

      if (!dropped) {
        this.tweenBackToHome(gameObject);
      }
    });

    this.scene.input.on('drop', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container, targetZone: Phaser.GameObjects.Zone) => {
      const targetSlot = targetZone.getData('targetContainer') as DragTargetSlot;
      const targetId = targetSlot.getData('id');

      this.checkAnswer({ targetId, item: gameObject as DragItemCard, target: targetSlot });
    });
  }

  private tweenBackToHome(item: Phaser.GameObjects.Container) {
    const homeX = item.getData('homeX');
    const homeY = item.getData('homeY');
    this.scene.tweens.add({ targets: item, x: homeX, y: homeY, duration: 350, ease: 'Cubic.easeOut' });
  }

  private handleAllMatched() {
    this.interactiveLocked = true;



    this.scene.time.delayedCall(1200, () => {
      this.onCompleteCallback();
    });
  }

  protected updateTextsAndVoice() {
    if (this.speechText) {
      this.speechText.setText(this.levelData.voiceText);
    }
    
    this.targetContainers.forEach((targetContainer, index) => {
      const targetData = this.levelData.targets[index];
      targetContainer.updateLabel(targetData.name);
    });

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

    // Căn lại các DropZone
    const targets = this.levelData.targets;
    const numTargets = targets.length;
    const spacing = Math.min(width * 0.9 / (numTargets + 0.5), 220);
    const totalWidth = (numTargets - 1) * spacing;
    const startX = -totalWidth / 2;
    const targetY = height > width ? 150 : 120;

    this.targetContainers.forEach((targetSlot, idx) => {
      if (targetSlot && targetSlot.active) {
        const tx = startX + idx * spacing;
        targetSlot.setPosition(tx, targetY);
      }
    });

    // Căn lại các vật phẩm kéo thả
    const items = this.levelData.items;
    const numItems = items.length;
    const itemSpacing = Math.min(width * 0.9 / (numItems + 0.5), 180);
    const itemTotalWidth = (numItems - 1) * itemSpacing;
    const itemStartX = -itemTotalWidth / 2;
    const itemY = -30;

    this.itemContainers.forEach((itemCard) => {
      if (itemCard && itemCard.active) {
        const targetPosIdx = itemCard.getData('shuffledIdx') as number;
        const ix = itemStartX + targetPosIdx * itemSpacing;

        itemCard.setData('homeX', ix);
        itemCard.setData('homeY', itemY);

        const isMatched = !itemCard.input || !itemCard.input.draggable;
        if (isMatched) {
          const itemData = itemCard.getData('itemData');
          const targetSlot = this.targetContainers.find(t => t.getData('id') === itemData.targetId);
          if (targetSlot) {
            itemCard.setPosition(targetSlot.x, targetSlot.y - 10);
          }
        } else {
          itemCard.setPosition(ix, itemY);
        }
      }
    });
  }

  public destroy(fromScene?: boolean) {
    if (this.scene && this.scene.input) {
      this.scene.input.off('dragstart');
      this.scene.input.off('drag');
      this.scene.input.off('dragend');
      this.scene.input.off('drop');
    }

    this.itemContainers.forEach(c => c.destroy());
    this.targetContainers.forEach(c => c.destroy());
    this.itemContainers = [];
    this.targetContainers = [];

    super.destroy(fromScene);
  }
}
export default DragEngine;
