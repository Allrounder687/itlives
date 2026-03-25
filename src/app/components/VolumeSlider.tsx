"use client";

import { useState } from "react";

export function VolumeSlider({ initialVolume, onCommit }: { initialVolume: number, onCommit: (val: number) => void }) {
  const [localVal, setLocalVal] = useState(initialVolume);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <input
        type="range"
        min="0"
        max="100"
        value={localVal}
        onChange={(e) => setLocalVal(parseInt(e.target.value))}
        onMouseUp={() => onCommit(localVal)}
        onTouchEnd={() => onCommit(localVal)}
        style={{
          WebkitAppearance: "none",
          width: "80px",
          height: "4px",
          background: "rgba(255,255,255,0.1)",
          borderRadius: "2px",
          outline: "none",
          cursor: "pointer"
        }}
      />
      <strong>{localVal}%</strong>
    </div>
  );
}
