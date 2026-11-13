# Research: Aikido Parry Mini-Game

All open technical questions from the plan's Technical Context are resolved below.

## R1. Rendering: game engine library or plain Canvas 2D?

- **Decision**: Plain HTML Canvas 2D, drawn by our own small renderer. No game engine dependency.
- **Rationale**: The game has one screen, a handful of moving shapes and no physics beyond
  knock-back. Constitution VII requires new dependencies to justify their cost. Canvas 2D is in
  every target browser, adds nothing to the bundle, and keeps the code readable for a small team.
- **Alternatives considered**:
  - Phaser: full engine with scenes, input and audio, but about 1 MB minified (around 300 KB
    gzipped), which is more than the whole current site, and it brings its own patterns.
  - PixiJS: fast WebGL renderer, about 450 KB minified. Not needed for this few sprites.
  - Kaboom/Kaplay: small and friendly, but adds an engine-shaped API for a game this small.
  - DOM/CSS elements as sprites: hard to keep at 60 fps on phones with several enemies.

## R2. Where the game lives and how the home page stays fast

- **Decision**: A second page of the existing Vite app at `frontend/game/index.html`, served at
  `/game/`, with its own entry `frontend/src/game/main.jsx`. Linked from the site footer.
- **Rationale**: Vite builds each HTML entry into its own bundle, so the home page never
  downloads game code (SC-005). Vercel serves `/game/` from `dist/game/index.html` with no
  rewrite. No router dependency is needed. The game page reuses `LanguageProvider`, so it follows
  the language the visitor chose on the site (same `dojo.language` storage key).
- **Alternatives considered**:
  - A section on the home page loaded with `React.lazy`: keeps one page, but the game would sit
    inside the scrolling page, fight with scroll and the hide-on-scroll header, and is hard to
    give a full-screen layout.
  - Adding a client-side router: a new dependency for one extra page.
  - A separate repository or Vercel project: duplicates i18n, tokens and deployment.

## R3. Timing that is fair on every device

- **Decision**: The simulation runs at a fixed step of 60 updates per second, separate from
  drawing. Each input is stamped with the browser's high-resolution event time and converted to
  simulation time. A parry is judged by comparing the press time with the moment the attack
  lands, not by which frame noticed the press.
- **Rationale**: The spec requires the parry window (250 ms, 500 ms easy) and enemy speed to be
  identical on slow and fast devices, and a correctly timed press to count 100% of the time
  (SC-002). Frame-based checks would miss presses on a slow phone that drops frames.
- **Alternatives considered**: Variable time step scaled by frame time (timing drifts, hard to
  test); checking input once per frame (loses up to a frame, 16 to 33 ms, of accuracy).

## R4. Separate sessions for many players

- **Decision**: All game logic runs in the visitor's browser. The page is static files from
  Vercel's CDN. No game data is sent anywhere.
- **Rationale**: The spec forbids any interaction between players (FR-011) and requires any
  number of simultaneous players (FR-012). A static page has no shared state and no server load,
  so 30 or 3,000 players are the same to the server. Two tabs are two separate JavaScript
  instances, so they can't share a game.
- **Alternatives considered**: Running games on the Django server (adds load and latency for no
  benefit, and the backend has no real-time support).

## R5. Input: keyboard and touch

- **Decision**: Keyboard: arrows or WASD to move, Space to parry, J to strike, Escape to pause.
  Touch: on-screen movement pad (bottom left), Parry and Strike buttons (bottom right) and a
  Pause button (top right), using Pointer Events so multi-touch works. Touch controls appear when
  the device's primary pointer is coarse (`(pointer: coarse)`), and can also be switched on in
  the menu.
- **Rationale**: Pointer Events cover touch, pen and mouse in one API and carry the same
  high-resolution timestamp as keyboard events, so parry timing is the same on both (FR-021).
  J is a common strike key and sits under the right hand while the left hand uses WASD.
- **Alternatives considered**: Touch Events (older API, separate code path); a virtual analog
  stick (harder for kids to use precisely than a 4-way pad on a small screen).

## R6. Sound

- **Decision**: Short sounds made with the Web Audio API at runtime (tones and noise bursts for
  the warning cue, throw, critical throw, strike, hit and wave start). The game starts with sound
  off. Sound turns on only through the sound button or switch; that click is also the user
  gesture browsers require before audio can play. Game keys never turn sound on (FR-024).
- **Rationale**: No audio files to license, download or translate. The warning cue is the one
  sound that matters for play (FR-003), and a synthesized tone is easy to keep distinct.
- **Alternatives considered**: Audio files (better sound later, but licensing and download size
  now; the sound module can swap them in without other changes).

## R7. Art

- **Decision**: Art direction is short, cute "super-deformed" (chibi) characters about 2 to 2.5
  heads tall: a kid in a white gi with a coloured belt for the player, and friendly-looking
  troublemakers for enemies (no weapons, no scary faces), with clearly different walker and
  dasher silhouettes. All designs are original. For the first version they are drawn from
  simple shapes on the canvas with those proportions (a big round head on a small body, belt,
  outline), clearly marked as placeholder art. Hit boxes depend only on the 960 × 540 stage
  units, not on the drawing, and the renderer keeps drawing in one module, so sprite sheets can
  replace the shapes later without changing gameplay.
- **Rationale**: The spec requires original or licensed art and clear placeholders. Shapes have
  no licensing questions and keep the first version small.
- **Alternatives considered**: Commissioned sprites now (blocks the build on art); free asset
  packs (licenses must be checked one by one).

## R8. Accessibility of a canvas game

- **Decision**: Gameplay is drawn on a canvas with `role="img"` and a descriptive label. All
  menus, the How to play screen, the pause screen, the results screen and the HUD (health, wave,
  score) are normal HTML over the canvas, so they are keyboard-usable, translatable and
  checkable with axe. Wave changes and the final result are announced through a polite live
  region. The parry warning is both visual and audible. `prefers-reduced-motion` turns off screen
  shake and replaces flashes with a steady outline.
- **Rationale**: Meets constitution V for everything that can be made accessible. Real-time
  timing play is visual by nature, so the canvas itself can't be read by a screen reader.
- **Alternatives considered**: Drawing the menus on canvas (not accessible, not translatable by
  the existing i18n setup).

## R9. Pause and orientation

- **Decision**: The game pauses on `visibilitychange` (tab hidden) and on window `blur`. On
  touch devices in portrait, the game pauses and shows "Turn your device sideways". Resuming is
  always the player's choice (FR-013).
- **Rationale**: Prevents a kid from losing a game while switching apps, and the simulation must
  not run in a background tab where the browser slows timers.

## R10. Remembered preferences

- **Decision**: Store four small preferences in `localStorage` (help seen, easy mode, sound,
  chosen character), guarded by try/catch like the
  existing language setting: whether How to play has been seen, easy mode, and sound on
  (`dojo.game.sound = "1"`). No scores
  or game data are stored (FR-019).
- **Rationale**: "Show How to play before the first game" needs a seen flag. Easy mode and mute
  are conveniences. None of these is personal information or game data.

## R11. Testing approach

- **Decision**:
  - Vitest unit tests for the pure engine: parry judging at window edges, stumble, throw and
    chain knock-downs, enemy walking and dashing, wave building and scaling, scoring, win and
    loss, pause. A seeded random number generator makes runs repeatable.
  - Vitest + Testing Library component tests for the menus, pause, results, HUD and touch
    controls, with axe.
  - Playwright tests on the game page at the three widths: no sideways scrolling, How to play on
    first visit, start, pause with Escape and on tab hide, rotate prompt on a portrait phone,
    touch controls on a touch device, axe in both languages, and that the home page does not
    download the game bundle.
- **Rationale**: Matches constitution VI and the existing test setup. Timing-critical rules are
  tested in the engine, where time can be controlled exactly; browser tests check the flow.

## R12. Game text kept out of the home page

- **Decision**: Game text lives in `frontend/src/i18n/game.js` (English and Vietnamese), with
  its own key-parity test in `frontend/src/i18n/game.test.js`. It sits in `src/i18n/` as
  constitution III requires, and only `src/game/main.jsx` imports it; Vite bundles a module
  only where it is imported, so the home page never downloads it. `LanguageProvider` gets an optional `extraStrings` prop that is merged
  into `t` for that page, so the game reads `t.game.*` while the home page never loads game text.
  Only the footer link's label goes into the shared `src/i18n/strings.js`.
- **Rationale**: Putting game text in the shared strings file would make the home page download
  it, breaking the plan's promise that the home page bundle doesn't grow (analysis finding I1).
- **Alternatives considered**: One shared file (simplest, but grows the home page); a second
  `LanguageProvider` copy for the game (duplicates the language logic).

## R13. Cooldowns and the strike + parry combo

- **Decision**: Parry cooldown equals the parry window (250 ms, or 500 ms in easy mode) after
  every press; a missed press adds a 0.5 s stumble. Strike cooldown is 1.5 s. A strike cancels an enemy's wind-up and delays its next attack by a random 1 to 2.5 s from
  the seeded generator, at most once per attack; after that, strikes only push the enemy back
  and don't cancel its wind-up. Enemies have 4 health points; a strike removes 1 and a successful parry defeats at once. Parrying that enemy's next attack counts as a perfect
  parry (combo).
- **Rationale**: Set by the product owner on 2026-11-12 to stop key mashing and strike chains
  while rewarding a strike-then-parry rhythm. The random delay stops players from learning a
  fixed strike-then-press timing. Limiting the delay to once per attack, and not letting later strikes cancel a wind-up, stops a
  player from holding an enemy off forever: otherwise striking every 1.5 s could cancel each new
  wind-up indefinitely. Strikes give kids who can't time a parry yet a slow way through, but a strike-only enemy takes
  at least 4.5 s while others close in and attack, so parrying stays the way to win.
- **Watch in play-testing**: pressing exactly once per cooldown (every 250 ms) would always put
  one press inside a 250 ms window if presses never missed. The miss stumble (500 ms) is what
  breaks this pattern. If mashing still works too often, raise the parry cooldown above the
  window in `tuning.js`.

## R14. Depth: lining up and dodging

- **Decision**: The floor has depth like classic side-scrolling brawlers. Two characters
  interact only when they are on roughly the same line (within 20 stage units of depth).
  Enemies line up with the player before winding up; moving off the line makes an attack miss
  (a dodge, worth no points); a dasher keeps its line during a dash and overshoots 150 units if
  the player steps aside.
- **Rationale**: Requested by the product owner on 2026-11-12. It gives kids a second, easy to
  read defence besides the parry, and makes up and down movement meaningful.
- **Watch in play-testing**: if dodging every attack is too easy, raise how fast enemies line
  up again or shorten the time between a dodge and the next wind-up.
