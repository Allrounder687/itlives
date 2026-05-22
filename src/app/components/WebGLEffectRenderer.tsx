"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom, Vignette, Glitch } from "@react-three/postprocessing";
import { GlitchMode } from "postprocessing";
import { EffectLayer } from "./CanvasEffectRenderer";

// 1. Particle Systems
function FallingParticles({ type, params }: { type: "snow" | "rain", params: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = params.count || (type === "rain" ? 150 : 120);
  const speed = params.speed || 1.0;
  
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Orthographic camera coordinates (-window.innerWidth/2 to +window.innerWidth/2)
      pos[i * 3] = (Math.random() - 0.5) * 2000; // x spread
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1500; // y spread
      pos[i * 3 + 2] = 0; // z
      vel[i] = (Math.random() * 0.5 + 0.5) * speed * (type === "rain" ? 800 : 200);
    }
    return [pos, vel];
  }, [count, speed, type]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const posAttribute = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = posAttribute.getY(i);
      y -= velocities[i] * delta;
      if (y < -1000) y = 1000;
      posAttribute.setY(i, y);
    }
    posAttribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={type === "rain" ? 4.0 : 6.0} 
        color={type === "rain" ? "#aaaaff" : "#ffffff"} 
        transparent 
        opacity={0.8} 
        sizeAttenuation={false}
      />
    </points>
  );
}

// 2. Mouse Trail System
type ParticleState = { x: number, y: number, vx: number, vy: number, life: number, maxLife: number, color: THREE.Color };
function InteractiveParticles({ trailEnabled, rippleEnabled, isOverlay }: { trailEnabled: boolean, rippleEnabled: boolean, isOverlay: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const particles = useRef<ParticleState[]>([]);
  const maxParticles = 2000;
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  const colors = useMemo(() => new Float32Array(maxParticles * 3), []);
  const sizes = useMemo(() => new Float32Array(maxParticles), []);

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
          const x = (payload.x / (window.devicePixelRatio || 1)) - w/2;
          const y = -(payload.y / (window.devicePixelRatio || 1)) + h/2;

          for (let i = 0; i < 2; i++) {
            particles.current.push({
              x, y,
              vx: (Math.random() - 0.5) * 100,
              vy: (Math.random() - 0.5) * 100,
              life: 40, maxLife: 40,
              color: new THREE.Color(0.6, 0.9, 0.0)
            });
          }
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
              color: new THREE.Color(1, 1, 1)
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
  }, [isOverlay, trailEnabled, rippleEnabled]);

  useFrame((state, delta) => {
    if (!geometryRef.current) return;
    
    // Process physics
    const active = particles.current.filter(p => p.life > 0);
    particles.current = active;

    const pos = new Float32Array(maxParticles * 3);
    
    for (let i = 0; i < active.length && i < maxParticles; i++) {
      const p = active[i];
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= 60 * delta; // roughly 1 life per frame at 60fps

      pos[i*3] = p.x;
      pos[i*3+1] = p.y;
      pos[i*3+2] = 0;

      const progress = p.life / p.maxLife;
      colors[i*3] = p.color.r;
      colors[i*3+1] = p.color.g;
      colors[i*3+2] = p.color.b;
      sizes[i] = progress * 8.0; 
    }

    geometryRef.current.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometryRef.current.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometryRef.current.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
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

// 3. Audio Visualizer System
function AudioVisualizer() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const fftData = useRef<number[]>(new Array(64).fill(0));
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

    for (let i = 0; i < 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const radius = 250;
      // Smooth interpolation would be nice, but raw updates work for V1
      const mag = data[i] || 0;
      const h = Math.max(4, mag * 8000.0); // Magnitudes from rustfft can be small without windowing/normalization

      dummy.position.set(Math.cos(angle) * (radius + h/2), Math.sin(angle) * (radius + h/2), 0);
      dummy.rotation.z = angle;
      dummy.scale.set(12, h, 12);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Dynamic colors based on frequency and height
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

// 4. Main Renderer
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

      {/* CSS-based post processing fallbacks */}
      {blurRegions.map(b => (
        <div key={b.id} style={{
          position: "absolute", left: `${b.params.x}%`, top: `${b.params.y}%`, width: `${b.params.w}%`, height: `${b.params.h}%`,
          backdropFilter: `blur(${b.params.blur || 15}px)`, pointerEvents: "none", zIndex: 5
        }} />
      ))}

      {/* WebGL Canvas */}
      <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: isOverlay ? "none" : "auto" }}>
        <Canvas 
          orthographic 
          camera={{ position: [0, 0, 100], zoom: 1 }}
          gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        >
          {snow && <FallingParticles type="snow" params={snow.params} />}
          {rain && <FallingParticles type="rain" params={rain.params} />}
          {audioVis && <AudioVisualizer />}
          <InteractiveParticles trailEnabled={!!trail} rippleEnabled={!!ripple} isOverlay={isOverlay} />
          
          {/* Post Processing Shaders */}
          {(vignette || currentEffects.find(e => e.type === "bloom" && e.enabled) || currentEffects.find(e => e.type === "glitch" && e.enabled)) && (
            <EffectComposer>
              {vignette ? <Vignette eskil={false} offset={0.1} darkness={vignette.params.intensity || 0.6} /> : null as any}
              {currentEffects.find(e => e.type === "bloom" && e.enabled) ? <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} /> : null as any}
              {currentEffects.find(e => e.type === "glitch" && e.enabled) ? <Glitch delay={new THREE.Vector2(1.5, 3.5)} duration={new THREE.Vector2(0.1, 0.3)} strength={new THREE.Vector2(0.1, 0.2)} mode={GlitchMode.SPORADIC} active /> : null as any}
            </EffectComposer>
          )}
        </Canvas>
      </div>
    </div>
  );
}
