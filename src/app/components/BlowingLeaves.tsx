import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function BlowingLeaves({ params }: { params: any }) {
  const pointsRef = useRef<THREE.Points>(null);
  
  const count = params.count || 80;
  const speed = params.speed || 1.0;
  const wind = params.wind || 0.5;
  const leafSize = params.size || 15.0;
  const color = new THREE.Color(params.color || "#4caf50");
  
  const timeRef = useRef(0);

  const [positions, rotations, velocities, offsets] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const rot = new Float32Array(count); // initial rotation
    const vel = new Float32Array(count); // fall speed
    const off = new Float32Array(count); // sine wave offset
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2500; // x
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1500; // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 500; // z
      rot[i] = Math.random() * Math.PI * 2;
      vel[i] = (Math.random() * 0.5 + 0.5) * speed * 150;
      off[i] = Math.random() * Math.PI * 2;
    }
    return [pos, rot, vel, off];
  }, [count, speed]);

  // We use a custom shader to draw leaf shapes and rotate them
  const uniforms = useMemo(() => ({
    uColor: { value: color },
    uTime: { value: 0 }
  }), [color]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    uniforms.uTime.value = timeRef.current;

    const posAttribute = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let x = posAttribute.getX(i);
      let y = posAttribute.getY(i);

      // Leaves drift with wind and fall slowly
      x += (wind * 200 + Math.sin(timeRef.current * 1.5 + offsets[i]) * 50) * delta;
      y -= velocities[i] * delta;

      if (y < -1000) { 
        y = 1000; 
        x = (Math.random() - 0.5) * 2500 - (wind * 500); 
      }
      if (x > 1500) x = -1500;
      if (x < -1500) x = 1500;
      
      posAttribute.setX(i, x);
      posAttribute.setY(i, y);
    }
    posAttribute.needsUpdate = true;
  });

  const vertexShader = `
    attribute float aRot;
    attribute float aOffset;
    varying float vRot;
    uniform float uTime;
    void main() {
      // Rotate leaves over time
      vRot = aRot + uTime * 2.0 * sin(aOffset);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      
      // Perspective size
      gl_PointSize = ${leafSize.toFixed(1)} * (1000.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // Draw a basic leaf shape in fragment shader
  const fragmentShader = `
    uniform vec3 uColor;
    varying float vRot;
    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      
      // Rotate coordinates
      float s = sin(vRot);
      float c = cos(vRot);
      mat2 rotMat = mat2(c, -s, s, c);
      uv = rotMat * uv;

      // Leaf distance field (intersection of two circles)
      vec2 c1 = vec2(0.3, 0.0);
      vec2 c2 = vec2(-0.3, 0.0);
      float d1 = length(uv - c1);
      float d2 = length(uv - c2);
      
      // If inside both circles, it's the leaf body
      if (d1 < 0.4 && d2 < 0.4) {
        // Add a slight gradient/vein effect
        float vein = abs(uv.y);
        vec3 finalColor = mix(uColor, uColor * 0.5, vein * 2.0);
        gl_FragColor = vec4(finalColor, 0.8);
      } else {
        discard;
      }
    }
  `;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} args={[positions, 3]} />
        <bufferAttribute attach="attributes-aRot" count={count} args={[rotations, 1]} />
        <bufferAttribute attach="attributes-aOffset" count={count} args={[offsets, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
      />
    </points>
  );
}
