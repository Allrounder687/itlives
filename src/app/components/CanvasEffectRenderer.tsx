"use client";

import { useEffect, useRef, useState } from "react";


export interface EffectLayer {
  id: string;
  type: "snow" | "rain" | "vignette" | "light-leak" | "cursor-trail" | "click-ripple";
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
  const particlesRef = useRef<any[]>([]);
  const MouseTrailRef = useRef<any[]>([]);
  
  const [src, setSrc] = useState(videoSrc);

  useEffect(() => {
    if (videoSrc) {
      const isLocal = videoSrc.startsWith("C:") || 
                      videoSrc.startsWith("/Users/") || 
                      videoSrc.startsWith("file:///") || 
                      videoSrc.includes(":\\");
                      
      if (isLocal) {
        let cleanPath = videoSrc;
        if (cleanPath.startsWith("file:///")) {
          cleanPath = cleanPath.slice(8); // On Windows: removes file:///
        } else if (cleanPath.startsWith("file://")) {
          cleanPath = cleanPath.slice(7);
        }

        import("@tauri-apps/api/core").then(({ convertFileSrc }) => {
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

  // Setup loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
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
    const t3 = setTimeout(updateSize, 2000); // Overlay re-parents, triggers resize delay


    const snowEffect = effects.find(e => e.type === "snow" && e.enabled);
    const rainEffect = effects.find(e => e.type === "rain" && e.enabled);

    if (snowEffect) {
        const count = snowEffect.params.count || 100;
        particlesRef.current = generateSnow(count, canvas.width, canvas.height);
    } else if (rainEffect) {
        const count = rainEffect.params.count || 200;
        particlesRef.current = generateRain(count, canvas.width, canvas.height);
    } else {
        particlesRef.current = [];
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Vignette
      const vignette = effects.find(e => e.type === "vignette" && e.enabled);
      if (vignette) {
        const intensity = vignette.params.intensity || 0.5;
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, canvas.width / 1.5
        );
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Snow / Rain
      if (snowEffect) {
          ctx.shadowColor = "rgba(255,255,255,0.4)";
          ctx.shadowBlur = 4;
          const speed = snowEffect.params.speed || 1;

          particlesRef.current.forEach((p) => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2, true);
              ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
              ctx.fill();

              p.y += (p.d + speed) * 0.5;
              p.x += Math.sin(p.y * 0.01) * 0.3;

              if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
          });
          ctx.shadowBlur = 0;
      }

      if (rainEffect) {
          ctx.strokeStyle = "rgba(174, 194, 224, 0.5)";
          ctx.lineWidth = 1;
          const speed = rainEffect.params.speed || 1;

          particlesRef.current.forEach((p) => {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p.x, p.y + p.l);
              ctx.stroke();

              p.y += p.s * speed;
              if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
          });
      }

      // 3. Cursor Trail & Ripples
      const trailEffect = effects.find(e => e.type === "cursor-trail" && e.enabled);
      const rippleEffect = effects.find(e => e.type === "click-ripple" && e.enabled);

      if (trailEffect || rippleEffect) {
          // Update and draw trail particles
          MouseTrailRef.current = MouseTrailRef.current.filter(p => p.life > 0);
          MouseTrailRef.current.forEach((p) => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fillStyle = p.color || `rgba(154, 230, 0, ${p.life / 50})`;
              ctx.fill();

              p.x += p.vx;
              p.y += p.vy;
              p.life -= 1;
              p.size *= 0.95; // Shrink
          });
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", updateSize);
      cancelAnimationFrame(animationFrameRef.current);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };

  }, [effects]);

  const handlePointerMove = (e: React.PointerEvent) => {
    const trailEffect = effects.find(e => e.type === "cursor-trail" && e.enabled);
    if (!trailEffect || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Spawn 2 particles per move
    for (let i = 0; i < 2; i++) {
        MouseTrailRef.current.push({
            x, y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2 - 0.5, // Float up slightly
            life: 40,
            size: Math.random() * 4 + 2,
            color: `rgba(154, 230, 0, 0.8)` // OpenClaw Green accent
        });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const rippleEffect = effects.find(e => e.type === "click-ripple" && e.enabled);
    if (!rippleEffect || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Pulse Burst
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
        className="editor-canvas-overlay" 
        style={{ 
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none", 
          cursor: "crosshair" 
        }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
      />
    </div>
  );
}
