import * as THREE from 'three';
import { Base3DEngine } from './Base3DEngine';
import { DomConfetti } from './DomConfetti';
import { computeFlockingSteering } from './Steering';
import { fractalNoise } from './PerlinNoise';
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
  private cameraAngle = 0;

  private unsubscribeLang: () => void;

  private speechTextEl!: HTMLSpanElement;
  private choicesRowEl!: HTMLDivElement;
  private progressRowEl!: HTMLDivElement;
  private loadingOverlayEl: HTMLDivElement | null = null;

  // ---------- Dev-only tuning (stripped from production builds) ----------
  private readonly devMode = import.meta.env.DEV;
  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private groundMaterial!: THREE.MeshStandardMaterial;
  private cameraLight!: THREE.DirectionalLight;
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private timeOfDayAngle = 0;
  private starField!: THREE.Group;
  private fireflies!: THREE.Points;
  private fireflyData: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    phase: number;
    blinkSpeed: number;
  }[] = [];
  private currentNightTime = 0;
  private devReadoutEl: HTMLPreElement | null = null;
  private devCameraOverride = true;
  private devCam = { distance: 10, height: 3.2, yawDeg: -20, lookHeight: 0.8, fov: 50 };

  constructor(age: Zoo3DAgeGroup, onExit: () => void) {
    super();
    this.age = age;
    this.onExit = onExit;
    this.unsubscribeLang = languageManager.onChange(() => this.onLanguageChange());
  }

  protected async build(): Promise<void> {
    // Enable real-time shadow maps in the renderer
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is ~30% heavier, PCF is sufficient

    this.setupLighting();
    this.setupCamera();
    this.buildHud();
    // if (this.devMode) this.buildDevPanel();
    this.showLoading(true);

    await this.buildGround();

    this.levels = this.generateRound();
    this.currentIndex = 0;
    await this.renderCurrentLevel();

    this.showLoading(false);
  }

  protected update(dt: number): void {
    if (this.devCameraOverride) {
      this.applyDevCamera();
    } else {
      this.cameraAngle += dt * 0.15;
      const yaw = THREE.MathUtils.degToRad(this.devCam.yawDeg) + Math.sin(this.cameraAngle) * 0.25;
      const height = this.devCam.height + Math.sin(this.cameraAngle * 0.6) * 0.2;
      this.camera.position.set(
        Math.sin(yaw) * this.devCam.distance,
        height,
        Math.cos(yaw) * this.devCam.distance
      );
      this.camera.lookAt(0, this.devCam.lookHeight, 0);
    }

    // Auto day/night cycle (runs always, independent of camera rotation settings)
    this.timeOfDayAngle += dt * 0.08;
    const t = 0.5 - 0.5 * Math.sin(this.timeOfDayAngle);
    this.applyTimeOfDay(t);

    if (this.cameraLight) {
      this.cameraLight.position.copy(this.camera.position);
    }

    this.animalAgents.forEach((agent) => agent.mixer.update(dt));
    this.updateAnimalBehavior(dt);
    this.updateFireflies(dt);

    if (this.devMode) this.updateDevReadout();
  }

  public destroy(): void {
    this.unsubscribeLang();
    super.destroy();
  }

  // ---------- Scene setup ----------

  private setupLighting() {
    this.scene.fog = new THREE.Fog(0xbbe7f2, 16, 38);

    this.hemiLight = new THREE.HemisphereLight(0xe1f5fe, 0x8d6e63, 1.1);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sunLight.position.set(4, 8, 5);

    // Enable shadows on sunLight
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.left = -8;
    this.sunLight.shadow.camera.right = 8;
    this.sunLight.shadow.camera.top = 8;
    this.sunLight.shadow.camera.bottom = -8;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 40;
    this.sunLight.shadow.bias = -0.0015;

    this.scene.add(this.sunLight);

    this.cameraLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.cameraLight.position.copy(this.camera.position);
    this.cameraLight.target.position.set(0, 0.8, 0);
    this.scene.add(this.cameraLight);
    this.scene.add(this.cameraLight.target);

    // Create Sun mesh
    const sunGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Create Moon mesh
    const moonGeo = new THREE.SphereGeometry(1.0, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0f7fa, fog: false });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);

    this.starField = this.buildStarField();
    this.scene.add(this.starField);

    this.setupFireflies();

    this.applyTimeOfDay(0);
  }

  private createCircleTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Create radial gradient for a soft round glow
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  private buildStarField(): THREE.Group {
    const group = new THREE.Group();
    const texture = this.createCircleTexture();

    // 3 different groups of stars for varied sizing
    const starSizes = [0.35, 0.6, 0.95];
    const starCounts = [120, 90, 50];

    for (let g = 0; g < starSizes.length; g++) {
      const count = starCounts[g];
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const radius = 40 + Math.random() * 10;
        const theta = Math.random() * Math.PI * 2;
        // phi clamped to 0..65° so ALL stars stay in the upper hemisphere
        // and are never occluded by the ground plane or mountains.
        const phi = Math.random() * Math.PI * 0.36; // 0 → 65°
        positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.cos(phi) + 2;
        positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: starSizes[g],
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending
      });
      const points = new THREE.Points(geometry, material);
      group.add(points);
    }

    return group;
  }

  /**
   * Blends sky/fog/lighting/ground between a day and a night look.
   * t=0 is full daylight, t=1 is full night (stars fade in as t rises).
   */
  private applyTimeOfDay(t: number) {
    const time = THREE.MathUtils.clamp(t, 0, 1);

    const sky = new THREE.Color(0xbbe7f2).lerp(new THREE.Color(0x0b1330), time);
    this.scene.background = sky;
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.copy(sky);

    this.hemiLight.color.set(0xe1f5fe).lerp(new THREE.Color(0xffecb3), time); // warm pale yellow moonlight
    this.hemiLight.groundColor.set(0x8d6e63).lerp(new THREE.Color(0x221a15), time); // warm ground reflection
    this.hemiLight.intensity = THREE.MathUtils.lerp(1.1, 0.45, time); // brighter ambient at night

    // Update Sun and Moon positions in their background orbit behind the ground plane (z = -34)
    const R_orbit = 28;
    const theta = Math.PI / 2 - time * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    if (this.sunMesh) {
      this.sunMesh.position.set(
        cosTheta * R_orbit,
        sinTheta * 20 - 4,
        -34
      );
    }
    if (this.moonMesh) {
      this.moonMesh.position.set(
        -cosTheta * R_orbit,
        -sinTheta * 20 - 4,
        -34
      );
    }

    // Directional light follows the active celestial body's direction
    // but remains closer (distance 15) to keep the shadow map frustum tight
    this.sunLight.color.set(0xffffff).lerp(new THREE.Color(0xfffde7), time); // soft moonlight
    this.sunLight.intensity = THREE.MathUtils.lerp(1.4, 0.35, time); // brighter moonlight direction
    if (time < 0.5) {
      if (this.sunMesh) {
        const dir = this.sunMesh.position.clone().normalize();
        this.sunLight.position.copy(dir.multiplyScalar(15));
      }
    } else {
      if (this.moonMesh) {
        const dir = this.moonMesh.position.clone().normalize();
        this.sunLight.position.copy(dir.multiplyScalar(15));
      }
    }

    if (this.groundMaterial) {
      // When vertexColors=true the material color is a tint multiplier.
      // Use white (no tint) at day so Perlin vertex colors show through; darken at night.
      this.groundMaterial.color.set(0xffffff).lerp(new THREE.Color(0x1c2b1a), time);
    }

    if (this.cameraLight) {
      this.cameraLight.color.set(0xffffff).lerp(new THREE.Color(0xfffde7), time);
      this.cameraLight.intensity = THREE.MathUtils.lerp(0.8, 0.18, time);
    }

    // Twinkle effect: oscillate opacity of all star sizes at night
    if (this.starField) {
      const opacity = time * (0.8 + Math.sin(Date.now() * 0.004) * 0.2);
      this.starField.children.forEach((child) => {
        if (child instanceof THREE.Points) {
          (child.material as THREE.PointsMaterial).opacity = opacity;
        }
      });
    }

    this.currentNightTime = time;
  }

  private getGroundHeight(x: number, z: number): number {
    // Organic bumpy terrain in the play area
    const bump = Math.sin(x * 0.8) * Math.cos(z * 0.8) * 0.15 + Math.sin(x * 2.0) * 0.05;

    const r = Math.sqrt(x * x + z * z);
    const bowlStart = 7.5;
    if (r <= bowlStart) return bump;

    const t = r - bowlStart; // distance beyond play boundary

    // Perlin noise at low frequency → broad irregular silhouettes (not a symmetric bowl)
    const mountainNoise = fractalNoise(x * 0.22, z * 0.22, 3, 0.55, 2.0); // [0..1]

    // Cap t to prevent extreme heights at geometry corners (r=42 → t=34 would give 35m!)
    const tCapped = Math.min(t, 8);

    // Very gentle rise: at fog-start (r=9, t=1.5) → 0.05–0.10m
    //                   at near-fog (r=14, t=6.5) → 0.08–0.24m
    // Hills should peek above horizon like distant hills, NOT block the sky.
    const rise = tCapped * 0.006 + mountainNoise * tCapped * 0.030;
    return bump + rise;
  }

  private setupFireflies() {
    const count = 35;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 5.0;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const groundH = this.getGroundHeight(x, z);
      const y = groundH + 0.15 + Math.random() * 1.0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0;
      colors[i * 3 + 2] = 0;

      this.fireflyData.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.1,
        vz: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
        blinkSpeed: 1.5 + Math.random() * 2.0,
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const texture = this.createCircleTexture();
    const material = new THREE.PointsMaterial({
      size: 0.22,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      fog: false,
    });

    this.fireflies = new THREE.Points(geometry, material);
    this.scene.add(this.fireflies);
  }

  private updateFireflies(dt: number) {
    if (!this.fireflies) return;

    const nightRatio = this.currentNightTime;
    const geometry = this.fireflies.geometry;
    const positions = geometry.attributes.position.array as Float32Array;
    const colors = geometry.attributes.color.array as Float32Array;

    const baseR = 1.0;
    const baseG = 0.95;
    const baseB = 0.45;

    for (let i = 0; i < this.fireflyData.length; i++) {
      const f = this.fireflyData[i];

      // Update position with random organic drift
      f.vx += (Math.random() - 0.5) * 0.15 * dt;
      f.vy += (Math.random() - 0.5) * 0.08 * dt;
      f.vz += (Math.random() - 0.5) * 0.15 * dt;

      // Clamp speed
      const speed = Math.hypot(f.vx, f.vz);
      if (speed > 0.35) {
        f.vx = (f.vx / speed) * 0.35;
        f.vz = (f.vz / speed) * 0.35;
      }
      if (Math.abs(f.vy) > 0.12) {
        f.vy = Math.sign(f.vy) * 0.12;
      }

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;

      // Boundary: keep fireflies within the playground area (radius 5.5)
      const dist = Math.hypot(f.x, f.z);
      if (dist > 5.5) {
        f.vx = -f.vx * 0.8 + (0 - f.x) * 0.05;
        f.vz = -f.vz * 0.8 + (0 - f.z) * 0.05;
      }

      // Height limits: float between groundH + 0.15m and groundH + 1.2m
      const groundH = this.getGroundHeight(f.x, f.z);
      if (f.y < groundH + 0.15) {
        f.y = groundH + 0.15;
        f.vy = Math.abs(f.vy);
      } else if (f.y > groundH + 1.2) {
        f.y = groundH + 1.2;
        f.vy = -Math.abs(f.vy);
      }

      positions[i * 3] = f.x;
      positions[i * 3 + 1] = f.y;
      positions[i * 3 + 2] = f.z;

      // Twinkle phase
      f.phase += f.blinkSpeed * dt;
      const wave = 0.5 + 0.5 * Math.sin(f.phase);
      // Fireflies fade out completely during day and shimmer at night
      const brightness = nightRatio * (0.2 + 0.8 * wave);

      colors[i * 3] = baseR * brightness;
      colors[i * 3 + 1] = baseG * brightness;
      colors[i * 3 + 2] = baseB * brightness;
    }

    // Only upload GPU buffers during night — daytime fireflies are invisible (brightness=0)
    if (nightRatio > 0.05) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  }

  private setupCamera() {
    const yaw = THREE.MathUtils.degToRad(this.devCam.yawDeg);
    this.camera.position.set(
      Math.sin(yaw) * this.devCam.distance,
      this.devCam.height,
      Math.cos(yaw) * this.devCam.distance
    );
    this.camera.lookAt(0, this.devCam.lookHeight, 0);
    this.camera.fov = this.devCam.fov;
    this.camera.updateProjectionMatrix();
  }

  private applyDevCamera() {
    const yaw = THREE.MathUtils.degToRad(this.devCam.yawDeg);
    this.camera.position.set(Math.sin(yaw) * this.devCam.distance, this.devCam.height, Math.cos(yaw) * this.devCam.distance);
    this.camera.lookAt(0, this.devCam.lookHeight, 0);
    if (this.camera.fov !== this.devCam.fov) {
      this.camera.fov = this.devCam.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateDevReadout() {
    if (!this.devReadoutEl) return;
    const p = this.camera.position;
    const yaw = (Math.atan2(p.x, p.z) * 180) / Math.PI;
    this.devReadoutEl.textContent =
      `x=${p.x.toFixed(2)}  y=${p.y.toFixed(2)}  z=${p.z.toFixed(2)}\n` +
      `yaw=${yaw.toFixed(1)}°  fov=${this.camera.fov.toFixed(0)}\n` +
      `mode=${this.devCameraOverride ? 'manual' : 'auto-sway'}`;
  }

  private async buildGround() {
    // 60×60 plane with 80×80 subdivisions → 6,561 verts.
    // Large enough that all edges fall deep inside fog (~22 units) and are
    // never visible. The horizon-bowl height function raises the outer rim
    // so the player sees rolling hills fading into the sky, not geometry edges.
    const SEG = 50;  // 50×50 = 2,601 verts / 5,000 tris (was 80×80=12,800, fog hides outer)
    const SIZE = 60;
    const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);

    const posAttr = groundGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const colorDeep   = new THREE.Color(0x1b5e20); // dense dark green — wet, shaded spots
    const colorDark   = new THREE.Color(0x33691e); // lush dark green — valley floor
    const colorMid    = new THREE.Color(0x7cb342); // mid green — general field
    const colorYellow = new THREE.Color(0xc8a84b); // earth yellow — dry sunny patches
    const colorSand   = new THREE.Color(0xbfa07a); // sand brown — bare earth, worn paths

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i); // plane-space Y = world Z (pre-rotation)

      // Full height including horizon bowl
      posAttr.setZ(i, this.getGroundHeight(x, y));

      // Only compute Perlin color in the visible play area (r ≤ 12)
      const r = Math.sqrt(x * x + y * y);
      const noise  = r < 12 ? fractalNoise(x * 0.6,  y * 0.6,  4, 0.5, 2.0) : 0;
      // A second independent noise at different scale & offset for earthy dry patches
      const noise2 = r < 12 ? fractalNoise(x * 0.35 + 17, y * 0.35 + 31, 3, 0.6, 2.0) : 0;

      // Base green gradient: deep → dark → mid → yellow → sand
      let vertexColor: THREE.Color;
      if (noise < 0.22) {
        vertexColor = colorDeep.clone().lerp(colorDark, noise / 0.22);
      } else if (noise < 0.50) {
        vertexColor = colorDark.clone().lerp(colorMid, (noise - 0.22) / 0.28);
      } else if (noise < 0.72) {
        vertexColor = colorMid.clone().lerp(colorYellow, (noise - 0.50) / 0.22);
      } else {
        vertexColor = colorYellow.clone().lerp(colorSand, (noise - 0.72) / 0.28);
      }

      // Blend in sandy/earthy patches using the secondary noise
      // noise2 > 0.72 → blend toward sand, giving worn-path & bare-earth spots
      if (noise2 > 0.72) {
        const blend = (noise2 - 0.72) / 0.28;
        vertexColor.lerp(colorSand, blend * 0.6);
      }

      colors[i * 3]     = vertexColor.r;
      colors[i * 3 + 1] = vertexColor.g;
      colors[i * 3 + 2] = vertexColor.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();

    this.groundMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9, vertexColors: true });
    const ground = new THREE.Mesh(groundGeo, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const distinctDecor = Array.from(new Map(NATURE_DECOR.map((d) => [d.file, d])).values());
    await Promise.all(distinctDecor.map((d) => this.loadModel(`assets/3d/nature/${d.file}.glb`, d.height)));

    const ringCount = 12;
    const ringRadius = 5.6;
    for (let i = 0; i < ringCount; i++) {
      const decor = NATURE_DECOR[i % NATURE_DECOR.length];
      const template = await this.loadModel(`assets/3d/nature/${decor.file}.glb`, decor.height);
      const instance = this.cloneInstance(template);

      // Enable cast/receive shadows on decoration models
      instance.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const angle = (i / ringCount) * Math.PI * 2;
      const r = ringRadius + (Math.random() - 0.5) * 0.8;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = this.getGroundHeight(x, z);
      instance.position.set(x, y, z);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);
    }

    const grassTemplate = await this.loadModel('assets/3d/nature/grass.glb', 0.3);
    for (let i = 0; i < 18; i++) {
      const instance = this.cloneInstance(grassTemplate);

      // Enable shadows on grass
      instance.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 4.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = this.getGroundHeight(x, z);
      instance.position.set(x, y, z);
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

      // Enable cast/receive shadows on animals
      instance.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const pos = positions[i];
      instance.position.set(pos.x, this.getGroundHeight(pos.x, pos.z), pos.z);
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
      agent.object.position.y = this.getGroundHeight(newX, newZ);

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

  // ---------- Dev panel (only built when running `npm run dev`) ----------

  private buildDevPanel() {
    const panel = document.createElement('div');
    panel.className = 'zoo3d-dev-panel';

    const title = document.createElement('div');
    title.className = 'zoo3d-dev-title';
    title.textContent = '🛠 DEV — camera & ánh sáng';
    panel.appendChild(title);

    this.devReadoutEl = document.createElement('pre');
    this.devReadoutEl.className = 'zoo3d-dev-readout';
    panel.appendChild(this.devReadoutEl);

    panel.appendChild(this.buildDevSlider('☀️ Ngày ↔ 🌙 Đêm', 0, 1, 0.01, 0, (v) => this.applyTimeOfDay(v)));

    // Camera override toggle
    const toggleRow = document.createElement('label');
    toggleRow.className = 'zoo3d-dev-row zoo3d-dev-checkbox-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.addEventListener('change', () => {
      this.devCameraOverride = checkbox.checked;
    });
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Tùy chỉnh camera (tắt tự xoay)';
    toggleRow.appendChild(checkbox);
    toggleRow.appendChild(toggleLabel);
    panel.appendChild(toggleRow);

    // Fog toggle
    const fogRow = document.createElement('label');
    fogRow.className = 'zoo3d-dev-row zoo3d-dev-checkbox-row';
    const fogCheckbox = document.createElement('input');
    fogCheckbox.type = 'checkbox';
    fogCheckbox.checked = true;
    fogCheckbox.addEventListener('change', () => {
      if (fogCheckbox.checked) {
        this.scene.fog = new THREE.Fog(0xbbe7f2, 16, 38);
      } else {
        this.scene.fog = null;
      }
    });
    const fogLabel = document.createElement('span');
    fogLabel.textContent = '🌫️ Bật/tắt Fog';
    fogRow.appendChild(fogCheckbox);
    fogRow.appendChild(fogLabel);
    panel.appendChild(fogRow);

    panel.appendChild(this.buildDevSlider('Khoảng cách', 3, 16, 0.1, this.devCam.distance, (v) => (this.devCam.distance = v)));
    panel.appendChild(this.buildDevSlider('Độ cao camera', 1, 14, 0.1, this.devCam.height, (v) => (this.devCam.height = v)));
    panel.appendChild(this.buildDevSlider('Góc xoay (yaw °)', -180, 180, 1, this.devCam.yawDeg, (v) => (this.devCam.yawDeg = v)));
    panel.appendChild(this.buildDevSlider('Điểm nhìn tới (Y)', -1, 4, 0.1, this.devCam.lookHeight, (v) => (this.devCam.lookHeight = v)));
    panel.appendChild(this.buildDevSlider('Góc nhìn (FOV)', 20, 90, 1, this.devCam.fov, (v) => (this.devCam.fov = v)));

    this.hud.appendChild(panel);
  }

  private buildDevSlider(
    label: string,
    min: number,
    max: number,
    step: number,
    initial: number,
    onChange: (value: number) => void
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'zoo3d-dev-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'zoo3d-dev-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'zoo3d-dev-value';
    valueEl.textContent = initial.toFixed(2);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(initial);
    slider.addEventListener('input', () => {
      const value = parseFloat(slider.value);
      valueEl.textContent = value.toFixed(2);
      onChange(value);
    });

    row.appendChild(labelEl);
    row.appendChild(slider);
    row.appendChild(valueEl);
    return row;
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

.zoo3d-dev-panel {
  position: absolute;
  top: 16px; right: 16px;
  width: 250px;
  max-height: calc(100% - 32px);
  overflow-y: auto;
  background: rgba(20, 20, 20, 0.85);
  color: #E0F2F1;
  border-radius: 12px;
  padding: 12px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: 'Fredoka', sans-serif;
}
.zoo3d-dev-title {
  font-weight: bold;
  font-size: 13px;
  color: #FFD54F;
}
.zoo3d-dev-readout {
  background: rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 6px 8px;
  font-family: Menlo, monospace;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre;
  margin: 0;
}
.zoo3d-dev-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.zoo3d-dev-checkbox-row {
  cursor: pointer;
  font-size: 11px;
}
.zoo3d-dev-label {
  flex: 0 0 96px;
  font-size: 11px;
  opacity: 0.85;
}
.zoo3d-dev-value {
  flex: 0 0 38px;
  text-align: right;
  font-family: Menlo, monospace;
  font-size: 11px;
}
.zoo3d-dev-row input[type="range"] {
  flex: 1;
  min-width: 0;
}
`;
