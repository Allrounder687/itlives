"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom, Vignette, Glitch, ChromaticAberration, Noise, Scanline } from "@react-three/postprocessing";
import { GlitchMode, BlendFunction } from "postprocessing";
import { LiquidRipple, ScreenSpaceGodRays, RainOnGlass } from "./postprocessing/CustomEffects";
import { EffectLayer } from "./CanvasEffectRenderer";
import { RibbonTrail } from "./RibbonTrail";
import { WaterCaustics } from "./WaterCaustics";
import { BlowingLeaves } from "./BlowingLeaves";
import { DesktopPet } from "./DesktopPet";
import { ScreenCracks } from "./ScreenCracks";
import { getCoreApi } from "@/utils/tauriApis";

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
  
  const particleTex = useMemo(() => {
    try {
      const texPath = type === "rain" ? "/assets/brackeys_vfx_bundle/particles/alpha/trace_01_a.png" : "/assets/brackeys_vfx_bundle/particles/alpha/circle_05_a.png";
      return new THREE.TextureLoader().load(texPath);
    } catch(e) { return null; }
  }, [type]);

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
      gl_PointSize = aSize * 1.5;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  const fragmentShader = type === "snow" ? `
    varying float vOpacity;
    uniform vec3 uColor;
    uniform sampler2D uMap;
    
    void main() {
      vec4 texColor = texture2D(uMap, gl_PointCoord);
      
      // Use the red channel as alpha if it's a grayscale mask, otherwise use alpha
      float texAlpha = texColor.a > 0.0 ? texColor.a : texColor.r;
      
      gl_FragColor = vec4(uColor * texColor.rgb, texAlpha * vOpacity * (0.8));
    }
  ` : `
    varying float vOpacity;
    uniform vec3 uColor;
    uniform sampler2D uMap;
    
    void main() {
      vec4 texColor = texture2D(uMap, gl_PointCoord);
      float texAlpha = texColor.a > 0.0 ? texColor.a : texColor.r;
      gl_FragColor = vec4(uColor * texColor.rgb, texAlpha * vOpacity * 0.9);
    }
  `;

  const colorHex = params.color || (type === "snow" ? "#ffffff" : "#aaccff");
  const uColorObj = useMemo(() => new THREE.Color(colorHex), [colorHex]);

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
        blending={THREE.AdditiveBlending}
        uniforms={{ 
          uColor: { value: uColorObj },
          uMap: { value: particleTex }
        }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Enhanced Mouse Trail System (with Lerp Smoothing)
// ─────────────────────────────────────────────────────────────
type ParticleState = { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: THREE.Color, baseSize: number, shapeMode: number };
function InteractiveParticles({ trailEnabled, rippleEnabled, isOverlay, trailParams, rippleParams }: {
  trailEnabled: boolean, rippleEnabled: boolean, isOverlay: boolean,
  trailParams?: any, rippleParams?: any
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const particles = useRef<ParticleState[]>([]);
  const maxParticles = 2000;
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const lastCursorPos = useRef<{x: number, y: number} | null>(null);

  const colors = useMemo(() => new Float32Array(maxParticles * 3), []);
  const sizesArr = useMemo(() => new Float32Array(maxParticles), []);
  const shapesArr = useMemo(() => new Float32Array(maxParticles), []);
  
  const trailTex = useMemo(() => {
    try {
      return new THREE.TextureLoader().load("/assets/brackeys_vfx_bundle/particles/alpha/magic_01_a.png");
    } catch(e) { return null; }
  }, []);

  const trailCol = useMemo(() => new THREE.Color(trailParams?.color || "#9ae600"), [trailParams?.color]);
  const rippleCol = useMemo(() => new THREE.Color(rippleParams?.color || "#ffffff"), [rippleParams?.color]);

  const shapeToInt = (s: string) => {
    if (s === "spark") return 1.0;
    if (s === "square") return 2.0;
    if (s === "ring") return 3.0;
    return 0.0;
  };

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
                color: trailCol.clone(),
                baseSize: trailParams?.size || 8,
                shapeMode: shapeToInt(trailParams?.shape || "circle")
              });
            }
          } else {
            particles.current.push({
              x: targetX, y: targetY,
              vx: (Math.random() - 0.5) * 80,
              vy: (Math.random() - 0.5) * 80,
              life: 40, maxLife: 40,
              color: trailCol.clone(),
              baseSize: trailParams?.size || 8,
              shapeMode: shapeToInt(trailParams?.shape || "circle")
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
              color: rippleCol.clone(),
              baseSize: rippleParams?.size || 12,
              shapeMode: shapeToInt(rippleParams?.shape || "circle")
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
  }, [isOverlay, trailEnabled, rippleEnabled, trailCol, rippleCol, trailParams, rippleParams]);

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
      sizesArr[i] = progress * p.baseSize;
      shapesArr[i] = p.shapeMode;
    }

    geometryRef.current.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometryRef.current.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometryRef.current.setAttribute("size", new THREE.BufferAttribute(sizesArr, 1));
    geometryRef.current.setAttribute("shapeMode", new THREE.BufferAttribute(shapesArr, 1));
    geometryRef.current.setDrawRange(0, Math.min(active.length, maxParticles));
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uMap: { value: trailTex }
        }}
        vertexShader={`
          attribute float size;
          attribute vec3 color;
          attribute float shapeMode;
          varying vec3 vColor;
          varying float vShapeMode;
          void main() {
            vColor = color;
            vShapeMode = shapeMode;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * 3.0; // slightly larger for textures
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying float vShapeMode;
          uniform sampler2D uMap;
          void main() {
            vec4 texColor = texture2D(uMap, gl_PointCoord);
            float texAlpha = texColor.a > 0.0 ? texColor.a : texColor.r;
            
            // Still respect ring/square bounds somewhat if they want hard shapes, 
            // but use the magical texture for the core look
            vec2 xy = gl_PointCoord.xy - vec2(0.5);
            float ll = length(xy);
            
            float alphaMod = 1.0;
            if (vShapeMode > 2.5) {
              // Ring
              if (ll > 0.5 || ll < 0.25) discard;
            }
            
            gl_FragColor = vec4(vColor * texColor.rgb, texAlpha * alphaMod);
          }
        `}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Audio Visualizer System
// ─────────────────────────────────────────────────────────────
function AudioVisualizer({ params, layerId }: { params: any, layerId?: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const fftData = useRef<number[]>(new Array(64).fill(0));
  const smoothedData = useRef<number[]>(new Array(64).fill(0));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const { viewport } = useThree();
  const radius = params?.radius || 250;
  const scale = params?.scale || 1.0;
  const color = params?.color || "#ffffff";
  const style = params?.style || "circle";
  const colObj = useMemo(() => new THREE.Color(color), [color]);

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

    const posX = ((params?.x || 50) - 50) / 100 * viewport.width;
    const posY = -((params?.y || 50) - 50) / 100 * viewport.height;

    for (let i = 0; i < 64; i++) {
      const mag = smoothedData.current[i];
      const h = Math.max(4, mag * 8000.0 * scale);

      if (style === "circle") {
        const angle = (i / 64) * Math.PI * 2;
        dummy.position.set(Math.cos(angle) * (radius + h/2) + posX, Math.sin(angle) * (radius + h/2) + posY, 0);
        dummy.rotation.z = angle;
      } else if (style === "horizontal") {
        const totalWidth = radius * 2.5;
        const spacing = totalWidth / 64;
        dummy.position.set(posX - totalWidth/2 + i * spacing, posY + h/2, 0);
        dummy.rotation.z = 0;
      } else if (style === "mirror") {
        const totalWidth = radius * 2.5;
        const spacing = (totalWidth / 2) / 32;
        if (i < 32) {
          // Left side
          dummy.position.set(posX - (32 - i) * spacing, posY + h/2, 0);
        } else {
          // Right side
          dummy.position.set(posX + (i - 32) * spacing, posY + h/2, 0);
        }
        dummy.rotation.z = 0;
      }

      dummy.scale.set(12 * scale, h, 12 * scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const particleCol = new THREE.Color();
      particleCol.copy(colObj).multiplyScalar(0.5 + (i / 64) * 0.5 + (mag * 2.0));
      meshRef.current.setColorAt(i, particleCol);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, 64]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={params?.opacity || 0.8} />
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

  const col = useMemo(() => new THREE.Color(color), [color]);
  
  const particleTex = useMemo(() => {
    if (!params.texture) return null;
    try {
      return new THREE.TextureLoader().load(params.texture);
    } catch(e) { return null; }
  }, [params.texture]);

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

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ 
          uColor: { value: col }, 
          uSize: { value: size }, 
          uTime: { value: 0 },
          uMap: { value: particleTex },
          useMap: { value: !!particleTex ? 1.0 : 0.0 }
        }}
        vertexShader={`
          uniform float uSize;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * 3.0;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform sampler2D uMap;
          uniform float useMap;
          void main() {
            if (useMap > 0.5) {
              vec4 texColor = texture2D(uMap, gl_PointCoord);
              gl_FragColor = vec4(uColor * texColor.rgb, texColor.a * texColor.r);
            } else {
              vec2 uv = gl_PointCoord - vec2(0.5);
              float d = length(uv);
              if (d > 0.5) discard;
              float glow = exp(-d * 6.0);
              gl_FragColor = vec4(uColor, glow * 0.9);
            }
          }
        `}
      />
    </points>
  );
}

// ─────────────────────────────────────────────────────────────
// 5.5 Particle Engine (Unity Shuriken Style GPU Emitter)
// ─────────────────────────────────────────────────────────────
function ParticleEmitter({ params, isOverlay }: { params: any, isOverlay: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = params.count || 500;
  const speed = params.speed || 2.0;
  const spread = params.spread || 1.0;
  const followMouse = params.followMouse || false;
  
  const timeRef = useRef(0);
  const { viewport } = useThree();

  const [positions, velocities, lifetimes, startTimes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const start = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Base positions are all [0,0,0] relative to the emitter. 
      // The offset is determined in the shader using the uOffset uniform.
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = 0;

      // Cone/Spread velocity upwards
      vel[i * 3] = (Math.random() - 0.5) * 100 * spread;
      vel[i * 3 + 1] = 100 * speed + Math.random() * 50;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 20;

      life[i] = 1.0 + Math.random() * 2.0; // 1 to 3 seconds
      start[i] = Math.random() * 5.0; // random start time for continuous flow
    }
    return [pos, vel, life, start];
  }, [count, speed, spread]);

  // Map Editor % coordinates to WebGL coordinates
  const emitterX = ((params.x || 50) - 50) * (viewport.width / 100);
  const emitterY = -((params.y || 50) - 50) * (viewport.height / 100);

  const particleTex = useMemo(() => {
    if (!params.texture) return null;
    try {
      return new THREE.TextureLoader().load(params.texture);
    } catch(e) { return null; }
  }, [params.texture]);

  const colStart = useMemo(() => new THREE.Color(params.colorStart || "#ff5a00"), [params.colorStart]);
  const colEnd = useMemo(() => new THREE.Color(params.colorEnd || "#000000"), [params.colorEnd]);

  const globalMousePos = useRef<{x: number, y: number} | null>(null);
  const particleIdx = useRef(0);
  const emissionAccumulator = useRef(0);
  const lastMousePos = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    if (!followMouse) return;
    let isMounted = true;
    let unlistenFunctions: Array<() => void> = [];

    const setupIPC = async () => {
      if (!isOverlay) {
        const handleMove = (e: PointerEvent) => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          globalMousePos.current = {
            x: e.clientX - w/2,
            y: -e.clientY + h/2
          };
        };
        window.addEventListener("pointermove", handleMove);
        unlistenFunctions.push(() => window.removeEventListener("pointermove", handleMove));
        return;
      }

      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;
        const unCursor = await listen<{x: number, y: number}>("cursor-moved", (e) => {
          let payload = e.payload as any;
          if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(e){} }
          if (!payload || typeof payload.x !== "number") return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          globalMousePos.current = {
            x: (payload.x / (window.devicePixelRatio || 1)) - w/2,
            y: -(payload.y / (window.devicePixelRatio || 1)) + h/2
          };
        });
        unlistenFunctions.push(unCursor);
      } catch (e) {
        console.log("Tauri IPC not available for particle emitter");
      }
    };
    setupIPC();

    return () => { isMounted = false; unlistenFunctions.forEach(fn => fn()); };
  }, [followMouse, isOverlay]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    
    const mat = pointsRef.current.material as THREE.ShaderMaterial;
    if (mat.uniforms) {
      mat.uniforms.uTime.value = timeRef.current;
    }

    const posAttr = pointsRef.current.geometry.attributes.position;
    const startAttr = pointsRef.current.geometry.attributes.aStartTime;
    const lifeAttr = pointsRef.current.geometry.attributes.aLife;
    const velAttr = pointsRef.current.geometry.attributes.aVelocity;
    
    const targetX = followMouse && globalMousePos.current ? globalMousePos.current.x : emitterX;
    const targetY = followMouse && globalMousePos.current ? globalMousePos.current.y : emitterY;

    // We want to emit all `count` particles over roughly 1.5 seconds so it continuously loops.
    // E.g., if count is 500, we emit ~333 particles per second.
    const emissionRate = count / 1.5; 
    emissionAccumulator.current += delta * emissionRate;
    const numToSpawn = Math.floor(emissionAccumulator.current);

    if (numToSpawn > 0) {
      emissionAccumulator.current -= numToSpawn;
      const last = lastMousePos.current || { x: targetX, y: targetY };
      
      let didUpdate = false;
      for (let s = 1; s <= numToSpawn; s++) {
        const t = s / numToSpawn;
        const spawnX = last.x + (targetX - last.x) * t;
        const spawnY = last.y + (targetY - last.y) * t;

        const i = particleIdx.current;
        
        posAttr.setX(i, spawnX + (Math.random() - 0.5) * 10);
        posAttr.setY(i, spawnY + (Math.random() - 0.5) * 10);
        posAttr.setZ(i, 0);
        
        velAttr.setX(i, (Math.random() - 0.5) * 100 * spread);
        velAttr.setY(i, 100 * speed + Math.random() * 50);
        velAttr.setZ(i, (Math.random() - 0.5) * 20);
        
        startAttr.setX(i, timeRef.current);
        lifeAttr.setX(i, 1.0 + Math.random() * 1.5); // 1 to 2.5 seconds
        
        particleIdx.current = (particleIdx.current + 1) % count;
        didUpdate = true;
      }
      
      if (didUpdate) {
        posAttr.needsUpdate = true;
        startAttr.needsUpdate = true;
        velAttr.needsUpdate = true;
        lifeAttr.needsUpdate = true;
      }
    }
    
    lastMousePos.current = { x: targetX, y: targetY };
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aVelocity" args={[velocities, 3]} />
        <bufferAttribute attach="attributes-aLife" args={[lifetimes, 1]} />
        <bufferAttribute attach="attributes-aStartTime" args={[startTimes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ 
          uTime: { value: 0 },
          uMap: { value: particleTex },
          useMap: { value: !!particleTex ? 1.0 : 0.0 },
          uColorStart: { value: colStart },
          uColorEnd: { value: colEnd },
        }}
        vertexShader={`
          attribute vec3 aVelocity;
          attribute float aLife;
          attribute float aStartTime;
          
          uniform float uTime;
          varying float vProgress;

          void main() {
            float age = uTime - aStartTime;
            if (uTime < aStartTime || age > aLife) {
              // Particle is dead or not yet born
              gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // off-screen
              gl_PointSize = 0.0;
              return;
            }
            vProgress = age / aLife;
            
            vec3 pos = position + aVelocity * age;
            
            // Add a little wind/drift sine wave
            pos.x += sin(age * 3.0 + position.x) * 10.0;
            
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            
            // Size over lifetime (starts small, gets big)
            float sizeCurve = sin(vProgress * 3.1415);
            gl_PointSize = 60.0 * sizeCurve;
            
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform sampler2D uMap;
          uniform float useMap;
          uniform vec3 uColorStart;
          uniform vec3 uColorEnd;
          
          varying float vProgress;

          void main() {
            if (vProgress <= 0.001 || vProgress >= 0.99) discard;
            
            // Interpolate color over lifetime
            vec3 color = mix(uColorStart, uColorEnd, vProgress);
            
            // Fade out opacity near end of life
            float alphaCurve = sin(vProgress * 3.1415);
            
            if (useMap > 0.5) {
              vec4 texColor = texture2D(uMap, gl_PointCoord);
              // Multiplicative color tinting with additive blending friendly alpha
              gl_FragColor = vec4(color * texColor.rgb * alphaCurve, texColor.a * alphaCurve);
            } else {
              vec2 uv = gl_PointCoord - vec2(0.5);
              float d = length(uv);
              if (d > 0.5) discard;
              float glow = exp(-d * 6.0);
              gl_FragColor = vec4(color, glow * alphaCurve);
            }
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
  const color = params.color || "#ffffff";
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

  const col = useMemo(() => new THREE.Color(color), [color]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{ uSize: { value: size }, uColor: { value: col } }}
        vertexShader={`
          attribute float aOpacity;
          varying float vOpacity;
          uniform float uSize;
          void main() {
            vOpacity = aOpacity;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * 1.5;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          uniform vec3 uColor;
          void main() {
            vec2 uv = gl_PointCoord - vec2(0.5);
            float d = length(uv);
            if (d > 0.5) discard;
            float core = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(uColor, core * vOpacity);
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
  const color = params.color || "#d9e0eb";

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

  const col = useMemo(() => new THREE.Color(color), [color]);
  
  const fogTex = useMemo(() => {
    try {
      return new THREE.TextureLoader().load("/assets/brackeys_vfx_bundle/particles/alpha/smoke_04_a.png");
    } catch(e) { return null; }
  }, []);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{ 
          uSize: { value: size }, 
          uOpacity: { value: opacity }, 
          uColor: { value: col },
          uMap: { value: fogTex }
        }}
        vertexShader={`
          uniform float uSize;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * 3.0; // Fog needs to be larger
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform float uOpacity;
          uniform vec3 uColor;
          uniform sampler2D uMap;
          void main() {
            vec4 texColor = texture2D(uMap, gl_PointCoord);
            float texAlpha = texColor.a > 0.0 ? texColor.a : texColor.r;
            gl_FragColor = vec4(uColor * texColor.rgb, texAlpha * uOpacity);
          }
        `}
      />
    </points>
  );
}

import { useDominantColor } from "@/hooks/useDominantColor";
// ─────────────────────────────────────────────────────────────
// Sprite Layer (Phase 4: Assets & Textures)
// ─────────────────────────────────────────────────────────────
function SpriteLayer({ params }: { params: any }) {
  const { viewport } = useThree();
  
  const texture = useMemo(() => {
    if (!params.image) return null;
    try {
      const tex = new THREE.TextureLoader().load(params.image);
      return tex;
    } catch (e) {
      return null;
    }
  }, [params.image]);

  const swayMapTex = useMemo(() => {
    if (!params.swayMap) return null;
    try {
      return new THREE.TextureLoader().load(params.swayMap);
    } catch (e) { return null; }
  }, [params.swayMap]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSway: { value: params.sway || 0 },
    swayMap: { value: swayMapTex },
    useSwayMap: { value: !!swayMapTex ? 1.0 : 0.0 }
  }), [params.sway, swayMapTex]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (!texture) return null;

  // Map 0-100 properties to WebGL viewport coordinates
  const vx = (params.x / 100 - 0.5) * viewport.width;
  const vy = -(params.y / 100 - 0.5) * viewport.height;
  
  // Use width property to scale relative to the viewport (1000 width = 100% of viewport width)
  const sizeX = (params.width / 1000) * viewport.width;
  const sizeY = (params.height / 1000) * viewport.width;
  
  const rotationZ = -(params.rotation || 0) * (Math.PI / 180);

  return (
    <mesh position={[vx, vy, 0]} rotation={[0, 0, rotationZ]}>
      {/* Dense geometry (16x16 segments) is required for smooth vertex displacement / sway */}
      <planeGeometry args={[sizeX, sizeY, 16, 16]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={{
          map: { value: texture },
          opacity: { value: params.opacity ?? 1.0 },
          ...uniforms
        }}
        vertexShader={`
          uniform float uTime;
          uniform float uSway;
          uniform sampler2D swayMap;
          uniform float useSwayMap;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 pos = position;
            
            float swayStrength = 0.0;
            if (useSwayMap > 0.5) {
              // Read the red channel of the distortion texture
              swayStrength = texture2D(swayMap, uv).r * uSway * 10.0;
            } else {
              // Fallback: bottom anchor
              swayStrength = uv.y * uSway * 10.0;
            }
            
            pos.x += sin(uTime * 2.0 + pos.y * 0.05) * swayStrength;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform sampler2D map;
          uniform float opacity;
          varying vec2 vUv;
          void main() {
            vec4 texColor = texture2D(map, vUv);
            gl_FragColor = vec4(texColor.rgb, texColor.a * opacity);
          }
        `}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Background Quad — renders background image/video inside the
// Canvas so post-processing shaders can see it
// ─────────────────────────────────────────────────────────────
function BackgroundQuad({ src, isImage }: { src: string; isImage: boolean }) {
  const { viewport } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!src) return;

    if (isImage) {
      const loader = new THREE.TextureLoader();
      loader.load(src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textureRef.current = tex;
        if (meshRef.current) {
          (meshRef.current.material as THREE.MeshBasicMaterial).map = tex;
          (meshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
      });
    } else {
      const video = document.createElement("video");
      video.src = src;
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(() => {});
      videoRef.current = video;

      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = tex;
      if (meshRef.current) {
        (meshRef.current.material as THREE.MeshBasicMaterial).map = tex;
        (meshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
      }
    }

    return () => {
      if (textureRef.current) textureRef.current.dispose();
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    };
  }, [src, isImage]);

  return (
    <mesh ref={meshRef} position={[0, 0, -50]} renderOrder={-1000}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <meshBasicMaterial transparent={false} depthWrite={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Main Renderer
// ─────────────────────────────────────────────────────────────
export function WebGLEffectRenderer({ videoSrc, effects, isOverlay = false, selectedLayerId, onUpdateParam }: { videoSrc: string, effects: EffectLayer[], isOverlay?: boolean, selectedLayerId?: string | null, onUpdateParam?: (id: string, key: string, val: any) => void }) {
  const [liveEffects, setLiveEffects] = useState<EffectLayer[]>(effects);
  const [src, setSrc] = useState<string>("");
  const isImage = videoSrc.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, initialValX: 0, initialValY: 0 });
  const mediaRef = useRef<any>(null);
  
  const autoColor = useDominantColor(mediaRef, true);

  useEffect(() => {
    if (autoColor && localStorage.getItem("syncWindowsAccent") !== "false") {
      getCoreApi().then(({ invoke }) => {
        invoke("sync_windows_accent_color", { hexColor: autoColor }).catch(console.error);
      });
    }
  }, [autoColor]);

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

    // Hover logic for Ignore Cursor Events toggle
    let wasInteractive = false;
    const setupOverlayInteraction = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        // Note: setIgnoreCursorEvents(false) does not work when the window is behind SHELLDLL_DefView
        // so we manually proxy global clicks into synthetic DOM events.
        const uClick = await listen<{x: number, y: number}>("cursor-click", (e) => {
          let payload = e.payload as any;
          if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(e){} }
          if (!payload || typeof payload.x !== "number") return;
          
          const clientX = payload.x / (window.devicePixelRatio || 1);
          const clientY = payload.y / (window.devicePixelRatio || 1);
          
          const el = document.elementFromPoint(clientX, clientY);
          if (el && el.closest('.interactive-widget')) {
            const btn = el.tagName === 'BUTTON' ? el : el.closest('button');
            if (btn) {
              (btn as HTMLElement).click();
            } else {
              el.dispatchEvent(new PointerEvent("pointerdown", {
                bubbles: true, cancelable: true, clientX, clientY, view: window
              }));
              el.dispatchEvent(new MouseEvent("click", {
                bubbles: true, cancelable: true, clientX, clientY, view: window
              }));
            }
          }
        });
        unlistenFunctions.push(uClick);
      } catch (err) {}
    };
    setupOverlayInteraction();

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
  const particleEmitter = currentEffects.find(e => e.type === "particle-emitter" && e.enabled);
  const stars = currentEffects.find(e => e.type === "stars" && e.enabled);
  const fog = currentEffects.find(e => e.type === "fog" && e.enabled);
  const clock = currentEffects.find(e => e.type === "clock" && e.enabled);
  const musicPlayer = currentEffects.find(e => e.type === "music-player" && e.enabled);
  const ribbonTrail = currentEffects.find(e => e.type === "ribbon-trail" && e.enabled);
  const waterCaustics = currentEffects.find(e => e.type === "water-caustics" && e.enabled);
  const blowingLeaves = currentEffects.find(e => e.type === "blowing-leaves" && e.enabled);
  const appLauncher = currentEffects.find(e => e.type === "app-launcher" && e.enabled);
  const sprites = currentEffects.filter(e => e.type === "sprite" && e.enabled);
  
  const godRays = currentEffects.find(e => e.type === "god-rays" && e.enabled);
  const vhs = currentEffects.find(e => e.type === "vhs" && e.enabled);
  const liquidRipple = currentEffects.find(e => e.type === "liquid-ripple" && e.enabled);
  const rainOnGlass = currentEffects.find(e => e.type === "rain-on-glass" && e.enabled);
  const desktopPet = currentEffects.find(e => e.type === "desktop-pet" && e.enabled);

  // Post-processing effects need the background rendered inside the Canvas
  const hasPostProcessing = !!(godRays || vhs || liquidRipple || rainOnGlass);

  // Check if any WebGL effect is active — skip Canvas entirely if none
  const hasWebGLEffects = desktopPet || sprites.length > 0 || snow || rain || audioVis || trail || ripple || ribbonTrail || vignette || bloomEffect || glitchEffect || parallax || fireflies || particleEmitter || stars || fog || waterCaustics || blowingLeaves || godRays || vhs || liquidRipple || rainOnGlass;

  const resolveParams = (p: any) => {
    if (!p) return p;
    if (p.color === "auto") return { ...p, color: autoColor };
    return p;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isOverlay || !selectedLayerId || !onUpdateParam) return;
    const layer = currentEffects.find(l => l.id === selectedLayerId);
    if (!layer || (layer.type !== "clock" && layer.type !== "audio-visualizer" && layer.type !== "blur-region" && layer.type !== "music-player" && layer.type !== "app-launcher" && layer.type !== "sprite" && layer.type !== "particle-emitter" && layer.type !== "god-rays")) return;
    
    dragState.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialValX: layer.params.x || 50,
      initialValY: layer.params.y || 50
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.isDragging || !selectedLayerId || !onUpdateParam) return;
    
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const percentX = (dx / rect.width) * 100;
    const percentY = (dy / rect.height) * 100;

    let newX = Math.round(dragState.current.initialValX + percentX);
    let newY = Math.round(dragState.current.initialValY + percentY);
    
    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));

    onUpdateParam(selectedLayerId, "x", newX);
    onUpdateParam(selectedLayerId, "y", newY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.current.isDragging) {
      dragState.current.isDragging = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div 
      style={{ position: "relative", width: "100%", height: "100%", background: "transparent", touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Background Media — hidden when post-processing renders it inside Canvas */}
      {src && (
        isImage ? (
          <img ref={mediaRef} src={src} className="editor-bg-video" style={{ objectFit: "cover", position: "absolute", inset: 0, width: "100%", height: "100%", display: (isOverlay || hasPostProcessing) ? "none" : "block" }} alt="" />
        ) : (
          <video ref={mediaRef} src={src} className="editor-bg-video" autoPlay loop muted playsInline style={{ objectFit: "cover", position: "absolute", inset: 0, width: "100%", height: "100%", display: (isOverlay || hasPostProcessing) ? "none" : "block" }} />
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
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20,
          background: colorGrade.params.color || "rgba(255, 100, 50, 0.15)",
          mixBlendMode: (colorGrade.params.blendMode as any) || "overlay",
          opacity: colorGrade.params.intensity || 0.3,
        }} />
      )}

      {/* Clock Widget (CSS overlay — not WebGL) */}
      {clock && (
        <ClockWidget params={clock.params} layerId={clock.id} autoColor={autoColor} />
      )}

      {/* Music Player Widget */}
      {musicPlayer && (
        <MusicPlayerWidget params={musicPlayer.params} layerId={musicPlayer.id} isOverlay={isOverlay} />
      )}

      {/* App Launcher Widget */}
      {appLauncher && (
        <AppLauncherWidget params={appLauncher.params} layerId={appLauncher.id} isOverlay={isOverlay} />
      )}

      {/* Screen Cracks from Desktop Pet */}
      <ScreenCracks color={autoColor || "#ffffff"} />

      {/* WebGL Canvas — only mounted when effects are active */}
      {hasWebGLEffects && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
          <Canvas
            orthographic
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 100], zoom: 1 }}
            gl={{ alpha: !hasPostProcessing, antialias: false, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              return () => { gl.dispose(); };
            }}
            style={{ width: "100%", height: "100%", pointerEvents: "none" }}
          >
            {/* When post-processing is active, render background inside Canvas */}
            {hasPostProcessing && src && <BackgroundQuad src={src} isImage={isImage} />}
            {parallax && <ParallaxShift intensity={parallax.params.intensity || 1.0} />}
            {snow && <FallingParticles type="snow" params={resolveParams(snow.params)} />}
            {rain && <FallingParticles type="rain" params={resolveParams(rain.params)} />}
            {fireflies && <Fireflies params={resolveParams(fireflies.params)} />}
            {particleEmitter && <ParticleEmitter params={resolveParams(particleEmitter.params)} isOverlay={isOverlay} />}
            {stars && <Starfield params={resolveParams(stars.params)} />}
            {fog && <FogEffect params={resolveParams(fog.params)} />}
            {audioVis && <AudioVisualizer params={resolveParams(audioVis.params)} layerId={audioVis.id} />}
            {waterCaustics && <WaterCaustics params={resolveParams(waterCaustics.params)} />}
            {blowingLeaves && <BlowingLeaves params={resolveParams(blowingLeaves.params)} />}
            {desktopPet && (
              <DesktopPet 
                params={resolveParams(desktopPet.params)} 
                isOverlay={isOverlay} 
                widgets={[clock, musicPlayer, appLauncher, audioVis].filter(Boolean)} 
                onUpdateParam={onUpdateParam}
              />
            )}
            <InteractiveParticles
              trailEnabled={!!trail}
              rippleEnabled={!!ripple}
              isOverlay={isOverlay}
              trailParams={resolveParams(trail?.params)}
              rippleParams={resolveParams(ripple?.params)}
            />
            {ribbonTrail && (
              <RibbonTrail 
                color={ribbonTrail.params.color === "auto" ? autoColor : ribbonTrail.params.color}
                length={ribbonTrail.params.length || 50}
                width={ribbonTrail.params.width || 5.0}
                isOverlay={isOverlay}
              />
            )}

            {sprites.map(s => <SpriteLayer key={s.id} params={s.params} />)}

            {/* Post Processing Shaders */}
            {(() => {
              const passes: React.ReactElement[] = [];
              if (godRays) passes.push(<ScreenSpaceGodRays key="godrays" params={resolveParams(godRays.params)} />);
              if (liquidRipple) passes.push(
                <LiquidRipple
                  key="liquid"
                  isOverlay={isOverlay}
                  intensity={liquidRipple.params.intensity}
                  waveMode={liquidRipple.params.waveMode || "off"}
                  waveZoneX={liquidRipple.params.waveZoneX}
                  waveZoneY={liquidRipple.params.waveZoneY}
                  waveZoneW={liquidRipple.params.waveZoneW}
                  waveZoneH={liquidRipple.params.waveZoneH}
                  waveSpeed={liquidRipple.params.waveSpeed}
                  waveScale={liquidRipple.params.waveScale}
                  waveStrength={liquidRipple.params.waveStrength}
                  autoRipple={liquidRipple.params.autoRipple}
                  autoInterval={liquidRipple.params.autoInterval}
                  autoZoneX={liquidRipple.params.autoZoneX}
                  autoZoneY={liquidRipple.params.autoZoneY}
                  autoZoneW={liquidRipple.params.autoZoneW}
                  autoZoneH={liquidRipple.params.autoZoneH}
                  raindrops={liquidRipple.params.raindrops}
                  rainIntensity={liquidRipple.params.rainIntensity}
                />
              );
              if (rainOnGlass) passes.push(<RainOnGlass key="rain" params={resolveParams(rainOnGlass.params)} />);
              if (vignette) passes.push(<Vignette key="vignette" eskil={false} offset={vignette.params.offset || 0.1} darkness={vignette.params.intensity || 0.6} />);
              if (bloomEffect) passes.push(<Bloom key="bloom" luminanceThreshold={bloomEffect.params.threshold || 0.5} luminanceSmoothing={bloomEffect.params.smoothing || 0.9} intensity={bloomEffect.params.intensity || 1.0} height={bloomEffect.params.height || 300} />);
              if (glitchEffect) passes.push(<Glitch key="glitch" delay={new THREE.Vector2(glitchEffect.params.delayMin || 1.5, glitchEffect.params.delayMax || 3.5)} duration={new THREE.Vector2(0.1, 0.3)} strength={new THREE.Vector2(glitchEffect.params.strength || 0.1, (glitchEffect.params.strength || 0.1) * 2)} mode={GlitchMode.SPORADIC} active />);
              
              if (vhs) {
                passes.push(<ChromaticAberration key="vhs-chroma" blendFunction={BlendFunction.NORMAL} offset={new THREE.Vector2(vhs.params.rgbShift || 0.02, vhs.params.rgbShift || 0.02)} />);
                passes.push(<Noise key="vhs-noise" opacity={vhs.params.noise || 0.3} blendFunction={BlendFunction.OVERLAY} />);
                passes.push(<Scanline key="vhs-scan" density={vhs.params.scanlines || 1.0} opacity={0.5} blendFunction={BlendFunction.OVERLAY} />);
              }

              if (passes.length === 0) return null;

              return (
                <EffectComposer key={passes.map(p => p.key).join("-")}>
                  {passes}
                </EffectComposer>
              );
            })()}
          </Canvas>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Clock Widget (CSS-based, not WebGL)
// ─────────────────────────────────────────────────────────────
function ClockWidget({ params, layerId, autoColor }: { params: any; layerId?: string; autoColor?: string }) {
  const [timeState, setTimeState] = useState({ text: "", dayText: "", h: 0, m: 0, s: 0 });
  const format = params.format || "24h";
  const style = params.style || "minimal";
  const rawColor = params.color || "#ffffff";
  const color = rawColor === "auto" ? (autoColor || "#ffffff") : rawColor;
  const opacity = params.opacity || 0.8;
  const x = params.x || 50;
  const y = params.y || 50;

  useEffect(() => {
    const update = () => {
      const now = new Date();
      let h = now.getHours();
      const rawH = h;
      const m = now.getMinutes();
      const s = now.getSeconds();
      const strM = m.toString().padStart(2, "0");
      const strS = s.toString().padStart(2, "0");
      let text = "";
      if (format === "12h") {
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        text = `${h}:${strM} ${ampm}`; // simplified time for futuristic
      } else {
        text = `${h.toString().padStart(2, "0")}:${strM}`; // simplified time
      }

      const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const dayText = days[now.getDay()];

      setTimeState({ text, dayText, h: rawH, m, s });
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

  if (style === "analog") {
    const size = params.size || 160;
    const center = size / 2;
    const sAngle = (timeState.s / 60) * 360;
    const mAngle = (timeState.m / 60) * 360 + (timeState.s / 60) * 6;
    const hAngle = ((timeState.h % 12) / 12) * 360 + (timeState.m / 60) * 30;
    
    return (
      <div id={layerId ? `widget-${layerId}` : undefined} style={{ ...baseStyle, width: size, height: size, border: `4px solid ${color}`, borderRadius: "50%", boxShadow: `0 0 20px rgba(0,0,0,0.3), inset 0 0 20px rgba(0,0,0,0.3)` }}>
        {/* Hour markers */}
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{ position: "absolute", left: "50%", top: "4px", width: "4px", height: "12px", background: color, transformOrigin: `50% ${center - 4}px`, transform: `translateX(-50%) rotate(${i * 30}deg)`, opacity: 0.6 }} />
        ))}
        {/* Hour hand */}
        <div style={{ position: "absolute", left: "50%", bottom: "50%", width: "6px", height: "25%", background: color, transformOrigin: "bottom center", transform: `translateX(-50%) rotate(${hAngle}deg)`, borderRadius: "3px" }} />
        {/* Minute hand */}
        <div style={{ position: "absolute", left: "50%", bottom: "50%", width: "4px", height: "35%", background: color, transformOrigin: "bottom center", transform: `translateX(-50%) rotate(${mAngle}deg)`, borderRadius: "2px" }} />
        {/* Second hand */}
        <div style={{ position: "absolute", left: "50%", bottom: "50%", width: "2px", height: "40%", background: params.secondaryColor || "#ff3366", transformOrigin: "bottom center", transform: `translateX(-50%) rotate(${sAngle}deg)` }} />
        {/* Center dot */}
        <div style={{ position: "absolute", left: "50%", top: "50%", width: "12px", height: "12px", background: color, borderRadius: "50%", transform: "translate(-50%, -50%)" }} />
      </div>
    );
  }

  const styleMap: Record<string, React.CSSProperties> = {
    minimal: { ...baseStyle, fontSize: "48px", fontWeight: "200", fontFamily: "'Inter', 'Segoe UI', sans-serif" },
    bold: { ...baseStyle, fontSize: "72px", fontWeight: "800", fontFamily: "'Inter', 'Segoe UI', sans-serif", textTransform: "uppercase", textShadow: "0 4px 12px rgba(0,0,0,0.4)" },
    neon: { ...baseStyle, fontSize: "56px", fontWeight: "600", fontFamily: "'Inter', 'Segoe UI', sans-serif", textShadow: `0 0 10px ${color}, 0 0 30px ${color}, 0 0 60px ${color}` },
    retro: { ...baseStyle, fontSize: "52px", fontWeight: "400", fontFamily: "'Courier New', monospace", background: "rgba(0,0,0,0.5)", padding: "12px 24px", borderRadius: "12px", border: `2px solid ${color}`, boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)" },
    "digital-clean": { ...baseStyle, fontSize: "64px", fontWeight: "300", fontFamily: "'Roboto', 'Segoe UI', sans-serif", background: "rgba(255,255,255,0.05)", padding: "16px 32px", borderRadius: "20px", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" },
  };

  if (style === "futuristic-day") {
    return (
      <div id={layerId ? `widget-${layerId}` : undefined} style={{ ...baseStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Import futuristic font inline just for this style if not globally available */}
        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&display=swap');
        `}} />
        <div style={{ 
          fontFamily: "'Syncopate', sans-serif", 
          fontSize: "42px", 
          fontWeight: 700, 
          letterSpacing: "24px", 
          textTransform: "uppercase",
          textShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
          marginBottom: "10px",
          marginLeft: "24px" // Offset letter spacing centering
        }}>
          {timeState.dayText}
        </div>
        <div style={{ 
          fontFamily: "'Inter', sans-serif", 
          fontSize: "84px", 
          fontWeight: 600, 
          letterSpacing: "4px",
          textShadow: `0 4px 20px rgba(0,0,0,0.5)`
        }}>
          {timeState.text}
        </div>
      </div>
    );
  }

  return <div id={layerId ? `widget-${layerId}` : undefined} style={styleMap[style] || styleMap.minimal}>{timeState.text}</div>;
}

// ─────────────────────────────────────────────────────────────
// Music Player Widget (CSS-based, not WebGL)
// ─────────────────────────────────────────────────────────────
function MusicPlayerWidget({ params, layerId, isOverlay }: { params: any; layerId?: string; isOverlay?: boolean }) {
  const [media, setMedia] = useState({ title: "", artist: "", album: "", is_playing: false, thumbnail_base64: null as string | null });
  const [timeline, setTimeline] = useState({ position: 0, start_time: 0, end_time: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  
  useEffect(() => {
    let unlistenFunctions: Array<() => void> = [];
    let isMounted = true;

    const setupEvents = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        if (isMounted) {
          const currentMedia: any = await invoke("get_current_media_info");
          if (currentMedia) setMedia(currentMedia);
        }

        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;
        const u1 = await listen<any>("media-updated", (e) => setMedia(e.payload));
        const u2 = await listen<any>("media-timeline", (e) => setTimeline(e.payload));
        unlistenFunctions.push(u1, u2);
      } catch (e) {
        console.error("Failed to setup media listener", e);
      }
    };
    setupEvents();

    const fetchVolume = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const v = await invoke<number>("media_get_volume");
        if (isMounted) setVolume(v);
      } catch (e) {}
    };
    fetchVolume();
    const volInterval = setInterval(fetchVolume, 2000);

    return () => {
      isMounted = false;
      clearInterval(volInterval);
      unlistenFunctions.forEach(f => f());
    };
  }, []);

  const handleVolumeChange = async (newVol: number) => {
    setVolume(newVol);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("media_set_volume", { level: newVol });
    } catch (e) {}
  };

  const handleAction = async (action: string, arg?: number) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke(action, arg !== undefined ? { position: arg } : undefined);
    } catch(e) {
      console.error("Action failed", action, e);
    }
  };

  const x = params.x ?? 50;
  const y = params.y ?? 80;
  const scale = params.scale ?? 1.0;
  const opacity = params.opacity ?? 0.9;
  const theme = params.theme || "glass";
  const shape = params.shape || "standard";
  const customColor = params.color && params.color !== "auto" ? params.color : undefined;

  // Don't render if no media title is playing and it's overlay (we don't want empty widgets on desktop)
  if (isOverlay && !media.title && !media.artist) return null;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) scale(${scale})`,
    opacity,
    zIndex: 50,
    userSelect: "none",
    pointerEvents: "auto", // Allow interaction in overlay mode
    display: "flex",
    alignItems: "center",
    gap: shape === "compact" ? "8px" : "16px",
    padding: shape === "compact" ? "8px 16px" : "16px",
    borderRadius: shape === "compact" ? "30px" : "16px",
    transition: "all 0.3s ease",
  };

  const themeStyles: Record<string, React.CSSProperties> = {
    glass: {
      background: "rgba(20, 20, 20, 0.4)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      color: "#fff"
    },
    "apple-music": {
      background: "rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(40px) saturate(150%)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
      color: "#fff",
      borderRadius: shape === "compact" ? "30px" : "24px",
    },
    "spotify-dark": {
      background: "#121212",
      border: "none",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      color: "#b3b3b3",
    },
    "winamp-retro": {
      background: "#1f1f1f",
      border: "2px solid #5a5a5a",
      borderTopColor: "#b2b2b2",
      borderLeftColor: "#b2b2b2",
      boxShadow: "2px 2px 5px rgba(0,0,0,0.5)",
      color: "#00ff00",
      fontFamily: "'Courier New', monospace"
    }
  };

  const currentTheme = themeStyles[theme] || themeStyles.glass;
  const accentColor = customColor || (theme === "winamp-retro" ? "#00ff00" : (theme === "spotify-dark" ? "#1ed760" : currentTheme.color));

  const renderThumbnail = () => {
    if (shape === "compact") return null;
    
    if (shape === "vinyl") {
      return (
        <div style={{ position: "relative", width: "80px", height: "80px", borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", animation: media.is_playing ? "spin 4s linear infinite" : "none" }}>
          <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
          <div style={{ position: "absolute", inset: "4px", borderRadius: "50%", border: "1px solid #333" }} />
          <div style={{ position: "absolute", inset: "12px", borderRadius: "50%", border: "1px solid #222" }} />
          {media.thumbnail_base64 ? (
            <img src={media.thumbnail_base64} alt="album" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", pointerEvents: "none" }} />
          ) : (
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>🎵</div>
          )}
          <div style={{ position: "absolute", width: "8px", height: "8px", background: "#000", borderRadius: "50%" }} />
        </div>
      );
    }

    // Standard
    if (media.thumbnail_base64) {
      return <img src={media.thumbnail_base64} alt="album" style={{ width: "80px", height: "80px", borderRadius: "8px", objectFit: "cover", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", pointerEvents: "none" }} />;
    }
    return <div style={{ width: "80px", height: "80px", borderRadius: "8px", background: "rgba(128,128,128,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>🎵</div>;
  };

  return (
    <div 
      id={layerId ? `widget-${layerId}` : undefined}
      className="interactive-widget"
      style={{ ...baseStyle, ...currentTheme }} 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).tagName === "BUTTON" || (e.target as HTMLElement).getAttribute("data-seek")) {
          e.stopPropagation();
        }
      }}
    >
      {renderThumbnail()}
      
      <div style={{ display: "flex", flexDirection: shape === "compact" ? "row" : "column", alignItems: shape === "compact" ? "center" : "flex-start", minWidth: shape === "compact" ? "auto" : "200px" }}>
        
        {/* Text Info */}
        <div style={{ display: "flex", flexDirection: "column", marginRight: shape === "compact" ? "16px" : "0" }}>
          <div style={{ fontWeight: 600, fontSize: shape === "compact" ? "14px" : "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
            {media.title || "No track playing"}
          </div>
          {shape !== "compact" && (
            <div style={{ fontWeight: 400, fontSize: "14px", opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
              {media.artist || "..."}
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: shape === "compact" ? "0" : "12px", pointerEvents: "auto" }}>
          <button onClick={() => handleAction("media_prev")} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", opacity: 0.8, fontSize: "18px", padding: "4px" }}>⏮</button>
          <button onClick={() => handleAction("media_play_pause")} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: "24px", padding: "4px", minWidth: "30px" }}>
            {media.is_playing ? "⏸" : "▶"}
          </button>
          <button onClick={() => handleAction("media_next")} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", opacity: 0.8, fontSize: "18px", padding: "4px" }}>⏭</button>
          
          {/* Seekbar */}
          {shape !== "compact" && (
            <div 
              data-seek="true"
              style={{ flex: 1, minWidth: "80px", height: "16px", display: "flex", alignItems: "center", marginLeft: "8px", cursor: "pointer", position: "relative" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (timeline.end_time > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  handleAction("media_seek", pct * timeline.end_time);
                }
              }}
            >
              <div style={{ width: "100%", height: "4px", background: "rgba(128,128,128,0.3)", borderRadius: "2px", position: "relative", pointerEvents: "none" }}>
                <div style={{ 
                  position: "absolute", left: 0, top: 0, bottom: 0, 
                  background: accentColor, borderRadius: "2px",
                  width: `${timeline.end_time > 0 ? (timeline.position / timeline.end_time) * 100 : 0}%`,
                  transition: "width 0.5s linear"
                }} />
              </div>
            </div>
          )}

          {/* Volume Control */}
          <div 
            style={{ position: "relative", display: "flex", alignItems: "center", cursor: "pointer" }}
            onMouseEnter={() => setIsVolumeHovered(true)}
            onMouseLeave={() => setIsVolumeHovered(false)}
          >
            <span style={{ fontSize: "16px", opacity: 0.8, padding: "4px" }}>
              {volume > 0.5 ? "🔊" : volume > 0 ? "🔉" : "🔇"}
            </span>
            {isVolumeHovered && (
              <div style={{
                position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                background: theme === "apple-music" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)",
                padding: "12px 8px", borderRadius: "12px",
                display: "flex", flexDirection: "column", alignItems: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
              }}>
                <input 
                  type="range" min="0" max="1" step="0.01" 
                  value={volume}
                  onPointerDown={e => e.stopPropagation()}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  style={{
                    writingMode: "vertical-lr", direction: "rtl",
                    appearance: "slider-vertical" as any, width: "8px", height: "80px",
                    accentColor: accentColor as string
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// App Launcher Widget
// ─────────────────────────────────────────────────────────────
function AppLauncherWidget({ params, layerId, isOverlay }: { params: any; layerId?: string; isOverlay?: boolean }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const apps = params.apps || [];
  if (apps.length === 0 && isOverlay) return null; // Don't render empty launcher on desktop

  const x = params.x ?? 50;
  const y = params.y ?? 90;
  const scale = params.scale ?? 1.0;
  const layout = params.layout || "dock";

  const handleLaunch = async (path: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("launch_external_app", { path });
    } catch(e) {
      console.error("Failed to launch app", e);
    }
  };

  const theme = params.theme || "glass";

  const isDock = layout === "dock";

  let themeStyles: React.CSSProperties = {
    background: "rgba(20, 20, 20, 0.4)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    color: "#fff"
  };

  let iconThemeStyles: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.05)",
  };

  if (theme === "frutiger-aero") {
    themeStyles = {
      background: "linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(200, 220, 255, 0.2) 50%, rgba(150, 180, 255, 0.4) 100%)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255, 255, 255, 0.6)",
      borderTop: "2px solid rgba(255, 255, 255, 0.9)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 2px 10px rgba(255,255,255,0.5)",
      color: "#000"
    };
    iconThemeStyles = {
      background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(220,230,255,0.6) 100%)",
      border: "1px solid rgba(255,255,255,0.9)",
      boxShadow: "0 4px 10px rgba(0,0,0,0.1), inset 0 -4px 10px rgba(0,0,0,0.1)",
    };
  } else if (theme === "neumorphism") {
    themeStyles = {
      background: "#e0e5ec",
      border: "none",
      boxShadow: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
      color: "#4d4d4d"
    };
    iconThemeStyles = {
      background: "#e0e5ec",
      border: "none",
      boxShadow: "5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255, 0.5)",
    };
  } else if (theme === "flat") {
    themeStyles = {
      background: "#222",
      border: "none",
      boxShadow: "none",
      color: "#fff"
    };
    iconThemeStyles = {
      background: "#333",
      border: "none",
      boxShadow: "none",
    };
  }

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) scale(${scale})`,
    zIndex: 50,
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "row",
    flexWrap: isDock ? "nowrap" : "wrap",
    gap: "12px",
    padding: "12px",
    borderRadius: isDock ? "24px" : "16px",
    justifyContent: "center",
    maxWidth: isDock ? "none" : "300px",
    cursor: "grab", // Indicate draggability
    ...themeStyles
  };

  if (apps.length === 0) {
    return (
      <div id={layerId ? `widget-${layerId}` : undefined} className="interactive-widget" style={containerStyle}>
        <div style={{ opacity: 0.6, fontSize: "14px", padding: "0 10px" }}>Add apps in properties panel</div>
      </div>
    );
  }

  return (
    <div id={layerId ? `widget-${layerId}` : undefined} className="interactive-widget" style={containerStyle}>
      {apps.map((app: any, idx: number) => {
        const isHovered = hoverIndex === idx;
        const scaleHover = isDock && isHovered ? 1.2 : 1.0;
        
        return (
          <div 
            key={idx}
            onMouseEnter={() => setHoverIndex(idx)}
            onMouseLeave={() => setHoverIndex(null)}
            onPointerDown={(e) => {
              e.stopPropagation();
              handleLaunch(app.path);
            }}
            style={{
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "12px",
              fontSize: "28px",
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)",
              transform: `scale(${scaleHover}) translateY(${isHovered && isDock ? "-8px" : "0"})`,
              ...iconThemeStyles,
              boxShadow: isHovered ? (theme === "neumorphism" ? "inset 5px 5px 10px rgb(163,177,198,0.6), inset -5px -5px 10px rgba(255,255,255, 0.5)" : "0 10px 20px rgba(0,0,0,0.3)") : iconThemeStyles.boxShadow,
              position: "relative"
            }}
            title={app.name}
          >
            {app.iconBase64 ? (
               <img src={`data:image/png;base64,${app.iconBase64}`} alt="icon" style={{ width: "32px", height: "32px", objectFit: "contain", pointerEvents: "none" }} />
            ) : (
               app.icon || "🚀"
            )}
            {isHovered && isDock && (
              <div style={{
                position: "absolute",
                top: "-30px",
                background: theme === "neumorphism" || theme === "frutiger-aero" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                color: theme === "neumorphism" || theme === "frutiger-aero" ? "#000" : "#fff",
                fontSize: "12px",
                padding: "4px 8px",
                borderRadius: "6px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                zIndex: 100,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
              }}>
                {app.name}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
