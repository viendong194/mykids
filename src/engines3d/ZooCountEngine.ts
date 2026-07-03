import * as THREE from 'three';
import { Base3DEngine } from './Base3DEngine';
import { DomConfetti } from './DomConfetti';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { parentService } from '../services/ParentService';
import { TRANSLATIONS } from '../data/translations';
import { ZOO3D_SPECIES, buildZoo3DVoiceText, getZoo3DSpecies } from '../data/zoo3d_translations';
import type { Zoo3DLevelData, Zoo3DRoundEntry } from '../types/engine3d';

export type Zoo3DAgeGroup = '2-3' | '4-6';

interface DifficultyConfig {
  numSpeciesRange: [number, number];
  targetCountRange: [number, number];
  distractorCountRange: [number, number];
  choicesCount: number;
  rounds: number;
}

const DIFFICULTY: Record<Zoo3DAgeGroup, DifficultyConfig> = {
  '2-3': { numSpeciesRange: [2, 2], targetCountRange: [1, 3], distractorCountRange: [1, 2], choicesCount: 3, rounds: 5 },
  '4-6': { numSpeciesRange: [2, 3], targetCountRange: [2, 5], distractorCountRange: [1, 4], choicesCount: 4, rounds: 5 },
};

const NATURE_DECOR: { file: string; height: number }[] = [
  { file: 'tree', height: 2.4 },
  { file: 'pine', height: 2.6 },
  { file: 'twisted-tree', height: 2.2 },
  { file: 'bush', height: 0.7 },
  { file: 'rock-medium', height: 0.6 },
  { file: 'flower-group', height: 0.4 },
  { file: 'mushroom', height: 0.35 },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

let zooStylesInjected = false;

type AnimalState = 'idle' | 'walking';

interface AnimalAgent {
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  radius: number;
  speed: number;
  state: AnimalState;
  target: { x: number; z: number };
  idleTimer: number;
}

/**
 * "Vườn thú mini" — 3D counting game. Places several species in a diorama
 * and asks the child how many animals of ONE specific species are present.
 */
export class ZooCountEngine extends Base3DEngine {
  private age: Zoo3DAgeGroup;
  private onExit: () => void;

  private levels: Zoo3DLevelData[] = [];
  private currentIndex = 0;
  private animalAgents: AnimalAgent[] = [];
  private readonly playRadius = 4.1;
  private interactiveLocked = false;
  private cameraAngle = 0;

  private unsubscribeLang: () => void;

  private speechTextEl!: HTMLSpanElement;
  private choicesRowEl!: HTMLDivElement;
  private progressRowEl!: HTMLDivElement;
  private loadingOverlayEl: HTMLDivElement | null = null;

  constructor(age: Zoo3DAgeGroup, onExit: () => void) {
    super();
    this.age = age;
    this.onExit = onExit;
    this.unsubscribeLang = languageManager.onChange(() => this.onLanguageChange());
  }

  protected async build(): Promise<void> {
    this.setupLighting();
    this.setupCamera();
    this.buildHud();
    this.showLoading(true);

    await this.buildGround();

    this.levels = this.generateRound();
    this.currentIndex = 0;
    await this.renderCurrentLevel();

    this.showLoading(false);
  }

  protected update(dt: number): void {
    this.cameraAngle += dt * 0.15;
    const sway = Math.sin(this.cameraAngle) * 0.35;
    this.camera.position.x = Math.sin(sway) * 9;
    this.camera.position.z = Math.cos(sway) * 8;
    this.camera.position.y = 6 + Math.sin(this.cameraAngle * 0.6) * 0.3;
    this.camera.lookAt(0, 0.8, 0);

    this.animalAgents.forEach((agent) => agent.mixer.update(dt));
    this.updateAnimalBehavior(dt);
  }

  public destroy(): void {
    this.unsubscribeLang();
    super.destroy();
  }

  // ---------- Scene setup ----------

  private setupLighting() {
    const sky = 0xbbe7f2;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, 12, 26);

    const hemi = new THREE.HemisphereLight(0xe1f5fe, 0x8d6e63, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 8, 5);
    this.scene.add(sun);
  }

  private setupCamera() {
    this.camera.position.set(0, 6, 8);
    this.camera.lookAt(0, 0.8, 0);
  }

  private async buildGround() {
    const groundGeo = new THREE.CircleGeometry(7, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const distinctDecor = Array.from(new Map(NATURE_DECOR.map((d) => [d.file, d])).values());
    await Promise.all(distinctDecor.map((d) => this.loadModel(`assets/3d/nature/${d.file}.glb`, d.height)));

    const ringCount = 12;
    const ringRadius = 5.6;
    for (let i = 0; i < ringCount; i++) {
      const decor = NATURE_DECOR[i % NATURE_DECOR.length];
      const template = await this.loadModel(`assets/3d/nature/${decor.file}.glb`, decor.height);
      const instance = this.cloneInstance(template);
      const angle = (i / ringCount) * Math.PI * 2;
      const r = ringRadius + (Math.random() - 0.5) * 0.8;
      instance.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);
    }

    const grassTemplate = await this.loadModel('assets/3d/nature/grass.glb', 0.3);
    for (let i = 0; i < 18; i++) {
      const instance = this.cloneInstance(grassTemplate);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 4.5;
      instance.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);
    }
  }

  // ---------- Round generation ----------

  private generateRound(): Zoo3DLevelData[] {
    const cfg = DIFFICULTY[this.age];
    const levels: Zoo3DLevelData[] = [];
    for (let i = 0; i < cfg.rounds; i++) {
      levels.push(this.generateOneLevel(cfg, i));
    }
    return levels;
  }

  private generateOneLevel(cfg: DifficultyConfig, index: number): Zoo3DLevelData {
    const numSpecies = randInt(cfg.numSpeciesRange[0], cfg.numSpeciesRange[1]);
    const pickedSpecies = shuffle(ZOO3D_SPECIES).slice(0, numSpecies);
    const targetIdx = randInt(0, numSpecies - 1);

    const entries: Zoo3DRoundEntry[] = pickedSpecies.map((sp, idx) => ({
      speciesId: sp.id,
      count:
        idx === targetIdx
          ? randInt(cfg.targetCountRange[0], cfg.targetCountRange[1])
          : randInt(cfg.distractorCountRange[0], cfg.distractorCountRange[1]),
    }));

    const targetSpeciesId = entries[targetIdx].speciesId;
    const correctCount = entries[targetIdx].count;
    const choices = this.buildChoices(correctCount, cfg.choicesCount);
    const lang = languageManager.getLanguage();
    const voiceText = buildZoo3DVoiceText(lang, targetSpeciesId);

    return { id: `zoo3d_${index}`, targetSpeciesId, entries, choices, voiceText };
  }

  private buildChoices(correct: number, count: number): number[] {
    const set = new Set<number>([correct]);
    let guard = 0;
    while (set.size < count && guard < 50) {
      guard++;
      const candidate = correct + randInt(-2, 2);
      if (candidate >= 1) set.add(candidate);
    }
    return shuffle([...set]);
  }

  private getCorrectCount(level: Zoo3DLevelData): number {
    const entry = level.entries.find((e) => e.speciesId === level.targetSpeciesId);
    return entry ? entry.count : 0;
  }

  // ---------- Round rendering ----------

  /**
   * Places each token using rejection sampling so animals never overlap:
   * every species has its own footprint radius (see Base3DEngine.loadModel),
   * and a candidate spot is only accepted once it clears every already-placed
   * neighbor by (footprint + neighbor's footprint + margin). Falls back to
   * the least-overlapping spot found if the play area gets crowded.
   */
  private computePositions(tokens: string[], templates: Map<string, THREE.Object3D>): { x: number; z: number }[] {
    const maxRadius = this.playRadius;
    const margin = 0.2;

    const footprints = tokens.map((id) => (templates.get(id)?.userData.footprintRadius as number) || 0.4);

    // Place the biggest animals first — seating the largest footprints while
    // the area is still empty packs the crowded (4-6yo) rounds far better
    // than placing in arbitrary order and fighting for the last few gaps.
    const order = tokens.map((_, i) => i).sort((a, b) => footprints[b] - footprints[a]);
    const placed: { x: number; z: number; r: number }[] = new Array(tokens.length);

    order.forEach((idx) => {
      const footprint = footprints[idx];
      let bestPos = { x: 0, z: 0 };
      let bestClearance = -Infinity;

      for (let attempt = 0; attempt < 80; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * maxRadius;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        let clearance = Infinity;
        for (const p of placed) {
          if (!p) continue;
          const gap = Math.hypot(x - p.x, z - p.z) - p.r - footprint - margin;
          clearance = Math.min(clearance, gap);
        }
        if (clearance === Infinity) clearance = 0;

        if (clearance > bestClearance) {
          bestClearance = clearance;
          bestPos = { x, z };
        }
        if (clearance >= 0) break;
      }

      placed[idx] = { x: bestPos.x, z: bestPos.z, r: footprint };
    });

    return placed.map((p) => ({ x: p.x, z: p.z }));
  }

  private clearAnimals() {
    this.animalAgents.forEach((agent) => this.scene.remove(agent.object));
    this.animalAgents = [];
  }

  private async renderCurrentLevel() {
    this.clearAnimals();
    const level = this.levels[this.currentIndex];

    const tokens: string[] = [];
    level.entries.forEach((entry) => {
      for (let i = 0; i < entry.count; i++) tokens.push(entry.speciesId);
    });
    const shuffledTokens = shuffle(tokens);

    const distinctSpecies = Array.from(new Set(shuffledTokens));
    const templates = new Map<string, THREE.Object3D>();
    await Promise.all(
      distinctSpecies.map(async (id) => {
        const info = getZoo3DSpecies(id);
        templates.set(id, await this.loadModel(`assets/3d/animals/${info.file}.glb`, info.targetHeight));
      })
    );

    const positions = this.computePositions(shuffledTokens, templates);
    shuffledTokens.forEach((speciesId, i) => {
      const template = templates.get(speciesId)!;
      const instance = this.cloneInstance(template);
      const pos = positions[i];
      instance.position.set(pos.x, 0, pos.z);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);

      this.animalAgents.push(this.createAnimalAgent(instance));
    });

    this.updateHudForLevel(level);
  }

  /**
   * Wraps a placed instance with idle/walk animation actions + wandering
   * state. Starts idle so the initial (already non-overlapping) layout is
   * visible for a moment before anyone starts wandering off.
   */
  private createAnimalAgent(instance: THREE.Object3D): AnimalAgent {
    const mixer = new THREE.AnimationMixer(instance);

    const idleClip = this.findClip(instance, 'Idle', /hitreact|headlow/i);
    const walkClip = this.findClip(instance, 'Walk');

    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;

    if (idleAction) {
      idleAction.time = Math.random() * idleClip!.duration;
      idleAction.play();
    }

    return {
      object: instance,
      mixer,
      idleAction,
      walkAction,
      radius: (instance.userData.footprintRadius as number) || 0.4,
      speed: 0.45 + Math.random() * 0.35,
      state: 'idle',
      target: { x: instance.position.x, z: instance.position.z },
      idleTimer: 1 + Math.random() * 2.5,
    };
  }

  /**
   * Simple wander AI: each animal idles for a bit, then picks a random spot
   * inside the play circle and walks there. While walking it steers away
   * from any neighbor it gets close to (separation) and a final positional
   * clamp guarantees no two animals ever end up overlapping mid-step.
   */
  private updateAnimalBehavior(dt: number) {
    const arriveThreshold = 0.2;
    const separationRange = 0.35;

    this.animalAgents.forEach((agent) => {
      if (agent.state === 'idle') {
        agent.idleTimer -= dt;
        if (agent.idleTimer <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * this.playRadius;
          agent.target = { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
          this.setAgentState(agent, 'walking');
        }
        return;
      }

      const dx = agent.target.x - agent.object.position.x;
      const dz = agent.target.z - agent.object.position.z;
      const distToTarget = Math.hypot(dx, dz);

      if (distToTarget < arriveThreshold) {
        agent.idleTimer = 1.5 + Math.random() * 3;
        this.setAgentState(agent, 'idle');
        return;
      }

      let dirX = dx / distToTarget;
      let dirZ = dz / distToTarget;

      // Steer away from nearby agents so paths don't cross through them.
      let sepX = 0;
      let sepZ = 0;
      this.animalAgents.forEach((other) => {
        if (other === agent) return;
        const ox = agent.object.position.x - other.object.position.x;
        const oz = agent.object.position.z - other.object.position.z;
        const d = Math.hypot(ox, oz);
        const minDist = agent.radius + other.radius + separationRange;
        if (d > 0.0001 && d < minDist) {
          const push = (minDist - d) / minDist;
          sepX += (ox / d) * push;
          sepZ += (oz / d) * push;
        }
      });

      let moveX = dirX + sepX * 1.8;
      let moveZ = dirZ + sepZ * 1.8;
      const moveLen = Math.hypot(moveX, moveZ) || 1;
      moveX /= moveLen;
      moveZ /= moveLen;

      const step = agent.speed * dt;
      let newX = agent.object.position.x + moveX * step;
      let newZ = agent.object.position.z + moveZ * step;

      // Hard collision resolve: never let the new spot overlap another agent,
      // even if separation steering above wasn't enough to prevent it.
      this.animalAgents.forEach((other) => {
        if (other === agent) return;
        const ox = newX - other.object.position.x;
        const oz = newZ - other.object.position.z;
        const d = Math.hypot(ox, oz);
        const minDist = agent.radius + other.radius + 0.1;
        if (d > 0.0001 && d < minDist) {
          const scale = minDist / d;
          newX = other.object.position.x + ox * scale;
          newZ = other.object.position.z + oz * scale;
        }
      });

      // Stay inside the play circle so no one wanders into the decor ring.
      const distFromCenter = Math.hypot(newX, newZ);
      if (distFromCenter > this.playRadius) {
        const scale = this.playRadius / distFromCenter;
        newX *= scale;
        newZ *= scale;
      }

      agent.object.position.x = newX;
      agent.object.position.z = newZ;

      const facingAngle = Math.atan2(moveX, moveZ);
      agent.object.rotation.y = this.lerpAngle(agent.object.rotation.y, facingAngle, Math.min(1, dt * 6));
    });
  }

  private setAgentState(agent: AnimalAgent, state: AnimalState) {
    if (agent.state === state) return;
    agent.state = state;

    const activate = state === 'walking' ? agent.walkAction : agent.idleAction;
    const deactivate = state === 'walking' ? agent.idleAction : agent.walkAction;

    if (activate) {
      activate.reset().setEffectiveWeight(1).fadeIn(0.3).play();
    }
    if (deactivate) {
      deactivate.fadeOut(0.3);
    }
  }

  private lerpAngle(from: number, to: number, t: number): number {
    let diff = (to - from) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * t;
  }

  // ---------- HUD ----------

  private buildHud() {
    this.injectZooStylesOnce();

    const backBtn = document.createElement('button');
    backBtn.className = 'zoo3d-back-btn';
    backBtn.textContent = '←';
    backBtn.addEventListener('click', () => {
      audioManager.playTap();
      this.onExit();
    });
    this.hud.appendChild(backBtn);

    this.progressRowEl = document.createElement('div');
    this.progressRowEl.className = 'zoo3d-progress';
    this.hud.appendChild(this.progressRowEl);

    const bubble = document.createElement('div');
    bubble.className = 'zoo3d-speech-bubble';
    this.speechTextEl = document.createElement('span');
    bubble.appendChild(this.speechTextEl);

    const speakerBtn = document.createElement('button');
    speakerBtn.className = 'zoo3d-speaker-btn';
    speakerBtn.textContent = '🔊';
    speakerBtn.addEventListener('click', () => {
      const level = this.levels[this.currentIndex];
      if (level) this.speak(level.voiceText);
    });
    bubble.appendChild(speakerBtn);
    this.hud.appendChild(bubble);

    this.choicesRowEl = document.createElement('div');
    this.choicesRowEl.className = 'zoo3d-choices';
    this.hud.appendChild(this.choicesRowEl);
  }

  private updateHudForLevel(level: Zoo3DLevelData) {
    this.speechTextEl.textContent = level.voiceText;
    this.renderProgressDots();
    this.renderChoices(level);
    this.speak(level.voiceText);
  }

  private renderProgressDots() {
    this.progressRowEl.innerHTML = '';
    this.levels.forEach((_, idx) => {
      const dot = document.createElement('span');
      dot.className =
        'zoo3d-dot' + (idx < this.currentIndex ? ' zoo3d-dot-done' : idx === this.currentIndex ? ' zoo3d-dot-active' : '');
      this.progressRowEl.appendChild(dot);
    });
  }

  private renderChoices(level: Zoo3DLevelData) {
    this.choicesRowEl.innerHTML = '';
    level.choices.forEach((value) => {
      const btn = document.createElement('button');
      btn.className = 'zoo3d-choice';
      btn.textContent = String(value);
      btn.addEventListener('click', () => this.onChoiceClick(value, btn, level));
      this.choicesRowEl.appendChild(btn);
    });
  }

  private onChoiceClick(value: number, buttonEl: HTMLButtonElement, level: Zoo3DLevelData) {
    if (this.interactiveLocked) return;

    const isCorrect = value === this.getCorrectCount(level);
    if (isCorrect) {
      this.interactiveLocked = true;
      audioManager.playCorrect();
      parentService.trackCorrect();
      buttonEl.classList.add('zoo3d-choice-correct');

      const rect = buttonEl.getBoundingClientRect();
      const containerRect = this.hud.getBoundingClientRect();
      DomConfetti.burst(this.hud, rect.left - containerRect.left + rect.width / 2, rect.top - containerRect.top + rect.height / 2);

      setTimeout(() => this.advanceRound(), 1000);
    } else {
      audioManager.playIncorrect();
      parentService.trackIncorrect();
      buttonEl.classList.add('zoo3d-choice-shake');
      setTimeout(() => buttonEl.classList.remove('zoo3d-choice-shake'), 400);
      this.speak(level.voiceText);
    }
  }

  private async advanceRound() {
    if (this.currentIndex < this.levels.length - 1) {
      this.currentIndex++;
      this.interactiveLocked = false;
      this.showLoading(true);
      await this.renderCurrentLevel();
      this.showLoading(false);
    } else {
      this.showCompletion();
    }
  }

  private showLoading(show: boolean) {
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

  private showCompletion() {
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
    replayBtn.addEventListener('click', async () => {
      audioManager.playTap();
      overlay.remove();
      this.levels = this.generateRound();
      this.currentIndex = 0;
      this.interactiveLocked = false;
      this.showLoading(true);
      await this.renderCurrentLevel();
      this.showLoading(false);
    });
    card.appendChild(replayBtn);

    const backBtn = document.createElement('button');
    backBtn.className = 'zoo3d-complete-btn';
    backBtn.textContent = TRANSLATIONS[lang].back;
    backBtn.addEventListener('click', () => {
      audioManager.playTap();
      overlay.remove();
      this.onExit();
    });
    card.appendChild(backBtn);

    overlay.appendChild(card);
    this.hud.appendChild(overlay);
  }

  // ---------- Language ----------

  private speak(text: string) {
    audioManager.speak(text, languageManager.getLanguage());
  }

  private onLanguageChange() {
    const lang = languageManager.getLanguage();
    this.levels.forEach((lvl) => {
      lvl.voiceText = buildZoo3DVoiceText(lang, lvl.targetSpeciesId);
    });

    const level = this.levels[this.currentIndex];
    if (level && this.speechTextEl) {
      this.speechTextEl.textContent = level.voiceText;
      this.speak(level.voiceText);
    }
  }

  private injectZooStylesOnce() {
    if (zooStylesInjected) return;
    zooStylesInjected = true;

    const style = document.createElement('style');
    style.id = 'zoo3d-count-styles';
    style.textContent = ZOO3D_COUNT_CSS;
    document.head.appendChild(style);
  }
}

const ZOO3D_COUNT_CSS = `
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

.zoo3d-choices {
  position: absolute;
  bottom: 28px; left: 50%; transform: translateX(-50%);
  display: flex; gap: clamp(10px, 2vw, 20px);
  flex-wrap: wrap;
  justify-content: center;
  max-width: 92vw;
}
.zoo3d-choice {
  width: clamp(56px, 12vw, 88px); height: clamp(56px, 12vw, 88px);
  border-radius: 50%;
  background: #FFB74D;
  border: 4px solid #fff;
  color: #fff;
  font-size: clamp(22px, 4.5vw, 34px);
  font-weight: bold;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  transition: transform 0.15s, background 0.15s;
}
.zoo3d-choice:active { transform: scale(0.92); }
.zoo3d-choice-correct { background: #4CAF50; }
.zoo3d-choice-shake { animation: zoo3d-shake 0.4s; }
@keyframes zoo3d-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
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
