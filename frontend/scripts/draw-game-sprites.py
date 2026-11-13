"""Draws the mini-game's placeholder character sprites (approved 2026-11-12).

    python3 scripts/draw-game-sprites.py

Writes one sprite sheet per character to src/game/render/sprites/ (male.png, female.png,
walker.png, dasher.png) and sprites.json, which lists every frame. Frames are 80 x 78 pixels,
facing right, with the feet point at (36, 74); 1 pixel = 3 stage units. The game mirrors frames
for facing left and draws the warning "!" itself.

Arcade-brawler proportions (about 5 heads tall) with 2-tone shading. All designs are original.
Each pose is a skeleton of joints; limbs and body parts are drawn as shaded shapes, then a dark
outline is added around the silhouette. An artist can replace the PNGs (same frame size, feet
point and frame names; see sprites/README.md) without changing any game code.

Requires Pillow. The outputs are committed, so this only runs when the drawings change.
"""
import math
import json
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'src' / 'game' / 'render' / 'sprites'
FW, FH = 80, 78
ORIGIN = (36, 74)            # feet point (between the feet, on the floor)
OUTLINE = (38, 26, 20, 255)


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c[:3]) + (255,)


LOOKS = {
    'male': dict(kind='player', skin='#f0c49c', top='#f6f6f2', hakama='#27355e', hair='#1f1a17',
                 style='short', foot='#efefef'),
    'female': dict(kind='player', skin='#f4cfae', top='#f6f6f2', hakama='#27355e', hair='#4b2a1a',
                   style='ponytail', tie='#e8577a', foot='#efefef'),
    'walker': dict(kind='enemy', skin='#e9b98f', top='#3a70c8', pants='#4a5260', hair='#1f1a17',
                   style='cap', cap='#2b55a3', foot='#f0f0f0'),
    'dasher': dict(kind='enemy', skin='#e6b184', top='#b8392c', pants='#2a2a33', hair='#c9682a',
                   style='spiky', band='#f4f4f4', foot='#f0f0f0'),
}

# Skeleton in a standing guard (fists up at chest height, knees slightly bent), facing right.
BASE = dict(
    hip=(0, -21),
    kneeB=(-3, -11), footB=(-5, 0),
    kneeF=(3, -11), footF=(4, 0),
    shB=(-4, -34), elB=(-2, -27), haB=(3, -30),
    shF=(5, -34), elF=(7, -27), haF=(10, -31),
    head=(1, -40),
)
UPPER = ('shB', 'elB', 'haB', 'shF', 'elF', 'haF', 'head')


def rotate(p, c, deg):
    a = math.radians(deg)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(a) - y * math.sin(a), c[1] + x * math.sin(a) + y * math.cos(a))


def skeleton(pose):
    j = dict(BASE)
    j.update(pose.get('joints', {}))
    if pose.get('crouch'):
        for k in list(j):
            if k not in ('footB', 'footF'):
                j[k] = (j[k][0], j[k][1] + pose['crouch'] * (0.5 if k.startswith('knee') else 1))
    if pose.get('bend'):
        for k in UPPER:
            j[k] = rotate(j[k], j['hip'], pose['bend'])
    return {k: (ORIGIN[0] + x, ORIGIN[1] + y) for k, (x, y) in j.items()}


def limb(d, a, b, width, color, dark):
    d.line((a, b), fill=dark, width=width)
    d.line(((a[0] - 0.5, a[1] - 0.5), (b[0] - 0.5, b[1] - 0.5)), fill=color, width=max(1, width - 2))
    r = width / 2
    d.ellipse((b[0] - r, b[1] - r, b[0] + r, b[1] + r), fill=dark)


def fist(d, p, skin):
    x, y = p
    d.rounded_rectangle((x - 2, y - 2, x + 2, y + 2), radius=1, fill=shade(skin, 0.75))
    d.rounded_rectangle((x - 2, y - 2, x + 1, y + 1), radius=1, fill=skin)


def shoe(d, p, look, forward=1):
    x, y = p
    c = rgb(look['foot'])
    d.rectangle((x - 2, y - 2, x + 3, y), fill=shade(c, 0.8))
    d.rectangle((x - 2, y - 2, x + 2, y - 1), fill=c)


def head(d, j, look, pose):
    x, y = j['head']
    skin = rgb(look['skin'])
    hair = rgb(look['hair'])
    # neck
    d.rectangle((x - 1, y + 3, x + 1, y + 6), fill=shade(skin, 0.8))
    style = look['style']
    if style == 'ponytail':
        # ponytail: tied high at the back and hanging down to the shoulders
        d.ellipse((x - 10, y - 4, x - 4, y + 9), fill=shade(hair, 0.85))
        d.ellipse((x - 8, y + 4, x - 5, y + 11), fill=shade(hair, 0.75))
        d.rectangle((x - 6, y - 4, x - 4, y - 2), fill=rgb(look['tie']))
    # skull and face
    d.ellipse((x - 4, y - 5, x + 4, y + 5), fill=skin)
    d.ellipse((x - 4, y - 5, x + 1, y + 5), fill=shade(skin, 0.88))      # shaded back of the head
    if style == 'short':
        d.chord((x - 5, y - 6, x + 5, y + 3), 160, 360, fill=hair)
        d.rectangle((x - 5, y - 3, x - 2, y + 1), fill=hair)
        d.point((x + 3, y - 3), fill=hair)
    elif style == 'ponytail':
        d.chord((x - 5, y - 6, x + 5, y + 3), 160, 360, fill=hair)
        d.rectangle((x - 5, y - 3, x - 2, y + 1), fill=hair)
        d.rectangle((x + 3, y - 3, x + 4, y + 2), fill=hair)
    elif style == 'cap':
        cap = rgb(look['cap'])
        d.chord((x - 5, y - 7, x + 5, y + 2), 180, 360, fill=cap)
        d.rectangle((x + 1, y - 3, x + 7, y - 2), fill=shade(cap, 0.75))
        d.rectangle((x - 5, y - 2, x - 3, y + 1), fill=hair)
    elif style == 'spiky':
        for i in range(-2, 3):
            d.polygon([(x + i * 2 - 1, y - 3), (x + i * 2 - 2, y - 9), (x + i * 2 + 2, y - 4)], fill=hair)
        d.chord((x - 5, y - 6, x + 5, y + 2), 170, 360, fill=hair)
        d.rectangle((x - 5, y - 3, x + 4, y - 2), fill=rgb(look['band']))
        d.rectangle((x - 8, y - 3, x - 5, y - 2), fill=rgb(look['band']))
    ink = OUTLINE
    eyes = pose.get('eyes', 'normal')
    if eyes == 'normal':
        d.rectangle((x + 2, y - 1, x + 2, y), fill=ink)
        d.line((x + 1, y - 2, x + 3, y - 2 if look['kind'] == 'player' else y - 3), fill=ink)   # brow
    elif eyes == 'closed':
        d.line((x + 1, y, x + 3, y), fill=ink)
    else:
        d.line((x + 1, y - 1, x + 3, y + 1), fill=ink)
        d.line((x + 1, y + 1, x + 3, y - 1), fill=ink)
    if pose.get('mouth') == 'shout':
        d.rectangle((x + 2, y + 2, x + 3, y + 3), fill=ink)
    else:
        d.line((x + 2, y + 3, x + 3, y + 3), fill=shade(skin, 0.6))


def torso(d, j, look):
    shB, shF, hip = j['shB'], j['shF'], j['hip']
    top = rgb(look['top'])
    # A slightly V-shaped chest down to the waist.
    poly = [(shB[0] - 2, shB[1]), (shF[0] + 2, shF[1]), (hip[0] + 5, hip[1] - 1), (hip[0] - 5, hip[1] - 1)]
    d.polygon(poly, fill=top)
    d.polygon([poly[0], ((poly[0][0] + poly[1][0]) / 2 - 1, poly[0][1]), (hip[0] - 1, hip[1] - 1), poly[3]],
              fill=shade(top, 0.82))                                     # shadow on the far side
    if look['kind'] == 'player':
        # gi lapels and black belt (aikidoka wear the belt under the hakama top edge)
        d.line(((shF[0] + shB[0]) / 2, shB[1] + 1, hip[0] + 3, hip[1] - 6), fill=shade(top, 0.7))
        d.line((hip[0] - 5, hip[1] - 2, hip[0] + 5, hip[1] - 2), fill=rgb('#1c1c1c'), width=2)
    else:
        if look['style'] == 'spiky':
            cx, cy = (shB[0] + shF[0]) / 2 + 1, shB[1] + 5
            d.rectangle((cx - 1, cy, cx + 1, cy + 3), fill=rgb('#ffffff'))    # jersey number
        else:
            d.line(((shB[0] + shF[0]) / 2 + 1, shB[1] + 1, hip[0] + 1, hip[1] - 1), fill=shade(top, 0.7))  # zip
        d.line((hip[0] - 5, hip[1] - 1, hip[0] + 5, hip[1] - 1), fill=shade(rgb(look['pants']), 0.8), width=2)


def hakama(d, j, look):
    hip, fB, fF = j['hip'], j['footB'], j['footF']
    c = rgb(look['hakama'])
    left = min(fB[0], fF[0]) - 3
    right = max(fB[0], fF[0]) + 4
    bottom = max(fB[1], fF[1]) - 1
    d.polygon([(hip[0] - 5, hip[1] - 2), (hip[0] + 5, hip[1] - 2), (right, bottom), (left, bottom)], fill=c)
    d.polygon([(hip[0] - 5, hip[1] - 2), (hip[0], hip[1] - 2), ((left + right) / 2 - 1, bottom), (left, bottom)],
              fill=shade(c, 0.78))
    for t in (0.35, 0.65):
        x0 = hip[0] - 5 + 10 * t
        x1 = left + (right - left) * t
        d.line((x0, hip[1], x1, bottom - 1), fill=shade(c, 0.6))
    # the front of the hakama follows the front leg a little
    d.line((hip[0] + 5, hip[1] - 2, right, bottom), fill=shade(c, 1.15))


def draw(look, pose):
    img = Image.new('RGBA', (FW, FH))
    d = ImageDraw.Draw(img)
    j = skeleton(pose)
    skin = rgb(look['skin'])
    top = rgb(look['top'])
    legs_c = rgb(look['hakama'] if look['kind'] == 'player' else look['pants'])

    # back arm and back leg in shadow (depth), then body, then the front limbs
    limb(d, j['shB'], j['elB'], 4, shade(top, 0.8), shade(top, 0.62))
    limb(d, j['elB'], j['haB'], 4, shade(top, 0.8), shade(top, 0.62))
    fist(d, j['haB'], shade(skin, 0.9))
    if look['kind'] == 'enemy':
        limb(d, j['hip'], j['kneeB'], 5, shade(legs_c, 0.85), shade(legs_c, 0.65))
        limb(d, j['kneeB'], j['footB'], 4, shade(legs_c, 0.85), shade(legs_c, 0.65))
        if not pose.get('legOver'):
            limb(d, j['hip'], j['kneeF'], 5, legs_c, shade(legs_c, 0.75))
            limb(d, j['kneeF'], j['footF'], 4, legs_c, shade(legs_c, 0.75))
    shoe(d, j['footB'], look)
    if not pose.get('legOver') and not pose.get('legHidden'):
        shoe(d, j['footF'], look)
    if look['kind'] == 'player':
        hakama(d, j, look)
    torso(d, j, look)
    head(d, j, look, pose)
    if pose.get('legOver'):
        # Foreshortened leg pointing at the viewer: a short thick leg ending in the sole.
        limb(d, j['hip'], j['footF'], 6, legs_c, shade(legs_c, 0.75))
        fx, fy = j['footF']
        d.ellipse((fx - 3, fy - 3, fx + 3, fy + 3), fill=shade(rgb(look['foot']), 0.85))
        d.ellipse((fx - 2, fy - 2, fx + 2, fy + 2), fill=rgb(look['foot']))
    limb(d, j['shF'], j['elF'], 4, top, shade(top, 0.72))
    limb(d, j['elF'], j['haF'], 4, top, shade(top, 0.72))
    fist(d, j['haF'], skin)

    if pose.get('lift'):
        img = img.transform(img.size, Image.AFFINE, (1, 0, 0, 0, 1, pose['lift']), resample=Image.NEAREST)
    if pose.get('spin') is not None:
        img = img.rotate(pose['spin'], resample=Image.NEAREST, center=(ORIGIN[0], ORIGIN[1] - 18))
        if pose.get('drop'):
            img = img.transform(img.size, Image.AFFINE, (1, 0, 0, 0, 1, -pose['drop']), resample=Image.NEAREST)
    img = outline(img)
    if pose.get('flip'):
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
        dx = FW - 1 - 2 * ORIGIN[0]
        img = img.transform(img.size, Image.AFFINE, (1, 0, dx, 0, 1, 0), resample=Image.NEAREST)
    effects(ImageDraw.Draw(img), pose)
    return img


def outline(img):
    src = img.load(); out = img.copy(); dst = out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] and src[nx, ny] != OUTLINE:
                    dst[x, y] = OUTLINE
                    break
    return out


def effects(d, pose):
    yellow = rgb('#ffcf33')
    if pose.get('warn'):
        x = ORIGIN[0] + 1
        d.rectangle((x - 1, 2, x + 2, 9), fill=OUTLINE); d.rectangle((x, 3, x + 1, 8), fill=yellow)
        d.rectangle((x - 1, 11, x + 2, 13), fill=OUTLINE); d.rectangle((x, 11, x + 1, 12), fill=yellow)
    if pose.get('impact'):
        x, y = pose['impact']
        for dx, dy in ((6, 0), (4, -5), (0, -6), (5, 3), (-3, -5)):
            d.line((x, y, x + dx, y + dy), fill=yellow, width=2)
    if pose.get('speed'):
        for y in (ORIGIN[1] - 40, ORIGIN[1] - 32, ORIGIN[1] - 24):
            d.line((0, y, 8, y), fill=(43, 29, 20, 170))
    if pose.get('swirl') is not None:
        cx, cy = ORIGIN[0] + 1, ORIGIN[1] - 20 - pose.get('lift', 0)
        start = pose['swirl']
        box = (cx - 20, cy - 6, cx + 20, cy + 6)
        # A light whirlwind: white streak with a pale blue trail, no dark outline.
        d.arc(box, start, start + 200, fill=rgb('#cfe6ff'), width=3)
        d.arc(box, start + 20, start + 190, fill=rgb('#ffffff'), width=1)
        box2 = (cx - 15, cy - 13, cx + 15, cy - 3)
        d.arc(box2, start + 120, start + 260, fill=rgb('#e8f3ff'), width=1)
    if pose.get('dust'):
        for x in (ORIGIN[0] - 12, ORIGIN[0] - 18):
            d.ellipse((x - 3, ORIGIN[1] - 4, x + 3, ORIGIN[1]), fill=rgb('#e6dcc0'), outline=rgb('#bdb08a'))
    if pose.get('stars'):
        for x, y in ((ORIGIN[0] - 12, ORIGIN[1] - 20), (ORIGIN[0] - 2, ORIGIN[1] - 23)):
            for px, py in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                d.point((x + px, y + py), fill=yellow)


P = lambda **joints: joints  # noqa: E731

# ---- Player (aikidoka) ----
PLAYER = {
    'stand': {},
    'walk1': dict(joints=P(kneeB=(-5, -10), footB=(-8, 0), kneeF=(5, -11), footF=(7, 0))),
    'walk2': dict(joints=P(kneeB=(-1, -10), footB=(-2, 0), kneeF=(2, -11), footF=(2, 0))),
    'bow': dict(bend=35, eyes='closed', joints=P(elB=(-3, -27), haB=(-2, -21), elF=(5, -27), haF=(5, -21))),
    'strike': dict(bend=8, mouth='shout', joints=P(elF=(11, -33), haF=(16, -33), kneeF=(6, -11), footF=(9, 0), footB=(-8, 0))),
    # Hold-to-block guard: open hands raised in front of the face.
    'block': dict(joints=P(elB=(3, -30), haB=(6, -39), elF=(9, -31), haF=(9, -41), footB=(-7, 0), footF=(7, 0))),
    # Throw: catch, lead up, turn under (the game mirrors this and the next frame), bring down.
    'grab': dict(joints=P(elB=(6, -30), haB=(12, -31), elF=(9, -32), haF=(14, -32), footB=(-7, 0), footF=(6, 0))),
    'lead': dict(bend=-8, joints=P(elB=(5, -36), haB=(9, -42), elF=(8, -38), haF=(11, -45), footB=(-6, 0), footF=(7, 0))),
    'turn': dict(joints=P(elB=(1, -40), haB=(2, -47), elF=(3, -41), haF=(4, -48), footB=(-5, 0), footF=(5, 0))),
    'follow': dict(bend=30, joints=P(elB=(6, -28), haB=(10, -22), elF=(9, -28), haF=(13, -21), footB=(-8, 0), footF=(8, 0))),
    'stumble': dict(bend=-16, eyes='x', joints=P(elB=(-7, -36), haB=(-9, -41), elF=(9, -37), haF=(11, -42))),
    'hit': dict(bend=-14, eyes='x', mouth='shout', joints=P(elB=(-6, -28), haB=(-8, -24), elF=(4, -27), haF=(1, -23))),
}

# ---- Enemies (troublemakers) ----
def airborne(angle):
    return dict(spin=angle, eyes='x', mouth='shout',
                joints=P(elB=(-7, -36), haB=(-10, -40), elF=(8, -36), haF=(11, -40)))

ENEMY = {
    'stand': {},
    'walk1': PLAYER['walk1'],
    'walk2': PLAYER['walk2'],
    'windup': dict(bend=-12, joints=P(elF=(1, -27), haF=(-4, -31), footB=(-8, 0), footF=(6, 0))),
    'punch': dict(bend=12, mouth='shout', joints=P(elF=(12, -34), haF=(18, -34), kneeF=(7, -11), footF=(10, 0), footB=(-9, 0))),
    'pushed': dict(bend=-14, eyes='x', joints=P(elB=(-6, -28), haB=(-8, -24), elF=(2, -27), haF=(-1, -24))),
    'caught': dict(bend=12, eyes='x', mouth='shout', joints=P(elF=(12, -34), haF=(18, -34), kneeF=(7, -11), footF=(10, 0), footB=(-9, 0))),
    'air1': airborne(50),
    'air2': airborne(180),
    'air3': airborne(250),
    'air4': airborne(290),
    'lying': dict(spin=-90, drop=-10, eyes='x', stars=True, joints=P(elB=(-3, -27), haB=(-2, -21), elF=(5, -27), haF=(5, -21))),
}

# Whirlwind kick (dasher): upright body, arms tucked, kicking leg straight out level with the
# hip (90 degrees), support leg straight down; spins around the body's vertical axis.
KICK_LIFT = 14
TUCK = P(kneeB=(-1, -11), footB=(-1, -1), elB=(-2, -29), haB=(2, -32), elF=(4, -29), haF=(7, -33))
SPIN_SIDE = dict(lift=KICK_LIFT, mouth='shout', joints=dict(TUCK, kneeF=(9, -21), footF=(19, -21)))
DASHER = dict(ENEMY, **{
    'crouch': dict(crouch=5, bend=25, dust=True, joints=P(elB=(-8, -28), haB=(-11, -24), elF=(-2, -28), haF=(-5, -24), footB=(-9, 0), footF=(6, 0))),
    'hop': dict(lift=6, mouth='shout', joints=dict(TUCK, kneeF=(5, -16), footF=(7, -10))),
    'spinFront': dict(SPIN_SIDE, swirl=200),
    'spinToward': dict(lift=KICK_LIFT, bend=-4, mouth='shout', legOver=True, swirl=290, joints=dict(TUCK, kneeF=(3, -25), footF=(4, -27))),
    'spinBehind': dict(SPIN_SIDE, flip=True, swirl=20),
    'spinAway': dict(lift=KICK_LIFT, bend=-4, mouth='shout', legHidden=True, swirl=110, joints=dict(TUCK, kneeF=(-1, -25), footF=(-2, -27))),
    'lands': dict(crouch=3, bend=-6, mouth='shout', impact=(ORIGIN[0] + 15, ORIGIN[1] - 3),
                  joints=P(kneeF=(9, -9), footF=(15, 0), footB=(-8, 0), elB=(-8, -33), haB=(-12, -35), elF=(8, -32), haF=(12, -34))),
})

CHARACTERS = {'male': PLAYER, 'female': PLAYER, 'walker': ENEMY, 'dasher': DASHER}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {'frameWidth': FW, 'frameHeight': FH, 'originX': ORIGIN[0], 'originY': ORIGIN[1],
            'unitsPerPixel': 3, 'characters': {}}
    for key, poses in CHARACTERS.items():
        names = list(poses)
        sheet = Image.new('RGBA', (FW * len(names), FH))
        for i, name in enumerate(names):
            sheet.alpha_composite(draw(LOOKS[key], poses[name]), (i * FW, 0))
        sheet.save(OUT / f'{key}.png', optimize=True)
        meta['characters'][key] = {'image': f'{key}.png', 'frames': names}
    (OUT / 'sprites.json').write_text(json.dumps(meta, indent=2) + '\n')
    print('wrote', ', '.join(f'{k}.png' for k in CHARACTERS), 'and sprites.json to', OUT)


main()
