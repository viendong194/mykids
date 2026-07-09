import * as THREE from 'three';
import { Base3DEngine } from './Base3DEngine';
import { DioramaKit } from './DioramaKit';
import { ZooHudKit } from './ZooHudKit';
import { DomConfetti } from './DomConfetti';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { parentService } from '../services/ParentService';
import { ZOO3D_SPECIES, buildHideSeekVoiceText, getZoo3DSpecies } from '../data/zoo3d_translations';

export type Zoo3DAgeGroup = '2-3' | '4-6';

interface DifficultyConfig {
  spotCount: number;
  rounds: number;
}

const DIFFICULTY: Record<Zoo3DAgeGroup, DifficultyConfig> = {
  '2-3': { spotCount: 3, rounds: 5 },
  '4-6': { spotCount: 5, rounds: 5 },
};

// Every hiding spot uses a TALL prop (never a short bush/mushroom) so any
// species — big or small — is plausibly hidden regardless of which spot it
// gets assigned to each round (species↔spot pairing changes every round).
const TALL_PROPS: { file: string; height: number }[] = [
  { file: 'tree', height: 2.4 },
  { file: 'pine', height: 2.6 },
  { file: 'twisted-tree', height: 2.2 },
];

const AMBIENT_DECOR: { file: string; height: number }[] = [
  { file: 'tree', height: 2.4 },
  { file: 'pine', height: 2.6 },
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

interface HideSeekLevelData {
  id: string;
  targetSpeciesId: string;
  spotSpecies: string[]; // index-aligned with `spots`
  voiceText: string;
}

type SpotState = 'hidden' | 'peeking' | 'revealing' | 'revealed';

interface HideSpot {
  index: number;
  propObject: THREE.Object3D;
  hiddenPos: THREE.Vector3;
  revealedPos: THREE.Vector3;
  speciesId: string;
  animalObject: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  state: SpotState;
  animT: number;
}

/**
 * "Trốn tìm thú" — hide-and-seek. Several animals hide behind tall props
 * around the diorama; the child taps the prop they think the asked species
 * is hiding behind. Uses Base3DEngine's raycasting (tap-on-3D-object)
 * instead of HTML answer buttons.
 */
export class HideSeekEngine extends Base3DEngine {
  private age: Zoo3DAgeGroup;
  private onExit: () => void;

  private diorama!: DioramaKit;
  private zooHud!: ZooHudKit;
  private unsubscribeLang: () => void;

  private levels: HideSeekLevelData[] = [];
  private currentIndex = 0;
  private spots: HideSpot[] = [];
  private interactiveLocked = false;

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
      'hideseek'
    );

    this.diorama.setupLighting();
    this.diorama.setupCamera();
    this.buildHud();
    this.diorama.buildDevPanel('🛠 DEV — Trốn tìm thú');
    this.zooHud.showLoading(true);

    await this.diorama.buildTerrainGround({ decor: AMBIENT_DECOR, decorRingCount: 10, grassCount: 16, decorRingRadius: 6.2 });

    const cfg = DIFFICULTY[this.age];
    await this.buildHideSpots(cfg.spotCount);

    this.levels = this.generateRound();
    this.currentIndex = 0;
    await this.renderCurrentLevel();

    this.zooHud.showLoading(false);
  }

  protected update(dt: number): void {
    this.diorama.tick(dt, { autoDayNight: true });

    this.spots.forEach((spot) => {
      spot.mixer?.update(dt);
      if (!spot.animalObject) return;

      if (spot.state === 'peeking') {
        spot.animT += dt / 1.0;
        if (spot.animT >= 1) {
          spot.animT = 0;
          spot.state = 'hidden';
          spot.animalObject.position.copy(spot.hiddenPos);
        } else {
          const ease = Math.sin(spot.animT * Math.PI) * 0.55;
          spot.animalObject.position.lerpVectors(spot.hiddenPos, spot.revealedPos, ease);
        }
      } else if (spot.state === 'revealing') {
        spot.animT += dt / 0.9;
        if (spot.animT >= 1) {
          spot.animT = 1;
          spot.state = 'revealed';
          spot.animalObject.position.copy(spot.revealedPos);
        } else {
          spot.animalObject.position.lerpVectors(spot.hiddenPos, spot.revealedPos, spot.animT);
        }
      }
    });
  }

  public destroy(): void {
    this.unsubscribeLang();
    super.destroy();
  }

  // ---------- Hiding spots (built once; only the species per spot changes each round) ----------

  private async buildHideSpots(count: number): Promise<void> {
    const camAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
    const spreadDeg = 55;
    const radius = 3.0;

    this.spots = [];
    for (let i = 0; i < count; i++) {
      const propSpec = TALL_PROPS[i % TALL_PROPS.length];
      const template = await this.loadModel(`assets/3d/nature/${propSpec.file}.glb`, propSpec.height);
      const propObject = this.cloneInstance(template);
      this.diorama.enableShadows(propObject);

      const angleDeg = count > 1 ? (i - (count - 1) / 2) * (spreadDeg / (count - 1)) : 0;
      const angle = camAngle + THREE.MathUtils.degToRad(angleDeg);
      const propX = Math.sin(angle) * radius;
      const propZ = Math.cos(angle) * radius;
      const propY = this.diorama.getGroundHeight(propX, propZ);
      propObject.position.set(propX, propY, propZ);
      propObject.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(propObject);
      this.setPickable(propObject, String(i));

      const toCamX = this.camera.position.x - propX;
      const toCamZ = this.camera.position.z - propZ;
      const toCamLen = Math.hypot(toCamX, toCamZ) || 1;
      const dirX = toCamX / toCamLen;
      const dirZ = toCamZ / toCamLen;
      const sideX = -dirZ;
      const sideZ = dirX;
      const sign = i % 2 === 0 ? 1 : -1;

      const footprint = (propObject.userData.footprintRadius as number) || 0.6;
      const hideOffset = footprint * 0.5;
      const revealOffset = footprint * 0.9;

      const hiddenX = propX - dirX * hideOffset;
      const hiddenZ = propZ - dirZ * hideOffset;
      const hiddenPos = new THREE.Vector3(hiddenX, this.diorama.getGroundHeight(hiddenX, hiddenZ), hiddenZ);

      const revealedX = propX + sideX * sign * revealOffset + dirX * 0.15;
      const revealedZ = propZ + sideZ * sign * revealOffset + dirZ * 0.15;
      const revealedPos = new THREE.Vector3(revealedX, this.diorama.getGroundHeight(revealedX, revealedZ), revealedZ);

      this.spots.push({
        index: i,
        propObject,
        hiddenPos,
        revealedPos,
        speciesId: '',
        animalObject: null,
        mixer: null,
        state: 'hidden',
        animT: 0,
      });
    }

    this.setupRaycasting(
      () => this.spots.map((s) => s.propObject),
      (pickId) => this.onSpotTap(Number(pickId))
    );
  }

  // ---------- Round generation ----------

  private generateRound(): HideSeekLevelData[] {
    const cfg = DIFFICULTY[this.age];
    const levels: HideSeekLevelData[] = [];
    for (let i = 0; i < cfg.rounds; i++) levels.push(this.generateOneLevel(cfg, i));
    return levels;
  }

  private generateOneLevel(cfg: DifficultyConfig, index: number): HideSeekLevelData {
    const spotSpecies = shuffle(ZOO3D_SPECIES).slice(0, cfg.spotCount).map((s) => s.id);
    const targetSpeciesId = spotSpecies[randInt(0, spotSpecies.length - 1)];
    const lang = languageManager.getLanguage();
    const voiceText = buildHideSeekVoiceText(lang, targetSpeciesId);
    return { id: `hideseek_${index}`, targetSpeciesId, spotSpecies, voiceText };
  }

  private async renderCurrentLevel() {
    const level = this.levels[this.currentIndex];

    const distinctSpecies = Array.from(new Set(level.spotSpecies));
    const templates = new Map<string, THREE.Object3D>();
    await Promise.all(
      distinctSpecies.map(async (id) => {
        const info = getZoo3DSpecies(id);
        templates.set(id, await this.loadModel(`assets/3d/animals/${info.file}.glb`, info.targetHeight));
      })
    );

    this.spots.forEach((spot, i) => {
      if (spot.animalObject) {
        this.scene.remove(spot.animalObject);
      }

      const speciesId = level.spotSpecies[i];
      const template = templates.get(speciesId)!;
      const instance = this.cloneInstance(template);
      this.diorama.enableShadows(instance);
      instance.position.copy(spot.hiddenPos);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);

      const mixer = new THREE.AnimationMixer(instance);
      const idleClip = this.findClip(instance, 'Idle', /hitreact|headlow/i);
      if (idleClip) {
        const action = mixer.clipAction(idleClip);
        action.time = Math.random() * idleClip.duration;
        action.play();
      }

      spot.speciesId = speciesId;
      spot.animalObject = instance;
      spot.mixer = mixer;
      spot.state = 'hidden';
      spot.animT = 0;
    });

    this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
    this.zooHud.setProgress(this.levels.length, this.currentIndex);
    this.speak(level.voiceText);
  }

  // ---------- Interaction ----------

  private onSpotTap(index: number) {
    if (this.interactiveLocked || this.zooHud.isLoading()) return;
    const spot = this.spots[index];
    if (!spot || spot.state !== 'hidden') return;

    const level = this.levels[this.currentIndex];
    if (spot.speciesId === level.targetSpeciesId) {
      this.interactiveLocked = true;
      audioManager.playCorrect();
      parentService.trackCorrect();
      spot.state = 'revealing';
      spot.animT = 0;

      const burstPos = spot.propObject.position.clone();
      burstPos.y += 0.6;
      const screen = this.worldToScreen(burstPos);
      DomConfetti.burst(this.hud, screen.x, screen.y);

      setTimeout(() => this.advanceRound(), 1400);
    } else {
      audioManager.playIncorrect();
      parentService.trackIncorrect();
      spot.state = 'peeking';
      spot.animT = 0;
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

  private buildHud() {
    this.zooHud = new ZooHudKit(this.hud, () => this.onExit());
  }

  // ---------- Language ----------

  private speak(text: string) {
    audioManager.speak(text, languageManager.getLanguage());
  }

  private onLanguageChange() {
    const lang = languageManager.getLanguage();
    this.levels.forEach((lvl) => {
      lvl.voiceText = buildHideSeekVoiceText(lang, lvl.targetSpeciesId);
    });

    const level = this.levels[this.currentIndex];
    if (level && this.zooHud) {
      this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
      this.speak(level.voiceText);
    }
  }
}
