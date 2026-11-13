# Implementation Plan: Aikido Parry Mini-Game

**Branch**: `gamedev` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-aikido-parry-game/spec.md`

## Summary

A single-player, 2D side-view beat 'em up for ages 10+, where the player beats enemies by
timing a parry (Space, or a Parry button on touch) and throwing them Aikido-style. It is added
as a second page of the existing React/Vite frontend at `/game/`, so the home page never loads
it. All game logic is a small, pure JavaScript engine with a fixed 60 Hz time step and
timestamp-based parry judging, drawn on a Canvas 2D element. Menus, HUD and results are
accessible HTML over the canvas, using the site's existing i18n and design tokens. No backend,
database or new dependencies are needed: every visitor plays a separate game in their own
browser.

## Technical Context

**Language/Version**: JavaScript (ES2022), React 19, built with Vite 8. Node.js 20.19+ for
tooling.

**Primary Dependencies**: Existing only: React, React DOM. Browser APIs: Canvas 2D, Web Audio,
Pointer Events, Page Visibility, `matchMedia`. No game engine ([research R1](research.md)).

**Storage**: None on the server. Four small preferences in `localStorage` (help seen, easy
mode, sound, chosen character), guarded ([research R10](research.md)).

**Testing**: Vitest + Testing Library + axe-core for engine and components; Playwright for the
game page at 375, 768 and 1280 px.

**Target Platform**: Current evergreen browsers on desktop (keyboard) and phones/tablets (touch,
landscape). Hosted as static files on Vercel.

**Project Type**: Web application. This feature touches the frontend only.

**Performance Goals**: 60 fps on a mid-range phone with up to 4 enemies; game page interactive
within 2 s on a typical 4G connection; game bundle under 60 KB gzipped (excluding React, which
is shared).

**Constraints**: Parry timing exact to the press, independent of frame rate. Home page bundle
unchanged in size apart from the footer link and its label (game text lives in the game bundle,
[research R12](research.md)). Visible loading and failure states (constitution V). No network requests during play. No personal data. Bilingual. Works with
reduced motion.

**Scale/Scope**: Unlimited simultaneous players (static files, no server state). About 6
screens, 1 stage, 2 enemy types, 5 waves.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How this plan complies |
|---|---|---|
| I. Backend-Enforced Authorization | Pass (n/a) | No endpoints, no protected operations, no content changes |
| II. Secrets Stay on the Server | Pass | No keys or services. No `VITE_` variables added. No personal data collected (FR-015) |
| III. Bilingual Content by Design | Pass | All game text in `src/i18n/game.js` (inside `src/i18n/` as the principle requires), EN and VI, checked by its own key-parity test. Aikido terms untranslated |
| IV. Approved Schema and Safe Concurrent Edits | Pass (n/a) | No models, migrations or tables. No stored game data |
| V. Accessible, Responsive Frontend | Pass, with a note | Loading message and an error screen with a link back to the site (FR-027). Menus, HUD, pause and results are HTML, keyboard-usable and axe-checked in both languages. No sideways scroll at 3 widths. Uses `tokens.css`. Reduced motion honored. Note: the real-time playing field is a canvas and can't be read by a screen reader; it is fully playable by keyboard and gives sound and visual cues |
| VI. Tested and Deterministic | Pass | Seeded engine with unit tests at window edges; component and Playwright tests; no network in tests |
| VII. Simplicity and Separation of Layers | Pass | No new dependencies. Game reads no site content, so `src/api/` isn't involved. Engine is separate from UI |
| Workflow: decision log | Action | Add an entry to `docs/private/DECISIONS.md` for "Canvas 2D without an engine" and "separate `/game/` page" |

**Post-design re-check (after Phase 1)**: Still passes. The design adds one HTML entry, one
`src/game/` folder, a game strings file in `src/i18n/`, a footer link and a small change to
`LanguageProvider` so each page can set its own tab title and add page-only strings. No violations, so Complexity
Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-aikido-parry-game/
├── plan.md              # This file
├── research.md          # Phase 0: technical decisions
├── data-model.md        # Phase 1: session, player, enemy, waves, scoring, preferences
├── quickstart.md        # Phase 1: how to run and validate
├── contracts/
│   ├── engine-api.md    # Engine functions and guarantees
│   └── ui-contract.md   # Page, screens, controls, cues, text
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
frontend/
├── game/
│   └── index.html                 # NEW: second Vite entry, served at /game/
├── vite.config.js                 # CHANGE: build both index.html and game/index.html
├── e2e/
│   └── game.spec.js               # NEW: game page browser tests
└── src/
    ├── components/
    │   └── Footer.jsx             # CHANGE: add "Play the Aikido mini-game" link
    ├── i18n/
    │   ├── LanguageContext.jsx    # CHANGE: optional `titleKey` and `extraStrings` props
        │   ├── strings.js             # CHANGE: footer link text only (EN + VI)
    │   ├── game.js                # NEW: game text, EN + VI (imported only by the game page)
    │   └── game.test.js           # NEW: key parity for game text
    └── game/                      # NEW
        ├── main.jsx               # Entry: LanguageProvider + ErrorBoundary + GameApp
        
        ├── GameError.jsx          # Friendly failure screen with a link back to the site
        ├── GameApp.jsx            # Screen switching (menu, help, playing, paused, results)
        ├── GameApp.css
        ├── engine/                # Pure logic, no DOM (see contracts/engine-api.md)
        │   ├── session.js         # createSession, start, step, pause, resume, result
        │   ├── parry.js
        │   ├── enemies.js
        │   ├── waves.js
        │   ├── tuning.js
        │   ├── random.js
        │   ├── clock.js
        │   └── *.test.js
        ├── render/
        │   └── draw.js            # Canvas drawing of stage, characters (from sprite sheets in sprites/), effects
        ├── audio/
        │   └── sounds.js          # Web Audio cues, mute handling
        ├── input/
        │   ├── keyboard.js        # Key mapping, prevent page scroll, timestamp conversion
        │   └── TouchControls.jsx  # On-screen pad and buttons
        ├── screens/
        │   ├── Menu.jsx
        │   ├── HowToPlay.jsx
        │   ├── PauseScreen.jsx
        │   ├── RotatePrompt.jsx
        │   ├── Results.jsx
        │   ├── Hud.jsx
        │   └── *.test.jsx
        └── hooks/
            ├── useGameLoop.js     # requestAnimationFrame + fixed-step clock
            ├── useAutoPause.js    # visibility, blur, orientation
            └── usePreferences.js  # guarded localStorage
```

**Structure Decision**: Web application layout already in the repo. All work is under
`frontend/`, with the game in its own `src/game/` folder and its own HTML entry, so it shares
i18n, tokens and the build with the site but stays out of the home page bundle. Nothing changes
under `backend/`.

## Complexity Tracking

No constitution violations to justify.
