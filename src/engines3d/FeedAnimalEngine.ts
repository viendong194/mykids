import * as THREE from 'three';
import { Base3DEngine } from './Base3DEngine';
import { DioramaKit } from './DioramaKit';
import { ZooHudKit } from './ZooHudKit';
import { DomConfetti } from './DomConfetti';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { parentService } from '../services/ParentService';
import { ZOO3D_SPECIES, buildFeedVoiceText, getZoo3DSpecies } from '../data/zoo3d_translations';
import { ZOO3D_FOODS, getFoodGroupForSpecies, getFoodsForGroup, getOtherGroupFoods } from '../data/zoo3d_food';

export type Zoo3DAgeGroup = '2-3' | '4-6';

const ROUNDS_BY_AGE: Record<Zoo3DAgeGroup, number> = { '2-3': 4, '4-6': 5 };
const CHOICES_COUNT = 3;

const AMBIENT_DECOR: { file: string; height: number }[] = [
  { file: 'tree', height: 2.4 },
  { file: 'pine', height: 2.6 },
  { file: 'bush', height: 0.7 },
  { file: 'rock-medium', height: 0.6 },
  { file: 'flower-group', height: 0.4 },
  { file: 'mushroom', height: 0.35 },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface FeedLevelData {
  id: string;
  speciesId: string;
  correctFoodId: string;
  choices: string[];
  voiceText: string;
}

interface SimpleAgent {
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction | null;
  eatAction: THREE.AnimationAction | null;
}

/**
 * "Cho thú ăn" — one hungry animal stands front-center each round; the
 * child picks the matching food (herbivore → carrot/leafy-green/apple,
 * carnivore → meat) from HTML icon buttons that reuse the app's existing
 * 2D SVG food/vegetable icons. Correct choice plays the animal's `Eating`
 * clip.
 */
export class FeedAnimalEngine extends Base3DEngine {
  private age: Zoo3DAgeGroup;
  private onExit: () => void;

  private diorama!: DioramaKit;
  private zooHud!: ZooHudKit;
  private unsubscribeLang: () => void;

  private levels: FeedLevelData[] = [];
  private currentIndex = 0;
  private interactiveLocked = false;

  private hungryAgent: SimpleAgent | null = null;
  private ambientAgents: SimpleAgent[] = [];
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
      (template) => this.cloneInstance(template),
      { distance: 7, height: 2.6, yawDeg: 0, lookHeight: 0.9, fov: 45 }
    );

    this.diorama.setupLighting();
    this.diorama.setupCamera();
    this.buildHud();
    this.diorama.buildDevPanel('🛠 DEV — Cho thú ăn');
    this.zooHud.showLoading(true);

    await this.diorama.buildTerrainGround({ decor: AMBIENT_DECOR, decorRingCount: 10, grassCount: 16, decorRingRadius: 6 });
    await this.buildAmbientAnimals();

    this.levels = this.generateRound();
    this.currentIndex = 0;
    await this.renderCurrentLevel();

    this.zooHud.showLoading(false);
  }

  protected update(dt: number): void {
    this.diorama.tick(dt, { autoDayNight: true });
    this.hungryAgent?.mixer.update(dt);
    this.ambientAgents.forEach((agent) => agent.mixer.update(dt));
  }

  public destroy(): void {
    this.unsubscribeLang();
    super.destroy();
  }

  // ---------- Scene population ----------

  private async buildAmbientAnimals(): Promise<void> {
    const picked = shuffle(ZOO3D_SPECIES).slice(0, 2);
    const spots = [
      { x: -2.4, z: 2.2 },
      { x: 2.4, z: 2.0 },
    ];

    for (let i = 0; i < picked.length; i++) {
      const info = getZoo3DSpecies(picked[i].id);
      const template = await this.loadModel(`assets/3d/animals/${info.file}.glb`, info.targetHeight);
      const instance = this.cloneInstance(template);
      this.diorama.enableShadows(instance);

      const { x, z } = spots[i];
      instance.position.set(x, this.diorama.getGroundHeight(x, z), z);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);

      const mixer = new THREE.AnimationMixer(instance);
      const idleClip = this.findClip(instance, 'Idle', /hitreact|headlow/i);
      const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
      if (idleAction) {
        idleAction.time = Math.random() * idleClip!.duration;
        idleAction.play();
      }

      this.ambientAgents.push({ object: instance, mixer, idleAction, eatAction: null });
    }
  }

  // ---------- Round generation ----------

  private generateRound(): FeedLevelData[] {
    const rounds = ROUNDS_BY_AGE[this.age];
    const levels: FeedLevelData[] = [];
    let lastSpeciesId = '';
    for (let i = 0; i < rounds; i++) {
      const level = this.generateOneLevel(i, lastSpeciesId);
      lastSpeciesId = level.speciesId;
      levels.push(level);
    }
    return levels;
  }

  private generateOneLevel(index: number, avoidSpeciesId: string): FeedLevelData {
    const candidates = ZOO3D_SPECIES.filter((s) => s.id !== avoidSpeciesId);
    const speciesId = candidates[Math.floor(Math.random() * candidates.length)].id;

    const group = getFoodGroupForSpecies(speciesId);
    const correctFood = shuffle(getFoodsForGroup(group))[0];
    const wrongFoods = shuffle(getOtherGroupFoods(group)).slice(0, CHOICES_COUNT - 1);
    const choices = shuffle([correctFood.id, ...wrongFoods.map((f) => f.id)]);

    const lang = languageManager.getLanguage();
    const voiceText = buildFeedVoiceText(lang, speciesId);

    return { id: `feed_${index}`, speciesId, correctFoodId: correctFood.id, choices, voiceText };
  }

  private async renderCurrentLevel() {
    const level = this.levels[this.currentIndex];

    if (this.hungryAgent) {
      this.scene.remove(this.hungryAgent.object);
      this.hungryAgent = null;
    }

    const info = getZoo3DSpecies(level.speciesId);
    const template = await this.loadModel(`assets/3d/animals/${info.file}.glb`, info.targetHeight);
    const instance = this.cloneInstance(template);
    this.diorama.enableShadows(instance);

    const groundY = this.diorama.getGroundHeight(0, 0);
    instance.position.set(0, groundY, 0);
    instance.rotation.y = Math.PI; // face the camera
    this.scene.add(instance);

    const mixer = new THREE.AnimationMixer(instance);
    const idleClip = this.findClip(instance, 'Idle', /hitreact|headlow/i);
    const eatClip = this.findClip(instance, 'Eating');
    const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    const eatAction = eatClip ? mixer.clipAction(eatClip) : null;
    if (eatAction) {
      eatAction.setLoop(THREE.LoopOnce, 1);
      eatAction.clampWhenFinished = true;
    }
    if (idleAction) {
      idleAction.time = Math.random() * idleClip!.duration;
      idleAction.play();
    }

    this.hungryAgent = { object: instance, mixer, idleAction, eatAction };

    this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
    this.zooHud.setProgress(this.levels.length, this.currentIndex);
    this.renderChoices(level);
    this.speak(level.voiceText);
  }

  // ---------- HUD ----------

  private buildHud() {
    this.injectFeedStylesOnce();
    this.zooHud = new ZooHudKit(this.hud, () => this.onExit());

    this.choicesRowEl = document.createElement('div');
    this.choicesRowEl.className = 'zoo3d-feed-choices';
    this.hud.appendChild(this.choicesRowEl);
  }

  private renderChoices(level: FeedLevelData) {
    this.choicesRowEl.innerHTML = '';
    level.choices.forEach((foodId) => {
      const food = ZOO3D_FOODS.find((f) => f.id === foodId)!;
      const btn = document.createElement('button');
      btn.className = 'zoo3d-feed-choice';

      const img = document.createElement('img');
      img.src = food.assetPath;
      img.alt = food.name.vi;
      btn.appendChild(img);

      btn.addEventListener('click', () => this.onFoodClick(foodId, btn, level));
      this.choicesRowEl.appendChild(btn);
    });
  }

  private onFoodClick(foodId: string, buttonEl: HTMLButtonElement, level: FeedLevelData) {
    if (this.interactiveLocked) return;

    if (foodId === level.correctFoodId) {
      this.interactiveLocked = true;
      audioManager.playCorrect();
      parentService.trackCorrect();
      buttonEl.classList.add('zoo3d-feed-choice-correct');

      if (this.hungryAgent?.eatAction) {
        this.hungryAgent.idleAction?.fadeOut(0.2);
        this.hungryAgent.eatAction.reset().fadeIn(0.2).play();
      }

      if (this.hungryAgent) {
        const burstPos = this.hungryAgent.object.position.clone();
        burstPos.y += 0.8;
        const screen = this.worldToScreen(burstPos);
        DomConfetti.burst(this.hud, screen.x, screen.y);
      }

      setTimeout(() => this.advanceRound(), 1400);
    } else {
      audioManager.playIncorrect();
      parentService.trackIncorrect();
      buttonEl.classList.add('zoo3d-feed-choice-shake');
      setTimeout(() => buttonEl.classList.remove('zoo3d-feed-choice-shake'), 400);
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
      lvl.voiceText = buildFeedVoiceText(lang, lvl.speciesId);
    });

    const level = this.levels[this.currentIndex];
    if (level && this.zooHud) {
      this.zooHud.setQuestion(level.voiceText, () => this.speak(level.voiceText));
      this.speak(level.voiceText);
    }
  }

  private injectFeedStylesOnce() {
    if (feedStylesInjected) return;
    feedStylesInjected = true;

    const style = document.createElement('style');
    style.id = 'zoo3d-feed-styles';
    style.textContent = ZOO3D_FEED_CSS;
    document.head.appendChild(style);
  }
}

let feedStylesInjected = false;

const ZOO3D_FEED_CSS = `
.zoo3d-feed-choices {
  position: absolute;
  bottom: 28px; left: 50%; transform: translateX(-50%);
  display: flex; gap: clamp(12px, 2.5vw, 24px);
  flex-wrap: wrap;
  justify-content: center;
  max-width: 92vw;
}
.zoo3d-feed-choice {
  width: clamp(72px, 14vw, 104px); height: clamp(72px, 14vw, 104px);
  border-radius: 24px;
  background: #fff;
  border: 4px solid #fff;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  transition: transform 0.15s, background 0.15s, border-color 0.15s;
  display: flex; align-items: center; justify-content: center;
  padding: 10px;
}
.zoo3d-feed-choice img {
  width: 100%; height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.zoo3d-feed-choice:active { transform: scale(0.92); }
.zoo3d-feed-choice-correct { border-color: #4CAF50; background: #E8F5E9; }
.zoo3d-feed-choice-shake { animation: zoo3d-feed-shake 0.4s; }
@keyframes zoo3d-feed-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}
`;
