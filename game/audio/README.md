# Audio

All music is licensed from Artlist under the project owner's plan (downloaded unwatermarked on 2026-10-21). Check Artlist's license terms before publishing the game publicly, and keep `source/` out of any public repository.

| File | Track | Used for |
|---|---|---|
| `intro-night-drive.m4a` | "Night Drive" by IamDayLight, cut 1.6–18.5 s | Intro cutscene (16.9 s). The beat kicks in at 2.73 s, where shot 2 starts. |
| `outro-night-drive.m4a` | "Night Drive" by IamDayLight, cut 166.3–183.2 s | Ending cutscene (16.9 s), before the final score |
| `music/stage1-the-bounce.m4a` | "The Bounce" by Ben Fox (album *Frenchouse Franchise*) | Stage 1 |
| `music/stage2-1993.m4a` | "1993" by Calypso Jet, starting at 25.5 s | Stages 2 and 5. The cut skips the spoken intro and starts one bar before the drop (27.4 s in the original). |
| `music/stage3-what-you-know-about.m4a` | "What You Know About" (instrumental) by Avi Rafael (*Futuristic Disco*) | Stage 3 |
| `music/stage4-old-school.m4a` | "Going Back to the Old School" (no lead vocals) by Yarin Primak | Stage 4 |
| `music/stage5-french-touch.m4a` | "French Touch" by Notize | Menus and ending |
| `intro-my-dark-side.m4a` | "My Dark Side" by Gal Lev | Previous intro, no longer used |

The tracks were picked from Artlist's catalog for a French-house / electro feel; none of them are by, or copies of, Daft Punk or Justice. Swap any track in `config.js` → `music`.

Engine sound and effects are generated live with the Web Audio API in `src/audio.js`.
