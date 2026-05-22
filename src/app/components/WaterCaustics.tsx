import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function WaterCaustics({ params }: { params: any }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const speed = params.speed || 1.0;
  const scale = params.scale || 3.0;
  const intensity = params.intensity || 1.0;
  const color = new THREE.Color(params.color || "#00ffff");

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpeed: { value: speed },
    uScale: { value: scale },
    uIntensity: { value: intensity },
    uColor: { value: color }
  }), [speed, scale, intensity, color]);

  // Use a full-screen or positioned plane
  const width = params.width || 2000;
  const height = params.height || 800;
  const yOffset = params.yOffset || -400; // bottom half default

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * uniforms.uSpeed.value;
    }
  });

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Standard procedural Voronoi-like water caustics shader
  const fragmentShader = `
    uniform float uTime;
    uniform float uScale;
    uniform float uIntensity;
    uniform vec3 uColor;
    varying vec2 vUv;

    // Pseudo-random noise function
    vec2 hash( vec2 p ) {
      p = vec2( dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)) );
      return -1.0 + 2.0*fract(sin(p)*43758.5453123);
    }

    float noise( in vec2 p ) {
      const float K1 = 0.366025404; // (sqrt(3)-1)/2;
      const float K2 = 0.211324865; // (3-sqrt(3))/6;
      vec2 i = floor( p + (p.x+p.y)*K1 );
      vec2 a = p - i + (i.x+i.y)*K2;
      vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec2 b = a - o + K2;
      vec2 c = a - 1.0 + 2.0*K2;
      vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
      vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
      return dot( n, vec3(70.0) );
    }

    void main() {
      vec2 uv = vUv * uScale;
      float time = uTime * 0.5;
      
      // Layered noise for caustics effect
      vec2 q = uv + vec2(time * 0.2, time * 0.3);
      float n = noise(q) * 0.5 + 0.5;
      
      q = uv + vec2(n + time * 0.4, n + time * -0.2);
      float n2 = noise(q) * 0.5 + 0.5;

      // Enhance peaks to look like light refracting through water ripples
      float caustics = pow(n2, 3.0) * 3.0;
      
      // Edge fading to blend seamlessly
      float fade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y) * smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);

      gl_FragColor = vec4(uColor * caustics * uIntensity * fade, caustics * uIntensity * fade * 0.8);
    }
  `;

  return (
    <mesh ref={meshRef} position={[0, yOffset, 0]}>
      <planeGeometry args={[width, height, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
