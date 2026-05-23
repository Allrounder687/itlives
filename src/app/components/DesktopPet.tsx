import React, { useEffect, useRef, useState, useMemo, useCallback, Suspense } from "react";
import * as THREE from "three";
import { useFrame, createPortal } from "@react-three/fiber";
import { useGLTF, useAnimations, Clone, Billboard, useTexture } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";

import { SpriteSheet } from "./SpriteSheet";


import { useTauriCursor } from "../../hooks/pet/useTauriCursor";
import { useTauriAudio } from "../../hooks/pet/useTauriAudio";
import { useKokoroTTS } from "../../hooks/pet/useKokoroTTS";
import { usePetAI, PetAIParams } from "../../hooks/pet/usePetAI";
import { useTauriClick } from "../../hooks/pet/useTauriClick";

export type PetBehavior = "wander" | "follow-cursor" | "idle-only";

export interface DesktopPetProps {
  params: any;
  isOverlay: boolean;
  widgets?: any[];
  onUpdateParam?: (layerId: string, paramName: string, value: any) => void;
}

const SKINS: Record<string, string> = {
  "Knight": "/assets/KayKit_Adventurers/Knight.glb",
  "Barbarian": "/assets/KayKit_Adventurers/Barbarian.glb",
  "Mage": "/assets/KayKit_Adventurers/Mage.glb",
  "Rogue": "/assets/KayKit_Adventurers/Rogue.glb",
  "Rogue Hooded": "/assets/KayKit_Adventurers/Rogue_Hooded.glb"
};

const ANIM_GENERAL_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_General.glb";
const ANIM_MOVEMENT_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb";
const ANIM_MELEE_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatMelee.glb";
const ANIM_SIM_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_Simulation.glb";
const ANIM_ADVANCED_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_MovementAdvanced.glb";
const ANIM_RANGED_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatRanged.glb";
const ANIM_SPECIAL_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_Special.glb";
const ANIM_TOOLS_PATH = "/assets/KayKit_Character_Animations_1.1/Animations/gltf/Rig_Medium/Rig_Medium_Tools.glb";

// Preload the assets
Object.values(SKINS).forEach(path => useGLTF.preload(path));
useGLTF.preload(ANIM_GENERAL_PATH);
useGLTF.preload(ANIM_MOVEMENT_PATH);
useGLTF.preload(ANIM_MELEE_PATH);
useGLTF.preload(ANIM_SIM_PATH);
useGLTF.preload(ANIM_ADVANCED_PATH);
useGLTF.preload(ANIM_RANGED_PATH);
useGLTF.preload(ANIM_SPECIAL_PATH);
useGLTF.preload(ANIM_TOOLS_PATH);

useTexture.preload("/assets/Dark VFX 1/Dark VFX 1 (40x32).png");
useTexture.preload("/assets/Dark VFX 2/Dark VFX 2 (48x64).png");

const tempDir = new THREE.Vector3();

function PetEntity({ params, isOverlay, widgets, onUpdateParam, isPrimary, myPosRef, myStateRef, friendPosRef, friendStateRef }: DesktopPetProps & { isPrimary: boolean, myPosRef: any, myStateRef: any, friendPosRef: any, friendStateRef: any }) {
  const outerGroup = useRef<THREE.Group>(null);
  const animGroup = useRef<THREE.Group>(null);

  
  const skinName = isPrimary ? (params.skin || "Knight") : (params.companionSkin || "Mage");
  const skinPath = SKINS[skinName] || SKINS["Knight"];

  const { scene: skinScene } = useGLTF(skinPath);

  const clonedScene = useMemo(() => {
    return SkeletonUtils.clone(skinScene);
  }, [skinScene]);

  // Load models
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

  // AI State Refs
  const aiState = myStateRef;
  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const currentPos = myPosRef;
  const timer = useRef(0);
  const danceTimer = useRef(0);
  const singTimer = useRef(0);
  const heldWidgetRef = useRef<any>(null);
  const targetWidgetRef = useRef<any>(null);
  const throwVelocity = useRef(new THREE.Vector3(0, 0, 0));

  const [activePower, setActivePower] = useState<string | null>(null);

  const [headBone, setHeadBone] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    const head = clonedScene.getObjectByName('head');
    if (head) setHeadBone(head);
  }, [clonedScene]);

  useEffect(() => {
    setBehavior(params.behavior || "wander");
  }, [params.behavior]);

  const behaviorRef = useRef(behavior);
  useEffect(() => { behaviorRef.current = behavior; }, [behavior]);

  // Use Custom Hooks
  const cursorTarget = useTauriCursor(behavior, isOverlay);
  const audioVolume = useTauriAudio(behavior, isOverlay);
  const { playVoiceLine } = useKokoroTTS(params.muted);
  const { updateAI } = usePetAI();

  const triggerPower = useCallback((vfxId: string) => {
    setActivePower(vfxId);
  }, []);

  // Animation Helper
  const getAttackAnimForSkin = useCallback((skin: string) => {
    const attacks: Record<string, string[]> = {
      "Knight": ["Melee_1H_Attack_Chop", "Melee_1H_Attack_Slice_Diagonal", "Melee_Block_Attack"],
      "Barbarian": ["Melee_2H_Attack_Chop", "Melee_2H_Attack_Spin", "Melee_2H_Attack_Slice"],
      "Mage": ["Ranged_Magic_Shoot", "Ranged_Magic_Spellcasting", "Ranged_Magic_Summon"],
      "Rogue": ["Melee_Dualwield_Attack_Chop", "Melee_Dualwield_Attack_Slice", "Melee_Dualwield_Attack_Stab"],
      "Rogue Hooded": ["Melee_Dualwield_Attack_Chop", "Melee_Dualwield_Attack_Slice", "Melee_Dualwield_Attack_Stab"]
    };
    const list = attacks[skin] || ["Melee_Unarmed_Attack_Punch_A", "Melee_Unarmed_Attack_Kick"];
    const available = list.filter(a => actions[a]);
    if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
    return "Melee_Unarmed_Attack_Punch_A"; // Fallback
  }, [actions]);

  const playAnim = useCallback((name: string, duration = 0.3) => {
    if (!actions[name]) return;
    Object.values(actions).forEach(action => {
      if (action && action.isRunning() && action !== actions[name]) {
        action.fadeOut(duration);
      }
    });
    const action = actions[name]!;
    action.reset().fadeIn(duration);

    const oneShot = ["Hit", "Defeat", "Spawn", "Attack", "Punch", "Kick", "PickUp", "Throw", "_Down", "_StandUp", "Interact", "Spellcast", "Chop", "Slice", "Block", "Shoot", "Summon", "Stab"];
    if (oneShot.some(s => name.includes(s))) {
       action.setLoop(THREE.LoopOnce, 1);
       action.clampWhenFinished = true;
    } else {
       action.setLoop(THREE.LoopRepeat, Infinity);
    }
    action.play();
  }, [actions]);

  // Handle global click
  useTauriClick(behaviorRef, isOverlay, (clampedX, clampedY) => {
    if (behaviorRef.current === "wander") return;
    if (aiState.current === "PUNCH" || aiState.current === "CUSTOM") return;

    const lines = ["Target acquired!", "On my way!", "Initiating punch sequence!", "Destroy!"];
    playVoiceLine(lines[Math.floor(Math.random() * lines.length)]);

    targetPos.current.set(clampedX, clampedY, 0);
    const dist = currentPos.current.distanceTo(targetPos.current);
    aiState.current = "CLICK_MOVE";
    if (dist > 200) {
      playAnim("Running_A");
    } else {
      playAnim("Walking_A");
    }
  });


  useFrame((state, delta) => {
    if (!animGroup.current || !outerGroup.current) return;

    let anyRunning = false;
    Object.values(actions).forEach(a => {
      if (a && a.isRunning()) anyRunning = true;
    });
    if (!anyRunning && actions["Idle_A"]) {
      actions["Idle_A"].reset().play();
    }

    const aiParams: PetAIParams = {
      behavior, aiState, timer, danceTimer, singTimer, targetPos, currentPos, cursorTarget,
      audioVolume, heldWidgetRef, targetWidgetRef, throwVelocity, friendPosRef, friendStateRef,
      playAnim, playVoiceLine, getAttackAnimForSkin, skinName, names, actions, params, isOverlay, widgets,
      triggerPower
    };

    const { isMoving, targetVec } = updateAI(delta, aiParams);

    const speedWalk = 100 * speedScale;
    const speedRun = 250 * speedScale;

    // Movement logic
    if (isMoving) {
      tempDir.subVectors(targetVec, currentPos.current).normalize();
      let currentSpeed = speedWalk;
      if (aiState.current === "RUN" || aiState.current === "WIDGET_MOVE" || aiState.current === "ICON_MOVE") currentSpeed = speedRun;
      else if (aiState.current === "CLICK_MOVE") {
        const dist = currentPos.current.distanceTo(targetVec);
        currentSpeed = dist > 200 ? speedRun : speedWalk;
      }

      currentPos.current.add(tempDir.multiplyScalar(currentSpeed * delta));

      // Rotation (Correct mapping: invert Y for proper Up/Down facing)
      const angle = Math.atan2(tempDir.x, -tempDir.y);
      let r = animGroup.current.rotation.y % (Math.PI * 2);
      if (r > Math.PI) r -= Math.PI * 2;
      if (r < -Math.PI) r += Math.PI * 2;
      animGroup.current.rotation.y = r; // Prevent infinite growth

      let diff = angle - r;
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;
      animGroup.current.rotation.y += diff * 10 * delta;
    } else if (friendPosRef && friendPosRef.current && (aiState.current === "BATTLE_ATTACK" || aiState.current === "BATTLE_HIT" || aiState.current === "BATTLE_HIT_INIT")) {
      tempDir.subVectors(friendPosRef.current, currentPos.current).normalize();
      if (tempDir.lengthSq() > 0.001) {
        const angle = Math.atan2(tempDir.x, -tempDir.y);
        let r = animGroup.current.rotation.y % (Math.PI * 2);
        if (r > Math.PI) r -= Math.PI * 2;
        if (r < -Math.PI) r += Math.PI * 2;
        animGroup.current.rotation.y = r;

        let diff = angle - r;
        if (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > Math.PI) diff -= Math.PI * 2;
        animGroup.current.rotation.y += diff * 15 * delta;
      }
    }

    // Apply movement via direct transform
    outerGroup.current.position.copy(currentPos.current);

    if (mixer) mixer.timeScale = speedScale;
  });

  return (
    <group ref={outerGroup} position={[currentPos.current.x, currentPos.current.y, currentPos.current.z]}>
      <group ref={animGroup} scale={[scale, scale, scale]}>
        <primitive object={clonedScene} />
      </group>
      {activePower && (
        <Suspense fallback={null}>
          <Billboard position={[0, scale * 2.0, 0]}>
            <SpriteSheet 
              url={activePower === "dark_vfx_1" ? "/assets/Dark VFX 1/Dark VFX 1 (40x32).png" : "/assets/Dark VFX 2/Dark VFX 2 (48x64).png"}
              columns={activePower === "dark_vfx_1" ? 10 : 16}
              rows={activePower === "dark_vfx_1" ? 2 : 1}
              fps={15}
              scale={[scale * 3.0, scale * 3.0, 1]}
              onFinish={() => setActivePower(null)}
            />
          </Billboard>
        </Suspense>
      )}
    </group>
  );
}

export function DesktopPet(props: DesktopPetProps) {
  const primaryPosRef = useRef(new THREE.Vector3(0, -300, 0));
  const primaryStateRef = useRef("IDLE");
  const companionPosRef = useRef(new THREE.Vector3(100, -300, 0));
  const companionStateRef = useRef("IDLE");

  const primarySkin = props.params.skin || "Knight";
  const companionSkin = props.params.companionSkin || "Mage";

  return (
    <group>
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 20, 30]} intensity={2.5} />
      
      <PetEntity key={`primary-${primarySkin}`} isPrimary={true} myPosRef={primaryPosRef} myStateRef={primaryStateRef} friendPosRef={companionPosRef} friendStateRef={companionStateRef} {...props} />
      {props.params.enableCompanion && (
        <PetEntity key={`companion-${companionSkin}`} isPrimary={false} myPosRef={companionPosRef} myStateRef={companionStateRef} friendPosRef={primaryPosRef} friendStateRef={primaryStateRef} {...props} />
      )}
    </group>
  );
}
