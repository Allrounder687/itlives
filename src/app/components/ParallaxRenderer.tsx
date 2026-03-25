"use client";

import { useEffect, useRef, useState } from "react";

export interface ParallaxLayerConfig {
  src: string;
  sensitivityX: number;
  sensitivityY: number;
  repeatX: number; // e.g., 0 means draw once, 1 means draw -1, 0, 1
  repeatY: number;
}

export interface ParallaxRendererProps {
  layers: ParallaxLayerConfig[];
  isOverlay?: boolean;
}

/**
 * ParallaxRenderer Engine
 * 
 * Adapted directly from original source concept: jszczerbinsky/lwp
 * 
 * Original C target loop logic:
 * static void lerpTargetPoint(Point* p, Point* target, float dT) {
 *   p->x = lerp(p->x, target->x, dT * 4);
 *   p->y = lerp(p->y, target->y, dT * 4);
 * }
 * 
 * Original C render loop logic:
 * int x = -((monitor->currentPoint.x - monitor->info.clientBounds.w / 2) * layerConfigs[i].sensitivityX);
 * int y = -((monitor->currentPoint.y - monitor->info.clientBounds.h / 2) * layerConfigs[i].sensitivityY);
 */
export function ParallaxRenderer({ layers, isOverlay = false }: ParallaxRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const [loadedImages, setLoadedImages] = useState<(HTMLImageElement | null)[]>([]);

  // Mouse Tracking State
  const targetPoint = useRef({ x: 0, y: 0 });
  const currentPoint = useRef({ x: 0, y: 0 });

  // Initialize images
  useEffect(() => {
    let active = true;
    const loadImages = async () => {
      const promises = layers.map((layer) => {
        return new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          // img.crossOrigin = "anonymous"; // Removed because it triggers CORS block on some CDNs (like Alphacoders) that don't support it, and we only draw to canvas, no readback.
          img.onload = () => resolve(img);
          img.onerror = () => {
            console.warn(`[ParallaxRenderer] Failed to load layer: ${layer.src}`);
            resolve(null); // Resolve with null so other layers can still load and render
          };
          
          // Use Tauri schema if local
          if (layer.src.startsWith("C:") || layer.src.startsWith("/") || layer.src.startsWith("file://")) {
            let cleanPath = layer.src;
            if (cleanPath.startsWith("file:///")) cleanPath = cleanPath.substring(8);
            else if (cleanPath.startsWith("file://")) cleanPath = cleanPath.substring(7);

            const tauriCore = "@tauri-apps/api/core";
            import(tauriCore).then(({ convertFileSrc }) => {
              img.src = convertFileSrc(cleanPath);
            }).catch(() => { img.src = layer.src; });
          } else {
            img.src = layer.src;
          }
        });
      });

      try {
        const imgs = await Promise.all(promises);
        if (active) setLoadedImages(imgs);
      } catch (err) {
        console.error("[ParallaxRenderer] Failed to load layers", err);
      }
    };
    
    if (layers.length > 0) {
      loadImages();
    } else {
      setLoadedImages([]);
    }

    return () => { active = false; };
  }, [layers]);

  // Main Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let active = true;
    let lastTicks = performance.now();

    const updateSize = () => {
      if (isOverlay) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // set default target exactly to center
        targetPoint.current = { x: canvas.width / 2, y: canvas.height / 2 };
        if (currentPoint.current.x === 0 && currentPoint.current.y === 0) {
          currentPoint.current = { x: canvas.width / 2, y: canvas.height / 2 };
        }
      } else {
        const parent = canvas.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
          targetPoint.current = { x: canvas.width / 2, y: canvas.height / 2 };
          if (currentPoint.current.x === 0 && currentPoint.current.y === 0) {
            currentPoint.current = { x: canvas.width / 2, y: canvas.height / 2 };
          }
        }
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    // Math tools from original lwp
    const lerp = (a: number, b: number, t: number) => {
      let ft = t > 1 ? 1 : t;
      return a + ft * (b - a);
    };

    const render = (time: number) => {
      if (!active) return;
      
      const dT = (time - lastTicks) / 1000.0;
      lastTicks = time;

      // 1. lerp Target Point (matching lwp logic: dT * 4)
      currentPoint.current.x = lerp(currentPoint.current.x, targetPoint.current.x, dT * 4);
      currentPoint.current.y = lerp(currentPoint.current.y, targetPoint.current.y, dT * 4);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (loadedImages.length === layers.length) {
        for (let i = 0; i < layers.length; i++) {
          const config = layers[i];
          const img = loadedImages[i];
          if (!img) continue; // Skip drawing this layer if it failed to load
          
          // Original LWP equation
          const offsetX = -((currentPoint.current.x - canvas.width / 2) * config.sensitivityX);
          const offsetY = -((currentPoint.current.y - canvas.height / 2) * config.sensitivityY);

          // We map config.repeatX & Y bounds
          for (let k = -config.repeatY; k <= config.repeatY; k++) {
            for (let j = -config.repeatX; j <= config.repeatX; j++) {
              // Assume layer sizes match canvas for bounded ratio, 
              // or match original image width/height if we want tiling.
              // Here we scale image dynamically to cover canvas if it's acting as a "bounds"
              
              // By default LWP scales layer to fit wlpBounds (which is the screen size).
              // Let's implement full-screen stretch scaling as base bounds:
              const destX = offsetX + j * canvas.width;
              const destY = offsetY + k * canvas.height;
              const destW = canvas.width;
              const destH = canvas.height;

              ctx.drawImage(img, 0, 0, img.width, img.height, destX, destY, destW, destH);
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      active = false;
      window.removeEventListener("resize", updateSize);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [layers, loadedImages, isOverlay]);

  // IPC overlay cursor sync
  useEffect(() => {
    if (!isOverlay) return;
    let unlistenCursor = () => {};

    const tauriEvent = "@tauri-apps/api/event";
    import(tauriEvent).then(({ listen }) => {
      listen("cursor-moved", (e: any) => {
        const [x_raw, y_raw] = e.payload;
        targetPoint.current.x = x_raw / (window.devicePixelRatio || 1);
        targetPoint.current.y = y_raw / (window.devicePixelRatio || 1);
      }).then((unlisten: any) => { unlistenCursor = unlisten; });
    }).catch(console.error);

    return () => { unlistenCursor(); };
  }, [isOverlay]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isOverlay || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    targetPoint.current.x = e.clientX - rect.left;
    targetPoint.current.y = e.clientY - rect.top;
  };

  const handlePointerLeave = () => {
    if (isOverlay || !canvasRef.current) return;
    // LWP behavior: If unfocused, optionally comeback to center.
    targetPoint.current.x = canvasRef.current.width / 2;
    targetPoint.current.y = canvasRef.current.height / 2;
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: isOverlay ? "none" : "auto",
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      />
    </div>
  );
}
