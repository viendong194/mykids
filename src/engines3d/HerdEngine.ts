import * as THREE from 'three';
import { Base3DEngine, type SteppableAgent } from './Base3DEngine';
import { DioramaKit } from './DioramaKit';
import { ZooHudKit } from './ZooHudKit';
import { DomConfetti } from './DomConfetti';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { parentService } from '../services/ParentService';
import { ZOO3D_SPECIES, buildHerdVoiceText, getZoo3DSpecies } from '../data/zoo3d_translations';

export type Zoo3DAgeGroup = '2-3' | '4-6';

interface DifficultyConfig {
  numSpeciesRange: [number, number];
  targetCountRange: [number, number];
  distractorCountRange: [number, number];
  rounds: number;
}

const DIFFICULTY: Record<Zoo3DAgeGroup, DifficultyConfig> = {
  '2-3': { numSpeciesRange: [2, 2], targetCountRange: [2, 3], distractorCountRange: [1, 2], rounds: 5 },
  '4-6': { numSpeciesRange: [2, 3], targetCountRange: [2, 4], distractorCountRange: [1, 3], rounds: 5 },
};

const BUMP_DURATION = 0.35;

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

interface HerdRoundEntry {
  speciesId: string;
  count: number;
}

interface HerdLevelData {
  id: string;
  targetSpeciesId: string;
  entries: HerdRoundEntry[];
  voiceText: string;
}

interface HerdAgent extends SteppableAgent {
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction | null;
  moveAction: THREE.AnimationAction | null;
  idleTimer: number;
  herded: boolean;
  arrived: boolean;
  bumpTimer: number;
  baseScale: number;
}

/**
 * "Lùa thú về chuồng" — several mixed-species animals wander the diorama;
 * the child taps every animal of the asked species (raycasting) to send it
 * walking/galloping to the pen off to one side. Reuses the wander AI +
 * Base3DEngine.stepAgentTowardTarget for both free-roam and directed
 * herding movement.
 */
export class HerdEngine extends Base3DEngine {
  private age: Zoo3DAgeGroup;
  private onExit: () => void;

  private diorama!: DioramaKit;
  private zooHud!: ZooHudKit;
  private unsubscribeLang: () => void;

  private levels: HerdLevelData[] = [];
  private currentIndex = 0;
  private agents: HerdAgent[] = [];
  private herdedCount = 0;

  private readonly wanderRadius = 3.4;
  private readonly worldRadius = 6.5;
  private penCenter = { x: 0, z: 0 };
  private tallyEl!: HTMLDivElement;

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
      'herd'
    );

    this.diorama.setupLighting();
    this.diorama.setupCamera();
    this.buildHud();
    this.diorama.buildDevPanel('🛠 DEV — Lùa thú về chuồng');
    this.zooHud.showLoading(true);

    await this.diorama.buildTerrainGround();
    await this.buildPen();

    this.setupRaycasting(
      () => this.agents.filter((a) => !a.herded && !a.arrived).map((a) => a.object),
      (pickId) => this.onAnimalTap(Number(pickId))
    );

    this.levels = this.generateRound();
    this.currentIndex = 0;
    await this.renderCurrentLevel();

    this.zooHud.showLoading(false);
  }

  protected update(dt: number): void {
    this.diorama.tick(dt, { autoDayNight: true });
    this.agents.forEach((agent) => agent.mixer.update(dt));
    this.updateAgents(dt);
  }

  public destroy(): void {
    this.unsubscribeLang();
    super.destroy();
  }

  // ---------- Pen ----------

  private async buildPen(): Promise<void> {
    const camAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
    const penAngle = camAngle + THREE.MathUtils.degToRad(62);
    const penRadius = 4.2;
    this.penCenter = { x: Math.sin(penAngle) * penRadius, z: Math.cos(penAngle) * penRadius };

    const patchRadius = 1.3;
    const geo = new THREE.CircleGeometry(patchRadius, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfa07a, roughness: 1 });
    const patch = new THREE.Mesh(geo, mat);
    patch.rotation.x = -Math.PI / 2;
    const patchY = this.diorama.getGroundHeight(this.penCenter.x, this.penCenter.z) + 0.01;
    patch.position.set(this.penCenter.x, patchY, this.penCenter.z);
    patch.receiveShadow = true;
    this.scene.add(patch);

    const rockTemplate = await this.loadModel('assets/3d/nature/rock-medium.glb', 0.55);
    const rockCount = 10;
    for (let i = 0; i < rockCount; i++) {
      const instance = this.cloneInstance(rockTemplate);
      this.diorama.enableShadows(instance);
      const angle = (i / rockCount) * Math.PI * 2;
      const x = this.penCenter.x + Math.cos(angle) * patchRadius;
      const z = this.penCenter.z + Math.sin(angle) * patchRadius;
      instance.position.set(x, this.diorama.getGroundHeight(x, z), z);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);
    }
  }

  private pickPenSlot(): { x: number; z: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * 0.7; // stay within the pen patch, clear of the rock ring
    return { x: this.penCenter.x + Math.cos(angle) * dist, z: this.penCenter.z + Math.sin(angle) * dist };
  }

  // ---------- Round generation ----------

  private generateRound(): HerdLevelData[] {
    const cfg = DIFFICULTY[this.age];
    const levels: HerdLevelData[] = [];
    for (let i = 0; i < cfg.rounds; i++) levels.push(this.generateOneLevel(cfg, i));
    return levels;
  }

  private generateOneLevel(cfg: DifficultyConfig, index: number): HerdLevelData {
    const numSpecies = randInt(cfg.numSpeciesRange[0], cfg.numSpeciesRange[1]);
    const picked = shuffle(ZOO3D_SPECIES).slice(0, numSpecies);
    const targetIdx = randInt(0, numSpecies - 1);

    const entries: HerdRoundEntry[] = picked.map((sp, idx) => ({
      speciesId: sp.id,
      count:
        idx === targetIdx
          ? randInt(cfg.targetCountRange[0], cfg.targetCountRange[1])
          : randInt(cfg.distractorCountRange[0], cfg.distractorCountRange[1]),
    }));

    const targetSpeciesId = entries[targetIdx].speciesId;
    const lang = languageManager.getLanguage();
    const voiceText = buildHerdVoiceText(lang, targetSpeciesId);

    return { id: `herd_${index}`, targetSpeciesId, entries, voiceText };
  }

  private computeWanderPositions(tokens: string[], templates: Map<string, THREE.Object3D>): { x: number; z: number }[] {
    const margin = 0.2;
    const footprints = tokens.map((id) => (templates.get(id)?.userData.footprintRadius as number) || 0.4);
    const order = tokens.map((_, i) => i).sort((a, b) => footprints[b] - footprints[a]);
    const placed: { x: number; z: number; r: number }[] = new Array(tokens.length);

    order.forEach((idx) => {
      const footprint = footprints[idx];
      let bestPos = { x: 0, z: 0 };
      let bestClearance = -Infinity;

      for (let attempt = 0; attempt < 80; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * this.wanderRadius;
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

  private clearAgents() {
    this.agents.forEach((agent) => this.scene.remove(agent.object));
    this.agents = [];
  }

  private async renderCurrentLevel() {
    this.clearAgents();
    this.herdedCount = 0;
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

    const positions = this.computeWanderPositions(shuffledTokens, templates);
    shuffledTokens.forEach((speciesId, i) => {
      const template = templates.get(speciesId)!;
      const instance = this.cloneInstance(template);
      this.diorama.enableShadows(instance);

      const pos = positions[i];
      instance.position.set(pos.x, this.diorama.getGroundHeight(pos.x, pos.z), pos.z);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);
      this.setPickable(instance, String(this.agents.length));

      this.agents.push(this.createAgent(instance, speciesId));
    });

    const targetTotal = level.entries.find((e) => e.speciesId === level.targetSpeciesId)?.count ?? 0;
    this.updateTallyHud(0, targetTotal);

    this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
    this.zooHud.setProgress(this.levels.length, this.currentIndex);
    this.speak(level.voiceText);
  }

  private createAgent(instance: THREE.Object3D, speciesId: string): HerdAgent {
    const mixer = new THREE.AnimationMixer(instance);
    const idleClip = this.findClip(instance, 'Idle', /hitreact|headlow/i);
    const moveClip = this.findClip(instance, 'Gallop') || this.findClip(instance, 'Walk');

    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const moveAction = moveClip ? mixer.clipAction(moveClip) : null;
    if (idleAction) {
      idleAction.time = Math.random() * idleClip!.duration;
      idleAction.play();
    }

    return {
      object: instance,
      mixer,
      idleAction,
      moveAction,
      radius: (instance.userData.footprintRadius as number) || 0.4,
      speed: 0.5 + Math.random() * 0.35,
      speciesId,
      state: 'idle',
      target: { x: instance.position.x, z: instance.position.z },
      idleTimer: 1 + Math.random() * 2.5,
      herded: false,
      arrived: false,
      bumpTimer: 0,
      baseScale: instance.scale.x,
    };
  }

  // ---------- Movement ----------

  private updateAgents(dt: number) {
    // Arrived agents are removed from the scene but stay in `this.agents`
    // (their tally/round-completion bookkeeping still needs them) — exclude
    // them from steering/collision math or they'd permanently block whoever
    // approaches their old spot.
    const activeAgents = this.agents.filter((a) => !a.arrived);

    this.agents.forEach((agent) => {
      if (agent.bumpTimer > 0) {
        agent.bumpTimer = Math.max(agent.bumpTimer - dt, 0);
        const t = agent.bumpTimer / BUMP_DURATION;
        const pulse = 1 + Math.sin(t * Math.PI) * 0.18;
        agent.object.scale.setScalar(agent.baseScale * pulse);
      }

      if (agent.arrived) return;

      if (agent.state === 'idle') {
        if (agent.herded) return; // shouldn't happen, but guard just in case
        agent.idleTimer -= dt;
        if (agent.idleTimer <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * this.wanderRadius;
          agent.target = { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
          this.setAgentWalking(agent);
        }
        return;
      }

      const playRadius = agent.herded ? this.worldRadius : this.wanderRadius;
      const result = this.stepAgentTowardTarget(agent, activeAgents, dt, {
        playRadius,
        getGroundHeight: (x, z) => this.diorama.getGroundHeight(x, z),
        arriveThreshold: agent.herded ? 0.35 : 0.2,
        // Once herded, ignore far-off flockmates (alignment/cohesion would pull it
        // back toward the still-wandering herd) — only true collision avoidance matters.
        flockRange: agent.herded ? 0.9 : 2.2,
        // The pen is meant to be cozy — a wide separation buffer would make
        // several herded animals endlessly push each other away from their
        // slots instead of settling down together.
        separationRange: agent.herded ? 0.1 : 0.55,
      });

      if (result.arrived) {
        if (agent.herded) {
          agent.arrived = true;
          this.onAnimalArrivedAtPen(agent);
        } else {
          agent.idleTimer = 1.5 + Math.random() * 3;
          this.setAgentIdle(agent);
        }
      } else {
        agent.object.rotation.y = this.lerpAngle(agent.object.rotation.y, result.facingAngle, Math.min(1, dt * 6));
      }
    });
  }

  private setAgentWalking(agent: HerdAgent) {
    if (agent.state === 'walking') return;
    agent.state = 'walking';
    agent.idleAction?.fadeOut(0.3);
    if (agent.moveAction) agent.moveAction.reset().setEffectiveWeight(1).fadeIn(0.3).play();
  }

  private setAgentIdle(agent: HerdAgent) {
    if (agent.state === 'idle') return;
    agent.state = 'idle';
    agent.moveAction?.fadeOut(0.3);
    if (agent.idleAction) agent.idleAction.reset().setEffectiveWeight(1).fadeIn(0.3).play();
  }

  // ---------- Interaction ----------

  private onAnimalTap(pickId: number) {
    if (this.zooHud.isLoading()) return;
    const agent = this.agents[pickId];
    if (!agent || agent.herded || agent.arrived) return;

    const level = this.levels[this.currentIndex];
    if (agent.speciesId === level.targetSpeciesId) {
      audioManager.playCorrect();
      parentService.trackCorrect();
      agent.herded = true;
      agent.speed *= 1.9; // gallop home noticeably faster than the idle wander speed
      // Give each herded animal its own spot inside the pen — if several head
      // for the exact same point, mutual separation keeps pushing them apart
      // and none of them ever gets close enough to register as "arrived".
      agent.target = this.pickPenSlot();
      this.setAgentWalking(agent);
    } else {
      audioManager.playIncorrect();
      parentService.trackIncorrect();
      agent.bumpTimer = BUMP_DURATION;
    }
  }

  private onAnimalArrivedAtPen(agent: HerdAgent) {
    this.herdedCount++;
    this.scene.remove(agent.object);

    const level = this.levels[this.currentIndex];
    const targetTotal = level.entries.find((e) => e.speciesId === level.targetSpeciesId)?.count ?? 0;
    this.updateTallyHud(this.herdedCount, targetTotal);

    const burstPos = new THREE.Vector3(this.penCenter.x, this.diorama.getGroundHeight(this.penCenter.x, this.penCenter.z) + 0.6, this.penCenter.z);
    const screen = this.worldToScreen(burstPos);
    DomConfetti.burst(this.hud, screen.x, screen.y);

    if (this.herdedCount >= targetTotal) {
      setTimeout(() => this.advanceRound(), 700);
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

  // ---------- HUD ----------

  private buildHud() {
    this.injectHerdStylesOnce();
    this.zooHud = new ZooHudKit(this.hud, () => this.onExit());

    this.tallyEl = document.createElement('div');
    this.tallyEl.className = 'zoo3d-herd-tally';
    this.hud.appendChild(this.tallyEl);
  }

  private updateTallyHud(done: number, total: number) {
    const lang = languageManager.getLanguage();
    const label = lang === 'vi' ? 'Đã lùa' : lang === 'en' ? 'Herded' : lang === 'zh' ? '已赶回' : 'つれてきた';
    this.tallyEl.textContent = `${label}: ${done}/${total}`;
  }

  // ---------- Language ----------

  private speak(text: string) {
    audioManager.speak(text, languageManager.getLanguage());
  }

  private onLanguageChange() {
    const lang = languageManager.getLanguage();
    this.levels.forEach((lvl) => {
      lvl.voiceText = buildHerdVoiceText(lang, lvl.targetSpeciesId);
    });

    const level = this.levels[this.currentIndex];
    if (level && this.zooHud) {
      this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
      this.speak(level.voiceText);
    }

    const targetTotal = level ? level.entries.find((e) => e.speciesId === level.targetSpeciesId)?.count ?? 0 : 0;
    this.updateTallyHud(this.herdedCount, targetTotal);
  }

  private injectHerdStylesOnce() {
    if (herdStylesInjected) return;
    herdStylesInjected = true;

    const style = document.createElement('style');
    style.id = 'zoo3d-herd-styles';
    style.textContent = ZOO3D_HERD_CSS;
    document.head.appendChild(style);
  }
}

let herdStylesInjected = false;

const ZOO3D_HERD_CSS = `
.zoo3d-herd-tally {
  position: absolute;
  top: 128px; left: 50%; transform: translateX(-50%);
  background: #fff;
  border-radius: 18px;
  padding: 8px 20px;
  font-size: 18px;
  font-weight: bold;
  color: #00796B;
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
}
`;
