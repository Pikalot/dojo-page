import { TUNING } from '../engine/tuning.js';
// Cartoon pixel-art dojo drawn by scripts/draw-game-background.py.
import dojoBackgroundUrl from './dojo-background.png';
// Character sprite sheets drawn by scripts/draw-game-sprites.py. Placeholder art: an artist can
// replace the PNGs (same frame size, feet point and frame names; see sprites/README.md).
import dasherUrl from './sprites/dasher.png';
import femaleUrl from './sprites/female.png';
import maleUrl from './sprites/male.png';
import SPRITES from './sprites/sprites.json';
import walkerUrl from './sprites/walker.png';

/*
 * Draws one frame of the game. Hit boxes come only from the engine's stage units; drawing
 * just picks a sprite frame for each character's action and timing.
 */

const { stage, floor, enemy: E, player: P } = TUNING;
const SHEET_URLS = { male: maleUrl, female: femaleUrl, walker: walkerUrl, dasher: dasherUrl };
const SCALE = SPRITES.unitsPerPixel;
const FRAME_W = SPRITES.frameWidth;
const FRAME_H = SPRITES.frameHeight;
// About how tall a standing character is, in stage units (for health pips and the warning).
const HEAD_TOP = 140;

const COLORS = {
  wall: '#f1e6d0',
  wallTrim: '#8a4f08',
  floor: '#c9cf8f',
  outline: '#1c1c1c',
  warning: '#ffcf33',
  flash: '#ffffff',
  shadow: 'rgb(0 0 0 / 0.18)',
  pipFull: '#e99a37',
  pipEmpty: 'rgb(0 0 0 / 0.25)',
  smoke: '#e6e4e4',
  white: '#ffffff',
  dashLine: 'rgb(122 35 30 / 0.45)',
};

// ---- Images, loaded once on first draw. Until they arrive, simple shapes stand in. ----

const images = {};
function image(key, url) {
  if (!images[key] && typeof Image !== 'undefined') {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    images[key] = img;
  }
  const img = images[key];
  return img?.complete && img.naturalWidth > 0 ? img : null;
}

/** Scale and centre the 960 × 540 stage inside the canvas, letterboxed, never stretched. */
function fitStage(ctx) {
  const { width, height } = ctx.canvas;
  const scale = Math.min(width / stage.width, height / stage.height);
  const offsetX = (width - stage.width * scale) / 2;
  const offsetY = (height - stage.height * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  // Pixel art: scale up without smoothing so the pixels stay crisp.
  ctx.imageSmoothingEnabled = false;
}

function drawStage(ctx) {
  const bg = image('background', dojoBackgroundUrl);
  if (bg) {
    ctx.drawImage(bg, 0, 0, stage.width, stage.height);
    return;
  }
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, stage.width, floor.top - 20);
  ctx.fillStyle = COLORS.wallTrim;
  ctx.fillRect(0, floor.top - 34, stage.width, 14);
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, floor.top - 20, stage.width, stage.height - floor.top + 20);
}

// ---- Sprites ----

function shadow(ctx, x, y, width = 30) {
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y, width, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws one frame of a character with its feet at (x, y), facing 1 (right) or -1 (left).
 * `lift` raises it off the floor (stage units); `alpha` fades it.
 */
function sprite(ctx, sheet, frame, x, y, { facing = 1, lift = 0, alpha = 1 } = {}) {
  const meta = SPRITES.characters[sheet];
  const img = image(sheet, SHEET_URLS[sheet]);
  const index = meta.frames.indexOf(frame);
  if (!img || index < 0) {
    // Stand-in until the sheet has loaded.
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = COLORS.outline;
    ctx.fillRect(x - 12, y - lift - 120, 24, 120);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y - lift);
  ctx.scale(facing, 1);
  ctx.drawImage(
    img,
    index * FRAME_W,
    0,
    FRAME_W,
    FRAME_H,
    -SPRITES.originX * SCALE,
    -SPRITES.originY * SCALE,
    FRAME_W * SCALE,
    FRAME_H * SCALE,
  );
  ctx.restore();
}

function walkFrame(time) {
  return Math.floor(time / 150) % 2 ? 'walk1' : 'walk2';
}

function glow(ctx, x, y, color, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - 65, 50, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function exclamation(ctx, x, y) {
  ctx.save();
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 7;
  ctx.strokeStyle = COLORS.outline;
  ctx.fillStyle = COLORS.warning;
  ctx.strokeText('!', x, y - HEAD_TOP - 30);
  ctx.fillText('!', x, y - HEAD_TOP - 30);
  ctx.restore();
}

function healthPips(ctx, enemy) {
  for (let i = 0; i < E.health; i += 1) {
    ctx.fillStyle = i < enemy.health ? COLORS.pipFull : COLORS.pipEmpty;
    ctx.beginPath();
    ctx.arc(enemy.x - 18 + i * 12, enemy.y - HEAD_TOP - 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function clockIcon(ctx, x, y) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.outline;
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 4, y);
  ctx.stroke();
  ctx.restore();
}

function smoke(ctx, x, y, progress) {
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.fillStyle = COLORS.smoke;
  for (const [ox, oy, r] of [
    [0, -30, 22],
    [-18, -18, 16],
    [18, -20, 16],
    [0, -50, 14],
  ]) {
    ctx.beginPath();
    ctx.arc(x + ox * (1 + progress), y + oy * (1 + progress * 0.5), r * (0.8 + progress), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---- The player ----

/** Which frame the player shows, and which way they face. */
export function playerFrame(player, time) {
  let frame = 'stand';
  let facing = player.facing;
  switch (player.action) {
    case 'entering':
      return { frame: walkFrame(time), facing: 1 };
    case 'moving':
      frame = walkFrame(time);
      break;
    case 'bowing':
      frame = 'bow';
      break;
    case 'striking':
      frame = 'strike';
      break;
    case 'blocking':
      frame = 'block';
      break;
    case 'stumbling':
      frame = 'stumble';
      break;
    case 'hit':
      frame = 'hit';
      break;
    case 'throwing': {
      // Catch and lead facing the attacker, then turn under and bring them down on the far side.
      // (The engine already turned the player to face the far side.)
      const p = 1 - (player.actionEndsAt - time) / P.throwMs;
      if (p < 0.25) [frame, facing] = ['grab', -player.facing];
      else if (p < 0.5) [frame, facing] = ['lead', -player.facing];
      else if (p < 0.75) frame = 'turn';
      else frame = 'follow';
      break;
    }
    default:
  }
  return { frame, facing };
}

function drawPlayer(ctx, session, { reducedMotion, character }) {
  const { player, time, enemies } = session;
  const sheet = character === 'female' ? 'female' : 'male';
  const { frame, facing } = playerFrame(player, time);
  const blink = player.action === 'hit' && !reducedMotion && Math.floor(time / 60) % 2 === 0;

  // Critical throw: a white flash around the player too (a steady glow with reduced motion).
  const critical = enemies.find((e) => e.action === 'thrown' && e.critical);
  if (critical) {
    const since = time - critical.actionStartedAt;
    if (since < 300) glow(ctx, player.x, player.y, COLORS.flash, reducedMotion ? 0.35 : 0.8 - since / 400);
  }
  shadow(ctx, player.x, player.y);
  sprite(ctx, sheet, frame, player.x, player.y, { facing, alpha: blink ? 0.5 : 1 });
}

// ---- Enemies ----

/** Which frame an enemy shows, which way it faces and how high it is off the floor. */
export function enemyFrame(enemy, session) {
  const { player, time } = session;
  const since = time - enemy.actionStartedAt;
  const towardPlayer = Math.sign(player.x - enemy.x) || 1;
  switch (enemy.action) {
    case 'approaching': {
      const close = Math.abs(player.x - enemy.x) <= TUNING.distance.standOff + 4;
      return { frame: close ? 'stand' : walkFrame(time + enemy.id * 70), facing: towardPlayer };
    }
    case 'windingUp':
      return { frame: 'windup', facing: towardPlayer };
    case 'attacking':
      return { frame: enemy.kickLanded ? 'lands' : 'punch', facing: towardPlayer };
    case 'recovering':
      return { frame: enemy.kickLanded && since < 250 ? 'lands' : 'stand', facing: towardPlayer };
    case 'pushedBack':
      return { frame: 'pushed', facing: towardPlayer };
    case 'dashWindUp':
      return { frame: 'crouch', facing: towardPlayer };
    case 'spinning': {
      // A hop, then the spin loops while it flies in (a full turn every 240 ms).
      if (since < 120) return { frame: 'hop', facing: enemy.dashDir };
      const spin = ['spinFront', 'spinToward', 'spinBehind', 'spinAway'];
      return { frame: spin[Math.floor((since - 120) / 60) % 4], facing: enemy.dashDir };
    }
    case 'overshoot':
      return { frame: 'lands', facing: enemy.dashDir };
    case 'thrown': {
      const p = Math.min(1, since / E.thrownFlightMs);
      const facing = Math.sign(enemy.toX - enemy.fromX) || 1;
      const frames = [
        [0.15, 'caught'],
        [0.35, 'air1'],
        [0.6, 'air2'],
        [0.8, 'air3'],
        [Infinity, 'air4'],
      ];
      const frame = frames.find(([limit]) => p < limit)[1];
      // Up and over the player's head, then down on the far side.
      const lift = Math.sin(p * Math.PI) * (enemy.critical ? 130 : 110);
      return { frame, facing, lift };
    }
    case 'defeated':
      return { frame: 'lying', facing: Math.sign(enemy.toX - enemy.fromX) || -towardPlayer };
    default:
      return { frame: 'stand', facing: towardPlayer };
  }
}

function drawEnemy(ctx, enemy, session, { reducedMotion }) {
  const { player, time } = session;
  const since = time - enemy.actionStartedAt;
  const { frame, facing, lift = 0 } = enemyFrame(enemy, session);

  if (enemy.action === 'defeated') {
    const progress = Math.min(1, since / E.smokeMs);
    shadow(ctx, enemy.x, enemy.y, 36);
    sprite(ctx, enemy.kind, frame, enemy.x, enemy.y, { facing, alpha: 1 - progress });
    smoke(ctx, enemy.x, enemy.y, progress);
    return;
  }

  // The warning is the wind-up pose itself plus a "!" (FR-003). No glow: players read the
  // attack's phases to time the grab.
  const warning = enemy.action === 'windingUp' || enemy.action === 'dashWindUp';
  if (enemy.action === 'dashWindUp') {
    // A line on the floor shows where the kick will come.
    ctx.save();
    ctx.strokeStyle = COLORS.dashLine;
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.lineTo(player.x, enemy.y);
    ctx.stroke();
    ctx.restore();
  }
  if (enemy.action === 'thrown' && enemy.critical) {
    const flash = reducedMotion ? 0.35 : Math.max(0, 0.8 - since / E.thrownFlightMs);
    glow(ctx, enemy.x, enemy.y - lift, COLORS.flash, flash);
  }

  // A swish where a dodged attack passed (FR-001a).
  if (enemy.lastDodgedAt != null && time - enemy.lastDodgedAt < 250) {
    ctx.save();
    ctx.globalAlpha = 1 - (time - enemy.lastDodgedAt) / 250;
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(enemy.x + facing * 30, enemy.y - 60, 34, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }

  shadow(ctx, enemy.x, enemy.y, lift > 0 ? 24 : 30);
  sprite(ctx, enemy.kind, frame, enemy.x, enemy.y, { facing, lift });

  if (enemy.action !== 'thrown') healthPips(ctx, enemy);
  if (warning) exclamation(ctx, enemy.x, enemy.y);
  if (enemy.delayUsed && enemy.nextAttackNotBefore > time) clockIcon(ctx, enemy.x + 34, enemy.y - HEAD_TOP - 8);
}

/** Things to draw this frame, sorted so characters lower on screen are in front. */
function drawables(session, options) {
  const list = [{ y: session.player.y, draw: (ctx) => drawPlayer(ctx, session, options) }];
  for (const enemy of session.enemies) {
    // Thrown enemies fly over everyone.
    const y = enemy.action === 'thrown' ? Infinity : enemy.y;
    list.push({ y, draw: (ctx) => drawEnemy(ctx, enemy, session, options) });
  }
  return list.sort((a, b) => a.y - b.y);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} session engine session
 * @param {{ reducedMotion?: boolean, character?: 'male'|'female' }} options
 */
export function drawFrame(ctx, session, options = {}) {
  fitStage(ctx);
  drawStage(ctx);
  for (const item of drawables(session, options)) item.draw(ctx);
}
