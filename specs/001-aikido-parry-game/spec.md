# Feature Specification: Aikido Parry Mini-Game

**Feature Branch**: `gamedev`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "add a mini 2D game which belongs to beat em up genre that suitalbe for kid 10+. Game should support 3 concurrenty users in a room, enemy will move or dash toward players. Once the player hit space during a timeframe such as a perfect parry, players can counter enemy with an aikido throw"

**Revision (2026-11-12)**: Changed to an offline, single-player game. "Offline" here means
players never interact with each other. Each session belongs to one player and runs on their own
device. Any number of visitors can play at the same time, each in
their own separate session. Rooms and multiplayer were removed.

**Revision (2026-11-12, later)**: Folded in the product owner's changes: arcade-style sprites,
a male or female aikidoka, a punch as the normal attack, the dasher's whirlwind kick, throws
that lead the attacker over (perfect parries throw 3 to 6 feet), defeats by thrown bodies, and
hold-to-block.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Parry and throw an enemy (Priority: P1)

A young visitor opens the mini-game from the dojo website and starts playing. Enemies walk or
dash toward their character. Just before an enemy's attack lands, the game shows a clear warning
(a flash and a sound). If the player presses the parry key inside the parry window, the
character redirects the attack and throws the enemy in an Aikido style. If they press too early
or too late, the character stumbles briefly and can be hit.

**Why this priority**: The timed parry and the throw are the core of the game and what ties it
to Aikido. Without them there is no game.

**Independent Test**: Start a game, wait for an enemy to attack, press the parry key in the
window, and check that the enemy is thrown. Repeat with an early press and a late press and
check that the character stumbles and takes the hit.

**Acceptance Scenarios**:

1. **Given** an enemy is about to attack and its warning is shown, **When** the player presses
   the parry key inside the parry window, **Then** the attack does no damage, and the character
   catches the attacker, leads them over to the other side and drops them right next to them,
   defeated.
2. **Given** an enemy is about to attack, **When** the player presses the parry key before the
   window opens and lets go before the attack lands, **Then** the character stumbles for a short
   recovery time, during which the attack can hit.
3. **Given** an enemy is about to attack, **When** the player does nothing, **Then** the attack
   hits and the character loses health.
4. **Given** an enemy has just been thrown by a successful parry, **When** it lands, **Then** it
   disappears in a friendly effect (no blood or injury shown) and the player's score goes up.
   One successful parry is enough to defeat any enemy, whatever health it has left.
5. **Given** a thrown enemy flies into another enemy, **When** they collide, **Then** the second
   enemy is defeated too, and the player scores for both.
6. **Given** an enemy is about to attack, **When** the player presses the parry key in the
   middle half of the parry window, **Then** a perfect parry happens: a critical throw with its
   own sound and flash sends the enemy 3 to 6 feet away.
7. **Given** the player has just pressed the parry key, **When** they press it again before the
   parry cooldown ends, **Then** nothing happens.
8. **Given** an enemy is approaching or winding up, **When** the player strikes it, **Then** it
   is pushed back and its next attack is delayed by a random time, so the player can't predict
   exactly when it will come.
9. **Given** the player struck an enemy, **When** they then parry that enemy's next attack
   successfully, **Then** it counts as a perfect parry (strike + parry combo) with a critical
   throw.
10. **Given** the player has just struck, **When** they press strike again before the strike
    cooldown ends, **Then** nothing happens, so strikes can't be chained.
11. **Given** an enemy has 4 health points, **When** the player strikes it four times, **Then**
    it is defeated, more slowly than with one parry and for fewer points.
12. **Given** an enemy is winding up on the player's line, **When** the player steps up or down
    off that line before the attack lands, **Then** the attack misses (a dodge), with no throw
    and no points.
13. **Given** a dasher has started its whirlwind kick, **When** the player steps off its line,
    **Then** the kick misses, the dasher skids past and has to turn around before it can attack
    again.
14. **Given** an enemy is about to attack, **When** the player presses the parry key early and
    keeps holding it until the attack lands, **Then** the attack is blocked: no damage, no throw
    and no points.
15. **Given** a dasher crouches with its warning, **When** it dashes, **Then** it leaps into a
    spinning whirlwind kick, travels toward the player slowly enough to react to, and its hit
    lands when it lands (3 × damage).

---

### User Story 2 - Waves, game end and results (Priority: P2)

A game is made of short waves that get harder: more enemies, and some that dash rather than
walk. The game ends when every wave is cleared (win) or the player runs out of health (lose).
At the end, the player sees a results screen with their throws, perfect parries and score, and
can play again.

**Why this priority**: It gives a game a beginning and an end and a reason to play again, but the
core fight is already fun to try without it.

**Independent Test**: Play a full game to a win and to a loss, and check the results screen and
that "Play again" starts a fresh game.

**Acceptance Scenarios**:

1. **Given** a wave is cleared, **When** the next wave starts, **Then** there is a short break
   with a "Wave N" message and the new wave has more or faster enemies.
2. **Given** the player's health reaches zero, **When** they go down, **Then** the game ends and
   shows the results screen.
3. **Given** the final wave is cleared, **When** the last enemy disappears, **Then** the
   character bows, the dojo's sliding doors close (like the doors on the website's hero), and
   the game shows a win and the results screen.
5. **Given** the player presses Start, **When** the game begins, **Then** the character walks in
   from the left edge, bows at the edge of the mat, steps into the middle of the dojo, and only
   then do enemies start to come.
6. **Given** the player's health reaches zero, **When** the last hit lands, **Then** the game
   stops at once and shows the results screen.
4. **Given** the results screen is shown, **When** the player chooses "Play again", **Then** a
   new game starts from wave 1 with full health and a score of zero.

---

### User Story 3 - Many visitors play at the same time (Priority: P2)

Several visitors, for example a class of students on their own devices, open the game at the
same time. Each one gets their own game, and nothing one player does affects anyone else's game.

**Why this priority**: The game must work for many people at once without anyone waiting or
slowing others down.

**Independent Test**: Open the game on several devices (or several browser windows) at the same
time, play differently in each, and check that each game runs on its own: separate enemies,
health, score and results.

**Acceptance Scenarios**:

1. **Given** two visitors are playing at the same time, **When** one throws an enemy or loses,
   **Then** the other visitor's game is not affected.
2. **Given** one visitor has the game open in two browser tabs, **When** they play in one tab,
   **Then** the other tab's game is separate and unaffected.
3. **Given** many visitors start the game at the same moment, **When** each presses "Start",
   **Then** every game starts without waiting for any other.

---

### User Story 4 - Learn to play (Priority: P3)

A first-time player sees a short "How to play" screen with the controls and an explanation of
the parry window, and can switch on an easier mode with a wider parry window.

**Why this priority**: Kids aged 10 and up must be able to start without an adult explaining.

**Independent Test**: A new player reads the screen, starts a game, and lands a throw within
their first five attempts.

**Acceptance Scenarios**:

1. **Given** a player opens the game for the first time, **When** the game loads, **Then** the
   "How to play" screen appears before the first game, and can be reopened from the menu.
2. **Given** a player turns on easy mode, **When** they parry, **Then** the parry window is
   twice as long.
3. **Given** a player opens the game, **When** they choose the male or female aikidoka, **Then**
   they play as that character, and the choice is remembered for their next visit.

---

### Edge Cases

- A player switches to another browser tab or app during a game: the game pauses and waits
  until they come back and choose "Resume".
- A phone is held upright: the game pauses and asks the player to turn it sideways.
- The browser window is resized or rotated: the game area resizes without stretching or cutting
  off characters.
- A player presses the parry key over and over: the parry cooldown ignores extra presses, and
  each missed press also makes the character stumble, so mashing the key isn't a reliable way
  to parry.
- A player strikes the same enemy again and again to keep it from ever attacking: a struck
  enemy's attack can be delayed only once until it has attacked again, so it can't be held off
  forever.
- A player relies on strikes instead of parries: each enemy takes at least 4.5 seconds of
  striking, more enemies keep closing in meanwhile (up to 4 at once in later waves), and their
  hits drain the player's health, so only throwing wins the later waves.
- A player dodges every attack by moving up and down: enemies line up again and keep
  attacking, and dodging scores nothing, so the waves aren't cleared without parries.
- Two enemies attack at the same moment: one parry throws only one of them (the one whose attack lands first; if both land together, the nearest), and
  the other attack can still hit.
- A player reloads the page or leaves in the middle of a game: that game is lost, and a new one
  starts from the beginning next time.
- The device is slow: the game keeps the same timing (parry window and enemy speed don't change
  with the device's speed), even if animation is less smooth.

## Requirements *(mandatory)*

### Functional Requirements

**Fighting**

- **FR-001**: The game MUST show a 2D side-view fighting area with depth, in which the player
  moves a character left, right, up and down within the floor area.
- **FR-001a**: Attacks, parries, strikes, dashes and chain knock-downs MUST connect only when the
  two characters are on roughly the same line (within 20 stage units up or down). Moving off the
  line before an attack lands MUST make it miss (a dodge). A dodge gives no throw and no points.
- **FR-001b**: Enemies MUST step up or down to line up with the player before they wind up, so a
  dodge buys time but doesn't remove the threat. A dasher MUST keep the line it had when its
  dash started; if the player has moved off it, the dasher overshoots and turns around before
  it can attack again.
- **FR-002**: Enemies MUST move toward the player and attack with a punch. Dashers MUST also have
  a special attack, the whirlwind kick: a clear crouching wind-up, then a leap into a spinning
  kick that travels toward the player along its line, slowly enough to react to, and hits when
  it lands. Its hit does 3 × damage.
- **FR-003**: Before each enemy attack lands, the game MUST show a visual warning and play a
  sound cue, so the player can time the parry by sight or by sound.
- **FR-004**: The parry window MUST be 250 ms long by default and 500 ms in easy mode, ending
  at the moment the attack would land (for the whirlwind kick, the moment it lands). The middle half of the window (from 75% to 25% of the
  window before the attack lands) is the perfect parry zone.
- **FR-005**: A parry key press inside the window MUST cancel the attack's damage and perform
  an Aikido throw that defeats the enemy: the character catches the attacker, leads them over
  to the other side and drops them right next to them. A press inside the perfect parry zone
  MUST perform a critical throw instead: the attacker is thrown 3 to 6 feet away (about 70 to
  140 stage units), with its own sound and flash effect (a steady glow when reduced motion is
  on).
- **FR-006**: After every parry key press, hit or miss, the parry key MUST be ignored for a
  cooldown at least as long as the parry window (250 ms by default, 500 ms in easy mode). A
  press after an attack has landed, or a press outside the window that is let go again while an
  attack is on its way (an enemy on the player's line showing its warning), MUST put the
  character into a 0.5-second stumble, during which they cannot
  parry. Whichever ends later applies.
- **FR-006a**: If the parry key (or Parry button) is being held when an attack lands, and the
  press was not a parry, the attack MUST be blocked: no damage, no throw and no points. While
  blocking, the character stands still in a guard. Pressing the key with no attack on its way
  only raises the guard; letting go lowers it again. The throw is shown only for a real parry.

  | What the player does | Result |
  |---|---|
  | Press inside the window | Parry and throw |
  | Press early and keep holding until the hit lands | Block: no damage, no throw |
  | Press early and let go before the hit lands | Miss: stumble, and the hit lands |
  | Press and let go with no attack on its way | Guard up, then down: nothing else happens |
  | Press after the hit | Miss |
- **FR-007**: The player MUST also have a strike that pushes an enemy back a short distance
  without damaging or knocking it down. A strike on an approaching enemy, or on a winding-up enemy whose attack hasn't been delayed
  yet, MUST cancel any wind-up and delay its next attack by a random time between 1 and 2.5
  seconds. Once an enemy's attack has been delayed, further strikes only push it back until it has
  attacked again; they don't cancel its wind-up. Each strike also removes 1 of the enemy's
  health points (FR-008).
- **FR-007a**: After a strike, the strike key MUST be ignored for a 1.5-second cooldown, so
  strikes can't be chained. The parry key stays available during the strike cooldown.
- **FR-007b**: A successful parry of the first attack an enemy makes after the player struck it
  MUST count as a perfect parry (strike + parry combo), with a critical throw, wherever in the
  window the press falls.
- **FR-008**: Each enemy MUST start with 4 health points. A strike MUST remove 1. A successful
  parry MUST defeat the enemy at once, whatever health it has left. An enemy MUST also be
  defeated when strikes bring its health to 0, earning fewer points than a throw. A defeated
  enemy disappears once its throw lands, or right away after the last strike. Any other enemy
  that a thrown enemy touches on its way MUST be defeated too, for the same points as a throw.
  Each enemy MUST show its remaining health.
- **FR-009**: The player MUST have a health bar. The game ends when it reaches zero.

**Single-player, offline sessions**

- **FR-010**: Each game session MUST belong to exactly one player and run entirely on that
  player's device.
- **FR-011**: Players MUST NOT be able to see, meet or interact with other players in any way.
  Playing MUST NOT send any game data to the dojo's servers.
- **FR-012**: Any number of visitors MUST be able to play at the same time, each in their own
  session, without any session affecting another or anyone waiting for a free slot.
- **FR-013**: The game MUST pause automatically when the player switches away from it, and
  MUST have a pause button and key. It MUST resume only when the player chooses to.

**Suitable for ages 10+**

- **FR-014**: The game MUST NOT show blood, injury, weapons or animations of characters dying.
  Defeated enemies vanish in a friendly effect (for example a puff of smoke).
- **FR-015**: The game MUST NOT ask for, collect or show any personal information, and MUST NOT
  let players contact anyone.

**Game flow**

- **FR-016**: A game MUST consist of 5 waves of increasing
  difficulty, lasting about 3 to 5 minutes in total.
- **FR-017**: The game MUST end in a win when all waves are cleared and a loss when the player's
  health reaches zero. A win MUST end with the character bowing, then the dojo doors closing,
  before the results screen.
- **FR-017a**: Each game MUST begin with an entrance: the character walks in from the left, bows
  at the edge of the mat and steps into the middle of the dojo. Attack keys do nothing and no
  enemies appear until the entrance ends (about 4 seconds).
- **FR-018**: The results screen MUST show the player's throws, perfect parries (including
  strike + parry combos), enemies defeated and score, and
  MUST offer "Play again".
- **FR-019**: Scores and statistics MUST be shown only on the results screen and MUST be
  discarded when the player leaves or starts a new game. Nothing about a game is stored.
- **FR-019a**: The player MUST be able to choose a male or female aikidoka (white gi and dark
  hakama) before playing. The choice MUST be remembered on the device, like easy mode.

**Controls, access and language**

- **FR-020**: Keyboard controls MUST be: arrow keys or WASD to move, Space to parry, one other
  key to strike, and Escape to pause. Controls MUST be listed on the "How to play" screen.
- **FR-021**: On touch devices, the game MUST show on-screen controls: a movement pad, a parry
  button, a strike button and a pause button, large enough to press accurately with a thumb.
  The parry window MUST be the same on touch and keyboard, and the game MUST be playable at
  phone width in landscape.
- **FR-022**: All menus, the pause screen and the results screen MUST be usable by keyboard
  alone.
- **FR-023**: All game text MUST be available in English and Vietnamese and follow the
  language the visitor chose on the website. Aikido terms MUST stay untranslated.
- **FR-024**: The game MUST start with sound off. Sound turns on only when the player turns it
  on with the sound button or switch, and the choice is remembered on that device. Pressing
  game keys MUST NOT turn sound on.
- **FR-025**: When the visitor's device asks for reduced motion, screen shake and flashing
  effects MUST be toned down, while the parry warning stays clearly visible.
- **FR-026**: The game MUST be reachable from the dojo website through a clearly labeled link,
  and MUST NOT slow down loading of the rest of the website.
- **FR-027**: While the game page loads, it MUST show a loading message. If the game can't start
  or stops working (for example the browser can't draw it), it MUST show a friendly message in
  the visitor's language with a link back to the dojo website, instead of a blank page.

### Key Entities

- **Game session**: One player's game, on one device. Has the current wave, the player's health,
  score and counts of throws and perfect parries, and whether easy mode is on. Exists only while
  the game is open.
- **Enemy**: A computer-controlled opponent. Has a type (walker or dasher), position, health (4
  points) and current action (moving, winding up, attacking, knocked down). One successful
  parry defeats it whatever its health.
- **Wave**: One stage of a game. Has a number and the list of enemies it sends.
- **Game result**: The final outcome (win or loss) and the player's statistics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In testing with players aged 10 to 13, 8 out of 10 land their first throw within
  their first five attempts, after reading only the "How to play" screen.
- **SC-002**: A correctly timed parry is counted as successful 100% of the time, on both
  keyboard and touch.
- **SC-003**: A full game (all waves) takes between 3 and 5 minutes for an average player.
- **SC-004**: 30 visitors playing at the same time each get a working game, and none of them
  notices any difference from playing alone.
- **SC-005**: Adding the game does not make the dojo website's home page load more slowly for
  visitors who don't open the game.
- **SC-006**: A parent reviewing the game finds no content unsuitable for a 10-year-old: no
  blood, no contact with others, no collection of personal information.
- **SC-007**: On a phone in landscape, players land a throw with the on-screen parry button
  as often as players using the keyboard (within 10 percentage points) in testing.

## Assumptions

- Players don't need an account or to sign in. The game is open to any website visitor.
- The game is an extra on the dojo website for fun and outreach, not a training tool, so the
  throws only need to look Aikido-inspired, not be technically accurate.
- "Offline" means players don't interact with each other. Playing without an internet
  connection is not a requirement.
- The original request for 3 players in a room is replaced by single-player sessions. Online
  multiplayer is out of scope.
- Art, characters and sounds are original or properly licensed, and placeholders are clearly
  marked until final assets are ready.
- Art direction (approved 2026-11-12): arcade-brawler pixel sprites, about 5 heads tall, with
  2-tone shading and a guard stance (fists at chest height), on a flat cartoon pixel-art dojo.
  The player is a male or female aikidoka in a white gi and dark hakama. Enemies are
  troublemakers with no weapons: walkers (cap and jacket) and dashers (spiky hair, headband,
  jersey). All designs are original to this project. The first sprites are generated
  placeholders; an artist will replace them later without gameplay changes.
- Nothing is stored on the server, so no database or backend change is needed.
- Desktop and laptop players use a physical keyboard; phone and tablet players use touch.
- On phones, players are asked to turn the device sideways (landscape) to play.
- Staff do not need to manage the game through the admin interface in this version.
