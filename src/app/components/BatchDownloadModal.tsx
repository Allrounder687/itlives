import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";

interface BatchProgress {
  current: number;
  total: number;
  current_url: string;
  status: string;
}

interface BatchDownloadModalProps {
  collectionUrl: string;
  collectionName: string;
  onClose: () => void;
}

export function BatchDownloadModal({ collectionUrl, collectionName, onClose }: BatchDownloadModalProps) {
  const [downloadPath, setDownloadPath] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [amountType, setAmountType] = useState<"all" | "custom">("all");
  const [customAmount, setCustomAmount] = useState<number>(50);
  const [progress, setProgress] = useState<BatchProgress | null>(null);

  useEffect(() => {
    let unlisten: () => void;
    
    listen<BatchProgress>("batch-download-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.status === "Completed" || event.payload.status === "Cancelled") {
        setIsDownloading(false);
      }
    }).then((f) => {
      unlisten = f;
    });

    return () => {
      if (unlisten) unlisten();
      // Ensure we stop background if unmounted
      if (isDownloading) {
        invoke("cancel_batch_download");
      }
    };
  }, [isDownloading]);

  const handleSelectDir = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Download Destination"
    });
    if (selected && typeof selected === "string") {
      setDownloadPath(selected);
    }
  };

  const startDownload = async () => {
    if (!downloadPath) {
      alert("Please select a download destination.");
      return;
    }
    setIsDownloading(true);
    setProgress({ current: 0, total: amountType === "custom" ? customAmount : 0, current_url: "", status: "Initializing..." });
    try {
      await invoke("start_wallhaven_batch_download", {
        collectionUrl,
        targetDir: downloadPath,
        maxCount: amountType === "custom" ? customAmount : null
      });
    } catch (e) {
      console.error(e);
      alert("Error starting batch download: " + e);
      setIsDownloading(false);
    }
  };

  const cancelDownload = async () => {
    await invoke("cancel_batch_download");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: "450px" }}>
        <div className="modal-header">
          <h2>Batch Download Collection</h2>
          {!isDownloading && <button className="modal-close" onClick={onClose}>✕</button>}
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          <div style={{ background: "rgba(255,255,255,0.05)", padding: "12px", borderRadius: "8px" }}>
            <span style={{ fontSize: "12px", opacity: 0.6, display: "block", marginBottom: "4px" }}>Source Collection</span>
            <strong style={{ color: "var(--accent)" }}>{collectionName}</strong>
          </div>

          {!isDownloading ? (
            <>
              <div className="field">
                <span className="field__label">Download Destination</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" className="input input--hud" readOnly value={downloadPath || "No folder selected"} style={{ flex: 1, opacity: downloadPath ? 1 : 0.5 }} />
                  <button className="action-btn action-btn--secondary" onClick={handleSelectDir}>Browse</button>
                </div>
              </div>

              <div className="field">
                <span className="field__label">Amount to Download</span>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                    <input type="radio" checked={amountType === "all"} onChange={() => setAmountType("all")} />
                    Entire Collection
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                    <input type="radio" checked={amountType === "custom"} onChange={() => setAmountType("custom")} />
                    Custom Amount
                  </label>
                </div>
                {amountType === "custom" && (
                  <div style={{ marginTop: "10px" }}>
                    <input 
                      type="number" 
                      className="input input--hud" 
                      min="1" 
                      value={customAmount} 
                      onChange={(e) => setCustomAmount(parseInt(e.target.value) || 1)}
                      style={{ width: "100px" }}
                    />
                    <span style={{ fontSize: "11px", opacity: 0.6, marginLeft: "8px" }}>images</span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: "11px", color: "var(--text-soft)", background: "rgba(255,165,0,0.1)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255,165,0,0.2)" }}>
                <strong>⚠️ Rate Limit Notice:</strong> Wallhaven restricts API calls. This downloader will automatically pause between images to prevent your IP from being banned. Large collections may take significant time.
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", padding: "10px 0" }}>
              {progress?.current_url && (
                <div style={{ width: "100%", height: "140px", borderRadius: "8px", overflow: "hidden", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={progress.current_url} alt="Downloading..." style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>
              )}
              
              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--accent)" }}>{progress?.status}</span>
                  <span>{progress?.current || 0} / {progress?.total || "?"}</span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ 
                    height: "100%", 
                    background: "var(--accent)", 
                    width: progress?.total ? `${((progress.current / progress.total) * 100)}%` : "0%",
                    transition: "width 0.3s ease" 
                  }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          {!isDownloading ? (
            <>
              <button className="action-btn action-btn--ghost" onClick={onClose}>Cancel</button>
              <button className="action-btn action-btn--primary" onClick={startDownload} disabled={!downloadPath}>Start Batch Download</button>
            </>
          ) : (
            <>
              {(progress?.status === "Completed" || progress?.status === "Cancelled") ? (
                <button className="action-btn action-btn--primary" onClick={onClose}>Close</button>
              ) : (
                <button className="action-btn action-btn--secondary" onClick={cancelDownload}>Abort Download</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
