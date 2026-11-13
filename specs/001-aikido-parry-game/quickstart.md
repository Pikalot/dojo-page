# Quickstart: Validate the Aikido Parry Mini-Game

How to run the game and check that it does what the [spec](spec.md) requires. Details of
screens and controls are in [contracts/ui-contract.md](contracts/ui-contract.md); timing rules
are in [data-model.md](data-model.md).

## Prerequisites

- Node.js 20.19 or newer, and `cd frontend && npm install` done once.
- The backend is not needed. The game makes no API calls.

## Run

```sh
cd frontend
npm run dev            # site at http://localhost:5173, game at http://localhost:5173/game/
```

## Automated checks

```sh
cd frontend
npm test               # engine rules, screens, string parity, axe
npm run build          # must produce dist/game/index.html next to dist/index.html
npm run test:e2e       # game page at 375, 768 and 1280 px, plus the existing site tests
```

Expected: all pass. The engine tests cover parry window edges (just inside, just outside,
easy mode), stumble, chain defeats, wave progression, win and loss.

## Manual checks

| # | Do | Expect | Spec |
|---|---|---|---|
| 1 | Open `/` and check the network panel | No game files are downloaded | SC-005, FR-026 |
| 2 | Click "Play the Aikido mini-game" in the footer | Game page opens, How to play shows first | FR-026, Story 4 |
| 3 | Start; let an enemy attack; press Space as the "!" appears and the tone plays | Throw, and the enemy is defeated in one parry | Story 1, FR-003 to FR-005 |
| 4 | Press Space well before an attack | Stumble (wobble and thud, no caption); next press within 0.5 s does nothing | FR-006 |
| 4a | Press Space in the middle of the window (between the "!" appearing and the hit) | Critical throw: enemy flies twice as far, flash, gong sound (no caption) | FR-004, FR-005 |
| 4b | Strike an approaching enemy, then parry its next attack | Its attack comes after a varying delay; the parry shows "Combo!" with a critical throw | FR-007, FR-007b |
| 4c | Press J twice quickly | The second strike does nothing | FR-007a |
| 4d | Strike the same enemy every time the strike is ready | The enemy still attacks between strikes; after 4 strikes it is defeated, for fewer points than a throw | FR-007, FR-008 |
| 4e | Step up or down just before an attack lands | "Dodged!", no damage, no points; the enemy lines up again | FR-001a, FR-001b |
| 4f | Step aside after a dasher starts its dash | It skids past and turns around | FR-001b |
| 4g | Press Space early and keep holding it as the hit lands | Blocked: guard pose, wooden clack, no damage, no throw | FR-006a |
| 4h | Press Space early and let go before the hit | Stumble, and the hit lands | FR-006a |
| 4i | Wait for a dasher's crouch "!" | It hops into a spinning kick, flies in slowly, and hits on landing for 30 | FR-002 |
| 4j | Parry normally, then perfectly | Normal: the attacker is led over and drops right beside you. Perfect: lands 3 to 6 feet away | FR-005 |
| 4k | Choose Female on the start screen, reload | The female aikidoka plays, and stays chosen after the reload | FR-019a |
| 5 | Throw an enemy into another | Both are defeated, and the score goes up for each (100 for the one hit by the thrown body) | FR-008 |
| 6 | Turn on Easy mode and repeat step 3 | Noticeably more time to press | FR-004 |
| 7 | Switch to another tab mid-wave, come back | Game is paused; resumes only on Resume | FR-013 |
| 8 | Play to the end (win once, lose once) | Results screen with stats; Play again starts at wave 1 with score 0 | Story 2, FR-016 to FR-019 |
| 9 | Time a full game | 3 to 5 minutes | SC-003 |
| 10 | Open the game in two tabs and play differently | Each tab has its own game | Story 3, FR-012 |
| 11 | On a phone: hold upright, then sideways | Rotate prompt, then touch controls; parry works with the button | FR-021, SC-007 |
| 12 | Switch language to Tiếng Việt | All game text changes; "Aikido" stays | FR-023 |
| 13 | Turn on reduced motion in the OS | No screen shake or flashing; the "!" warning is still clear | FR-025 |
| 14 | Use only the keyboard in menus, pause and results | Everything reachable with Tab, Enter, Escape | FR-022 |
| 15 | Reload the page mid-game, then check browser storage | Game is gone; storage holds only the four `dojo.game.*` preferences | FR-019 |
| 16 | Press keys during play with sound off | Sound stays off until the sound button is used | FR-024 |
| 17 | Throttle the network to Slow 4G and open `/game/` | "Loading the game…" shows first | FR-027 |
