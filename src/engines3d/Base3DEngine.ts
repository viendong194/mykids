import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { computeFlockingSteering, type SteeringAgent } from './Steering';

let stylesInjected = false;

export interface SteppableAgent extends SteeringAgent {
  object: THREE.Object3D;
  speed: number;
}

/**
 * Framework-agnostic base for 3D mini-games rendered with Three.js.
 * Mirrors the role of BaseEngine (src/engines/BaseEngine.ts) for the 2D/Phaser
 * side, but owns its own renderer/canvas + an HTML overlay instead of Phaser
 * GameObjects, since 3D games run on a separate <canvas> alongside Phaser.
 */
export abstract class Base3DEngine {
  protected scene!: THREE.Scene;
  protected camera!: THREE.PerspectiveCamera;
  protected renderer!: THREE.WebGLRenderer;
  protected hud!: HTMLDivElement;
  protected readonly devMode = import.meta.env.DEV;

  private container!: HTMLElement;
  private loader = new GLTFLoader();
  private modelCache = new Map<string, Promise<THREE.Group>>();
  private rafId: number | null = null;
  private lastTime = 0;
  private destroyed = false;
  private raycaster = new THREE.Raycaster();
  private pickHandler: ((event: PointerEvent) => void) | null = null;

  public async mount(container: HTMLElement, width: number, height: number): Promise<void> {
    this.container = container;
    this.injectStylesOnce();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, Math.max(width, 1) / Math.max(height, 1), 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.container.appendChild(this.renderer.domElement);

    this.hud = document.createElement('div');
    this.hud.className = 'zoo3d-hud';
    this.container.appendChild(this.hud);

    await this.build();
    if (this.destroyed) return;
    this.startLoop();
  }

  /**
   * Loads (and caches) a glTF model, then normalizes it so its footprint is
   * centered at the local origin and its base sits at y=0, scaled to
   * targetHeight. Asset packs vary in native scale/pivot, so every consumer
   * gets predictable placement without hand-tuning each model.
   */
  protected loadModel(url: string, targetHeight: number): Promise<THREE.Group> {
    const cacheKey = `${url}::${targetHeight}`;
    let cached = this.modelCache.get(cacheKey);
    if (!cached) {
      cached = new Promise<THREE.Group>((resolve, reject) => {
        this.loader.load(
          url,
          (gltf) => {
            const root = gltf.scene;
            root.animations = gltf.animations;
            root.updateMatrixWorld(true);

            const rawBox = new THREE.Box3().setFromObject(root);
            const rawSize = new THREE.Vector3();
            rawBox.getSize(rawSize);
            const scale = rawSize.y > 0.0001 ? targetHeight / rawSize.y : 1;
            root.scale.setScalar(scale);
            root.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(root);
            // Footprint radius (ground-plane half-extent) so callers can space instances apart without overlap.
            root.userData.footprintRadius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;

            root.position.x -= (box.min.x + box.max.x) / 2;
            root.position.z -= (box.min.z + box.max.z) / 2;
            root.position.y -= box.min.y;

            resolve(root);
          },
          undefined,
          (err) => reject(err)
        );
      });
      this.modelCache.set(cacheKey, cached);
    }
    return cached;
  }

  /**
   * Cheap instance of an already-loaded template. Geometry/materials are
   * shared by reference (never mutated), so clones stay lightweight.
   * Uses SkeletonUtils (not plain Object3D.clone) so rigged/skinned models
   * (our animal pack ships idle/walk/etc. animation clips) get their own
   * independent skeleton instead of all instances sharing one pose.
   */
  protected cloneInstance(template: THREE.Object3D): THREE.Object3D {
    const clone = SkeletonUtils.clone(template) as THREE.Object3D;
    clone.animations = template.animations;
    clone.userData.footprintRadius = template.userData.footprintRadius;
    return clone;
  }

  /**
   * Looks up an animation clip baked into an instance by name (case-insensitive,
   * partial match), optionally excluding clips matching a name pattern (the
   * animal pack bundles combat/death clips alongside idle/walk ones).
   */
  protected findClip(instance: THREE.Object3D, nameHint: string, exclude?: RegExp): THREE.AnimationClip | null {
    const clips = instance.animations;
    if (!clips || clips.length === 0) return null;

    return (
      clips.find((c) => c.name === nameHint) ||
      clips.find((c) => new RegExp(nameHint, 'i').test(c.name) && (!exclude || !exclude.test(c.name))) ||
      null
    );
  }

  /**
   * Tags an object as tappable so setupRaycasting()'s hit-test can resolve
   * a raycast hit (which lands on some deep mesh) back up to it.
   */
  protected setPickable(root: THREE.Object3D, pickId: string) {
    root.userData.pickId = pickId;
  }

  /**
   * Wires tap-to-select on 3D objects (as opposed to HTML HUD buttons).
   * `getPickables` is called fresh on every tap so it always reflects the
   * current round's objects. NDC math uses the canvas's CSS bounding rect,
   * not its drawing-buffer resolution (those differ under devicePixelRatio).
   */
  protected setupRaycasting(getPickables: () => THREE.Object3D[], onPick: (pickId: string, point: THREE.Vector3) => void) {
    if (this.pickHandler) {
      this.renderer.domElement.removeEventListener('pointerdown', this.pickHandler);
    }

    this.pickHandler = (event: PointerEvent) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(ndc, this.camera);

      const hits = this.raycaster.intersectObjects(getPickables(), true);
      if (hits.length === 0) return;

      let current: THREE.Object3D | null = hits[0].object;
      while (current && current !== this.scene) {
        if (current.userData.pickId !== undefined) {
          onPick(current.userData.pickId as string, hits[0].point);
          return;
        }
        current = current.parent;
      }
    };

    this.renderer.domElement.addEventListener('pointerdown', this.pickHandler);
  }

  /** Projects a world position to HUD-local pixel coordinates (for confetti, floating labels, etc). */
  protected worldToScreen(pos: THREE.Vector3): { x: number; y: number } {
    const projected = pos.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((1 - projected.y) / 2) * rect.height,
    };
  }

  /**
   * One step of "walk toward a fixed target" — flocking-steered direction,
   * a hard positional collision-resolve against every other agent, a
   * play-area clamp, and an optional ground-height snap. Shared by any
   * per-agent state machine that needs directed movement (wandering picks a
   * new random target each arrival; herding always targets the pen).
   */
  protected stepAgentTowardTarget(
    agent: SteppableAgent,
    allAgents: SteeringAgent[],
    dt: number,
    opts: {
      playRadius: number;
      getGroundHeight?: (x: number, z: number) => number;
      arriveThreshold?: number;
      flockRange?: number;
      separationRange?: number;
    }
  ): { arrived: boolean; facingAngle: number } {
    const dx = agent.target.x - agent.object.position.x;
    const dz = agent.target.z - agent.object.position.z;
    const distToTarget = Math.hypot(dx, dz);
    const arriveThreshold = opts.arriveThreshold ?? 0.2;

    if (distToTarget < arriveThreshold) {
      return { arrived: true, facingAngle: Math.atan2(dx, dz) };
    }

    const move = computeFlockingSteering(agent, allAgents, opts.flockRange ?? 2.2, opts.separationRange ?? 0.55);

    const step = agent.speed * dt;
    let newX = agent.object.position.x + move.x * step;
    let newZ = agent.object.position.z + move.z * step;

    allAgents.forEach((other) => {
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

    const distFromCenter = Math.hypot(newX, newZ);
    if (distFromCenter > opts.playRadius) {
      const scale = opts.playRadius / distFromCenter;
      newX *= scale;
      newZ *= scale;
    }

    agent.object.position.x = newX;
    agent.object.position.z = newZ;
    if (opts.getGroundHeight) {
      agent.object.position.y = opts.getGroundHeight(newX, newZ);
    }

    return { arrived: false, facingAngle: Math.atan2(move.x, move.z) };
  }

  protected lerpAngle(from: number, to: number, t: number): number {
    let diff = (to - from) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * t;
  }

  protected abstract build(): Promise<void>;
  protected update(_dt: number): void {}

  private startLoop() {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      if (this.destroyed) return;
      const dt = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public resize(width: number, height: number): void {
    if (!this.renderer || width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.modelCache.forEach((promise) => {
      promise.then((template) => this.disposeHierarchy(template)).catch(() => {});
    });
    this.modelCache.clear();

    if (this.pickHandler) {
      this.renderer.domElement.removeEventListener('pointerdown', this.pickHandler);
      this.pickHandler = null;
    }

    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
    if (this.hud) {
      this.hud.remove();
    }
  }

  private disposeHierarchy(object: THREE.Object3D) {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material?.dispose();
        }
      }
    });
  }

  private injectStylesOnce() {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement('style');
    style.id = 'zoo3d-styles';
    style.textContent = ZOO3D_BASE_CSS;
    document.head.appendChild(style);
  }
}

const ZOO3D_BASE_CSS = `
.zoo3d-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: 'Fredoka', sans-serif;
}
.zoo3d-hud button, .zoo3d-hud .zoo3d-clickable {
  pointer-events: auto;
  cursor: pointer;
  border: 0;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
`;
