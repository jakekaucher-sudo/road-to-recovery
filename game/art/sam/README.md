# Pilot Sam

`sam.png` is the portrait shown when Sam comes on the radio during the helicopter escort. It is cut out of the character art supplied by the project owner (`src/sam-original.webp`, not published) with `dev/cutout.html`:

    python3 game/tools/save_cutout.py "src=../art/sam/src/sam-original.webp&crop=250,380,1000,1020&w=512&seeds=605,577;921,577;974,972;985,1000" game/art/sam/sam.png

`crop` frames him from the hat to the bolo tie; `seeds` mark the white pockets inside the headset band and beside the mic cable, which the edge fill cannot reach.
