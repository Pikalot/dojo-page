"""Draws the mini-game's dojo background as flat, light cartoon pixel art.

    python3 scripts/draw-game-background.py

Output: src/game/render/dojo-background.png, 320 x 180 pixels for the 960 x 540 stage
(1 pixel = 3 stage units). The game draws it scaled up without smoothing, so pixels stay crisp.

The layout follows the site's hero photo (shoji windows, wooden pillars and panels, the
kamiza frame with the 合氣道 scroll, bonsai and low table), redrawn with flat colours and
outlines, with no shadows or lighting. The floor starts at stage y 280 (pixel 93), where the
game's floor band begins. Drawn pixel by pixel with no anti-aliasing.

Requires Pillow and the macOS font Heiti TC (for 合氣道). The output is committed, so this only
runs when the drawing or the stage layout changes.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUTPUT = Path(__file__).resolve().parent.parent / "src" / "game" / "render" / "dojo-background.png"
W, H, FLOOR_Y = 320, 180, 93
C = dict(
    wall='#fbf3e1', paper='#fffdf6', lattice='#c99a6b', wood='#cf8a50', woodLine='#6b3e1f',
    torii='#d9693c', panel='#e0a46c', scroll='#7f8f68', scrollPaper='#f7eccd', ink='#2b2118',
    leaf='#86c45f', leafDark='#5f9a43', pot='#4a5a70', tatami='#ece5c3', seam='#d3c799',
    edge='#f3a24f', step='#b8743f',
)
im = Image.new('RGB', (W, H), C['wall'])
d = ImageDraw.Draw(im)

def box(x0, y0, x1, y1, fill, line=C['woodLine']):
    d.rectangle((x0, y0, x1, y1), fill=fill, outline=line)

# Ceiling beam
box(-1, -1, W, 3, C['wood'])

# Side walls: shoji windows (paper + lattice) over wooden wainscot panels
for x0, x1 in ((0, 47), (274, 319)):
    box(x0, 12, x1, 71, C['paper'])
    for x in range(x0 + 8, x1, 9):
        d.line((x, 13, x, 70), fill=C['lattice'])
    for y in range(20, 71, 9):
        d.line((x0 + 1, y, x1 - 1, y), fill=C['lattice'])
for x0, x1 in ((0, 111), (209, 319)):
    box(x0, 71, x1, FLOOR_Y, C['panel'])
    for x in range(x0 + 10, x1, 12):
        d.line((x, 73, x, FLOOR_Y - 1), fill=C['wood'])
# Rails above the windows
box(0, 9, 111, 12, C['wood'])
box(209, 9, 319, 12, C['wood'])
# Pillars
for x0, x1 in ((47, 56), (264, 273)):
    box(x0, 3, x1, FLOOR_Y, C['wood'])

# Kamiza: torii-style frame, scroll, bonsai, low table
box(98, 3, 222, 7, C['torii'])        # top beam
box(104, 12, 216, 15, C['torii'])     # lower beam
box(111, 3, 118, FLOOR_Y, C['torii']) # posts
box(202, 3, 209, FLOOR_Y, C['torii'])
box(146, 18, 174, 76, C['scroll'])
box(149, 21, 171, 72, C['scrollPaper'], line=C['scroll'])
d.line((144, 18, 176, 18), fill=C['woodLine'])
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 15, index=0)  # Heiti TC
for i, ch in enumerate('合氣道'):
    mask = Image.new('L', (20, 18), 0)
    ImageDraw.Draw(mask).text((10, 9), ch, font=font, fill=255, anchor='mm')
    mask = mask.point(lambda v: 255 if v > 90 else 0)
    im.paste(C['ink'], (150, 23 + i * 16), mask)
# Bonsai
box(130, 75, 140, 82, C['pot'])
d.line((135, 74, 134, 66), fill=C['woodLine'], width=2)
for cx, cy, r in ((129, 66, 5), (138, 64, 5), (134, 61, 4)):
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=C['leaf'], outline=C['leafDark'])
# Low table across the kamiza
box(118, 83, 202, 87, C['wood'])
box(122, 87, 125, FLOOR_Y, C['wood'])
box(195, 87, 198, FLOOR_Y, C['wood'])
# Step where the floor meets the wall
box(-1, FLOOR_Y, W, FLOOR_Y + 3, C['edge'], line=C['step'])

# Tatami floor: flat colour with seams in perspective (vanishing point above the kamiza)
d.rectangle((0, FLOOR_Y + 4, W, H), fill=C['tatami'])
vx, vy = 160, 20
for x in range(-480, 800, 80):
    # seam from the back edge toward the viewer, following the perspective
    xb = vx + (x - vx) * (FLOOR_Y + 4 - vy) / (H - vy)
    d.line((xb, FLOOR_Y + 4, x, H), fill=C['seam'])
for y in (104, 118, 138, 166):
    d.line((0, y, W, y), fill=C['seam'])

im.save(OUTPUT, optimize=True)
print(f"wrote {OUTPUT.name} ({OUTPUT.stat().st_size} bytes)")
