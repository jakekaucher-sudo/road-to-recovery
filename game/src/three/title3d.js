// Title screen showroom: the 3D van on a slowly turning platform at dusk,
// with a light synthwave touch (sunset sun, grid floor, neon rim lights).
import * as THREE from "three";
import { buildVan } from "./van3d.js";

export function makeTitleScene(art, quality) {
  const scene = new THREE.Scene();
  const c = document.createElement("canvas"); c.width = 16; c.height = 512; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#071a3f"); gr.addColorStop(0.55, "#1d3f7a"); gr.addColorStop(0.8, "#c26a52"); gr.addColorStop(1, "#f2b26a");
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512); const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace; scene.background = bg;
  scene.fog = new THREE.Fog(0x2a3a6a, 40, 140);
  // sunset sun with stripes (menus keep a little retro style)
  const sc = document.createElement("canvas"); sc.width = sc.height = 512; const sg = sc.getContext("2d");
  const sgr = sg.createLinearGradient(0, 0, 0, 512); sgr.addColorStop(0, "#ffd56a"); sgr.addColorStop(1, "#e2543a"); sg.fillStyle = sgr; sg.beginPath(); sg.arc(256, 256, 250, 0, Math.PI * 2); sg.fill();
  sg.globalCompositeOperation = "destination-out"; for (let i = 0; i < 6; i++) sg.fillRect(0, 300 + i * 34, 512, 6 + i * 3);
  const sunTex = new THREE.CanvasTexture(sc); sunTex.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false })); sun.position.set(0, 14, -120); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), quality.high ? new THREE.MeshStandardMaterial({ color: 0x0b1530, roughness: 0.35, metalness: 0.4 }) : new THREE.MeshPhongMaterial({ color: 0x0b1530, shininess: 60 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(400, 100, 0xecc444, 0x2f6fc0); grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, 0.25, 48), new THREE.MeshLambertMaterial({ color: 0x1a2440 })); disc.position.y = 0.12; scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: 0xecc444 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.26; scene.add(ring);
  scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x302020, 1.2));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.6); key.position.set(6, 9, 8); key.castShadow = quality.shadows; scene.add(key);
  const rimB = new THREE.PointLight(0x5cc8ff, 60, 30); rimB.position.set(-7, 4, -4); scene.add(rimB);
  const rimR = new THREE.PointLight(0xff5060, 50, 30); rimR.position.set(7, 3, -5); scene.add(rimR);
  const van = buildVan(art, quality); van.root.position.y = 0.25; scene.add(van.root);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.3, 300);
  return {
    scene, cam, van,
    update(t) {
      van.root.rotation.y = t * 0.35 + 0.6;
      van.update({ speed: 0, dt: 0.016, steer: 0, brake: 0, night: 0.7, roll: 0, pitch: 0, bounce: 0 });
      const a = 0.25 + Math.sin(t * 0.15) * 0.15;
      cam.position.set(Math.sin(a) * 13.5, 3.6, Math.cos(a) * 13.5); cam.lookAt(0, 1.6, 0);
    },
  };
}
