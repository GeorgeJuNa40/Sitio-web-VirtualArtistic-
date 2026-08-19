/**
 * Detects device capability once at startup and resolves a quality tier.
 * The tier decides shader complexity and which post-processing passes run.
 *
 * Tiers:
 *   'full' — WebGL2, capable GPU: full raymarch + bloom + composite pass.
 *   'mid'  — reduced octaves / steps, bloom only.
 *   'low'  — animated gradient fallback, no post. Mobile / weak GPUs / no WebGL2.
 */

export const TIERS = {
  full: {
    name: 'full',
    octaves: 3,
    maxSteps: 48,
    bloom: true,
    composite: true,
    renderScale: 1.0
  },
  mid: {
    // Mobile / mid GPUs: no post-processing at all (bloom is too costly on a
    // phone). The shader carries its own rim glow, so the look holds up.
    name: 'mid',
    octaves: 2,
    maxSteps: 30,
    bloom: false,
    composite: false,
    renderScale: 0.7
  },
  low: {
    name: 'low',
    octaves: 0,
    maxSteps: 0,
    bloom: false,
    composite: false,
    renderScale: 0.75
  }
};

function getWebGLInfo() {
  const canvas = document.createElement('canvas');
  let gl = canvas.getContext('webgl2');
  const isWebGL2 = !!gl;
  if (!gl) {
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  }
  if (!gl) {
    return { supported: false, isWebGL2: false, renderer: '', maxTexture: 0 };
  }

  let renderer = '';
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  if (dbg) {
    renderer = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
  }
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;

  // Release the probe context immediately.
  const lose = gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();

  return { supported: true, isWebGL2, renderer, maxTexture };
}

export function detectQuality() {
  const info = getWebGLInfo();

  // Manual override for testing / debugging, e.g. ?quality=full|mid|low.
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced && TIERS[forced]) {
    return {
      tier: TIERS[forced],
      info,
      webglSupported: info.supported,
      isMobile: /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
    };
  }

  if (!info.supported) {
    return { tier: TIERS.low, info, webglSupported: false };
  }

  const isMobile =
    /android|iphone|ipad|ipod|iemobile|blackberry|mobile/i.test(
      navigator.userAgent
    ) || (('ontouchstart' in window) && window.matchMedia('(max-width: 900px)').matches);

  const cores = navigator.hardwareConcurrency || 2;
  const mem = navigator.deviceMemory || 4;
  const dpr = window.devicePixelRatio || 1;

  // Known weak / software renderers.
  const weakGPU =
    /swiftshader|software|llvmpipe|mali-4|adreno 3|adreno 4|powervr sgx|intel.*hd graphics [23]/.test(
      info.renderer
    );

  let tier = TIERS.full;

  if (!info.isWebGL2 || weakGPU || mem <= 2 || cores <= 2) {
    tier = TIERS.low;
  } else if (isMobile || mem <= 4 || cores <= 4 || info.maxTexture < 8192) {
    tier = TIERS.mid;
  }

  // Very high-DPR phones: never attempt full raymarch.
  if (isMobile && dpr >= 3 && tier === TIERS.full) {
    tier = TIERS.mid;
  }

  return { tier, info, webglSupported: true, isMobile };
}
