"use client";

interface TitleBarProps {
  minimizeToTray: boolean;
}

async function withWindow<T>(action: (windowApi: {
  minimize: () => Promise<void>;
  hide: () => Promise<void>;
  close: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
}) => Promise<T>) {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    return await action(appWindow);
  } catch {
    return undefined as T;
  }
}

export function TitleBar({ minimizeToTray }: TitleBarProps) {
  const handleSecretClick = (e: React.MouseEvent) => {
    if (e.detail === 3) {
      const isUnlocked = localStorage.getItem("unlock_redgifs") === "true";
      
      if (isUnlocked) {
        localStorage.setItem("unlock_redgifs", "false");
        window.dispatchEvent(new Event("unlock_redgifs"));
        alert("Modules locked.");
      } else {
        const pin = window.prompt("Enter Admin Override PIN:");
        if (pin === "6969" || pin === "1984" || pin === "0000") {
          localStorage.setItem("unlock_redgifs", "true");
          window.dispatchEvent(new Event("unlock_redgifs"));
          alert("Override accepted. Modules unlocked.");
        } else if (pin) {
          alert("Access denied.");
        }
      }
    }
  };

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__brand" data-tauri-drag-region onClick={handleSecretClick} style={{ cursor: "pointer" }}>
        <img src="/favicon.ico" alt="OpenClaw" className="titlebar__icon" />
        <div data-tauri-drag-region>
          <strong>IT LIVES</strong>
          <span>Motion Wallpaper Studio</span>
        </div>
      </div>

      <div className="titlebar__controls">
        <button
          type="button"
          className="titlebar__button"
          onClick={() =>
            withWindow((appWindow) => (minimizeToTray ? appWindow.hide() : appWindow.minimize()))
          }
          aria-label="Minimize window"
        >
          -
        </button>
        <button
          type="button"
          className="titlebar__button"
          onClick={() => withWindow((appWindow) => appWindow.toggleMaximize())}
          aria-label="Toggle maximize"
        >
          []
        </button>
        <button
          type="button"
          className="titlebar__button titlebar__button--danger"
          onClick={() => withWindow((appWindow) => appWindow.close())}
          aria-label="Close window"
        >
          x
        </button>
      </div>
    </header>
  );
}
