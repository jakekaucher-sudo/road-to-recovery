# The Road to Recovery — SBA Disaster Recovery arcade game

A playable 3D arcade driving game inspired by the rear-chase perspective and energy of 1980s arcade racers. You drive the SBA Disaster Recovery Mobile Recovery Vehicle through five worsening disasters and stop at five places that need help: two small businesses, one homeowner, one set of renters and one nonprofit.

Gameplay is real-time 3D (Three.js / WebGL) with believable weather for each stage. Menus, the interface and cutscenes keep a light retro touch in SBA colors. It runs in any modern browser on a computer, phone or tablet, with no install and no build step. Three.js is included in `vendor/`, so it also works offline on a local network.

## Run it on this computer

```bash
python3 game/tools/serve.py
```

Then open http://localhost:8790/game/ in Chrome or Safari. The game must be served (not opened as a file) because it loads the van artwork from `assets/mrv-van/`.

## Play it on a phone or tablet (tilt steering)

Phones only allow the gyroscope on secure (HTTPS) pages, so use the HTTPS server. Your phone must be on the same Wi-Fi as this computer.

```bash
python3 game/tools/serve_https.py
```

It prints an address like `https://192.168.50.148:8443/game/`. Open it on the phone. The certificate is self-made, so the phone warns. On iPhone tap **Show Details → visit this website**; on Android tap **Advanced → Proceed**. Turn the phone sideways, tap to start and tap **Allow** when asked about motion access.

## Controls

| Action | Keyboard | Xbox controller | Phone / tablet |
|---|---|---|---|
| Steer | ← → (or A / D) | Left stick | Tilt the phone left / right like a steering wheel, or drag left / right (switch with the **STEER** button on the title or pause screen) |
| Gas | ↑ (or W) | RT (right trigger), or D-pad up | Hold the round **GAS** button (right) |
| Brake | Space, C, ↓ (or S) | LT (left trigger), or D-pad down | Hold the round **BRAKE** button (left) |
| Nitrous boost (3 per stage, any speed) | X or Shift | X (or RB) | Double-tap GAS |
| Start / confirm / skip a cutscene / done reading the fact | Enter | A | Tap |
| Pause | P or Esc | Menu button | ❚❚ button |
| Re-center steering | — | — | ◎ button (hold the phone how you like, then tap) |
| Music on / off | M | View button | — |
| Helicopter escort (only after a time-up, once per try) | 1 | B | The pulsing **ESCORT** helicopter button above GAS |
| Radio: previous / next station | 4 / 5 | D-pad left / right | Tap the radio button (under the stage panel, showing the station's logo) for the next station |

**Controllers.** Any controller the browser reads as a standard gamepad works, including Xbox controllers over USB or Bluetooth on a computer, iPhone, iPad or Android. Press any button once so the browser notices it. The title screen then shows the controller layout, and crashes rumble where the controller supports it.

**Phones get a little help.** Tilt and touch steering are slower than a keyboard, so on phones every stage gives 12% more time, no stage starts with less than 1.3 times its time, and some of the wind and curve drift is taken off (the most on the Hurricane Coast). A retry after time runs out gives 1.25 times the stage time on any device. All of this is in `difficulty` in `config.js`.

**Phones stay sideways while you play.** From the start tap until you are back on the title screen, turning the phone too far while steering won't flip the game to portrait. On Android the browser really locks landscape (the game goes full screen for this). iPhones don't let websites lock the screen, so there the game turns itself back if the phone flips, and steering, pedals and buttons keep working the same way. The code is in `src/orient.js`; add `?nolock=1` to the address to turn it off.

**Steering switch.** The **STEER: TILT / DRAG** button on the title and pause screens picks the steering, and the phone remembers it. On iPhone, tilt asks for motion access on your first tap. Tap **Allow**. If access is refused, the page isn't https, or the app doesn't pass motion data (like the Claude app), the game says so and drag steering takes over. In tilt mode, hold the phone the way you like to drive and tap ◎ to re-center.

If tilting steers the wrong way on a particular device, add `?invertTilt=1` to the address.

## What you'll see

- **A real 3D van.** The model is built at load time from the actual artwork. The body follows the driver-side silhouette, with rounded edges, a crowned roof and sides that narrow slightly toward the roof, so it reads like a real van rather than a box. The driver and passenger art are mapped on each side, the front view is projected onto the windshield, hood and grille, and the rear art onto the doors. Wheels spin and the front ones steer. Nothing is redrawn, so the livery stays exact.
- **A high chase camera.** The camera sits above the van's roof line so you can see the road ahead over it.
- **Stages that look like their disaster.** Golden-hour storm aftermath, a dark rainstorm with lightning, grey floodwater over the fields, a green-yellow tornado sky with a funnel crossing the plains, and a slate-blue hurricane coast with surf, bending palms and sideways rain.
- **The stops in 3D.** Each stop is a 3D building with a live facade and a body matched to its kind. The home and church have pitched roofs with overhangs, plus a chimney or bell tower. The shops and condos have flat roofs with parapets and rooftop units. All have side windows. When you deliver, the camera swings to it and the damage clears, windows return, the sign straightens and the lights come on.
- **Real houses along the road.** Roadside homes have eaves, framed windows with sills, porches, chimneys and garages, in four colour variants per house type. The hurricane coast has pastel beach houses on stilts with decks.

## How it plays

- **Five stages, one journey.** Aftermath (storm-damaged town at dusk), Heavy Weather (rain, lightning, gusts), Flood Zone (water on the road cuts grip and speed), Tornado Alley (a funnel crossing the plains, gusts and tumbling debris), Hurricane Coast (sea on the right, constant wind from the water, waves washing over the road).
- **Beat the clock.** Each stage adds time. Time you don't use carries over, and gold clocks on the road add 3 seconds.
- **Avoid trouble.** Traffic, debris, fallen branches, logs, hay bales and downed poles slow you sharply. Off-road is slow. Curves push you outward, more so on wet roads.
- **Stop in the gold zone.** Signs count down 1500, 1000 and 500 feet to a neon RECOVERY STOP gate. Brake to a stop in the glowing gold zone to deliver help. Stopping near the middle scores better. If you overshoot, the van backs up and you lose a star.
- **Watch the place recover.** The stop then restores in stages: debris, damage, materials, windows, signage and lights.
- **Hidden bonus: the SBA helicopter escort.** Run out of time and the time-up screen says an escort is standing by. On the retry, press **1** (keyboard), **B** (Xbox) or tap the **ESCORT** helicopter button (phones). Pilot Sam comes on the radio ("Looks like you need some help, partner. Follow me!") and an SBA Black Hawk in the van's paint swoops in overhead and leads the van for 12 seconds. Its downwash blows the rain, wind and dust away, pushes traffic out to the shoulders and blasts road debris off the road. One escort per try; it is gone once the stage is cleared. Settings are in `escort` in `config.js`; the helicopter is `src/three/heli3d.js` (built in code like the van, paint from the van's official artwork) and `dev/heli.html` is a turntable for it.
- **Jumps.** Stage 1 has a raised drawbridge across a river: come in fast to clear the gap ("BIG AIR" is worth 2 extra seconds); come in slow and the van still makes it across, with a rough landing that costs speed. Stage 2 has an optional car-carrier truck parked in the right lane with its ramp down: line up with the ramp to launch off it, or drive around it. Traffic pulls over before the drawbridge and keeps out of the ramp lane. The jumps are built in `src/track.js` and drawn by `src/three/jumps3d.js`.
- **Nitrous.** Each boost fires blue nitrous flames from the exhaust, at any speed. With none left, the screen says so.
- **Reading time.** The SBA fact at the bottom of the stage-start screen stays up long enough to read (by its length) before the countdown starts, with a bar showing the time left. Press Enter, A or tap to start sooner. Retries show a different fact each time, and the pause, results and time-up screens each show one too. Every fact is in `facts` in `config.js` with its source.
- **The radio.** Press 4 / 5, or the D-pad left / right, to change stations while driving, as in open-world driving games. On phones, tap the small radio button under the stage panel (it shows the station's logo) for the next station. Static plays while the dial moves, and a card shows which station you're on and fades once you settle (on phones a compact one beside the button that never covers the road or the distance bar, even on an iPhone SE), and each station keeps "broadcasting" while you're away, so it's further along when you come back. The game remembers your station. Stations: **Pulse 101.5** (the stage songs), **Big Sky 98.7** (country), **The Storm 104.1** (rock), **Heat 95.3** (hip hop), **La Isla 92.9** (Latin, with host GC), **Sunny 99.9** (pop), **Recovery Talk 1590 AM** (host Charlotte takes calls about SBA disaster help; the calls are dramatized and the facts are from SBA.gov) and Radio Off. All songs are instrumental. A station's audio only downloads when you tune to it, so phones use no extra data unless you change stations. Stations are in `radio` in `config.js`, the code is `src/radio.js`, and `tools/make_radio_audio.py` builds each station's audio.
- **Ratings.** Each stop earns 1–3 stars for time left, stop accuracy and crashes. The ending shows all five recoveries, the total funds delivered and your rating out of 15.

## Facts and fiction

- Every home, business, church and dollar amount is **fictional / hypothetical** and is labeled that way on screen.
- The loan type shown at each stop matches the research in `research/2026-10-17-sba-disaster-loans.md`. Home loans go up to $500,000. Personal property loans for homeowners and renters go up to $100,000. Business physical damage loans for businesses and private nonprofits go up to $2 million. The hypothetical amounts stay inside those limits.
- The fact captions at each stage start come from the research files and show their source.

## Change things

Everything editorial is in `game/config.js`: stop names, types, amounts, wording, stage order, weather, length, time, traffic and hazard counts, driving feel, and cutscene slots. Colors and weather looks are in `src/weather.js`.

## Play it in the Claude app

A private build is published at https://claude.ai/artifact/UQUqfAoSX8ZxrhrtnULHWQ, so it opens in the Claude app on a phone. Inside the Claude app, pages cannot read the motion sensors, so tilt steering is off there. Drag left and right on the screen to steer, and use the GAS and BRAKE buttons. For tilt steering, use the HTTPS phone link described above.

To rebuild after changes, run `python3 game/tools/build_artifact.py`. It writes a self-contained copy to `game/dist/`, renames the music from `.m4a` to `.mp4` (Artifacts serve only `.mp4`), and leaves out the source music and original PNGs. Then republish `game/dist/index.html` with its files.

The music is licensed to the owner's Artlist plan. Keep the page private, or check Artlist's terms before sharing it.

## Publish on GitHub Pages

`bash game/tools/publish_github.sh` signs in to GitHub (you approve in the browser), creates the public repo `road-to-recovery`, pushes, turns on Pages and prints the play link. Run it again with a message after any change: `bash game/tools/publish_github.sh "Changed the stop names"`. It rebuilds `docs/` first.

## Make another game like this

The workflow is saved as a skill in `skills/browser-arcade-game/` (also installed in `~/.claude/skills/`). Ask Claude for a new browser or phone game and it will follow the same structure, testing and publishing steps.

## Cutscenes

The game has cutscene slots for the intro, before each stage, at each arrival and at the ending (`cutscenes` in `config.js`). An empty slot uses the built-in screen. To add one, register it in `src/cutscenes.js` (instructions at the top of that file) and put its id in the slot.

**Intro (`src/intro.js`, 28.1 s)** opens with an HQ prologue, then keeps the neo-noir driving-film opening, told with bold, inked illustrations in the style of 2000s crime-game loading screens (`art/intro/`).

1. SBA Disaster Recovery Headquarters, Washington, D.C., 11:47 PM: Randle Logan at his desk.
2. A video call: Chris Stallings on screen, in comic speech bubbles: "There's a major situation. We have survivors in need of help." Then: "Deploy the Mobile Recovery Vehicles!"
3. Randle presses the red MRV button under his desk. CLICK!
4. The Disaster Recovery beacon lights up over an aerial of the Potomac, with "SBA Disaster Recovery presents." The music kicks in.
5. An overhead avenue with moving light trails: "Homeowners. Renters. Businesses. Nonprofits."
6. A van crossing Memorial Bridge, the beacon in the sky.
7. The Mall at night with the beacon, and the title.
8. The driver on a rooftop under the beacon, in the royal-blue SBA jacket with "OFFICE OF DISASTER RECOVERY" on the back.
9. The driver heads out of DC: across the bridge toward Virginia and I-66, the Capitol and Monument in the rearview mirror.

The searchlight beams and the lit cloud ovals are painted into the stills. The "DISASTER RECOVERY" lettering inside each oval is cut from the official logo (`assets/brand/disaster-recovery-logo.png`), not redrawn, and laid in as the stencil's shadow. Rebuild the intro audio with `python3 game/tools/make_intro_audio.py`.

**Ending (`src/outro.js`, 16.9 s)** plays after the last stop, before the final score. It uses the closing section of the same track.

1. Sunrise on a recovering main street, with "Five stops. Five recoveries."
2. A montage of the five restored stops, each with its name, type and hypothetical amount.
3. A baker turning the sign to OPEN: "Back in business."
4. The driver at sunrise over a coastal town, with "Helping you Recover, One Step at a Time." and "SBA Disaster Recovery • SBA.gov/disaster."

The jacket print is added in code and centred on the back automatically. The SBA lockup is cropped from the van's rear artwork, not redrawn, and the print is shaded by the jacket's folds.

## Music

Licensed from the owner's Artlist plan: French-house / electro tracks for each stage and the menus, and "Night Drive" for the intro and ending. "1993" starts just before its beat drop, skipping the spoken intro. The radio adds instrumental country, rock, hip-hop, Latin and pop stations, and a talk station voiced with Artlist text-to-speech. The full list is in `audio/README.md`, and you can swap tracks in `config.js` → `music` and `radio`.

## Graphics and smoothness

Computers draw the 3D scene at up to twice the screen's resolution, with multisample anti-aliasing, bloom, 2048-pixel shadows and full anisotropic filtering on the road. The starting sharpness is picked from the screen size: measured on an Apple M4 in Chrome, a 13" Retina screen holds 60 fps at 2x resolution with 2x MSAA, and a 16" one at 1.75x with 2x MSAA. If frames start dropping (more than 4 in 2 seconds), the game steps down one level at a time: resolution, then anti-aliasing, then bloom, then shadows. It never steps back up mid-game, because trying a sharper level costs a visible stutter. Screens faster than 60 Hz draw at a steady 60 fps, since the physics runs at 60 Hz. Phones start at 1.5x resolution and step down the same way. The code is in `src/three/engine3d.js`.

## Testing tools

- `?autopilot=1` makes the van drive itself. `?stage=3` starts at stage 3. `?mobile=1` forces the phone layout.
- `dev/heli.html` (add `?van=1` to park the van beside it) is a turntable for the escort helicopter; `dev/signs.html` draws every stop's building large to check the name signs; `dev/cutout.html` with `tools/save_cutout.py` cuts a character portrait out of a white background.
- `python3 game/tools/playtest.py "QUERY" actions.json OUTDIR [WxH]` runs the game in headless Chrome, steps the simulation and saves screenshots.

## Graphics quality and performance

The game picks a quality tier automatically and adjusts while you play:

- **Laptops and desktops:** full resolution (up to 1.75× pixel ratio), real shadows under the van, reflective wet roads and paint, bloom on lights, heavy rain.
- **Phones and tablets:** lower resolution, no shadow maps or bloom, lighter rain and particles, shorter draw distance, and houses with fewer small parts.
- **Scenery culling:** only the scenery between just behind the van and the fog line is drawn. It costs no extra draw calls and cuts the scene's triangles by about 25–40%.
- **Adaptive:** if frames slow down, the game lowers resolution first, then turns off bloom, then shadows. It raises resolution again when there is headroom.
- Force a tier with `?q=low` or `?q=high`.

## Why Three.js and not Unity

Unity 6 (6000.6.7f1) is installed. Three.js was chosen because it loads instantly in phone browsers, handles gyroscope steering and touch directly, and keeps the download small. A Unity WebGL build needs extra plugin code for iPhone motion permissions and is much heavier on phones. Unity or Blender remain options later for pre-rendered cutscenes or a hand-modeled van.

## Files

```
game/
  index.html            page, phone pedals, rotate prompt
  config.js             all names, amounts, labels, stages, tuning, cutscene slots
  src/main.js           boot, loop, screen dispatch, test hooks
  src/game.js           state machine, driving physics, collisions, traffic, delivery, scoring
  src/track.js          seeded stage tracks: curves, hills, scenery, hazards, pickups, traffic, stop zone
  src/three/engine3d.js     WebGL renderer, quality ladder (resolution, MSAA, bloom, shadows), dropped-frame watch
  src/three/world3d.js     builds each stage in 3D and syncs it to the game every frame; camera rig
  src/three/van3d.js       the 3D van built from the real artwork
  src/three/road3d.js      road, curbs, terrain, water patches, delivery zone, the river under the drawbridge
  src/three/jumps3d.js     the drawbridge (stage 1) and the car-carrier ramp (stage 2)
  src/three/props3d.js     low-poly scenery, hazards, pickups and traffic geometry
  src/three/fx3d.js        rain, particles, flying debris, lightning, tornado, ocean, floodwater
  src/three/sky.js, look.js, space.js, textures.js, title3d.js
  src/render.js, sprites.js, van.js   2D drawing kept for menu backgrounds
  src/buildings.js      reusable restoration system: bakery, home, condo, garage, church, ...
  src/weather.js        weather presets (look + grip, wind, water, lightning)
  src/hud.js            timer, distance, speed gauge, boosts, roadmap, funds, messages, radio station card
  src/radio.js          the radio: stations, tuning, station logos
  src/screens.js        title, briefing, restoration, results, time up, pause, ending
  src/intro.js          the DC intro cutscene
  src/outro.js          the ending cutscene
  src/cine.js           shared cutscene tools: pan and zoom, titles, film grain, jacket print
  src/cutscenes.js      cutscene registry
  src/audio.js          procedural synthwave soundtrack, engine, effects, music clips
  src/input.js          keyboard, touch pedals, tilt (permission asked inside the tap), drag, steering switch
  src/assets.js         loads and keys the van artwork
  src/util.js, src/pixelfont.js
  audio/                licensed music (see audio/README.md)
  art/intro/, art/ending/   cutscene illustrations (see art/intro/README.md)
  vendor/three/         Three.js r170 and the add-ons used
  dev/van.html          a test page that shows the 3D van alone
  dev/props.html        a test page that lines up every variant of a scenery prop (?kind=house)
  tools/serve.py, tools/serve_https.py, tools/playtest.py, tools/capture.py, tools/rangehttp.py (lets audio start part-way through)
  tools/make_radio_audio.py builds the radio stations from audio/source/radio/
  tools/build_artifact.py   packages the game into dist/ for the Claude app
```

## Known limitations

- Tested in desktop Chrome on this Mac (steady 60 fps at full quality with bloom), in headless Chrome for screenshots of every stage, and with phone emulation (touch, landscape, emulated gyroscope, low tier). **Not yet tested on a physical phone or tablet.** Tilt direction, sensitivity and frame rate on real devices are unverified.
- The music tracks were chosen from Artlist's catalog by genre, tempo and album metadata. They have not been listened to in this session, so swap any that don't fit.
- The vans in the intro illustrations (avenue and bridge) are generic white vans, not the SBA livery.
- The intro music needs one tap or keypress first, because browsers block sound until the player interacts.
- The passenger-side art (right side of the 3D van) has small text artifacts from its vector trace. They are visible up close in the title showroom.
- The restoration scenes at each stop are built-in placeholders until you add your own cutscenes.
