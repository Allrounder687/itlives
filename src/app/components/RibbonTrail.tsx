import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Trail } from '@react-three/drei';

export function RibbonTrail({ 
  color = "#ffffff", 
  length = 50, 
  width = 5.0,
  isOverlay = false
}: { 
  color?: string; 
  length?: number; 
  width?: number;
  isOverlay?: boolean;
}) {
  const targetRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  useFrame((state) => {
    if (!targetRef.current) return;
    let targetX, targetY;
    if (isOverlay) {
      targetX = (state.pointer.x * viewport.width) / 2;
      targetY = (state.pointer.y * viewport.height) / 2;
    } else {
      targetX = (state.pointer.x * viewport.width) / 2;
      targetY = (state.pointer.y * viewport.height) / 2;
    }
    
    // Smoothly interpolate position for fluid ribbon effect
    targetRef.current.position.x = THREE.MathUtils.lerp(targetRef.current.position.x, targetX, 0.2);
    targetRef.current.position.y = THREE.MathUtils.lerp(targetRef.current.position.y, targetY, 0.2);
  });

  return (
    <Trail
      width={width * 5} // Scale width slightly to match user expectations
      length={length}
      color={new THREE.Color(color)}
      attenuation={(t) => t * t} // Tapers off at the end
      local={false} // Use world coordinates
    >
      <mesh ref={targetRef} visible={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </Trail>
  );
}
