import { useFrame, useThree } from "@react-three/fiber";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import * as THREE from "three";

import type {
  HudState,
  JoystickState,
  NextWaveSignal,
  PlayerClass,
  Upgrades,
  WaveClearSummary,
} from "./GameWorld";

// ─── Constants ───────────────────────────────────────────────────────────────
const ARENA              = 24;
const PLAYER_SPEED       = 11;
const PICKUP_R           = 2.2;
const MAGNET_PICKUP_R    = 1.8;
const GREMLIN_HIT_R      = 1.3;
const GIANT_ATTACK_R     = 2.9;
const GIANT_PROJ_BLOCK_R = 2.8;   // projectiles die inside this radius
const GIANT_HP_MAX       = 100;
const GREMLIN_DMG        = 20;
const MAX_GREMLINS       = 30;
const MAX_HEARTS         = 30;
const MAGNET_DURATION    = 3.5;
const MAGNET_SUCTION     = 18;
const MAGNET_DROP_CHANCE = 0.04;

// Combo
const COMBO_WINDOW = 1.5;

// Classic / Heartbreaker
const CLASSIC_PROJ_SPEED  = 28;
const CLASSIC_BASE_FIRE   = 1.5;  // slightly faster than original 1.8
const CLASSIC_MIN_FIRE    = 0.1;
const CLASSIC_FIRE_RANGE  = 14;
const CLASSIC_PROJ_RADIUS = 0.28;
const CLASSIC_BASE_DMG    = 0.5;  // 2 hits to kill wave-1 gremlins
const MAX_HARVEST_LEVEL   = 5;

// Classic Ultimate
const CLASSIC_ULT_DURATION = 5.0;
const CLASSIC_ULT_DPS      = 12;
const LASER_HIT_WIDTH      = 1.5;
function ultThreshold(wave: number) { return 8 + Math.floor((wave - 1) / 3) * 4; }

// Gatling (UNCHANGED)
const GATLING_BASE_FIRE    = 1.5;
const GATLING_MIN_FIRE     = 0.01;
const GATLING_PROJ_SPEED   = 40;
const GATLING_PROJ_RADIUS  = 0.13;
const GATLING_FIRE_RANGE   = 16;
const GATLING_DAMAGE       = 0.2;
const GATLING_NO_TGT_RESET = 1.0;
const GATLING_EFF_DECAY    = 0.07;
const GATLING_EFF_MIN      = 0.15;

// Sniper (slower)
const SNIPER_BASE_FIRE        = 2.5;
const SNIPER_FIRE_RANGE       = 80;
const SNIPER_PROJ_SPEED_BASE  = 50;
const SNIPER_PROJ_RADIUS_BASE = 0.6;
const SNIPER_DAMAGE           = 8;

// Shotgunner (slower)
const SHOTGUN_BASE_FIRE  = 2.0;
const SHOTGUN_PROJ_SPEED = 16;
const SHOTGUN_FIRE_RANGE = 8;
const SHOTGUN_DAMAGE     = 3.0;
const SHOTGUN_TTL        = 0.58;

// More gremlins — wave 1: 15, wave 2: 22, wave 3: 29 …
function gremlinsForWave(w: number)     { return 15 + (w - 1) * 7; }
function gremlinHpForWave(w: number)    { return 1 + Math.floor(w / 5); }
function spawnIntervalForWave(w: number){ return Math.max(0.35, 1.6 - (w - 1) * 0.12); }
function gremlinSpeedForWave(w: number) { return 1.4 + (w - 1) * 0.28; }

// ─── Types ────────────────────────────────────────────────────────────────────
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
  // Gatling-specific
  gatlingFireInt:         number;
  gatlingNoTgtT:          number;
  gatlingRampEff:         number;
  gatlingWaveClearTarget: number;
  // Ultimate (Heartbreaker)
  ultKills:  number;
  ultActive: boolean;
  ultTimer:  number;
  // Combo
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
    gatlingRampEff: 1.0,
    gatlingWaveClearTarget: GATLING_BASE_FIRE,
    ultKills: 0,
    ultActive: false,
    ultTimer: 0,
    comboCount: 0,
    comboTimer: 100,
  };
}

const _dir    = new THREE.Vector3();
const _mag    = new THREE.Vector3();
const _camTgt = new THREE.Vector3();
const _ZERO   = new THREE.Vector3(0, 0, 0);

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

export function GameScene({
  joystickRef, upgradesRef, nextWaveRef, ultActivateRef,
  playerClass, onHudUpdate, onWaveClear,
}: Props) {
  const { camera } = useThree();
  const gs = useRef<GS>(initGS());

  const [gremlinIds, setGremlinIds] = useState<string[]>([]);
  const [heartIds,   setHeartIds]   = useState<string[]>([]);
  const [projIds,    setProjIds]    = useState<string[]>([]);
  const [magnetIds,  setMagnetIds]  = useState<string[]>([]);
  const [ultVisual,  setUltVisual]  = useState(false);
  const ultVisualRef = useRef(false);

  const playerMesh = useRef<THREE.Mesh>(null);
  const giantMesh  = useRef<THREE.Mesh>(null);
  const laserRef   = useRef<THREE.Mesh>(null);
  const gremlinMap = useRef<Map<string, THREE.Group>>(new Map());
  const heartMap   = useRef<Map<string, THREE.Mesh>>(new Map());
  const projMap    = useRef<Map<string, THREE.Mesh>>(new Map());
  const magnetMMap = useRef<Map<string, THREE.Mesh>>(new Map());

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

  // Helper: kill a gremlin at index, drop heart + optional magnet, update combo
  const killGremlin = (g: GS, gi: number, uid: () => string) => {
    const deadPos = g.gremlins[gi].pos.clone();
    g.gremlins.splice(gi, 1);
    g.gremlinsKilled++;
    if (g.comboTimer < COMBO_WINDOW) { g.comboCount++; } else { g.comboCount = 1; }
    g.comboTimer = 0;
    g.score += Math.round(10 * comboMult(g.comboCount));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Heart drop
    if (g.hearts.length < MAX_HEARTS) {
      g.hearts.push({ id: uid(), pos: deadPos.clone(), bob: Math.random() * Math.PI * 2 });
    }
    // Magnet drop
    if (Math.random() < MAGNET_DROP_CHANCE) {
      g.magnets.push({ id: uid(), pos: deadPos.clone() });
    }
  };

  useFrame((state, rawDelta) => {
    const g  = gs.current;
    const dt = Math.min(rawDelta, 0.1);
    const t  = state.clock.elapsedTime;
    g.frameN++;
    let changed = false;
    const uid = () => String(++g.uid);
    const upg = upgradesRef.current;

    // ── Combo timer ───────────────────────────────────────────────────────────
    g.comboTimer += dt;

    // ── Gameover ──────────────────────────────────────────────────────────────
    if (g.phase === "gameover") {
      if (playerClass === "sniper") {
        _camTgt.set(0, 75, 0.001);
        camera.position.lerp(_camTgt, Math.min(dt * 3, 1));
      } else {
        _camTgt.set(g.player.pos.x, 32, g.player.pos.z);
        camera.position.lerp(_camTgt, Math.min(dt * 5, 1));
      }
      camera.up.set(0, 0, -1);
      camera.lookAt(playerClass === "sniper" ? 0 : g.player.pos.x, 0, playerClass === "sniper" ? 0 : g.player.pos.z);
      onHudUpdate(buildHudState(g));
      return;
    }

    // ── Classic Ultimate activation ───────────────────────────────────────────
    if (playerClass === "classic" && ultActivateRef.current) {
      ultActivateRef.current = false;
      if (!g.ultActive && g.ultKills >= ultThreshold(g.wave)) {
        g.ultActive = true;
        g.ultTimer  = CLASSIC_ULT_DURATION;
        g.ultKills  = 0;
        if (!ultVisualRef.current) { ultVisualRef.current = true; setUltVisual(true); }
        changed = true;
      }
    }

    // ── Next-wave signal ──────────────────────────────────────────────────────
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
      g.gatlingRampEff = 1.0;
      g.ultActive = false; g.ultTimer = 0;
      g.comboCount = 0; g.comboTimer = 100;
      if (laserRef.current) laserRef.current.visible = false;
      if (ultVisualRef.current) { ultVisualRef.current = false; setUltVisual(false); }
      setGremlinIds([]); setProjIds([]); setMagnetIds([]);
      changed = true;
    }

    // ── Wave clear check ──────────────────────────────────────────────────────
    if (g.phase === "playing" &&
        g.gremlinsKilled >= g.gremlinsThisWave &&
        g.gremlins.length === 0 &&
        !g.waveClearCalled) {
      g.waveClearCalled = true;
      g.phase = "waveclear";
      g.gatlingWaveClearTarget = GATLING_BASE_FIRE * 0.7 + g.gatlingFireInt * 0.3;
      onWaveClear({ heartsCollected: g.heartsCollected, giantHp: g.giantHp, wave: g.wave, score: g.score });
    }

    if (g.phase !== "playing") {
      g.hearts.forEach(h => {
        const m = heartMap.current.get(h.id);
        if (m) m.position.y = 0.5 + Math.sin(t * 2.5 + h.bob) * 0.2;
      });
      if (playerClass === "gatling" && g.gatlingFireInt < g.gatlingWaveClearTarget) {
        const drainRate = (GATLING_BASE_FIRE - GATLING_MIN_FIRE) * 0.05;
        g.gatlingFireInt = Math.min(g.gatlingWaveClearTarget, g.gatlingFireInt + drainRate * dt);
      }
      camera.up.set(0, 0, -1);
      if (playerClass === "sniper") { camera.lookAt(0, 0, 0); }
      else { camera.lookAt(g.player.pos.x, 0, g.player.pos.z); }
      if (g.frameN % 2 === 0) onHudUpdate(buildHudState(g));
      return;
    }

    // ── Spawn gremlins ────────────────────────────────────────────────────────
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
      changed = true;
    }

    // ── Player movement ───────────────────────────────────────────────────────
    const joy = joystickRef.current;
    if (Math.hypot(joy.dx, joy.dz) > 0.05) {
      const sp = PLAYER_SPEED * dt;
      g.player.pos.x = Math.max(-ARENA, Math.min(ARENA, g.player.pos.x + joy.dx * sp));
      g.player.pos.z = Math.max(-ARENA, Math.min(ARENA, g.player.pos.z + joy.dz * sp));
      g.player.facing = Math.atan2(joy.dx, joy.dz);
    }

    // ── Block player from inside the Giant Heart ──────────────────────────────
    const _pDist = Math.sqrt(g.player.pos.x * g.player.pos.x + g.player.pos.z * g.player.pos.z);
    if (_pDist < 3.5 && _pDist > 0.001) {
      const _s = 3.5 / _pDist;
      g.player.pos.x *= _s;
      g.player.pos.z *= _s;
    }

    // ── Magnet + heart pickups ────────────────────────────────────────────────
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
            changed = true;
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
          changed = true;
        }
      }
    }
    for (let i = g.magnets.length - 1; i >= 0; i--) {
      if (g.player.pos.distanceTo(g.magnets[i].pos) < MAGNET_PICKUP_R) {
        g.magnets.splice(i, 1);
        g.magnetActive = true;
        g.magnetTimer  = MAGNET_DURATION;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        changed = true;
      }
    }

    // ── Auto-fire (per class) ─────────────────────────────────────────────────
    if (playerClass === "classic" && !g.ultActive) {
      const fireInt = Math.max(CLASSIC_MIN_FIRE, CLASSIC_BASE_FIRE - upg.attackLevel * 0.18);
      g.fireT -= dt;
      if (g.fireT <= 0) {
        g.fireT = fireInt;
        let nearest: GremlinData | null = null, nearestDist = Infinity;
        for (const gr of g.gremlins) {
          const d = g.player.pos.distanceTo(gr.pos);
          if (d < nearestDist && d <= CLASSIC_FIRE_RANGE) { nearestDist = d; nearest = gr; }
        }
        if (nearest) {
          _dir.subVectors(nearest.pos, g.player.pos).normalize();
          g.player.facing = Math.atan2(_dir.x, _dir.z);
          g.projs.push({ id: uid(), pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z), dir: _dir.clone() });
          changed = true;
        }
      }

    } else if (playerClass === "gatling") {
      let nearest: GremlinData | null = null, nearestDist = Infinity;
      for (const gr of g.gremlins) {
        const d = g.player.pos.distanceTo(gr.pos);
        if (d < nearestDist && d <= GATLING_FIRE_RANGE) { nearestDist = d; nearest = gr; }
      }
      if (nearest) {
        g.gatlingNoTgtT = 0;
        g.fireT -= dt;
        let _gShots = 0;
        while (g.fireT <= 0 && _gShots < 5) {
          _gShots++;
          g.fireT += g.gatlingFireInt;
          const baseReduction = 0.25 + upg.cooldownLevel * 0.06;
          const reductionPct  = baseReduction * g.gatlingRampEff;
          g.gatlingFireInt = Math.max(GATLING_MIN_FIRE, g.gatlingFireInt * (1 - reductionPct));
          g.gatlingRampEff = Math.max(GATLING_EFF_MIN, g.gatlingRampEff - GATLING_EFF_DECAY);
          _dir.subVectors(nearest.pos, g.player.pos).normalize();
          g.player.facing = Math.atan2(_dir.x, _dir.z);
          g.projs.push({ id: uid(), pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z), dir: _dir.clone() });
          changed = true;
        }
      } else {
        g.gatlingNoTgtT += dt;
        if (g.gatlingNoTgtT >= GATLING_NO_TGT_RESET) {
          g.gatlingFireInt = GATLING_BASE_FIRE;
          g.gatlingRampEff = 1.0;
          g.fireT          = g.gatlingFireInt;
        }
      }

    } else if (playerClass === "sniper") {
      g.fireT -= dt;
      if (g.fireT <= 0) {
        g.fireT = SNIPER_BASE_FIRE;
        let nearest: GremlinData | null = null, nearestDist = Infinity;
        for (const gr of g.gremlins) {
          const d = g.player.pos.distanceTo(gr.pos);
          if (d < nearestDist && d <= SNIPER_FIRE_RANGE) { nearestDist = d; nearest = gr; }
        }
        if (nearest) {
          _dir.subVectors(nearest.pos, g.player.pos).normalize();
          g.player.facing = Math.atan2(_dir.x, _dir.z);
          g.projs.push({ id: uid(), pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z), dir: _dir.clone() });
          changed = true;
        }
      }

    } else if (playerClass === "shotgunner") {
      g.fireT -= dt;
      if (g.fireT <= 0) {
        g.fireT = SHOTGUN_BASE_FIRE;
        let nearest: GremlinData | null = null, nearestDist = Infinity;
        for (const gr of g.gremlins) {
          const d = g.player.pos.distanceTo(gr.pos);
          if (d < nearestDist && d <= SHOTGUN_FIRE_RANGE) { nearestDist = d; nearest = gr; }
        }
        if (nearest) {
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
          changed = true;
        }
      }
    }

    // ── Move gremlins ─────────────────────────────────────────────────────────
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
        changed = true;
      }
    }

    // ── Classic Ultimate directional laser ────────────────────────────────────
    if (playerClass === "classic" && g.ultActive) {
      g.ultTimer -= dt;
      const lDx = Math.sin(g.player.facing);
      const lDz = Math.cos(g.player.facing);

      if (laserRef.current) {
        if (g.ultTimer > 0) {
          laserRef.current.visible = true;
          laserRef.current.position.set(
            g.player.pos.x + lDx * ARENA,
            0.8,
            g.player.pos.z + lDz * ARENA,
          );
          laserRef.current.rotation.y = g.player.facing;
        } else {
          laserRef.current.visible = false;
        }
      }

      if (g.ultTimer <= 0) {
        g.ultActive = false;
        g.ultTimer  = 0;
        if (ultVisualRef.current) { ultVisualRef.current = false; setUltVisual(false); }
      } else {
        for (let gi = g.gremlins.length - 1; gi >= 0; gi--) {
          const gr    = g.gremlins[gi];
          const dx    = gr.pos.x - g.player.pos.x;
          const dz    = gr.pos.z - g.player.pos.z;
          const dot   = dx * lDx + dz * lDz;
          if (dot < 0) continue;
          const perpSq = dx * dx + dz * dz - dot * dot;
          if (perpSq < LASER_HIT_WIDTH * LASER_HIT_WIDTH) {
            g.gremlins[gi].hp -= CLASSIC_ULT_DPS * dt;
            if (g.gremlins[gi].hp <= 0) {
              killGremlin(g, gi, uid);
              changed = true;
            }
          }
        }
      }
      changed = true;
    } else if (laserRef.current && !g.ultActive) {
      laserRef.current.visible = false;
    }

    // ── Projectiles + collision ───────────────────────────────────────────────
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
      p.pos.addScaledVector(p.dir, pSpd);

      // TTL (shotgunner range limit)
      if (p.ttl !== undefined) {
        p.ttl -= dt;
        if (p.ttl <= 0) { g.projs.splice(pi, 1); changed = true; continue; }
      }

      // Out of bounds
      if (Math.abs(p.pos.x) > ARENA + 8 || Math.abs(p.pos.z) > ARENA + 8) {
        g.projs.splice(pi, 1); changed = true; continue;
      }

      // Blocked by giant heart
      if (p.pos.x * p.pos.x + p.pos.z * p.pos.z < GIANT_PROJ_BLOCK_R * GIANT_PROJ_BLOCK_R) {
        g.projs.splice(pi, 1); changed = true; continue;
      }

      // Gremlin hit detection
      let hit = false;
      for (let gi = g.gremlins.length - 1; gi >= 0; gi--) {
        const hitR = playerClass === "sniper"
          ? (SNIPER_PROJ_RADIUS_BASE + upg.bulletSizeLevel * 0.25) + 0.3
          : GREMLIN_HIT_R;
        if (p.pos.distanceTo(g.gremlins[gi].pos) < hitR) {
          g.gremlins[gi].hp -= projDmg;
          if (g.gremlins[gi].hp <= 0) {
            killGremlin(g, gi, uid);
            if (playerClass === "classic") g.ultKills++;
          }
          hit = true; break;
        }
      }
      if (hit) { g.projs.splice(pi, 1); changed = true; }
    }

    // ── Mesh transforms ───────────────────────────────────────────────────────
    if (playerMesh.current) {
      playerMesh.current.position.set(g.player.pos.x, 0.75, g.player.pos.z);
      playerMesh.current.rotation.y = g.player.facing;
    }
    for (const gr of g.gremlins) {
      const m = gremlinMap.current.get(gr.id);
      if (m) { m.position.set(gr.pos.x, 0, gr.pos.z); m.lookAt(0, 0, 0); }
    }
    for (const h of g.hearts) {
      const m = heartMap.current.get(h.id);
      if (m) m.position.set(h.pos.x, 0.5 + Math.sin(t * 2.5 + h.bob) * 0.2, h.pos.z);
    }
    for (const mn of g.magnets) {
      const m = magnetMMap.current.get(mn.id);
      if (m) { m.position.set(mn.pos.x, 0.55, mn.pos.z); m.rotation.y = t * 2; }
    }
    for (const proj of g.projs) {
      const m = projMap.current.get(proj.id);
      if (m) m.position.set(proj.pos.x, 0.8, proj.pos.z);
    }

    // ── Camera ────────────────────────────────────────────────────────────────
    if (playerClass === "sniper") {
      _camTgt.set(0, 75, 0.001);
      camera.position.lerp(_camTgt, Math.min(dt * 3, 1));
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
    } else {
      _camTgt.set(g.player.pos.x, 32, g.player.pos.z);
      camera.position.lerp(_camTgt, Math.min(dt * 5, 1));
      camera.up.set(0, 0, -1);
      camera.lookAt(g.player.pos.x, 0, g.player.pos.z);
    }

    // ── HUD ───────────────────────────────────────────────────────────────────
    if (g.frameN % 2 === 0 || g.phase === "gameover") onHudUpdate(buildHudState(g));

    if (changed) {
      setGremlinIds(g.gremlins.map(x => x.id));
      setHeartIds(g.hearts.map(x => x.id));
      setProjIds(g.projs.map(x => x.id));
      setMagnetIds(g.magnets.map(x => x.id));
    }
  });

  // ── Derive projectile visuals per class ────────────────────────────────────
  const upg = upgradesRef.current;
  const projRadius =
    playerClass === "gatling"      ? GATLING_PROJ_RADIUS
    : playerClass === "sniper"     ? (SNIPER_PROJ_RADIUS_BASE + upg.bulletSizeLevel * 0.25)
    : playerClass === "shotgunner" ? 0.22
    : CLASSIC_PROJ_RADIUS;

  const projColor =
    playerClass === "gatling"      ? "#ffcc00"
    : playerClass === "sniper"     ? "#00ffcc"
    : playerClass === "shotgunner" ? "#ff88ff"
    : "#ffaadd";

  const projEmissive =
    playerClass === "gatling"      ? "#ff8800"
    : playerClass === "sniper"     ? "#00ddaa"
    : playerClass === "shotgunner" ? "#cc00ff"
    : "#ff3366";

  const playerColor =
    playerClass === "gatling"      ? "#ff8800"
    : playerClass === "sniper"     ? "#00ddaa"
    : playerClass === "shotgunner" ? "#cc44ff"
    : "#2255ff";

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1.0} />
      <pointLight position={[0, 6, 0]} color="#ff3366" intensity={6} distance={20} decay={2} />
      {ultVisual && (
        <pointLight position={[0, 12, 0]} color="#ff0066" intensity={60} distance={80} decay={1.2} />
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ARENA * 2, ARENA * 2]} />
        <meshLambertMaterial color="#0e001f" />
      </mesh>
      <gridHelper args={[ARENA * 2, 32, "#220044", "#180030"]} />

      {PILLARS.map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.6, pz]}>
          <cylinderGeometry args={[0.25, 0.35, 1.2, 6]} />
          <meshLambertMaterial color="#4a0080" />
        </mesh>
      ))}

      {/* Giant Heart */}
      <mesh ref={giantMesh} position={[0, 1.5, 0]}>
        <sphereGeometry args={[2.5, 24, 24]} />
        <meshLambertMaterial color="#ff0044" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.8, 5, 32]} />
        <meshBasicMaterial color="#ff0044" transparent opacity={0.1} />
      </mesh>

      {/* Laser beam (directional, only visible during ult) */}
      <mesh ref={laserRef} visible={false}>
        <boxGeometry args={[0.18, 0.18, ARENA * 2]} />
        <meshBasicMaterial color="#ff0066" transparent opacity={0.9} />
      </mesh>

      {/* Player */}
      <mesh ref={playerMesh} position={[0, 0.75, 8]}>
        <boxGeometry args={[0.9, 1.5, 0.7]} />
        <meshLambertMaterial color={playerColor} />
      </mesh>

      {/* Gremlins */}
      {gremlinIds.map(id => (
        <group key={id} ref={(el: THREE.Group | null) => {
          if (el) gremlinMap.current.set(id, el); else gremlinMap.current.delete(id);
        }}>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[0.75, 1.4, 0.75]} />
            <meshLambertMaterial color="#33ee33" />
          </mesh>
          <mesh position={[-0.17, 1.15, 0.38]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshLambertMaterial color="#ff2200" emissive="#ff0000" emissiveIntensity={1.2} />
          </mesh>
          <mesh position={[0.17, 1.15, 0.38]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshLambertMaterial color="#ff2200" emissive="#ff0000" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}

      {/* Collectible hearts (dropped by gremlins) */}
      {heartIds.map(id => (
        <mesh key={id} ref={(el: THREE.Mesh | null) => {
          if (el) heartMap.current.set(id, el); else heartMap.current.delete(id);
        }}>
          <sphereGeometry args={[0.45, 12, 12]} />
          <meshLambertMaterial color="#ff3388" emissive="#ff1155" emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* Magnet drops */}
      {magnetIds.map(id => (
        <mesh key={id} ref={(el: THREE.Mesh | null) => {
          if (el) magnetMMap.current.set(id, el); else magnetMMap.current.delete(id);
        }}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshLambertMaterial color="#ffdd00" emissive="#ffaa00" emissiveIntensity={2.0} />
        </mesh>
      ))}

      {/* Projectiles */}
      {projIds.map(id => (
        <mesh key={id} ref={(el: THREE.Mesh | null) => {
          if (el) projMap.current.set(id, el); else projMap.current.delete(id);
        }}>
          <sphereGeometry args={[projRadius, 10, 10]} />
          <meshLambertMaterial color={projColor} emissive={projEmissive} emissiveIntensity={2.5} />
        </mesh>
      ))}
    </>
  );
}
