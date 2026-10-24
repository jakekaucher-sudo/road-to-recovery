// Sky dome: gradient, sun disc and glow, moving procedural clouds and a
// lightning flash term. One draw call, follows the camera.
import * as THREE from "../../vendor/three/three.module.js";

const vert = /* glsl */`
varying vec3 vDir;
void main() { vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.9999; }`;
const frag = /* glsl */`
uniform vec3 top, horizon, fogColor, sunDir, sunColor, cloudColor, cloudDark;
uniform float sunAmt, clouds, time, flash, windDir;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(horizon, top, pow(h, 0.55));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(sd, 6.0) * 0.35 + pow(sd, 60.0) * 0.6) * sunAmt;
  col += sunColor * smoothstep(0.9993, 0.9997, sd) * 2.5 * sunAmt;
  // clouds on a virtual plane
  if (d.y > -0.02 && clouds > 0.01) {
    vec2 uv = d.xz / (d.y + 0.12) * 0.55 + vec2(time * 0.012 * windDir, time * 0.006);
    float n = fbm(uv * 1.3);
    float cover = smoothstep(1.0 - clouds * 0.75 - 0.15, 1.0 - clouds * 0.75 + 0.25, n);
    float shade = fbm(uv * 2.7 + 3.1);
    vec3 cc = mix(cloudDark, cloudColor, smoothstep(0.3, 0.75, shade));
    cc += sunColor * pow(sd, 8.0) * 0.4 * sunAmt;
    col = mix(col, cc, cover * smoothstep(-0.02, 0.12, d.y));
  }
  col += vec3(0.75, 0.82, 1.0) * flash;
  // fade into fog near and below the horizon
  col = mix(fogColor, col, smoothstep(-0.05, 0.18, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function makeSky() {
  const uniforms = {
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, fogColor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 0.2, -1) }, sunColor: { value: new THREE.Color() }, cloudColor: { value: new THREE.Color() }, cloudDark: { value: new THREE.Color() },
    sunAmt: { value: 1 }, clouds: { value: 0.5 }, time: { value: 0 }, flash: { value: 0 }, windDir: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 16), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return { mesh, uniforms };
}
