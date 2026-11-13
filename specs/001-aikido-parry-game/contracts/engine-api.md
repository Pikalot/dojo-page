# Contract: Game Engine API

The engine is plain JavaScript with no React, DOM, canvas or timer access. The UI owns the clock
and the screen. This boundary is what makes the timing rules testable without a browser.

Location: `frontend/src/game/engine/`

## Functions

```text
createSession({ seed, easyMode }) -> GameSession
```
Returns a session in phase `ready`. Same seed and same inputs always give the same game.

```text
start(session) -> void
```
`ready` → `entering` (walk in, bow, step to the middle) → `waveIntro` for wave 1. Until waves exist, `entering` leads straight to `fighting`.

```text
pushInput(session, input) -> void
```
Queues an input to be applied at its own time on the next `step`.

`input` is one of:

| type | fields | from |
|---|---|---|
| `move` | `dx` (-1, 0, 1), `dy` (-1, 0, 1), `at` | key down/up, touch pad |
| `parry` | `at` | Space down, Parry button down |
| `parryRelease` | `at` | Space up, Parry button up (ends a hold-to-block guard, FR-006a) |
| `strike` | `at` | J, Strike button |

`at` is simulation time in ms. The UI converts the browser event's timestamp to simulation time
(see `clock.js` below), so parries are judged at the moment of the press, not the frame.

```text
step(session, dtMs) -> GameEvent[]
```
Advances the simulation by exactly `dtMs` (the UI always passes 1000/60). Applies queued inputs
in time order, moves everyone, resolves attacks, parries, throws and wave changes, and returns
what happened. Does nothing while `paused`, `won` or `lost`.

```text
pause(session) -> void      resume(session) -> void
```
Enter or leave `paused`. Calling `pause` when already paused, or `resume` when not paused, does
nothing.

```text
result(session) -> GameResult | null
```
Returns the result once the phase is `won` or `lost`, otherwise `null`.

## Supporting modules

| Module | Responsibility |
|---|---|
| `tuning.js` | All numbers from the data model (windows, perfect zone, cooldowns, strike delay range, distances, durations, damage to the player, waves, score) |
| `random.js` | Seeded random number generator |
| `parry.js` | Parry and strike judgment (pure functions of press time, enemies, player, window), including cooldowns, perfect zone and combo |
| `enemies.js` | Enemy state machine |
| `waves.js` | Builds and releases each wave's spawns |
| `clock.js` | Fixed-step accumulator and event-time to simulation-time conversion; pauses on demand |

## Guarantees the UI relies on

1. The engine never reads the real clock. Only `step` moves time forward.
2. A `parry` input with `at` inside the window, while the parry isn't on cooldown or stumbling, always succeeds, whatever `dtMs` steps surround
   it (SC-002).
3. `step` returns events in the order they happened.
4. The engine never stores anything outside the session object.
