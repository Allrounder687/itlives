"use client";

import { useState } from "react";
import { ParallaxRenderer, ParallaxLayerConfig } from "./ParallaxRenderer";

export function ParallaxWorkspace() {
  // A test configuration replicating an LWP demo configuration
  // The user can add URLs to test here.
  const [layers, setLayers] = useState<ParallaxLayerConfig[]>([
    { src: "https://images6.alphacoders.com/131/1316035.jpeg", sensitivityX: 0.02, sensitivityY: 0.02, repeatX: 0, repeatY: 0 },
    // Add multiple test images manually here 
  ]);

  return (
    <section className="panel" style={{ height: "60vh", display: "flex", flexDirection: "column" }}>
      <div className="section-head" style={{ padding: "16px" }}>
        <span className="eyebrow">Interactive Canvas</span>
        <h2>LWP Parallax Engine Testing</h2>
        <p className="muted" style={{ marginTop: "4px" }}>
          Move your mouse over the canvas to test the Layered Parallax component using LWP math algorithms. Background runs at maximum frame-rate.
        </p>
      </div>
      
      <div style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: "12px", margin: "0 16px 16px 16px" }}>
        <ParallaxRenderer layers={layers} isOverlay={false} />
      </div>
    </section>
  );
}
