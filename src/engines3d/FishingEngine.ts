import * as THREE from 'three';
import { Base3DEngine } from './Base3DEngine';
import { DioramaKit } from './DioramaKit';
import { ZooHudKit } from './ZooHudKit';
import { DomConfetti } from './DomConfetti';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { parentService } from '../services/ParentService';
import fishConfig from '../config/fishConfig.json';
import type { SteeringAgent } from './Steering';

export type Zoo3DAgeGroup = '2-3' | '4-6';

interface FishSpecies {
  id: string;
  model: string;
  scale: number;
  name: Record<string, string>;
}

interface FishAgent {
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  swimAction: THREE.AnimationAction | null;
  speciesId: string;
  isTarget: boolean;
  isHooked: boolean;
  state: 'idle' | 'walking';
  target: { x: number; z: number };
  speed: number;
  radius: number;
  idleTimer: number;
  baseScale: number;
  fleeTimer: number;
}

interface FishingRound {
  targetSpecies: FishSpecies;
  distractorSpecies: FishSpecies[];
  targetCatchCount: number;
}



export class FishingEngine extends Base3DEngine {
  private age: Zoo3DAgeGroup;
  private onExit: () => void;

  private diorama!: DioramaKit;
  private zooHud!: ZooHudKit;
  private unsubscribeLang: () => void;

  private fishList: FishSpecies[] = [];
  private fishTemplates = new Map<string, THREE.Group>();
  private fishAgents: FishAgent[] = [];
  
  private levels: FishingRound[] = [];
  private currentIndex = 0;
  private caughtCount = 0;
  private interactiveLocked = false;

  private fishingLine!: THREE.Line;
  private rodTipPos = new THREE.Vector3(0, 0.55, 4.2);

  constructor(age: Zoo3DAgeGroup, onExit: () => void) {
    super();
    this.age = age;
    this.onExit = onExit;
    this.unsubscribeLang = languageManager.onChange(() => this.onLanguageChange());
  }

  protected async build(): Promise<void> {
    this.diorama = new DioramaKit(
      this.renderer, this.scene, this.camera, this.hud,
      (url, h) => this.loadModel(url, h),
      (t) => this.cloneInstance(t),
      'fishing'
    );
    this.diorama.setupLighting();
    this.diorama.setupCamera();
    this.diorama.devCameraOverride = false;

    this.zooHud = new ZooHudKit(this.hud, () => this.onExit());
    this.diorama.buildDevPanel('🛠 DEV — Câu cá');
    this.zooHud.showLoading(true);

    await this.diorama.buildTerrainGround();

    this.fishList = fishConfig.species;
    await Promise.all(this.fishList.map(async (f) => {
      const template = await this.loadModel(`assets/3d/fish/${f.model}`, f.scale);
      this.fishTemplates.set(f.id, template);
    }));

    this.generateRound();
    this.currentIndex = 0;

    const lineGeo = new THREE.BufferGeometry().setFromPoints([this.rodTipPos, this.rodTipPos.clone()]);
    this.fishingLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
    this.fishingLine.visible = false;
    this.scene.add(this.fishingLine);

    await this.renderCurrentLevel();
    this.zooHud.showLoading(false);
  }

  protected update(dt: number): void {
    this.diorama.tick(dt, { autoDayNight: false });
    this.fishAgents.forEach((agent) => agent.mixer.update(dt));
    this.updateFishBehavior(dt);
  }

  public destroy(): void {
    this.unsubscribeLang();
    this.zooHud.destroy();
    super.destroy();
  }

  private generateRound() {
    this.levels = [];
    const rounds = 5;
    const targetCatchCount = this.age === '2-3' ? 2 : 3;
    const shuffled = [...this.fishList].sort(() => Math.random() - 0.5);

    for (let r = 0; r < rounds; r++) {
      const targetSpecies = shuffled[r % shuffled.length];
      const distractors = this.fishList.filter(s => s.id !== targetSpecies.id);
      const distractorSpecies = distractors.sort(() => Math.random() - 0.5).slice(0, this.age === '2-3' ? 3 : 5);

      this.levels.push({ targetSpecies, distractorSpecies, targetCatchCount });
    }
  }

  private async renderCurrentLevel() {
    this.clearCurrentFish();
    const level = this.levels[this.currentIndex];
    this.caughtCount = 0;
    this.interactiveLocked = false;

    const lang = languageManager.getLanguage();
    const fishName = level.targetSpecies.name[lang] || level.targetSpecies.name['en'];
    const text = this.buildQuestionText(lang, level.targetCatchCount, fishName);

    this.zooHud.setQuestion(text, () => this.speak(text));
    this.zooHud.setCatchProgress(this.caughtCount, level.targetCatchCount);
    this.zooHud.setProgress(this.levels.length, this.currentIndex);

    const targetTemplate = this.fishTemplates.get(level.targetSpecies.id)!;
    this.zooHud.setTargetPreviewModel(targetTemplate, 1.25);
    this.speak(text);

    for (let i = 0; i < 3; i++) this.spawnFish(level.targetSpecies.id, true);
    const numDist = this.age === '2-3' ? 6 : 9;
    for (let i = 0; i < numDist; i++) {
      const d = level.distractorSpecies[i % level.distractorSpecies.length];
      this.spawnFish(d.id, false);
    }

    this.setupRaycasting(
      () => this.fishAgents.map(a => a.object),
      (pickId) => this.onFishTap(parseInt(pickId))
    );
  }

  private spawnFish(speciesId: string, isTarget: boolean) {
    const template = this.fishTemplates.get(speciesId)!;
    const instance = this.cloneInstance(template);

    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * 5.0;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = this.diorama.getGroundHeight(x, z) + 0.15 + Math.random() * 0.15;
    instance.position.set(x, y, z);
    instance.rotation.y = Math.random() * Math.PI * 2;

    this.diorama.enableShadows(instance);
    this.scene.add(instance);

    this.setPickable(instance, String(this.fishAgents.length));

    const mixer = new THREE.AnimationMixer(instance);
    const swimClip = this.findClip(instance, 'Swim') || this.findClip(instance, 'Walk') || this.findClip(instance, 'Idle');
    const swimAction = swimClip ? mixer.clipAction(swimClip) : null;
    swimAction?.play();

    const tAngle = Math.random() * Math.PI * 2;
    const tDist = Math.sqrt(Math.random()) * 5.0;

    this.fishAgents.push({
      object: instance, mixer, swimAction, speciesId, isTarget, isHooked: false,
      state: 'walking',
      target: { x: Math.cos(tAngle) * tDist, z: Math.sin(tAngle) * tDist },
      speed: 0.35 + Math.random() * 0.3, radius: 0.25, idleTimer: 0,
      baseScale: instance.scale.x, fleeTimer: 0
    });
  }

  private updateFishBehavior(dt: number) {
    this.fishAgents.forEach((agent) => {
      if (agent.isHooked) return;

      if (agent.fleeTimer > 0) {
        agent.fleeTimer -= dt;
        if (agent.fleeTimer <= 0) agent.speed = 0.35 + Math.random() * 0.3;
      }

      const activeAgents = this.fishAgents.filter(a => !a.isHooked) as SteeringAgent[];

      if (agent.state === 'idle') {
        agent.idleTimer -= dt;
        if (agent.idleTimer <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * 5.0;
          agent.target = { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
          agent.state = 'walking';
        }
      } else {
        const result = this.stepAgentTowardTarget(agent, activeAgents, dt, {
          playRadius: 6.0,
          getGroundHeight: (x, z) => this.diorama.getGroundHeight(x, z) + 0.15,
          arriveThreshold: 0.3, flockRange: 1.8, separationRange: 0.5,
        });

        if (result.arrived) {
          agent.idleTimer = 1.0 + Math.random() * 2.5;
          agent.state = 'idle';
        } else {
          agent.object.rotation.y = this.lerpAngle(agent.object.rotation.y, result.facingAngle, Math.min(1, dt * 5));
        }
      }
    });
  }

  private onFishTap(pickId: number) {
    if (this.interactiveLocked || this.zooHud.isLoading()) return;
    const agent = this.fishAgents[pickId];
    if (!agent || agent.isHooked) return;

    this.interactiveLocked = true;

    if (agent.isTarget) {
      agent.isHooked = true;
      audioManager.playCorrect();
      parentService.trackCorrect();
      this.animateHookAndReel(agent);
    } else {
      audioManager.playIncorrect();
      parentService.trackIncorrect();
      agent.fleeTimer = 2.5;
      agent.speed = 1.6;
      const angle = Math.random() * Math.PI * 2;
      agent.target = { x: Math.cos(angle) * 4.5, z: Math.sin(angle) * 4.5 };
      agent.state = 'walking';
      this.zooHud.shakePreview();
      this.interactiveLocked = false;
    }
  }

  private animateHookAndReel(agent: FishAgent) {
    this.fishingLine.visible = true;
    const startPos = agent.object.position.clone();

    const duration = 1200;
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      const heightOffset = Math.sin(t * Math.PI) * 1.5;
      const currentPos = new THREE.Vector3().lerpVectors(startPos, this.rodTipPos, t);
      currentPos.y += heightOffset;
      
      agent.object.position.copy(currentPos);
      agent.object.rotation.y += 0.25;
      agent.object.rotation.x += 0.1;

      const positions = this.fishingLine.geometry.attributes.position.array as Float32Array;
      positions[3] = currentPos.x;
      positions[4] = currentPos.y;
      positions[5] = currentPos.z;
      this.fishingLine.geometry.attributes.position.needsUpdate = true;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.fishingLine.visible = false;
        this.scene.remove(agent.object);
        DomConfetti.burst(this.hud, window.innerWidth / 2, window.innerHeight / 2);
        
        this.caughtCount++;
        const level = this.levels[this.currentIndex];
        this.zooHud.setCatchProgress(this.caughtCount, level.targetCatchCount);

        if (this.caughtCount >= level.targetCatchCount) {
          this.currentIndex++;
          if (this.currentIndex >= this.levels.length) {
            this.zooHud.showCompletion({
              onReplay: () => {
                this.generateRound();
                this.currentIndex = 0;
                this.renderCurrentLevel();
              },
              onBack: () => this.onExit(),
            });
          } else {
            this.renderCurrentLevel();
          }
        } else {
          this.spawnFish(level.targetSpecies.id, true);
          this.interactiveLocked = false;
        }
      }
    };
    animate();
  }

  private clearCurrentFish() {
    this.fishAgents.forEach(a => this.scene.remove(a.object));
    this.fishAgents = [];
  }

  private speak(text: string) {
    audioManager.speak(text, languageManager.getLanguage());
  }

  private onLanguageChange() {
    const level = this.levels[this.currentIndex];
    const lang = languageManager.getLanguage();
    const fishName = level.targetSpecies.name[lang] || level.targetSpecies.name['en'];
    const text = this.buildQuestionText(lang, level.targetCatchCount, fishName);
    this.zooHud.setQuestion(text, () => this.speak(text));
  }

  private buildQuestionText(lang: string, count: number, name: string): string {
    if (lang === 'vi') return `Bé hãy câu ${count} chú ${name} nhé!`;
    if (lang === 'zh') return `请钓起 ${count} 条 ${name}！`;
    if (lang === 'ja') return `${name} を ${count} びき つってね！`;
    return `Please catch ${count} ${name}(s)!`;
  }
}
