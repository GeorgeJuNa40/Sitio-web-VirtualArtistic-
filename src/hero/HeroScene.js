import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import vertSrc from './glsl/core.vert.glsl?raw';
import coreFragSrc from './glsl/core.frag.glsl?raw';
import lowFragSrc from './glsl/low.frag.glsl?raw';
import compositeFragSrc from './glsl/composite.frag.glsl?raw';
import noiseSrc from './glsl/simplexNoise.glsl?raw';

/**
 * Owns the WebGL renderer, the fullscreen raymarch quad, post-processing and
 * the render loop. Built for a strict 16.6ms budget and clean teardown.
 */
export class HeroScene {
  constructor({ canvas, tier, pointer, quality }) {
    this.canvas = canvas;
    this.tier = tier;
    this.pointer = pointer;
    this.qualityInfo = quality;

    this.scrollProgress = 0;
    this._running = false;
    this._visible = true;
    this._contextLost = false;
    this._disposed = false;

    this.clock = new THREE.Clock();

    this._initRenderer();
    this._initScene();
    this._initPost();
    this._bindEvents();
    this.resize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // raymarch edges are soft; MSAA would waste budget
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false
    });
    // DPR capped at 2 to protect mobile GPUs, then scaled down per tier.
    this._dpr = Math.min(window.devicePixelRatio || 1, 2) * this.tier.renderScale;
    this.renderer.setPixelRatio(this._dpr);
    this.renderer.setClearColor(0x050506, 1);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);

    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uMouseVelocity: { value: 0 },
      uScrollProgress: { value: 0 },
      uPixelRatio: { value: this._dpr }
    };

    const isLow = this.tier.name === 'low';

    let fragment;
    if (isLow) {
      fragment = lowFragSrc;
    } else {
      // Compose: precision-safe noise + compile-time quality defines + body.
      const defines = `#define OCTAVES ${this.tier.octaves}\n#define MAX_STEPS ${this.tier.maxSteps}\n`;
      // Insert noise + defines right after the uniforms/varyings preamble by
      // placing them before the first function. Simplest robust approach:
      // prepend defines, then noise, then the core body — but the core body's
      // `precision`/uniforms must come first. So we splice at a marker line.
      fragment = coreFragSrc.replace(
        '// snoise(vec3) is prepended at build time (simplexNoise.glsl).',
        `${defines}\n${noiseSrc}`
      );
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertSrc,
      fragmentShader: fragment,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      // GLSL1 across all tiers: the shaders avoid ES 3.0-only builtins, so a
      // single source path runs identically on WebGL1 and WebGL2.
      glslVersion: THREE.GLSL1
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.tier.bloom) {
      // High threshold, low strength — the rim glows, nothing blows out.
      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        0.5, // strength
        0.7, // radius
        0.82 // threshold
      );
      this.composer.addPass(this.bloom);
    }

    if (this.tier.composite) {
      this.compositePass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uAberration: { value: 1.4 },
          uGrain: { value: 0.04 }
        },
        vertexShader:
          'varying vec2 vUv;\nvoid main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: compositeFragSrc
      });
      this.composer.addPass(this.compositePass);
    }

    // Whether we route through the composer at all.
    this._usePost = this.tier.bloom || this.tier.composite;
  }

  _bindEvents() {
    this._onResize = () => this.resize();
    this._onVisibility = () => {
      this._visible = document.visibilityState === 'visible';
      // Reset the clock delta so returning to the tab doesn't jump the noise.
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

    // Buffer resolution in device pixels for the raymarcher / grain.
    const bw = w * this._dpr;
    const bh = h * this._dpr;
    this.uniforms.uResolution.value.set(bw, bh);
    if (this.compositePass) {
      this.compositePass.uniforms.uResolution.value.set(bw, bh);
    }
    if (this.bloom) this.bloom.setSize(w, h);
  }

  setScrollProgress(p) {
    this.scrollProgress = p;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.getDelta();
  }

  // Called from the shared rAF loop in main.js with the high-res timestamp.
  frame() {
    if (!this._running || this._disposed) return;
    // Pause rendering entirely when hidden or context is gone.
    if (!this._visible || this._contextLost) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    this.pointer.update();

    this.uniforms.uTime.value = elapsed;
    this.uniforms.uMouse.value.set(this.pointer.mouse.x, this.pointer.mouse.y);
    this.uniforms.uMouseVelocity.value = this.pointer.velocity;
    this.uniforms.uScrollProgress.value = this.scrollProgress;

    if (this.compositePass) {
      this.compositePass.uniforms.uTime.value = elapsed;
    }

    if (this._usePost) {
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  reveal() {
    // Fade the canvas element in only after the first successful frames.
    this.canvas.style.opacity = '1';
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

    if (this.bloom) this.bloom.dispose && this.bloom.dispose();
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
