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
    carryMax: 0,              // seconds of leftover time that carry into the next stage (none: every stage is its own race)
    mobileAssist: { default: 0.2, hurricane: 0.55, tornado: 0.35 },   // share of wind and curve drift removed on phones
  },
  // ---- Hidden bonus: an SBA helicopter escort, offered on the retry after time runs out.
  // One per attempt; 1 key, Xbox B, or the helicopter button on phones. The Black Hawk leads the van
  // and its downwash blows the weather, traffic and road debris out of the way.
  escort: {
    duration: 12,             // seconds of escort
    ahead: 20, altitude: 10,  // where it flies (metres ahead of / above the van), framed below the HUD
    reach: 150,               // metres ahead that the downwash clears
    pilot: { name: "SAM", role: "SBA AIR ESCORT", portrait: "art/sam/sam.png", line: "Looks like you need some help, partner. Follow me!", lineOut: "Yeee haw, good buddy, you got it from here!" },
    sfx: { pass: "audio/sfx/heli-pass.m4a", loop: "audio/sfx/heli-loop.m4a", radio: "audio/sfx/radio-click.m4a", voiceIn: "audio/sfx/sam-in.m4a", voiceOut: "audio/sfx/sam-out.m4a" },   // Sam's voice: Artlist text-to-speech
  },
  physics: {
    maxSpeed: 12000,          // top speed without boost (shown as topMph)
    topMph: 100,
    accel: 2600,              // per second while holding gas
    brake: 13000,             // per second while braking
    coast: 1700,              // natural slowdown
    offRoadDecel: 7000,
    offRoadLimit: 3200,
    centrifugal: 0.19,        // how hard curves push you outward
    steer: 2.2,               // lateral road-widths per second at full speed
    roadKeep: 0.35,           // gentle pull back onto the road near its edges when you are not steering
    boostSpeed: 15600,        // top speed while boosting
    boostTime: 2.6,           // seconds per boost
    boostsPerStage: 1,        // nitrous you start each stage with; more lies on the road
    maxBoosts: 4,             // the most you can carry
    crashSlow: 0.35,          // speed multiplier on hitting traffic or debris
    stopMph: 12,              // counts as stopped for a delivery
  },

  // ---- Pickups on the road: nitrous bottles in new places every game, and once a game a helicopter
  // badge that calls Sam's escort (it turns up on a random stage, at a random spot).
  pickups: { nitroPerStage: 3, heli: true },

  // ---- Stages: weather, length (segments), time added, hazards, traffic -----
  // Stages are about 65% longer than at launch, with three jumps each. Times are tight: about 1.05x what the
  // autopilot takes on average (it crashes far more than a person does). Nothing carries over between stages.
  // `weather` names a preset in src/weather.js.
  stages: [
    { name: "AFTERMATH",       weather: "dusk",      length: 4300, time: 70, traffic: 17, hazards: 15, curves: 1.0, hills: 0.6, fact: 0, business: 0 },
    { name: "HEAVY WEATHER",   weather: "storm",     length: 4700, time: 82, traffic: 20, hazards: 24, curves: 1.25, hills: 0.8, fact: 1, business: 1 },
    { name: "FLOOD ZONE",      weather: "flood",     length: 4900, time: 83, traffic: 17, hazards: 27, curves: 0.9, hills: 0.0, fact: 2, business: 2 },
    { name: "TORNADO ALLEY",   weather: "tornado",   length: 5200, time: 98, traffic: 17, hazards: 32, curves: 1.1, hills: 0.3, fact: 3, business: 3 },
    { name: "HURRICANE COAST", weather: "hurricane", length: 5500, time: 105, traffic: 20, hazards: 35, curves: 1.3, hills: 0.0, fact: 4, business: 4 },
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
    // more facts: retries, pause, results and time-up screens, and the talk radio (all confirmed on SBA pages; see research/)
    { text: "Homeowners can borrow up to $500,000 to repair or replace a damaged primary residence.", source: "SBA.gov, physical damage loans" },
    { text: "Homeowners and renters can borrow up to $100,000 to replace personal property like furniture, clothing and cars.", source: "SBA.gov, physical damage loans" },
    { text: "SBA disaster loans can have terms of up to 30 years, with no prepayment penalty.", source: "SBA.gov, disaster assistance" },
    { text: "Borrowers may add up to 20% of their verified loss to rebuild stronger against the next disaster.", source: "SBA.gov, mitigation assistance" },
    { text: "Don't wait for an insurance settlement to apply. SBA loans cover losses insurance doesn't.", source: "SBA disaster releases" },
    { text: "SBA won't decline a disaster loan just because of a lack of collateral.", source: "SBA.gov, disaster loans" },
    { text: "Apply online at lending.sba.gov, by phone, or in person at a disaster recovery center.", source: "SBA.gov, disaster assistance" },
    { text: "Find a recovery center and book a visit at appointment.sba.gov.", source: "SBA.gov, recovery center locator" },
    { text: "SBA field teams deploy within 72 hours of a disaster.", source: "SBA Office of Disaster Recovery" },
    { text: "Questions? SBA disaster customer service: 800-659-2955 or disastercustomerservice@sba.gov.", source: "SBA.gov, contact" },
    { text: "Economic Injury Disaster Loans are available even if a business had no physical damage.", source: "SBA.gov, EIDL" },
    { text: "Interest rates are capped at 4% for applicants who can't get credit elsewhere.", source: "SBA.gov, disaster assistance" },
    { text: "In fiscal year 2025, SBA approved more than 51,000 disaster loans.", source: "SBA release, Nov 2025" },
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

  // ---- Radio (src/radio.js): D-pad left / right or keys 4 / 5 while driving; on phones, tap the radio
  // button under the stage panel. Songs are instrumental Artlist tracks, voices are Artlist text-to-speech,
  // and each station is built by tools/make_radio_audio.py (see audio/README.md). url null = the stage's own song.
  radio: {
    stations: [
      { id: "pulse", name: "PULSE", freq: "101.5 FM", genre: "ELECTRONIC", color: "#5CC8FF", url: null, note: "With DJ Olivia.",
        drops: Array.from({ length: 10 }, (_, k) => `audio/radio/olivia-${k + 1}.m4a`) },   // Olivia talks over the stage songs
      { id: "sunny", name: "SUNNY", freq: "99.9 FM", genre: "TOP 40", color: "#FF6FB0", url: "audio/radio/top40.m4a", note: "With Alex. Songs about SBA disaster help." },
      { id: "isla", name: "LA ISLA", freq: "92.9 FM", genre: "LATIN", color: "#3DDCB4", url: "audio/radio/latin.m4a", note: "Hosted by GC." },
      { id: "talk", name: "RECOVERY TALK", freq: "1590 AM", genre: "TALK", color: "#ECC444", url: "audio/radio/talk.m4a",
        note: "With Charlotte. Dramatized calls, facts from SBA.gov." },
      { id: "off", name: "RADIO OFF", freq: "", genre: "", color: "#C9D2E0", url: "" },
    ],
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
    passengerSide: "../assets/mrv-van/v3/mrv-van-02-passenger-side.png",   // rebuilt by assets/mrv-van/adobe/build_passenger_raster.mjs
    hero: "../assets/mrv-van/illustrator/mrv-van-05-three-quarter.png",
    front: "../assets/mrv-van/illustrator/mrv-van-03-front.png",
  },

  // ---- Palette: SBA colors pushed into a dark synthwave night ---------------
  style: {
    navy: "#0E2E6A", navyDeep: "#071A3F", night: "#040C24", lightBlue: "#DEEAF2", midBlue: "#367AB6",
    neonBlue: "#5CC8FF", skyBlue: "#549CD4", white: "#FEFEFE", gold: "#ECC444", red: "#CD2127", green: "#3C7C54",
  },
};
