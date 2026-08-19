precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse; // interpolated cursor, roughly -1..1
uniform float uMouseVelocity; // 0..1, decays toward 0 at rest
uniform float uScrollProgress; // 0..1, drives disintegration
uniform float uPixelRatio;

varying vec2 vUv;

// snoise(vec3) is prepended at build time (simplexNoise.glsl).

// Quality is compiled in as defines. Fallbacks keep the file valid standalone.
#ifndef OCTAVES
#define OCTAVES 3
#endif
#ifndef MAX_STEPS
#define MAX_STEPS 48
#endif

#define PI 3.14159265359
// Tight bound around a ~0.9-radius core so most of the frame (the dark
// margins) exits before marching — the single biggest perf lever on mobile.
#define BOUND_RADIUS 1.25
#define SURF_DIST 0.0025
#define MAX_DIST 8.0
// Core radius and how far it sits toward the right, keeping the left text dark.
#define CORE_RADIUS 0.9

// -------------------------------------------------------------- Fractal noise
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < OCTAVES; i++) {
    sum += amp * snoise(p * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}
mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

// IQ cosine palette, kept low-saturation so the core stays sober, never a
// rainbow oil-slick. Colour enters only faintly, at the grazing rim.
vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.55);
  vec3 b = vec3(0.35, 0.32, 0.4);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.15, 0.35, 0.62);
  return a + b * cos(2.0 * PI * (c * t + d));
}

// One FBM for the breathing surface + one cheap single-octave term for the
// cursor/scroll response. ~3x fewer noise samples than three full FBMs.
float displacement(vec3 p, float diss) {
  float base = fbm(p * 1.35 + vec3(0.0, 0.0, uTime * 0.14));
  float react = (uMouseVelocity * 0.22 + diss * 0.7) *
    snoise(p * (2.4 + diss * 3.5) + uTime * 0.35);
  return base + react;
}

// Signed distance to the displaced core. `disp` is returned for shading.
float mapCore(vec3 p, float diss, out float disp) {
  disp = displacement(p, diss);
  float amp = 0.2 + uMouseVelocity * 0.08 + diss * 0.5;
  float radius = CORE_RADIUS + diss * 0.35; // survivors push out as it disperses
  float d = length(p) - radius;
  d -= disp * amp;
  // Field is non-conservative after displacement; shorten steps a little.
  return d * 0.6;
}

// Tetrahedral normal: 4 map() evals instead of 6.
vec3 calcNormal(vec3 p, float diss) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0025;
  float d;
  return normalize(
    k.xyy * mapCore(p + k.xyy * e, diss, d) +
    k.yyx * mapCore(p + k.yyx * e, diss, d) +
    k.yxy * mapCore(p + k.yxy * e, diss, d) +
    k.xxx * mapCore(p + k.xxx * e, diss, d)
  );
}

// Ray vs. bounding sphere. Returns entry/exit t in .xy; .x > .y means a miss.
vec2 boundHit(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  vec2 frag = vUv * uResolution;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

  float diss = smoothstep(0.0, 1.0, uScrollProgress);

  // Compose the core toward the right so the left-aligned headline sits over
  // dark background. Offset is a fraction of the vertical field so it tracks
  // orientation sensibly.
  vec2 aim = uv - vec2(0.16, 0.02);

  // Camera pulled well back with a longish lens so a ~0.9 core is contained,
  // leaving dark margins that both frame it and let the raymarch early-out.
  vec3 ro = vec3(0.0, 0.0, 4.8);
  vec3 rd = normalize(vec3(aim, -1.5));

  // Subtle world rotation: follows the cursor (max ~15deg) + slow autonomy.
  float ax = uMouse.y * radians(15.0) + sin(uTime * 0.08) * 0.05;
  float ay = uMouse.x * radians(15.0) + uTime * 0.05;
  // Inverse of rotY(ay)*rotX(ax); built directly (transpose is GLSL ES 3.0 only).
  mat3 inv = rotX(-ax) * rotY(-ay);
  ro = inv * ro;
  rd = inv * rd;

  // Near-black studio backdrop with a faint pool of light behind the core.
  float glow = smoothstep(1.1, 0.0, length(aim - vec2(0.0, 0.0)));
  vec3 bg = vec3(0.01, 0.011, 0.014) + vec3(0.02, 0.022, 0.03) * glow * 0.5;

  vec3 col = bg;
  float alpha = 0.0;

  vec2 bh = boundHit(ro, rd, BOUND_RADIUS + diss * 0.35);
  if (bh.x <= bh.y) {
    float t = max(bh.x, 0.0);
    float tEnd = min(bh.y, MAX_DIST);
    float disp = 0.0;
    bool hit = false;

    for (int i = 0; i < MAX_STEPS; i++) {
      vec3 p = ro + rd * t;
      float d = mapCore(p, diss, disp);
      if (d < SURF_DIST) {
        hit = true;
        break;
      }
      t += d;
      if (t > tEnd) break;
    }

    if (hit) {
      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p, diss);

      // Two opposed directional lights: one cold, one warm — volume w/o PBR.
      vec3 Lcold = normalize(vec3(-0.55, 0.7, 0.45));
      vec3 Lwarm = normalize(vec3(0.6, -0.35, 0.4));
      vec3 cCold = vec3(0.30, 0.45, 0.85);
      vec3 cWarm = vec3(0.9, 0.5, 0.3);

      float dCold = max(dot(n, Lcold), 0.0);
      float dWarm = max(dot(n, Lwarm), 0.0);

      // Fresnel: grazing angle drives a faint hue shift and the rim light.
      float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
      vec3 irid = palette(fres * 0.9 + dot(n, rd) * 0.2 + disp * 0.12 + uTime * 0.02);
      // Desaturate toward luminance — sober metal, not oil-slick.
      float lum = dot(irid, vec3(0.299, 0.587, 0.114));
      irid = mix(vec3(lum), irid, 0.5);

      // Dark metallic body; colour appears only at the grazing rim.
      vec3 surface = vec3(0.02, 0.021, 0.028);
      surface += (cCold * dCold + cWarm * dWarm) * 0.14;
      surface += irid * fres * 0.7;                 // contained rim glow
      surface += vec3(0.03) * pow(dCold, 8.0);      // tight cold specular

      col = surface;
      alpha = 1.0;

      // Disintegration: 3D erosion mask breaks survivors into scattered chunks
      // that read as dispersing particles. One choreography with the text fade.
      if (diss > 0.001) {
        float grain = fbm(p * 3.0 + uTime * 0.2) * 0.5 + 0.5;
        float aliveMask = smoothstep(diss - 0.12, diss + 0.12, grain);
        col += irid * (1.0 - aliveMask) * diss * 0.4;
        alpha = aliveMask;
      }
    }
  }

  vec3 outColor = mix(bg, col, alpha);

  // Screen vignette reinforces text contrast and keeps highlights centred.
  outColor *= smoothstep(1.35, 0.2, dot(uv, uv));

  // Global fade as the hero leaves: the pool of light recedes with the core.
  outColor *= (1.0 - diss * 0.85);

  gl_FragColor = vec4(outColor, 1.0);
}
