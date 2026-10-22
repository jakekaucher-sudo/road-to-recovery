# The Road to Recovery

A 3D driving game for SBA Disaster Recovery. Drive the Mobile Recovery Vehicle through five disasters and deliver help to a business, a family home, renters, an auto shop and a church. It runs in any modern browser on a computer, phone or tablet.

All homes, businesses, nonprofits and dollar amounts in the game are fictional / hypothetical and are labeled that way on screen.

## Play

**Play now: https://jakekaucher-sudo.github.io/road-to-recovery/** (computer, phone or tablet)

The playable build is in `docs/` and is served by GitHub Pages. On a phone, turn it sideways and tap to start. Tap **Allow** when asked about motion to steer by tilting, or switch the **STEER** button on the title screen to **DRAG**.

## Edit

- Game source, tools and full documentation: [`game/README.md`](game/README.md)
- Names, amounts, stages, music and tuning: `game/config.js`
- Van artwork: `assets/mrv-van/`

After any change, rebuild the playable copy and push:

```bash
python3 game/tools/build_artifact.py --web
```

Then commit and push `docs/` along with your changes. `game/tools/publish_github.sh` does the first-time setup and later updates.

## Rights

- Music is licensed from Artlist under the project owner's plan. Check Artlist's terms before wider distribution.
- SBA name, logo and van livery belong to the U.S. Small Business Administration.
- Three.js (MIT license) is included in `game/vendor/three/`.
