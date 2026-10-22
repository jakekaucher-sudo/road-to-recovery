// Per-stage looks for the 3D gameplay: believable weather, not neon. Each
// stage reads at a glance: golden-hour aftermath, dark rainstorm, grey flood,
// green-yellow tornado sky, slate-blue hurricane coast. Colors are hex.
export const LOOKS = {
  dusk: {        // storm aftermath at golden hour
    skyTop: "#3f6fae", skyHorizon: "#f3b57c", sunColor: "#ffd08a", sunElev: 0.13, sunAz: 0.35, sunIntensity: 2.6, sunAmt: 1.0,
    hemiSky: "#b9cde6", hemiGround: "#6b5a44", hemiIntensity: 0.9, fog: "#e7b98e", fogNear: 70, fogFar: 700,
    groundA: "#6f8a48", groundB: "#8b9a52", shoulder: "#8d7f62", wet: 0.12, clouds: 0.45, cloudColor: "#e6c7a6", cloudDark: "#7d6f78",
    rain: 0, rainSlant: 0.1, lightning: 0, dust: 0.15, exposure: 1.0, wind: 0.15,
  },
  storm: {
    skyTop: "#38404c", skyHorizon: "#7c8590", sunColor: "#c9d3e0", sunElev: 0.5, sunAz: -0.4, sunIntensity: 0.9, sunAmt: 0.0,
    hemiSky: "#8c96a4", hemiGround: "#3d4636", hemiIntensity: 1.25, fog: "#69737f", fogNear: 25, fogFar: 380,
    groundA: "#4e6a3a", groundB: "#5d7442", shoulder: "#5e5a50", wet: 1.0, clouds: 1.0, cloudColor: "#68717d", cloudDark: "#30363f",
    rain: 0.9, rainSlant: 0.35, lightning: 0.35, dust: 0.3, exposure: 0.95, wind: 0.5,
  },
  flood: {
    skyTop: "#57636b", skyHorizon: "#a3adb0", sunColor: "#d8dde0", sunElev: 0.6, sunAz: 0.2, sunIntensity: 1.0, sunAmt: 0.0,
    hemiSky: "#a2acb0", hemiGround: "#4e4a3a", hemiIntensity: 1.25, fog: "#8b9598", fogNear: 20, fogFar: 320,
    groundA: "#6b6848", groundB: "#7a7650", shoulder: "#6e6450", wet: 1.0, clouds: 0.95, cloudColor: "#8a9396", cloudDark: "#4c5458",
    rain: 0.5, rainSlant: 0.08, lightning: 0.08, dust: 0.05, exposure: 1.0, wind: 0.25, flood: 1,
  },
  tornado: {
    skyTop: "#3a463b", skyHorizon: "#b9a66a", sunColor: "#ffd48a", sunElev: 0.12, sunAz: 0.9, sunIntensity: 1.9, sunAmt: 0.6,
    hemiSky: "#a4a684", hemiGround: "#5e5432", hemiIntensity: 1.0, fog: "#8f8966", fogNear: 40, fogFar: 520,
    groundA: "#a49656", groundB: "#8b8a46", shoulder: "#8a7a58", wet: 0.2, clouds: 0.9, cloudColor: "#6b7262", cloudDark: "#2e352c",
    rain: 0.12, rainSlant: 0.9, lightning: 0.15, dust: 0.9, exposure: 1.0, wind: 1.0, tornado: 1,
  },
  hurricane: {
    skyTop: "#262e3b", skyHorizon: "#5b6876", sunColor: "#b8c4d4", sunElev: 0.45, sunAz: -0.8, sunIntensity: 0.7, sunAmt: 0.0,
    hemiSky: "#76828f", hemiGround: "#4a4638", hemiIntensity: 1.2, fog: "#525d69", fogNear: 16, fogFar: 260,
    groundA: "#6b7a4a", groundB: "#7f8a56", shoulder: "#bba878", wet: 1.0, clouds: 1.0, cloudColor: "#4e5a68", cloudDark: "#1d232c",
    rain: 1.0, rainSlant: -0.9, lightning: 0.5, dust: 0.6, exposure: 0.95, wind: 1.0, coast: 1,
  },
  clear: {
    skyTop: "#2f6fc0", skyHorizon: "#bfd9ee", sunColor: "#fff1d6", sunElev: 0.45, sunAz: 0.4, sunIntensity: 2.6, sunAmt: 1.0,
    hemiSky: "#cfe2f5", hemiGround: "#6b6a4a", hemiIntensity: 1.0, fog: "#c4d8ea", fogNear: 120, fogFar: 900,
    groundA: "#5f9a48", groundB: "#77a856", shoulder: "#9a8d6c", wet: 0, clouds: 0.3, cloudColor: "#ffffff", cloudDark: "#b9c6d4",
    rain: 0, rainSlant: 0, lightning: 0, dust: 0, exposure: 1.05, wind: 0.05,
  },
};
