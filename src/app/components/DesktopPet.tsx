import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { useFrame, createPortal } from "@react-three/fiber";
import { useGLTF, useAnimations, Clone, Html } from "@react-three/drei";

type PetBehavior = "wander" | "follow-cursor" | "idle-only";

interface DesktopPetProps {
  params: any;
  isOverlay: boolean;
  widgets?: any[];
}

const MANNEQUIN_PATH = "/assets/KayKit_Character_Animations_1.1/Mannequin Character/characters/Mannequin_Medium.glb";
const ANIM_GENERAL_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_General.glb";
const ANIM_MOVEMENT_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb";
const ANIM_MELEE_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatMelee.glb";
const ANIM_SIM_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_Simulation.glb";
const ANIM_ADVANCED_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_MovementAdvanced.glb";
const ANIM_RANGED_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatRanged.glb";
const ANIM_SPECIAL_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_Special.glb";
const ANIM_TOOLS_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_Tools.glb";

// Preload the assets
useGLTF.preload(MANNEQUIN_PATH);
useGLTF.preload(ANIM_GENERAL_PATH);
useGLTF.preload(ANIM_MOVEMENT_PATH);
useGLTF.preload(ANIM_MELEE_PATH);
useGLTF.preload(ANIM_SIM_PATH);
useGLTF.preload(ANIM_ADVANCED_PATH);
useGLTF.preload(ANIM_RANGED_PATH);
useGLTF.preload(ANIM_SPECIAL_PATH);
useGLTF.preload(ANIM_TOOLS_PATH);

export function DesktopPet({ params, isOverlay, widgets }: DesktopPetProps) {
  const outerGroup = useRef<THREE.Group>(null);
  const animGroup = useRef<THREE.Group>(null);
  const clonedScene = useMemo(() => {
    const { SkeletonUtils } = require('three-stdlib');
    return SkeletonUtils.clone(useGLTF(MANNEQUIN_PATH).scene);
  }, []);
  
  // Load models
  const { scene: mannequinScene } = useGLTF(MANNEQUIN_PATH);
  const { animations: animGeneral } = useGLTF(ANIM_GENERAL_PATH);
  const { animations: animMovement } = useGLTF(ANIM_MOVEMENT_PATH);
  const { animations: animMelee } = useGLTF(ANIM_MELEE_PATH);
  const { animations: animSim } = useGLTF(ANIM_SIM_PATH);
  const { animations: animAdvanced } = useGLTF(ANIM_ADVANCED_PATH);
  const { animations: animRanged } = useGLTF(ANIM_RANGED_PATH);
  const { animations: animSpecial } = useGLTF(ANIM_SPECIAL_PATH);
  const { animations: animTools } = useGLTF(ANIM_TOOLS_PATH);
  
  // Combine all animations
  const animations = useMemo(() => {
    return [
      ...animGeneral, ...animMovement, ...animMelee, ...animSim, 
      ...animAdvanced, ...animRanged, ...animSpecial, ...animTools
    ];
  }, [animGeneral, animMovement, animMelee, animSim, animAdvanced, animRanged, animSpecial, animTools]);
  
  const { actions, names, mixer } = useAnimations(animations, animGroup);
  
  // State
  const [behavior, setBehavior] = useState<PetBehavior>(params.behavior || "wander");
  const scale = params.scale || 50.0;
  const speedScale = params.speed || 1.0;
  
  // AI State
  const aiState = useRef<"IDLE" | "WALK" | "RUN" | "CLICK_MOVE" | "PUNCH" | "CUSTOM" | "WIDGET_MOVE" | "WIDGET_INTERACT">("IDLE");
  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const currentPos = useRef(new THREE.Vector3(0, -300, 0)); // Start somewhat bottom-center
  const cursorTarget = useRef<{x: number, y: number} | null>(null);
  const timer = useRef(0);
  
  // Custom Material
  const customMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: params.color || "#00aaff",
      roughness: 0.5,
      metalness: 0.1,
    });
  }, [params.color]);

  const [headBone, setHeadBone] = useState<THREE.Object3D | null>(null);

  // Apply Custom Material to Clone and find head
  useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        child.material = customMaterial;
      }
    });
    const head = clonedScene.getObjectByName('head');
    if (head) setHeadBone(head);
  }, [clonedScene, customMaterial]);

  useEffect(() => {
    setBehavior(params.behavior || "wander");
  }, [params.behavior]);

  // IPC Cursor listener for "follow-cursor" mode
  useEffect(() => {
    let isMounted = true;
    let unlisten: () => void;
    
    if (behavior !== "follow-cursor") return;
    
    const setupIPC = async () => {
      try {
        if (!isOverlay) {
          const handleMove = (e: MouseEvent) => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            cursorTarget.current = { x: e.clientX - w/2, y: -e.clientY + h/2 };
          };
          window.addEventListener("mousemove", handleMove);
          unlisten = () => window.removeEventListener("mousemove", handleMove);
          return;
        }
        
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;
        
        
        unlisten = await listen<{x: number, y: number}>("cursor-moved", (e) => {
          let payload = e.payload as any;
          if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(err){} }
          if (!payload || typeof payload.x !== "number") return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          cursorTarget.current = {
            x: (payload.x / (window.devicePixelRatio || 1)) - w/2,
            y: -(payload.y / (window.devicePixelRatio || 1)) + h/2
          };
        });
      } catch (err) {}
    };
    setupIPC();
    
    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [behavior, isOverlay]);

  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const behaviorRef = useRef(behavior);
  useEffect(() => { behaviorRef.current = behavior; }, [behavior]);

  // Click to move logic
  const playVoiceLine = async (text: string) => {
    if (paramsRef.current.muted) return;
    
    try {
      if (!(window as any).kokoroTTS) {
        console.log("Loading Kokoro TTS model...");
        const kokoro = await import("kokoro-js");
        (window as any).kokoroTTS = await kokoro.KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
          dtype: "q8",
          device: "wasm"
        });
      }
      
      const audioData = await (window as any).kokoroTTS.generate(text, { voice: "af_heart" });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = audioContext.createBuffer(1, audioData.audio.length, audioData.sampling_rate);
      audioBuffer.getChannelData(0).set(audioData.audio);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (err) {
      console.error("Kokoro TTS fallback:", err);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = 2.0;
        utterance.rate = 1.3;
        utterance.volume = 0.5;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let unlisten: () => void;
    let lastClickTime = 0;

    const handleSingleClick = (x: number, y: number) => {
      if (behaviorRef.current === "wander") return; // Ignore clicks while in wander mode!
      if (aiState.current === "PUNCH" || aiState.current === "CUSTOM") return;
      
      const lines = ["Target acquired!", "On my way!", "Initiating punch sequence!", "Destroy!"];
      playVoiceLine(lines[Math.floor(Math.random() * lines.length)]);
      
      const w = window.innerWidth;
      const h = window.innerHeight;
      let clampedX = x;
      let clampedY = y;
      if (clampedX < -w/2 + 50) clampedX = -w/2 + 50;
      if (clampedX > w/2 - 50) clampedX = w/2 - 50;
      if (clampedY < -h/2 + 50) clampedY = -h/2 + 50;
      if (clampedY > h/2 - 50) clampedY = h/2 - 50;
      
      targetPos.current.set(clampedX, clampedY, 0);
      const dist = currentPos.current.distanceTo(targetPos.current);
      aiState.current = "CLICK_MOVE";
      if (dist > 200) {
        playAnim("Running_A");
      } else {
        playAnim("Walking_A");
      }
    };

    const setupListener = async () => {
      try {
        if (!isOverlay) {
          const handleClick = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastClickTime > 400) {
              const w = window.innerWidth;
              const h = window.innerHeight;
              handleSingleClick(e.clientX - w/2, -e.clientY + h/2);
              lastClickTime = now;
            }
          };
          window.addEventListener("click", handleClick);
          unlisten = () => window.removeEventListener("click", handleClick);
          return;
        }

        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        unlisten = await listen<{x: number, y: number}>("cursor-click", (e) => {
          const now = Date.now();
          if (now - lastClickTime > 400) {
            let payload = e.payload as any;
            if (typeof payload === "string") { try { payload = JSON.parse(payload); } catch(err){} }
            if (!payload || typeof payload.x !== "number") return;
            const w = window.innerWidth;
            const h = window.innerHeight;
            handleSingleClick(
              (payload.x / (window.devicePixelRatio || 1)) - w/2,
              -(payload.y / (window.devicePixelRatio || 1)) + h/2
            );
            lastClickTime = now;
          }
        });
      } catch (err) {}
    };
    setupListener();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [isOverlay]);

  // Play initial animation
  useEffect(() => {
    if (actions["Idle_A"]) {
      actions["Idle_A"].reset().fadeIn(0.5).play();
    }
  }, [actions]);

  // Change animation helper
  const playAnim = (name: string, duration = 0.3) => {
    if (!actions[name]) return;
    // Fade out others
    Object.values(actions).forEach(action => {
      if (action && action.isRunning() && action !== actions[name]) {
        action.fadeOut(duration);
      }
    });
    actions[name].reset().fadeIn(duration).play();
  };

  useFrame((state, delta) => {
    if (!animGroup.current || !outerGroup.current) return;
    
    timer.current -= delta;
    
    const speedWalk = 100 * speedScale;
    const speedRun = 250 * speedScale;
    
    let isMoving = false;
    let targetVec = targetPos.current;
    
    if (behavior === "idle-only") {
      if (aiState.current !== "IDLE") {
        aiState.current = "IDLE";
        playAnim(Math.random() > 0.5 ? "Idle_A" : "Idle_B");
      }
      // Randomly switch idle animations occasionally
      if (timer.current <= 0) {
        timer.current = 5 + Math.random() * 5;
        const roll = Math.random();
        if (roll > 0.95) playAnim("Cheering", 0.5);
        else if (roll > 0.90) playAnim("Waving", 0.5);
        else if (roll > 0.85) playAnim("Sit_Floor_Down", 0.5);
        else if (roll > 0.80) playAnim("Sit_Floor_Idle", 0.5);
        else if (roll > 0.75) playAnim("Push_Ups", 0.5);
        else if (roll > 0.70) playAnim("Interact", 0.5); // Check ground
        else if (roll > 0.65) playAnim("PickUp", 0.5);
        else playAnim(Math.random() > 0.5 ? "Idle_A" : "Idle_B", 0.5);
      }
    } 
    else if (behavior === "wander") {
      if (aiState.current === "IDLE") {
        if (timer.current <= 0) {
          const roll = Math.random();
          if (widgets && widgets.length > 0 && roll > 0.6) {
            // Target a widget!
            const wTarget = widgets[Math.floor(Math.random() * widgets.length)];
            const sw = window.innerWidth;
            const sh = window.innerHeight;
            const px = wTarget.params.x || 50;
            const py = wTarget.params.y || 50;
            const pw = wTarget.params.w || 20;
            const screenX = (px / 100) * sw;
            const screenY = (py / 100) * sh;
            const screenW = (pw / 100) * sw;
            
            const targetX = screenX + screenW/2 - sw/2;
            const targetY = -(screenY - sh/2) + 15; // 15px above top edge
            
            let clampedX = targetX;
            if (clampedX < -sw/2 + 50) clampedX = -sw/2 + 50;
            if (clampedX > sw/2 - 50) clampedX = sw/2 - 50;
            
            targetPos.current.set(clampedX, targetY, 0);
            aiState.current = "WIDGET_MOVE";
            playAnim("Running_A");
          } else if (roll > 0.8) {
            // Just do a fun animation and stay idle
            const anims = ["Cheering", "Waving", "Interact", "PickUp", "Sit_Floor_Idle", "Fishing_Idle", "Working_A"];
            playAnim(anims[Math.floor(Math.random() * anims.length)]);
            timer.current = 2 + Math.random() * 3;
          } else {
            // Time to walk somewhere new!
            const w = window.innerWidth;
            const h = window.innerHeight;
            targetPos.current.set((Math.random() - 0.5) * (w - 100), (Math.random() - 0.5) * (h - 100), 0);
            aiState.current = "WALK";
            playAnim("Walking_A");
          }
        }
      } else if (aiState.current === "WALK") {
        const dist = currentPos.current.distanceTo(targetVec);
        if (dist < 10) {
          // Reached!
          aiState.current = "IDLE";
          playAnim("Idle_A");
          timer.current = 2 + Math.random() * 6; // wait 2-8 seconds
        } else {
          isMoving = true;
        }
      } else if (aiState.current === "WIDGET_MOVE") {
        const dist = currentPos.current.distanceTo(targetVec);
        if (dist < 10) {
          aiState.current = "WIDGET_INTERACT";
          const anims = ["Push_Ups", "Working_A", "Melee_Unarmed_Attack_Punch_A"];
          playAnim(anims[Math.floor(Math.random() * anims.length)]);
          timer.current = 3 + Math.random() * 4;
        } else {
          isMoving = true;
        }
      } else if (aiState.current === "WIDGET_INTERACT") {
        if (timer.current <= 0) {
          aiState.current = "IDLE";
          playAnim("Idle_A");
          timer.current = 1 + Math.random() * 2;
        }
      } else if (aiState.current === "CLICK_MOVE") {
        const dist = currentPos.current.distanceTo(targetVec);
        if (dist < 10) {
          // Reached the clicked spot! Do a punch!
          aiState.current = "PUNCH";
          playAnim("Melee_Unarmed_Attack_Punch_A", 0.2);
          timer.current = 1.0; // Punch animation duration
          
          const hitLines = ["Take that!", "Bam!", "Pow!", "Gotcha!"];
          playVoiceLine(hitLines[Math.floor(Math.random() * hitLines.length)]);
          
          if (params.enableCracks !== false) {
            window.dispatchEvent(new CustomEvent("pet-punch-crack", {
              detail: { x: targetVec.x, y: targetVec.y }
            }));
          }
        } else {
          isMoving = true;
        }
      } else if (aiState.current === "PUNCH") {
        // Just wait for timer
        if (timer.current <= 0) {
          aiState.current = "IDLE";
          playAnim("Idle_A");
        }
      }
    }
    else if (behavior === "follow-cursor") {
      if (cursorTarget.current) {
        targetVec = new THREE.Vector3(cursorTarget.current.x, cursorTarget.current.y, 0);
        const dist = currentPos.current.distanceTo(targetVec);
        
        if (dist > 150) {
          if (aiState.current !== "RUN") {
            aiState.current = "RUN";
            playAnim("Running_A");
          }
          isMoving = true;
        } else if (dist > 50) {
          if (aiState.current !== "WALK") {
            aiState.current = "WALK";
            playAnim("Walking_A");
          }
          isMoving = true;
        } else {
          if (aiState.current !== "IDLE") {
            aiState.current = "IDLE";
            playAnim("Idle_A");
          }
        }
      }
    }
    else {
      // Custom Animation Loop
      if (aiState.current !== "CUSTOM") {
        aiState.current = "CUSTOM";
        playAnim(behavior as string, 0.5);
      }
    }
    
    // Movement logic
    if (isMoving) {
      const dir = new THREE.Vector3().subVectors(targetVec, currentPos.current).normalize();
      let currentSpeed = speedWalk;
      if (aiState.current === "RUN") currentSpeed = speedRun;
      else if (aiState.current === "CLICK_MOVE") {
        const dist = currentPos.current.distanceTo(targetVec);
        currentSpeed = dist > 200 ? speedRun : speedWalk;
      }
      
      currentPos.current.add(dir.multiplyScalar(currentSpeed * delta));
      
      // Rotation: Face the movement direction
      // We want +Z to be forward, but typically GLTF models face +Z.
      // We use atan2 to find the angle in the XY plane (since it's a 2D desktop).
      // We rotate around the X axis to stand up, then around Z to face the direction?
      // No, standard 3D in React Three Fiber has Y as UP, and X/Z as floor.
      // But we are in a 2D orthographic/perspective camera where Z is depth.
      // So UP is +Y, RIGHT is +X.
      // To walk across the screen, the character needs to rotate around the Y axis.
      const angle = Math.atan2(dir.x, dir.y);
      
      // Smoothly rotate
      const targetRot = angle;
      // Lerp rotation
      let r = animGroup.current.rotation.y;
      // Shortest path angle lerp
      let diff = targetRot - r;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      animGroup.current.rotation.y += diff * 10 * delta;
    }

    outerGroup.current.position.copy(currentPos.current);
    
    // Adjust mixer time scale based on speedScale
    if (mixer) {
      mixer.timeScale = speedScale;
    }
  });

  return (
    <group ref={outerGroup} position={[0, -300, 0]}>
      {/* Lights so the MeshStandardMaterial isn't black! */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 20, 30]} intensity={2.5} castShadow />
      
      <group ref={animGroup} scale={[scale, scale, scale]}>
        <primitive object={clonedScene} castShadow receiveShadow />
        {params.name && (
          <Html position={[0, 1.5, 0]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            <div style={{
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '8px',
              fontFamily: 'sans-serif',
              fontSize: '12px',
              fontWeight: 'bold',
              textShadow: '1px 1px 0 #000'
            }}>
              {params.name}
            </div>
          </Html>
        )}
        
        {/* Render a cute face directly attached to the head bone */}
        {headBone && createPortal(
          <group>
            {/* Front Face */}
            <group position={[0, 0.25, 0.22]} scale={[1.5, 1.5, 1.5]}>
              <mesh position={[0.06, 0, 0]}><sphereGeometry args={[0.035]} /><meshBasicMaterial color="#111111" /></mesh>
              <mesh position={[-0.06, 0, 0]}><sphereGeometry args={[0.035]} /><meshBasicMaterial color="#111111" /></mesh>
              <mesh position={[0.1, -0.04, 0.01]}><sphereGeometry args={[0.02]} /><meshBasicMaterial color="#ff5555" transparent opacity={0.8} /></mesh>
              <mesh position={[-0.1, -0.04, 0.01]}><sphereGeometry args={[0.02]} /><meshBasicMaterial color="#ff5555" transparent opacity={0.8} /></mesh>
              <mesh position={[0, -0.05, 0.03]}><boxGeometry args={[0.06, 0.015, 0.01]} /><meshBasicMaterial color="#111111" /></mesh>
            </group>
            {/* Back Face (in case the model faces backwards) */}
            <group position={[0, 0.25, -0.22]} rotation={[0, Math.PI, 0]} scale={[1.5, 1.5, 1.5]}>
              <mesh position={[0.06, 0, 0]}><sphereGeometry args={[0.035]} /><meshBasicMaterial color="#111111" /></mesh>
              <mesh position={[-0.06, 0, 0]}><sphereGeometry args={[0.035]} /><meshBasicMaterial color="#111111" /></mesh>
              <mesh position={[0.1, -0.04, 0.01]}><sphereGeometry args={[0.02]} /><meshBasicMaterial color="#ff5555" transparent opacity={0.8} /></mesh>
              <mesh position={[-0.1, -0.04, 0.01]}><sphereGeometry args={[0.02]} /><meshBasicMaterial color="#ff5555" transparent opacity={0.8} /></mesh>
              <mesh position={[0, -0.05, 0.03]}><boxGeometry args={[0.06, 0.015, 0.01]} /><meshBasicMaterial color="#111111" /></mesh>
            </group>
          </group>,
          headBone
        )}
      </group>
    </group>
  );
}
