let coreApiPromise: Promise<typeof import("@tauri-apps/api/core")> | null = null;
let windowApiPromise: Promise<typeof import("@tauri-apps/api/window")> | null = null;
let dialogApiPromise: Promise<typeof import("@tauri-apps/plugin-dialog")> | null = null;

export function getCoreApi() {
  if (!coreApiPromise) {
    coreApiPromise = import("@tauri-apps/api/core");
  }
  return coreApiPromise;
}

export function getWindowApi() {
  if (!windowApiPromise) {
    windowApiPromise = import("@tauri-apps/api/window");
  }
  return windowApiPromise;
}

export function getDialogApi() {
  if (!dialogApiPromise) {
    dialogApiPromise = import("@tauri-apps/plugin-dialog");
  }
  return dialogApiPromise;
}
