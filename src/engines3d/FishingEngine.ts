import * as THREE from 'three';
import { Base3DEngine } from './Base3DEngine';
import { DioramaKit } from './DioramaKit';
import { ZooHudKit } from './ZooHudKit';
import { DomConfetti } from './DomConfetti';
import { audioManager } from '../managers/AudioManager';
import { languageManager } from '../managers/LanguageManager';
import { parentService } from '../services/ParentService';
import fishConfig from '../config/fishConfig.json';
import dioramaConfig from '../config/dioramaConfig.json';
import type { SteeringAgent } from './Steering';

export type Zoo3DAgeGroup = '2-3' | '4-6';

interface FishSpecies {
  id: string;
  model: string;
  scale: number;
  previewRotationY?: number;
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
  glowRing?: THREE.Mesh;
  sparkles?: THREE.Group;
  sparkleData?: { mesh: THREE.Mesh; speedY: number; swaySpeed: number; swayOffset: number; limitY: number }[];
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
  private idleLine!: THREE.Line;

  // These are resolved from dioramaConfig at build time for easy tuning
  private rodTipPos!: THREE.Vector3;
  private hookRestPos!: THREE.Vector3;

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

    // Auto-compute rod tip from the rod prop's bounding box
    const fishingCfg = (dioramaConfig.games as Record<string, any>).fishing;
    const rodPropCfg: any = fishingCfg?.props?.find((p: any) => (p.file as string).toLowerCase().includes('fishing rod'));
    const hookCfg: number[] = fishingCfg?.hookRestPosition ?? [0.35, -0.22, 0.5];
    this.hookRestPos = new THREE.Vector3(hookCfg[0], hookCfg[1], hookCfg[2]);

    if (rodPropCfg) {
      const rodTemplate = await this.loadModel(rodPropCfg.file, rodPropCfg.scale ?? 1.0);
      const rodInstance = rodTemplate.clone();
      if (rodPropCfg.position) rodInstance.position.set(rodPropCfg.position[0], rodPropCfg.position[1], rodPropCfg.position[2]);
      if (rodPropCfg.rotation) rodInstance.rotation.set(rodPropCfg.rotation[0], rodPropCfg.rotation[1], rodPropCfg.rotation[2]);
      // Force matrix update so world positions are computed
      rodInstance.updateMatrixWorld(true);

      // Walk every vertex of every mesh to find the tip (point farthest from camera = min Z in world)
      let tipVertex = new THREE.Vector3();
      let minZ = Infinity;
      const worldPos = new THREE.Vector3();
      rodInstance.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const posAttr = mesh.geometry.attributes.position;
        if (!posAttr) return;
        for (let i = 0; i < posAttr.count; i++) {
          worldPos.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
          if (worldPos.z < minZ) {
            minZ = worldPos.z;
            tipVertex.copy(worldPos);
          }
        }
      });
      this.rodTipPos = tipVertex;
    } else {
      // Fallback if rod prop not found in config
      this.rodTipPos = new THREE.Vector3(0.35, 1.8, 2.2);
    }

    // Idle fishing line — always hangs from rod tip to water surface
    const idleGeo = new THREE.BufferGeometry().setFromPoints([this.rodTipPos, this.hookRestPos]);
    this.idleLine = new THREE.Line(idleGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.scene.add(this.idleLine);

    // Animated cast line (hidden until fish is caught)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([this.rodTipPos, this.rodTipPos.clone()]);
    this.fishingLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.fishingLine.visible = false;
    this.scene.add(this.fishingLine);

    await this.renderCurrentLevel();
    this.zooHud.showLoading(false);
  }

  protected update(dt: number): void {
    this.diorama.tick(dt, { autoDayNight: false });
    this.fishAgents.forEach((agent) => agent.mixer.update(dt));
    this.updateFishBehavior(dt);
    this.updateGlowEffects(dt);
  }

  private updateGlowEffects(dt: number) {
    this.fishAgents.forEach((agent) => {
      if (!agent.isTarget) return;

      // Update glow ring pulsing on the ground
      if (agent.glowRing && !agent.isHooked) {
        agent.glowRing.position.x = agent.object.position.x;
        agent.glowRing.position.z = agent.object.position.z;
        agent.glowRing.position.y = this.diorama.getGroundHeight(agent.object.position.x, agent.object.position.z) + 0.03;

        // Pulsing scale & opacity
        const time = performance.now() * 0.0035;
        const scale = 1.0 + Math.sin(time) * 0.15;
        agent.glowRing.scale.set(scale, scale, 1);
        
        const mat = agent.glowRing.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + Math.sin(time) * 0.25;
      }

      // Update sparkles floating up
      if (agent.sparkles && agent.sparkleData) {
        agent.sparkleData.forEach((s) => {
          // Float up locally
          s.mesh.position.y += s.speedY * dt;
          
          // Sway in local space
          const time = performance.now() * 0.001;
          s.mesh.position.x += Math.sin(time * s.swaySpeed + s.swayOffset) * 0.003;
          s.mesh.position.z += Math.cos(time * s.swaySpeed + s.swayOffset) * 0.003;

          // Fade out as it rises
          const ratio = THREE.MathUtils.clamp(s.mesh.position.y / s.limitY, 0, 1);
          (s.mesh.material as THREE.MeshBasicMaterial).opacity = (1.0 - ratio) * 0.8;

          // Reset to bottom if it exceeds limit
          if (s.mesh.position.y > s.limitY) {
            s.mesh.position.y = -0.15;
            s.mesh.position.x = (Math.random() - 0.5) * 0.45;
            s.mesh.position.z = (Math.random() - 0.5) * 0.45;
          }
        });
      }
    });
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

    let glowRing: THREE.Mesh | undefined;
    let sparkles: THREE.Group | undefined;
    let sparkleData: { mesh: THREE.Mesh; speedY: number; swaySpeed: number; swayOffset: number; limitY: number }[] | undefined;

    if (isTarget) {
      // Glow Ring on the ground under the fish
      const ringGeo = new THREE.RingGeometry(0.25, 0.45, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffd600, // Golden yellow glow
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      glowRing = new THREE.Mesh(ringGeo, ringMat);
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.set(x, this.diorama.getGroundHeight(x, z) + 0.05, z);
      this.scene.add(glowRing);

      // Sparkles group attached directly to the fish so it automatically translates/rotates with it
      sparkles = new THREE.Group();
      sparkleData = [];
      const sparkleGeo = new THREE.DodecahedronGeometry(0.04, 0); // Gem/star look
      const sparkleColors = [0xffd600, 0xffffff, 0xffeb3b]; // Gold, white, yellow

      for (let j = 0; j < 6; j++) {
        const color = sparkleColors[j % sparkleColors.length];
        const sparkleMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending
        });
        const sparkleMesh = new THREE.Mesh(sparkleGeo, sparkleMat);
        sparkleMesh.position.set(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.5
        );
        sparkles.add(sparkleMesh);

        sparkleData.push({
          mesh: sparkleMesh,
          speedY: 0.12 + Math.random() * 0.2,
          swaySpeed: 1.5 + Math.random() * 3,
          swayOffset: Math.random() * Math.PI * 2,
          limitY: 0.35 + Math.random() * 0.25
        });
      }
      instance.add(sparkles);
    }

    const tAngle = Math.random() * Math.PI * 2;
    const tDist = Math.sqrt(Math.random()) * 5.0;

    this.fishAgents.push({
      object: instance, mixer, swimAction, speciesId, isTarget, isHooked: false,
      state: 'walking',
      target: { x: Math.cos(tAngle) * tDist, z: Math.sin(tAngle) * tDist },
      speed: 0.35 + Math.random() * 0.3, radius: 0.25, idleTimer: 0,
      baseScale: instance.scale.x, fleeTimer: 0,
      glowRing, sparkles, sparkleData
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
    if (agent.glowRing) {
      this.scene.remove(agent.glowRing);
    }
    // Hide the idle hang line while the cast line is animating
    this.idleLine.visible = false;
    this.fishingLine.visible = true;
    const startPos = agent.object.position.clone();

    // Initialize cast line endpoint to fish position
    const positions = this.fishingLine.geometry.attributes.position.array as Float32Array;
    positions[3] = startPos.x;
    positions[4] = startPos.y;
    positions[5] = startPos.z;
    this.fishingLine.geometry.attributes.position.needsUpdate = true;

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
        this.idleLine.visible = true;
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
    this.fishAgents.forEach(a => {
      this.scene.remove(a.object);
      if (a.glowRing) {
        this.scene.remove(a.glowRing);
      }
    });
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
