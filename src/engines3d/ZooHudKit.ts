import * as THREE from 'three';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { TRANSLATIONS } from '../data/translations';

let zooHudStylesInjected = false;

/**
 * Shared HUD chrome for every Vườn thú 3D game: back button, round progress
 * dots, the question speech-bubble (+ speaker button), a loading overlay,
 * and the round-completion overlay. Each concrete engine still builds its
 * own game-specific answer widget (number bubbles, food icons, a tally
 * counter, ...) and appends it into `hud` alongside this chrome.
 */
export class ZooHudKit {
  public speechTextEl: HTMLSpanElement;

  private hud: HTMLDivElement;
  private progressRowEl: HTMLDivElement;
  private loadingOverlayEl: HTMLDivElement | null = null;
  private onSpeak: () => void = () => {};

  // Target preview fields
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewModel: THREE.Object3D | null = null;
  private previewContainerEl: HTMLDivElement | null = null;
  private previewAnimationId: number | null = null;
  private basePreviewRotationY = 0;
  private previewBasePositionX = 0;  // centering X offset, swim is added on top
  private previewPointerMoveHandler: ((e: any) => void) | null = null;
  private previewPointerUpHandler: ((e: any) => void) | null = null;

  constructor(hud: HTMLDivElement, onBack: () => void) {
    this.hud = hud;
    this.injectStylesOnce();

    const backBtn = document.createElement('button');
    backBtn.className = 'zoo3d-back-btn';
    backBtn.textContent = '←';
    backBtn.addEventListener('click', () => {
      audioManager.playTap();
      onBack();
    });
    hud.appendChild(backBtn);

    this.progressRowEl = document.createElement('div');
    this.progressRowEl.className = 'zoo3d-progress';
    hud.appendChild(this.progressRowEl);

    const bubble = document.createElement('div');
    bubble.className = 'zoo3d-speech-bubble';
    this.speechTextEl = document.createElement('span');
    bubble.appendChild(this.speechTextEl);

    const speakerBtn = document.createElement('button');
    speakerBtn.className = 'zoo3d-speaker-btn';
    speakerBtn.textContent = '🔊';
    speakerBtn.addEventListener('click', () => this.onSpeak());
    bubble.appendChild(speakerBtn);
    hud.appendChild(bubble);
  }

  public setQuestion(text: string, onSpeak: () => void) {
    this.speechTextEl.textContent = text;
    this.onSpeak = onSpeak;
  }

  public setProgress(totalRounds: number, currentIndex: number) {
    this.progressRowEl.innerHTML = '';
    for (let i = 0; i < totalRounds; i++) {
      const dot = document.createElement('span');
      dot.className = 'zoo3d-dot' + (i < currentIndex ? ' zoo3d-dot-done' : i === currentIndex ? ' zoo3d-dot-active' : '');
      this.progressRowEl.appendChild(dot);
    }
  }

  public showLoading(show: boolean) {
    if (show) {
      if (this.loadingOverlayEl) return;
      const el = document.createElement('div');
      el.className = 'zoo3d-loading';
      const lang = languageManager.getLanguage();
      const spinner = document.createElement('div');
      spinner.className = 'zoo3d-spinner';
      const text = document.createElement('span');
      text.textContent = TRANSLATIONS[lang].loading;
      el.appendChild(spinner);
      el.appendChild(text);
      this.hud.appendChild(el);
      this.loadingOverlayEl = el;
    } else {
      this.loadingOverlayEl?.remove();
      this.loadingOverlayEl = null;
    }
  }

  public isLoading(): boolean {
    return this.loadingOverlayEl !== null;
  }

  public showCompletion(opts: { onReplay: () => void; onBack: () => void }) {
    audioManager.playVictory();
    const lang = languageManager.getLanguage();

    const overlay = document.createElement('div');
    overlay.className = 'zoo3d-complete';

    const card = document.createElement('div');
    card.className = 'zoo3d-complete-card';

    const title = document.createElement('div');
    title.className = 'zoo3d-complete-title';
    title.textContent = TRANSLATIONS[lang].congrats;
    card.appendChild(title);

    const replayBtn = document.createElement('button');
    replayBtn.className = 'zoo3d-complete-btn zoo3d-complete-btn-primary';
    replayBtn.textContent = TRANSLATIONS[lang].replay;
    replayBtn.addEventListener('click', () => {
      audioManager.playTap();
      overlay.remove();
      opts.onReplay();
    });
    card.appendChild(replayBtn);

    const backBtn = document.createElement('button');
    backBtn.className = 'zoo3d-complete-btn';
    backBtn.textContent = TRANSLATIONS[lang].back;
    backBtn.addEventListener('click', () => {
      audioManager.playTap();
      overlay.remove();
      opts.onBack();
    });
    card.appendChild(backBtn);

    overlay.appendChild(card);
    this.hud.appendChild(overlay);
  }

  public initTargetPreview() {
    if (this.previewContainerEl) return;

    this.previewContainerEl = document.createElement('div');
    this.previewContainerEl.className = 'zoo3d-target-preview';
    this.hud.appendChild(this.previewContainerEl);

    this.previewScene = new THREE.Scene();
    
    this.previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    this.previewCamera.position.set(0, 0, 1.8);

    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.previewRenderer.setSize(180, 180);
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.previewContainerEl.appendChild(this.previewRenderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.previewScene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight.position.set(1, 1.5, 2);
    this.previewScene.add(dirLight);

    let isDragging = false;
    let previousMouseX = 0;

    this.previewContainerEl.style.pointerEvents = 'auto';
    this.previewContainerEl.style.cursor = 'grab';

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      if (this.previewContainerEl) {
        this.previewContainerEl.style.cursor = 'grabbing';
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      previousMouseX = clientX;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - previousMouseX;
      previousMouseX = clientX;

      this.basePreviewRotationY += deltaX * 0.015;
      if (this.previewModel) {
        this.previewModel.rotation.y = this.basePreviewRotationY;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      if (this.previewContainerEl) {
        this.previewContainerEl.style.cursor = 'grab';
      }
    };

    this.previewContainerEl.addEventListener('mousedown', onPointerDown);
    this.previewPointerMoveHandler = onPointerMove;
    this.previewPointerUpHandler = onPointerUp;

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.previewContainerEl.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    let time = 0;
    let swimX = -0.22;        // current swim offset from center
    let swimDir = 1;          // 1 = right, -1 = left
    const SWIM_SPEED = 0.005;
    const SWIM_LIMIT = 0.22;  // max offset from center before turning

    const animate = () => {
      this.previewAnimationId = requestAnimationFrame(animate);
      if (this.previewModel && !isDragging) {
        time += 0.04;

        // Swim back and forth around the centered position
        swimX += swimDir * SWIM_SPEED;
        if (swimX > SWIM_LIMIT) {
          swimX = SWIM_LIMIT;
          swimDir = -1;
        } else if (swimX < -SWIM_LIMIT) {
          swimX = -SWIM_LIMIT;
          swimDir = 1;
        }

        // Flip Y rotation to face the swim direction
        const facingY = swimDir > 0
          ? this.basePreviewRotationY
          : this.basePreviewRotationY + Math.PI;

        // Tail wag and body wobble
        const tailWag = Math.sin(time * 6.5) * 0.1;
        const bodyWobble = Math.sin(time * 6.5 + 0.8) * 0.03;

        // Apply swim offset ON TOP of the centering base position
        this.previewModel.position.x = this.previewBasePositionX + swimX;
        this.previewModel.rotation.y = facingY + bodyWobble;
        this.previewModel.rotation.z = tailWag * swimDir;
      } else if (this.previewModel && isDragging) {
        this.previewModel.rotation.z = 0;
      }
      if (this.previewRenderer && this.previewScene && this.previewCamera) {
        this.previewRenderer.render(this.previewScene, this.previewCamera);
      }
    };
    animate();
  }

  public setTargetPreviewModel(modelTemplate: THREE.Object3D, scaleFactor = 1.0, baseRotationY = 1.5708) {
    if (!this.previewScene) {
      this.initTargetPreview();
    }

    if (this.previewModel) {
      this.previewScene!.remove(this.previewModel);
      this.previewModel = null;
    }

    if (!modelTemplate) return;

    this.previewModel = modelTemplate.clone();
    
    // Must reset rotation BEFORE computing bounding box, otherwise the box
    // includes any inherited animation pose and gives a wrong size/center.
    this.previewModel.rotation.set(0, 0, 0);
    this.previewModel.scale.set(1, 1, 1);
    this.previewModel.position.set(0, 0, 0);

    const box = new THREE.Box3().setFromObject(this.previewModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (0.9 / maxDim) * scaleFactor;
    this.previewModel.scale.setScalar(scale);

    const center = new THREE.Vector3();
    box.getCenter(center);
    this.previewBasePositionX = -center.x * scale;
    this.previewModel.position.set(
      this.previewBasePositionX,
      -center.y * scale,
      -center.z * scale
    );
    
    this.basePreviewRotationY = baseRotationY;
    this.previewModel.rotation.x = 0.18;
    this.previewModel.rotation.y = this.basePreviewRotationY;

    this.previewScene!.add(this.previewModel);
  }

  public setCatchProgress(current: number, target: number) {
    let progressBadge = this.speechTextEl.parentNode?.querySelector('.zoo3d-catch-progress') as HTMLDivElement;
    if (!progressBadge) {
      progressBadge = document.createElement('div');
      progressBadge.className = 'zoo3d-catch-progress';
      this.speechTextEl.parentNode?.appendChild(progressBadge);
    }
    if (target > 0) {
      progressBadge.style.display = 'block';
      progressBadge.textContent = `🎣 ${current} / ${target}`;
    } else {
      progressBadge.style.display = 'none';
    }
  }

  public shakePreview() {
    if (this.previewContainerEl) {
      this.previewContainerEl.classList.remove('zoo3d-shake');
      void this.previewContainerEl.offsetWidth; // trigger reflow
      this.previewContainerEl.classList.add('zoo3d-shake');
    }
  }

  public destroy() {
    if (this.previewAnimationId) {
      cancelAnimationFrame(this.previewAnimationId);
      this.previewAnimationId = null;
    }
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    if (this.previewPointerMoveHandler) {
      window.removeEventListener('mousemove', this.previewPointerMoveHandler);
      window.removeEventListener('touchmove', this.previewPointerMoveHandler);
      this.previewPointerMoveHandler = null;
    }
    if (this.previewPointerUpHandler) {
      window.removeEventListener('mouseup', this.previewPointerUpHandler);
      window.removeEventListener('touchend', this.previewPointerUpHandler);
      this.previewPointerUpHandler = null;
    }
    this.previewScene = null;
    this.previewCamera = null;
    this.previewModel = null;
    this.previewContainerEl?.remove();
    this.previewContainerEl = null;
  }

  private injectStylesOnce() {
    if (zooHudStylesInjected) return;
    zooHudStylesInjected = true;

    const style = document.createElement('style');
    style.id = 'zoo3d-hud-kit-styles';
    style.textContent = ZOO_HUD_CSS;
    document.head.appendChild(style);
  }
}

const ZOO_HUD_CSS = `
.zoo3d-back-btn {
  position: absolute;
  top: 20px; left: 20px;
  width: 56px; height: 56px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: #00ACC1;
  color: #fff;
  font-size: 24px;
  font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}
.zoo3d-progress {
  position: absolute;
  top: 24px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 8px;
}
.zoo3d-dot {
  width: 14px; height: 14px; border-radius: 50%;
  background: rgba(255,255,255,0.5);
  border: 2px solid #fff;
  display: inline-block;
}
.zoo3d-dot-active { background: #FFD700; }
.zoo3d-dot-done { background: #4CAF50; }

.zoo3d-speech-bubble {
  position: absolute;
  top: 64px; left: 50%; transform: translateX(-50%);
  max-width: min(90vw, 560px);
  background: #fff;
  border-radius: 24px;
  padding: 16px 60px 16px 24px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.15);
  font-size: clamp(16px, 3.2vw, 24px);
  font-weight: bold;
  color: #3E2723;
  text-align: center;
}
.zoo3d-speaker-btn {
  position: absolute;
  right: 8px; top: 50%; transform: translateY(-50%);
  width: 42px; height: 42px; border-radius: 50%;
  background: #FF9800; border: 3px solid #fff; color: #fff;
  font-size: 18px;
  display: flex; align-items: center; justify-content: center;
}

.zoo3d-loading {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px;
  color: #fff; font-size: 20px; font-weight: bold;
  pointer-events: auto;
}
.zoo3d-spinner {
  width: 48px; height: 48px;
  border: 6px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: zoo3d-spin 1s linear infinite;
}
@keyframes zoo3d-spin { to { transform: rotate(360deg); } }

.zoo3d-complete {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  pointer-events: auto;
}
.zoo3d-complete-card {
  background: #fff;
  border-radius: 28px;
  padding: 32px 40px;
  display: flex; flex-direction: column; align-items: center; gap: 18px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  max-width: 90vw;
}
.zoo3d-complete-title {
  font-size: clamp(20px, 4vw, 30px);
  font-weight: bold;
  color: #00796B;
  text-align: center;
}
.zoo3d-complete-btn {
  width: 100%;
  padding: 14px 32px;
  border-radius: 20px;
  border: none;
  font-size: 18px;
  font-weight: bold;
  color: #00796B;
  background: #E0F2F1;
}
.zoo3d-complete-btn-primary {
  color: #fff;
  background: #FF7043;
}
.zoo3d-target-preview {
  position: absolute;
  top: 15px; right: 15px;
  width: 180px; height: 180px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  border: 5px solid #4fc3f7;
  box-shadow: 0 6px 16px rgba(0,0,0,0.18);
  overflow: hidden;
  pointer-events: none;
}
.zoo3d-target-preview.zoo3d-shake {
  animation: zoo3d-shake 0.5s;
}
@keyframes zoo3d-shake {
  0%, 100% { transform: scale(1); }
  10%, 30%, 50%, 70%, 90% { transform: translate3d(-4px, 0, 0); }
  20%, 40%, 60%, 80% { transform: translate3d(4px, 0, 0); }
}
.zoo3d-catch-progress {
  margin-top: 6px;
  font-size: clamp(14px, 2.8vw, 20px);
  color: #0288d1;
  font-weight: bold;
}
`;
