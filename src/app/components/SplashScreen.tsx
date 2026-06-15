"use client";
import React, { useState, useEffect } from "react";

const HINTS = [
  "Tip: You can set any .mp4 file as a live wallpaper from the Library tab.",
  "Tip: Need more sources? Install community scrapers from the Addons Marketplace.",
  "Tip: The Effects Editor lets you apply real-time WebGL shaders to your wallpaper.",
  "Tip: Press Ctrl+Shift+W to toggle the mini-player.",
  "Tip: Parallax Engine lets you create immersive 3D depth from 2D images."
];

export function SplashScreen() {
  const [hint, setHint] = useState("");

  useEffect(() => {
    const idx = Math.floor(Math.random() * HINTS.length);
    setHint(HINTS[idx]);
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh", width: "100vw",
      alignItems: "center", justifyContent: "center", background: "#000",
      color: "#fff", fontFamily: "sans-serif"
    }}>
      <div style={{ marginBottom: "2rem" }}>
        <div className="loader"></div>
      </div>
      <h2 style={{ fontSize: "24px", margin: "0 0 16px 0", letterSpacing: "2px", fontWeight: 300 }}>
        IT LIVES
      </h2>
      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", maxWidth: "400px", textAlign: "center", lineHeight: "1.6", minHeight: "20px" }}>
        {hint}
      </p>
    </div>
  );
}
