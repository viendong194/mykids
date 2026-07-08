import * as THREE from 'three';
import { Base3DEngine } from './Base3DEngine';
import { DioramaKit } from './DioramaKit';
import { ZooHudKit } from './ZooHudKit';
import { DomConfetti } from './DomConfetti';
import { computeFlockingSteering } from './Steering';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { parentService } from '../services/ParentService';
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
  speciesId: string;
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

  private diorama!: DioramaKit;
  private zooHud!: ZooHudKit;

  private unsubscribeLang: () => void;

  private choicesRowEl!: HTMLDivElement;

  constructor(age: Zoo3DAgeGroup, onExit: () => void) {
    super();
    this.age = age;
    this.onExit = onExit;
    this.unsubscribeLang = languageManager.onChange(() => this.onLanguageChange());
  }

  protected async build(): Promise<void> {
    this.diorama = new DioramaKit(
      this.renderer,
      this.scene,
      this.camera,
      this.hud,
      (url, height) => this.loadModel(url, height),
      (template) => this.cloneInstance(template)
    );

    this.diorama.setupLighting();
    this.diorama.setupCamera();
    this.buildHud();
    this.diorama.buildDevPanel('🛠 DEV — Đếm thú');
    this.zooHud.showLoading(true);

    await this.diorama.buildTerrainGround({ decor: NATURE_DECOR });

    this.levels = this.generateRound();
    this.currentIndex = 0;
    await this.renderCurrentLevel();

    this.zooHud.showLoading(false);
  }

  protected update(dt: number): void {
    this.diorama.tick(dt, { autoDayNight: true });

    this.animalAgents.forEach((agent) => agent.mixer.update(dt));
    this.updateAnimalBehavior(dt);
  }

  public destroy(): void {
    this.unsubscribeLang();
    super.destroy();
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
      this.diorama.enableShadows(instance);

      const pos = positions[i];
      instance.position.set(pos.x, this.diorama.getGroundHeight(pos.x, pos.z), pos.z);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);

      this.animalAgents.push(this.createAnimalAgent(instance, speciesId));
    });

    this.updateHudForLevel(level);
  }

  /**
   * Wraps a placed instance with idle/walk animation actions + wandering
   * state. Starts idle so the initial (already non-overlapping) layout is
   * visible for a moment before anyone starts wandering off.
   */
  private createAnimalAgent(instance: THREE.Object3D, speciesId: string): AnimalAgent {
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
      speciesId,
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
    const separationRange = 0.55;
    const flockRange = 2.2;

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

      // Compute flocking steering force using the utility function
      const move = computeFlockingSteering(agent, this.animalAgents, flockRange, separationRange);

      const step = agent.speed * dt;
      let newX = agent.object.position.x + move.x * step;
      let newZ = agent.object.position.z + move.z * step;

      // Hard collision resolve
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

      // Stay inside play circle
      const distFromCenter = Math.hypot(newX, newZ);
      if (distFromCenter > this.playRadius) {
        const scale = this.playRadius / distFromCenter;
        newX *= scale;
        newZ *= scale;
      }

      agent.object.position.x = newX;
      agent.object.position.z = newZ;
      agent.object.position.y = this.diorama.getGroundHeight(newX, newZ);

      const facingAngle = Math.atan2(move.x, move.z);
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
    this.zooHud = new ZooHudKit(this.hud, () => this.onExit());

    this.choicesRowEl = document.createElement('div');
    this.choicesRowEl.className = 'zoo3d-choices';
    this.hud.appendChild(this.choicesRowEl);
  }

  private updateHudForLevel(level: Zoo3DLevelData) {
    this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
    this.zooHud.setProgress(this.levels.length, this.currentIndex);
    this.renderChoices(level);
    this.speak(level.voiceText);
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
      this.zooHud.showLoading(true);
      await this.renderCurrentLevel();
      this.zooHud.showLoading(false);
    } else {
      this.zooHud.showCompletion({
        onReplay: async () => {
          this.levels = this.generateRound();
          this.currentIndex = 0;
          this.interactiveLocked = false;
          this.zooHud.showLoading(true);
          await this.renderCurrentLevel();
          this.zooHud.showLoading(false);
        },
        onBack: () => this.onExit(),
      });
    }
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
    if (level && this.zooHud) {
      this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
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
`;
