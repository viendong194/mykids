import * as THREE from 'three';
import { fractalNoise } from './PerlinNoise';
import dioramaConfig from '../config/dioramaConfig.json';

export interface DioramaDecorSpec {
  file: string;
  height: number;
}

export interface BuildTerrainOptions {
  decor: DioramaDecorSpec[];
  decorRingCount?: number;
  decorRingRadius?: number;
  grassCount?: number;
  grassRadius?: number;
  bowlStart?: number;
}

export interface DevCamState {
  distance: number;
  height: number;
  yawDeg: number;
  lookHeight: number;
  fov: number;
}

const DEFAULT_DEV_CAM: DevCamState = { distance: 10, height: 3.2, yawDeg: -20, lookHeight: 0.8, fov: 50 };

let dioramaStylesInjected = false;

/**
 * Reusable "3D diorama" building blocks shared by every Vườn thú 3D game:
 * bumpy terrain with Perlin-painted ground, sun/moon day-night orbit,
 * real-time shadows, night fireflies, and a dev-only camera/lighting panel.
 * Composed by each concrete engine (not inherited) — see Base3DEngine for
 * the framework-level concerns (mount/load/clone/raycasting/render loop).
 */
export class DioramaKit {
  public devCameraOverride = true;
  public devCam: DevCamState;

  private readonly devMode = false;

  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private cameraLight!: THREE.DirectionalLight;
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private starField!: THREE.Group;
  private fireflies!: THREE.Points;
  private fireflyData: { x: number; y: number; z: number; vx: number; vy: number; vz: number; phase: number; blinkSpeed: number }[] = [];
  private groundMaterial!: THREE.MeshStandardMaterial;
  private currentNightTime = 0;
  private timeOfDayAngle = 0;
  private cameraAngle = 0;
  private bowlStart = 7.5;
  public isLakePond = false;
  private waterMesh: THREE.Mesh | null = null;

  private devReadoutEl: HTMLPreElement | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private hud: HTMLDivElement;
  private loadModel: (url: string, height: number) => Promise<THREE.Group>;
  private cloneInstance: (template: THREE.Object3D) => THREE.Object3D;

  private gameId: string;
  private dioramaConfig: any = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    hud: HTMLDivElement,
    loadModel: (url: string, height: number) => Promise<THREE.Group>,
    cloneInstance: (template: THREE.Object3D) => THREE.Object3D,
    gameId: string
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.hud = hud;
    this.loadModel = loadModel;
    this.cloneInstance = cloneInstance;
    this.gameId = gameId;
    this.devCam = { ...DEFAULT_DEV_CAM };

    this.applyGameConfig();
  }

  private applyGameConfig() {
    const config = dioramaConfig.games[this.gameId as keyof typeof dioramaConfig.games];
    if (config) {
      this.dioramaConfig = config;
      this.isLakePond = !!config.water;
      if (config.camera) {
        this.devCam = {
          distance: config.camera.distance,
          height: config.camera.height,
          yawDeg: config.camera.yawDeg,
          lookHeight: config.camera.lookHeight,
          fov: config.camera.fov
        };
      } else {
        this.devCam = { ...DEFAULT_DEV_CAM };
      }
    } else {
      this.devCam = { ...DEFAULT_DEV_CAM };
    }
  }

  // ---------- Lighting / sky / celestial bodies ----------

  public setupLighting() {
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is ~30% heavier, PCF is sufficient

    this.scene.fog = new THREE.Fog(0xbbe7f2, 16, 38);

    this.hemiLight = new THREE.HemisphereLight(0xe1f5fe, 0x8d6e63, 1.1);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sunLight.position.set(4, 8, 5);
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

    const sunGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

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

    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    return new THREE.CanvasTexture(canvas);
  }

  private buildStarField(): THREE.Group {
    const group = new THREE.Group();
    const texture = this.createCircleTexture();

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
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
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
        blending: THREE.AdditiveBlending,
      });
      group.add(new THREE.Points(geometry, material));
    }

    return group;
  }

  /**
   * Blends sky/fog/lighting/ground between a day and a night look.
   * t=0 is full daylight, t=1 is full night (stars fade in as t rises).
   */
  public applyTimeOfDay(t: number) {
    const time = THREE.MathUtils.clamp(t, 0, 1);

    const sky = new THREE.Color(0xbbe7f2).lerp(new THREE.Color(0x0b1330), time);
    this.scene.background = sky;
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.copy(sky);

    this.hemiLight.color.set(0xe1f5fe).lerp(new THREE.Color(0xffecb3), time);
    this.hemiLight.groundColor.set(0x8d6e63).lerp(new THREE.Color(0x221a15), time);
    this.hemiLight.intensity = THREE.MathUtils.lerp(1.1, 0.70, time);

    // Sun/Moon orbit behind the ground plane (z = -34)
    const R_orbit = 28;
    const theta = Math.PI / 2 - time * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    if (this.sunMesh) this.sunMesh.position.set(cosTheta * R_orbit, sinTheta * 20 - 4, -34);
    if (this.moonMesh) this.moonMesh.position.set(-cosTheta * R_orbit, -sinTheta * 20 - 4, -34);

    this.sunLight.color.set(0xffffff).lerp(new THREE.Color(0xfffde7), time);
    this.sunLight.intensity = THREE.MathUtils.lerp(1.4, 0.55, time);
    if (time < 0.5) {
      if (this.sunMesh) this.sunLight.position.copy(this.sunMesh.position.clone().normalize().multiplyScalar(15));
    } else {
      if (this.moonMesh) this.sunLight.position.copy(this.moonMesh.position.clone().normalize().multiplyScalar(15));
    }

    if (this.groundMaterial) {
      // When vertexColors=true the material color is a tint multiplier.
      // Use white (no tint) at day so Perlin vertex colors show through; darken at night.
      this.groundMaterial.color.set(0xffffff).lerp(new THREE.Color(0x3c593e), time);
    }

    if (this.cameraLight) {
      this.cameraLight.color.set(0xffffff).lerp(new THREE.Color(0xfffde7), time);
      this.cameraLight.intensity = THREE.MathUtils.lerp(0.8, 0.50, time);
    }

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

  public getGroundHeight(x: number, z: number): number {
    const bump = Math.sin(x * 0.8) * Math.cos(z * 0.8) * 0.15 + Math.sin(x * 2.0) * 0.05;

    const r = Math.sqrt(x * x + z * z);
    if (this.isLakePond && r < 7.5) {
      // Create a nice bowl/basin for the pond: -1.2 in the center, sloping up to 0 at r = 7.5
      const depth = -1.2 * (1 - r / 7.5);
      return depth + bump * 0.2;
    }

    if (r <= this.bowlStart) return bump;

    const t = r - this.bowlStart;
    const mountainNoise = fractalNoise(x * 0.22, z * 0.22, 3, 0.55, 2.0);
    const tCapped = Math.min(t, 8);
    const rise = tCapped * 0.006 + mountainNoise * tCapped * 0.03;
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

      f.vx += (Math.random() - 0.5) * 0.15 * dt;
      f.vy += (Math.random() - 0.5) * 0.08 * dt;
      f.vz += (Math.random() - 0.5) * 0.15 * dt;

      const speed = Math.hypot(f.vx, f.vz);
      if (speed > 0.35) {
        f.vx = (f.vx / speed) * 0.35;
        f.vz = (f.vz / speed) * 0.35;
      }
      if (Math.abs(f.vy) > 0.12) f.vy = Math.sign(f.vy) * 0.12;

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;

      const dist = Math.hypot(f.x, f.z);
      if (dist > 5.5) {
        f.vx = -f.vx * 0.8 + (0 - f.x) * 0.05;
        f.vz = -f.vz * 0.8 + (0 - f.z) * 0.05;
      }

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

      f.phase += f.blinkSpeed * dt;
      const wave = 0.5 + 0.5 * Math.sin(f.phase);
      const brightness = nightRatio * (0.2 + 0.8 * wave);

      colors[i * 3] = baseR * brightness;
      colors[i * 3 + 1] = baseG * brightness;
      colors[i * 3 + 2] = baseB * brightness;
    }

    if (nightRatio > 0.05) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  }

  // ---------- Terrain / decor ----------

  public async buildTerrainGround(opts?: BuildTerrainOptions): Promise<void> {
    const configTerrain = this.dioramaConfig?.terrain;
    const decor = configTerrain?.decor ?? opts?.decor ?? [];
    const decorRingCount = configTerrain?.decorRingCount ?? opts?.decorRingCount ?? 12;
    const decorRingRadius = configTerrain?.decorRingRadius ?? opts?.decorRingRadius ?? 5.6;
    const grassCount = configTerrain?.grassCount ?? opts?.grassCount ?? 18;
    const grassRadius = configTerrain?.grassRadius ?? opts?.grassRadius ?? 4.5;
    this.bowlStart = configTerrain?.bowlStart ?? opts?.bowlStart ?? 7.5;

    const SEG = 50; // 50×50 = 2,601 verts / 5,000 tris — large enough that edges fall deep inside fog
    const SIZE = 60;
    const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);

    const posAttr = groundGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const colorDeep = new THREE.Color(0x1b5e20);
    const colorDark = new THREE.Color(0x33691e);
    const colorMid = new THREE.Color(0x7cb342);
    const colorYellow = new THREE.Color(0xc8a84b);
    const colorSand = new THREE.Color(0xbfa07a);

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i); // plane-space Y = world Z (pre-rotation)

      posAttr.setZ(i, this.getGroundHeight(x, y));

      const r = Math.sqrt(x * x + y * y);
      const noise = r < 12 ? fractalNoise(x * 0.6, y * 0.6, 4, 0.5, 2.0) : 0;
      const noise2 = r < 12 ? fractalNoise(x * 0.35 + 17, y * 0.35 + 31, 3, 0.6, 2.0) : 0;

      let vertexColor: THREE.Color;
      if (this.isLakePond && r < 7.5) {
        // Pond bed: sand/mud blend
        const lerpRatio = r / 7.5;
        vertexColor = colorSand.clone().lerp(new THREE.Color(0x3e2723), 1 - lerpRatio);
      } else {
        if (noise < 0.22) {
          vertexColor = colorDeep.clone().lerp(colorDark, noise / 0.22);
        } else if (noise < 0.5) {
          vertexColor = colorDark.clone().lerp(colorMid, (noise - 0.22) / 0.28);
        } else if (noise < 0.72) {
          vertexColor = colorMid.clone().lerp(colorYellow, (noise - 0.5) / 0.22);
        } else {
          vertexColor = colorYellow.clone().lerp(colorSand, (noise - 0.72) / 0.28);
        }

        if (noise2 > 0.72) {
          vertexColor.lerp(colorSand, ((noise2 - 0.72) / 0.28) * 0.6);
        }
      }

      colors[i * 3] = vertexColor.r;
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

    if (decor.length > 0) {
      const distinctDecor = Array.from(new Map(decor.map((d: any) => [d.file, d])).values());
      await Promise.all(distinctDecor.map((d: any) => this.loadModel(`assets/3d/nature/${d.file}.glb`, d.height)));

      for (let i = 0; i < decorRingCount; i++) {
        const d = decor[i % decor.length];
        const template = await this.loadModel(`assets/3d/nature/${d.file}.glb`, d.height);
        const instance = this.cloneInstance(template);
        this.enableShadows(instance);

        const angle = (i / decorRingCount) * Math.PI * 2;
        const r = decorRingRadius + (Math.random() - 0.5) * 0.8;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        instance.position.set(x, this.getGroundHeight(x, z), z);
        instance.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(instance);
      }
    }

    const grassTemplate = await this.loadModel('assets/3d/nature/grass.glb', 0.3);
    for (let i = 0; i < grassCount; i++) {
      const instance = this.cloneInstance(grassTemplate);
      this.enableShadows(instance);

      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * grassRadius;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      instance.position.set(x, this.getGroundHeight(x, z), z);
      instance.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(instance);
    }

    if (this.dioramaConfig?.water) {
      this.buildWaterPlane(
        this.dioramaConfig.water.radius,
        this.dioramaConfig.water.height
      );
    }

    await this.buildProps();
  }

  public buildWaterPlane(radius = 7.3, height = -0.25) {
    const colorVal = this.dioramaConfig?.water?.color ?? "#00bcd4";
    const opacityVal = this.dioramaConfig?.water?.opacity ?? 0.65;
    const roughnessVal = this.dioramaConfig?.water?.roughness ?? 0.1;
    const metalnessVal = this.dioramaConfig?.water?.metalness ?? 0.1;
    const geometry = new THREE.CircleGeometry(radius, 64);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorVal),
      roughness: roughnessVal,
      metalness: metalnessVal,
      transparent: true,
      opacity: opacityVal,
      side: THREE.DoubleSide
    });
    this.waterMesh = new THREE.Mesh(geometry, material);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = height;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  public async buildProps(): Promise<void> {
    const props = this.dioramaConfig?.props;
    if (props && props.length > 0) {
      await Promise.all(props.map(async (p: any) => {
        const template = await this.loadModel(p.file, p.scale ?? 1.0);
        const instance = this.cloneInstance(template);
        if (p.position) instance.position.set(p.position[0], p.position[1], p.position[2]);
        if (p.rotation) instance.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2]);
        this.enableShadows(instance);
        this.scene.add(instance);
      }));
    }
  }

  public enableShadows(object: THREE.Object3D) {
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  // ---------- Camera ----------

  public setupCamera() {
    const yaw = THREE.MathUtils.degToRad(this.devCam.yawDeg);
    this.camera.position.set(Math.sin(yaw) * this.devCam.distance, this.devCam.height, Math.cos(yaw) * this.devCam.distance);
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

  /**
   * Per-frame tick: drives the camera (manual override or gentle auto-sway),
   * the camera-following fill light, and fireflies. Pass `autoDayNight: true`
   * to have the diorama continuously cycle day↔night on its own (used by the
   * counting game for ambiance); games that drive time-of-day from their own
   * round logic (e.g. the day/night odd-one-out game) should pass `false` and
   * call `applyTimeOfDay()` themselves.
   */
  public tick(dt: number, opts: { autoDayNight: boolean }) {
    if (this.devCameraOverride) {
      this.applyDevCamera();
    } else {
      this.cameraAngle += dt * 0.15;
      const yaw = THREE.MathUtils.degToRad(this.devCam.yawDeg) + Math.sin(this.cameraAngle) * 0.25;
      const height = this.devCam.height + Math.sin(this.cameraAngle * 0.6) * 0.2;
      this.camera.position.set(Math.sin(yaw) * this.devCam.distance, height, Math.cos(yaw) * this.devCam.distance);
      this.camera.lookAt(0, this.devCam.lookHeight, 0);
    }

    if (this.waterMesh) {
      const speed = this.dioramaConfig?.water?.waveSpeed ?? 0.0015;
      const waveH = this.dioramaConfig?.water?.waveHeight ?? 0.012;
      const baseH = this.dioramaConfig?.water?.height ?? -0.25;
      const time = performance.now() * speed;
      this.waterMesh.position.y = baseH + Math.sin(time) * waveH;
      this.waterMesh.rotation.z = time * 0.02;
    }

    if (opts.autoDayNight) {
      const speed = this.dioramaConfig?.dayNight?.daySpeed ?? 0.08;
      this.timeOfDayAngle += dt * speed;
      this.applyTimeOfDay(0.5 - 0.5 * Math.sin(this.timeOfDayAngle));
    }

    if (this.cameraLight) this.cameraLight.position.copy(this.camera.position);

    this.updateFireflies(dt);

    if (this.devMode) this.updateDevReadout();
  }

  // ---------- Dev panel (only built when running `npm run dev`) ----------

  public buildDevPanel(title: string, extraRows: HTMLElement[] = []) {
    if (!this.devMode) return;
    this.injectDioramaStylesOnce();

    const panel = document.createElement('div');
    panel.className = 'zoo3d-dev-panel';

    const titleEl = document.createElement('div');
    titleEl.className = 'zoo3d-dev-title';
    titleEl.textContent = title;
    panel.appendChild(titleEl);

    this.devReadoutEl = document.createElement('pre');
    this.devReadoutEl.className = 'zoo3d-dev-readout';
    panel.appendChild(this.devReadoutEl);

    panel.appendChild(this.buildDevSlider('☀️ Ngày ↔ 🌙 Đêm', 0, 1, 0.01, 0, (v) => this.applyTimeOfDay(v)));

    const toggleRow = document.createElement('label');
    toggleRow.className = 'zoo3d-dev-row zoo3d-dev-checkbox-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.devCameraOverride;
    checkbox.addEventListener('change', () => {
      this.devCameraOverride = checkbox.checked;
    });
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Tùy chỉnh camera (tắt tự xoay)';
    toggleRow.appendChild(checkbox);
    toggleRow.appendChild(toggleLabel);
    panel.appendChild(toggleRow);

    const fogRow = document.createElement('label');
    fogRow.className = 'zoo3d-dev-row zoo3d-dev-checkbox-row';
    const fogCheckbox = document.createElement('input');
    fogCheckbox.type = 'checkbox';
    fogCheckbox.checked = true;
    fogCheckbox.addEventListener('change', () => {
      this.scene.fog = fogCheckbox.checked ? new THREE.Fog(0xbbe7f2, 16, 38) : null;
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

    extraRows.forEach((row) => panel.appendChild(row));

    this.hud.appendChild(panel);
  }

  public buildDevSlider(
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

  private injectDioramaStylesOnce() {
    if (dioramaStylesInjected) return;
    dioramaStylesInjected = true;

    const style = document.createElement('style');
    style.id = 'zoo3d-diorama-dev-styles';
    style.textContent = DIORAMA_DEV_CSS;
    document.head.appendChild(style);
  }
}

const DIORAMA_DEV_CSS = `
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
