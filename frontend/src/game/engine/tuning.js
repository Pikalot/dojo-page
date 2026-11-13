/**
 * Every gameplay number in one place (data-model.md). Adjust here during play-testing;
 * nothing else in the game hard-codes these values. Times in ms, distances in stage units.
 */
export const STEP_MS = 1000 / 60;

export const TUNING = Object.freeze({
  stage: Object.freeze({ width: 960, height: 540 }),
  // Where feet can stand: the floor band with depth (FR-001).
  floor: Object.freeze({ left: 40, right: 920, top: 300, bottom: 500 }),

  player: Object.freeze({
    health: 100,
    speed: 220, // per second
    throwMs: 500, // can't be hit while throwing (as long as the thrown enemy's flight)
    hitMs: 300,
    strikeMs: 200,
  }),

  parry: Object.freeze({
    windowMs: 250,
    easyWindowMs: 500,
    // Perfect zone: from 0.75 × window to 0.25 × window before the attack lands.
    perfectFrom: 0.75,
    perfectTo: 0.25,
    // Cooldown after every press = the window length (FR-006).
    stumbleMs: 500,
  }),

  strike: Object.freeze({
    cooldownMs: 1500,
    delayMinMs: 1000,
    delayMaxMs: 2500,
    damage: 1,
    pushBack: 60,
    pushedBackMs: 300,
  }),

  distance: Object.freeze({
    lineTolerance: 20, // up or down (FR-001a)
    reach: 90, // player's parry and strike reach, across
    attackRange: 80, // a walker starts winding up at this distance or closer
    standOff: 70, // enemies stop this far from the player; the whirlwind kick lands here
    dashMin: 250,
    dashMax: 450,
    overshoot: 150,
    chainRadius: 40,
    // Throws land on the far side of the player: a normal throw right beside them, a critical
    // (perfect) throw 70 to 140 units away (3 to 6 feet for a character about 130 units tall).
    throwBeside: 45,
    throwCriticalMin: 70,
    throwCriticalMax: 140,
  }),

  enemy: Object.freeze({
    health: 4,
    walkSpeed: 120,
    kickSpeed: 300, // the whirlwind kick travels slowly enough to react to
    windUpMs: Object.freeze({ walker: 700, dasher: 500 }),
    dashWindUpMs: 500,
    attackMs: 200,
    recoverMs: 500,
    overshootRecoverMs: 600,
    // Every hit takes 10 health. The attack that ends a dash is a special move: 3 × damage.
    damage: 10,
    specialMultiplier: 3,
    thrownFlightMs: 500,
    downMs: 1000,
    smokeMs: 400,
  }),

  // Entrance at the start: walk in from off the left edge, bow at the edge of the mat,
  // then step into the middle of the dojo. Enemies start only after this.
  intro: Object.freeze({ startX: -40, bowX: 100, centerX: 480, walkSpeed: 200, bowMs: 1000 }),

  // Endless spawning for the US1 practice build; waves replace it in US2.
  practice: Object.freeze({ maxOnStage: 2, spawnGapMs: 2000, dasherChance: 0.3 }),

  waveIntroMs: 2000,
  spawnGapMs: 1000,
  // [walkers, dashers, max on stage at once]
  waves: Object.freeze([
    [4, 0, 2],
    [5, 1, 2],
    [6, 2, 3],
    [6, 4, 3],
    [7, 5, 4],
  ]),

  score: Object.freeze({
    throw: 100,
    perfectBonus: 50,
    // An enemy hit by someone being thrown is defeated too, worth the same as a throw.
    chainDefeat: 100,
    strikeDefeat: 50,
    dodge: 0,
  }),
});
