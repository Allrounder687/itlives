import { useEffect, useRef } from "react";
import { PetBehavior } from "../../app/components/DesktopPet";

export function useTauriCursor(behavior: PetBehavior, isOverlay: boolean) {
  const cursorTarget = useRef<{ x: number; y: number } | null>(null);

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
            cursorTarget.current = { x: e.clientX - w / 2, y: -e.clientY + h / 2 };
          };
          window.addEventListener("mousemove", handleMove);
          unlisten = () => window.removeEventListener("mousemove", handleMove);
          return;
        }

        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        unlisten = await listen<{ x: number; y: number }>("cursor-moved", (e) => {
          let payload = e.payload as any;
          if (typeof payload === "string") {
            try {
              payload = JSON.parse(payload);
            } catch (err) {}
          }
          if (!payload || typeof payload.x !== "number") return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          cursorTarget.current = {
            x: payload.x / (window.devicePixelRatio || 1) - w / 2,
            y: -(payload.y / (window.devicePixelRatio || 1)) + h / 2,
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

  return cursorTarget;
}
