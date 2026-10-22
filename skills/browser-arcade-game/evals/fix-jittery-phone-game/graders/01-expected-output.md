---
type: llm
focus: trace
weight: 1
---

The result matches this description: Identifies that the game runs fixed-step physics but renders every display refresh (120 Hz on the iPhone) without interpolation, and that an adaptive-resolution resize happens after drawing (clearing the canvas). Proposes or applies render interpolation between physics steps and moving the quality adjustment before the draw with a ceiling, and explains how to verify (simulated 120 Hz jitter measurement or headless capture).
