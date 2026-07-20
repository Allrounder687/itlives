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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button
          type="button"
          className="titlebar__button"
          onClick={() => withWindow((appWindow) => appWindow.toggleMaximize())}
          aria-label="Toggle maximize"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
        </button>
        <button
          type="button"
          className="titlebar__button titlebar__button--danger"
          onClick={() => withWindow((appWindow) => appWindow.close())}
          aria-label="Close window"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </header>
  );
}
