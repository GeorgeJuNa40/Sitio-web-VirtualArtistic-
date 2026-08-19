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
#define OCTAVES 4
#endif
#ifndef MAX_STEPS
#define MAX_STEPS 64
#endif

#define PI 3.14159265359
#define BOUND_RADIUS 1.85
#define SURF_DIST 0.0018
#define MAX_DIST 7.0

// -------------------------------------------------------------- Fractal noise
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  // Unrolled-friendly constant loop; OCTAVES is a compile-time constant.
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

// IQ cosine palette — iridescent, tunable, cheap.
vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.55);
  vec3 b = vec3(0.45, 0.4, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.15, 0.35, 0.62);
  return a + b * cos(2.0 * PI * (c * t + d));
}

// Displacement amplitude shared by SDF and normal so both stay consistent.
float displacement(vec3 p, float diss) {
  // Continuous breathing on the time axis; multi-octave, non-repeating.
  float base = fbm(p * 1.35 + vec3(0.0, 0.0, uTime * 0.14));
  // Fast cursor motion agitates the surface; rest returns it to calm.
  float agitation = 0.28 * uMouseVelocity * fbm(p * 2.6 - uTime * 0.5);
  // Scroll fragments the surface into finer, higher-amplitude detail.
  float shatter = diss * 0.9 * fbm(p * (2.5 + diss * 4.0) + uTime * 0.3);
  return base + agitation + shatter;
}

// Signed distance to the displaced core. `disp` is returned for shading.
float mapCore(vec3 p, float diss, out float disp) {
  disp = displacement(p, diss);
  float amp = 0.34 + uMouseVelocity * 0.12 + diss * 0.55;
  float radius = 1.0 + diss * 0.35; // survivors push outward as it disperses
  float d = length(p) - radius;
  d -= disp * amp;
  // Non-conservative field after displacement — shorten steps to avoid overshoot.
  return d * 0.55;
}

vec3 calcNormal(vec3 p, float diss) {
  const vec2 e = vec2(0.0025, 0.0);
  float dummy;
  return normalize(vec3(
    mapCore(p + e.xyy, diss, dummy) - mapCore(p - e.xyy, diss, dummy),
    mapCore(p + e.yxy, diss, dummy) - mapCore(p - e.yxy, diss, dummy),
    mapCore(p + e.yyx, diss, dummy) - mapCore(p - e.yyx, diss, dummy)
  ));
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

  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3(uv, -1.7));

  float diss = smoothstep(0.0, 1.0, uScrollProgress);

  // Subtle world rotation: follows the cursor (max ~15deg) + slow autonomy.
  float ax = uMouse.y * radians(15.0) + sin(uTime * 0.08) * 0.05;
  float ay = uMouse.x * radians(15.0) + uTime * 0.05;
  // Inverse of rotY(ay)*rotX(ax); built directly (transpose is GLSL ES 3.0 only).
  mat3 inv = rotX(-ax) * rotY(-ay);
  ro = inv * ro;
  rd = inv * rd;

  // Dark studio backdrop with a soft radial pool of light behind the core.
  float vig = 1.0 - dot(uv, uv) * 0.55;
  vec3 bg = vec3(0.015, 0.016, 0.02) * clamp(vig, 0.0, 1.0);

  vec3 col = bg;
  float alpha = 1.0;

  vec2 bh = boundHit(ro, rd, BOUND_RADIUS);
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
      vec3 cCold = vec3(0.34, 0.52, 0.95);
      vec3 cWarm = vec3(0.98, 0.55, 0.32);

      float dCold = max(dot(n, Lcold), 0.0);
      float dWarm = max(dot(n, Lwarm), 0.0);

      // Fresnel: view angle drives the iridescent hue shift.
      float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
      vec3 irid = palette(fres * 1.15 + dot(n, rd) * 0.25 + disp * 0.15 + uTime * 0.02);

      // Metallic-dark core, luminous iridescent rim.
      vec3 surface = mix(vec3(0.015, 0.016, 0.022), irid, fres);
      surface += (cCold * dCold + cWarm * dWarm) * 0.32;
      surface += irid * fres * 1.6; // bright rim → feeds bloom
      surface += vec3(0.02) * pow(dCold, 6.0); // tight cold spec

      col = surface;

      // --- Disintegration: 3D erosion mask breaks survivors into scattered
      //     chunks that read as dispersing particles. One coreography. ---
      if (diss > 0.001) {
        float grain = fbm(p * 3.0 + uTime * 0.2) * 0.5 + 0.5;
        float alive = smoothstep(diss - 0.12, diss + 0.12, grain);
        // Fine specks that survive glow slightly hotter as they scatter.
        col += irid * (1.0 - alive) * diss * 0.6;
        alpha = alive;
      }
    } else {
      alpha = 0.0;
    }
  } else {
    alpha = 0.0;
  }

  // Composite core over the studio backdrop; keep the canvas fully opaque so
  // the page background never bleeds through mid-animation.
  vec3 outColor = mix(bg, col, alpha);

  // Global fade as the hero leaves: the pool of light recedes with the core.
  outColor *= (1.0 - diss * 0.85);

  gl_FragColor = vec4(outColor, 1.0);
}
