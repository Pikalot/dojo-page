import { applyStrike, createEnemy, EPS, throwEnemy, updateEnemies } from './enemies.js';
import { judgeParry, judgeStrike } from './parry.js';
import { createRandom } from './random.js';
import { TUNING } from './tuning.js';

/**
 * The game engine's public API (contracts/engine-api.md). Plain data and functions:
 * no React, DOM, canvas, timers or real clock. Only `step` moves time forward.
 */

const { floor, player: P, score: SCORE, practice: PRACTICE, intro: INTRO } = TUNING;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createSession({ seed = 1, easyMode = false } = {}) {
  return {
    phase: 'ready',
    time: 0,
    seed,
    easyMode,
    rng: createRandom(seed),
    waveIndex: 0,
    player: {
      x: (floor.left + floor.right) / 2,
      y: (floor.top + floor.bottom) / 2,
      facing: 1,
      health: P.health,
      action: 'idle',
      actionEndsAt: 0,
      move: { dx: 0, dy: 0 },
      stumbleUntil: 0,
      parryReadyAt: 0,
      strikeReadyAt: 0,
      // While the parry key is held (hold to block, FR-006a).
      guard: null,
    },
    enemies: [],
    nextEnemyId: 1,
    pendingSpawns: [],
    // Endless practice spawning (US1), switched on by `start`.
    practice: false,
    nextSpawnAt: 0,
    inputs: [],
    stats: { throws: 0, perfectParries: 0, combos: 0, enemiesDefeated: 0, dodges: 0, score: 0 },
    events: [],
  };
}

/**
 * Starts the game with the entrance: the player walks in from the left, bows at the edge
 * of the mat, then steps into the middle of the dojo. The fight (and enemies) start after.
 * For now enemies keep coming without end; waves arrive in US2.
 */
export function start(session) {
  if (session.phase !== 'ready') return;
  session.phase = 'entering';
  const { player } = session;
  player.x = INTRO.startX;
  player.y = (floor.top + floor.bottom) / 2;
  player.facing = 1;
  player.action = 'entering';
  player.actionEndsAt = 0;
}

function beginFight(session, at) {
  session.phase = 'fighting';
  session.player.action = 'idle';
  session.practice = true;
  session.nextSpawnAt = at + 500;
  emit(session, { type: 'fightStarted', at });
}

/** The entrance: the game moves the player; the player's keys don't, yet. */
function updateEntrance(session, end, dtMs) {
  const { player } = session;
  const walk = (INTRO.walkSpeed * dtMs) / 1000;
  if (player.action === 'entering' && player.x < INTRO.bowX) {
    player.x = Math.min(INTRO.bowX, player.x + walk);
    if (player.x === INTRO.bowX) {
      player.action = 'bowing';
      player.actionStartedAt = end;
      player.actionEndsAt = end + INTRO.bowMs;
    }
  } else if (player.action === 'bowing') {
    if (end >= player.actionEndsAt - EPS) {
      player.action = 'entering';
      // Step off the bowing spot in the same step, so the bow lasts exactly bowMs.
      player.x = Math.min(INTRO.centerX, player.x + walk);
    }
  } else {
    player.x = Math.min(INTRO.centerX, player.x + walk);
    if (player.x === INTRO.centerX) beginFight(session, end);
  }
}

/** Queues an input; it is applied at its own `at` time during the next `step`. */
export function pushInput(session, input) {
  session.inputs.push(input);
}

function emit(session, event) {
  session.events.push(event);
}

function faceToward(player, enemy) {
  player.facing = Math.sign(enemy.x - player.x) || player.facing;
}

function applyMove(session, input) {
  session.player.move = { dx: Math.sign(input.dx ?? 0), dy: Math.sign(input.dy ?? 0) };
}

function applyParry(session, at) {
  const { player } = session;
  const judgment = judgeParry({ at, player, enemies: session.enemies, easyMode: session.easyMode });
  if (judgment.result === 'ignored') return;
  player.parryReadyAt = judgment.parryReadyAt;

  if (judgment.result === 'miss') {
    // Too late: stumble at once, and holding the key doesn't block.
    player.guard = null;
    stumble(session, at, judgment.stumbleUntil, judgment.missKind);
    return;
  }
  if (judgment.result === 'guard') {
    // Early: guard while the key is held. Whether this blocks or stumbles is decided on release.
    player.guard = { since: at, parried: false, blocked: false };
    if (!PLAYER_BUSY.has(player.action)) player.action = 'blocking';
    return;
  }

  // A parry; if the key stays held it also blocks the next attack.
  player.guard = { since: at, parried: true, blocked: false };

  const enemy = session.enemies.find((e) => e.id === judgment.enemyId);
  faceToward(player, enemy);
  throwEnemy(session, enemy, { perfect: judgment.perfect, at });
  // The throw turns the player round: they finish facing where the attacker lands.
  player.facing = -player.facing;
  player.action = 'throwing';
  player.actionEndsAt = at + P.throwMs;
  const { stats } = session;
  stats.throws += 1;
  stats.score += SCORE.throw;
  if (judgment.perfect) {
    stats.perfectParries += 1;
    stats.score += SCORE.perfectBonus;
  }
  if (judgment.combo) stats.combos += 1;
  emit(session, { type: 'parried', at, enemyId: enemy.id, perfect: judgment.perfect, combo: judgment.combo });
}

function stumble(session, at, until, kind) {
  const { player } = session;
  player.stumbleUntil = until;
  player.action = 'stumbling';
  player.actionEndsAt = until;
  emit(session, { type: 'missedParry', at, kind });
}

// Enemies showing their warning: an attack is on its way.
const INCOMING = new Set(['windingUp', 'dashWindUp', 'spinning']);

/** Is an attack on its way toward the player's line? */
function attackIncoming(session) {
  const { player } = session;
  return session.enemies.some(
    (enemy) => INCOMING.has(enemy.action) && Math.abs(enemy.y - player.y) <= TUNING.distance.lineTolerance,
  );
}

/**
 * The parry key is let go. With no attack on its way this just lowers the guard. Letting go
 * early while an attack is coming, without having blocked anything, counts as a miss, so
 * tapping the key over and over doesn't pay (FR-006a).
 */
function applyRelease(session, at) {
  const { player } = session;
  const { guard } = player;
  if (!guard) return;
  player.guard = null;
  if (!guard.parried && !guard.blocked && attackIncoming(session)) {
    stumble(session, at, at + TUNING.parry.stumbleMs, 'early');
    return;
  }
  if (player.action === 'blocking') player.action = 'idle';
}

function applyStrikeInput(session, at) {
  const { player } = session;
  const judgment = judgeStrike({ at, player, enemies: session.enemies });
  if (judgment.result === 'ignored') return;
  player.strikeReadyAt = judgment.strikeReadyAt;
  if (!PLAYER_BUSY.has(player.action)) {
    player.action = 'striking';
    player.actionEndsAt = at + P.strikeMs;
  }
  const enemy = session.enemies.find((e) => e.id === judgment.enemyId);
  if (enemy) {
    faceToward(player, enemy);
    applyStrike(session, enemy, at);
  } else {
    emit(session, { type: 'struck', at, enemyId: null, delayed: false });
  }
}

// While busy the player can't move; parry and strike follow their own rules (parry.js).
const PLAYER_BUSY = new Set(['throwing', 'stumbling', 'hit', 'blocking']);

function movePlayer(session, dtMs) {
  const player = session.player;
  if (PLAYER_BUSY.has(player.action)) return;
  const { dx, dy } = player.move;
  if (!dx && !dy) {
    if (player.action === 'moving') player.action = 'idle';
    return;
  }
  const length = Math.hypot(dx, dy);
  const distance = (P.speed * dtMs) / 1000;
  player.x = clamp(player.x + (dx / length) * distance, floor.left, floor.right);
  player.y = clamp(player.y + (dy / length) * distance, floor.top, floor.bottom);
  if (dx && player.action !== 'striking') player.facing = dx;
  if (player.action === 'idle') player.action = 'moving';
}

function endPlayerActions(player, end) {
  const timed = ['throwing', 'stumbling', 'hit', 'striking'];
  if (timed.includes(player.action) && end >= player.actionEndsAt - EPS) {
    // Still holding the parry key: back into the guard.
    player.action = player.guard ? 'blocking' : 'idle';
  }
}

function spawnPractice(session, end) {
  if (!session.practice || end < session.nextSpawnAt) return;
  const active = session.enemies.filter((e) => e.action !== 'defeated' && e.action !== 'thrown');
  if (active.length >= PRACTICE.maxOnStage) return;
  const { rng } = session;
  const kind = rng.next() < PRACTICE.dasherChance ? 'dasher' : 'walker';
  const fromLeft = rng.next() < 0.5;
  session.enemies.push(
    createEnemy({
      id: session.nextEnemyId++,
      kind,
      x: fromLeft ? -30 : TUNING.stage.width + 30,
      y: rng.int(floor.top, floor.bottom),
      now: end,
    }),
  );
  session.nextSpawnAt = end + PRACTICE.spawnGapMs;
}

/**
 * Advances the game by exactly `dtMs` and returns the events that happened, in order.
 * Inputs are applied at their own times, before attacks due in the same step are resolved,
 * so a press inside the parry window always counts (SC-002). Does nothing unless fighting.
 */
export function step(session, dtMs) {
  session.events = [];
  const end = session.time + dtMs;
  if (session.phase === 'entering') {
    // Only movement keys count, so a key already held is honoured when the fight starts.
    for (const input of session.inputs.filter((i) => i.at <= end + EPS).sort((a, b) => a.at - b.at)) {
      if (input.type === 'move') applyMove(session, input);
    }
    session.inputs = session.inputs.filter((input) => input.at > end + EPS);
    updateEntrance(session, end, dtMs);
    session.time = end;
    return session.events;
  }
  if (session.phase !== 'fighting') {
    session.inputs = [];
    return session.events;
  }
  const due = session.inputs.filter((input) => input.at <= end + EPS).sort((a, b) => a.at - b.at);
  session.inputs = session.inputs.filter((input) => input.at > end + EPS);
  for (const input of due) {
    if (input.type === 'move') applyMove(session, input);
    else if (input.type === 'parry') applyParry(session, input.at);
    else if (input.type === 'parryRelease') applyRelease(session, input.at);
    else if (input.type === 'strike') applyStrikeInput(session, input.at);
  }
  endPlayerActions(session.player, end);
  movePlayer(session, dtMs);
  updateEnemies(session, end, dtMs);
  session.time = end;
  if (session.player.health <= 0) {
    // Game over (FR-009): the game stops here.
    session.phase = 'lost';
    session.practice = false;
    session.inputs = [];
    emit(session, { type: 'gameLost', at: end });
    return session.events;
  }
  spawnPractice(session, end);
  return session.events;
}

/** The final result once the game is won or lost, otherwise null. */
export function result(session) {
  if (session.phase !== 'won' && session.phase !== 'lost') return null;
  const { throws, perfectParries, combos, enemiesDefeated, score } = session.stats;
  return {
    outcome: session.phase,
    throws,
    perfectParries,
    combos,
    enemiesDefeated,
    score,
    wavesCleared: session.waveIndex,
  };
}
