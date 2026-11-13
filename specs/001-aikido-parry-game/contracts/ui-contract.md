# Contract: Game Page, Screens and Controls

## Page

| Item | Value |
|---|---|
| Address | `/game/` (built from `frontend/game/index.html`) |
| Tab title | English: "Aikido Parry – Tenshinkai Aikido"; Vietnamese equivalent. "Aikido" stays untranslated |
| Link from site | Footer link "Play the Aikido mini-game" on every page of the site |
| Link back | "Back to the dojo website" in the game menu, to `/` |
| Language | Same as the site (shared `dojo.language`), with the same EN/VI toggle in the game menu |
| Home page cost | The home page must not download any file from the game bundle |

## Screens

All screens except the playing field are HTML over the canvas, reachable by keyboard, with
visible focus. Opening a screen moves focus to its heading or first button, and closing returns
it to where it was.

| Screen | Shown when | Contents | Actions |
|---|---|---|---|
| Loading | Before the game's code has started | "Loading the game…" (static text in `game/index.html`, replaced when the app starts) | none |
| Error | The game can't start (no canvas support) or crashes | "The game couldn't start. Try reloading, or go back to the dojo website." | Reload, Back to the dojo website |
| Menu | Page opens (after How to play on first visit) | Title, choice of male or female aikidoka, Easy mode switch, Sound switch, language toggle | Start, How to play, Back to the dojo website |
| How to play | First visit, or from Menu or Pause | Controls for keyboard and touch, picture of the warning, explanation of the parry window | Got it (returns to where it was opened from) |
| Playing | Game running | Canvas; HUD with health bar, wave "Wave 2 of 5", score; touch controls on touch devices | Pause |
| Wave intro | Before each wave | "Wave N" over the field, announced to screen readers | none (2 s) |
| Paused | Escape, Pause button, tab hidden, window blur | "Paused" | Resume, How to play, Quit to menu |
| Rotate | Touch device in portrait | "Turn your device sideways to play" (game paused) | Resume appears once landscape |
| Entrance | After Start | The character walks in from the left, bows at the edge of the mat and steps to the middle; then enemies come | none (about 4 s) |
| Win ending | Last wave cleared | The character bows, then the shoji doors slide closed like the doors on the website's hero (with reduced motion: the doors appear closed without sliding) | none |
| Results | Game won (after the doors close) or lost (at once) | "You win!" or "Good try!", throws, perfect parries, enemies defeated, score | Play again, Menu |

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys or W A S D | Movement pad, bottom left |
| Parry / throw | Space (tap in the window) | "Parry" button, bottom right, larger |
| Block | Hold Space as the hit lands | Hold the "Parry" button |
| Strike | J | "Strike" button, bottom right |
| Pause | Escape or P | Pause button, top right |

- Parry has a cooldown equal to the parry window after every press; strike has a 1.5 s cooldown.
  Presses during a cooldown are ignored. On touch, the button dims during its cooldown.

- Touch buttons are at least 56 × 56 CSS pixels and at least 8 px apart.
- While playing, Space and arrow keys must not scroll the page.
- Holding a key repeats movement but not parry or strike (one press, one action).

## Visual and sound cues

| Event | Visual | Sound |
|---|---|---|
| Enemy winding up | Enemy flashes and a "!" appears above it; with reduced motion, a steady bright outline and "!" instead of flashing | Short rising tone |
| Dasher about to dash | Crouches and leaves a line on the floor showing its path | Low whoosh |
| Successful parry | Throw animation | Bright chime |
| Perfect parry (middle half of the window, or strike + parry combo) | Critical throw: enemy flies twice as far, white flash around both characters ("Combo!" for strike + parry; no caption for a perfect parry); with reduced motion, a steady glow instead of the flash | Deeper two-note gong, different from the normal chime |
| Strike | Short push animation; the enemy's health pips drop by one; a small clock icon over the enemy when its attack was delayed | Light tap |
| Missed parry (stumble) | Character wobbles (no caption) | Dull thud |
| Blocked hit | Character holds a guard, hands up; the attacker bounces off | Short wooden clack |
| Whirlwind kick | Crouch with "!" and dust, a leap, then a spinning kick with a light whirlwind, landing with a burst | Low whoosh at the crouch, impact on landing |
| Parry or strike pressed during cooldown | Nothing (the press is ignored) | none |
| Player hit | Health bar shakes (no shake with reduced motion) | Soft bump |
| Enemy defeated | Puff of smoke | Pop |
| Enemy health | Four small pips above each enemy, emptied one per strike | none |
| Dodge (attack misses because the player moved off the line) | The attack whiffs past and "Dodged!" appears briefly | Soft swish |
| Dasher overshoot | The dasher skids past and turns around | Skid |

## Text

Every game string is in `frontend/src/i18n/game.js`, in English and Vietnamese, covered by its
own key-parity test (`frontend/src/i18n/game.test.js`), and imported only by the game page.
Only the footer link label is in the shared `frontend/src/i18n/strings.js`. Aikido terms (for example "Aikido", "irimi nage")
are the same in both languages.
