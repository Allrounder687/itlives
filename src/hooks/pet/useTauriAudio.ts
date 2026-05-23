import { useEffect, useRef } from "react";
import { PetBehavior } from "../../app/components/DesktopPet";

export function useTauriAudio(behavior: PetBehavior, isOverlay: boolean) {
  const audioVolume = useRef(0);

  useEffect(() => {
    let isMounted = true;
    let unlisten: () => void;

    if (behavior !== "follow-cursor") return; // Audio is usually initialized during follow-cursor setup in the original code, but we might want it active always if dancing is allowed

    const setupAudio = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        await invoke("start_audio_capture");
        unlisten = await listen<number[]>("audio-fft", (e) => {
          const data = e.payload;
          if (data && data.length > 0) {
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            audioVolume.current = sum / data.length;
          }
        });
      } catch (err) {}
    };

    setupAudio();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [behavior, isOverlay]);

  return audioVolume;
}
