"use client";
import React, { useState, useEffect } from "react";

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem("openclaw_onboarded");
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, []);

  const handleFinish = () => {
    localStorage.setItem("openclaw_onboarded", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const steps = [
    {
      title: "Welcome to It Lives",
      content: "We've built It Lives to be barebones and highly customizable. Out of the box, it's just an engine. It's up to you to add content.",
      icon: "👋"
    },
    {
      title: "Local Media",
      content: "Want to use your own videos? Go to the Library tab and click 'Import Local Media' to set any .mp4 as your live wallpaper.",
      icon: "📁"
    },
    {
      title: "Interactive Effects",
      content: "Open the Effects Editor tab to apply real-time WebGL shaders (like CRT, VHS, or Bloom) to any wallpaper you have loaded.",
      icon: "✨"
    },
    {
      title: "Addons Marketplace",
      content: "Need more content? Visit the Addons tab to install community-built scrapers for Pinterest, Wallhaven, and live video feeds.",
      icon: "📦"
    }
  ];

  const current = steps[step];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
      display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999999
    }}>
      <div style={{
        background: "var(--panel-bg)", padding: "40px", borderRadius: "16px",
        maxWidth: "500px", width: "90%", border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)", textAlign: "center"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>{current.icon}</div>
        <h2 style={{ margin: "0 0 16px 0", color: "#fff" }}>{current.title}</h2>
        <p style={{ color: "var(--text-soft)", lineHeight: "1.6", marginBottom: "32px", fontSize: "15px" }}>
          {current.content}
        </p>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: i === step ? "var(--accent)" : "rgba(255,255,255,0.2)",
                transition: "background 0.3s ease"
              }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
             {step > 0 && (
               <button className="action-btn action-btn--ghost" onClick={() => setStep(step - 1)}>Back</button>
             )}
             {step < steps.length - 1 ? (
               <button className="action-btn action-btn--primary" onClick={() => setStep(step + 1)}>Next</button>
             ) : (
               <button className="action-btn action-btn--primary" onClick={handleFinish}>Get Started</button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
