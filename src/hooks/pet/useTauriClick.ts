import { useEffect, useRef } from "react";
import { PetBehavior } from "../../app/components/DesktopPet";

export function useTauriClick(
  behaviorRef: React.MutableRefObject<PetBehavior>,
  isOverlay: boolean,
  handleSingleClick: (x: number, y: number, button: "left" | "right" | "food" | "dance") => void
) {
  const handlerRef = useRef(handleSingleClick);
  useEffect(() => {
    handlerRef.current = handleSingleClick;
  }, [handleSingleClick]);

  useEffect(() => {
    let isMounted = true;
    let unlisten: () => void;

    const setupListener = async () => {
      try {
        if (!isOverlay) {
          const handleClick = (e: MouseEvent) => {
            if ((e.target as HTMLElement).tagName !== "CANVAS") return; // Only track clicks on the actual 3D canvas
            const w = window.innerWidth;
            const h = window.innerHeight;
            let btn: "left" | "right" | "food" | "dance" = "left";
            if (e.button === 1) btn = "food"; // Middle click
            else if (e.button === 2) btn = "right"; // Right click
            handlerRef.current(e.clientX - w / 2, -e.clientY + h / 2, btn);
          };
          window.addEventListener("mousedown", handleClick);
          unlisten = () => window.removeEventListener("mousedown", handleClick);
          return;
        }

        const { listen } = await import("@tauri-apps/api/event");
        if (!isMounted) return;

        unlisten = await listen<{ x: number; y: number; button?: string }>("cursor-click", (e) => {
          let payload = e.payload as any;
          if (typeof payload === "string") {
            try {
              payload = JSON.parse(payload);
            } catch (err) {}
          }
          if (!payload || typeof payload.x !== "number") return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const btn = payload.button === "right" ? "right" : payload.button === "food" ? "food" : payload.button === "dance" ? "dance" : "left";
          
          handlerRef.current(
            payload.x / (window.devicePixelRatio || 1) - w / 2,
            -(payload.y / (window.devicePixelRatio || 1)) + h / 2,
            btn
          );
        });
      } catch (err) {}
    };
    setupListener();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [isOverlay]);
}
