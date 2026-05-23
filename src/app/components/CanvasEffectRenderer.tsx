"use client";

import { useEffect, useRef, useState } from "react";

export interface EffectLayer {
  id: string;
  type: "snow" | "rain" | "vignette" | "light-leak" | "cursor-trail" | "ribbon-trail" | "click-ripple" | "blur-region" | "bloom" | "glitch" | "audio-visualizer" | "parallax" | "color-grade" | "fireflies" | "stars" | "fog" | "clock" | "music-player" | "water-caustics" | "blowing-leaves" | "app-launcher" | "sprite" | "particle-emitter" | "god-rays" | "vhs" | "liquid-ripple" | "rain-on-glass" | "desktop-pet";
  name: string;
  enabled: boolean;
  params: Record<string, any>;
}

interface CanvasEffectRendererProps {
  videoSrc: string;
  effects: EffectLayer[];
  isOverlay?: boolean;
}

export function CanvasEffectRenderer({ videoSrc, effects, isOverlay = false }: CanvasEffectRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLImageElement>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Particle Arrays
  const snowParticlesRef = useRef<any[]>([]);
  const rainParticlesRef = useRef<any[]>([]);
  const MouseTrailRef = useRef<any[]>([]);
  
  const [src, setSrc] = useState(videoSrc);

  // [IPC FIX]: We need a live state that can be updated either by props (in the UI) 
  // OR by Tauri IPC events (in the detached overlay window).
  const [liveEffects, setLiveEffects] = useState<EffectLayer[]>(effects);

  useEffect(() => {
    setLiveEffects(effects);
  }, [effects]);

  // Mirror live state to a Ref to bypass React's stale closures in the 60fps loop.
  const effectsRef = useRef<EffectLayer[]>(liveEffects);
  effectsRef.current = liveEffects;

  useEffect(() => {
    if (videoSrc) {
      const isLocal = videoSrc.startsWith("C:") || 
                      videoSrc.startsWith("/Users/") || 
                      videoSrc.startsWith("file:///") || 
                      videoSrc.includes(":\\");
                      
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
    }
  }, [videoSrc]);

  const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(videoSrc);

  // Particle Init Helpers
  const generateSnow = (count: number, width: number, height: number) => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 3 + 1,
      d: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
    }));
  };

  const generateRain = (count: number, width: number, height: number) => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      l: Math.random() * 15 + 5,
      s: Math.random() * 4 + 4,
    }));
  };

  // Pre-calculated effect cache for render loop performance
  const cachedEffectsRef = useRef<any>({});
  
  useEffect(() => {
    const rawEffects: any = liveEffects || [];
    const currentEffects: EffectLayer[] = Array.isArray(rawEffects) ? rawEffects : (rawEffects.layers || []);
    
    cachedEffectsRef.current = {
      vignette: currentEffects.find(e => e.type === "vignette" && e.enabled),
      snowEffect: currentEffects.find(e => e.type === "snow" && e.enabled),
      rainEffect: currentEffects.find(e => e.type === "rain" && e.enabled),
      trailEffect: currentEffects.find(e => e.type === "cursor-trail" && e.enabled),
      rippleEffect: currentEffects.find(e => e.type === "click-ripple" && e.enabled),
      blurRegions: currentEffects.filter(e => e.type === "blur-region" && e.enabled),
    };
  }, [liveEffects]);

  // Main Canvas Setup & Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;

    const updateSize = () => {
      if (isOverlay) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } else if (mediaRef.current) {
        canvas.width = mediaRef.current.clientWidth;
        canvas.height = mediaRef.current.clientHeight;
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    
    const t1 = setTimeout(updateSize, 100);
    const t2 = setTimeout(updateSize, 500);
    const t3 = setTimeout(updateSize, 2000);

    let active = true;

    const render = () => {
      if (!active) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { vignette, snowEffect, rainEffect, trailEffect, rippleEffect, blurRegions } = cachedEffectsRef.current;

      // 1. Vignette
      if (vignette) {
        const intensity = vignette.params?.intensity || 0.5;
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, canvas.width / 1.5
        );
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 1.5. Blur Regions
      const media = mediaRef.current;
      if (blurRegions.length > 0 && media) {
          (blurRegions as EffectLayer[]).forEach((region: EffectLayer) => {
              const { x = 10, y = 10, w = 200, h = 100, blur = 10 } = region.params;
              ctx.save();
              ctx.filter = `blur(${blur}px)`;
              // Draw the media (video/image) onto itself but filtered, limited to the region
              ctx.drawImage(
                  media, 
                  (x / 100) * media.clientWidth, (y / 100) * media.clientHeight, 
                  (w / 100) * media.clientWidth, (h / 100) * media.clientHeight,
                  (x / 100) * canvas.width, (y / 100) * canvas.height, 
                  (w / 100) * canvas.width, (h / 100) * canvas.height
              );
              ctx.restore();
          });
      }

      // 2. Snow
      if (snowEffect) {
          const count = snowEffect.params?.count || 100;
          if (snowParticlesRef.current.length !== count) {
              snowParticlesRef.current = generateSnow(count, canvas.width, canvas.height);
          }

          ctx.shadowColor = "rgba(255,255,255,0.4)";
          ctx.shadowBlur = 4;
          const speed = snowEffect.params?.speed || 1;
          
          snowParticlesRef.current.forEach((p) => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2, true);
              ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
              ctx.fill();

              p.y += (p.d + speed) * 0.5;
              p.x += Math.sin(p.y * 0.01) * 0.3;

              if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
          });
          ctx.shadowBlur = 0;
      } else {
          if (snowParticlesRef.current.length > 0) snowParticlesRef.current = [];
      }

      // 3. Rain
      if (rainEffect) {
          const count = rainEffect.params?.count || 200;
          if (rainParticlesRef.current.length !== count) {
              rainParticlesRef.current = generateRain(count, canvas.width, canvas.height);
          }

          ctx.strokeStyle = "rgba(174, 194, 224, 0.5)";
          ctx.lineWidth = 1;
          const speed = rainEffect.params?.speed || 1;

          rainParticlesRef.current.forEach((p) => {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x, p.y + p.l);
              ctx.stroke();

              p.y += p.s * speed;
              if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
          });
      } else {
          if (rainParticlesRef.current.length > 0) rainParticlesRef.current = [];
      }

      // 4. Cursor Trail & Ripples
      if (trailEffect) {
          if (Math.random() < 0.15) {
              MouseTrailRef.current.push({
                  x: Math.random() * canvas.width,
                  y: Math.random() * canvas.height,
                  vx: (Math.random() - 0.5),
                  vy: (Math.random() - 0.5),
                  life: 60,
                  size: Math.random() * 5 + 1.5,
                  color: `rgba(154, 230, 0, 0.7)`
              });
          }
      }

      if (trailEffect || rippleEffect) {
          MouseTrailRef.current = MouseTrailRef.current.filter(p => p.life > 0);
          MouseTrailRef.current.forEach((p) => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = p.color || `rgba(154, 230, 0, ${p.life / 50})`;
              ctx.fill();

              p.x += p.vx;
              p.y += p.vy;
              p.life -= 1;
              p.size *= 0.95;
          });
          
          // 4.5 Particle Cap
          if (MouseTrailRef.current.length > 1500) {
            MouseTrailRef.current = MouseTrailRef.current.slice(-1000);
          }
      } else {
         if (MouseTrailRef.current.length > 0) MouseTrailRef.current = [];
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      active = false;
      window.removeEventListener("resize", updateSize);
      cancelAnimationFrame(animationFrameRef.current);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOverlay]); 

  // Overlay IPC listeners
  useEffect(() => {
    if (!isOverlay) return;
    let isMounted = true;
    let unlistenFunctions: Array<() => void> = [];

    // FAKE CURSOR SIMULATOR FOR TESTING
    const testInterval = setInterval(() => {
      const trailEffect = cachedEffectsRef.current?.trailEffect;
      if (trailEffect && canvasRef.current) {
        const x = Math.random() * canvasRef.current.width;
        const y = Math.random() * canvasRef.current.height;
        for (let i = 0; i < 2; i++) {
          MouseTrailRef.current.push({
            x, y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2 - 0.5,
            life: 30,
            size: Math.random() * 4 + 2,
            color: `rgba(255, 0, 0, 0.8)` // Red for debug
          });
        }
      }
    }, 100);

    const setupListeners = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        // 1. Listen for cursor movements
        const uCursor = await listen<{x: number, y: number}>("cursor-moved", (e) => {
          const rawEffects: any = effectsRef.current || [];
          const currentEffects: EffectLayer[] = Array.isArray(rawEffects) ? rawEffects : (rawEffects?.layers || []);

          const trailEffect = currentEffects.find(ef => ef.type === "cursor-trail" && ef.enabled);
          const rippleEffect = currentEffects.find(ef => ef.type === "click-ripple" && ef.enabled);
          if (!trailEffect && !rippleEffect) return;

          let payload = e.payload as any;
          if (typeof payload === "string") {
            try { payload = JSON.parse(payload); } catch (e) {}
          }
          if (!payload || typeof payload.x !== "number") return;

          const { x: x_raw, y: y_raw } = payload;
          const x = x_raw / (window.devicePixelRatio || 1);
          const y = y_raw / (window.devicePixelRatio || 1);

          if (trailEffect) {
            for (let i = 0; i < 2; i++) {
              MouseTrailRef.current.push({
                x, y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2 - 0.5,
                life: 30,
                size: Math.random() * 4 + 2,
                color: `rgba(154, 230, 0, 0.8)`
              });
            }
          }
        });
        unlistenFunctions.push(uCursor);

        // 1.5 Listen for global clicks
        const uClick = await listen<{x: number, y: number}>("cursor-click", (e) => {
          const rawEffects: any = effectsRef.current || [];
          const currentEffects: EffectLayer[] = Array.isArray(rawEffects) ? rawEffects : (rawEffects?.layers || []);

          const rippleEffect = currentEffects.find(ef => ef.type === "click-ripple" && ef.enabled);
          if (!rippleEffect) return;

          let payload = e.payload as any;
          if (typeof payload === "string") {
            try { payload = JSON.parse(payload); } catch (e) {}
          }
          if (!payload || typeof payload.x !== "number") return;

          const { x: x_raw, y: y_raw } = payload;
          const x = x_raw / (window.devicePixelRatio || 1);
          const y = y_raw / (window.devicePixelRatio || 1);

          for (let i = 0; i < 20; i++) {
              const angle = (Math.PI * 2 / 20) * i;
              MouseTrailRef.current.push({
                  x, y,
                  vx: Math.cos(angle) * 3,
                  vy: Math.sin(angle) * 3,
                  life: 60,
                  size: 6,
                  color: `rgba(255, 255, 255, 0.9)`
              });
          }
        });
        unlistenFunctions.push(uClick);

        // 2. Effects config sync
        const uUpdate = await listen("effects-updated", (e: any) => {
          try {
            const payload = typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload;
            const freshEffects = Array.isArray(payload) ? payload : (payload?.layers || []);
            setLiveEffects(freshEffects);
          } catch (err: any) {
            console.error("[Overlay] Failed to parse updated effects payload:", err);
          }
        });
        unlistenFunctions.push(uUpdate);
      } catch (err) {
        console.error("Failed to setup IPC listeners", err);
      }
    };

    setupListeners();

    return () => {
      clearInterval(testInterval);
      isMounted = false;
      unlistenFunctions.forEach(fn => fn());
    };
  }, [isOverlay]);

  const handlePointerMove = (e: React.PointerEvent) => {
    const rawEffects: any = effectsRef.current || [];
    const currentEffects: EffectLayer[] = Array.isArray(rawEffects) ? rawEffects : (rawEffects?.layers || []);
    const trailEffect = currentEffects.find(eff => eff.type === "cursor-trail" && eff.enabled);
    
    if (!trailEffect || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = 0; i < 2; i++) {
        MouseTrailRef.current.push({
            x, y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2 - 0.5,
            life: 40,
            size: Math.random() * 4 + 2,
            color: `rgba(154, 230, 0, 0.8)`
        });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const rawEffects: any = effectsRef.current || [];
    const currentEffects: EffectLayer[] = Array.isArray(rawEffects) ? rawEffects : (rawEffects?.layers || []);
    const rippleEffect = currentEffects.find(eff => eff.type === "click-ripple" && eff.enabled);
    
    if (!rippleEffect || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 / 20) * i;
        MouseTrailRef.current.push({
            x, y,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            life: 60,
            size: 6,
            color: `rgba(255, 255, 255, 0.9)`
        });
    }
  };

  return (
    <div 
      className="editor-preview-container" 
      style={{ 
        position: "relative", 
        width: "100%", 
        height: "100%", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        background: "transparent"
      }}
    >
      {!isOverlay && (
        isImage ? (
          <img
            ref={mediaRef as any}
            src={src}
            className="editor-bg-video"
            style={{ objectFit: "cover" }}
            alt="Wallpaper"
          />
        ) : (
          <video
            ref={mediaRef as any}
            src={src}
            className="editor-bg-video"
            autoPlay
            loop
            muted
            playsInline
            crossOrigin="anonymous"
          />
        )
      )}

      <canvas 
        ref={canvasRef} 
        className="effects-canvas" 
        style={{ 
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: isOverlay ? "none" : "auto", 
          cursor: "crosshair" 
        }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
}