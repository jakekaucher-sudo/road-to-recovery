# Cutscene illustrations

Stills for the intro (`art/intro/`) and ending (`art/ending/`) cutscenes, generated on 2026-10-21 with the project owner's Artlist AI tools (model: Nano Banana Pro, 2K, 16:9; 160 credits each). Nine images were used, 1,440 credits in all: four for the first intro, then five more (800 credits) when the intro was extended and the ending was added. The originals are in each folder's `src/`; the game uses the compressed JPEGs.

The prompts describe the look (bold comic-book realism, thick ink outlines, cel shading, 2000s crime-game loading-screen style) rather than naming any game or artist. No logos or text were requested from the model.

## Intro (`src/intro.js`)

| File | Shot |
|---|---|
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

## Jacket print

The print on both driver shots is added in code (`src/cine.js`). The code finds the jacket in the image and centres the print between the shoulder blades. The SBA lockup is cropped from the van's rear artwork (`assets/mrv-van/generated/mrv-van-04-rear-B.png`), not redrawn. "OFFICE OF DISASTER RECOVERY" is set in type. The jacket design follows real photos of SBA disaster staff jackets: bright royal blue, SBA mark and "U.S. Small Business Administration" on the back.
