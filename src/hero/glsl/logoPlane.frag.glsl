precision highp float;

// Logo as a textured plane in the 3D scene. Restores the first metallic finish
// the client preferred: orange -> rich gold, black -> glossy obsidian, with a
// moving foil highlight (the "destello"). Dissolves into drifting fragments on
// scroll. Transparent outside the mark's alpha.

uniform sampler2D uLogo;
uniform float uTime;
uniform float uScrollProgress;
uniform float uMouseVelocity;

varying vec2 vUv;

// snoise(vec3) prepended at build time.

void main() {
  float diss = smoothstep(0.0, 1.0, uScrollProgress);

  vec2 uv = vUv;
  vec2 duv = uv;
  if (diss > 0.001) {
    float sc = snoise(vec3(uv * 2.5, uTime * 0.2));
    duv += vec2(sc * 0.16, 0.4) * diss; // rise + scatter as it disperses
  }

  vec4 tex = texture2D(uLogo, duv);
  float mask = tex.a;
  vec3 base = tex.rgb;

  // Metallic remap (first version) — orange to gold, black to glossy obsidian.
  float warm = smoothstep(0.06, 0.35, base.r - base.b);
  float bright = dot(base, vec3(0.333));
  vec3 gold = vec3(1.0, 0.74, 0.30);
  vec3 obsidian = vec3(0.05, 0.05, 0.055);
  vec3 mat = mix(base, gold, warm * 0.85);
  float darkness = (1.0 - smoothstep(0.06, 0.3, bright)) * (1.0 - warm);
  mat = mix(mat, obsidian, darkness);

  // Moving foil highlight (the destello) sweeping across the mark.
  float band = sin((vUv.x * 1.5 + vUv.y * 0.8 - uTime * 0.5) * 6.2831853);
  band = pow(max(band, 0.0), 5.0);
  mat += vec3(1.0, 0.93, 0.78) * band * (0.35 + uMouseVelocity * 0.3);

  float a = mask;
  if (diss > 0.001) {
    float n = snoise(vec3(uv * 3.0, uTime * 0.15)) * 0.5 + 0.5;
    a *= smoothstep(diss - 0.12, diss + 0.12, n);
  }

  gl_FragColor = vec4(mat, a);
}
