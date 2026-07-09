import * as THREE from 'three';
import { Base3DEngine } from './Base3DEngine';
import { DioramaKit } from './DioramaKit';
import { ZooHudKit } from './ZooHudKit';
import { DomConfetti } from './DomConfetti';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { parentService } from '../services/ParentService';
import { ZOO3D_SPECIES, buildDayNightVoiceText, getZoo3DSpecies } from '../data/zoo3d_translations';
import type { SteeringAgent } from './Steering';

export type Zoo3DAgeGroup = '2-3' | '4-6';

interface DifficultyConfig {
  animalCount: number;
  rounds: number;
}

const DIFFICULTY: Record<Zoo3DAgeGroup, DifficultyConfig> = {
  '2-3': { animalCount: 3, rounds: 5 },
  '4-6': { animalCount: 5, rounds: 5 },
};

const BUMP_DURATION = 0.35;
const PLAY_RADIUS = 3.0;

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

interface DayNightLevelData {
  id: string;
  isNight: boolean;
  speciesIds: string[];
  targetIdx: number;
  voiceText: string;
}

interface DayNightAgent {
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction | null;
  headlowAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  isSleeping: boolean;
  zzzEl: HTMLDivElement | null;
  bumpTimer: number;
  baseScale: number;
  state: 'idle' | 'walking';
  target: { x: number; z: number };
  idleTimer: number;
  speed: number;
  radius: number;
  speciesId: string;
}

/**
 * "Ngày và đêm" — an odd-one-out game. Every round, all animals but one
 * share the same behavior (asleep, frozen pose + floating "zzz"; or awake,
 * playing their idle loop) and the child taps the one that's different.
 * Alternates each round between "find who's still awake" (night) and
 * "find who's still asleep" (day), driving DioramaKit's day/night blend
 * from round logic instead of its ambient auto-cycle.
 */
export class DayNightEngine extends Base3DEngine {
  private age: Zoo3DAgeGroup;
  private onExit: () => void;

  private diorama!: DioramaKit;
  private zooHud!: ZooHudKit;
  private unsubscribeLang: () => void;

  private levels: DayNightLevelData[] = [];
  private currentIndex = 0;
  private agents: DayNightAgent[] = [];
  private interactionLocked = false;

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
      (template) => this.cloneInstance(template),
      'daynight'
    );

    this.diorama.setupLighting();
    this.diorama.setupCamera();
    this.buildHud();
    this.diorama.buildDevPanel('🛠 DEV — Ngày và đêm');
    this.zooHud.showLoading(true);

    await this.diorama.buildTerrainGround();

    this.setupRaycasting(
      () => this.agents.map((a) => a.object),
      (pickId) => this.onAnimalTap(Number(pickId))
    );

    this.levels = this.generateRound();
    this.currentIndex = 0;
    await this.renderCurrentLevel();

    this.zooHud.showLoading(false);
  }

  protected update(dt: number): void {
    this.diorama.tick(dt, { autoDayNight: false });

    this.agents.forEach((agent) => {
      agent.mixer.update(dt);

      if (agent.bumpTimer > 0) {
        agent.bumpTimer = Math.max(agent.bumpTimer - dt, 0);
        const t = agent.bumpTimer / BUMP_DURATION;
        const pulse = 1 + Math.sin(t * Math.PI) * 0.18;
        agent.object.scale.setScalar(agent.baseScale * pulse);
      }

      if (agent.zzzEl) {
        const headPos = agent.object.position.clone();
        headPos.y += 0.55;
        const screen = this.worldToScreen(headPos);
        agent.zzzEl.style.left = `${screen.x}px`;
        agent.zzzEl.style.top = `${screen.y}px`;
      }

      // Wander AI for awake animals
      if (!agent.isSleeping && !this.interactionLocked) {
        if (agent.state === 'idle') {
          agent.idleTimer -= dt;
          if (agent.idleTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * PLAY_RADIUS;
            agent.target = { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
            this.setAgentWalking(agent);
          }
        } else {
          const activeAgents = this.agents as SteeringAgent[];
          const result = this.stepAgentTowardTarget(agent, activeAgents, dt, {
            playRadius: PLAY_RADIUS,
            getGroundHeight: (x, z) => this.diorama.getGroundHeight(x, z),
            arriveThreshold: 0.25,
            flockRange: 2.0,
            separationRange: 0.55,
          });

          if (result.arrived) {
            agent.idleTimer = 1.5 + Math.random() * 3.5;
            this.setAgentIdle(agent);
          } else {
            agent.object.rotation.y = this.lerpAngle(agent.object.rotation.y, result.facingAngle, Math.min(1, dt * 6));
          }
        }
      }
    });
  }

  public destroy(): void {
    this.unsubscribeLang();
    super.destroy();
  }

  // ---------- Round generation ----------

  private generateRound(): DayNightLevelData[] {
    const cfg = DIFFICULTY[this.age];
    const levels: DayNightLevelData[] = [];
    for (let i = 0; i < cfg.rounds; i++) levels.push(this.generateOneLevel(cfg, i));
    return levels;
  }

  private generateOneLevel(cfg: DifficultyConfig, index: number): DayNightLevelData {
    const isNight = index % 2 === 1;
    const speciesIds = shuffle(ZOO3D_SPECIES).slice(0, cfg.animalCount).map((s) => s.id);
    const targetIdx = randInt(0, speciesIds.length - 1);
    const lang = languageManager.getLanguage();
    const voiceText = buildDayNightVoiceText(lang, isNight ? 'findAwake' : 'findAsleep');
    return { id: `daynight_${index}`, isNight, speciesIds, targetIdx, voiceText };
  }

  private computePositions(count: number): { x: number; z: number }[] {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.6)));
    const spacing = 1.4;
    const offset = (cols - 1) / 2;
    const cells: { x: number; z: number }[] = [];
    for (let r = 0; r < cols; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ x: (c - offset) * spacing, z: (r - offset) * spacing });
      }
    }
    return shuffle(cells)
      .slice(0, count)
      .map((cell) => ({
        x: THREE.MathUtils.clamp(cell.x + (Math.random() - 0.5) * 0.3, -PLAY_RADIUS, PLAY_RADIUS),
        z: THREE.MathUtils.clamp(cell.z + (Math.random() - 0.5) * 0.3, -PLAY_RADIUS, PLAY_RADIUS),
      }));
  }

  private clearAgents() {
    this.agents.forEach((agent) => {
      this.scene.remove(agent.object);
      agent.zzzEl?.remove();
    });
    this.agents = [];
  }

  private async renderCurrentLevel() {
    this.clearAgents();
    this.interactionLocked = false;
    const level = this.levels[this.currentIndex];

    this.diorama.applyTimeOfDay(level.isNight ? 1 : 0);

    const distinctSpecies = Array.from(new Set(level.speciesIds));
    const templates = new Map<string, THREE.Object3D>();
    await Promise.all(
      distinctSpecies.map(async (id) => {
        const info = getZoo3DSpecies(id);
        templates.set(id, await this.loadModel(`assets/3d/animals/${info.file}.glb`, info.targetHeight));
      })
    );

    const positions = this.computePositions(level.speciesIds.length);
    level.speciesIds.forEach((speciesId, i) => {
      const template = templates.get(speciesId)!;
      const instance = this.cloneInstance(template);
      this.diorama.enableShadows(instance);

      const pos = positions[i];
      instance.position.set(pos.x, this.diorama.getGroundHeight(pos.x, pos.z), pos.z);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);
      this.setPickable(instance, String(i));

      const isSleeping = level.isNight ? i !== level.targetIdx : i === level.targetIdx;
      this.agents.push(this.createAgent(instance, isSleeping, speciesId));
    });

    this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
    this.zooHud.setProgress(this.levels.length, this.currentIndex);
    this.speak(level.voiceText);
  }

  private createAgent(instance: THREE.Object3D, isSleeping: boolean, speciesId: string): DayNightAgent {
    const mixer = new THREE.AnimationMixer(instance);
    const idleClip = this.findClip(instance, 'Idle', /hitreact|headlow/i);
    const headlowClip = this.findClip(instance, 'Headlow') || idleClip;
    const walkClip = this.findClip(instance, 'Walk');

    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const headlowAction = headlowClip ? mixer.clipAction(headlowClip) : null;
    const walkAction = walkClip ? mixer.clipAction(walkClip) : null;

    let zzzEl: HTMLDivElement | null = null;
    let state: 'idle' | 'walking' = 'idle';
    let target = { x: instance.position.x, z: instance.position.z };
    let idleTimer = 1 + Math.random() * 2.5;

    if (isSleeping) {
      if (headlowAction) {
        headlowAction.reset().setEffectiveWeight(1).fadeIn(0.2).play();
        headlowAction.timeScale = 0.55;
      } else if (idleAction) {
        idleAction.reset().setEffectiveWeight(1).fadeIn(0.2).play();
        idleAction.timeScale = 0.55;
      }

      zzzEl = document.createElement('div');
      zzzEl.className = 'zoo3d-zzz';
      zzzEl.textContent = '💤';
      this.hud.appendChild(zzzEl);
    } else {
      state = 'walking';
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * PLAY_RADIUS;
      target = { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };

      if (walkAction) {
        walkAction.time = Math.random() * walkClip!.duration;
        walkAction.play();
      } else if (idleAction) {
        idleAction.play();
      }
    }

    return {
      object: instance,
      mixer,
      idleAction,
      headlowAction,
      walkAction,
      isSleeping,
      zzzEl,
      bumpTimer: 0,
      baseScale: instance.scale.x,
      state,
      target,
      idleTimer,
      speed: 0.45 + Math.random() * 0.35,
      radius: 0.2,
      speciesId,
    };
  }

  private setAgentWalking(agent: DayNightAgent) {
    if (agent.state === 'walking') return;
    agent.state = 'walking';
    agent.idleAction?.fadeOut(0.3);
    if (agent.walkAction) {
      agent.walkAction.reset().setEffectiveWeight(1).fadeIn(0.3).play();
    } else {
      agent.idleAction?.reset().setEffectiveWeight(1).fadeIn(0.3).play();
    }
  }

  private setAgentIdle(agent: DayNightAgent) {
    if (agent.state === 'idle') return;
    agent.state = 'idle';
    agent.walkAction?.fadeOut(0.3);
    if (agent.idleAction) {
      agent.idleAction.reset().setEffectiveWeight(1).fadeIn(0.3).play();
    }
  }

  // ---------- Interaction ----------

  private onAnimalTap(pickId: number) {
    if (this.interactionLocked || this.zooHud.isLoading()) return;
    const agent = this.agents[pickId];
    if (!agent) return;

    const level = this.levels[this.currentIndex];
    if (pickId === level.targetIdx) {
      this.interactionLocked = true;
      audioManager.playCorrect();
      parentService.trackCorrect();

      const burstPos = agent.object.position.clone();
      burstPos.y += 0.6;
      const screen = this.worldToScreen(burstPos);
      DomConfetti.burst(this.hud, screen.x, screen.y);

      setTimeout(() => this.advanceRound(), 1200);
    } else {
      audioManager.playIncorrect();
      parentService.trackIncorrect();
      agent.bumpTimer = BUMP_DURATION;
      this.speak(level.voiceText);
    }
  }

  private async advanceRound() {
    if (this.currentIndex < this.levels.length - 1) {
      this.currentIndex++;
      this.zooHud.showLoading(true);
      await this.renderCurrentLevel();
      this.zooHud.showLoading(false);
    } else {
      this.zooHud.showCompletion({
        onReplay: async () => {
          this.levels = this.generateRound();
          this.currentIndex = 0;
          this.zooHud.showLoading(true);
          await this.renderCurrentLevel();
          this.zooHud.showLoading(false);
        },
        onBack: () => this.onExit(),
      });
    }
  }

  private buildHud() {
    this.injectDayNightStylesOnce();
    this.zooHud = new ZooHudKit(this.hud, () => this.onExit());
  }

  // ---------- Language ----------

  private speak(text: string) {
    audioManager.speak(text, languageManager.getLanguage());
  }

  private onLanguageChange() {
    const lang = languageManager.getLanguage();
    this.levels.forEach((lvl) => {
      lvl.voiceText = buildDayNightVoiceText(lang, lvl.isNight ? 'findAwake' : 'findAsleep');
    });

    const level = this.levels[this.currentIndex];
    if (level && this.zooHud) {
      this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
      this.speak(level.voiceText);
    }
  }

  private injectDayNightStylesOnce() {
    if (dayNightStylesInjected) return;
    dayNightStylesInjected = true;

    const style = document.createElement('style');
    style.id = 'zoo3d-daynight-styles';
    style.textContent = ZOO3D_DAYNIGHT_CSS;
    document.head.appendChild(style);
  }
}

let dayNightStylesInjected = false;

const ZOO3D_DAYNIGHT_CSS = `
.zoo3d-zzz {
  position: absolute;
  transform: translate(-50%, -100%);
  font-size: 28px;
  pointer-events: none;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));
}
`;
