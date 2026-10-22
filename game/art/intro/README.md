# Cutscene illustrations

Stills for the intro (`art/intro/`) and ending (`art/ending/`) cutscenes, generated on 2026-10-21 with the project owner's Artlist AI tools (model: Nano Banana Pro, 2K, 16:9; 160 credits each). Nine images were used, 1,440 credits in all: four for the first intro, then five more (800 credits) when the intro was extended and the ending was added. The originals are in each folder's `src/`; the game uses the compressed JPEGs.

The prompts describe the look (bold comic-book realism, thick ink outlines, cel shading, 2000s crime-game loading-screen style) rather than naming any game or artist. No logos or text were requested from the model.

## Intro (`src/intro.js`)

| File | Shot |
|---|---|
| `shot0a-desk.jpg` | HQ prologue: Randle Logan at his desk at night, Monument and Capitol through the window |
| `shot0b-call.jpg` | HQ prologue: video call, Chris Stallings on the monitor (cropped to remove a black band) |
| `shot0c-button.jpg` | HQ prologue: Randle's hand on the red MRV button under the desk (cropped to remove a panel border) |
| `shot1-aerial.jpg` | Aerial over the Potomac: Lincoln Memorial, Reflecting Pool, Washington Monument, Capitol |
| `shot2-avenue.jpg` | Overhead downtown avenue with light trails and a van |
| `shot-bridge.jpg` | A van crossing Memorial Bridge at night toward the Lincoln Memorial, light trails on the deck |
| `shot3-mall.jpg` | The Mall at night, Monument in front of the Capitol (cropped to remove a fake "LOADING" bar the model added) |
| `shot-interior.jpg` | The driver at the wheel, the Capitol through the rainy windshield |
| `shot4-driver.jpg` | The driver from behind on a rooftop, plain royal-blue jacket |

## Ending (`src/outro.js`, files in `art/ending/`)

| File | Shot |
|---|---|
| `end-dawn.jpg` | Sunrise on a recovering main street: neighbours sweeping up, church and family home behind |
| `end-open.jpg` | A baker turning the door sign to OPEN |
| `end-driver.jpg` | The driver from behind on a hill over a coastal town at sunrise, plain royal-blue jacket |

## HQ prologue (added 2026-10-22)

The three HQ stills were generated with Nano Banana Pro from portrait photos of Randle Logan and Chris Stallings supplied by the project owner, with two existing intro stills as style references. Each was then edited once on request: more serious, slightly more muscular Randle; a fitter Chris; extra feet removed under the desk. Six generations, 960 credits. The "MRV" lettering on the button was drawn by the model. Speech bubbles, captions and the beacon are drawn in code.

The game shows real officials' likenesses and gives them a scripted line, so confirm they're comfortable with it before sharing widely.

## Disaster Recovery beacon

The searchlight in the sky (`drawBeacon` in `src/cine.js`) carries the "DISASTER RECOVERY" lettering cut from the van's official rear artwork (`assets/mrv-van/generated/mrv-van-04-rear-B.png`), not redrawn. Each shot has its own position in `BEACON` in `src/intro.js`.

## Jacket print

The print on both driver shots is added in code (`src/cine.js`). The code finds the jacket in the image and centres the print between the shoulder blades. The SBA lockup is cropped from the van's rear artwork (`assets/mrv-van/generated/mrv-van-04-rear-B.png`), not redrawn. "OFFICE OF DISASTER RECOVERY" is set in type. The jacket design follows real photos of SBA disaster staff jackets: bright royal blue, SBA mark and "U.S. Small Business Administration" on the back.
