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
`;
