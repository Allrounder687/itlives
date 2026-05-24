import { useEffect, useRef, useState, useCallback } from "react";
import { useOllama } from "./useOllama";
import { PetNeeds } from "./usePetNeeds";
import { invoke } from "@tauri-apps/api/core";

export type PrefetchCategory = "wandering" | "widget" | "throwing" | "battle";

export interface PrefetchedLine {
  text: string;
  sentiment: string;
  context: number[];
}

export function useOllamaPrefetch(needs: PetNeeds) {
  const { generateResponse } = useOllama();
  
  const [buckets, setBuckets] = useState<Record<PrefetchCategory, PrefetchedLine[]>>({
    wandering: [],
    widget: [],
    throwing: [],
    battle: []
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      try {
        const stored = localStorage.getItem("pet-ollama-buckets");
        if (stored) {
          setBuckets(JSON.parse(stored));
        }
      } catch(e) {}
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (initialized.current) {
      localStorage.setItem("pet-ollama-buckets", JSON.stringify(buckets));
    }
  }, [buckets]);

  const isGenerating = useRef<boolean>(false);
  const needsRef = useRef(needs);
  useEffect(() => { needsRef.current = needs; }, [needs]);

  useEffect(() => {
    const refillInterval = setInterval(async () => {
      if (isGenerating.current || !initialized.current) return;
      
      let targetCategory: PrefetchCategory | null = null;
      let prompt = "";
      
      // Target 4 lines per category
      if (buckets.wandering.length < 4) {
        targetCategory = "wandering";
        prompt = "You are wandering around my desktop screen. ";
      } else if (buckets.widget.length < 4) {
        targetCategory = "widget";
        prompt = "You just found a desktop widget and you're interacting with it. Say a quick reaction. ";
      } else if (buckets.throwing.length < 4) {
        targetCategory = "throwing";
        prompt = "You are about to pick up one of my desktop icons and throw it across the screen! Say a mischievous 1-sentence warning. ";
      } else if (buckets.battle.length < 4) {
        targetCategory = "battle";
        prompt = "You are in a playful battle! Say a confident 1-sentence taunt. ";
      }

      if (targetCategory) {
        isGenerating.current = true;
        try {
          // Get Window Context
          let windowContext = "";
          try {
            const winInfo: any = await invoke("get_active_window");
            if (winInfo && winInfo.title && winInfo.process_name) {
              const lowerTitle = winInfo.title.toLowerCase();
              if (!lowerTitle.includes("incognito") && !lowerTitle.includes("inprivate") && !lowerTitle.includes("private browsing")) {
                 windowContext = `The user is currently using the app "${winInfo.process_name}" with the window title "${winInfo.title}". You can make a snarky or encouraging comment about it. `;
              }
            }
          } catch(e) {}

          // Get Needs Context
          const currentNeeds = needsRef.current;
          const needsContext = `Your stats: Hunger=${Math.round(currentNeeds.hunger)}/100, Energy=${Math.round(currentNeeds.energy)}/100, Affection=${Math.round(currentNeeds.affection)}/100. `;
          let moodContext = "";
          if (currentNeeds.moody) moodContext = "You are very moody right now, so act grumpy or sassy. ";
          if (currentNeeds.hunger < 30) moodContext += "You are starving! Complain about being hungry. ";
          if (currentNeeds.energy < 20) moodContext += "You are exhausted and sleepy. ";
          if (currentNeeds.affection < 30) moodContext += "You are feeling lonely. ";

          const finalPrompt = `${needsContext}${moodContext}${windowContext}${prompt} Keep your response to a single, very short sentence out loud.`;

          const res = await generateResponse(finalPrompt);
          if (res && res.text && !res.text.includes("[System Error]")) {
            setBuckets(prev => {
              // Deduplicate to avoid repeating the exact same line
              if (prev[targetCategory!].find(l => l.text === res.text)) {
                return prev;
              }
              return {
                ...prev,
                [targetCategory!]: [...prev[targetCategory!], res]
              };
            });
          }
        } catch(e) {}
        isGenerating.current = false;
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(refillInterval);
  }, [buckets, generateResponse]);

  const popPrefetchedResponse = useCallback((category: PrefetchCategory): PrefetchedLine | null => {
    let popped: PrefetchedLine | null = null;
    
    setBuckets(prev => {
      if (prev[category].length > 0) {
        popped = prev[category][0];
        return {
          ...prev,
          [category]: prev[category].slice(1)
        };
      }
      return prev;
    });

    return popped;
  }, []);

  return { popPrefetchedResponse, buckets };
}
