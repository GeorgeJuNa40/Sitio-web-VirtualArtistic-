import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import logoVertSrc from './glsl/logoPlane.vert.glsl?raw';
import logoFragSrc from './glsl/logoPlane.frag.glsl?raw';
import compositeFragSrc from './glsl/composite.frag.glsl?raw';
import noiseSrc from './glsl/simplexNoise.glsl?raw';

/**
 * Hero 3D scene: a slow, sober field of floating metallic figures around the
 * brand logo. Perspective camera parallaxes with cursor / gyroscope; scroll
 * disperses the figures and dissolves the logo. Real metal via a procedural
 * RoomEnvironment (no external HDR needed).
 */
export class HeroScene {
  constructor({ canvas, tier, pointer, quality, onReady }) {
    this.canvas = canvas;
    this.tier = tier;
    this.pointer = pointer;
    this.qualityInfo = quality;
    this.onReady = onReady || (() => {});

    this.scrollProgress = 0;
    this._running = false;
    this._visible = true;
    this._contextLost = false;
    this._disposed = false;
    this._textureReady = false;
    this._revealed = false;
    this._frames = 0;

    this.clock = new THREE.Clock();

    this._initRenderer();
    this._initScene();
    this._initFigures();
    this._initLogo();
    this._initPost();
    this._bindEvents();
    this.resize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.tier.name === 'full',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false
    });
    this._dpr = Math.min(window.devicePixelRatio || 1, 2) * this.tier.renderScale;
    this.renderer.setPixelRatio(this._dpr);
    this.renderer.setClearColor(0x060608, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060608);
    this.scene.fog = new THREE.FogExp2(0x060608, 0.085);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 8);
    this.camera.lookAt(0, 0, 0);

    // Procedural environment → believable metal reflections without HDR files.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // Two opposed lights, cold + warm, echoing the original lighting concept.
    const cold = new THREE.DirectionalLight(0x9fc3ff, 1.6);
    cold.position.set(-4, 5, 3);
    const warm = new THREE.DirectionalLight(0xffb066, 1.4);
    warm.position.set(5, -2, 2);
    const amb = new THREE.AmbientLight(0x404050, 0.6);
    this.scene.add(cold, warm, amb);
  }

  _initFigures() {
    const count =
      this.tier.name === 'full' ? 16 : this.tier.name === 'mid' ? 10 : 6;

    const geoms = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.TorusGeometry(0.7, 0.28, 16, 40),
      new THREE.CapsuleGeometry(0.5, 0.7, 6, 14)
    ];
    this._geoms = geoms;

    this.goldMat = new THREE.MeshStandardMaterial({
      color: 0xd99a1f,
      metalness: 1.0,
      roughness: 0.32,
      envMapIntensity: 1.1,
      transparent: true,
      opacity: 1
    });
    this.darkMat = new THREE.MeshStandardMaterial({
      color: 0x15151a,
      metalness: 0.9,
      roughness: 0.45,
      envMapIntensity: 0.9,
      transparent: true,
      opacity: 1
    });

    this.figures = [];
    this.figureGroup = new THREE.Group();
    this.scene.add(this.figureGroup);

    for (let i = 0; i < count; i++) {
      const geo = geoms[i % geoms.length];
      // Keep it sober: mostly dark metal with a few gold accents.
      const mat = i % 4 === 0 ? this.goldMat : this.darkMat;
      const mesh = new THREE.Mesh(geo, mat);

      // Spread across a volume, biased away from the far left (text column).
      const base = new THREE.Vector3(
        THREE.MathUtils.randFloat(-3.2, 6.2),
        THREE.MathUtils.randFloat(-3.6, 3.6),
        THREE.MathUtils.randFloat(-7.0, 1.0)
      );
      mesh.position.copy(base);
      const s = THREE.MathUtils.randFloat(0.28, 0.85);
      mesh.scale.setScalar(s);
      mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, 0);

      this.figures.push({
        mesh,
        base,
        rot: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.12),
          THREE.MathUtils.randFloatSpread(0.12),
          THREE.MathUtils.randFloatSpread(0.08)
        ),
        floatAmp: THREE.MathUtils.randFloat(0.1, 0.4),
        floatSpeed: THREE.MathUtils.randFloat(0.2, 0.6),
        phase: Math.random() * 6.28,
        dir: base.clone().normalize()
      });
      this.figureGroup.add(mesh);
    }
  }

  _initLogo() {
    this.logoUniforms = {
      uLogo: { value: null },
      uTime: { value: 0 },
      uScrollProgress: { value: 0 },
      uMouseVelocity: { value: 0 }
    };
    const frag = logoFragSrc.replace(
      '// snoise(vec3) prepended at build time.',
      noiseSrc
    );
    this.logoMat = new THREE.ShaderMaterial({
      vertexShader: logoVertSrc,
      fragmentShader: frag,
      uniforms: this.logoUniforms,
      transparent: true,
      depthWrite: false,
      glslVersion: THREE.GLSL1
    });
    this.logoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.logoMat);
    this.logoMesh.position.set(0, 0, 0.5);
    this.logoMesh.renderOrder = 10;
    this.scene.add(this.logoMesh);

    const url =
      (typeof window !== 'undefined' && window.__LOGO_URL__) ||
      (import.meta.env.BASE_URL || '/') + 'logo.png';
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        this.logoUniforms.uLogo.value = tex;
        this._textureReady = true;
      },
      undefined,
      () => {
        this._textureReady = true;
      }
    );
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.tier.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.7, 0.72);
      this.composer.addPass(this.bloom);
    }
    if (this.tier.composite) {
      this.compositePass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uAberration: { value: 0.0 },
          uGrain: { value: 0.03 }
        },
        vertexShader:
          'varying vec2 vUv;\nvoid main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: compositeFragSrc
      });
      this.composer.addPass(this.compositePass);
    }
    this._usePost = this.tier.bloom || this.tier.composite;
  }

  _bindEvents() {
    this._onResize = () => this.resize();
    this._onVisibility = () => {
      this._visible = document.visibilityState === 'visible';
      if (this._visible) this.clock.getDelta();
    };
    this._onContextLost = (e) => {
      e.preventDefault();
      this._contextLost = true;
    };
    this._onContextRestored = () => {
      this._contextLost = false;
      this.resize();
    };
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
    if (this.compositePass) {
      this.compositePass.uniforms.uResolution.value.set(w * this._dpr, h * this._dpr);
    }

    // Fit the logo plane to the view and compose it: to the right on landscape,
    // lower-right and smaller on portrait, so the headline keeps a dark column.
    const dist = this.camera.position.z - this.logoMesh.position.z;
    const visH = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * dist;
    const visW = visH * this.camera.aspect;
    const portrait = h >= w;
    let size, cx, cy;
    if (portrait) {
      size = Math.min(visW, visH) * 0.62;
      cx = visW * 0.16;
      cy = -visH * 0.16;
    } else {
      size = visH * 0.72;
      cx = visW * 0.2;
      cy = 0;
    }
    this.logoMesh.scale.set(size, size, 1);
    this.logoMesh.position.set(cx, cy, this.logoMesh.position.z);
  }

  setScrollProgress(p) {
    this.scrollProgress = p;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.getDelta();
  }

  frame() {
    if (!this._running || this._disposed) return;
    if (!this._visible || this._contextLost) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const diss = Math.min(Math.max(this.scrollProgress, 0), 1);

    this.pointer.update();
    const mx = this.pointer.mouse.x;
    const my = this.pointer.mouse.y;

    // Parallax: the whole field shifts with cursor / gyro, slow and contained.
    const camTargetX = mx * 0.9;
    const camTargetY = my * 0.6;
    this.camera.position.x += (camTargetX - this.camera.position.x) * 0.04;
    this.camera.position.y += (camTargetY - this.camera.position.y) * 0.04;
    this.camera.lookAt(0, 0, 0);

    // Floating figures: gentle self-rotation + drift; disperse & fade on scroll.
    for (let i = 0; i < this.figures.length; i++) {
      const f = this.figures[i];
      const m = f.mesh;
      m.rotation.x += f.rot.x * dt;
      m.rotation.y += f.rot.y * dt;
      m.rotation.z += f.rot.z * dt;
      const floatY = Math.sin(t * f.floatSpeed + f.phase) * f.floatAmp;
      const push = diss * 5.0;
      m.position.set(
        f.base.x + f.dir.x * push,
        f.base.y + floatY + f.dir.y * push + diss * 1.5,
        f.base.z + f.dir.z * push
      );
    }
    const figOpacity = 1.0 - diss;
    this.goldMat.opacity = figOpacity;
    this.darkMat.opacity = figOpacity;

    this.logoUniforms.uTime.value = t;
    this.logoUniforms.uScrollProgress.value = diss;
    this.logoUniforms.uMouseVelocity.value = this.pointer.velocity;
    if (this.compositePass) this.compositePass.uniforms.uTime.value = t;

    if (this._usePost) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    if (!this._revealed && this._textureReady && ++this._frames >= 2) {
      this._revealed = true;
      this.canvas.style.opacity = '1';
      this.onReady();
    }
  }

  dispose() {
    this._disposed = true;
    this._running = false;

    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);

    this._geoms.forEach((g) => g.dispose());
    this.logoMesh.geometry.dispose();
    this.goldMat.dispose();
    this.darkMat.dispose();
    this.logoMat.dispose();
    if (this.logoUniforms.uLogo.value) this.logoUniforms.uLogo.value.dispose();
    if (this.envRT) this.envRT.dispose();

    if (this.bloom && this.bloom.dispose) this.bloom.dispose();
    if (this.composer) {
      this.composer.passes.forEach((p) => p.dispose && p.dispose());
      this.composer.renderTarget1 && this.composer.renderTarget1.dispose();
      this.composer.renderTarget2 && this.composer.renderTarget2.dispose();
    }
    this.renderer.dispose();
    const gl = this.renderer.getContext();
    const lose = gl && gl.getExtension && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }
}
