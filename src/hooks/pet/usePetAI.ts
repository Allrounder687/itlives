import { MutableRefObject } from "react";
import * as THREE from "three";
import { PetBehavior } from "../../app/components/DesktopPet";

export interface PetAIParams {
  behavior: PetBehavior;
  aiState: MutableRefObject<string>;
  timer: MutableRefObject<number>;
  danceTimer: MutableRefObject<number>;
  singTimer: MutableRefObject<number>;
  targetPos: MutableRefObject<THREE.Vector3>;
  currentPos: MutableRefObject<THREE.Vector3>;
  cursorTarget: MutableRefObject<{ x: number; y: number } | null>;
  audioVolume: MutableRefObject<number>;
  heldWidgetRef: MutableRefObject<any>;
  targetWidgetRef: MutableRefObject<any>;
  throwVelocity: MutableRefObject<THREE.Vector3>;
  friendPosRef: MutableRefObject<THREE.Vector3> | undefined;
  friendStateRef: MutableRefObject<string> | undefined;
  playAnim: (name: string, duration?: number) => void;
  playVoiceLine: (text: string) => void;
  getAttackAnimForSkin: (skin: string) => string;
  skinName: string;
  names: string[];
  actions: Record<string, any>;
  params: any;
  isOverlay: boolean;
  widgets?: any[];
  triggerPower?: (vfxId: string) => void;
  generateResponse?: (prompt: string, context?: number[]) => Promise<{ text: string, sentiment: string, context: number[] } | null>;
  popPrefetchedResponse?: (category: "wandering" | "widget" | "throwing" | "battle") => { text: string, sentiment: string, context: number[] } | null;
  aiVoiceOnly?: boolean;
  needs?: any;
  feed?: (amount?: number) => void;
  play?: () => void;
  sleep?: () => void;
  foodPos?: THREE.Vector3 | null;
  setFoodPos?: (pos: THREE.Vector3 | null) => void;
  onUpdateParam?: (layerId: string, paramName: string, value: any) => void;
  onRemoveLayer?: (layerId: string) => void;
}

export function usePetAI() {
  const updateAI = (delta: number, p: PetAIParams) => {
    let isMoving = false;
    let targetVec = p.targetPos.current;
    p.timer.current -= delta;

    // Needs override: if a food widget exists, prioritize it!
    if (p.timer.current <= 0 && p.aiState.current !== "SLEEP" && p.aiState.current !== "EATING_WIDGET" && p.aiState.current !== "FOOD_WIDGET_MOVE" && !p.foodPos) {
      if (p.widgets) {
        const foodBowl = p.widgets.find((w: any) => ["food-bowl", "food-pizza", "food-meat"].includes(w.type));
        if (foodBowl) {
          p.targetWidgetRef.current = foodBowl;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const fx = (foodBowl.params.x / 100) * w - w / 2;
          const fy = -(foodBowl.params.y / 100) * h + h / 2;
          
          p.targetPos.current.set(fx, fy, 0);
          p.aiState.current = "FOOD_WIDGET_MOVE";
          p.playAnim("Running_A");
          // Do not return early, allow the state machine below to process the distance check immediately
        }
      }
    }

    // Needs override: low energy forces sleep
    if (p.needs && p.needs.energy < 20 && p.aiState.current !== "SLEEP" && p.aiState.current !== "WIDGET_SLEEP" && !p.foodPos) {
      if (Math.random() > 0.95) {
        p.aiState.current = "SLEEP";
        p.playAnim("Sit_Floor_Idle"); // or sleep
        p.timer.current = 5.0; // sleep for 5 seconds per cycle
        if (p.sleep) p.sleep(); // replenish energy slightly
        return { isMoving: false, targetVec: null };
      }
    }

    // Check for Manual Food (Middle Click Brown Sphere)
    if (p.foodPos && p.setFoodPos && p.aiState.current !== "EATING_WIDGET" && p.aiState.current !== "FOOD_WIDGET_MOVE") {
      const distToFood = p.currentPos.current.distanceTo(p.foodPos);
      if (distToFood > 150) {
        p.aiState.current = "CLICK_MOVE"; // use click move to run to it
        p.targetPos.current.copy(p.foodPos);
        p.playAnim("Running_A");
        return { isMoving: true, targetVec: p.foodPos.clone() };
      } else {
        // Reached food sphere
        p.aiState.current = "CUSTOM";
        p.playAnim("Interact"); // Eat animation
        p.timer.current = 3.0;
        if (p.needs && p.needs.moody) {
           if (p.feed) p.feed(15); 
           if (p.generateResponse) {
             p.generateResponse("I am very moody right now. Refuse to eat the food in front of me with a short sentence.").then(res => {
               if (res && res.text) p.playVoiceLine(res.text);
             });
           }
        } else {
           if (p.feed) p.feed();
           if (p.generateResponse) {
             p.generateResponse("I just ate some yummy food! Say a quick, happy reaction out loud.").then(res => {
               if (res && res.text) p.playVoiceLine(res.text);
             });
           }
        }
        p.setFoodPos(null);
        return { isMoving: false, targetVec: null };
      }
    }

    // Handle Food Widget Eating Logic
    if (p.aiState.current === "FOOD_WIDGET_MOVE") {
      if (p.targetWidgetRef.current) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const fx = (p.targetWidgetRef.current.params.x / 100) * w - w / 2;
        const fy = -(p.targetWidgetRef.current.params.y / 100) * h + h / 2;
        p.targetPos.current.set(fx, fy, 0);
      }

      const dist = p.currentPos.current.distanceTo(p.targetPos.current);
      if (dist > 150) {
        return { isMoving: true, targetVec: p.targetPos.current.clone() };
      } else {
        // Reached widget!
        p.aiState.current = "EATING_WIDGET";
        p.playAnim("Interact"); // Eat animation
        p.timer.current = 3.0;
        return { isMoving: false, targetVec: null };
      }
    } else if (p.aiState.current === "EATING_WIDGET") {
       if (p.targetWidgetRef.current && p.onUpdateParam) {
           // Scale down the widget over 3 seconds
           const baseScale = p.targetWidgetRef.current.params.scale || 1.0;
           const newScale = Math.max(0, baseScale - (delta * 0.33));
           p.onUpdateParam(p.targetWidgetRef.current.id, "scale", newScale);
       }

       if (p.timer.current <= 0) {
         if (p.needs && p.needs.moody) {
           if (p.feed) p.feed(15); 
           if (p.generateResponse) {
             p.generateResponse("I am very moody right now. Refuse to eat the food in front of me with a short sentence.").then(res => {
               if (res && res.text) p.playVoiceLine(res.text);
             });
           }
         } else {
           if (p.feed) p.feed();
           if (p.generateResponse) {
             p.generateResponse("I just ate some yummy food! Say a quick, happy reaction out loud.").then(res => {
               if (res && res.text) p.playVoiceLine(res.text);
             });
           }
         }
         // Remove the widget permanently!
         if (p.targetWidgetRef.current && p.onRemoveLayer) {
           p.onRemoveLayer(p.targetWidgetRef.current.id);
         }
         p.targetWidgetRef.current = null;
         p.aiState.current = "IDLE";
         p.playAnim("Idle_A");
         p.timer.current = 1.0;
       }
       return { isMoving: false, targetVec: null };
    }

    const vol = p.audioVolume.current;

    // Check if music is loud enough to trigger dancing!
    if (vol > 0.05 && !p.aiState.current.startsWith("WIDGET_") && p.aiState.current !== "PUNCH" && p.aiState.current !== "CLICK_MOVE") {
      p.danceTimer.current = 2.0; // Keep dancing 2s after silence
      if (p.aiState.current !== "DANCE") {
        p.aiState.current = "DANCE";
        p.playAnim("Cheering");
        p.singTimer.current = 2.0; // Wait 2s before first line
      } else {
        p.singTimer.current -= delta;
        if (p.singTimer.current <= 0) {
          const singLines = ["La la la!", "Ooh yeah!", "Singing in the rain!", "Drop the beat!"];
          p.playVoiceLine(singLines[Math.floor(Math.random() * singLines.length)]);
          p.singTimer.current = 10.0 + Math.random() * 5.0; // Sing every 10-15s
        }
      }
    } else if (p.aiState.current === "DANCE") {
      p.danceTimer.current -= delta;
      if (p.danceTimer.current <= 0) {
        p.aiState.current = "IDLE";
        p.playAnim("Idle_A");
        p.timer.current = 1.0;
      }
    }

    if (p.behavior === "idle-only") {
      if (p.aiState.current !== "IDLE") {
        p.aiState.current = "IDLE";
        p.playAnim(Math.random() > 0.5 ? "Idle_A" : "Idle_B");
      }
      // Randomly switch idle animations occasionally
      if (p.timer.current <= 0) {
        p.timer.current = 5 + Math.random() * 5;
        const roll = Math.random();
        if (roll > 0.95) p.playAnim("Cheering", 0.5);
        else if (roll > 0.90) p.playAnim("Waving", 0.5);
        else if (roll > 0.85) p.playAnim("Sit_Floor_Down", 0.5);
        else if (roll > 0.80) p.playAnim("Sit_Floor_Idle", 0.5);
        else if (roll > 0.75) p.playAnim("Push_Ups", 0.5);
        else if (roll > 0.70) p.playAnim("Interact", 0.5); // Check ground
        else if (roll > 0.65) p.playAnim("PickUp", 0.5);
        else p.playAnim(Math.random() > 0.5 ? "Idle_A" : "Idle_B", 0.5);
      }
    } else if (p.behavior === "wander") {
      if (p.aiState.current === "IDLE") {
        if (p.timer.current <= 0) {
          const currentHour = new Date().getHours();
          const isSleepTime = currentHour >= 22 || currentHour < 7;
          const isWorkTime = currentHour >= 9 && currentHour < 17;

          if (isSleepTime) {
            // Go to sleep!
            if (p.widgets && p.widgets.length > 0) {
              const wTarget = p.widgets[Math.floor(Math.random() * p.widgets.length)];
              p.targetWidgetRef.current = wTarget;
              const sw = window.innerWidth;
              const sh = window.innerHeight;
              const px = wTarget.params.x || 50;
              const py = wTarget.params.y || 50;
              p.targetPos.current.set((px / 100) * sw - sw / 2, -((py / 100) * sh - sh / 2), 0);
              p.aiState.current = "WIDGET_SLEEP_MOVE";
              p.playAnim("Running_A");
            } else {
              p.aiState.current = "SLEEP";
              p.playAnim("Sit_Floor_Idle");
              p.timer.current = 15.0;
            }
          } else {
            // Work or Play time
            const roll = Math.random();
            const throwChance = isWorkTime ? 0.98 : 0.90;
            const fightChance = isWorkTime ? 0.95 : 0.70;
            const widgetChance = isWorkTime ? 0.70 : 0.40;

            if (roll > throwChance && !p.isOverlay) {
              // Throw a desktop icon
              p.aiState.current = "ICON_MOVE";
              const w = window.innerWidth;
              const h = window.innerHeight;
              p.targetPos.current.set((Math.random() - 0.5) * (w - 100), (Math.random() - 0.5) * (h - 100), 0);
              p.playAnim("Running_A");
            } else if (roll > fightChance && p.triggerPower) {
              // 10% chance (Play) or 5% (Work): Cast a magical power VFX!
              p.aiState.current = "POWER";
              const spellAnims = p.names.filter(n => n.includes("Spellcast") || n.includes("Attack") || n.includes("Summon"));
              const randomSpell = spellAnims.length > 0 ? spellAnims[Math.floor(Math.random() * spellAnims.length)] : "Cheering";
              p.playAnim(randomSpell);
              p.timer.current = p.actions[randomSpell]?.getClip().duration || 2.0;
              if (!p.aiVoiceOnly) p.playVoiceLine("Feel my power!");
              
              const vfxId = Math.random() > 0.5 ? "dark_vfx_1" : "dark_vfx_2";
              setTimeout(() => { p.triggerPower!(vfxId); }, 500); 

            } else if (p.widgets && p.widgets.length > 0 && roll > widgetChance) {
              // Interact with a widget
              const wTarget = p.widgets[Math.floor(Math.random() * p.widgets.length)];
              p.targetWidgetRef.current = wTarget;
              const sw = window.innerWidth;
              const sh = window.innerHeight;
              const px = wTarget.params.x || 50;
              const py = wTarget.params.y || 50;
              const pw = wTarget.params.w || 20;
              const screenX = (px / 100) * sw;
              const screenY = (py / 100) * sh;
              const screenW = (pw / 100) * sw;

              const targetX = screenX + screenW / 2 - sw / 2;
              const targetY = -(screenY - sh / 2) + 15;

              let clampedX = targetX;
              if (clampedX < -sw / 2 + 50) clampedX = -sw / 2 + 50;
              if (clampedX > sw / 2 - 50) clampedX = sw / 2 - 50;

              p.targetPos.current.set(clampedX, targetY, 0);
              p.aiState.current = "WIDGET_MOVE";
              p.playAnim("Running_A");
            } else if (roll > 0.3) {
              // Fun animation in-place
              p.aiState.current = "FUN_ANIM";
              const skip = ["Walk", "Run", "Idle", "Jump", "Dodge", "Death", "Hit", "Defeat", "Spawn"];
              const availableAnims = p.names.filter((n) => !skip.some((s) => n.includes(s)));
              const randomAnim = availableAnims.length > 0 ? availableAnims[Math.floor(Math.random() * availableAnims.length)] : "Cheering";
              p.playAnim(randomAnim);
              p.timer.current = p.actions[randomAnim]?.getClip().duration || 2.0;

              const idleLines = ["Hmm...", "What's over here?", "La la la!", "Bored!", "Stretching time!"];
              const prefetch = p.popPrefetchedResponse ? p.popPrefetchedResponse("wandering") : null;
              
              if (prefetch && prefetch.text) {
                p.playVoiceLine(prefetch.text);
              } else if (!p.aiVoiceOnly && Math.random() > 0.6) {
                p.playVoiceLine(idleLines[Math.floor(Math.random() * idleLines.length)]);
              }
            } else {
              // Walk somewhere new
              const w = window.innerWidth;
              const h = window.innerHeight;
              p.targetPos.current.set((Math.random() - 0.5) * (w - 100), (Math.random() - 0.5) * (h - 100), 0);
              p.aiState.current = "WALK";
              p.playAnim("Walking_A");
            }
          }
        }
      } else if (p.aiState.current === "FOLLOW_FRIEND") {
        if (p.friendPosRef && p.friendPosRef.current) {
          p.targetPos.current.copy(p.friendPosRef.current);
          const dist = p.currentPos.current.distanceTo(p.targetPos.current);
          if (dist < 80 || p.timer.current <= 0) {
            p.aiState.current = "IDLE";
            p.playAnim("Idle_A");
            p.timer.current = 1.0 + Math.random() * 2.0;
            if (dist < 80 && Math.random() > 0.7) {
              p.playAnim("Cheering");
              if (!p.aiVoiceOnly) p.playVoiceLine("Hello friend!");
            }
          } else {
            isMoving = true;
          }
        } else {
          p.aiState.current = "IDLE";
        }
      } else if (p.aiState.current === "FUN_ANIM" || p.aiState.current === "POWER") {
        if (p.timer.current <= 0) {
          p.aiState.current = "IDLE";
        }
      } else if (p.aiState.current === "BATTLE_ATTACK") {
        if (p.timer.current <= 0) {
          p.aiState.current = "IDLE";
        }
      } else if (p.aiState.current === "BATTLE_HIT_INIT") {
        p.aiState.current = "BATTLE_HIT";
        p.timer.current = 0.5;
        p.playAnim("Hit_A");
        if (!p.aiVoiceOnly) p.playVoiceLine(Math.random() > 0.5 ? "Ouch!" : "Hey!");
      } else if (p.aiState.current === "BATTLE_HIT") {
        if (p.timer.current <= 0) {
          p.aiState.current = "BATTLE_ATTACK"; // Retaliate!
          p.timer.current = 1.0;
          p.playAnim(p.getAttackAnimForSkin(p.skinName));
          if (!p.aiVoiceOnly) p.playVoiceLine("My turn!");
          if (p.friendStateRef) p.friendStateRef.current = "BATTLE_HIT_INIT";
        }
      } else if (p.aiState.current === "WALK") {
        const dist = p.currentPos.current.distanceTo(targetVec);
        if (dist < 10) {
          // Reached! Sometimes do a little animation here too
          p.aiState.current = "IDLE";
          const arrivalAnims = ["Idle_A", "Idle_B", "Cheering", "Waving", "Sit_Floor_Down"];
          const pick = arrivalAnims[Math.floor(Math.random() * arrivalAnims.length)];
          p.playAnim(pick);
          p.timer.current = 2 + Math.random() * 6; // wait 2-8 seconds
        } else {
          isMoving = true;
        }
      } else if (p.aiState.current === "WIDGET_MOVE") {
        const dist = p.currentPos.current.distanceTo(targetVec);
        if (dist < 10) {
          const widgetRoll = Math.random();
          if (widgetRoll > 0.75) {
            // 25% chance: pick up and throw the widget
            p.aiState.current = "WIDGET_PICKUP";
            p.heldWidgetRef.current = p.targetWidgetRef.current;
            const anims = p.names.filter((n) => n.includes("Interact") || n.includes("PickUp"));
            p.playAnim(anims.length > 0 ? anims[0] : "Interact");
            p.timer.current = 1.0;
            if (!p.aiVoiceOnly) p.playVoiceLine("Heave!");
          } else {
            // 75% chance: do a fun animation ON the widget (sleep, sit, push-ups, etc.)
            p.aiState.current = "WIDGET_INTERACT";
            // Curated widget interaction animations for maximum variety
            const widgetAnims = [
              "Sit_Floor_Down",
              "Sit_Floor_Idle",
              "Sit_Floor_StandUp",
              "Push_Ups",
              "Cheering",
              "Waving",
              "Interact",
              "PickUp",
              "Melee_Unarmed_Attack_Punch_A",
              "Melee_Unarmed_Attack_Kick",
              "Spellcast_Long",
              "Spellcast_Shoot",
              "Bench_Press",
              "Mining",
              "Chopping",
              "Hammering",
              "Sweeping",
            ];
            // Filter to only animations that actually exist
            const available = widgetAnims.filter((a) => p.actions[a]);
            // Fallback: grab any non-locomotion anim
            const skip = ["Walk", "Run", "Idle", "Jump", "Dodge", "Death", "Hit", "Defeat", "Spawn"];
            const fallback = p.names.filter((n) => !skip.some((s) => n.includes(s)));
            const pool = available.length > 0 ? available : fallback;
            const randomAnim = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : "Push_Ups";
            p.playAnim(randomAnim);
            p.timer.current = (p.actions[randomAnim]?.getClip().duration || 3.0) + 1.0; // Hold it a bit longer

            // Contextual voice lines for widget interactions
            const interactLines = ["Cozy!", "This is my spot now!", "Nap time!", "Working out!", "Mine!", "Let me try this!"];
            const prefetch = p.popPrefetchedResponse ? p.popPrefetchedResponse("widget") : null;

            if (prefetch && prefetch.text) {
              p.playVoiceLine(prefetch.text);
            } else if (!p.aiVoiceOnly) {
              p.playVoiceLine(interactLines[Math.floor(Math.random() * interactLines.length)]);
            }
          }
        } else {
          isMoving = true;
        }
      } else if (p.aiState.current === "WIDGET_PICKUP") {
        if (p.timer.current <= 0) {
          p.aiState.current = "WIDGET_HOLD";
          p.playAnim("Walking_A");
          const w = window.innerWidth;
          const h = window.innerHeight;
          let bestSpot = new THREE.Vector3(0, 0, 0);
          let maxDist = -1;

          if (p.params.mayhemMode && p.friendPosRef && p.friendPosRef.current) {
            bestSpot.copy(p.friendPosRef.current);
            maxDist = 9999;
          } else {
            for (let i = 0; i < 20; i++) {
              const tx = (Math.random() - 0.5) * (w - 200);
              const ty = (Math.random() - 0.5) * (h - 200);
              let minDist = 9999;
              if (p.widgets) {
                p.widgets.forEach((wid) => {
                  const wx = (wid.params.x / 100) * w - w / 2;
                  const wy = -(wid.params.y / 100) * h + h / 2;
                  const d = Math.hypot(tx - wx, ty - wy);
                  if (d < minDist) minDist = d;
                });
              }
              if (minDist > maxDist) {
                maxDist = minDist;
                bestSpot.set(tx, ty, 0);
              }
            }
          } // End of mayhem check
          p.targetPos.current.copy(bestSpot);
          p.playVoiceLine("I'm moving this!");
        }
      } else if (p.aiState.current === "WIDGET_HOLD") {
        const dist = p.currentPos.current.distanceTo(targetVec);

        if (p.heldWidgetRef.current) {
          const percentX = ((p.currentPos.current.x + window.innerWidth / 2) / window.innerWidth) * 100;
          const percentY = (-(p.currentPos.current.y + 80 - window.innerHeight / 2) / window.innerHeight) * 100;
          p.heldWidgetRef.current.params.x = percentX;
          p.heldWidgetRef.current.params.y = percentY;

          const wNode = document.getElementById("widget-" + p.heldWidgetRef.current.id);
          if (wNode) {
            wNode.style.left = `${percentX}%`;
            wNode.style.top = `${percentY}%`;
          }
          window.dispatchEvent(new CustomEvent("widget-move", { detail: { id: p.heldWidgetRef.current.id, x: percentX, y: percentY } }));
        }

        if (dist < 10) {
          p.aiState.current = "WIDGET_THROW";
          const anims = p.names.filter((n) => n.includes("Throw") || n.includes("Punch"));
          p.playAnim(anims.length > 0 ? anims[0] : "Interact");
          p.timer.current = 0.5;
          if (p.params.mayhemMode && p.friendPosRef && p.friendPosRef.current) {
            const dir = new THREE.Vector3().subVectors(p.friendPosRef.current, p.currentPos.current).normalize();
            p.throwVelocity.current.set(dir.x * 20, -dir.y * 20, 0); // Invert Y because of screen coords
          } else {
            p.throwVelocity.current.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, 0);
          }
          p.playVoiceLine("Yeet!");
        } else {
          isMoving = true;
        }
      } else if (p.aiState.current === "WIDGET_THROW") {
        if (p.timer.current <= 0) {
          p.aiState.current = "WIDGET_AIRBORNE";
        }
      } else if (p.aiState.current === "WIDGET_AIRBORNE") {
        const hw = p.heldWidgetRef.current;
        if (hw) {
          const px = (hw.params.x / 100) * window.innerWidth;
          const py = (hw.params.y / 100) * window.innerHeight;

          const nextX = px + p.throwVelocity.current.x;
          const nextY = py - p.throwVelocity.current.y;

          // Friction instead of gravity!
          p.throwVelocity.current.x *= 0.92;
          p.throwVelocity.current.y *= 0.92;

          const speed = Math.sqrt(p.throwVelocity.current.x ** 2 + p.throwVelocity.current.y ** 2);

          if (speed < 0.5 || nextY > window.innerHeight - 50 || nextY < 50 || nextX < 50 || nextX > window.innerWidth - 50) {
            // Landed!
            p.aiState.current = "IDLE";
            p.playAnim("Idle_A");
            p.timer.current = 1.0;
            p.heldWidgetRef.current = null;

            if (p.params.enableCracks !== false) {
              window.dispatchEvent(
                new CustomEvent("pet-punch-crack", {
                  detail: { x: nextX - window.innerWidth / 2, y: -(nextY - window.innerHeight / 2) },
                })
              );
            }

            // Save final position to React state
            window.dispatchEvent(new CustomEvent("widget-update", { detail: { id: hw.id, param: "x", value: (nextX / window.innerWidth) * 100 } }));
            window.dispatchEvent(new CustomEvent("widget-update", { detail: { id: hw.id, param: "y", value: (nextY / window.innerHeight) * 100 } }));
          } else {
            hw.params.x = (nextX / window.innerWidth) * 100;
            hw.params.y = (nextY / window.innerHeight) * 100;

            const wNode = document.getElementById("widget-" + hw.id);
            if (wNode) {
              wNode.style.left = `${hw.params.x}%`;
              wNode.style.top = `${hw.params.y}%`;
            }
            window.dispatchEvent(new CustomEvent("widget-move", { detail: { id: hw.id, x: hw.params.x, y: hw.params.y } }));
          }
        } else {
          p.aiState.current = "IDLE";
        }
      } else if (p.aiState.current === "ICON_MOVE") {
        const dist = p.currentPos.current.distanceTo(targetVec);
        if (dist < 10) {
          p.aiState.current = "ICON_THROW";
          const anims = p.names.filter((n) => n.includes("Spellcast") || n.includes("Throw") || n.includes("Interact"));
          p.playAnim(anims.length > 0 ? anims[Math.floor(Math.random() * anims.length)] : "Interact");
          p.timer.current = 1.0;
          
          const prefetch = p.popPrefetchedResponse ? p.popPrefetchedResponse("throwing") : null;
          if (prefetch && prefetch.text) {
            p.playVoiceLine(prefetch.text);
          } else if (!p.aiVoiceOnly) {
            p.playVoiceLine("Incoming!");
          }
        } else {
          isMoving = true;
        }
      } else if (p.aiState.current === "ICON_THROW") {
        if (p.timer.current <= 0) {
          p.aiState.current = "IDLE";
          p.playAnim("Idle_A");
          p.timer.current = 1.0;
          import("@tauri-apps/api/core").then(({ invoke }) => {
            invoke("invoke_throw_random_desktop_icon").catch(console.error);
          });
        }
      } else if (p.aiState.current === "WIDGET_INTERACT") {
        if (p.timer.current <= 0) {
          p.aiState.current = "IDLE";
        }
      } else if (p.aiState.current === "WIDGET_SLEEP_MOVE") {
        const dist = p.currentPos.current.distanceTo(p.targetPos.current);
        if (dist < 10) {
          p.aiState.current = "WIDGET_SLEEP";
          p.playAnim("Sit_Floor_Idle");
          p.timer.current = 15.0; // Sleep timer cycle
        } else {
          isMoving = true;
        }
      } else if (p.aiState.current === "WIDGET_SLEEP" || p.aiState.current === "SLEEP") {
        const currentHour = new Date().getHours();
        const isSleepTime = currentHour >= 22 || currentHour < 7;
        
        if (!isSleepTime && p.timer.current <= 0) {
          // Wake up!
          p.aiState.current = "IDLE";
          p.playAnim("Idle_A");
          if (!p.aiVoiceOnly) p.playVoiceLine("Yawn... Good morning!");
        } else if (p.timer.current <= 0) {
          // Keep sleeping, occasionally mumble
          if (Math.random() > 0.7 && p.generateResponse) {
             p.generateResponse("I am deeply asleep. Say a very short, cute sleep-talking mumble with Zzz.").then(res => {
               if (res && res.text) p.playVoiceLine(res.text);
             });
          }
          p.timer.current = 20.0;
          p.playAnim("Sit_Floor_Idle");
        }
      } else if (p.aiState.current === "CLICK_MOVE") {
        const dist = p.currentPos.current.distanceTo(targetVec);
        if (dist < 10) {
          // Reached the clicked spot! Do a punch!
          p.aiState.current = "PUNCH";
          p.playAnim("Melee_Unarmed_Attack_Punch_A", 0.2);
          p.timer.current = 1.0; // Punch animation duration

          const hitLines = ["Take that!", "Bam!", "Pow!", "Gotcha!"];
          if (!p.aiVoiceOnly) p.playVoiceLine(hitLines[Math.floor(Math.random() * hitLines.length)]);

          if (p.params.enableCracks !== false) {
            window.dispatchEvent(
              new CustomEvent("pet-punch-crack", {
                detail: { x: targetVec.x, y: targetVec.y },
              })
            );
          }
        } else {
          isMoving = true;
        }
      } else if (p.aiState.current === "PUNCH") {
        // Just wait for timer
        if (p.timer.current <= 0) {
          p.aiState.current = "IDLE";
          p.playAnim("Idle_A");
        }
      }
    } else if (p.behavior === "follow-cursor") {
      if (p.cursorTarget.current) {
        p.targetPos.current.set(p.cursorTarget.current.x, p.cursorTarget.current.y, 0);
        targetVec = p.targetPos.current;
        const dist = p.currentPos.current.distanceTo(targetVec);

        if (dist > 150) {
          if (p.aiState.current !== "RUN") {
            p.aiState.current = "RUN";
            p.playAnim("Running_A");
          }
          isMoving = true;
        } else if (dist > 50) {
          if (p.aiState.current !== "WALK") {
            p.aiState.current = "WALK";
            p.playAnim("Walking_A");
          }
          isMoving = true;
        } else {
          if (p.aiState.current !== "IDLE") {
            p.aiState.current = "IDLE";
            p.playAnim("Idle_A");
          }
        }
      }
    } else {
      // Custom Animation Loop
      if (p.aiState.current !== "CUSTOM") {
        p.aiState.current = "CUSTOM";
        p.playAnim(p.behavior as string, 0.5);
      }
    }

    return { isMoving, targetVec };
  };

  return { updateAI };
}
