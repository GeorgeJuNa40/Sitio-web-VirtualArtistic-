precision highp float;

// Final composite pass (runs after bloom). Combines three subtle effects in a
// single pass to stay inside the frame budget:
//   - chromatic aberration, strongest at the screen edges only
//   - almost-imperceptible film grain
//   - a soft vignette that protects text contrast
//
// three's ShaderPass convention: input texture is `tDiffuse`, uv is `vUv`.

uniform sampler2D tDiffuse;
uniform float uTime;
uniform vec2 uResolution;
uniform float uAberration;
uniform float uGrain;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  float d = dot(centered, centered);

  // Chromatic aberration: negligible at center, only bites at the edges.
  vec2 dir = centered * (uAberration * d);
  float r = texture2D(tDiffuse, uv - dir).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv + dir).b;
  vec3 col = vec3(r, g, b);

  // Film grain — animated, extremely low amplitude.
  float n = fract(sin(dot(uv * uResolution + uTime, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * uGrain;

  // Vignette. Reinforces the CSS scrim; keeps highlights off the text zone.
  float vig = smoothstep(0.9, 0.25, d);
  col *= mix(0.82, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
