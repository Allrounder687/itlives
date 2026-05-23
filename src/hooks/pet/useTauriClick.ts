import { useEffect, useRef } from "react";
import { PetBehavior } from "../../app/components/DesktopPet";

export function useTauriClick(
  behaviorRef: React.MutableRefObject<PetBehavior>,
  isOverlay: boolean,
  handleSingleClick: (x: number, y: number) => void
) {
  useEffect(() => {
    let isMounted = true;
    let unlisten: () => void;
    let lastClickTime = 0;

    const setupListener = async () => {
      try {
        if (!isOverlay) {
          const handleClick = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastClickTime > 400) {
              const w = window.innerWidth;
              const h = window.innerHeight;
              handleSingleClick(e.clientX - w / 2, -e.clientY + h / 2);
              lastClickTime = now;
            }
          };
          window.addEventListener("click", handleClick);
          unlisten = () => window.removeEventListener("click", handleClick);
          return;
        }

        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        unlisten = await listen<{ x: number; y: number }>("cursor-click", (e) => {
          const now = Date.now();
          if (now - lastClickTime > 400) {
            let payload = e.payload as any;
            if (typeof payload === "string") {
              try {
                payload = JSON.parse(payload);
              } catch (err) {}
            }
            if (!payload || typeof payload.x !== "number") return;
            const w = window.innerWidth;
            const h = window.innerHeight;
            handleSingleClick(
              payload.x / (window.devicePixelRatio || 1) - w / 2,
              -(payload.y / (window.devicePixelRatio || 1)) + h / 2
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
  }, [isOverlay, handleSingleClick]);
}
