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
const ARENA           = 24;
const PLAYER_SPEED    = 8;
const PICKUP_R        = 2.2;
const MAGNET_PICKUP_R = 1.8;
const GREMLIN_HIT_R   = 1.3;
const GIANT_ATTACK_R  = 2.9;
const GIANT_HP_MAX    = 100;
const GREMLIN_DMG     = 20;
const HEART_INTERVAL  = 1.8;
const MAX_GREMLINS    = 18;
const MAX_HEARTS      = 14;
const MAGNET_DURATION = 3.5;
const MAGNET_SUCTION  = 18;
const MAGNET_DROP_CHANCE = 0.01;

// Classic
const CLASSIC_PROJ_SPEED  = 24;
const CLASSIC_BASE_FIRE   = 1.8;
const CLASSIC_MIN_FIRE    = 0.1;
const CLASSIC_FIRE_RANGE  = 14;
const CLASSIC_PROJ_RADIUS = 0.28;
const MAX_HARVEST_LEVEL   = 5;

// Gatling
const GATLING_BASE_FIRE   = 2.5;
const GATLING_MIN_FIRE    = 0.01;
const GATLING_PROJ_SPEED  = 40;
const GATLING_PROJ_RADIUS = 0.13;
const GATLING_FIRE_RANGE  = 14;
const GATLING_DAMAGE      = 0.1;
const GATLING_NO_TGT_RESET = 1.0;

// Sniper
const SNIPER_BASE_FIRE    = 2.5;
const SNIPER_FIRE_RANGE   = 80;
const SNIPER_PROJ_SPEED_BASE = 50;
const SNIPER_PROJ_RADIUS_BASE = 0.6;
const SNIPER_DAMAGE       = 8;

function gremlinsForWave(w: number)     { return 8 + (w - 1) * 5; }
function gremlinHpForWave(w: number)    { return 1 + Math.floor(w / 5); }
function spawnIntervalForWave(w: number){ return Math.max(0.8, 2.4 - (w - 1) * 0.2); }
function gremlinSpeedForWave(w: number) { return 1.4 + (w - 1) * 0.28; }

// ─── Types ────────────────────────────────────────────────────────────────────
interface GremlinData { id: string; pos: THREE.Vector3; hp: number; maxHp: number }
interface HeartData   { id: string; pos: THREE.Vector3; bob: number }
interface ProjData    { id: string; pos: THREE.Vector3; dir: THREE.Vector3 }
interface MagnetData  { id: string; pos: THREE.Vector3 }

interface GS {
  player:          { pos: THREE.Vector3; facing: number };
  gremlins:        GremlinData[];
  hearts:          HeartData[];
  projs:           ProjData[];
  magnets:         MagnetData[];
  giantHp:         number;
  heartsCollected: number;
  score:           number;
  wave:            number;
  phase:           "playing" | "waveclear" | "gameover";
  frameN:          number;
  uid:             number;
  heartT:          number;
  gremlinT:        number;
  fireT:           number;
  gremlinsThisWave: number;
  gremlinsSpawned:  number;
  gremlinsKilled:   number;
  waveClearCalled:  boolean;
  magnetActive:     boolean;
  magnetTimer:      number;
  // Gatling-specific
  gatlingFireInt:   number;
  gatlingNoTgtT:    number;
}

function initGS(wave = 1, giantHp = GIANT_HP_MAX, hearts = 0): GS {
  return {
    player: { pos: new THREE.Vector3(0, 0, 8), facing: 0 },
    gremlins: [], hearts: [], projs: [], magnets: [],
    giantHp, heartsCollected: hearts, score: 0, wave,
    phase: "playing",
    frameN: 0, uid: 0,
    heartT: 1.2, gremlinT: 2.0, fireT: 1.0,
    gremlinsThisWave: gremlinsForWave(wave),
    gremlinsSpawned: 0, gremlinsKilled: 0,
    waveClearCalled: false,
    magnetActive: false, magnetTimer: 0,
    gatlingFireInt: GATLING_BASE_FIRE,
    gatlingNoTgtT: 0,
  };
}

const _dir    = new THREE.Vector3();
const _mag    = new THREE.Vector3();
const _camTgt = new THREE.Vector3();

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  joystickRef:  React.MutableRefObject<JoystickState>;
  upgradesRef:  React.MutableRefObject<Upgrades>;
  nextWaveRef:  React.MutableRefObject<NextWaveSignal>;
  playerClass:  PlayerClass;
  onHudUpdate:  (h: HudState) => void;
  onWaveClear:  (s: WaveClearSummary) => void;
}

const PILLARS: [number, number][] = [
  [-24,-24],[0,-24],[24,-24],[24,0],[24,24],[0,24],[-24,24],[-24,0],
];

export function GameScene({ joystickRef, upgradesRef, nextWaveRef, playerClass, onHudUpdate, onWaveClear }: Props) {
  const { camera } = useThree();
  const gs = useRef<GS>(initGS());

  const [gremlinIds, setGremlinIds] = useState<string[]>([]);
  const [heartIds,   setHeartIds]   = useState<string[]>([]);
  const [projIds,    setProjIds]    = useState<string[]>([]);
  const [magnetIds,  setMagnetIds]  = useState<string[]>([]);

  const playerMesh = useRef<THREE.Mesh>(null);
  const giantMesh  = useRef<THREE.Mesh>(null);
  const gremlinMap = useRef<Map<string, THREE.Group>>(new Map());
  const heartMap   = useRef<Map<string, THREE.Mesh>>(new Map());
  const projMap    = useRef<Map<string, THREE.Mesh>>(new Map());
  const magnetMMap = useRef<Map<string, THREE.Mesh>>(new Map());

  const buildHudState = (g: GS): HudState => ({
    giantHeartHp:    g.giantHp,
    heartsCollected: g.heartsCollected,
    score:           g.score,
    wave:            g.wave,
    phase:           g.phase,
    gremlinsLeft:    Math.max(0, g.gremlinsThisWave - g.gremlinsKilled),
    gremlinsTotal:   g.gremlinsThisWave,
    magnetActive:    g.magnetActive,
    magnetTimer:     g.magnetTimer,
  });

  useFrame((state, rawDelta) => {
    const g = gs.current;
    const dt = Math.min(rawDelta, 0.1);
    const t  = state.clock.elapsedTime;
    g.frameN++;
    let changed = false;
    const uid = () => String(++g.uid);
    const upg = upgradesRef.current;

    // ── Gameover ──────────────────────────────────────────────────────────────
    if (g.phase === "gameover") {
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
      onHudUpdate(buildHudState(g));
      return;
    }

    // ── Next-wave signal ──────────────────────────────────────────────────────
    if (g.phase === "waveclear" && nextWaveRef.current.ready) {
      const nw = nextWaveRef.current;
      nextWaveRef.current = { ...nw, ready: false };
      g.wave             = nw.wave;
      g.giantHp          = Math.min(GIANT_HP_MAX, nw.giantHp);
      g.heartsCollected  = nw.hearts;
      g.gremlinsThisWave = gremlinsForWave(nw.wave);
      g.gremlinsSpawned  = 0;
      g.gremlinsKilled   = 0;
      g.waveClearCalled  = false;
      g.phase    = "playing";
      g.heartT   = 1.2;
      g.gremlinT = 2.0;
      g.fireT    = 1.0;
      g.gremlins = []; g.projs = []; g.magnets = [];
      g.magnetActive = false; g.magnetTimer = 0;
      g.gatlingFireInt = GATLING_BASE_FIRE;
      g.gatlingNoTgtT  = 0;
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
      onWaveClear({ heartsCollected: g.heartsCollected, giantHp: g.giantHp, wave: g.wave, score: g.score });
    }

    if (g.phase !== "playing") {
      g.hearts.forEach(h => {
        const m = heartMap.current.get(h.id);
        if (m) m.position.y = 0.5 + Math.sin(t * 2.5 + h.bob) * 0.2;
      });
      camera.up.set(0, 0, -1);
      if (playerClass === "sniper") {
        camera.lookAt(0, 0, 0);
      } else {
        camera.lookAt(g.player.pos.x, 0, g.player.pos.z);
      }
      if (g.frameN % 4 === 0) onHudUpdate(buildHudState(g));
      return;
    }

    // ── Spawn hearts ──────────────────────────────────────────────────────────
    g.heartT -= dt;
    if (g.heartT <= 0 && g.hearts.length < MAX_HEARTS) {
      g.heartT = HEART_INTERVAL;
      const angle = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 15;
      g.hearts.push({
        id: uid(),
        pos: new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r),
        bob: Math.random() * Math.PI * 2,
      });
      changed = true;
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

    // ── Magnet pickups ────────────────────────────────────────────────────────
    for (let i = g.magnets.length - 1; i >= 0; i--) {
      if (g.player.pos.distanceTo(g.magnets[i].pos) < MAGNET_PICKUP_R) {
        g.magnets.splice(i, 1);
        g.magnetActive = true;
        g.magnetTimer  = MAGNET_DURATION;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        changed = true;
      }
    }

    // ── Magnet suction ────────────────────────────────────────────────────────
    const harvestAmt = 1 + Math.min(upg.harvestLevel, MAX_HARVEST_LEVEL);
    if (g.magnetActive) {
      g.magnetTimer -= dt;
      if (g.magnetTimer <= 0) {
        g.magnetActive = false;
        g.magnetTimer  = 0;
      } else {
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

    // ── Normal heart pickups ──────────────────────────────────────────────────
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

    // ── Auto-fire (per class) ─────────────────────────────────────────────────
    if (playerClass === "classic") {
      const fireInt = Math.max(CLASSIC_MIN_FIRE, CLASSIC_BASE_FIRE - upg.attackLevel * 0.22);
      g.fireT -= dt;
      if (g.fireT <= 0) {
        g.fireT = fireInt;
        let nearest: GremlinData | null = null;
        let nearestDist = Infinity;
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
      // Find nearest target
      let nearest: GremlinData | null = null;
      let nearestDist = Infinity;
      for (const gr of g.gremlins) {
        const d = g.player.pos.distanceTo(gr.pos);
        if (d < nearestDist && d <= GATLING_FIRE_RANGE) { nearestDist = d; nearest = gr; }
      }

      if (nearest) {
        g.gatlingNoTgtT = 0;
        g.fireT -= dt;
        if (g.fireT <= 0) {
          g.fireT = g.gatlingFireInt;
          // Ramp: reduce interval each shot
          const reductionPct = 0.15 + upg.cooldownLevel * 0.05;
          g.gatlingFireInt = Math.max(GATLING_MIN_FIRE, g.gatlingFireInt * (1 - reductionPct));
          _dir.subVectors(nearest.pos, g.player.pos).normalize();
          g.player.facing = Math.atan2(_dir.x, _dir.z);
          g.projs.push({ id: uid(), pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z), dir: _dir.clone() });
          changed = true;
        }
      } else {
        // No target — count time
        g.gatlingNoTgtT += dt;
        if (g.gatlingNoTgtT >= GATLING_NO_TGT_RESET) {
          g.gatlingFireInt = GATLING_BASE_FIRE;
          g.fireT = g.gatlingFireInt;
        }
      }
    } else if (playerClass === "sniper") {
      // Fixed fire rate, cannot upgrade
      g.fireT -= dt;
      if (g.fireT <= 0) {
        g.fireT = SNIPER_BASE_FIRE;
        let nearest: GremlinData | null = null;
        let nearestDist = Infinity;
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

    // ── Projectiles + collision ───────────────────────────────────────────────
    const projDmg =
      playerClass === "gatling" ? GATLING_DAMAGE
      : playerClass === "sniper" ? SNIPER_DAMAGE
      : (1 + upg.damageLevel);

    const projSpeed =
      playerClass === "gatling" ? GATLING_PROJ_SPEED
      : playerClass === "sniper" ? (SNIPER_PROJ_SPEED_BASE + upg.bulletSpeedLevel * 12)
      : CLASSIC_PROJ_SPEED;

    const pSpd = projSpeed * dt;

    for (let pi = g.projs.length - 1; pi >= 0; pi--) {
      const p = g.projs[pi];
      p.pos.addScaledVector(p.dir, pSpd);
      if (Math.abs(p.pos.x) > ARENA + 8 || Math.abs(p.pos.z) > ARENA + 8) {
        g.projs.splice(pi, 1); changed = true; continue;
      }
      let hit = false;
      for (let gi = g.gremlins.length - 1; gi >= 0; gi--) {
        const hitR = playerClass === "sniper"
          ? (SNIPER_PROJ_RADIUS_BASE + upg.bulletSizeLevel * 0.25) + 0.3
          : GREMLIN_HIT_R;
        if (p.pos.distanceTo(g.gremlins[gi].pos) < hitR) {
          g.gremlins[gi].hp -= projDmg;
          if (g.gremlins[gi].hp <= 0) {
            const deadPos = g.gremlins[gi].pos.clone();
            g.gremlins.splice(gi, 1);
            g.gremlinsKilled++;
            g.score += 10;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (Math.random() < MAGNET_DROP_CHANCE) {
              g.magnets.push({ id: uid(), pos: deadPos });
            }
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
      if (m) {
        m.position.set(h.pos.x, 0.5 + Math.sin(t * 2.5 + h.bob) * 0.2, h.pos.z);
        m.rotation.y = t * 2 + h.bob;
      }
    }
    for (const p of g.projs) {
      const m = projMap.current.get(p.id);
      if (m) m.position.copy(p.pos);
    }
    for (const mg of g.magnets) {
      const m = magnetMMap.current.get(mg.id);
      if (m) {
        m.position.set(mg.pos.x, 0.9 + Math.sin(t * 4) * 0.15, mg.pos.z);
        m.rotation.y = t * 4;
        m.rotation.x = t * 2;
      }
    }
    if (giantMesh.current) {
      giantMesh.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.07);
      const r = g.giantHp / GIANT_HP_MAX;
      (giantMesh.current.material as THREE.MeshLambertMaterial).color.setRGB(1, r * 0.08, r * 0.18);
    }

    // ── Top-down camera ───────────────────────────────────────────────────────
    if (playerClass === "sniper") {
      // Fixed overhead view of the entire arena
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
    if (g.frameN % 2 === 0 || g.phase === "gameover") {
      onHudUpdate(buildHudState(g));
    }

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
    playerClass === "gatling" ? GATLING_PROJ_RADIUS
    : playerClass === "sniper" ? (SNIPER_PROJ_RADIUS_BASE + upg.bulletSizeLevel * 0.25)
    : CLASSIC_PROJ_RADIUS;

  const projColor =
    playerClass === "gatling" ? "#ffcc00"
    : playerClass === "sniper" ? "#00ffcc"
    : "#ffaadd";

  const projEmissive =
    playerClass === "gatling" ? "#ff8800"
    : playerClass === "sniper" ? "#00ddaa"
    : "#ff3366";

  const playerColor =
    playerClass === "gatling" ? "#ff8800"
    : playerClass === "sniper" ? "#00ddaa"
    : "#2255ff";

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1.0} />
      <pointLight position={[0, 6, 0]} color="#ff3366" intensity={6} distance={20} decay={2} />

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

      {/* Collectible hearts */}
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
