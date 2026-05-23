const fs = require('fs');
let code = fs.readFileSync('d:/use after format/allrounder687/.openclaw/apps/openclaw-lwp/scratch/DesktopPet.tsx', 'utf8');

// 1. Rename the main export to PetEntity and add new props
code = code.replace(
  'export function DesktopPet({ params, isOverlay, widgets, onUpdateParam }: DesktopPetProps) {',
  'function PetEntity({ params, isOverlay, widgets, onUpdateParam, isPrimary, myPosRef, myStateRef, friendPosRef, friendStateRef }: DesktopPetProps & { isPrimary: boolean, myPosRef: any, myStateRef: any, friendPosRef: any, friendStateRef: any }) {'
);

// 2. Change skin selection
code = code.replace(
  'const skinName = params.skin || "Knight";',
  'const skinName = isPrimary ? (params.skin || "Knight") : (params.companionSkin || "Mage");'
);

// 3. Remove local aiState and currentPos refs
code = code.replace(
  'const aiState = useRef<"IDLE" | "WALK" | "RUN" | "CLICK_MOVE" | "PUNCH" | "CUSTOM" | "WIDGET_MOVE" | "WIDGET_INTERACT" | "DANCE" | "WIDGET_PICKUP" | "WIDGET_HOLD" | "WIDGET_THROW" | "WIDGET_AIRBORNE" | "ICON_MOVE" | "ICON_THROW">("IDLE");',
  'const aiState = myStateRef;'
);
code = code.replace(
  'const currentPos = useRef(new THREE.Vector3(0, -300, 0)); // Start somewhat bottom-center',
  'const currentPos = myPosRef;'
);

// Add getAttackAnimForSkin helper
const playAnimFind = `  const playAnim = (name: string, duration = 0.3) => {`;
const playAnimNew = `  const getAttackAnimForSkin = (skin: string) => {
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
  };

  const playAnim = (name: string, duration = 0.3) => {`;
code = code.replace(playAnimFind, playAnimNew);

// 4. In IDLE wander logic, add companion interaction triggers
const idleLogicOriginal = `
          if (behaviorRef.current === "wander") {
            const wanderRoll = Math.random();`;
const idleLogicNew = `
          if (behaviorRef.current === "wander") {
            const wanderRoll = Math.random();
            // COMPANION / MAYHEM LOGIC
            if (params.enableCompanion && friendPosRef && friendPosRef.current && friendStateRef) {
              const distToFriend = currentPos.current.distanceTo(friendPosRef.current);
              
              // If too far, FOLLOW_FRIEND
              if (distToFriend > 300 && Math.random() > 0.5) {
                aiState.current = "FOLLOW_FRIEND";
                timer.current = 2.0;
                playAnim("Run_A");
                isMoving = true;
                return;
              }
              // If close and Mayhem mode is on
              else if (params.mayhemMode && distToFriend < 100 && Math.random() > 0.8 && friendStateRef.current !== "BATTLE_ATTACK" && friendStateRef.current !== "BATTLE_HIT" && friendStateRef.current !== "BATTLE_HIT_INIT") {
                aiState.current = "BATTLE_ATTACK";
                timer.current = 1.0;
                playAnim(getAttackAnimForSkin(skinName));
                playVoiceLine(Math.random() > 0.5 ? "Take that!" : "Hiyah!");
                friendStateRef.current = "BATTLE_HIT_INIT";
                return;
              }
              // Throw something at friend
              else if (params.mayhemMode && distToFriend > 100 && distToFriend < 400 && Math.random() > 0.95 && widgets && widgets.length > 0 && !heldWidgetRef.current) {
                 const w = widgets[Math.floor(Math.random() * widgets.length)];
                 targetWidgetRef.current = w;
                 aiState.current = "WIDGET_MOVE";
                 const ww = window.innerWidth;
                 const hh = window.innerHeight;
                 targetPos.current.set((w.params.x / 100) * ww - ww/2, -(w.params.y / 100) * hh + hh/2, 0);
                 playAnim("Run_A");
                 isMoving = true;
                 return;
              }
            }`;
code = code.replace(idleLogicOriginal, idleLogicNew);

// 5. Add new states inside the if (aiState.current === "WALK") chain
const walkStateFind = `} else if (aiState.current === "WALK") {`;
const walkStateNew = `} else if (aiState.current === "FOLLOW_FRIEND") {
        if (friendPosRef && friendPosRef.current) {
          targetPos.current.copy(friendPosRef.current);
          const dist = currentPos.current.distanceTo(targetPos.current);
          if (dist < 80 || timer.current <= 0) {
            aiState.current = "IDLE";
            playAnim("Idle_A");
            timer.current = 1.0 + Math.random() * 2.0;
            if (dist < 80 && Math.random() > 0.7) {
              playAnim("Cheering");
              playVoiceLine("Hello friend!");
            }
          } else {
            isMoving = true;
          }
        } else {
          aiState.current = "IDLE";
        }
      } else if (aiState.current === "BATTLE_ATTACK") {
        if (timer.current <= 0) {
          aiState.current = "IDLE";
        }
      } else if (aiState.current === "BATTLE_HIT_INIT") {
        aiState.current = "BATTLE_HIT";
        timer.current = 0.5;
        playAnim("Hit_A");
        playVoiceLine(Math.random() > 0.5 ? "Ouch!" : "Hey!");
      } else if (aiState.current === "BATTLE_HIT") {
        if (timer.current <= 0) {
          aiState.current = "BATTLE_ATTACK"; // Retaliate!
          timer.current = 1.0;
          playAnim(getAttackAnimForSkin(skinName));
          playVoiceLine("My turn!");
          if (friendStateRef) friendStateRef.current = "BATTLE_HIT_INIT";
        }
      } else if (aiState.current === "WALK") {`;
code = code.replace(walkStateFind, walkStateNew);

// 6. When throwing a widget, if Mayhem mode is on and friend is targetable, aim for friend!
const throwWidgetFind = `
          aiState.current = "WIDGET_HOLD";
          playAnim("Walking_A");
          const w = window.innerWidth;
          const h = window.innerHeight;
          let bestSpot = new THREE.Vector3(0, 0, 0);
          let maxDist = -1;
`;
const throwWidgetNew = throwWidgetFind + `
          if (params.mayhemMode && friendPosRef && friendPosRef.current) {
            bestSpot.copy(friendPosRef.current);
            maxDist = 9999;
          } else {
`;
// We need to close the else block for the throw target calculation
const throwWidgetEndFind = `          targetPos.current.copy(bestSpot);`;
const throwWidgetEndNew = `          } // End of mayhem check
          targetPos.current.copy(bestSpot);`;
code = code.replace(throwWidgetFind, throwWidgetNew);
code = code.replace(throwWidgetEndFind, throwWidgetEndNew);

// 7. Aim the throw velocity AT the friend!
const throwAimFind = `
          // Short toss velocity!
          throwVelocity.current.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, 0);
`;
const throwAimNew = `
          if (params.mayhemMode && friendPosRef && friendPosRef.current) {
            const dir = new THREE.Vector3().subVectors(friendPosRef.current, currentPos.current).normalize();
            throwVelocity.current.set(dir.x * 20, -dir.y * 20, 0); // Invert Y because of screen coords
          } else {
            throwVelocity.current.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, 0);
          }
`;
code = code.replace(throwAimFind, throwAimNew);

// 8. Add DesktopPet Parent component at the end
code += `

export function DesktopPet(props: DesktopPetProps) {
  const primaryPosRef = useRef(new THREE.Vector3(0, -300, 0));
  const primaryStateRef = useRef<any>("IDLE");

  const companionPosRef = useRef(new THREE.Vector3(150, -300, 0));
  const companionStateRef = useRef<any>("IDLE");

  return (
    <>
       <PetEntity 
          isPrimary={true} 
          myPosRef={primaryPosRef}
          myStateRef={primaryStateRef}
          friendPosRef={props.params.enableCompanion ? companionPosRef : null}
          friendStateRef={props.params.enableCompanion ? companionStateRef : null}
          {...props} 
       />
       {props.params.enableCompanion && (
          <PetEntity 
            isPrimary={false} 
            myPosRef={companionPosRef}
            myStateRef={companionStateRef}
            friendPosRef={primaryPosRef}
            friendStateRef={primaryStateRef}
            {...props} 
          />
       )}
    </>
  );
}
`;

fs.writeFileSync('d:/use after format/allrounder687/.openclaw/apps/openclaw-lwp/src/app/components/DesktopPet.tsx', code);
console.log('Successfully refactored DesktopPet!');
