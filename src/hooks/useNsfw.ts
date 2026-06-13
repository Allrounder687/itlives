import { useState, useEffect } from 'react';

// Global state outside the hook
let isUnlocked = false;
const listeners = new Set<(val: boolean) => void>();

export const unlockNsfw = () => {
  isUnlocked = true;
  listeners.forEach(l => l(true));
};

export const lockNsfw = () => {
  isUnlocked = false;
  listeners.forEach(l => l(false));
};

export const useNsfw = () => {
  const [unlocked, setUnlocked] = useState(isUnlocked);

  useEffect(() => {
    listeners.add(setUnlocked);
    return () => {
      listeners.delete(setUnlocked);
    };
  }, []);

  return { isUnlocked: unlocked, unlockNsfw, lockNsfw };
};
