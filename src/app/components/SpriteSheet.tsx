import React, { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

export interface SpriteSheetProps {
  url: string;
  columns: number;
  rows: number;
  fps?: number;
  loop?: boolean;
  onFinish?: () => void;
  position?: [number, number, number];
  scale?: [number, number, number];
}

export function SpriteSheet({ 
  url, 
  columns, 
  rows, 
  fps = 15, 
  loop = false, 
  onFinish,
  position = [0, 0, 0],
  scale = [1, 1, 1]
}: SpriteSheetProps) {
  const texture = useTexture(url);
  const totalFrames = columns * rows;
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Need to configure the texture once it loads
  const clonedTexture = useMemo(() => {
    const t = texture.clone();
    t.repeat.set(1 / columns, 1 / rows);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    return t;
  }, [texture, columns, rows]);

  const [finished, setFinished] = useState(false);
  const timeAccumulator = useRef(0);
  const currentFrame = useRef(0);

  useFrame((_, delta) => {
    if (finished || !clonedTexture) return;

    timeAccumulator.current += delta;
    const timePerFrame = 1 / fps;

    if (timeAccumulator.current > timePerFrame) {
      timeAccumulator.current -= timePerFrame;
      currentFrame.current += 1;

      if (currentFrame.current >= totalFrames) {
        if (loop) {
          currentFrame.current = 0;
        } else {
          setFinished(true);
          if (onFinish) onFinish();
          return;
        }
      }

      // Calculate new offset
      const col = currentFrame.current % columns;
      const row = Math.floor(currentFrame.current / columns);
      
      // For webgl textures, the origin (0,0) is at the bottom left. 
      // If the sprite sheet is read top-to-bottom, we invert the row offset.
      clonedTexture.offset.x = col / columns;
      clonedTexture.offset.y = 1 - (row + 1) / rows;
    }
  });

  if (finished) return null;

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial 
        map={clonedTexture} 
        transparent={true} 
        side={THREE.DoubleSide} 
        depthWrite={false}
      />
    </mesh>
  );
}
