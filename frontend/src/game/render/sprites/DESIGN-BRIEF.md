# Sprite design brief: Aikido Parry

Thank you for drawing the characters for **Aikido Parry**, a short browser game on the
Tenshinkai Aikido dojo website. Players are kids aged 10 and up. Troublemakers walk into a
dojo and attack; the player is an aikidoka who parries at the right moment and throws them,
Aikido style.

This brief covers what to draw, how each move is timed, and the file format. The game already
runs with placeholder sprites in this folder (`male.png`, `female.png`, `walker.png`,
`dasher.png`), so you can see every pose in motion before you start. The frame rules in
[README.md](README.md) still apply; this brief adds the art direction and the move breakdown.

---

## 1. Style

- **Arcade-brawler pixel art.** Characters are about **5 heads tall**, with normal proportions,
  a solid stance and readable silhouettes.
- **Shading**: 2 to 3 tones per colour, light from the upper left, the far arm and leg one
  tone darker for depth.
- **Outline**: a 1 px dark outline (`#261a14`) around each character.
- **Faces**: clear at small size. Determined for the aikidoka, cheeky rather than scary for
  the troublemakers.
- **Background**: a flat, light cartoon pixel-art dojo (`../dojo-background.png`). Test your
  colours against it.

**Must**:

- All designs are **original**. Inspiration from classic brawlers is welcome; copying
  characters, costumes, poses frame by frame or sprites from any existing game is not.
- Suitable for kids: **no weapons, no blood, no injuries**, nothing frightening.
  Defeated characters just lie down and vanish in a puff of smoke, which the game draws.

---

## 2. Cast

| Character | Look | Notes |
|---|---|---|
| **Aikidoka, male** (player) | White gi, dark navy hakama (wide pleated trousers), short dark hair | Calm, upright posture |
| **Aikidoka, female** (player) | Same gi and hakama, long brown hair in a high ponytail with a pink tie | Must read as clearly different from the male at a glance |
| **Walker** (enemy) | Blue cap and blue zip jacket, grey trousers, white trainers | Walks in and punches |
| **Dasher** (enemy) | Spiky orange hair, white headband, red jersey with a white number patch, black trousers, white trainers | Punches up close; from a distance does the whirlwind kick |

Current placeholder colours, for reference (adjust freely):

| | Hex |
|---|---|
| Gi | `#f6f6f2` |
| Hakama | `#27355e` |
| Walker jacket / cap | `#3a70c8` / `#2b55a3` |
| Dasher jersey / hair | `#b8392c` / `#c9682a` |

---

## 3. The four phases of every attack

Every attack is drawn in **four phases**. The game uses the phases for gameplay, so each phase
has to be **clearly readable on its own**.

```text
 WIND-UP ─────────────▶ ACTION ──────▶ IMPACT ──▶ FOLLOW-THROUGH / RECOVERY
 the warning:           the attack     the hit    off balance, then back
 "something is coming"  moving in      lands      to the guard

 ◀──────────────── GRAB (parry) window ─────────────▶
                         ◀─── PERFECT parry ───▶
```

| Phase | What it must show | Frames | Target length |
|---|---|---|---|
| **1. Wind-up** | The telegraph. A big, unmistakable pose change (fist pulled back, crouch). It must read in under a quarter of a second, by a kid, at small size | 2 to 3 | about 450 ms |
| **2. Action** | The attack travelling toward the player: arm extending, body lunging, the kicker in the air | 1 to 2 (the kick loops, see below) | about 150 ms (a punch) |
| **3. Impact** | The moment of contact: arm fully extended, the foot planting. The strongest pose of the move | 1 | about 100 ms |
| **4. Follow-through / recovery** | Overextended, then back to the guard. The attacker is visibly open here | 2 | about 400 ms |

**What the phases mean in play** (so you know which frames matter most):

- **Grab window: wind-up to impact.** The player can parry and throw from the first wind-up
  frame until the impact frame. So the wind-up must start a clear, readable warning.
- **Perfect parry: action and impact.** Parrying in these phases gives a critical throw that
  sends the attacker flying further. These frames should feel like the "now!" moment.
- **Recovery**: too late to parry; the hit has landed.

The game sets the exact timings, and they'll be tuned in play-testing. Please draw for the
target lengths above and tell us how many frames each phase has. You can use more frames
than listed; the game shows them spread evenly across the phase.

---

## 4. Frame list

Frame names use `move_phase_number`, for example `punch_windup_1`. Draw everything **facing
right**; the game mirrors frames for characters facing left.

### 4.1 Aikidoka (male and female: the same frames for each)

| Move | Frames | Notes |
|---|---|---|
| Stand (guard) | `stand_1` to `stand_2` | Fists or open hands at chest height. A slight breathing loop is welcome |
| Walk | `walk_1` to `walk_4` | Keep the guard while walking; the hakama sways |
| Bow (rei) | `bow_1` to `bow_3` | A standing bow from the hips, feet together. Used at the start and at the end of a game |
| Guard (hold to block) | `block_1` | Open hands raised in front of the face. Must **not** look like a throw |
| Strike | `strike_windup_1`, `strike_action_1`, `strike_impact_1`, `strike_recover_1` | A short open-hand push (no punching). The player's own attack, same four phases |
| Throw | `throw_catch_1`, `throw_lead_1` to `throw_lead_2`, `throw_turn_1` to `throw_turn_2`, `throw_drop_1` to `throw_drop_2` | Catch the attacker's arm, lead them up and off balance, turn underneath, bring them down on the far side. About 500 ms in all. See 4.4 |
| Stumble | `stumble_1` to `stumble_2` | After a mistimed parry. Clearly **off balance** (arms out to the sides, one foot lifted, wobbling). Must **not** look like the throw |
| Hit | `hit_1` | Recoiling from a hit, eyes shut. No injury shown |

### 4.2 Walker

| Move | Frames | Notes |
|---|---|---|
| Stand (guard) | `stand_1` to `stand_2` | Fists up |
| Walk | `walk_1` to `walk_4` | |
| **Punch** | `punch_windup_1` to `punch_windup_3`, `punch_action_1` to `punch_action_2`, `punch_impact_1`, `punch_recover_1` to `punch_recover_2` | The four phases above. Wind-up: fist drawn back and the body coiled; action: lunge; impact: arm fully out; recovery: overextended, then back to the guard |
| Pushed back | `pushed_1` | Rocked back by the player's strike |
| Caught | `caught_1` | Arm caught at the start of a throw, surprised face. Same pose as the punch impact, with the expression changed |
| Thrown | `thrown_1` to `thrown_4` | Rising, upside down over the aikidoka, coming down, about to land. The game moves the character along the arc; draw each pose centred on its own feet point |
| Lying (defeated) | `lying_1` | Flat on the floor, dizzy. The game fades it into smoke |

### 4.3 Dasher

All of the walker's frames, in the dasher's look, plus the **whirlwind kick**:

| Phase | Frames | Notes |
|---|---|---|
| **Wind-up** | `kick_windup_1` to `kick_windup_2` (crouch), `kick_windup_3` (hop) | A low crouch with dust at the heels, then a small hop into the air |
| **Action** | `kick_action_1` to `kick_action_4` (spin loop) | Airborne spin around the body's vertical axis. Body upright, arms tucked, **support leg straight down**, **kicking leg straight out at hip height (90°)**. The four frames show the leg in front, toward the viewer, behind and away. The game loops them every 60 ms (a full turn in about a quarter of a second) while the dasher travels in |
| **Impact** | `kick_impact_1` | Landing: the kicking foot plants hard. This is when the hit lands |
| **Recovery** | `kick_recover_1` to `kick_recover_2` | Skidding to a stop, then back to the guard. Also used when the kick misses and the dasher skids past |

### 4.4 The throw: how the two characters fit together

The aikidoka's throw frames and the attacker's thrown frames play **at the same time**:

| Time | Aikidoka | Attacker |
|---|---|---|
| 0 to 25% | `throw_catch_1` | `caught_1` |
| 25 to 50% | `throw_lead_*` | `thrown_1` (rising) |
| 50 to 75% | `throw_turn_*` (now facing the far side) | `thrown_2` (upside down, above the aikidoka's head) |
| 75 to 100% | `throw_drop_*` | `thrown_3` to `thrown_4` (coming down on the far side) |

After a normal throw the attacker lands **right beside** the aikidoka, on the side opposite
where they attacked from. After a perfect parry they fly on and land 3 to 6 feet away; same
frames, just a longer arc. A short preview of the placeholder throw is available from the
game team if it helps.

---

## 5. Technical specification

| | |
|---|---|
| Frame size | **80 × 78 px** for every frame. Ask before going larger (bigger frames need a small code change) |
| Feet point | **(36, 74)**: the point between the feet, on the floor, in every frame. Airborne poses keep the same point as the "ground under the character" |
| Character height | About **45 px** standing (1 px = 3 game units; the game scales up ×3 with crisp pixels) |
| Facing | Right, in every frame |
| Background | Transparent |
| Not in the frames | The "!" warning, health dots, glows, flashes and smoke. The game draws these on top. Motion lines and dust that belong to a pose are fine |
| Format | One PNG sheet per character, frames in a single row, 80 px apart, in the order of your frame list |
| Smoothing | None (hard pixel edges, no anti-aliasing against transparency) |

---

## 6. Deliverables

1. `male.png`, `female.png`, `walker.png`, `dasher.png` in the format above.
2. A frame list per sheet (names in order, and which phase each frame belongs to). A simple
   text or JSON file is fine; we'll turn it into `sprites.json`.
3. Layered source files (for example Aseprite or PSD).
4. A short animated preview (GIF) of each move, so we can check the timing.
5. Confirmation that the work is your own original artwork, and the licence terms agreed with
   the dojo for using it in the game and on the website.

## 7. Checklist before sending

- [ ] Every frame is 80 × 78 px, facing right, with the feet at (36, 74)
- [ ] Each attack's **wind-up is readable** in a single glance at game size
- [ ] Action and impact frames read as "now!"; recovery reads as "open"
- [ ] Block, stumble and throw poses can't be mistaken for each other
- [ ] Male and female aikidoka are easy to tell apart; walker and dasher too
- [ ] No weapons, blood or frightening faces
- [ ] Looks good on `dojo-background.png` at 3× scale

Questions about gameplay or timing go to the game team. To see the current placeholders in
motion, run the game (`npm run dev` in `frontend/`, then open `http://localhost:5173/game/`).
