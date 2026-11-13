---

description: "Task list for the Aikido Parry Mini-Game"
---

# Tasks: Aikido Parry Mini-Game

**Input**: Design documents from `/specs/001-aikido-parry-game/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/engine-api.md](contracts/engine-api.md),
[contracts/ui-contract.md](contracts/ui-contract.md), [quickstart.md](quickstart.md)

**Tests**: Included. Constitution principle VI requires unit tests for application logic,
component tests for interactive UI and Playwright tests for layout and keyboard behavior. Write
each story's tests first and confirm they fail before implementing.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: Which user story the task belongs to (US1 to US4)
- All paths are relative to the repository root. All work is under `frontend/`; nothing changes
  under `backend/`.

## Conventions for every task

- No new npm dependencies (constitution VII, research R1).
- The engine (`frontend/src/game/engine/`) must not touch React, the DOM, canvas, timers or
  `Date.now()`/`performance.now()` (contracts/engine-api.md guarantee 1).
- All user-visible game text goes in `frontend/src/i18n/game.js` under `game` (inside
  `src/i18n/` as constitution III requires, and imported only by the game page), in both `en`
  and `vi` (research R12). Only the footer link label goes in `frontend/src/i18n/strings.js`,
  so the home page doesn't download game text. Aikido terms stay untranslated.
- Styles use variables from `frontend/src/styles/tokens.css`; each component has its own CSS
  file.
- Every `localStorage` access is wrapped in try/catch, like `frontend/src/i18n/LanguageContext.jsx`.
- Do not edit content in `frontend/src/data/mock/*.json`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the second page and make it build, without any gameplay yet.

- [X] T001 Create `frontend/game/index.html` as a second Vite entry: copy the head of
  `frontend/index.html` (charset, viewport, favicon, theme-color), set `<title>` to
  "Aikido Parry – Tenshinkai Aikido", a `<meta name="description">` for the game, a
  `<noscript>` message, `<div id="root"><p class="game-loading">Loading the game…</p></div>` (the loading state,
  replaced when React renders; FR-027) and
  `<script type="module" src="/src/game/main.jsx"></script>`
- [X] T002 Update `frontend/vite.config.js` to build two entries with
  `build.rollupOptions.input = { main: resolve(__dirname, 'index.html'), game: resolve(__dirname, 'game/index.html') }`
  (import `resolve` from `node:path` and derive `__dirname` with `fileURLToPath`), keeping the
  existing `proxy` and `test` settings unchanged
- [X] T003 Create `frontend/src/game/main.jsx` that imports `../styles/tokens.css`,
  `../styles/base.css` and `gameStrings` from `../i18n/game.js`, then renders
  `<StrictMode><LanguageProvider titleKey="game.meta.title" extraStrings={gameStrings}><ErrorBoundary fallback={<GameError />}><GameApp /></ErrorBoundary></LanguageProvider></StrictMode>`
  into `#root`, and a placeholder `frontend/src/game/GameApp.jsx` that renders an `<h1>` with
  `t.game.meta.title` (GameError is created in T018; leave the fallback out until then)
- [X] T004 Update `frontend/src/i18n/LanguageContext.jsx` so `LanguageProvider` accepts two
  optional props: `extraStrings` (an object `{ en: {...}, vi: {...} }` merged into `t` for the
  current language) and `titleKey` (dot path into the merged strings, default `"meta.title"`)
  used for `document.title`. The main site keeps working unchanged without the props. Add tests
  for both props in `frontend/src/i18n/LanguageContext.test.jsx`
- [X] T005 Create `frontend/src/i18n/game.js` exporting
  `gameStrings = { en: { game: {...} }, vi: { game: {...} } }`, starting with `game.meta.title`
  ("Aikido Parry – Tenshinkai Aikido" / Vietnamese equivalent keeping "Aikido Parry"), and
  `frontend/src/i18n/game.test.js` checking that English and Vietnamese key paths match (same
  approach as `frontend/src/i18n/strings.test.js`)
- [X] T006 Run `npm run build` in `frontend/` and confirm `frontend/dist/game/index.html` and
  `frontend/dist/index.html` both exist and that no JS file loaded by `dist/index.html` contains code or text from `src/game/` (for
  example, search them for the game title string)

**Checkpoint**: `/game/` loads an empty titled page in dev and in the production build.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Engine core, clock, loop, input and drawing that every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the foundation

- [X] T007 [P] Write `frontend/src/game/engine/random.test.js`: same seed gives the same
  sequence; different seeds differ; values are in [0, 1)
- [X] T008 [P] Write `frontend/src/game/engine/clock.test.js`: the fixed-step accumulator runs
  `floor(elapsed / (1000/60))` steps and carries the remainder; it runs at most 5 steps per frame
  (to avoid a spiral after a long frame); converting a browser event timestamp to simulation
  time is correct after pauses (paused time is excluded)

### Implementation

- [X] T009 [P] Create `frontend/src/game/engine/tuning.js` exporting every number from
  data-model.md in one frozen object: `STEP_MS = 1000/60`, stage `960 × 540`, floor band,
  player health `100`, parry window `250` ms and easy `500` ms, perfect zone = middle half of the window (from `0.75 × window` to `0.25 × window` before the
  attack lands), parry cooldown = the window length after every press, stumble `500` ms, strike
  cooldown `1500` ms, strike delay random `1000` to `2500` ms, distances in stage units (line tolerance `20` up or down, player reach `90`, enemy attack range `80`, dasher dash range `250`
  to `450`, walk speed player `220` and walker `120` per second, dash speed `700` per second,
  strike push-back `60`, throw distance normal `200` and critical `400`, chain knock-down radius `40`, dasher overshoot `150`), dasher recover after overshoot `600` ms, throw `400` ms, player hit `300` ms, walker wind-up `700` ms,
  dasher wind-up `500` ms, dash wind-up `500` ms, down time `1000` ms, pushed back `300` ms,
  smoke `400` ms, damage to the player `10` per hit, `3`× for the special move that ends a dash, enemy health `4` and strike damage `1` (a
  successful parry defeats at once),
  wave intro `2000` ms, spawn gap at least `1000` ms, the 5-wave table (walkers, dashers, max on
  stage: 4/0/2, 5/1/2, 6/2/3, 6/4/3, 7/5/4), and score values (throw `100`, enemy defeated by strikes `50`, dodge `0`, perfect `+50`, chain
  defeat (an enemy hit by a thrown one) `100`)
- [X] T010 [P] Create `frontend/src/game/engine/random.js`: a small seeded generator
  (for example mulberry32) exporting `createRandom(seed)` with `next()` and `int(min, max)`
- [X] T011 [P] Create `frontend/src/game/engine/clock.js` per T008: `createClock()` with
  `advance(frameMs)` returning the number of fixed steps to run, `pause()`, `resume()`, and
  `toSimTime(eventTimeStamp)` mapping a `performance.now()`-based timestamp to simulation ms
- [X] T012 Create `frontend/src/game/engine/session.js` with `createSession({ seed, easyMode })`
  returning the GameSession from data-model.md in phase `ready` (player at stage center,
  `health: 100`, `action: 'idle'`, empty `enemies`, `pendingSpawns`, `events`, zeroed `stats`),
  plus `pushInput(session, input)` that queues `{ type: 'move'|'parry'|'strike', at, dx?, dy? }`
  and a `step(session, dtMs)` that advances `time` and applies queued `move` inputs in `at`
  order, keeping the player inside the floor band (FR-001). Other functions are added in the
  story phases
- [X] T013 Create `frontend/src/game/engine/session.test.js` with the first tests: a new session
  is `ready`; movement inputs move the player and never leave the floor band; the engine never
  calls `performance.now` or `Date.now` (spy and assert not called)
- [X] T014 [P] Create `frontend/src/game/input/keyboard.js`: `attachKeyboard(target, onInput, clock)`
  mapping Arrow keys and W/A/S/D to `move`, Space to `parry`, J to `strike`, Escape and P to a
  `pause` callback; parry and strike ignore `event.repeat`; calls `preventDefault()` for Space
  and arrow keys while playing so the page doesn't scroll; stamps each input with
  `clock.toSimTime(event.timeStamp)`; returns a detach function. Test it in
  `frontend/src/game/input/keyboard.test.js`
- [X] T015 [P] Create `frontend/src/game/render/draw.js`: `drawFrame(ctx, session, { reducedMotion })`
  drawing the stage floor and the player as chibi placeholder shapes (about 2 to 2.5 heads tall:
  a big round head on a small body, white gi, coloured belt, outline), drawn in depth order
  (lower on screen drawn in front), scaled from the 960 × 540 stage to the canvas size with letterboxing so nothing is
  stretched or cut off. Add a comment marking the shapes as placeholder art (research R7)
- [X] T016 Create `frontend/src/game/hooks/useGameLoop.js`: runs `requestAnimationFrame`, calls
  `clock.advance(frameMs)` and `step(session, STEP_MS)` that many times, collects the returned
  events for a callback, and calls `drawFrame`; stops when unmounted; resizes the canvas to its
  container with `devicePixelRatio`
- [X] T017 Create the playing screen in `frontend/src/game/GameApp.jsx` and
  `frontend/src/game/GameApp.css`: full-viewport layout with no page scroll, a `<canvas role="img">`
  with an `aria-label` from `t.game.canvasLabel`, a simple Start button that creates a session
  (`seed = Date.now()` in the UI, not the engine) and starts the loop, and keyboard attached.
  Add the needed strings (EN and VI) to `frontend/src/i18n/game.js`
- [X] T018 Add an optional `fallback` prop to `frontend/src/components/ErrorBoundary.jsx`
  (default: the current `ContentStatus` output, so the site is unchanged), and create
  `frontend/src/game/GameError.jsx` and `GameError.css`: "The game couldn't start. Try
  reloading, or go back to the dojo website." with Reload and Back to the dojo website (`/`)
  buttons. Wire it as the `ErrorBoundary` fallback in `frontend/src/game/main.jsx`, and in
  `GameApp.jsx` show it when `canvas.getContext('2d')` returns null. Add the text to
  `frontend/src/i18n/game.js` and test both cases in `frontend/src/game/GameError.test.jsx`
  (FR-027, constitution V)

**Checkpoint**: On `/game/`, pressing Start shows the stage and a character that moves with
the keyboard at the same speed on any device.

---

## Phase 3: User Story 1 - Parry and throw an enemy (Priority: P1) 🎯 MVP

**Goal**: Enemies approach and attack with a warning; a timed parry throws them; a mistimed
press stumbles; thrown enemies knock others down; defeated enemies vanish in smoke. Works on
keyboard and touch.

**Independent Test**: Start a game, parry an attack inside the window and see the throw; press
early and late and see the stumble and the hit (spec, User Story 1).

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T019 [P] [US1] Write `frontend/src/game/engine/parry.test.js` for `judgeParry` and
  `judgeStrike` (window `W = 250`, attack lands at `t`):
  - presses at `t` and at `t - 250` succeed; at `t - 251` and `t + 1` miss and set
    `stumbleUntil = press + 500`; easy mode succeeds at `t - 500`
  - perfect zone: `t - 187.5` and `t - 62.5` are perfect; `t - 190` and `t - 60` succeed but are
    not perfect; in easy mode the zone is `t - 375` to `t - 125`
  - parry cooldown: every non-ignored press sets `parryReadyAt = press + W`; a second press
    within `W` ms is ignored and doesn't restart the cooldown; a press while
    `p < stumbleUntil` is ignored
  - combo: a successful parry against an enemy with `comboArmed` is perfect wherever it falls in
    the window, and is reported with `combo: true`
  - strike: sets `strikeReadyAt = press + 1500`; a second strike within 1500 ms is ignored; the
    parry key still works during the strike cooldown
    - with two enemies in the window, only the one whose attack lands soonest is thrown; with two
    enemies whose `attackLandsAt` is equal, at 50 and 80 units away, the one at 50 is thrown
    - an enemy 90 units away can be parried; one 91 units away can't; one 20 units up or down can
    be parried; one 21 units up or down can't (FR-001a)
    - a successful parry (normal or perfect) defeats the enemy whatever its health (4 or 1)
  - a strike only reaches an enemy within 90 across and 20 up or down
- [X] T020 [P] [US1] Write `frontend/src/game/engine/enemies.test.js`: walkers approach the
  player; a walker in range enters `windingUp` for 700 ms then `attacking`; a dasher at mid range
  enters `dashWindUp` for 500 ms then `dashing`; an unparried attack removes 10
  health (30 for the special move that ends a dash); a strike on an `approaching` or `windingUp` enemy removes 1 health, sends it to `pushedBack`
  for 300 ms and sets `comboArmed`; four strikes defeat an enemy (`enemyDefeated` with
  `by: 'strikes'`); only if `delayUsed` is false, it also cancels the wind-up, sets
  `nextAttackNotBefore` to the strike time plus a seeded random value from 1000 to 2500 ms and
  sets `delayUsed`; a second strike before the enemy attacks doesn't delay it again, and a winding-up enemy with
  `delayUsed` true is pushed back 60 units but keeps its `attackLandsAt`; striking one enemy
  every 1500 ms for 20 s still lets it attack at least once; a walker starts its wind-up at 80
  units and not at 81; a dasher starts its dash wind-up only between 250 and 450 units; `delayUsed`
  and `comboArmed` clear when its attack resolves; strikes don't affect enemies that are
  dashing, attacking, recovering, thrown or down; a normal throw lands 200 units away and a critical throw 400; a thrown enemy becomes
  `defeated` when it lands and is removed after 400 ms; a thrown enemy that passes within 40
  units of another (and within 20 up or down) sends that one to `down` for 1000 ms without
  damage, after which it gets up; approaching enemies step toward the player's line and start a
  wind-up only when within 20 up or down; an attack lands only if the player is still within 20
  up or down, otherwise it misses with a `dodged` event and no damage; a dasher keeps the line
  it had when the dash started, and if the player is off that line it overshoots 150 units and
  recovers for 600 ms before approaching again; the player can't be hit while `throwing` (400 ms)
- [X] T021 [P] [US1] Write a timing test in `frontend/src/game/engine/session.test.js`: a parry input whose `at` is inside the window, with the parry not on cooldown, succeeds no matter how the surrounding steps fall (try
  presses at every millisecond across a 16.67 ms step boundary) (SC-002)

### Implementation for User Story 1

- [X] T022 [P] [US1] Create `frontend/src/game/engine/parry.js` exporting
  `judgeParry({ at, player, enemies, easyMode })` returning
  `{ result: 'ignored'|'success'|'miss', enemyId?, perfect?, combo?, missKind?: 'early'|'late' }`
  and `judgeStrike({ at, player, enemies })` returning `{ result: 'ignored'|'struck', enemyId? }`,
  using the "Parry judgment" and "Strike judgment" tables in data-model.md
  ("`t - W <= p <= t`"; perfect when "`t - 0.75W <= p <= t - 0.25W`" or `comboArmed`;
  `parryReadyAt = p + W` after every non-ignored press; `strikeReadyAt = s + 1500`)
- [X] T023 [P] [US1] Create `frontend/src/game/engine/enemies.js` with the enemy state machine
  from data-model.md (`approaching`, `dashWindUp`, `dashing`, `windingUp`, `attacking`,
  `recovering`, `thrown`, `down`, `pushedBack`, `defeated`), and the fields `nextAttackNotBefore`, `delayUsed` and `comboArmed`, setting `attackLandsAt` when wind-up starts (never before `nextAttackNotBefore`). A strike
  cancels a wind-up only when `delayUsed` is false. Enemies have `health` 4: a strike removes 1 and
  health 0 leads to `defeated`; `thrown` leads to `defeated` whatever the health; `down` (from a
  chain knock-down) leads back to `approaching`. Enemies line up with the player before winding
  up, attacks hit only within the line tolerance (otherwise emit `dodged`), and dashers keep
  `lineY` and overshoot when the player has left it. Emit `warning(enemyId)` when a wind-up
  starts (FR-001a, FR-001b, FR-002, FR-003, FR-008)
- [X] T024 [US1] Extend `step` in `frontend/src/game/engine/session.js` to apply `parry` and
  `strike` inputs at their own `at` time (via `judgeParry` and `judgeStrike`), update enemies, resolve attacks,
  throws, chain knock-downs and defeats, update `stats` and `score` with the values in
  `tuning.js`, and return events (`warning`, `parried(enemyId, { perfect, combo })`,
  `missedParry(early|late)`, `struck(enemyId|null, { delayed })`, `playerHit`, `dodged`,
  `enemyDown`, `enemyDefeated(enemyId, by)`) in the order they happened. Update
  `stats.enemiesDefeated` for both kinds of defeat and `stats.dodges` for dodges. Perfect parries throw at double distance and add
  to `stats.perfectParries` (and `stats.combos` for combos). Add `start(session)`; for this story, `start`
  spawns walkers and dashers continuously until waves arrive in US2
- [X] T025 [US1] Extend `frontend/src/game/render/draw.js` to draw enemies by kind and action:
  wind-up flash plus "!" above the enemy (steady bright outline plus "!" when `reducedMotion`),
  dasher crouch with a line on the floor along its path, throw arc, critical throw with a white flash around both characters (a steady glow when
  `reducedMotion`), strike push, a small clock icon over an enemy whose attack was delayed,
  knocked-down pose, stumble wobble, four health pips above each enemy, a whiff and "Dodged!"
  on a dodge, a dasher skid and turn on overshoot, and a puff of smoke on defeat. Enemies are
  chibi placeholder shapes like the player, with clearly different walker and dasher
  silhouettes, no weapons and friendly faces. No blood, injury or weapons (FR-014)
- [X] T026 [P] [US1] Create `frontend/src/game/audio/sounds.js`: a Web Audio module with
  `createSounds()` returning `play(name)` for `warning` (short rising tone), `dash` (low whoosh),
  `parry` (bright chime), `critical` (deeper two-note gong, clearly different from `parry`),
  `strike` (light tap), `miss` (dull thud), `dodge` (soft swish), `skid` (dasher overshoot), `hit` (soft bump), `defeat` (pop);
  `setSoundOn(bool)`; starts with sound off; creates or resumes the `AudioContext` only inside
  the sound button's click handler. Game keys never turn sound on (FR-024, research R6)
- [X] T027 [US1] Connect events to feedback in `frontend/src/game/GameApp.jsx`: play the sound
  for each event, show "Combo!" or "Dodged!" text briefly (no caption for perfect parries or misses), and pass
  `reducedMotion` from `matchMedia('(prefers-reduced-motion: reduce)')` to the renderer (FR-025)
- [X] T028 [P] [US1] Create `frontend/src/game/screens/Hud.jsx` and `Hud.css`: health bar with an
  accessible label and value, score, and a sound on/off button; health bar shake only when
  reduced motion is off. Test it in `frontend/src/game/screens/Hud.test.jsx` with axe
- [X] T029 [P] [US1] Create `frontend/src/game/input/TouchControls.jsx` and `TouchControls.css`:
  a 4-way movement pad bottom left, larger Parry and Strike buttons bottom right (each dims while its cooldown runs), all at least
  56 × 56 CSS px and at least 8 px apart, using Pointer Events with multi-touch, stamping inputs
  with `clock.toSimTime(event.timeStamp)` like the keyboard (FR-021). Show it when
  `matchMedia('(pointer: coarse)')` matches. Test it in `frontend/src/game/input/TouchControls.test.jsx`
- [X] T030 [US1] Add all new US1 text (feedback messages, HUD labels, sound button, touch button
  labels) to `frontend/src/i18n/game.js` in both languages

**Checkpoint**: The MVP is playable without end: enemies keep coming, parries throw them, on
keyboard and touch. Engine tests for parry and enemies pass.

---

## Phase 3b: Fight rebuild (US1, agreed 2026-11-12)

**Goal**: The approved sprites and rules: arcade-style aikidoka (male or female), punch, the
dasher's whirlwind kick, throws that lead the attacker over, chain defeats and hold-to-block.

### Tests ⚠️ write first, confirm they fail

- [X] T062 [P] [US1] Extend `frontend/src/game/engine/parry.test.js`: a spinning dasher can be
  parried in the window before it lands; a press outside the window returns `result: 'guard'`
  (no stumble yet) unless it is late; a late press still misses with `missKind: 'late'`
- [X] T063 [P] [US1] Extend `frontend/src/game/engine/enemies.test.js`: the dasher crouches 500 ms
  with a `warning` (special), then spins toward the player at 300 per second and lands beside
  where the player stood; the landing is the hit (30 damage); stepping off its line makes it
  miss and skid 150 units; a normal throw lands 45 units from the player on the far side; a
  critical throw lands 70 to 140 units from the player on the far side; an enemy right behind
  the player is defeated by a normal throw's landing (FR-005, FR-008, FR-002)
- [X] T064 [P] [US1] Extend `frontend/src/game/engine/session.test.js`: hold-to-block, row by row
  from the FR-006a table (press early and hold: blocked, no damage, no points, `blocked` event;
  press early and let go: stumble from the release, the hit lands; press in the window: throw;
  late press: miss), and blocking keeps the player still

### Implementation

- [X] T065 [US1] Engine: `tuning.js` (kick speed 300, stand-off 70, throw landing 45 and 70 to
  140, throw 500 ms), `enemies.js` (`spinning` replaces `dashing`; punch wind-up unchanged),
  `parry.js` (spinning enemies can be parried; guard result), `session.js` (`parryRelease`
  input, guard and block, new throw landing), so T062 to T064 pass
- [X] T066 [P] [US1] Input: Space up sends `parryRelease` in `frontend/src/game/input/keyboard.js`
  (and on window blur); the Parry button sends it on pointer up and cancel in
  `TouchControls.jsx`; tests in both test files
- [X] T067 [US1] Sprites: move the approved generator to `frontend/scripts/draw-game-sprites.py`;
  it writes one sheet per character to `frontend/src/game/render/sprites/` (`male.png`,
  `female.png`, `walker.png`, `dasher.png`, frames 80 × 78 px, feet at (36, 74), 1 px = 3 stage
  units) and `sprites.json` (frame names and positions). No warning "!" in the frames (the
  renderer draws it, steady with reduced motion)
- [X] T068 [US1] Renderer: rewrite `frontend/src/game/render/draw.js` to draw characters from the
  sheets (walk cycle, punch, crouch, hop and spin loop, landing, throw sequence for both
  characters, block guard, bow, stumble, hit, thrown arc and lying with smoke), mirrored for
  facing, depth-sorted; health pips and the "!" drawn over the sprites; update `draw.test.js`
- [X] T069 [US1] Character choice: a male/female choice on the start screen in `GameApp.jsx`,
  remembered as `dojo.game.character` (guarded `localStorage`), passed to the renderer; text in
  `frontend/src/i18n/game.js` (both languages); test in `frontend/src/game/GameApp.test.jsx`
- [X] T070 [P] [US1] Sounds: add `block` (wooden clack) and `land` (kick landing) to
  `frontend/src/game/audio/sounds.js` and connect `blocked` in `GameApp.jsx`
- [X] T071 [US1] Artist guide: `frontend/src/game/render/sprites/README.md` with the frame size,
  feet point, scale, the full frame list per character, and how to replace the generated sheets
- [ ] T072 [US1] Update the How to play text later in T050 for hold-to-block and the whirlwind
  kick (note only; done with US4)

**Checkpoint**: The fight plays with the new sprites and rules on keyboard and touch.

---

## Phase 4: User Story 2 - Waves, game end and results (Priority: P2)

**Goal**: Five waves of rising difficulty, win and loss, results, Play again, and pausing.

**Independent Test**: Play to a win and to a loss; check the results screen and that Play again
starts at wave 1 with full health and score 0 (spec, User Story 2).

### Tests for User Story 2 ⚠️ write first, confirm they fail

- [ ] T031 [P] [US2] Write `frontend/src/game/engine/waves.test.js`: each wave releases exactly
  the walkers and dashers in the wave table; never more on stage than the wave's max; spawns
  are at least 1000 ms apart and enter from the left or right edge chosen by the seed; the same
  seed gives the same spawns
- [ ] T032 [P] [US2] Extend `frontend/src/game/engine/session.test.js`: `start` goes to
  `waveIntro` then `fighting` after 2000 ms and emits `waveStarted(1)`; clearing a wave goes to
  the next `waveIntro`; clearing wave 5 gives `won` and `gameWon`; player health 0 gives `lost`
  and `gameLost`; `result()` is `null` until then; inputs are ignored in `waveIntro`, `paused`,
  `won` and `lost`; `pause` stops time and `resume` returns to the previous phase; calling them
  twice does nothing
- [ ] T033 [P] [US2] Write `frontend/src/game/screens/Results.test.jsx` and
  `frontend/src/game/screens/PauseScreen.test.jsx`: correct heading for win ("You win!") and loss
  ("Good try!"), stats shown (throws, perfect parries including combos, enemies defeated, score), Play again and Menu buttons work, focus moves to the heading on
  open, Escape on the pause screen resumes, axe finds no violations

### Implementation for User Story 2

- [ ] T034 [P] [US2] Create `frontend/src/game/engine/waves.js` that builds each wave's
  `pendingSpawns` from the wave table in `tuning.js` and releases them with the spacing and
  max-on-stage rules
- [ ] T035 [US2] Extend `frontend/src/game/engine/session.js` (after the entrance phase `entering`, already built) with the phase state machine from
  data-model.md (`ready → waveIntro → fighting → … → won | lost`, `paused` remembering the
  previous phase), `pause`, `resume` and `result`, replacing the endless spawning from T024 with
  `waves.js`
- [ ] T036 [P] [US2] Create `frontend/src/game/screens/Results.jsx` and `Results.css`: heading,
  throws, perfect parries, enemies defeated, score, Play again (new session with a new seed) and
  Menu. Discard the session when leaving (FR-018, FR-019)
- [ ] T037 [P] [US2] Create `frontend/src/game/screens/PauseScreen.jsx` and `PauseScreen.css`:
  "Paused" with Resume, How to play and Quit to menu, keyboard usable with focus management
  (FR-013, FR-022)
- [ ] T038 [US2] Create `frontend/src/game/hooks/useAutoPause.js`: pause on `visibilitychange`
  to hidden and on window `blur`; on touch devices pause on portrait orientation
  (`matchMedia('(orientation: portrait)')`); never resume automatically
- [ ] T039 [P] [US2] Create `frontend/src/game/screens/RotatePrompt.jsx`: "Turn your device
  sideways to play", shown on touch devices in portrait; Resume appears once landscape
- [ ] T040a [US2] Win ending (FR-017): when the last wave is cleared, the engine enters `leaving`: the
  player bows (same bow as the entrance), then emits `gameWon`. Create
  `frontend/src/game/screens/DojoDoors.jsx` and `DojoDoors.css`: two shoji doors that slide in
  from the sides and meet in the middle, matching the look and timing of the site's hero doors
  (`frontend/src/components/Hero.css`, `.hero__door`: wood frame, lattice over washi paper, 900 ms
  slide), shown over the canvas on `gameWon`; with reduced motion they appear closed without
  sliding. Show Results only after the doors have closed. Test the engine order (bow, then
  `gameWon`) in `session.test.js` and the doors in `DojoDoors.test.jsx`
- [ ] T040 [US2] Wire screens in `frontend/src/game/GameApp.jsx`: wave intro overlay "Wave N of
  5" announced through a polite `aria-live` region; HUD shows "Wave N of 5"; pause button in the
  HUD and in `TouchControls.jsx` (top right); Escape and P pause; results on `gameWon`/`gameLost`
  with the outcome announced; add all new text to `frontend/src/i18n/game.js` in both languages
- [ ] T041 [US2] Play-test and adjust only `frontend/src/game/engine/tuning.js` so a full game
  takes 3 to 5 minutes for an average player (SC-003); record the final numbers in
  `specs/001-aikido-parry-game/data-model.md` if they changed

**Checkpoint**: A complete game from wave 1 to a result, with pause and play again.

---

## Phase 5: User Story 3 - Many visitors play at the same time (Priority: P2)

**Goal**: Every visitor and every tab gets an independent game, with no network traffic.

**Independent Test**: Open the game in several tabs or devices, play differently in each, and
check each has its own enemies, health, score and results (spec, User Story 3).

### Tests for User Story 3 ⚠️ write first, confirm they fail

- [ ] T042 [P] [US3] Add to `frontend/src/game/engine/session.test.js`: two sessions created
  side by side and stepped with different inputs never share state (changing one doesn't change
  the other); the engine module has no module-level mutable state
- [ ] T043 [P] [US3] Create `frontend/e2e/game.spec.js` with a test that opens `/game/` in two
  pages of the same browser context, starts both, plays in one only, and checks the other's
  score and health are unchanged; and a test that records all network requests during a game
  and asserts none are made after the page has loaded (FR-011)

### Implementation for User Story 3

- [ ] T044 [US3] Review `frontend/src/game/` for anything shared between sessions or tabs
  (module-level variables, `BroadcastChannel`, `storage` events, `SharedWorker`) and remove it;
  confirm the only `localStorage` keys used are the preference keys in data-model.md
- [ ] T045 [US3] Confirm no request goes to `/api` or any other server from `frontend/src/game/`
  (search for `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`) and that
  `frontend/src/game/` does not import from `frontend/src/api/`

**Checkpoint**: Separate sessions verified by unit and browser tests.

---

## Phase 6: User Story 4 - Learn to play (Priority: P3)

**Goal**: A menu, a How to play screen shown before the first game, and an easy mode.

**Independent Test**: A new player reads How to play, starts, and lands a throw within five
attempts; easy mode doubles the parry window (spec, User Story 4).

### Tests for User Story 4 ⚠️ write first, confirm they fail

- [ ] T046 [P] [US4] Write `frontend/src/game/hooks/usePreferences.test.jsx`: reads and writes
  `dojo.game.seenHelp` (`"1"`), `dojo.game.easy` (`"1"` or missing) and `dojo.game.sound` (`"1"` or missing), `dojo.game.character` (`"male"`/`"female"`); works and returns defaults when `localStorage` throws
- [ ] T047 [P] [US4] Write `frontend/src/game/screens/Menu.test.jsx` and
  `frontend/src/game/screens/HowToPlay.test.jsx`: How to play opens automatically when
  `seenHelp` is not set and not after; Got it returns to where it was opened from; the Easy mode
  and Sound switches are real switches with labels; Back to the dojo website links to `/`; axe
  finds no violations in English and Vietnamese
- [ ] T048 [P] [US4] Add an engine test in `frontend/src/game/engine/session.test.js` that a
  session created with `easyMode: true` accepts a parry 500 ms before the attack lands

### Implementation for User Story 4

- [ ] T049 [P] [US4] Create `frontend/src/game/hooks/usePreferences.js` with the four keys from
  data-model.md, every access in try/catch
- [ ] T050 [P] [US4] Create `frontend/src/game/screens/HowToPlay.jsx` and `HowToPlay.css`:
  keyboard and touch controls table from contracts/ui-contract.md, a drawing of the "!" warning,
  and plain-language explanations of moving up and down to dodge, the parry window, the perfect parry (press in the
  middle), the cooldowns and the strike + parry combo; Got it button
- [ ] T051 [P] [US4] Create `frontend/src/game/screens/Menu.jsx` and `Menu.css`: title, Start,
  How to play, Easy mode switch, Sound switch, the existing `LanguageToggle` component, and
  "Back to the dojo website"
- [ ] T052 [US4] Make the Menu the first screen in `frontend/src/game/GameApp.jsx`, replacing
  the temporary Start button from T017; show How to play first when `seenHelp` is not set; pass
  `easyMode` from preferences into `createSession`; remember the sound choice; add all new text to `frontend/src/i18n/game.js` in both
  languages

**Checkpoint**: All four stories work together.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T053 Add the footer link "Play the Aikido mini-game" to `/game/` in
  `frontend/src/components/Footer.jsx` with the text in `footer` in
  `frontend/src/i18n/strings.js` (both languages), and update
  `frontend/src/components/Footer.test.jsx` to check the link (FR-026)
- [ ] T054 Extend `frontend/e2e/game.spec.js` for all three widths: no sideways scroll on
  `/game/`; How to play on first visit; start, then Escape pauses and Resume continues; the page
  pauses when hidden (`page.evaluate` dispatching `visibilitychange`); the rotate prompt on the
  `mobile` project with touch emulation in portrait; touch controls visible with
  `hasTouch: true` in landscape; axe on Menu, How to play, Pause and Results in both languages
  with reduced motion emulated
- [ ] T055 Turn on `build.manifest: true` in `frontend/vite.config.js`, and add a test to
  `frontend/e2e/site.spec.js` that reads `dist/.vite/manifest.json`, lists the files reachable
  only from the `game/index.html` entry, and asserts that loading `/` requests none of them
  (collect `page.on('request')` URLs), so the home page stays as fast as before (SC-005)
- [ ] T056 [P] Add a "Mini-game" section to `README.md` (where it lives, how to run it at
  `http://localhost:5173/game/`, controls, and that its art and sounds are placeholders) and add
  `frontend/game/` and `src/game/` to the repository layout tree
- [ ] T057 [P] Add decision log entries to `docs/private/DECISIONS.md` for "Canvas 2D with no
  game engine" (research R1) and "Separate `/game/` page" (research R2), each with context,
  options considered, decision, trade-offs and follow-up work
- [ ] T058 Run `npm test`, `npm run build` and `npm run test:e2e` in `frontend/`, then walk
  through all 20 manual checks in `specs/001-aikido-parry-game/quickstart.md` and record any
  that fail
- [ ] T059 Profile `/game/` on a mid-range phone (or Chrome DevTools with 4× CPU slowdown and
  Slow 4G) during wave 5: record the frame rate (target 60 fps with 4 enemies) and the time
  until the menu is usable (target under 2 s), under a new "Performance results" heading in
  `specs/001-aikido-parry-game/quickstart.md`
- [ ] T060 Run a play-test with at least 10 players aged 10 to 13 (keyboard and phone), with a
  parent present, and record under "Play-test results" in
  `specs/001-aikido-parry-game/quickstart.md`: how many landed a throw within 5 attempts
  (SC-001, target 8 of 10), throw success on touch vs keyboard (SC-007), and any content
  concerns from the parent (SC-006)
- [ ] T061 Check the game bundle size in `frontend/dist/assets/` (the game entry's JS, excluding
  shared React) is under 60 KB gzipped, as set in plan.md

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: needs Setup. Blocks all stories.
- **US1 (Phase 3)**: needs Foundational.
- **US2 (Phase 4)**: needs US1's engine (`enemies.js`, parry handling in `session.js`), because
  waves release the enemies US1 builds.
- **US3 (Phase 5)**: needs Foundational only for the engine test (T042); the browser test (T043)
  needs a playable page, so run it after US1.
- **US4 (Phase 6)**: needs Foundational; T052 replaces the temporary Start button and should
  follow US2's screen wiring (T040) to avoid conflicts in `GameApp.jsx`.
- **Polish (Phase 7)**: after the stories you plan to ship.

### Story order

```text
Setup → Foundational → US1 (MVP) → US2 → US4
                          └──────→ US3 (any time after US1)
```

### Within each story

Tests first (and failing) → engine → rendering and audio → screens → wiring in `GameApp.jsx`
→ strings.

## Parallel Examples

### Foundational

```text
T007 random.test.js   T008 clock.test.js   T009 tuning.js   T010 random.js
T011 clock.js         T014 keyboard.js     T015 draw.js
```

### User Story 1

```text
Tests:  T019 parry.test.js   T020 enemies.test.js   T021 timing test
Build:  T022 parry.js   T023 enemies.js   T026 sounds.js   T028 Hud.jsx   T029 TouchControls.jsx
```

### User Story 2

```text
Tests:  T031 waves.test.js   T032 session phases   T033 Results/Pause tests
Build:  T034 waves.js   T036 Results.jsx   T037 PauseScreen.jsx   T039 RotatePrompt.jsx
```

### User Story 4

```text
T046 usePreferences test   T047 Menu/HowToPlay tests   T048 easy mode test
T049 usePreferences.js     T050 HowToPlay.jsx          T051 Menu.jsx
```

## Implementation Strategy

### MVP first (User Story 1)

1. Phase 1 and Phase 2.
2. Phase 3 (US1).
3. **Stop and validate**: play it on a laptop and a phone. The parry should feel fair and the
   warning clear. This is the riskiest part, so tune it before building more.

### Incremental delivery

1. US1: endless parry practice. Demo it.
2. US2: a real game with an end. Play-test the 3 to 5 minute length.
3. US3: confirm isolation (mostly verification).
4. US4: menu, help and easy mode, ready for kids to try on their own.
5. Polish: footer link, browser tests, docs. Only now does the game become visible from the
   site, so earlier merges to `main` don't expose an unfinished game except by direct address.

## Notes

- Commit after each task or small group, on the `gamedev` branch.
- Merge to `main` only through a pull request with CI passing (constitution workflow).
- Stop at any checkpoint to validate the story on its own.
