// Fullscreen triangle/quad pass-through. PlaneGeometry(2,2) already spans
// clip space on xy, so no camera transform is needed.
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
