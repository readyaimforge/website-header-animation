// Ready Aim Forge – interactive header background.
// Scroll wheel / finger swipe pushes the camera forward through a corridor of
// neon beams and dust. Mouse / touch position adds gentle parallax and a
// cursor "wake" in the particles.
//
// Usage: import { initHeaderBg } from './src/header-bg.js'
//        initHeaderBg(document.querySelector('.hero-bg'))

import * as THREE from '../vendor/three.module.min.js';

const COLORS = {
  bg: new THREE.Color('#041a2e'),
  blue: new THREE.Color('#1f6bff'),
  cyan: new THREE.Color('#00c8ff'),
  lime: new THREE.Color('#c5f000'),
};

const DEPTH = 60; // length of the looping corridor

export function initHeaderBg(container, opts = {}) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = matchMedia('(max-width: 768px)').matches;
  const particleCount = opts.particles ?? (isSmall ? 450 : 1100);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
  const maxDpr = isSmall ? 1.25 : 1.5;
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
  renderer.setClearColor(COLORS.bg);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 0);

  const uniforms = {
    uTime: { value: 0 },
    uTravel: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPx: { value: 1 },
    uDepth: { value: DEPTH },
    uBlue: { value: COLORS.blue },
    uCyan: { value: COLORS.cyan },
    uLime: { value: COLORS.lime },
  };

  // ---- 1. Backdrop: spotlight cone + drifting mist + floor glow (one quad) ----
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying vec2 vUv;
        uniform float uTime, uTravel;
        uniform vec2 uMouse, uRes;
        uniform vec3 uBlue, uCyan;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.0+17.0; a *= 0.5; }
          return v;
        }
        void main(){
          vec2 uv = vUv;
          float aspect = uRes.x / uRes.y;
          vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

          // spotlight from top, leaning slightly toward the cursor
          vec2 src = vec2(uMouse.x * 0.12, 0.62);
          vec2 d = p - src;
          float ang = atan(d.x, -d.y);
          float rays = 0.65 + 0.35 * noise(vec2(ang * 14.0, uTravel * 0.05));
          float cone = smoothstep(0.55, 0.0, abs(ang)) * smoothstep(1.3, 0.0, length(d));
          float core = smoothstep(0.35, 0.0, length(d));
          vec3 col = vec3(0.016, 0.102, 0.18) + uBlue * cone * rays * 0.75 + uCyan * core * 0.55;

          // mist rising from the floor, scrolling with travel
          float h = smoothstep(0.55, 0.0, uv.y);
          float m = fbm(vec2(p.x * 2.2 + uTime * 0.02, uv.y * 3.0 - uTime * 0.03 + uTravel * 0.02));
          col += uBlue * m * h * m * 1.1;

          // thin floor horizon glow
          col += uCyan * exp(-abs(uv.y - 0.2) * 46.0) * 0.35;

          // vignette keeps edges dark so the header copy stays legible
          col *= 0.35 + 0.65 * smoothstep(1.2, 0.2, length(p * vec2(0.9, 1.1)));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  backdrop.renderOrder = -1;
  backdrop.frustumCulled = false;
  scene.add(backdrop);

  // ---- 2. Light beams: long thin diagonals at varied depths ----
  const beamGroup = new THREE.Group();
  scene.add(beamGroup);
  const beamMat = (color, intensity) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { ...uniforms, uColor: { value: color }, uIntensity: { value: intensity }, uPhase: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying vec2 vUv;
        uniform vec3 uColor; uniform float uIntensity, uTime, uPhase;
        void main(){
          // sharp bright core + soft halo across the width
          float x = abs(vUv.x - 0.5) * 2.0;
          float line = exp(-x * 28.0) + 0.25 * exp(-x * 5.0);
          // bright pulse travels along the beam; ends fade out
          float t = fract(vUv.y * 0.6 - uTime * 0.07 + uPhase);
          float pulse = 0.35 + 0.65 * pow(smoothstep(0.0, 0.5, t) * smoothstep(1.0, 0.5, t), 2.0);
          float ends = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
          gl_FragColor = vec4(uColor * line * pulse * ends * uIntensity, 1.0);
        }`,
    });

  const beams = [];
  const beamDefs = [
    // x, z (depth into corridor), angle (deg), width, color, intensity
    [-9, 6, 38, 0.10, COLORS.blue, 1.6],
    [-3, 14, 38, 0.06, COLORS.cyan, 1.2],
    [6, 10, 38, 0.12, COLORS.blue, 1.4],
    [11, 20, 38, 0.10, COLORS.lime, 1.5], // lime accent, like the still
    [-13, 28, 38, 0.08, COLORS.cyan, 1.0],
    [2, 36, 38, 0.07, COLORS.blue, 1.1],
    [14, 44, 38, 0.06, COLORS.lime, 0.8],
    [-6, 52, 38, 0.09, COLORS.cyan, 1.1],
    // near-vertical "pillar" lines from the left of the still
    [-7, 8, 90, 0.035, COLORS.cyan, 1.0],
    [-4.5, 18, 90, 0.035, COLORS.blue, 1.0],
    [-1.5, 30, 90, 0.035, COLORS.cyan, 0.9],
  ];
  beamDefs.forEach(([x, z, deg, w, color, intensity], i) => {
    const mat = beamMat(color, intensity);
    mat.uniforms.uPhase.value = i * 0.37;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 12, 60), mat);
    mesh.rotation.z = THREE.MathUtils.degToRad(deg - 90);
    mesh.position.set(x, 0, -z);
    mesh.frustumCulled = false;
    mesh.userData.baseZ = -z;
    beamGroup.add(mesh);
    beams.push(mesh);
  });

  // ---- 3. Particles: dust + sparks that wrap through the corridor ----
  const pos = new Float32Array(particleCount * 3);
  const seed = new Float32Array(particleCount * 4); // size, speed, colorMix, phase
  for (let i = 0; i < particleCount; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 36;
    pos[i * 3 + 1] = (Math.random() - 0.35) * 18;
    pos[i * 3 + 2] = -Math.random() * DEPTH;
    seed[i * 4] = 0.4 + Math.random() * Math.random() * 1.8;
    seed[i * 4 + 1] = 0.2 + Math.random();
    seed[i * 4 + 2] = Math.random();
    seed[i * 4 + 3] = Math.random() * 6.283;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const particles = new THREE.Points(
    pg,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uTravel, uDepth, uPx;
        uniform vec2 uMouse;
        uniform vec3 uBlue, uCyan, uLime;
        varying vec3 vCol; varying float vAlpha;
        void main(){
          vec3 p = position;
          // idle drift
          p.x += sin(uTime * 0.15 * aSeed.y + aSeed.w) * 0.8;
          p.y += cos(uTime * 0.12 * aSeed.y + aSeed.w * 1.7) * 0.6 + uTime * 0.05 * aSeed.y;
          p.y = mod(p.y + 9.0, 18.0) - 9.0;
          // travel: wrap z so the field is endless
          p.z = mod(p.z + uTravel + uDepth, uDepth) - uDepth;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vec4 clip = projectionMatrix * mv;

          // cursor wake: push particles away from the pointer in screen space
          vec2 ndc = clip.xy / clip.w;
          vec2 dm = ndc - uMouse;
          float f = exp(-dot(dm, dm) * 9.0);
          clip.xy += normalize(dm + 1e-4) * f * 0.12 * clip.w;

          gl_Position = clip;
          float dist = -mv.z;
          gl_PointSize = aSeed.x * 75.0 * uPx / max(dist, 0.5) * (1.0 + f * 0.8);
          vec3 c = aSeed.z > 0.93 ? uLime : (aSeed.z > 0.55 ? uCyan : uBlue);
          vCol = c * (1.0 + f * 1.2);
          // fade in at far end, fade out when passing the camera
          vAlpha = smoothstep(uDepth, uDepth * 0.7, dist) * smoothstep(0.4, 3.0, dist);
          vAlpha *= 0.55 + 0.45 * sin(uTime * aSeed.y * 1.3 + aSeed.w);
        }`,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying vec3 vCol; varying float vAlpha;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          a = a * a;
          gl_FragColor = vec4(vCol * a * vAlpha * 1.6, 1.0);
        }`,
    })
  );
  particles.frustumCulled = false;
  scene.add(particles);

  // ---- Input: scroll / swipe velocity + pointer parallax ----
  let travel = 0;
  let velocity = 0; // units/sec, decays
  const mouse = new THREE.Vector2(0, 0); // target, NDC
  const mouseSm = new THREE.Vector2(0, 0);
  const IDLE_SPEED = 0.25;

  const kick = (amount) => {
    velocity = THREE.MathUtils.clamp(velocity + amount, -40, 40);
    wake();
  };
  const onWheel = (e) => kick(e.deltaY * 0.012);
  let touchY = null;
  const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    const y = e.touches[0].clientY;
    if (touchY !== null) kick((touchY - y) * 0.09);
    touchY = y;
    setPointer(e.touches[0].clientX, y);
  };
  const onTouchEnd = () => { touchY = null; };
  const setPointer = (cx, cy) => {
    const r = container.getBoundingClientRect();
    mouse.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
    wake();
  };
  const onMove = (e) => setPointer(e.clientX, e.clientY);
  let lastScrollY = scrollY;
  const onScroll = () => { kick((scrollY - lastScrollY) * 0.03); lastScrollY = scrollY; };

  addEventListener('wheel', onWheel, { passive: true });
  addEventListener('touchstart', onTouchStart, { passive: true });
  addEventListener('touchmove', onTouchMove, { passive: true });
  addEventListener('touchend', onTouchEnd, { passive: true });
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });

  // ---- Sizing ----
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uRes.value.set(w, h);
    uniforms.uPx.value = renderer.getPixelRatio() * (h / 900);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ---- Loop (pauses when hidden / off-screen) ----
  let visible = true;
  let raf = 0;
  let last = performance.now();
  const clock = { t: 0 };

  const frame = (now) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock.t += dt;

    velocity *= Math.exp(-dt * 2.2);
    travel += (IDLE_SPEED + velocity) * dt;
    mouseSm.lerp(mouse, 1 - Math.exp(-dt * 4));

    uniforms.uTime.value = clock.t;
    uniforms.uTravel.value = travel;
    uniforms.uMouse.value.copy(mouseSm);

    // camera parallax + slight roll/FOV punch with speed
    camera.position.x = mouseSm.x * 0.6;
    camera.position.y = mouseSm.y * 0.35;
    camera.rotation.y = -mouseSm.x * 0.05;
    camera.rotation.x = mouseSm.y * 0.03;
    camera.fov = 55 + Math.min(Math.abs(velocity), 20) * 0.35;
    camera.updateProjectionMatrix();

    // beams loop through the corridor too
    for (const b of beams) {
      b.position.z = ((b.userData.baseZ + travel) % DEPTH + DEPTH) % DEPTH - DEPTH;
    }

    renderer.render(scene, camera);
    if (visible && !document.hidden && !reduceMotion) raf = requestAnimationFrame(frame);
  };
  function wake() {
    if (!raf && visible && !document.hidden && !reduceMotion) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); });
  io.observe(container);
  document.addEventListener('visibilitychange', wake);

  // reduced motion: one still frame, plus re-render when resized
  if (reduceMotion) {
    uniforms.uTime.value = 4;
    renderer.render(scene, camera);
    new ResizeObserver(() => renderer.render(scene, camera)).observe(container);
  } else {
    wake();
  }
  container.classList.add('is-ready');

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      removeEventListener('wheel', onWheel);
      removeEventListener('touchstart', onTouchStart);
      removeEventListener('touchmove', onTouchMove);
      removeEventListener('touchend', onTouchEnd);
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', wake);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
