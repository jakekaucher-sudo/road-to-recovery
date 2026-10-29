# Audio

All music is licensed from Artlist under the project owner's plan (downloaded unwatermarked on 2026-10-21). Check Artlist's license terms before publishing the game publicly, and keep `source/` out of any public repository.

| File | Track | Used for |
|---|---|---|
| `intro-hq.m4a` | Built by `tools/make_intro_audio.py`: a muffled cut of "Night Drive" (20.0–29.9 s) under the HQ scenes, Artlist sound effects (Bjorn Lynne "Multimedia - Cell Phone Ringtone", Omnibit Sound "Casino Galore - Slot Machine Button Click", Artlist Original "Sirens and Alerts - Short Siren" and "Epic Moments - Percussive Hit, Cymbal Impact"), then `intro-night-drive.m4a` unchanged from 11.16 s | Intro cutscene (28.1 s) |
| `intro-night-drive.m4a` | "Night Drive" by IamDayLight, cut 1.6–18.5 s | Intro cutscene (16.9 s). The beat kicks in at 2.73 s, where shot 2 starts. |
| `outro-night-drive.m4a` | "Night Drive" by IamDayLight, cut 166.3–183.2 s | Ending cutscene (16.9 s), before the final score |
| `music/stage1-the-bounce.m4a` | "The Bounce" by Ben Fox (album *Frenchouse Franchise*) | Stage 1 |
| `music/stage2-1993.m4a` | "1993" by Calypso Jet, starting at 25.5 s | Stage 2. The cut skips the spoken intro and starts one bar before the drop (27.4 s in the original). |
| `music/stage5-shake-it.m4a` | "Shake It" (instrumental) by Ziskoe, 127 BPM, starting at 13.1 s | Stage 5 (Hurricane Coast). The cut starts one bar before the first lift (15.0 s in the original). |
| `music/stage3-what-you-know-about.m4a` | "What You Know About" (instrumental) by Avi Rafael (*Futuristic Disco*) | Stage 3 |
| `music/stage4-old-school.m4a` | "Going Back to the Old School" (no lead vocals) by Yarin Primak | Stage 4 |
| `music/stage5-french-touch.m4a` | "French Touch" by Notize | Menus and ending |
| `intro-my-dark-side.m4a` | "My Dark Side" by Gal Lev | Previous intro, no longer used |

The tracks were picked from Artlist's catalog for a French-house / electro feel; none of them are by, or copies of, Daft Punk or Justice. Swap any track in `config.js` → `music`.

## Helicopter escort sounds

Built by `tools/make_escort_audio.py` from Artlist sound effects (downloaded unwatermarked on 2026-10-22, originals in `source/sfx/`):

| File | Sound effect | Used for |
|---|---|---|
| `sfx/heli-pass.m4a` | Front Row SFX by Pole Position, "Black Hawk Helicopter - Chopper Passing by, Exterior", cut 33.3–38.8 s (the approach up to its loudest point) | The Black Hawk swooping in over the van |
| `sfx/heli-loop.m4a` | InspectorJ, "Up in The Air - Helicopter Fly By, Loop", written three times over (the game loops the middle copy so there is no gap) | While it leads the van |
| `sfx/radio-click.m4a` | Daniel Vasquez, "Radio Noise - Microphone Click" | Sam coming on the radio |

Engine sound and other effects are generated live with the Web Audio API in `src/audio.js`.

## Radio

Built by `tools/make_radio_audio.py` from instrumental Artlist tracks (downloaded unwatermarked on 2026-10-22 and 2026-10-23, originals in `source/radio/`). Each station is one looping file. Every song is matched to the loudness of the stage music with a peak limiter, so switching stations never jumps in volume. Pulse 101.5 plays the stage songs listed above.

| File | Station | Tracks, in order |
|---|---|---|
| `radio/top40.m4a` | Sunny 99.9 (Top 40) | DJ Alex introduces each SBA song, made in Suno under the owner's Pro plan (commercial use rights; lyrics in `scripts/2026-10-28-radio-script-3.md`): "Don't Wait" and "Thirty Years" (`source/radio/top40-1.mp3`, `top40-2.mp3`). Songs 3 to 6 join automatically once their files exist. Then "Roll with It" (instrumental) by Scooter Diggs and "Summer Dive" by Raz Burg |
| `radio/latin.m4a` | La Isla 92.9 | Two of GC's breaks before each song: "Un Pasito Mas" (instrumental) by Matan Gov Ari, "2000" by 2KIDZ, "Moonlit Fiesta" by Raz Burg |
| `radio/olivia-1.m4a` … `olivia-10.m4a` | Pulse 101.5 | DJ Olivia's drops. The game plays one about every minute over the stage song and dips the music under her voice. |
| `radio/talk.m4a` | Recovery Talk 1590 AM | Three segments, 38 lines: host Charlotte; callers Dave, a bakery owner, Rosa, Earl, Priya and Walt; guests Marcus from a disaster recovery center and Alex from Sunny 99.9 |

The country, rock and hip hop stations were removed on 2026-10-28 (their sources stay in `source/radio/`).

The Artlist songs came from searches filtered to instrumental tracks, so none have lyrics.

**Voices.** Charlotte, GC, Marcus, Alex, Olivia and the callers are generated with Artlist text-to-speech (Eleven v3), originals in `source/radio/voice/`. The callers use the phone-call voice effect. The talk show's calls are **dramatized**: the people are fictional, and the station card says so. Every fact they mention is from SBA.gov and checked against `research/2026-10-17-sba-disaster-loans.md` and `research/2026-10-17-sba-office-of-disaster-recovery-and-resilience.md`:

- Disaster loans help homeowners and renters, not only businesses, in declared disaster areas.
- Home repair loans go up to $500,000; personal property loans up to $100,000, including a car.
- The first payment is deferred 12 months, with no interest building up during that time.
- Business physical damage loans go up to $2 million, an EIDL gives working capital, and a business can have both.
- Apply at lending.sba.gov, by phone, or at a disaster recovery center; book a visit at appointment.sba.gov; Mobile Recovery Vehicles reach hard-to-reach areas.
- Don't wait for an insurance settlement to apply.
- Terms run up to 30 years with no prepayment penalty; up to 20% of the verified loss can be added for mitigation; SBA won't decline a loan for lack of collateral alone; customer service is 800-659-2955.

The full scripts are in `scripts/2026-10-23-radio-script.md` and `scripts/2026-10-24-radio-script-2.md` (Alex, Olivia, and Recovery Talk segment 2, which is written but not yet recorded; the builder adds it to the talk station once its lines exist). Rebuild the stations with `python3 game/tools/make_radio_audio.py`.
