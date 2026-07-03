import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let stylesInjected = false;

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

  private container!: HTMLElement;
  private loader = new GLTFLoader();
  private modelCache = new Map<string, Promise<THREE.Group>>();
  private rafId: number | null = null;
  private lastTime = 0;
  private destroyed = false;

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
