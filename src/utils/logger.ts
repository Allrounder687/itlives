export const logger = {
  info: (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.info("[INFO]", ...args);
    }
  },
  warn: (...args: any[]) => {
    console.warn("[WARN]", ...args); // Always log warnings
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args); // Always log errors
  },
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[DEBUG]", ...args);
    }
  }
};
