// ============================================================================
// THE ROAD TO RECOVERY — game configuration (single source of truth).
// Business names and dollar amounts are FICTIONAL / HYPOTHETICAL and are
// labeled as such in game. Facts carry their research source.
// ============================================================================
export const CONFIG = {
  title: "THE ROAD TO RECOVERY",
  subtitle: "An SBA Disaster Recovery arcade run",
  presentedBy: "SBA DISASTER RECOVERY",

  // Internal render resolution (CSS scales it to the screen).
  render: { desktop: [1280, 720], mobile: [960, 540] },

  // ---- Driving model (world units; one road segment = 200 units) ----------
  // Fairness on phones (tilt or touch steering) and on retries. Raise or lower to taste.
  difficulty: {
    mobileTimeFactor: 1.12,   // phones get 12% more time on every stage
    minStartFactor: 1.3,      // phones never start a stage with less than 1.3x its (phone) base time
    retryFactor: 1.25,        // retrying after time runs out gives 1.25x the stage time
    mobileAssist: { default: 0.2, hurricane: 0.55, tornado: 0.35 },   // share of wind and curve drift removed on phones
  },
  physics: {
    maxSpeed: 12000,          // top speed without boost (shown as topMph)
    topMph: 100,
    accel: 2600,              // per second while holding gas
    brake: 13000,             // per second while braking
    coast: 1700,              // natural slowdown
    offRoadDecel: 7000,
    offRoadLimit: 3200,
    centrifugal: 0.26,        // how hard curves push you outward
    steer: 2.1,               // lateral road-widths per second at full speed
    boostSpeed: 15600,        // top speed while boosting
    boostTime: 2.6,           // seconds per boost
    boostsPerStage: 3,
    crashSlow: 0.35,          // speed multiplier on hitting traffic or debris
    stopMph: 12,              // counts as stopped for a delivery
  },

  // ---- Stages: weather, length (segments), time added, hazards, traffic -----
  // `weather` names a preset in src/weather.js.
  stages: [
    { name: "AFTERMATH",       weather: "dusk",      length: 2600, time: 75, traffic: 12, hazards: 10, curves: 1.0, hills: 0.6, fact: 0, business: 0 },
    { name: "HEAVY WEATHER",   weather: "storm",     length: 2900, time: 64, traffic: 14, hazards: 16, curves: 1.25, hills: 0.8, fact: 1, business: 1 },
    { name: "FLOOD ZONE",      weather: "flood",     length: 3000, time: 66, traffic: 12, hazards: 18, curves: 0.9, hills: 0.0, fact: 2, business: 2 },
    { name: "TORNADO ALLEY",   weather: "tornado",   length: 3200, time: 68, traffic: 12, hazards: 22, curves: 1.1, hills: 0.3, fact: 3, business: 3 },
    { name: "HURRICANE COAST", weather: "hurricane", length: 3400, time: 76, traffic: 14, hazards: 24, curves: 1.3, hills: 0.0, fact: 4, business: 4 },
  ],

  // ---- The five stops: two businesses, a homeowner, renters, a nonprofit ---
  // Names are FICTIONAL, amounts HYPOTHETICAL. `type` drives the on-screen
  // wording; `loan` is the SBA loan type that fits (from research/
  // 2026-10-17-sba-disaster-loans.md): home loans up to $500,000; personal
  // property loans up to $100,000 for homeowners and renters; business
  // physical damage loans up to $2 million for businesses and private nonprofits.
  businesses: [
    { type: "BUSINESS", name: "MAPLE STREET BAKERY", town: "Maple Street", kind: "bakery", damage: "storm", disaster: "SEVERE STORM DAMAGE", amount: 85000,
      loan: "Business physical damage loan", restoredTitle: "BUSINESS RESTORED", restoredLine: "Maple Street Bakery is back in business",
      restoreOrder: ["debris", "damage", "materials", "windows", "signage", "lights"],
      palette: { facade: "#E3C79F", trim: "#1C3E75", awningA: "#CD2127", awningB: "#FFFFFF", sign: "#1C3E75" } },
    { type: "HOMEOWNER", name: "THE OAKLEY FAMILY HOME", signText: "THE OAKLEYS", town: "Riverside", kind: "house", damage: "wind", disaster: "WIND & RAIN DAMAGE", amount: 95000,
      loan: "Home loan", restoredTitle: "HOME RESTORED", restoredLine: "The Oakley family is back home",
      restoreOrder: ["debris", "materials", "damage", "windows", "lights", "signage"],
      palette: { facade: "#C9D6E3", trim: "#FFFFFF", awningA: "#1C3E75", awningB: "#FFFFFF", sign: "#1C3E75" } },
    { type: "RENTERS", name: "CEDAR CREEK CONDOS", town: "Cedar Creek", kind: "condo", damage: "flood", disaster: "FLOOD DAMAGE", amount: 28000,
      loan: "Personal property loan (renter)", restoredTitle: "RENTERS BACK HOME", restoredLine: "Renters at Cedar Creek Condos are back home",
      restoreOrder: ["debris", "damage", "windows", "materials", "lights", "signage"],
      palette: { facade: "#D8C3A5", trim: "#1C3E75", awningA: "#1C3E75", awningB: "#DEEAF2", sign: "#1C3E75" } },
    { type: "BUSINESS", name: "PRAIRIE AUTO REPAIR", town: "Prairie Junction", kind: "garage", damage: "tornado", disaster: "TORNADO DAMAGE", amount: 210000,
      loan: "Business physical damage loan", restoredTitle: "BUSINESS RESTORED", restoredLine: "Prairie Auto Repair is back in business",
      restoreOrder: ["debris", "materials", "damage", "windows", "signage", "lights"],
      palette: { facade: "#9FB3C4", trim: "#1C3E75", awningA: "#ECC444", awningB: "#1C3E75", sign: "#ECC444" } },
    { type: "NONPROFIT", name: "PELICAN POINT COMMUNITY CHURCH", signText: "PELICAN POINT CHURCH", town: "Pelican Point", kind: "church", damage: "hurricane", disaster: "HURRICANE DAMAGE", amount: 260000,
      loan: "Physical damage loan (private nonprofit)", restoredTitle: "NONPROFIT RESTORED", restoredLine: "Pelican Point Community Church is open to neighbors again",
      restoreOrder: ["debris", "damage", "materials", "windows", "signage", "lights"],
      palette: { facade: "#F2EEE6", trim: "#1C3E75", awningA: "#1C3E75", awningB: "#FFFFFF", sign: "#FFFFFF" } },
  ],

  // ---- Research-backed facts (wording faithful to research/) ---------------
  facts: [
    { text: "SBA disaster loans are available to businesses, homeowners, renters and private nonprofits in declared disaster areas.", source: "SBA.gov, disaster assistance" },
    { text: "Business physical damage loans can cover real property, equipment, fixtures and inventory, up to $2 million.", source: "SBA.gov, physical damage loans" },
    { text: "Economic Injury Disaster Loans provide working capital to small businesses after a disaster.", source: "SBA.gov, EIDL" },
    { text: "First payments on SBA disaster loans are deferred 12 months, with no interest accruing during the deferment.", source: "SBA.gov, disaster assistance" },
    { text: "SBA's Mobile Recovery Vehicles bring SBA customer service representatives to hard-to-reach areas.", source: "SBA release, April 2026" },
  ],

  labels: {
    hypothetical: "Hypothetical amount, for illustration only",
    fictional: "Homes, businesses and nonprofits shown are fictional. Amounts are hypothetical and for illustration only.",
    closing: "Helping you Recover, One Step at a Time.",
    learnMore: "Learn more at SBA.gov/disaster",
    audiences: "Businesses ▪ Homeowners ▪ Renters ▪ Nonprofits",
  },

  // ---- Music (licensed from Artlist under the owner's plan; see audio/README.md)
  music: {
    menu: "audio/music/stage5-french-touch.m4a",
    stages: ["audio/music/stage1-the-bounce.m4a", "audio/music/stage2-1993.m4a", "audio/music/stage3-what-you-know-about.m4a", "audio/music/stage4-old-school.m4a", "audio/music/stage5-shake-it.m4a"],
    volume: 0.55,
  },

  // ---- Cutscene slots ------------------------------------------------------
  // null = built-in placeholder. To add a cutscene later, register a module in
  // src/cutscenes.js and put its id here (see README "Adding cutscenes").
  cutscenes: {
    intro: "intro-dc",                   // before stage 1 (src/intro.js)
    beforeStage: [null, null, null, null, null],
    arrival: [null, null, null, null, null], // replaces the built-in restoration scene
    ending: "ending-dawn",               // before the final score (src/outro.js)
  },

  // ---- The van (read-only project assets) ----------------------------------
  van: {
    rear: "../assets/mrv-van/generated/mrv-van-04-rear-B.png",
    driverSide: "../assets/mrv-van/adobe/reference-vector.svg",
    passengerSide: "../assets/mrv-van/v3/mrv-van-02-passenger-side.svg",
    hero: "../assets/mrv-van/illustrator/mrv-van-05-three-quarter.png",
    front: "../assets/mrv-van/illustrator/mrv-van-03-front.png",
  },

  // ---- Palette: SBA colors pushed into a dark synthwave night ---------------
  style: {
    navy: "#0E2E6A", navyDeep: "#071A3F", night: "#040C24", lightBlue: "#DEEAF2", midBlue: "#367AB6",
    neonBlue: "#5CC8FF", skyBlue: "#549CD4", white: "#FEFEFE", gold: "#ECC444", red: "#CD2127", green: "#3C7C54",
  },
};
