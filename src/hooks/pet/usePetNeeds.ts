import { useState, useEffect, useRef } from "react";

export interface PetNeeds {
  hunger: number;
  energy: number;
  affection: number;
  moody: boolean;
}

export function usePetNeeds() {
  const [needs, setNeeds] = useState<PetNeeds>({
    hunger: 100,
    energy: 100,
    affection: 100,
    moody: false,
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      try {
        const stored = localStorage.getItem("pet-needs");
        if (stored) {
          setNeeds(JSON.parse(stored));
        }
      } catch(e) {}
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (initialized.current) {
      localStorage.setItem("pet-needs", JSON.stringify(needs));
    }
  }, [needs]);

  // Decay loop
  useEffect(() => {
    const decayInterval = setInterval(() => {
      setNeeds(prev => {
        let newHunger = Math.max(0, prev.hunger - 1);
        let newEnergy = Math.max(0, prev.energy - 1);
        let newAffection = Math.max(0, prev.affection - 1);
        
        // Randomly get moody if stats are somewhat low
        let isMoody = prev.moody;
        if (newHunger < 40 || newAffection < 40) {
          if (Math.random() > 0.9) isMoody = true;
        }
        if (newHunger > 80 && newAffection > 80) {
          isMoody = false;
        }

        return {
          hunger: newHunger,
          energy: newEnergy,
          affection: newAffection,
          moody: isMoody
        };
      });
    }, 10000); // Needs drop every 10 seconds for testing/gameplay pace.

    return () => clearInterval(decayInterval);
  }, []);

  const feed = (amount?: number) => setNeeds(p => ({ ...p, hunger: amount ? Math.min(100, p.hunger + amount) : 100 }));
  const play = () => setNeeds(p => ({ ...p, affection: 100, energy: Math.max(0, p.energy - 10) }));
  const sleep = () => setNeeds(p => ({ ...p, energy: 100 }));

  return { needs, feed, play, sleep };
}
