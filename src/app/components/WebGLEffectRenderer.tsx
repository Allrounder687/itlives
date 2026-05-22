"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom, Vignette, Glitch } from "@react-three/postprocessing";
import { GlitchMode } from "postprocessing";
import { EffectLayer } from "./CanvasEffectRenderer";

// ─────────────────────────────────────────────────────────────
// 1. Enhanced Falling Particles (Snow & Rain)
// ─────────────────────────────────────────────────────────────
function FallingParticles({ type, params }: { type: "snow" | "rain", params: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = params.count || (type === "rain" ? 150 : 120);
  const speed = params.speed || 1.0;
  const wind = params.wind || 0;
  const particleSize = params.size || (type === "rain" ? 4.0 : 6.0);
  const timeRef = useRef(0);

  const [positions, velocities, depths] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    const dep = new Float32Array(count); // depth factor 0..1
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2200;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1600;
      pos[i * 3 + 2] = 0;
      dep[i] = Math.random(); // 0 = far, 1 = near
      const depthSpeed = 0.4 + dep[i] * 0.6; // far particles slower
      vel[i] = (Math.random() * 0.5 + 0.5) * speed * depthSpeed * (type === "rain" ? 800 : 200);
    }
    return [pos, vel, dep];
  }, [count, speed, type]);

  // Per-particle sizes based on depth
  const sizes = useMemo(() => {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const depthScale = 0.3 + depths[i] * 0.7; // far = small, near = large
      s[i] = particleSize * depthScale * (type === "rain" ? 1.0 : (0.8 + Math.random() * 0.4));
    }
    return s;
  }, [count, depths, particleSize, type]);

  // Per-particle opacity based on depth
  const opacities = useMemo(() => {
    const o = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      o[i] = 0.3 + depths[i] * 0.6; // far = dim, near = bright
    }
    return o;
  }, [count, depths]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    const posAttribute = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = posAttribute.getY(i);
      let x = posAttribute.getX(i);
      y -= velocities[i] * delta;

      // Wind drift (sine wave for natural movement)
      if (type === "snow") {
        const windStrength = (wind || 0.3) * 40;
        x += Math.sin(timeRef.current * 0.5 + i * 0.1) * windStrength * delta * depths[i];
      } else {
        // Rain has slight consistent wind
        x += (wind || 0.1) * 30 * delta;
      }

      if (y < -1000) { y = 1000; x = (Math.random() - 0.5) * 2200; }
      if (x > 1200) x = -1200;
      if (x < -1200) x = 1200;
      posAttribute.setX(i, x);
      posAttribute.setY(i, y);
    }
    posAttribute.needsUpdate = true;
  });

  // Custom shader for per-particle size & opacity
  const vertexShader = `
    attribute float aSize;
    attribute float aOpacity;
    varying float vOpacity;
    void main() {
      vOpacity = aOpacity;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (800.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  const fragmentShader = type === "snow" ? `
    varying float vOpacity;
    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float d = length(uv);
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.15, d) * vOpacity;
      gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    }
  ` : `
    varying float vOpacity;
    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      // Elongated vertically for rain streak
      float d = length(uv * vec2(3.0, 1.0));
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, d) * vOpacity * 0.7;
      gl_FragColor = vec4(0.7, 0.75, 1.0, alpha);
    }
  `;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Enhanced Mouse Trail System (with Lerp Smoothing)
// ─────────────────────────────────────────────────────────────
type ParticleState = { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: THREE.Color };
function InteractiveParticles({ trailEnabled, rippleEnabled, isOverlay, trailColor, rippleColor }: {
  trailEnabled: boolean, rippleEnabled: boolean, isOverlay: boolean,
  trailColor?: string, rippleColor?: string
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const particles = useRef<ParticleState[]>([]);
  const maxParticles = 2000;
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const lastCursorPos = useRef<{x: number, y: number} | null>(null);

  const colors = useMemo(() => new Float32Array(maxParticles * 3), []);
  const sizesArr = useMemo(() => new Float32Array(maxParticles), []);

  const trailCol = useMemo(() => new THREE.Color(trailColor || "#9ae600"), [trailColor]);
  const rippleCol = useMemo(() => new THREE.Color(rippleColor || "#ffffff"), [rippleColor]);

  useEffect(() => {
    if (!isOverlay) return;
    let isMounted = true;
    let unlistenFunctions: Array<() => void> = [];

    const setupIPC = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        const unCursor = await listen<{x: number, y: number}>("cursor-moved", (e) => {
          if (!trailEnabled) return;
          let payload = e.payload as any;
          if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(e){} }
          if (!payload || typeof payload.x !== "number") return;

          const w = window.innerWidth;
          const h = window.innerHeight;
          const targetX = (payload.x / (window.devicePixelRatio || 1)) - w/2;
          const targetY = -(payload.y / (window.devicePixelRatio || 1)) + h/2;

          // Lerp smoothing: interpolate between last and current position
          const last = lastCursorPos.current;
          if (last) {
            const steps = 3;
            for (let s = 1; s <= steps; s++) {
              const t = s / steps;
              const lx = last.x + (targetX - last.x) * t;
              const ly = last.y + (targetY - last.y) * t;
              particles.current.push({
                x: lx, y: ly,
                vx: (Math.random() - 0.5) * 80,
                vy: (Math.random() - 0.5) * 80,
                life: 40, maxLife: 40,
                color: trailCol.clone()
              });
            }
          } else {
            particles.current.push({
              x: targetX, y: targetY,
              vx: (Math.random() - 0.5) * 80,
              vy: (Math.random() - 0.5) * 80,
              life: 40, maxLife: 40,
              color: trailCol.clone()
            });
          }
          lastCursorPos.current = { x: targetX, y: targetY };
        });
        unlistenFunctions.push(unCursor);

        const unClick = await listen<{x: number, y: number}>("cursor-click", (e) => {
          if (!rippleEnabled) return;
          let payload = e.payload as any;
          if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(e){} }
          if (!payload || typeof payload.x !== "number") return;

          const w = window.innerWidth;
          const h = window.innerHeight;
          const x = (payload.x / (window.devicePixelRatio || 1)) - w/2;
          const y = -(payload.y / (window.devicePixelRatio || 1)) + h/2;

          for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 / 30) * i;
            particles.current.push({
              x, y,
              vx: Math.cos(angle) * 300,
              vy: Math.sin(angle) * 300,
              life: 60, maxLife: 60,
              color: rippleCol.clone()
            });
          }
        });
        unlistenFunctions.push(unClick);
      } catch (err) {
        console.log("Tauri IPC not available, skipping event listeners.");
      }
    };
    setupIPC();

    return () => { isMounted = false; unlistenFunctions.forEach(fn => fn()); };
  }, [isOverlay, trailEnabled, rippleEnabled, trailCol, rippleCol]);

  useFrame((state, delta) => {
    if (!geometryRef.current) return;

    const active = particles.current.filter(p => p.life > 0);
    particles.current = active;

    const pos = new Float32Array(maxParticles * 3);

    for (let i = 0; i < active.length && i < maxParticles; i++) {
      const p = active[i];
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= 60 * delta;

      pos[i*3] = p.x;
      pos[i*3+1] = p.y;
      pos[i*3+2] = 0;

      const progress = p.life / p.maxLife;
      colors[i*3] = p.color.r;
      colors[i*3+1] = p.color.g;
      colors[i*3+2] = p.color.b;
      sizesArr[i] = progress * 8.0;
    }

    geometryRef.current.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometryRef.current.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometryRef.current.setAttribute("size", new THREE.BufferAttribute(sizesArr, 1));
    geometryRef.current.setDrawRange(0, Math.min(active.length, maxParticles));
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          attribute float size;
          attribute vec3 color;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (1000.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          void main() {
            vec2 xy = gl_PointCoord.xy - vec2(0.5);
            float ll = length(xy);
            if(ll > 0.5) discard;
            gl_FragColor = vec4(vColor, (0.5 - ll) * 2.0);
          }
        `}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Audio Visualizer System
// ─────────────────────────────────────────────────────────────
function AudioVisualizer() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const fftData = useRef<number[]>(new Array(64).fill(0));
  const smoothedData = useRef<number[]>(new Array(64).fill(0));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    let isMounted = true;
    let unlistenFunctions: Array<() => void> = [];

    const setupAudio = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        await invoke("start_audio_capture");
        const u = await listen<number[]>("audio-fft", (e) => {
          fftData.current = e.payload;
        });
        unlistenFunctions.push(u);
      } catch (err) {
        console.log("Audio IPC not available");
      }
    };
    setupAudio();

    return () => {
      isMounted = false;
      unlistenFunctions.forEach(fn => fn());
      import("@tauri-apps/api/core").then(({ invoke }) => invoke("stop_audio_capture")).catch(() => {});
    };
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const data = fftData.current;
    if (!data || data.length === 0) return;

    // Smooth the FFT data for less jittery visuals
    for (let i = 0; i < 64; i++) {
      const target = data[i] || 0;
      smoothedData.current[i] += (target - smoothedData.current[i]) * 0.3;
    }

    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const radius = 250;
      const mag = smoothedData.current[i];
      const h = Math.max(4, mag * 8000.0);

      dummy.position.set(Math.cos(angle) * (radius + h/2), Math.sin(angle) * (radius + h/2), 0);
      dummy.rotation.z = angle;
      dummy.scale.set(12, h, 12);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const color = new THREE.Color();
      color.setHSL((i / 64) * 0.8 + 0.5, 1.0, 0.5);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, 64]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Parallax Depth Effect (cursor-driven pseudo-3D)
// ─────────────────────────────────────────────────────────────
function ParallaxShift({ intensity }: { intensity: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const smoothPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      mousePos.current.x = (e.clientX / w - 0.5) * 2; // -1 to 1
      mousePos.current.y = (e.clientY / h - 0.5) * 2;
    };

    // Also listen for Tauri IPC cursor in overlay mode
    let unlisten: (() => void) | null = null;
    const setupOverlay = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<{x: number, y: number}>("cursor-moved", (e) => {
          let payload = e.payload as any;
          if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(e){} }
          if (!payload || typeof payload.x !== "number") return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          mousePos.current.x = ((payload.x / (window.devicePixelRatio || 1)) / w - 0.5) * 2;
          mousePos.current.y = ((payload.y / (window.devicePixelRatio || 1)) / h - 0.5) * 2;
        });
      } catch (err) {}
    };
    setupOverlay();

    window.addEventListener("mousemove", handler);
    return () => {
      window.removeEventListener("mousemove", handler);
      if (unlisten) unlisten();
    };
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    // Smooth lerp towards mouse position
    smoothPos.current.x += (mousePos.current.x - smoothPos.current.x) * 0.05;
    smoothPos.current.y += (mousePos.current.y - smoothPos.current.y) * 0.05;

    const shift = intensity * 30;
    groupRef.current.position.x = -smoothPos.current.x * shift;
    groupRef.current.position.y = smoothPos.current.y * shift;
  });

  return <group ref={groupRef} />;
}

// ─────────────────────────────────────────────────────────────
// 5. Fireflies (wandering glowing particles)
// ─────────────────────────────────────────────────────────────
function Fireflies({ params }: { params: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = params.count || 80;
  const speed = params.speed || 0.5;
  const size = params.size || 5.0;
  const color = params.color || "#aaff44";
  const timeRef = useRef(0);

  const [positions, seeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sd = new Float32Array(count * 3); // random seeds for per-particle motion
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2000;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1200;
      pos[i * 3 + 2] = 0;
      sd[i * 3] = Math.random() * Math.PI * 2;
      sd[i * 3 + 1] = Math.random() * Math.PI * 2;
      sd[i * 3 + 2] = 0.3 + Math.random() * 0.7;
    }
    return [pos, sd];
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    const posAttr = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const sx = seeds[i * 3];
      const sy = seeds[i * 3 + 1];
      const sp = seeds[i * 3 + 2];
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      x += Math.sin(timeRef.current * speed * sp + sx) * 40 * delta;
      y += Math.cos(timeRef.current * speed * sp * 0.7 + sy) * 30 * delta;
      if (x > 1200) x = -1200;
      if (x < -1200) x = 1200;
      if (y > 800) y = -800;
      if (y < -800) y = 800;
      posAttr.setX(i, x);
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  });

  const col = useMemo(() => new THREE.Color(color), [color]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uColor: { value: col }, uSize: { value: size }, uTime: { value: 0 } }}
        vertexShader={`
          uniform float uSize;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * (800.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float d = length(uv);
            if (d > 0.5) discard;
            float glow = exp(-d * 6.0);
            gl_FragColor = vec4(uColor, glow * 0.9);
          }
        `}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Stars (static twinkling field)
// ─────────────────────────────────────────────────────────────
function Starfield({ params }: { params: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = params.count || 400;
  const size = params.size || 3.0;
  const twinkle = params.twinkle || 0.8;
  const speed = params.speed || 0.1;
  const timeRef = useRef(0);

  const [positions, twinkleSeeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const tw = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2400;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1600;
      pos[i * 3 + 2] = 0;
      tw[i] = Math.random() * Math.PI * 2;
    }
    return [pos, tw];
  }, [count]);

  const opacities = useMemo(() => new Float32Array(count).fill(1.0), [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    const opAttr = pointsRef.current.geometry.attributes.aOpacity;
    for (let i = 0; i < count; i++) {
      opacities[i] = 0.3 + (0.5 + 0.5 * Math.sin(timeRef.current * (speed * 3) + twinkleSeeds[i])) * twinkle * 0.7;
    }
    (opAttr as THREE.BufferAttribute).set(opacities);
    opAttr.needsUpdate = true;

    // Slow drift
    const posAttr = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let x = posAttr.getX(i);
      x -= speed * 10 * delta;
      if (x < -1300) x = 1300;
      posAttr.setX(i, x);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{ uSize: { value: size } }}
        vertexShader={`
          attribute float aOpacity;
          varying float vOpacity;
          uniform float uSize;
          void main() {
            vOpacity = aOpacity;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * (800.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float d = length(uv);
            if (d > 0.5) discard;
            float core = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(1.0, 1.0, 0.95, core * vOpacity);
          }
        `}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Fog / Mist (large drifting translucent blobs)
// ─────────────────────────────────────────────────────────────
function FogEffect({ params }: { params: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = params.count || 60;
  const speed = params.speed || 0.3;
  const size = params.size || 40;
  const opacity = params.opacity || 0.4;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2600;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1400;
      pos[i * 3 + 2] = 0;
    }
    return pos;
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let x = posAttr.getX(i);
      x += speed * 30 * delta;
      if (x > 1400) x = -1400;
      posAttr.setX(i, x);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{ uSize: { value: size }, uOpacity: { value: opacity } }}
        vertexShader={`
          uniform float uSize;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * (800.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform float uOpacity;
          void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float d = length(uv);
            if (d > 0.5) discard;
            float cloud = exp(-d * 3.0) * uOpacity;
            gl_FragColor = vec4(0.85, 0.88, 0.92, cloud);
          }
        `}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Main Renderer
// ─────────────────────────────────────────────────────────────
export function WebGLEffectRenderer({ videoSrc, effects, isOverlay = false }: { videoSrc: string, effects: EffectLayer[], isOverlay?: boolean }) {
  const [liveEffects, setLiveEffects] = useState<EffectLayer[]>(effects);
  const [src, setSrc] = useState<string>("");
  const isImage = videoSrc.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;

  useEffect(() => { setLiveEffects(effects); }, [effects]);

  useEffect(() => {
    if (!videoSrc) {
      setSrc("");
      return;
    }
    const isLocal = videoSrc.match(/^[a-zA-Z]:\\/) || videoSrc.startsWith("file://");
    if (isLocal) {
      let cleanPath = videoSrc;
      if (cleanPath.startsWith("file:///")) {
        cleanPath = cleanPath.slice(8);
      } else if (cleanPath.startsWith("file://")) {
        cleanPath = cleanPath.slice(7);
      }

      const tauriCore = "@tauri-apps/api/core";
      import(tauriCore).then(({ convertFileSrc }) => {
        setSrc(convertFileSrc(cleanPath));
      }).catch(console.error);
    } else {
      setSrc(videoSrc);
    }
  }, [videoSrc]);

  useEffect(() => {
    if (!isOverlay) return;
    let isMounted = true;
    let unlistenFunctions: Array<() => void> = [];
    const setupIPC = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;
        const uUpdate = await listen("effects-updated", (e: any) => {
          try {
            const payload = typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload;
            const freshEffects = Array.isArray(payload) ? payload : (payload?.layers || []);
            setLiveEffects(freshEffects);
          } catch (err: any) {}
        });
        unlistenFunctions.push(uUpdate);
      } catch (err) {
        console.log("Tauri IPC not available, skipping effects-updated listener.");
      }
    };
    setupIPC();
    return () => { isMounted = false; unlistenFunctions.forEach(fn => fn()); };
  }, [isOverlay]);

  const rawEffects: any = liveEffects || [];
  const currentEffects: EffectLayer[] = Array.isArray(rawEffects) ? rawEffects : (rawEffects.layers || []);

  const vignette = currentEffects.find(e => e.type === "vignette" && e.enabled);
  const snow = currentEffects.find(e => e.type === "snow" && e.enabled);
  const rain = currentEffects.find(e => e.type === "rain" && e.enabled);
  const audioVis = currentEffects.find(e => e.type === "audio-visualizer" && e.enabled);
  const trail = currentEffects.find(e => e.type === "cursor-trail" && e.enabled);
  const ripple = currentEffects.find(e => e.type === "click-ripple" && e.enabled);
  const blurRegions = currentEffects.filter(e => e.type === "blur-region" && e.enabled);
  const parallax = currentEffects.find(e => e.type === "parallax" && e.enabled);
  const colorGrade = currentEffects.find(e => e.type === "color-grade" && e.enabled);
  const bloomEffect = currentEffects.find(e => e.type === "bloom" && e.enabled);
  const glitchEffect = currentEffects.find(e => e.type === "glitch" && e.enabled);
  const fireflies = currentEffects.find(e => e.type === "fireflies" && e.enabled);
  const stars = currentEffects.find(e => e.type === "stars" && e.enabled);
  const fog = currentEffects.find(e => e.type === "fog" && e.enabled);
  const clock = currentEffects.find(e => e.type === "clock" && e.enabled);

  // Check if any WebGL effect is active — skip Canvas entirely if none
  const hasWebGLEffects = snow || rain || audioVis || trail || ripple || vignette || bloomEffect || glitchEffect || parallax || fireflies || stars || fog;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "transparent" }}>
      {/* Background Media */}
      {!isOverlay && src && (
        isImage ? (
          <img src={src} className="editor-bg-video" style={{ objectFit: "cover", position: "absolute", inset: 0, width: "100%", height: "100%" }} alt="" />
        ) : (
          <video src={src} className="editor-bg-video" autoPlay loop muted playsInline style={{ objectFit: "cover", position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        )
      )}

      {/* CSS-based effects */}
      {blurRegions.map(b => (
        <div key={b.id} style={{
          position: "absolute", left: `${b.params.x}%`, top: `${b.params.y}%`, width: `${b.params.w}%`, height: `${b.params.h}%`,
          backdropFilter: `blur(${b.params.blur || 15}px)`, pointerEvents: "none", zIndex: 5
        }} />
      ))}

      {/* Color Grading Overlay */}
      {colorGrade && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6,
          background: colorGrade.params.color || "rgba(255, 100, 50, 0.15)",
          mixBlendMode: (colorGrade.params.blendMode as any) || "overlay",
          opacity: colorGrade.params.intensity || 0.3,
        }} />
      )}

      {/* Clock Widget (CSS overlay — not WebGL) */}
      {clock && (
        <ClockWidget params={clock.params} />
      )}

      {/* WebGL Canvas — only mounted when effects are active */}
      {hasWebGLEffects && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: isOverlay ? "none" : "auto" }}>
          <Canvas
            orthographic
            camera={{ position: [0, 0, 100], zoom: 1 }}
            gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              return () => { gl.dispose(); };
            }}
          >
            {parallax && <ParallaxShift intensity={parallax.params.intensity || 1.0} />}
            {snow && <FallingParticles type="snow" params={snow.params} />}
            {rain && <FallingParticles type="rain" params={rain.params} />}
            {fireflies && <Fireflies params={fireflies.params} />}
            {stars && <Starfield params={stars.params} />}
            {fog && <FogEffect params={fog.params} />}
            {audioVis && <AudioVisualizer />}
            <InteractiveParticles
              trailEnabled={!!trail}
              rippleEnabled={!!ripple}
              isOverlay={isOverlay}
              trailColor={trail?.params.color}
              rippleColor={ripple?.params.color}
            />

            {/* Post Processing Shaders */}
            {(vignette || bloomEffect || glitchEffect) && (
              <EffectComposer>
                {vignette ? <Vignette eskil={false} offset={vignette.params.offset || 0.1} darkness={vignette.params.intensity || 0.6} /> : null as any}
                {bloomEffect ? <Bloom luminanceThreshold={bloomEffect.params.threshold || 0.5} luminanceSmoothing={bloomEffect.params.smoothing || 0.9} intensity={bloomEffect.params.intensity || 1.0} height={bloomEffect.params.height || 300} /> : null as any}
                {glitchEffect ? <Glitch delay={new THREE.Vector2(glitchEffect.params.delayMin || 1.5, glitchEffect.params.delayMax || 3.5)} duration={new THREE.Vector2(0.1, 0.3)} strength={new THREE.Vector2(glitchEffect.params.strength || 0.1, (glitchEffect.params.strength || 0.1) * 2)} mode={GlitchMode.SPORADIC} active /> : null as any}
              </EffectComposer>
            )}
          </Canvas>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Clock Widget (CSS-based, not WebGL)
// ─────────────────────────────────────────────────────────────
function ClockWidget({ params }: { params: any }) {
  const [time, setTime] = useState("");
  const format = params.format || "24h";
  const style = params.style || "minimal";
  const color = params.color || "#ffffff";
  const opacity = params.opacity || 0.8;
  const x = params.x || 50;
  const y = params.y || 50;

  useEffect(() => {
    const update = () => {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, "0");
      const s = now.getSeconds().toString().padStart(2, "0");
      if (format === "12h") {
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        setTime(`${h}:${m}:${s} ${ampm}`);
      } else {
        setTime(`${h.toString().padStart(2, "0")}:${m}:${s}`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [format]);

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    transform: "translate(-50%, -50%)",
    color,
    opacity,
    pointerEvents: "none",
    zIndex: 8,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.05em",
    userSelect: "none",
  };

  const styleMap: Record<string, React.CSSProperties> = {
    minimal: { ...baseStyle, fontSize: "48px", fontWeight: "200", fontFamily: "'Inter', 'Segoe UI', sans-serif" },
    bold: { ...baseStyle, fontSize: "72px", fontWeight: "800", fontFamily: "'Inter', 'Segoe UI', sans-serif", textTransform: "uppercase" as const },
    neon: { ...baseStyle, fontSize: "56px", fontWeight: "600", fontFamily: "'Inter', 'Segoe UI', sans-serif", textShadow: `0 0 10px ${color}, 0 0 30px ${color}, 0 0 60px ${color}` },
    retro: { ...baseStyle, fontSize: "52px", fontWeight: "400", fontFamily: "'Courier New', monospace", background: "rgba(0,0,0,0.4)", padding: "8px 16px", borderRadius: "6px" },
  };

  return <div style={styleMap[style] || styleMap.minimal}>{time}</div>;
}
