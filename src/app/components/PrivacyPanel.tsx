import { useState } from "react";

interface PrivacyPanelProps {
  hasAdultPin: boolean;
  isAdultUnlocked: boolean;
  onSetPin: (pin: string | null) => void;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onLock: () => void;
}

export function PrivacyPanel({ hasAdultPin, isAdultUnlocked, onSetPin, onVerifyPin, onLock }: PrivacyPanelProps) {
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const handleSetPin = () => {
    if (pinInput.length < 4) {
      setError("PIN must be at least 4 characters");
      return;
    }
    onSetPin(pinInput);
    setPinInput("");
    setError("");
    setIsChanging(false);
  };

  const handleRemovePin = async () => {
    if (!isAdultUnlocked) {
      if (!pinInput) {
        setError("Enter current PIN to remove");
        return;
      }
      const valid = await onVerifyPin(pinInput);
      if (!valid) {
        setError("Incorrect PIN");
        return;
      }
    }
    onSetPin(null);
    setPinInput("");
    setError("");
  };

  return (
    <div className="panel card" style={{ padding: "16px" }}>
      <div className="card-header" style={{ marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>Privacy & Filtering</h3>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
          Hide sensitive content from your library using a PIN.
        </p>
      </div>

      <div className="card-body">
        {!hasAdultPin || isChanging ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ fontSize: "0.9rem" }}>{hasAdultPin ? "Enter New PIN:" : "Set a PIN:"}</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="password"
                className="input-field"
                placeholder="e.g. 1234"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setError(""); }}
                style={{ flex: 1 }}
              />
              <button className="btn btn--primary" onClick={handleSetPin}>
                Save
              </button>
              {hasAdultPin && (
                <button className="btn btn--secondary" onClick={() => setIsChanging(false)}>
                  Cancel
                </button>
              )}
            </div>
            {error && <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</span>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.9rem", color: isAdultUnlocked ? "var(--success)" : "var(--text)" }}>
                Status: <strong>{isAdultUnlocked ? "Unlocked 🔓" : "Locked 🔒"}</strong>
              </span>
              {isAdultUnlocked && (
                <button className="btn btn--secondary" onClick={onLock} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>
                  Lock Now
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button className="btn btn--secondary" onClick={() => setIsChanging(true)} style={{ flex: 1 }}>
                Change PIN
              </button>
              <div style={{ display: "flex", flex: 1, gap: "5px" }}>
                {!isAdultUnlocked && (
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Current PIN to remove"
                    value={pinInput}
                    onChange={(e) => { setPinInput(e.target.value); setError(""); }}
                    style={{ flex: 1, padding: "4px 8px" }}
                  />
                )}
                <button className="btn btn--danger" onClick={handleRemovePin} style={{ flex: isAdultUnlocked ? 1 : "none" }}>
                  Remove PIN
                </button>
              </div>
            </div>
            {error && <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
