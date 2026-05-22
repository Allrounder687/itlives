import React from "react";

interface ThemeOption {
  id: string;
  name: string;
  colors: string[];
}

const THEMES: ThemeOption[] = [
  { id: "master-system", name: "Master System", colors: ["#07110a", "#9ae600"] },
  { id: "ocean-blue", name: "Ocean Blue", colors: ["#0d1117", "#2f81f7"] },
  { id: "cyberpunk", name: "Night City", colors: ["#0d021f", "#ff00bb"] },
  { id: "nordic-frost", name: "Nordic Frost", colors: ["#0b1116", "#88c0d0"] },
  { id: "midnight-haze", name: "Midnight Haze", colors: ["#05060d", "#6f00ff"] },
  { id: "solarized-dark", name: "Solarized", colors: ["#001e26", "#b58900"] },
];

interface ThemeSelectorProps {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, onThemeChange }) => {
  return (
    <div className="automation-group">
      <div className="group-head">
        <span className="eyebrow">Aesthetic & Interface</span>
        <h4>Workspace Theme</h4>
      </div>
      
      <div className="theme-grid" style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", 
        gap: "10px",
        marginTop: "12px"
      }}>
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => onThemeChange(t.id)}
            className={`theme-card ${currentTheme === t.id ? "active" : ""}`}
            style={{
              padding: "12px",
              borderRadius: "14px",
              border: "1px solid var(--panel-stroke)",
              background: currentTheme === t.id ? "var(--bg-strong)" : "rgba(255,255,255,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              textAlign: "left",
              borderColor: currentTheme === t.id ? "var(--accent)" : "transparent",
              boxShadow: currentTheme === t.id ? "var(--glow)" : "none"
            }}
          >
            <div style={{ display: "flex", gap: "4px" }}>
              {t.colors.map(c => (
                <div key={c} style={{ width: "16px", height: "16px", borderRadius: "50%", background: c, border: "1px solid rgba(255,255,255,0.1)" }} />
              ))}
            </div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: currentTheme === t.id ? "var(--accent)" : "var(--text-soft)" }}>
              {t.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
