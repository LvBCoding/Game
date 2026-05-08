import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import * as THREE from "three";

import type {
  HudState,
  JoystickState,
  NextWaveSignal,
  PlayerClass,
  Upgrades,
  WaveClearSummary,
} from "./GameWorld";

// ─── Constants ────────────────────────────────────────────────────────────────
const ARENA              = 24;
const PLAYER_SPEED       = 11;
const PICKUP_R           = 2.2;
const MAGNET_PICKUP_R    = 1.8;
const GREMLIN_HIT_R      = 1.3;
const GIANT_ATTACK_R     = 2.9;
const GIANT_PROJ_BLOCK_R = 2.8;
const GIANT_HP_MAX       = 100;
const GREMLIN_DMG        = 10;
const MAX_GREMLINS       = 30;
const MAX_HEARTS         = 30;
const MAGNET_DURATION    = 3.5;
const MAGNET_SUCTION     = 18;
const MAGNET_DROP_CHANCE = 0.04;
const COMBO_WINDOW       = 1.5;

const CLASSIC_PROJ_SPEED  = 28;
const CLASSIC_BASE_FIRE   = 1.3;
const CLASSIC_MIN_FIRE    = 0.3;
const CLASSIC_FIRE_RANGE  = 14;
const CLASSIC_PROJ_RADIUS = 0.28;
const CLASSIC_BASE_DMG    = 0.75;
const MAX_HARVEST_LEVEL   = 5;

const CLASSIC_ULT_DURATION = 3.0;
const CLASSIC_ULT_DPS      = 12;
const LASER_HIT_WIDTH      = 3;
function ultThreshold(wave: number) { return 8 + Math.floor((wave - 1) / 3) * 4; }

const GATLING_BASE_FIRE   = 1.5;
const GATLING_MIN_FIRE    = 0.01;
const GATLING_PROJ_SPEED  = 40;
const GATLING_PROJ_RADIUS = 0.13;
const GATLING_FIRE_RANGE  = 16;
const GATLING_DAMAGE      = 0.2;
const GATLING_EFF_DECAY   = 0.07;
const GATLING_EFF_MIN     = 0.15;

const SNIPER_BASE_FIRE        = 2.5;
const SNIPER_FIRE_RANGE       = 80;
const SNIPER_PROJ_SPEED_BASE  = 50;
const SNIPER_PROJ_RADIUS_BASE = 0.6;
const SNIPER_DAMAGE           = 8;

const SHOTGUN_BASE_FIRE  = 2.0;
const SHOTGUN_PROJ_SPEED = 16;
const SHOTGUN_FIRE_RANGE = 8;
const SHOTGUN_DAMAGE     = 3.0;
const SHOTGUN_TTL        = 0.58;

function gremlinsForWave(w: number)     { return 8 + (w - 1) * 4; }
function gremlinHpForWave(w: number)    { return 1 + Math.floor(w / 5); }
function spawnIntervalForWave(w: number){ return Math.max(0.35, 1.6 - (w - 1) * 0.12); }
function gremlinSpeedForWave(w: number) { return 1.4 + (w - 1) * 0.28; }

// ─── Game State Types ─────────────────────────────────────────────────────────
interface GremlinData { id: string; pos: THREE.Vector3; hp: number; maxHp: number }
interface HeartData   { id: string; pos: THREE.Vector3; bob: number }
interface ProjData    { id: string; pos: THREE.Vector3; dir: THREE.Vector3; ttl?: number }
interface MagnetData  { id: string; pos: THREE.Vector3 }

interface GS {
  player:           { pos: THREE.Vector3; facing: number };
  gremlins:         GremlinData[];
  hearts:           HeartData[];
  projs:            ProjData[];
  magnets:          MagnetData[];
  giantHp:          number;
  heartsCollected:  number;
  score:            number;
  wave:             number;
  phase:            "playing" | "waveclear" | "gameover";
  frameN:           number;
  uid:              number;
  gremlinT:         number;
  fireT:            number;
  gremlinsThisWave: number;
  gremlinsSpawned:  number;
  gremlinsKilled:   number;
  waveClearCalled:  boolean;
  magnetActive:     boolean;
  magnetTimer:      number;
  gatlingFireInt:         number;
  gatlingNoTgtT:          number;
  gatlingWaveClearTarget: number;
  ultKills:       number;
  ultActive:      boolean;
  ultTimer:       number;
  ultLaserAngle:  number;
  comboCount: number;
  comboTimer: number;
}

function initGS(wave = 1, giantHp = GIANT_HP_MAX, hearts = 0): GS {
  return {
    player: { pos: new THREE.Vector3(0, 0, 8), facing: 0 },
    gremlins: [], hearts: [], projs: [], magnets: [],
    giantHp, heartsCollected: hearts, score: 0, wave,
    phase: "playing",
    frameN: 0, uid: 0,
    gremlinT: 2.0, fireT: 1.0,
    gremlinsThisWave: gremlinsForWave(wave),
    gremlinsSpawned: 0, gremlinsKilled: 0,
    waveClearCalled: false,
    magnetActive: false, magnetTimer: 0,
    gatlingFireInt: GATLING_BASE_FIRE,
    gatlingNoTgtT: 0,
    gatlingWaveClearTarget: GATLING_BASE_FIRE,
    ultKills: 0,
    ultActive: false,
    ultTimer: 0,
    ultLaserAngle: 0,
    comboCount: 0,
    comboTimer: 100,
  };
}

const _dir  = new THREE.Vector3();
const _mag  = new THREE.Vector3();
const _ZERO = new THREE.Vector3(0, 0, 0);

// Swept collision: minimum distance from segment A→B to point P (2D, using x/z)
function segmentPointDist(ax: number, az: number, bx: number, bz: number, px: number, pz: number): number {
  const dx = bx - ax, dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.00001) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  joystickRef:    React.MutableRefObject<JoystickState>;
  upgradesRef:    React.MutableRefObject<Upgrades>;
  nextWaveRef:    React.MutableRefObject<NextWaveSignal>;
  ultActivateRef: React.MutableRefObject<boolean>;
  playerClass:    PlayerClass;
  onHudUpdate:    (h: HudState) => void;
  onWaveClear:    (s: WaveClearSummary) => void;
}

const PILLARS: [number, number][] = [
  [-24,-24],[0,-24],[24,-24],[24,0],[24,24],[0,24],[-24,24],[-24,0],
];

// ─── Pixel Sprite Helpers ─────────────────────────────────────────────────────
// Draw a pixel-art style rectangle (rounded to integer pixels)
function pxRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, outline?: string) {
  const rx = Math.round(x), ry = Math.round(y), rw = Math.round(w), rh = Math.round(h);
  if (outline) {
    ctx.fillStyle = outline;
    ctx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
  }
  ctx.fillStyle = fill;
  ctx.fillRect(rx, ry, rw, rh);
}

// Draw pixel-art circle approximated as octagon-ish shape
function pxCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string, outline?: string) {
  const rcx = Math.round(cx), rcy = Math.round(cy), rr = Math.round(r);
  if (outline) {
    ctx.fillStyle = outline;
    ctx.fillRect(rcx - rr - 1, rcy - rr - 1, rr * 2 + 2, rr * 2 + 2);
  }
  ctx.fillStyle = fill;
  // Draw as cross pattern for pixel art feel
  ctx.fillRect(rcx - rr, rcy - Math.round(rr * 0.6), rr * 2, Math.round(rr * 1.2));
  ctx.fillRect(rcx - Math.round(rr * 0.6), rcy - rr, Math.round(rr * 1.2), rr * 2);
  ctx.fillRect(rcx - Math.round(rr * 0.85), rcy - Math.round(rr * 0.85), Math.round(rr * 1.7), Math.round(rr * 1.7));
}

// Draw a smooth heart shape using bezier curves
function drawHeartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx,          cy - s * 0.1,  cx - s * 0.5, cy - s * 0.55, cx - s * 0.5, cy - s * 0.1);
  ctx.bezierCurveTo(cx - s * 0.5, cy - s * 0.65, cx,           cy - s * 0.65, cx,            cy - s * 0.1);
  ctx.bezierCurveTo(cx,           cy - s * 0.65, cx + s * 0.5,  cy - s * 0.65, cx + s * 0.5, cy - s * 0.1);
  ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.55, cx,            cy - s * 0.1,  cx,            cy + s * 0.35);
  ctx.closePath();
}

// Draw a small pixel heart shape (for collectibles)
function drawPixelHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, fill: string, outline?: string) {
  const s = size;
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    drawHeartPath(ctx, cx, cy, s);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  drawHeartPath(ctx, cx, cy, s);
  ctx.fill();
}

// Draw player sprite
function drawPlayer(ctx: CanvasRenderingContext2D, sx: number, sy: number, facing: number, pClass: PlayerClass, scale: number) {
  const bodyColor =
    pClass === "gatling"    ? "#ff8800"
    : pClass === "sniper"   ? "#00ddaa"
    : pClass === "shotgunner" ? "#cc44ff"
    : "#4477ff";
  const darkColor =
    pClass === "gatling"    ? "#994400"
    : pClass === "sniper"   ? "#008866"
    : pClass === "shotgunner" ? "#7700aa"
    : "#223388";

  const b = Math.round(scale * 0.55); // body half-width
  const h = Math.round(scale * 0.85); // body half-height
  const hd = Math.round(scale * 0.38); // head radius
  const cx = Math.round(sx), cy = Math.round(sy);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(cx - b + 2, cy - Math.round(h * 0.3) + 2, b * 2, Math.round(h * 0.6));

  // Body
  pxRect(ctx, cx - b, cy - h, b * 2, h * 2, bodyColor, darkColor);

  // Highlight stripe
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(cx - b + 1, cy - h + 1, Math.round(b * 0.6), h * 2 - 2);

  // Head
  pxCircle(ctx, cx, cy - h - hd, hd, bodyColor, darkColor);

  // Eyes (2 white dots)
  const eyeOff = Math.round(hd * 0.35);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - eyeOff - 1, cy - h - hd - 1, 3, 3);
  ctx.fillRect(cx + eyeOff - 1, cy - h - hd - 1, 3, 3);
  ctx.fillStyle = "#000000";
  ctx.fillRect(cx - eyeOff, cy - h - hd, 2, 2);
  ctx.fillRect(cx + eyeOff, cy - h - hd, 2, 2);

  // Weapon indicator (short barrel pointing in facing direction)
  const wx = Math.sin(facing);
  const wz = Math.cos(facing);
  const barrelLen = Math.round(scale * 0.7);
  const barrelW = Math.max(2, Math.round(scale * 0.15));
  ctx.fillStyle = darkColor;
  const bx = cx + Math.round(wx * (b + barrelLen / 2));
  const by = cy + Math.round(wz * (b + barrelLen / 2));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(facing);
  ctx.fillRect(-barrelW / 2, -b, barrelW, -barrelLen);
  ctx.restore();

  // Class accent dot
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - 1, cy - h + 2, 3, 3);
}

// Draw gremlin sprite
function drawGremlin(ctx: CanvasRenderingContext2D, sx: number, sy: number, hp: number, maxHp: number, scale: number, t: number) {
  const cx = Math.round(sx), cy = Math.round(sy);
  const b = Math.round(scale * 0.45);
  const h = Math.round(scale * 0.7);

  // Bob animation
  const bob = Math.round(Math.sin(t * 8 + cx * 0.1) * 1.5);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(cx - b + 2, cy + h + bob, b * 2 - 2, 3);

  // Body
  pxRect(ctx, cx - b, cy - h + bob, b * 2, h * 2, "#22cc22", "#116611");

  // Darker underbelly
  ctx.fillStyle = "#118811";
  ctx.fillRect(cx - b + 1, cy + bob, b * 2 - 2, h);

  // Head (slightly wider than body)
  const hb = Math.round(b * 1.1);
  const hh = Math.round(h * 0.55);
  pxRect(ctx, cx - hb, cy - h - hh + bob, hb * 2, hh, "#33ee33", "#116611");

  // Eyes (red glowing)
  const eOff = Math.round(hb * 0.38);
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(cx - eOff - 1, cy - h - hh + bob + 1, 4, 4);
  ctx.fillRect(cx + eOff - 3, cy - h - hh + bob + 1, 4, 4);
  ctx.fillStyle = "#ff8800";
  ctx.fillRect(cx - eOff, cy - h - hh + bob + 2, 2, 2);
  ctx.fillRect(cx + eOff - 2, cy - h - hh + bob + 2, 2, 2);

  // HP bar (only if damaged)
  if (hp < maxHp) {
    const barW = b * 2 + 2;
    const barH = 3;
    const barX = cx - b - 1;
    const barY = cy - h - hh + bob - 6;
    ctx.fillStyle = "#330000";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hp / maxHp > 0.5 ? "#44ff44" : "#ff4400";
    ctx.fillRect(barX, barY, Math.round(barW * hp / maxHp), barH);
  }
}

// Draw collectible heart
function drawCollectibleHeart(ctx: CanvasRenderingContext2D, sx: number, sy: number, scale: number) {
  drawPixelHeart(ctx, sx, sy, scale * 0.5, "#ff3388", "#880022");
  // Sparkle
  ctx.fillStyle = "rgba(255,150,200,0.6)";
  ctx.fillRect(Math.round(sx) + Math.round(scale * 0.3), Math.round(sy) - Math.round(scale * 0.5), 2, 2);
}

// Draw magnet pickup
function drawMagnet(ctx: CanvasRenderingContext2D, sx: number, sy: number, scale: number, t: number) {
  const cx = Math.round(sx), cy = Math.round(sy);
  const r = Math.round(scale * 0.4);
  // Rotating diamond
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 2);
  ctx.fillStyle = "#554400";
  ctx.fillRect(-r - 1, -r - 1, r * 2 + 2, r * 2 + 2);
  ctx.fillStyle = "#ffdd00";
  ctx.fillRect(-r, 0, r * 2, r);
  ctx.fillRect(-r, -r, r * 2, r);
  ctx.fillStyle = "#ffff88";
  ctx.fillRect(-Math.round(r * 0.5), -r, Math.round(r * 0.5), r * 2);
  ctx.restore();
}

// Draw pillar
function drawPillar(ctx: CanvasRenderingContext2D, sx: number, sy: number, scale: number) {
  const cx = Math.round(sx), cy = Math.round(sy);
  const r = Math.max(3, Math.round(scale * 0.28));
  const h = Math.round(scale * 0.8);
  pxRect(ctx, cx - r, cy - h, r * 2, h * 2, "#5a0090", "#2a0050");
  ctx.fillStyle = "#7a00bb";
  ctx.fillRect(cx - r + 1, cy - h + 1, Math.round(r * 0.7), h * 2 - 2);
}

// Draw giant heart at center
function drawGiantHeart(ctx: CanvasRenderingContext2D, sx: number, sy: number, hp: number, t: number, scale: number) {
  const pulse = 1 + Math.sin(t * 3) * 0.05;
  const size = scale * 2.2 * pulse;
  const cx = Math.round(sx);
  const cy = Math.round(sy);

  // Outer glow
  ctx.save();
  ctx.globalAlpha = 0.15 + Math.sin(t * 2) * 0.05;
  ctx.fillStyle = "#ff0044";
  drawHeartPath(ctx, cx, cy, size * 1.35);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000000";
  drawHeartPath(ctx, cx + 5, cy + 6, size * 0.95);
  ctx.fill();
  ctx.restore();

  // Main heart fill
  const grad = ctx.createRadialGradient(cx - size * 0.15, cy - size * 0.1, size * 0.05, cx, cy, size * 0.9);
  grad.addColorStop(0, "#ff4488");
  grad.addColorStop(0.5, "#ff0044");
  grad.addColorStop(1, "#880022");
  ctx.fillStyle = grad;
  drawHeartPath(ctx, cx, cy, size);
  ctx.fill();

  // Outline
  ctx.strokeStyle = "#cc0033";
  ctx.lineWidth = 2;
  drawHeartPath(ctx, cx, cy, size);
  ctx.stroke();

  // Shine highlight
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "rgba(255,180,200,0.7)";
  drawHeartPath(ctx, cx - size * 0.12, cy - size * 0.18, size * 0.4);
  ctx.fill();
  ctx.restore();

  // Health bar below the heart
  const hpPct = Math.max(0, hp / GIANT_HP_MAX);
  const barW = Math.round(size * 2.4);
  const barH = Math.max(6, Math.round(scale * 0.22));
  const barX = cx - Math.round(barW / 2);
  const barY = cy + Math.round(size * 0.55);

  // Bar background
  ctx.fillStyle = "#330011";
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

  // Bar fill (green→yellow→red based on hp)
  const barColor = hpPct > 0.6 ? "#ff2255" : hpPct > 0.3 ? "#ff8800" : "#ff0000";
  ctx.fillStyle = barColor;
  ctx.fillRect(barX, barY, Math.round(barW * hpPct), barH);

  // Bar shine
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(barX, barY, Math.round(barW * hpPct), Math.round(barH / 2));

  // HP label
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.max(9, Math.round(scale * 0.18))}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`♥ ${Math.ceil(hp)}`, cx, barY + barH + Math.round(scale * 0.2) + 2);
  ctx.textAlign = "left";
}

// Draw floor tiles
function drawFloor(ctx: CanvasRenderingContext2D, camX: number, camZ: number, scale: number, W: number, H: number, t: number) {
  const tileSize = Math.round(scale);
  const startX = Math.floor((camX - W / 2 / scale)) - 1;
  const startZ = Math.floor((camZ - H / 2 / scale)) - 1;
  const endX   = Math.ceil((camX + W / 2 / scale)) + 1;
  const endZ   = Math.ceil((camZ + H / 2 / scale)) + 1;

  for (let tz = startZ; tz <= endZ; tz++) {
    for (let tx = startX; tx <= endX; tx++) {
      // Clip to arena
      const inArena = Math.abs(tx) <= ARENA && Math.abs(tz) <= ARENA;
      const sx = Math.round(W / 2 + (tx - camX) * scale);
      const sy = Math.round(H / 2 + (tz - camZ) * scale);

      if (inArena) {
        const isDark = (tx + tz) % 2 === 0;
        ctx.fillStyle = isDark ? "#0d0025" : "#0f0028";
        ctx.fillRect(sx, sy, tileSize, tileSize);
        // Subtle grid line
        ctx.fillStyle = "rgba(50,0,80,0.5)";
        ctx.fillRect(sx, sy, tileSize, 1);
        ctx.fillRect(sx, sy, 1, tileSize);
      } else {
        // Out of bounds - darker
        ctx.fillStyle = "#07000f";
        ctx.fillRect(sx, sy, tileSize, tileSize);
        ctx.fillStyle = "rgba(20,0,40,0.5)";
        ctx.fillRect(sx, sy, tileSize, 1);
        ctx.fillRect(sx, sy, 1, tileSize);
      }
    }
  }

  // Arena border highlight
  const borderPositions = [
    { x: -ARENA, z: -ARENA, w: ARENA * 2, h: 0.15 },
    { x: -ARENA, z: ARENA, w: ARENA * 2, h: 0.15 },
    { x: -ARENA, z: -ARENA, w: 0.15, h: ARENA * 2 },
    { x: ARENA, z: -ARENA, w: 0.15, h: ARENA * 2 },
  ];
  ctx.fillStyle = "#6600aa";
  for (const b of borderPositions) {
    const bx = Math.round(W / 2 + (b.x - camX) * scale);
    const by = Math.round(H / 2 + (b.z - camZ) * scale);
    const bw = Math.round(b.w * scale);
    const bh = Math.round(b.h * scale);
    ctx.fillRect(bx, by, bw || 2, bh || 2);
  }
}

// Draw projectile
function drawProjectile(ctx: CanvasRenderingContext2D, sx: number, sy: number, pClass: PlayerClass, radius: number, scale: number) {
  const r = Math.max(2, Math.round(radius * scale));
  const cx = Math.round(sx), cy = Math.round(sy);

  const fill =
    pClass === "gatling"      ? "#ffcc00"
    : pClass === "sniper"     ? "#00ffcc"
    : pClass === "shotgunner" ? "#ff88ff"
    : "#ffaadd";
  const core =
    pClass === "gatling"      ? "#ffffff"
    : pClass === "sniper"     ? "#ffffff"
    : pClass === "shotgunner" ? "#ffffff"
    : "#ffffff";

  // Glow
  ctx.fillStyle = fill.replace(")", ",0.25)").replace("rgb(", "rgba(") + "";
  ctx.fillRect(cx - r - 2, cy - r - 2, (r + 2) * 2, (r + 2) * 2);

  // Main bullet
  ctx.fillStyle = fill;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Core shine
  ctx.fillStyle = core;
  ctx.fillRect(cx - Math.max(1, Math.round(r * 0.4)), cy - Math.max(1, Math.round(r * 0.4)), Math.max(1, Math.round(r * 0.5)), Math.max(1, Math.round(r * 0.5)));
}

// Draw laser beam — two-sided spinning beam.
// Rotation: ctx.rotate(-angle) so that world-space direction (sin(angle), cos(angle))
// maps correctly to screen-space (+x right, +y down = world +z down).
function drawLaser(ctx: CanvasRenderingContext2D, px: number, py: number, angle: number, scale: number, W: number, H: number, t: number) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-angle);
  const beamW = Math.round(LASER_HIT_WIDTH * scale);
  const beamL = Math.round(ARENA * 2.5 * scale); // extend past arena edge
  const flicker = 0.75 + Math.sin(t * 40) * 0.15;

  // Outer glow
  ctx.globalAlpha = flicker * 0.35;
  ctx.fillStyle = "#ff0066";
  ctx.fillRect(-Math.round(beamW * 1.5), -beamL, Math.round(beamW * 3), beamL * 2);

  // Main beam (both directions)
  ctx.globalAlpha = flicker;
  ctx.fillStyle = "#ff0066";
  ctx.fillRect(-Math.round(beamW / 2), -beamL, beamW, beamL * 2);

  // Core
  ctx.globalAlpha = flicker * 0.8;
  ctx.fillStyle = "#ffaadd";
  ctx.fillRect(-Math.round(beamW / 4), -beamL, Math.round(beamW / 2), beamL * 2);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function GameScene2D({
  joystickRef, upgradesRef, nextWaveRef, ultActivateRef,
  playerClass, onHudUpdate, onWaveClear,
}: Props) {
  const canvasRef = useRef<any>(null);
  const gs = useRef<GS>(initGS());
  const camPos = useRef({ x: 0, z: 0 });

  const comboMult = (count: number) => Math.min(3, 1 + Math.max(0, count - 1) * 0.25);

  const buildHudState = (g: GS): HudState => {
    const activeCombo = g.comboTimer < COMBO_WINDOW;
    return {
      giantHeartHp:    g.giantHp,
      heartsCollected: g.heartsCollected,
      score:           g.score,
      wave:            g.wave,
      phase:           g.phase,
      gremlinsLeft:    Math.max(0, g.gremlinsThisWave - g.gremlinsKilled),
      gremlinsTotal:   g.gremlinsThisWave,
      magnetActive:    g.magnetActive,
      magnetTimer:     g.magnetTimer,
      gatlingCharge:   Math.max(0, Math.min(1,
        (GATLING_BASE_FIRE - g.gatlingFireInt) / (GATLING_BASE_FIRE - GATLING_MIN_FIRE)
      )),
      ultCharge: playerClass === "classic" ? g.ultKills : 0,
      ultMax:    playerClass === "classic" ? ultThreshold(g.wave) : 1,
      ultReady:  playerClass === "classic" && !g.ultActive && g.ultKills >= ultThreshold(g.wave),
      ultActive: g.ultActive,
      ultTimer:  g.ultTimer,
      comboCount: activeCombo ? g.comboCount : 0,
      comboMult:  activeCombo ? comboMult(g.comboCount) : 1,
    };
  };

  const killGremlin = (g: GS, gi: number, uid: () => string) => {
    const deadPos = g.gremlins[gi].pos.clone();
    g.gremlins.splice(gi, 1);
    g.gremlinsKilled++;
    if (g.comboTimer < COMBO_WINDOW) { g.comboCount++; } else { g.comboCount = 1; }
    g.comboTimer = 0;
    g.score += Math.round(10 * comboMult(g.comboCount));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (g.hearts.length < MAX_HEARTS) {
      g.hearts.push({ id: uid(), pos: deadPos.clone(), bob: Math.random() * Math.PI * 2 });
    }
    if (Math.random() < MAGNET_DROP_CHANCE) {
      g.magnets.push({ id: uid(), pos: deadPos.clone() });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement | null;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    // Size the canvas to fill its container
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width  || window.innerWidth;
      const h = rect.height || window.innerHeight;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let animId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      const rawDelta = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDelta, 0.1);
      const t  = now / 1000;

      const W = canvas.width;
      const H = canvas.height;
      const g = gs.current;
      g.frameN++;
      const uid = () => String(++g.uid);
      const upg = upgradesRef.current;

      // ── Scale & camera ──────────────────────────────────────────────────────
      // Camera is always locked at world center (0,0).
      // Scale so the full arena fits exactly inside the canvas with no outside visible.
      const scale = Math.min(W, H) / (ARENA * 2);

      // Camera shake during ult
      const shakeMag = g.ultActive ? scale * 0.18 : 0;
      const shakeX = g.ultActive ? (Math.random() - 0.5) * shakeMag : 0;
      const shakeZ = g.ultActive ? (Math.random() - 0.5) * shakeMag : 0;

      const camX = 0;
      const camZ = 0;

      // World → Screen helper
      const toSX = (wx: number) => W / 2 + (wx - camX) * scale + shakeX;
      const toSY = (wz: number) => H / 2 + (wz - camZ) * scale + shakeZ;

      // ── Combo timer ─────────────────────────────────────────────────────────
      g.comboTimer += dt;

      // ── Next-wave signal ─────────────────────────────────────────────────────
      if (g.phase === "waveclear" && nextWaveRef.current.ready) {
        const nw = nextWaveRef.current;
        nextWaveRef.current    = { ...nw, ready: false };
        g.wave                 = nw.wave;
        g.giantHp              = Math.min(GIANT_HP_MAX, nw.giantHp);
        g.heartsCollected      = nw.hearts;
        g.gremlinsThisWave     = gremlinsForWave(nw.wave);
        g.gremlinsSpawned      = 0;
        g.gremlinsKilled       = 0;
        g.waveClearCalled      = false;
        g.phase                = "playing";
        g.gremlinT             = 2.0;
        g.fireT                = 1.0;
        g.gremlins = []; g.projs = []; g.magnets = [];
        g.magnetActive = false; g.magnetTimer = 0;
        g.gatlingFireInt = g.gatlingWaveClearTarget;
        g.gatlingNoTgtT  = 0;
        g.ultActive = false; g.ultTimer = 0; g.ultLaserAngle = 0;
        g.comboCount = 0; g.comboTimer = 100;
      }

      // ── Wave clear check ─────────────────────────────────────────────────────
      if (g.phase === "playing" &&
          g.gremlinsKilled >= g.gremlinsThisWave &&
          g.gremlins.length === 0 &&
          !g.waveClearCalled) {
        g.waveClearCalled = true;
        g.phase = "waveclear";
        g.gatlingWaveClearTarget = GATLING_BASE_FIRE * 0.7 + g.gatlingFireInt * 0.3;
        onWaveClear({ heartsCollected: g.heartsCollected, giantHp: g.giantHp, wave: g.wave, score: g.score });
      }

      // ── Classic Ultimate activation ──────────────────────────────────────────
      if (playerClass === "classic" && ultActivateRef.current) {
        ultActivateRef.current = false;
        if (!g.ultActive && g.ultKills >= ultThreshold(g.wave)) {
          g.ultActive = true;
          g.ultTimer  = CLASSIC_ULT_DURATION;
          g.ultKills  = 0;
        }
      }

      if (g.phase === "playing") {
        // ── Spawn gremlins ────────────────────────────────────────────────────
        g.gremlinT -= dt;
        if (g.gremlinT <= 0 && g.gremlins.length < MAX_GREMLINS && g.gremlinsSpawned < g.gremlinsThisWave) {
          g.gremlinT = spawnIntervalForWave(g.wave);
          const side = Math.floor(Math.random() * 4);
          const e = ARENA + 1;
          const rnd = () => -ARENA + Math.random() * ARENA * 2;
          const sp =
            side === 0 ? new THREE.Vector3(rnd(), 0, -e)
            : side === 1 ? new THREE.Vector3(e, 0, rnd())
            : side === 2 ? new THREE.Vector3(rnd(), 0, e)
            : new THREE.Vector3(-e, 0, rnd());
          const hp = gremlinHpForWave(g.wave);
          g.gremlins.push({ id: uid(), pos: sp, hp, maxHp: hp });
          g.gremlinsSpawned++;
        }

        // ── Player movement ───────────────────────────────────────────────────
        const joy = joystickRef.current;
        if (Math.hypot(joy.dx, joy.dz) > 0.05) {
          const sp = (g.ultActive ? PLAYER_SPEED * 0.4 : PLAYER_SPEED) * dt;
          g.player.pos.x = Math.max(-ARENA, Math.min(ARENA, g.player.pos.x + joy.dx * sp));
          g.player.pos.z = Math.max(-ARENA, Math.min(ARENA, g.player.pos.z + joy.dz * sp));
          g.player.facing = Math.atan2(joy.dx, joy.dz);
        }

        // ── Block player from inside Giant Heart ──────────────────────────────
        const _pDist = Math.sqrt(g.player.pos.x ** 2 + g.player.pos.z ** 2);
        if (_pDist < 3.5 && _pDist > 0.001) {
          const _s = 3.5 / _pDist;
          g.player.pos.x *= _s;
          g.player.pos.z *= _s;
        }

        // ── Magnet + heart pickups ────────────────────────────────────────────
        const harvestAmt = 1 + Math.min(upg.harvestLevel, MAX_HARVEST_LEVEL);
        if (g.magnetActive) {
          g.magnetTimer -= dt;
          if (g.magnetTimer <= 0) { g.magnetActive = false; g.magnetTimer = 0; }
          else {
            for (let i = g.hearts.length - 1; i >= 0; i--) {
              const h = g.hearts[i];
              _mag.subVectors(g.player.pos, h.pos);
              const dist = _mag.length();
              if (dist < 0.6) {
                g.hearts.splice(i, 1);
                g.heartsCollected += harvestAmt;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } else {
                h.pos.addScaledVector(_mag.normalize(), Math.min(MAGNET_SUCTION * dt, dist));
              }
            }
          }
        }
        if (!g.magnetActive) {
          for (let i = g.hearts.length - 1; i >= 0; i--) {
            if (g.player.pos.distanceTo(g.hearts[i].pos) < PICKUP_R) {
              g.hearts.splice(i, 1);
              g.heartsCollected += harvestAmt;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }
        }
        for (let i = g.magnets.length - 1; i >= 0; i--) {
          if (g.player.pos.distanceTo(g.magnets[i].pos) < MAGNET_PICKUP_R) {
            g.magnets.splice(i, 1);
            g.magnetActive = true;
            g.magnetTimer  = MAGNET_DURATION;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }
        }

        // ── Auto-fire ─────────────────────────────────────────────────────────
        // Helper: find nearest gremlin within range
        const findNearest = (range: number): GremlinData | null => {
          let nearest: GremlinData | null = null, nearestDist = Infinity;
          for (const gr of g.gremlins) {
            const d = g.player.pos.distanceTo(gr.pos);
            if (d < nearestDist && d <= range) { nearestDist = d; nearest = gr; }
          }
          return nearest;
        };

        if (playerClass === "classic" && !g.ultActive) {
          const fireInt = Math.max(CLASSIC_MIN_FIRE, CLASSIC_BASE_FIRE - upg.attackLevel * 0.18);
          const nearest = findNearest(CLASSIC_FIRE_RANGE);
          if (nearest) {
            // Only count down timer while a target is in range
            g.fireT -= dt;
            if (g.fireT <= 0) {
              g.fireT = fireInt;
              _dir.subVectors(nearest.pos, g.player.pos).normalize();
              g.player.facing = Math.atan2(_dir.x, _dir.z);
              g.projs.push({ id: uid(), pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z), dir: _dir.clone() });
            }
          } else {
            // No target — keep timer ready so first shot fires immediately when one appears
            g.fireT = 0;
          }

        } else if (playerClass === "gatling") {
          const nearest = findNearest(GATLING_FIRE_RANGE);
          if (nearest) {
            // Ramp up spin: fixed reduction per shot (no diminishing returns)
            g.fireT -= dt;
            let _gShots = 0;
            while (g.fireT <= 0 && _gShots < 5) {
              _gShots++;
              g.fireT += g.gatlingFireInt;
              const rampAmt = 0.06 + upg.cooldownLevel * 0.015;
              g.gatlingFireInt = Math.max(GATLING_MIN_FIRE, g.gatlingFireInt - rampAmt * g.gatlingFireInt);
              _dir.subVectors(nearest.pos, g.player.pos).normalize();
              g.player.facing = Math.atan2(_dir.x, _dir.z);
              g.projs.push({ id: uid(), pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z), dir: _dir.clone() });
            }
          } else {
            // No target — spin down
            const drainRate = (GATLING_BASE_FIRE - GATLING_MIN_FIRE) * 0.12;
            g.gatlingFireInt = Math.min(GATLING_BASE_FIRE, g.gatlingFireInt + drainRate * dt);
          }

        } else if (playerClass === "sniper") {
          const nearest = findNearest(SNIPER_FIRE_RANGE);
          if (nearest) {
            g.fireT -= dt;
            if (g.fireT <= 0) {
              g.fireT = SNIPER_BASE_FIRE;
              _dir.subVectors(nearest.pos, g.player.pos).normalize();
              g.player.facing = Math.atan2(_dir.x, _dir.z);
              g.projs.push({ id: uid(), pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z), dir: _dir.clone() });
            }
          } else {
            g.fireT = 0;
          }

        } else if (playerClass === "shotgunner") {
          const nearest = findNearest(SHOTGUN_FIRE_RANGE);
          if (nearest) {
            g.fireT -= dt;
            if (g.fireT <= 0) {
              g.fireT = SHOTGUN_BASE_FIRE;
              const baseAngle  = Math.atan2(nearest.pos.x - g.player.pos.x, nearest.pos.z - g.player.pos.z);
              g.player.facing  = baseAngle;
              const numBullets = 3 + upg.spreadLevel;
              const halfSpread = 0.35 + upg.spreadLevel * 0.07;
              for (let b = 0; b < numBullets; b++) {
                const angle = numBullets === 1 ? baseAngle
                  : baseAngle - halfSpread + (b / (numBullets - 1)) * halfSpread * 2;
                const bDir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
                g.projs.push({ id: uid(), pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z), dir: bDir, ttl: SHOTGUN_TTL });
              }
            }
          } else {
            g.fireT = 0;
          }
        }

        // ── Move gremlins ─────────────────────────────────────────────────────
        const gSpd = gremlinSpeedForWave(g.wave) * dt;
        for (let i = g.gremlins.length - 1; i >= 0; i--) {
          const gr = g.gremlins[i];
          _dir.set(-gr.pos.x, 0, -gr.pos.z).normalize();
          gr.pos.addScaledVector(_dir, gSpd);
          if (gr.pos.length() < GIANT_ATTACK_R) {
            g.gremlins.splice(i, 1);
            g.gremlinsKilled++;
            g.giantHp = Math.max(0, g.giantHp - GREMLIN_DMG);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            if (g.giantHp <= 0) g.phase = "gameover";
          }
        }

        // ── Classic Ultimate laser ────────────────────────────────────────────
        if (playerClass === "classic" && g.ultActive) {
          g.ultTimer -= dt;
          if (g.ultTimer <= 0) {
            g.ultActive = false;
            g.ultTimer  = 0;
            g.ultLaserAngle = 0;
          } else {
            // Spin continuously — 2 full rotations over 3 s
            g.ultLaserAngle += dt * (Math.PI * 2 * (2 / CLASSIC_ULT_DURATION));
            const lDx = Math.sin(g.ultLaserAngle);
            const lDz = Math.cos(g.ultLaserAngle);
            // Laser hits in both directions (360° sweep each half-rotation)
            for (let gi = g.gremlins.length - 1; gi >= 0; gi--) {
              const gr  = g.gremlins[gi];
              const dx  = gr.pos.x - g.player.pos.x;
              const dz  = gr.pos.z - g.player.pos.z;
              const dot = dx * lDx + dz * lDz;
              // hit both forward AND backward beam (two-sided laser)
              const perpSq = dx * dx + dz * dz - dot * dot;
              if (perpSq < LASER_HIT_WIDTH * LASER_HIT_WIDTH) {
                g.gremlins[gi].hp -= CLASSIC_ULT_DPS * dt;
                if (g.gremlins[gi].hp <= 0) {
                  killGremlin(g, gi, uid);
                }
              }
            }
          }
        }

        // ── Projectiles ───────────────────────────────────────────────────────
        const projDmg =
          playerClass === "gatling"      ? GATLING_DAMAGE
          : playerClass === "sniper"     ? SNIPER_DAMAGE
          : playerClass === "shotgunner" ? SHOTGUN_DAMAGE
          : (CLASSIC_BASE_DMG + upg.damageLevel * 0.5);

        const projSpeed =
          playerClass === "gatling"      ? GATLING_PROJ_SPEED
          : playerClass === "sniper"     ? (SNIPER_PROJ_SPEED_BASE + upg.bulletSpeedLevel * 12)
          : playerClass === "shotgunner" ? SHOTGUN_PROJ_SPEED
          : CLASSIC_PROJ_SPEED;

        const pSpd = projSpeed * dt;

        for (let pi = g.projs.length - 1; pi >= 0; pi--) {
          const p = g.projs[pi];

          // Save position before moving (for swept collision)
          const prevX = p.pos.x, prevZ = p.pos.z;
          p.pos.addScaledVector(p.dir, pSpd);

          if (p.ttl !== undefined) {
            p.ttl -= dt;
            if (p.ttl <= 0) { g.projs.splice(pi, 1); continue; }
          }

          if (Math.abs(p.pos.x) > ARENA + 8 || Math.abs(p.pos.z) > ARENA + 8) {
            g.projs.splice(pi, 1); continue;
          }

          // Sniper shoots through the heart; all other classes are blocked
          if (playerClass !== "sniper" &&
              p.pos.x * p.pos.x + p.pos.z * p.pos.z < GIANT_PROJ_BLOCK_R * GIANT_PROJ_BLOCK_R) {
            g.projs.splice(pi, 1); continue;
          }

          // Hit radius = gremlin body radius + projectile radius (consistent for all classes)
          const projR =
            playerClass === "sniper"     ? (SNIPER_PROJ_RADIUS_BASE + upg.bulletSizeLevel * 0.25)
            : playerClass === "shotgunner" ? 0.22
            : playerClass === "gatling"    ? GATLING_PROJ_RADIUS
            : CLASSIC_PROJ_RADIUS;
          const hitR = GREMLIN_HIT_R + projR;

          let hit = false;
          for (let gi = g.gremlins.length - 1; gi >= 0; gi--) {
            const gr = g.gremlins[gi];
            // Swept check: min distance from bullet path segment to gremlin center
            const dist = segmentPointDist(prevX, prevZ, p.pos.x, p.pos.z, gr.pos.x, gr.pos.z);
            if (dist < hitR) {
              gr.hp -= projDmg;
              if (gr.hp <= 0) {
                killGremlin(g, gi, uid);
                if (playerClass === "classic") g.ultKills++;
              }
              hit = true; break;
            }
          }
          if (hit) { g.projs.splice(pi, 1); }
        }

        // ── Gatling spin drain on wave clear ──────────────────────────────────
        if (playerClass === "gatling" && g.phase === "waveclear" && g.gatlingFireInt < g.gatlingWaveClearTarget) {
          const drainRate = (GATLING_BASE_FIRE - GATLING_MIN_FIRE) * 0.05;
          g.gatlingFireInt = Math.min(g.gatlingWaveClearTarget, g.gatlingFireInt + drainRate * dt);
        }
      }

      // ── HUD update ───────────────────────────────────────────────────────────
      if (g.frameN % 2 === 0) onHudUpdate(buildHudState(g));

      // ══════════════════════════════════════════════════════════════════════════
      // ── RENDER ───────────────────────────────────────────────────────────────
      // ══════════════════════════════════════════════════════════════════════════

      ctx.clearRect(0, 0, W, H);

      // Letterbox / fill outside-arena area with solid black
      ctx.fillStyle = "#07000f";
      ctx.fillRect(0, 0, W, H);

      // Compute arena bounds in screen space (camera is always at 0,0)
      const arenaLeft   = Math.round(W / 2 - ARENA * scale + shakeX);
      const arenaTop    = Math.round(H / 2 - ARENA * scale + shakeZ);
      const arenaSize   = Math.round(ARENA * 2 * scale);

      // Clip all game rendering to the arena rectangle
      ctx.save();
      ctx.beginPath();
      ctx.rect(arenaLeft, arenaTop, arenaSize, arenaSize);
      ctx.clip();

      // Floor tiles
      drawFloor(ctx, camX, camZ, scale, W, H, t);

      // Giant heart glow ring (drawn on floor level)
      const ghX = toSX(0), ghY = toSY(0);
      const ringR = Math.round(GIANT_ATTACK_R * scale);
      ctx.fillStyle = `rgba(255,0,68,0.06)`;
      for (let rr = ringR; rr <= ringR + Math.round(2 * scale); rr += Math.round(scale * 0.3)) {
        ctx.strokeStyle = `rgba(255,0,68,${0.08 - (rr - ringR) / (2 * scale) * 0.08})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ghX, ghY, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pillars (draw before entities so they appear on floor)
      for (const [px, pz] of PILLARS) {
        drawPillar(ctx, toSX(px), toSY(pz), scale);
      }

      // Collectible hearts
      for (const h of gs.current.hearts) {
        const bob = Math.sin(t * 2.5 + h.bob) * 3;
        drawCollectibleHeart(ctx, toSX(h.pos.x), toSY(h.pos.z) + bob, scale);
      }

      // Magnet pickups
      for (const mn of gs.current.magnets) {
        drawMagnet(ctx, toSX(mn.pos.x), toSY(mn.pos.z), scale, t);
      }

      // Projectiles
      const projRadius =
        playerClass === "gatling"      ? GATLING_PROJ_RADIUS
        : playerClass === "sniper"     ? (SNIPER_PROJ_RADIUS_BASE + upg.bulletSizeLevel * 0.25)
        : playerClass === "shotgunner" ? 0.22
        : CLASSIC_PROJ_RADIUS;

      for (const proj of gs.current.projs) {
        drawProjectile(ctx, toSX(proj.pos.x), toSY(proj.pos.z), playerClass, projRadius, scale);
      }

      // Gremlins
      for (const gr of gs.current.gremlins) {
        // Gremlin always faces center (0,0)
        drawGremlin(ctx, toSX(gr.pos.x), toSY(gr.pos.z), gr.hp, gr.maxHp, scale, t);
      }

      // Giant heart (center)
      drawGiantHeart(ctx, ghX, ghY, gs.current.giantHp, t, scale);

      // Laser beam (classic ultimate)
      if (playerClass === "classic" && gs.current.ultActive && gs.current.ultTimer > 0) {
        drawLaser(ctx, toSX(gs.current.player.pos.x), toSY(gs.current.player.pos.z), gs.current.ultLaserAngle, scale, W, H, t);
      }

      // Player (drawn last so it's on top)
      drawPlayer(ctx, toSX(gs.current.player.pos.x), toSY(gs.current.player.pos.z), gs.current.player.facing, playerClass, scale);

      // Magnet aura around player when active
      if (gs.current.magnetActive) {
        const psx = toSX(gs.current.player.pos.x);
        const psy = toSY(gs.current.player.pos.z);
        const auraR = Math.round(PICKUP_R * scale);
        ctx.strokeStyle = `rgba(255,220,0,${0.2 + Math.sin(t * 8) * 0.1})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(psx, psy, auraR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // End arena clip
      ctx.restore();

      // Vignette effect (drawn over the full canvas, outside clip)
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,14,0.7)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // Arena border glow (drawn after clip restore so it's always sharp)
      ctx.strokeStyle = "#6600aa";
      ctx.lineWidth = 3;
      ctx.strokeRect(arenaLeft, arenaTop, arenaSize, arenaSize);

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [playerClass]);

  return (
    <View style={styles.container}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
