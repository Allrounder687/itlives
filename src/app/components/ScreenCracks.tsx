import React, { useEffect, useState } from "react";

interface CrackEvent {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export function ScreenCracks({ color = "#ffffff" }: { color?: string }) {
  const [cracks, setCracks] = useState<CrackEvent[]>([]);

  useEffect(() => {
    let crackId = 0;
    
    const handleCrack = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { x, y } = customEvent.detail;
      
      const cssX = x + window.innerWidth / 2;
      const cssY = -y + window.innerHeight / 2;
      
      const newCrack: CrackEvent = {
        id: ++crackId,
        x: cssX,
        y: cssY,
        rotation: Math.random() * 360,
        scale: 0.8 + Math.random() * 0.6
      };
      
      setCracks(prev => [...prev, newCrack]);
      
      // Remove crack after 5 seconds
      setTimeout(() => {
        setCracks(prev => prev.filter(c => c.id !== newCrack.id));
      }, 5000);
    };

    window.addEventListener("pet-punch-crack", handleCrack);
    return () => window.removeEventListener("pet-punch-crack", handleCrack);
  }, []);

  if (cracks.length === 0) return null;

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999 }}>
      {cracks.map(crack => (
        <div
          key={crack.id}
          style={{
            position: "absolute",
            left: crack.x - 150, // Assuming 300x300 image
            top: crack.y - 150,
            width: 300,
            height: 300,
            transform: `rotate(${crack.rotation}deg) scale(${crack.scale})`,
            opacity: 0.9,
            mixBlendMode: "screen", // Screen against the desktop
            backgroundImage: "url('/assets/cracked_glass.png')",
            backgroundSize: "contain",
            backgroundColor: color, // Tint the white cracks
            backgroundBlendMode: "multiply", // White * Color = Color, Black * Color = Black
            animation: "fadeOut 5s forwards"
          }}
        />
      ))}
      <style>{`
        @keyframes fadeOut {
          0% { opacity: 0.8; }
          70% { opacity: 0.8; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
