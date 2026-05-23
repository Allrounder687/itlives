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

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__brand" data-tauri-drag-region>
        <img src="/favicon.ico" alt="itLives" className="titlebar__icon" />
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
