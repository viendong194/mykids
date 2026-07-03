import Phaser from 'phaser';
import { languageManager } from '../managers/LanguageManager';
import type { Base3DEngine } from '../engines3d/Base3DEngine';
import type { Zoo3DAgeGroup } from '../engines3d/ZooCountEngine';

/**
 * Thin bridge between Phaser and the standalone Three.js "Vườn thú 3D" engine.
 * Phaser can't render .glb models, so this scene keeps the Phaser canvas
 * visible (with its own loading spinner) until the 3D engine is fully built,
 * then swaps to the sibling #three-container canvas. Reverses on exit.
 */
export class Zoo3DScene extends Phaser.Scene {
  private age: Zoo3DAgeGroup = '2-3';
  private container: HTMLElement | null = null;
  private engine: Base3DEngine | null = null;
  private loadingOverlay: Phaser.GameObjects.Container | null = null;
  private resizeListener?: (gameSize: Phaser.Structs.Size) => void;
  private exited = false;

  constructor() {
    super('Zoo3DScene');
  }

  init(data: { age?: string }) {
    this.age = data?.age === '4-6' ? '4-6' : '2-3';
    this.exited = false;
    this.engine = null;
    this.container = null;
    this.loadingOverlay = null;
  }

  create() {
    this.container = document.getElementById('three-container');
    if (!this.container) {
      console.error('Zoo3DScene: #three-container element not found in DOM');
      this.scene.start('AgeSelectionScene', { mode: 'zoo3d' });
      return;
    }

    this.loadingOverlay = this.showLoadingOverlay();

    this.resizeListener = (gameSize: Phaser.Structs.Size) => {
      if (this.engine) {
        this.engine.resize(gameSize.width, gameSize.height);
      }
    };
    this.scale.on('resize', this.resizeListener);

    this.launchEngine();

    this.events.on('shutdown', () => this.cleanup());
    this.events.on('destroy', () => this.cleanup());
  }

  private async launchEngine() {
    if (!this.container) return;

    try {
      const { ZooCountEngine } = await import('../engines3d/ZooCountEngine');
      if (this.exited || !this.container) return;

      const engine = new ZooCountEngine(this.age, () => this.exitToAgeSelection());
      await engine.mount(this.container, this.scale.width, this.scale.height);

      if (this.exited) {
        // Bé đã bấm quay lại trong lúc đang tải — dọn dẹp ngay, không hiện gì cả.
        engine.destroy();
        return;
      }

      this.engine = engine;
      this.loadingOverlay?.destroy();
      this.loadingOverlay = null;

      this.game.canvas.style.display = 'none';
      this.container.style.display = 'block';
    } catch (e) {
      console.error('Zoo3DScene: failed to start 3D engine:', e);
      this.exitToAgeSelection();
    }
  }

  private exitToAgeSelection() {
    if (this.exited) return;
    this.exited = true;
    this.scene.start('AgeSelectionScene', { mode: 'zoo3d' });
  }

  private cleanup() {
    if (this.resizeListener) {
      this.scale.off('resize', this.resizeListener);
      this.resizeListener = undefined;
    }
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    if (this.loadingOverlay) {
      this.loadingOverlay.destroy();
      this.loadingOverlay = null;
    }
    if (this.container) {
      this.container.style.display = 'none';
      this.container.innerHTML = '';
    }
    if (this.game?.canvas) {
      this.game.canvas.style.display = 'block';
    }
  }

  private showLoadingOverlay(): Phaser.GameObjects.Container {
    const width = this.scale.width;
    const height = this.scale.height;

    const container = this.add.container(width / 2, height / 2);
    const bg = this.add.graphics();
    bg.fillStyle(0xbbe7f2, 1);
    bg.fillRect(-width / 2, -height / 2, width, height);

    const spinner = this.add.image(0, -30, 'star').setDisplaySize(80, 80);
    this.tweens.add({ targets: spinner, angle: 360, duration: 1000, repeat: -1, ease: 'Linear' });

    const lang = languageManager.getLanguage();
    const text = this.add.text(0, 40, lang === 'vi' ? 'Đang dựng vườn thú...' : 'Building the zoo...', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#00796B',
    }).setOrigin(0.5);

    container.add([bg, spinner, text]);
    return container;
  }
}
export default Zoo3DScene;
