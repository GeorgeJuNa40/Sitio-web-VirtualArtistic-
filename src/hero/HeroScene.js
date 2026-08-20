import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import vertSrc from './glsl/core.vert.glsl?raw';
import logoFragSrc from './glsl/logo.frag.glsl?raw';
import compositeFragSrc from './glsl/composite.frag.glsl?raw';
import noiseSrc from './glsl/simplexNoise.glsl?raw';

/**
 * "Sello vivo" hero: the brand mark on a full-screen quad, re-lit as gold metal
 * by logo.frag — foil sweep, cursor parallax, slow spin, scroll dissolve. Far
 * cheaper than raymarching, so 60fps holds on every tier.
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
    this._initPost();
    this._loadLogo();
    this._bindEvents();
    this.resize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false
    });
    this._dpr = Math.min(window.devicePixelRatio || 1, 2) * this.tier.renderScale;
    this.renderer.setPixelRatio(this._dpr);
    this.renderer.setClearColor(0x050506, 1);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);

    this.uniforms = {
      uLogo: { value: null },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uMouseVelocity: { value: 0 },
      uScrollProgress: { value: 0 },
      uCenter: { value: new THREE.Vector2(0.66, 0.5) },
      uLogoHalf: { value: 300 }
    };

    const fragment = logoFragSrc.replace(
      '// snoise(vec3) prepended at build time.',
      noiseSrc
    );

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertSrc,
      fragmentShader: fragment,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      glslVersion: THREE.GLSL1
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  _loadLogo() {
    // Preferred URL: a global set by the artifact preview (inlined data URI);
    // otherwise the public asset resolved against the app base.
    const url =
      (typeof window !== 'undefined' && window.__LOGO_URL__) ||
      (import.meta.env.BASE_URL || '/') + 'logo.png';

    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        this.uniforms.uLogo.value = tex;
        this._logoAspect = tex.image.width / tex.image.height;
        this._textureReady = true;
      },
      undefined,
      () => {
        // Logo missing: reveal anyway so nothing hangs; the backdrop still paints.
        this._textureReady = true;
      }
    );
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.tier.bloom) {
      // High threshold, gentle strength: only the brightest foil highlights
      // bloom, so the mark stays crisp rather than hazy.
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.45, 0.82);
      this.composer.addPass(this.bloom);
    }

    if (this.tier.composite) {
      this.compositePass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uAberration: { value: 0.14 },
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

    this.renderer.setSize(w, h, false);
    if (this.composer) this.composer.setSize(w, h);

    const bw = w * this._dpr;
    const bh = h * this._dpr;
    this.uniforms.uResolution.value.set(bw, bh);
    if (this.compositePass) this.compositePass.uniforms.uResolution.value.set(bw, bh);
    if (this.bloom) this.bloom.setSize(w, h);

    // Responsive composition: mark to the right on landscape, upper-right and
    // smaller on portrait, so the left-aligned headline keeps a dark column.
    // Note: uCenter is in plane UV where y=0 is the BOTTOM of the screen.
    const portrait = h >= w;
    const minDim = Math.min(bw, bh);
    if (portrait) {
      // Lower-right accent, clear of the white headline (white-on-gold would be
      // low-contrast). y=0.26 sits it in the bottom third.
      this.uniforms.uCenter.value.set(0.72, 0.26);
      this.uniforms.uLogoHalf.value = minDim * 0.32;
    } else {
      this.uniforms.uCenter.value.set(0.7, 0.5);
      this.uniforms.uLogoHalf.value = minDim * 0.42;
    }
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
    const elapsed = this.clock.elapsedTime;

    this.pointer.update();

    this.uniforms.uTime.value = elapsed;
    this.uniforms.uMouse.value.set(this.pointer.mouse.x, this.pointer.mouse.y);
    this.uniforms.uMouseVelocity.value = this.pointer.velocity;
    this.uniforms.uScrollProgress.value = this.scrollProgress;
    if (this.compositePass) this.compositePass.uniforms.uTime.value = elapsed;

    if (this._usePost) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    // Reveal only once the logo is loaded and a couple of frames have painted.
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

    this.mesh.geometry.dispose();
    this.material.dispose();
    if (this.uniforms.uLogo.value) this.uniforms.uLogo.value.dispose();

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
