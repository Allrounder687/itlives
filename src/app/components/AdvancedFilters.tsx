import { useState, useRef, useEffect, memo } from "react";
import { useNsfw } from "@/hooks/useNsfw";

interface AdvancedFiltersProps {
  resolutionFilter?: string | null;
  ratioFilter?: string | null;
  colorFilter?: string | null;
  categoriesFilter?: string | null;
  purityFilter?: string | null;
  onResolutionChange: (res: string | null) => void;
  onRatioChange: (ratio: string | null) => void;
  onColorChange: (color: string | null) => void;
  onCategoriesChange?: (categories: string) => void;
  onPurityChange?: (purity: string) => void;
  showColorFilter?: boolean;
}

const COLORS = [
  { name: "Clear", hex: "transparent", value: "" },
  { name: "Red", hex: "#cc3333", value: "cc3333" },
  { name: "Pink", hex: "#ea4c88", value: "ea4c88" },
  { name: "Purple", hex: "#993399", value: "993399" },
  { name: "Blue", hex: "#0066cc", value: "0066cc" },
  { name: "Light Blue", hex: "#0099cc", value: "0099cc" },
  { name: "Teal", hex: "#66cccc", value: "66cccc" },
  { name: "Green", hex: "#669900", value: "669900" },
  { name: "Lime", hex: "#77cc33", value: "77cc33" },
  { name: "Yellow", hex: "#ffff00", value: "ffff00" },
  { name: "Gold", hex: "#ffcc33", value: "ffcc33" },
  { name: "Orange", hex: "#ff9900", value: "ff9900" },
  { name: "Dark Orange", hex: "#ff6600", value: "ff6600" },
  { name: "Brown", hex: "#663300", value: "663300" },
  { name: "Black", hex: "#000000", value: "000000" },
  { name: "Dark Gray", hex: "#424153", value: "424153" },
  { name: "Gray", hex: "#999999", value: "999999" },
  { name: "Light Gray", hex: "#cccccc", value: "cccccc" },
  { name: "White", hex: "#ffffff", value: "ffffff" },
];

const RATIO_GROUPS = [
  {
    title: "Wide",
    items: ["16x9", "16x10"]
  },
  {
    title: "Ultrawide",
    items: ["21x9", "32x9", "48x9"]
  },
  {
    title: "Portrait",
    items: ["9x16", "10x16", "9x18"]
  },
  {
    title: "Square",
    items: ["1x1", "3x2", "4x3", "5x4"]
  }
];

const RESOLUTION_GROUPS = [
  {
    title: "Ultrawide",
    items: ["2560x1080", "3440x1440", "3840x1600"]
  },
  {
    title: "16:9",
    items: ["1280x720", "1600x900", "1920x1080", "2560x1440", "3840x2160"]
  },
  {
    title: "16:10",
    items: ["1280x800", "1600x1000", "1920x1200", "2560x1600", "3840x2400"]
  },
  {
    title: "4:3",
    items: ["1280x960", "1600x1200", "1920x1440", "2560x1920", "3840x2880"]
  },
  {
    title: "5:4",
    items: ["1280x1024", "1600x1280", "1920x1536", "2560x2048", "3840x3072"]
  }
];

export const AdvancedFilters = memo(function AdvancedFilters({
  resolutionFilter,
  ratioFilter,
  colorFilter,
  categoriesFilter = "111",
  purityFilter = "100",
  onResolutionChange,
  onRatioChange,
  onColorChange,
  onCategoriesChange,
  onPurityChange,
  showColorFilter = false,
}: AdvancedFiltersProps) {
  const { isUnlocked } = useNsfw();
  const [activeDropdown, setActiveDropdown] = useState<"resolution" | "ratio" | "color" | "categories" | "purity" | null>(null);
  const [resolutionMode, setResolutionMode] = useState<"atleast" | "exactly">("exactly");
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = (key: "resolution" | "ratio" | "color" | "categories" | "purity") => {
    setActiveDropdown(activeDropdown === key ? null : key);
  };

  const handleResClick = (res: string) => {
    onResolutionChange(resolutionMode === "atleast" ? `>=${res}` : res);
    setActiveDropdown(null);
  };

  const handleCustomRes = () => {
    if (customW && customH) {
      handleResClick(`${customW}x${customH}`);
    }
  };

  const handleRatioClick = (ratio: string) => {
    onRatioChange(ratio);
    setActiveDropdown(null);
  };

  const toggleCategoryBit = (index: number) => {
    if (!onCategoriesChange) return;
    const current = (categoriesFilter || "111").padEnd(3, '1');
    const chars = current.split('');
    chars[index] = chars[index] === '1' ? '0' : '1';
    onCategoriesChange(chars.join(''));
  };

  const togglePurityBit = (index: number) => {
    if (!onPurityChange) return;
    const current = (purityFilter || "100").padEnd(3, '0');
    const chars = current.split('');
    chars[index] = chars[index] === '1' ? '0' : '1';
    onPurityChange(chars.join(''));
  };

  return (
    <div className="wh-filters-container" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginBottom: "12px" }} ref={dropdownRef}>
      
      {/* RESOLUTION BUTTON */}
      <div style={{ position: "relative" }}>
        <button 
          className={`action-btn ${activeDropdown === "resolution" ? "action-btn--primary" : "action-btn--ghost"}`}
          onClick={() => toggleDropdown("resolution")}
          style={{ padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          {resolutionFilter ? `Res: ${resolutionFilter.replace('>=', '≥ ')}` : "Resolution"} ▾
        </button>

        {activeDropdown === "resolution" && (
          <div className="wh-dropdown" style={dropdownStyle}>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "4px", padding: "2px", marginBottom: "12px" }}>
              <button 
                style={{ flex: 1, padding: "6px", fontSize: "11px", borderRadius: "3px", background: resolutionMode === "atleast" ? "rgba(255,255,255,0.15)" : "transparent", color: "white", cursor: "pointer", border: "none" }}
                onClick={() => setResolutionMode("atleast")}
              >+ At Least</button>
              <button 
                style={{ flex: 1, padding: "6px", fontSize: "11px", borderRadius: "3px", background: resolutionMode === "exactly" ? "rgba(255,255,255,0.15)" : "transparent", color: "white", cursor: "pointer", border: "none" }}
                onClick={() => setResolutionMode("exactly")}
              >◎ Exactly</button>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              {RESOLUTION_GROUPS.map(group => (
                <div key={group.title} style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                  <div style={{ fontSize: "10px", color: "var(--text-soft)", fontWeight: 600, textAlign: "center", marginBottom: "4px" }}>{group.title}</div>
                  {group.items.map(res => (
                    <button 
                      key={res}
                      onClick={() => handleResClick(res)}
                      style={gridBtnStyle((resolutionFilter === res || resolutionFilter === `>=${res}`))}
                    >
                      {res.replace('x', ' × ')}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", marginTop: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-soft)", background: "rgba(255,255,255,0.05)", fontWeight: 600 }}>Custom</div>
              <input type="number" placeholder="Width" value={customW} onChange={e => setCustomW(e.target.value)} style={inputStyle} />
              <div style={{ padding: "8px", fontSize: "11px", color: "var(--text-soft)" }}>×</div>
              <input type="number" placeholder="Height" value={customH} onChange={e => setCustomH(e.target.value)} style={inputStyle} />
              <button onClick={handleCustomRes} style={{ padding: "0 12px", background: "var(--accent)", color: "#000", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "11px" }}>Apply</button>
            </div>
            
            {resolutionFilter && (
              <button 
                onClick={() => { onResolutionChange(null); setActiveDropdown(null); }}
                style={{ width: "100%", padding: "8px", marginTop: "12px", background: "rgba(255,0,0,0.1)", color: "#ff6b6b", border: "1px solid rgba(255,0,0,0.2)", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
              >Clear Resolution Filter</button>
            )}
          </div>
        )}
      </div>

      {/* RATIO BUTTON */}
      <div style={{ position: "relative" }}>
        <button 
          className={`action-btn ${activeDropdown === "ratio" ? "action-btn--primary" : "action-btn--ghost"}`}
          onClick={() => toggleDropdown("ratio")}
          style={{ padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          {ratioFilter ? `Ratio: ${ratioFilter}` : "Ratio"} ▾
        </button>

        {activeDropdown === "ratio" && (
          <div className="wh-dropdown" style={{...dropdownStyle, minWidth: "300px"}}>
            <div style={{ display: "flex", gap: "12px" }}>
              {RATIO_GROUPS.map(group => (
                <div key={group.title} style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                  <div style={{ fontSize: "10px", color: "var(--text-soft)", fontWeight: 600, textAlign: "center", marginBottom: "4px" }}>{group.title}</div>
                  {group.items.map(ratio => (
                    <button 
                      key={ratio}
                      onClick={() => handleRatioClick(ratio)}
                      style={gridBtnStyle(ratioFilter === ratio)}
                    >
                      {ratio.replace('x', ' × ')}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            
            {ratioFilter && (
              <button 
                onClick={() => { onRatioChange(null); setActiveDropdown(null); }}
                style={{ width: "100%", padding: "8px", marginTop: "12px", background: "rgba(255,0,0,0.1)", color: "#ff6b6b", border: "1px solid rgba(255,0,0,0.2)", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}
              >Clear Ratio Filter</button>
            )}
          </div>
        )}
      </div>

      {/* COLOR BUTTON */}
      {showColorFilter && (
      <div style={{ position: "relative" }}>
        <button 
          className={`action-btn ${activeDropdown === "color" || colorFilter ? "action-btn--primary" : "action-btn--ghost"}`}
          onClick={() => toggleDropdown("color")}
          style={{ padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          {colorFilter ? (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              Color: <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: `#${colorFilter}` }} />
            </div>
          ) : "Color ▾"}
        </button>

        {activeDropdown === "color" && (
          <div className="wh-dropdown" style={{...dropdownStyle, minWidth: "220px"}}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onClick={() => { onColorChange(c.value === "" ? null : c.value); setActiveDropdown(null); }}
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: c.hex,
                    border: colorFilter === c.value ? "2px solid var(--accent)" : "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: colorFilter === c.value ? "0 0 8px var(--accent)" : "none"
                  }}
                >
                  {c.value === "" && <div style={{ width: "100%", height: "2px", background: "red", transform: "rotate(45deg)", position: "absolute" }} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* CATEGORIES BUTTON */}
      {onCategoriesChange && (
        <div style={{ position: "relative" }}>
          <button 
            className={`action-btn ${activeDropdown === "categories" || (categoriesFilter && categoriesFilter !== "111") ? "action-btn--primary" : "action-btn--ghost"}`}
            onClick={() => toggleDropdown("categories")}
            style={{ padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            Categories ▾
          </button>

          {activeDropdown === "categories" && (
            <div className="wh-dropdown" style={{...dropdownStyle, minWidth: "150px"}}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button 
                  onClick={() => toggleCategoryBit(0)}
                  style={gridBtnStyle((categoriesFilter || "111")[0] === '1')}
                >General</button>
                <button 
                  onClick={() => toggleCategoryBit(1)}
                  style={gridBtnStyle((categoriesFilter || "111")[1] === '1')}
                >Anime</button>
                <button 
                  onClick={() => toggleCategoryBit(2)}
                  style={gridBtnStyle((categoriesFilter || "111")[2] === '1')}
                >People</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PURITY BUTTON */}
      {onPurityChange && (
        <div style={{ position: "relative" }}>
          <button 
            className={`action-btn ${activeDropdown === "purity" || (purityFilter && purityFilter !== "100") ? "action-btn--primary" : "action-btn--ghost"}`}
            onClick={() => toggleDropdown("purity")}
            style={{ padding: "6px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            Purity ▾
          </button>

          {activeDropdown === "purity" && (
            <div className="wh-dropdown" style={{...dropdownStyle, minWidth: "150px"}}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button 
                  onClick={() => togglePurityBit(0)}
                  style={gridBtnStyle((purityFilter || "100")[0] === '1')}
                >SFW</button>
                <button 
                  onClick={() => togglePurityBit(1)}
                  style={gridBtnStyle((purityFilter || "100")[1] === '1')}
                >Sketchy</button>
                {isUnlocked && (
                  <button 
                    onClick={() => togglePurityBit(2)}
                    style={gridBtnStyle((purityFilter || "100")[2] === '1')}
                  >NSFW</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
});

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: "8px",
  background: "rgba(20,20,20,0.95)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  padding: "16px",
  minWidth: "500px",
  zIndex: 100,
  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  animation: "slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
};

const gridBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "var(--accent)" : "rgba(255,255,255,0.05)",
  color: active ? "#000" : "var(--text-soft)",
  border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.1)",
  borderRadius: "4px",
  padding: "6px",
  fontSize: "11px",
  cursor: "pointer",
  textAlign: "center",
  fontWeight: active ? 700 : 500,
  transition: "all 0.15s ease",
  width: "100%"
});

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "white",
  padding: "8px",
  width: "60px",
  fontSize: "11px",
  textAlign: "center",
  outline: "none"
};
