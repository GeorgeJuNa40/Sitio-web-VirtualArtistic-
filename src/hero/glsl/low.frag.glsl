precision mediump float;

// Low-tier fallback: an animated, restrained iridescent core. No raymarching,
// no FBM — a handful of trig ops per pixel. Same visual language as the
// raymarched core (dark metallic center, luminous contained rim, near-black
// field) so the downgrade stays silent, never loud, and never fights the text.

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseVelocity;
uniform float uScrollProgress;

varying vec2 vUv;

#define PI 3.14159265359

vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.55);
  vec3 b = vec3(0.42, 0.38, 0.48);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.15, 0.35, 0.62);
  return a + b * cos(2.0 * PI * (c * t + d));
}

void main() {
  vec2 uv = (vUv * uResolution - 0.5 * uResolution) / uResolution.y;

  float diss = smoothstep(0.0, 1.0, uScrollProgress);

  // Core drifts gently toward the cursor and sits right of centre, mirroring
  // the composition of the raymarched build.
  vec2 center = uMouse * 0.1 + vec2(0.35, 0.0);
  float r = length(uv - center);

  float breathe = 0.5 + 0.025 * sin(uTime * 0.6) + uMouseVelocity * 0.05;
  breathe += diss * 0.35;

  // Contained body: dark metallic, only faint colour bleed near the surface.
  float body = smoothstep(breathe + 0.28, breathe - 0.05, r);
  float rim = smoothstep(0.14, 0.0, abs(r - breathe));

  float hue = r * 0.6 - uTime * 0.04;
  vec3 irid = palette(hue);
  // Desaturate toward luminance — sober, not a rainbow.
  float lum = dot(irid, vec3(0.299, 0.587, 0.114));
  irid = mix(vec3(lum), irid, 0.55);

  vec3 col = vec3(0.014, 0.015, 0.02);
  col = mix(col, mix(vec3(0.02, 0.022, 0.03), irid * 0.32, 0.6), body);
  col += irid * rim * 0.9; // luminous but contained rim

  // Dispersion on scroll: erode with a cheap hash, push brightness down.
  if (diss > 0.001) {
    float h = fract(sin(dot(uv * 12.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col *= step(diss, h * 0.7 + body * 0.3 + 0.15);
  }

  // Strong radial falloff keeps the corners and the text column near-black.
  float vig = smoothstep(1.15, 0.15, dot(uv, uv));
  col *= vig;
  col *= (1.0 - diss * 0.85);

  gl_FragColor = vec4(col, 1.0);
}
