# Data Model: Aikido Parry Mini-Game

Everything here lives in memory in one browser tab, for one player. Nothing is sent to a server
or stored in a database. The only things kept between visits are the preferences at the end.

Times are in milliseconds of simulation time. Positions are in world units on a fixed
960 × 540 stage that is scaled to fit the screen.

## GameSession

One player's game (spec: Game session).

| Field | Type | Notes |
|---|---|---|
| phase | enum | See state machine below |
| time | number | Simulation time since the game started, in ms. Stops while paused |
| seed | number | Seeds the random generator, so tests can replay a game exactly |
| easyMode | boolean | Fixed when the game starts |
| waveIndex | number | 0 to 4 (5 waves) |
| player | Player | |
| enemies | Enemy[] | Enemies currently on the stage |
| pendingSpawns | Spawn[] | Enemies of the current wave still to appear |
| stats | Stats | |
| events | GameEvent[] | Things that happened during the last step, for sound, effects and announcements |

**State machine (`phase`)**

```text
ready ──start──▶ entering ──▶ waveIntro ──(2 s)──▶ fighting ──wave cleared──▶ waveIntro (next wave)
                                                    │                 └──last wave cleared──▶ leaving ──▶ won
                                         └──player health 0──▶ lost
fighting/waveIntro ──pause──▶ paused ──resume──▶ (phase before pausing)
won / lost ──play again──▶ ready (new session, new seed)
```

- `entering`: the entrance. The player walks in from x -40 to x 100 at 200 per second, bows
  for 1000 ms (`action: 'bowing'`), then walks to the middle (x 480). Movement keys are
  remembered but don't move the player; parry and strike are ignored. Ends with
  `fightStarted`. (Until waves exist, `entering` leads straight to `fighting`.)
- `leaving` (with waves, US2): after the last wave the player bows again, the UI closes the
  dojo doors, then the phase becomes `won` and the results show.
- `paused` remembers the phase it came from. Simulation time doesn't advance while paused.
- Input is ignored in `waveIntro`, `paused`, `won` and `lost`, except pause/resume keys.

## Player

| Field | Type | Notes |
|---|---|---|
| x, y | number | Feet position on the floor area |
| facing | -1 or 1 | Left or right |
| health | number | Starts at 100. Each hit takes 10 (30 for a dash special move). At 0 the game is over (`lost`) |
| action | enum | `idle`, `moving`, `striking`, `throwing`, `stumbling`, `hit`, `blocking`, and during the entrance `entering`, `bowing` |
| actionEndsAt | number | When the current action finishes |
| stumbleUntil | number | Set by a missed parry: `press + 500` (FR-006) |
| parryReadyAt | number | Parry presses before this time are ignored: `press + window` after every press (FR-006) |
| strikeReadyAt | number | Strike presses before this time are ignored: `press + 1500` (FR-007a) |
| guard | object or null | While the parry key is held: `{ since, parried, blocked }`. `parried` is true if the press was a parry; `blocked` becomes true when it blocks a hit (FR-006a) |

Rules:
- Movement stays inside the floor band (FR-001).
- During `throwing` the player can't be hit (the throw lasts 500 ms, as long as the thrown
  enemy's flight).
- Hold to block (FR-006a): a parry press that isn't a parry (and isn't late) starts a guard and
  doesn't stumble yet; the player stands still in `blocking`. A hit that lands while the key is
  still held is blocked: no damage, no points (event `blocked`). Letting go before any hit was
  blocked, while an attack is on its way (an enemy on the player's line in `windingUp`,
  `dashWindUp` or `spinning`), counts as a miss: `stumbleUntil = release + 500` (event
  `missedParry(early)`). With no attack on its way, letting go just lowers the guard. A late
  press (an attack in reach landed in the last window) stumbles at once, as before.
- `hit` lasts 300 ms, after which the player can act again.

## Enemy

| Field | Type | Notes |
|---|---|---|
| id | number | Unique within the session |
| kind | enum | `walker` or `dasher` |
| x, y | number | |

| health | number | Starts at 4. A strike removes 1. Defeated at 0 (FR-008) |
| action | enum | See state machine below |
| actionStartedAt | number | |
| lineY | number or null | While dashing: the line (y) fixed when the dash started (FR-001b) |
| attackLandsAt | number or null | Set while winding up; the parry window ends here |
| fromX, toX | number | Start and end of a throw or push-back. A normal throw ends right beside the player on the far side; a critical throw ends 70 to 140 units from the player on the far side |
| nextAttackNotBefore | number | The enemy can't start a wind-up before this time. Set by a strike to `strike time + random(1000..2500)` from the seeded generator (FR-007) |
| delayUsed | boolean | True once a strike has delayed this enemy; cleared when it next attacks, so it can't be held off forever |
| special | boolean | True for the whirlwind kick (3 × damage) |
| comboArmed | boolean | True after the player strikes this enemy; a successful parry of its next attack is a perfect parry (FR-007b). Cleared when that attack resolves |

**State machine (`action`)**

```text
approaching ──lined up (|dy| <= 20) and in range──▶ windingUp (punch) ──attackLandsAt──▶ attacking ──▶ recovering ──▶ approaching
approaching ──(dasher, lined up, 250 to 450 away)──▶ dashWindUp (500 ms crouch, warning) ──▶ spinning
spinning (whirlwind kick: airborne, travels along its line at 300 per second to a spot beside
          where the player stood; attackLandsAt = when it gets there) ──lands──▶ resolve the hit
          (player off its line: misses, skids 150 units ──▶ recovering 600 ms)
windingUp / spinning ──parried──▶ thrown ──lands──▶ defeated ──(400 ms smoke)──▶ removed
any enemy touched by a thrown enemy ──▶ defeated (by thrownInto)
approaching ──struck──▶ pushedBack ──(300 ms)──▶ approaching   (health 0 after the strike ──▶ defeated)
windingUp ──struck, delayUsed false──▶ pushedBack (wind-up cancelled, delay set)
windingUp ──struck, delayUsed true──▶ stays windingUp, pushed back 60 units, attackLandsAt unchanged
  (a strike sets nextAttackNotBefore and delayUsed only when delayUsed is false;
   every strike sets comboArmed)
```

- `windingUp` (the punch) lasts 700 ms (walker) or 500 ms (dasher). The warning cue starts when
  it starts (FR-003). For the whirlwind kick the warning starts with `dashWindUp`, and the
  parry window ends at `attackLandsAt`, the landing.
- `attacking`: if the player wasn't parrying successfully, they lose 10 health. The attack that
  ends a dash is a **special move** and does 3 × damage (30); a dasher attacking without
  dashing does the normal 10. When the attack resolves (hit or parried), `delayUsed`,
  `comboArmed` and `special` are cleared. A strike that cancels the wind-up also clears
  `special`.
- Struck enemies in other actions (`dashing`, `attacking`, `recovering`, `thrown`, `down`) are
  not affected by a strike.
- Enemies have 4 health points. A strike removes 1; a successful parry defeats the enemy at
  once whatever its health (FR-008). An enemy whose health reaches 0 from strikes is defeated
  (fewer points than a throw). An enemy hit by a thrown body is defeated too.
- Approaching enemies move toward the player's x and also step toward the player's y. They only
  start a wind-up when lined up (`|dy| <= 20`).
- Dodging: when an attack lands, it hits only if `|dy| <= 20` at that moment; otherwise it
  misses (event `dodged`) and the enemy goes to `recovering` (FR-001a).
- `thrown` enemies fly away from the player and become `defeated` when they land. Any other
  enemy they touch on the way (within the chain radius and the line tolerance) is `defeated`
  at once, by `thrownInto`, worth 100 points like a throw. (The `down` action is no longer used.)
- `defeated` enemies play a smoke effect for 400 ms and are then removed. Score goes up.

## Distances (tuning)

Starting values in stage units (the stage is 960 × 540), to be adjusted in play-testing. All
live in `tuning.js`.

| Value | Units | Used for |
|---|---|---|
| Player reach (parry and strike) | 90 across, and within the line tolerance | "within reach" |
| Line tolerance (depth) | 20 up or down | Attacks, parries, strikes, dashes and knock-downs connect only within this (FR-001a) |
| Dasher overshoot | 150 | How far a dasher skids after its kick misses |
| Enemy attack range | 80 | A walker starts its wind-up at this distance or closer |
| Dasher dash range | 250 to 450 | A dasher starts its dash wind-up inside this band |
| Walk speed: player / walker | 220 / 120 per second | Movement |
| Whirlwind kick speed | 300 per second | Travel while spinning (slow enough to react to) |
| Stand-off | 70 | Enemies stop this far from the player; the kick lands here |
| Strike push-back | 60 | `pushedBack`, and the push on a delayed wind-up |
| Throw landing: normal / critical | 45 / 70 to 140 from the player, on the far side | Where a thrown enemy lands (critical: seeded random in the range, 3 to 6 feet) |
| Chain knock-down radius | 40 across, and within the line tolerance | A thrown enemy touching another on its way |

## Parry judgment

A parry press at time `p` against an enemy whose attack lands at `t`, with window `W` (250 ms,
or 500 ms in easy mode):

| Condition | Result |
|---|---|
| `p < parryReadyAt` or `p < stumbleUntil` | **Ignored** (no cooldown is restarted) |
| `t - W <= p <= t` for a winding-up enemy within reach (90 units) | **Success**: that enemy is thrown and defeated, and the player is safe from its attack |
| Otherwise | **Miss**: `stumbleUntil = p + 500` |

- Every press that isn't ignored sets `parryReadyAt = p + W`, so the cooldown is never shorter
  than the window (FR-006).
- A success is **perfect** when `t - 0.75W <= p <= t - 0.25W` (the middle half of the window:
  62.5 to 187.5 ms before the attack lands by default), **or** when the enemy's `comboArmed` is
  true (strike + parry combo, FR-007b).
- A perfect success is a **critical throw**: double throw distance, its own sound and flash
  (FR-005). Either way, the enemy is defeated.
- When several enemies qualify, the one whose attack lands soonest is thrown; if tied, the
  nearest. The others can still hit (spec edge case).

## Strike judgment

A strike press at time `s`:

| Condition | Result |
|---|---|
| `s < strikeReadyAt` | **Ignored** |
| Otherwise | `strikeReadyAt = s + 1500`. The nearest enemy within reach (90 units) that is `approaching` or `windingUp` is pushed back (see enemy rules). If none is in reach, the strike still plays and the cooldown still starts |

## Wave and Spawn

| Wave | Walkers | Dashers | Max on stage at once |
|---|---|---|---|
| 1 | 4 | 0 | 2 |
| 2 | 5 | 1 | 2 |
| 3 | 6 | 2 | 3 |
| 4 | 6 | 4 | 3 |
| 5 | 7 | 5 | 4 |

- Spawns enter from the left or right edge (random side, from the seed), at least 1 s apart.
- Enemy counts were raised when one parry became enough to defeat an enemy (40 enemies in
  total, up from 31).
- These numbers are tuning values kept in one place, to be adjusted in play testing toward the
  3 to 5 minute target (SC-003).

## Stats and GameResult

| Field | Type | Notes |
|---|---|---|
| throws | number | Successful parries (each defeats an enemy) |
| perfectParries | number | Perfect parries: presses in the middle half of the window, plus strike + parry combos |
| combos | number | Strike + parry combos (also counted in perfectParries) |
| enemiesDefeated | number | By throws, by strikes, and by being hit by a thrown enemy |
| dodges | number | Attacks avoided by moving off the line (not shown on results; for tuning) |

| score | number | 100 per throw, +50 per perfect parry (critical throw), 100 per other enemy defeated by a thrown one, 50 per enemy defeated by strikes, 0 for dodges |
| outcome | `won` or `lost` | Only on the result |
| wavesCleared | number | Only on the result |

Discarded when the player leaves or presses "Play again" (FR-019).

## GameEvent

Emitted by the engine each step so the UI can react without reading engine internals.

`waveStarted(n)`, `warning(enemyId)`, `parried(enemyId, { perfect, combo })`,
`missedParry(early | late)`, `struck(enemyId | null, { delayed })`, `playerHit(amount, special)`,
`dodged(enemyId)`, `blocked(enemyId)`, `dashStarted(enemyId)`, `overshoot(enemyId)`, `enemyDefeated(enemyId, by: 'throw' | 'strikes' | 'thrownInto')`,
`fightStarted`, `gameWon`, `gameLost`.

## Preferences (stored on the device)

| Key | Values | Purpose |
|---|---|---|
| `dojo.game.seenHelp` | `"1"` | Skip the automatic How to play screen after the first time |
| `dojo.game.easy` | `"1"` or missing | Easy mode |
| `dojo.game.sound` | `"1"` or missing | Sound on, set only by the sound button or switch (FR-024) |
| `dojo.game.character` | `"male"` or `"female"` | The chosen aikidoka (FR-019a); male when missing |

The language comes from the site's existing `dojo.language` key. All reads and writes are
guarded, and the game works the same when storage is unavailable.
