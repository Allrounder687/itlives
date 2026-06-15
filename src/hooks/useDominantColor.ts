import { useState, useEffect, useRef, RefObject } from 'react';

function getVibrantColorFromCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let maxSaturation = -1;
  let bestR = 0, bestG = 0, bestB = 0;
  
  let rSum = 0, gSum = 0, bSum = 0, count = 0;

  for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel for speed
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    // Ignore pure black / very dark and pure white / very bright
    const avg = (r + g + b) / 3;
    if (avg < 20 || avg > 240) continue;

    rSum += r;
    gSum += g;
    bSum += b;
    count++;

    // Calculate basic saturation
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    if (saturation > maxSaturation) {
      maxSaturation = saturation;
      bestR = r;
      bestG = g;
      bestB = b;
    }
  }

  // If we found a highly vibrant color, use it. Otherwise use the average.
  if (maxSaturation > 0.3) {
    return `rgb(${bestR}, ${bestG}, ${bestB})`;
  } else if (count > 0) {
    return `rgb(${Math.round(rSum/count)}, ${Math.round(gSum/count)}, ${Math.round(bSum/count)})`;
  }
  
  return null;
}

export function useDominantColor(
  mediaRef: RefObject<HTMLImageElement | HTMLVideoElement | null>,
  isEnabled: boolean = true
) {
  const [dominantColor, setDominantColor] = useState<string>("#ffffff");
  // OPTIMIZATION: Track last extracted color to avoid React re-renders if the color hasn't significantly changed
  const lastColor = useRef<string>("#ffffff");

  useEffect(() => {
    if (!isEnabled || !mediaRef.current) return;

    const media = mediaRef.current;
    // OPTIMIZATION: Reduce canvas size from 32x32 to 16x16 to cut pixels processed per frame by 75%
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");

    let intervalId: NodeJS.Timeout;

    const extract = () => {
      if (!ctx || !media) return;
      try {
        // OPTIMIZATION: Wrap in requestIdleCallback (or fallback to setTimeout) to keep extraction off the main frame loop
        const runExtraction = () => {
          ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
          const color = getVibrantColorFromCanvas(canvas);
          if (color && color !== lastColor.current) {
            lastColor.current = color;
            setDominantColor(color);
          }
        };

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(runExtraction, { timeout: 500 });
        } else {
          setTimeout(runExtraction, 0);
        }
      } catch (e) {
        // Tainted canvas (CORS), just ignore
      }
    };

    if (media instanceof HTMLVideoElement) {
      const loop = () => {
        extract();
        // OPTIMIZATION: Throttle polling to every 5 seconds (5000ms) instead of 2 seconds
        intervalId = setTimeout(loop, 5000); 
      };
      
      const onPlay = () => loop();
      media.addEventListener("play", onPlay);
      
      if (!media.paused) {
        loop();
      }

      return () => {
        clearTimeout(intervalId);
        media.removeEventListener("play", onPlay);
      };
    } else {
      if (media.complete) {
        extract();
      } else {
        media.addEventListener("load", extract);
        return () => media.removeEventListener("load", extract);
      }
    }
  }, [mediaRef, isEnabled]);

  return dominantColor;
}
