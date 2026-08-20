precision highp float;

// "Sello vivo": the brand mark as a lit metallic sculpture on a dark field.
// The logo's own luminance is remapped to a gold-metal ramp (its blacks become
// dark bronze so they still read on black, its golds stay gold), with a moving
// foil sweep, cursor parallax + slow vortex spin, and a scroll dissolve into
// drifting gold particles.

uniform sampler2D uLogo;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;          // interpolated cursor, ~-1..1
uniform float uMouseVelocity; // 0..1
uniform float uScrollProgress;// 0..1
uniform vec2 uCenter;         // logo centre in screen UV (0..1)
uniform float uLogoHalf;      // logo half-extent in pixels

varying vec2 vUv;

// snoise(vec3) prepended at build time.

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 frag = vUv * uResolution;
  float diss = smoothstep(0.0, 1.0, uScrollProgress);

  // Logo-space coordinates centred on the mark, normalised by its half-extent.
  vec2 rel = (frag - uCenter * uResolution) / uLogoHalf;

  // Slow vortex spin, nudged by cursor speed.
  rel = rot(uTime * 0.08 + uMouseVelocity * 0.4) * rel;

  // Cursor parallax + a light fake-perspective tilt: the "sello vivo" depth.
  rel += vec2(-uMouse.x, -uMouse.y) * 0.05;
  rel *= 1.0 - (uMouse.x * rel.x - uMouse.y * rel.y) * 0.10;

  // Dissolve drift: survivors rise and scatter as the mark disperses.
  vec2 duv = rel;
  if (diss > 0.001) {
    float sc = snoise(vec3(rel * 2.5, uTime * 0.2));
    duv += vec2(sc * 0.18, 0.45) * diss;
  }
  vec2 luv = duv * 0.5 + 0.5;

  // Warm-dark backdrop with a soft pool of light behind the mark, so the
  // brand's black shapes read as a silhouette against the glow.
  float pool = smoothstep(1.7, 0.0, length(rel));
  vec3 bg = vec3(0.012, 0.012, 0.015) + vec3(0.055, 0.045, 0.03) * pool * 0.6;

  vec3 col = bg;

  if (luv.x > 0.0 && luv.x < 1.0 && luv.y > 0.0 && luv.y < 1.0) {
    vec4 tex = texture2D(uLogo, luv);
    float mask = tex.a;
    vec3 base = tex.rgb;

    // Keep the mark's flat, designed colours (single gold, flat dark, grey
    // border). Add only a faint gold-tinted sheen on the gold areas — never a
    // white highlight, never a new hue.
    float isGold = smoothstep(0.12, 0.30, base.r - base.b);
    float band = sin((vUv.x * 1.5 + vUv.y * 0.8 - uTime * 0.5) * 6.2831853);
    band = pow(max(band, 0.0), 8.0);
    vec3 mat = base + vec3(0.9, 0.66, 0.2) * band * isGold * 0.22;

    // Erode the mask with noise as it disperses.
    float a = mask;
    if (diss > 0.001) {
      float n = snoise(vec3(rel * 3.0, uTime * 0.15)) * 0.5 + 0.5;
      a *= smoothstep(diss - 0.12, diss + 0.12, n);
    }

    col = mix(bg, mat, a);
  }

  // Vignette protects text contrast; global fade as the hero leaves.
  vec2 uvc = (frag - 0.5 * uResolution) / uResolution.y;
  col *= smoothstep(1.4, 0.2, dot(uvc, uvc));
  col *= (1.0 - diss * 0.8);

  gl_FragColor = vec4(col, 1.0);
}
