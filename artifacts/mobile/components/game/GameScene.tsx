import { useFrame, useThree } from "@react-three/fiber";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import * as THREE from "three";

import type { HudState, JoystickState } from "./GameWorld";

// ─── Game constants ──────────────────────────────────────────────────────────
const ARENA        = 24;         // half-size (48×48 arena)
const PLAYER_SPEED = 8;          // units/sec
const GREMLIN_SPEED      = 1.6;  // units/sec wave 1
const GREMLIN_SPEED_INC  = 0.35; // per wave
const PROJ_SPEED         = 26;   // units/sec
const PICKUP_R           = 2.2;  // heart collection radius
const GREMLIN_HIT_R      = 1.4;  // projectile hit radius
const GIANT_ATTACK_R     = 2.9;  // gremlin reaches giant heart
const GIANT_HP_MAX       = 100;
const GREMLIN_DMG        = 20;
const HEART_INTERVAL     = 1.6;  // sec between heart spawns
const GREMLIN_INTERVAL_BASE = 1.8; // sec between gremlin spawns (fast!)
const AUTO_FIRE_INTERVAL = 1.1;  // sec between auto-shots
const MAX_GREMLINS       = 22;
const MAX_HEARTS         = 16;

// ─── Entity types ────────────────────────────────────────────────────────────
interface GremlinData { id: string; pos: THREE.Vector3; hp: number }
interface HeartData   { id: string; pos: THREE.Vector3; bob: number }
interface ProjData    { id: string; pos: THREE.Vector3; dir: THREE.Vector3 }

interface GS {
  player:    { pos: THREE.Vector3; facing: number };
  gremlins:  GremlinData[];
  hearts:    HeartData[];
  projs:     ProjData[];
  giantHp:   number;
  hearts_collected: number;  // currency
  score:     number;
  wave:      number;
  phase:     "playing" | "gameover";
  frameN:    number;
  uid:       number;
  heartT:    number;
  gremlinT:  number;
  fireT:     number;   // countdown to next auto-shot
}

function initGS(): GS {
  return {
    player: { pos: new THREE.Vector3(0, 0, 8), facing: 0 },
    gremlins: [], hearts: [], projs: [],
    giantHp: GIANT_HP_MAX,
    hearts_collected: 0,
    score: 0, wave: 1,
    phase: "playing",
    frameN: 0, uid: 0,
    heartT: 1.2, gremlinT: 1.5, fireT: 0.5,
  };
}

const _dir    = new THREE.Vector3();
const _camTgt = new THREE.Vector3();

interface Props {
  joystickRef: React.MutableRefObject<JoystickState>;
  onHudUpdate: (h: HudState) => void;
}

const PILLARS: [number, number][] = [
  [-24, -24], [-12, -24], [0, -24], [12, -24], [24, -24],
  [24, -12],  [24, 0],    [24, 12], [24, 24],
  [12, 24],   [0, 24],    [-12, 24], [-24, 24],
  [-24, 12],  [-24, 0],   [-24, -12],
];

export function GameScene({ joystickRef, onHudUpdate }: Props) {
  const { camera } = useThree();
  const gs = useRef<GS>(initGS());

  const [gremlinIds, setGremlinIds] = useState<string[]>([]);
  const [heartIds,   setHeartIds]   = useState<string[]>([]);
  const [projIds,    setProjIds]    = useState<string[]>([]);

  const playerMesh = useRef<THREE.Mesh>(null);
  const giantMesh  = useRef<THREE.Mesh>(null);
  const gremlinMap = useRef<Map<string, THREE.Group>>(new Map());
  const heartMap   = useRef<Map<string, THREE.Mesh>>(new Map());
  const projMap    = useRef<Map<string, THREE.Mesh>>(new Map());

  useFrame((state, rawDelta) => {
    const g = gs.current;
    if (g.phase !== "playing") return;

    const dt = Math.min(rawDelta, 0.1);
    const t  = state.clock.elapsedTime;
    g.frameN++;
    let changed = false;
    const uid = () => String(++g.uid);

    // ── Spawn hearts ──────────────────────────────────────────────────────────
    g.heartT -= dt;
    if (g.heartT <= 0 && g.hearts.length < MAX_HEARTS) {
      g.heartT = HEART_INTERVAL;
      const angle = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 16;
      g.hearts.push({
        id: uid(),
        pos: new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r),
        bob: Math.random() * Math.PI * 2,
      });
      changed = true;
    }

    // ── Spawn gremlins ────────────────────────────────────────────────────────
    g.gremlinT -= dt;
    if (g.gremlinT <= 0 && g.gremlins.length < MAX_GREMLINS) {
      g.gremlinT = Math.max(0.7, GREMLIN_INTERVAL_BASE - g.wave * 0.15);
      const side = Math.floor(Math.random() * 4);
      const e = ARENA + 1;
      const rnd = () => -ARENA + Math.random() * ARENA * 2;
      const sp =
        side === 0 ? new THREE.Vector3(rnd(), 0, -e)
        : side === 1 ? new THREE.Vector3(e, 0, rnd())
        : side === 2 ? new THREE.Vector3(rnd(), 0, e)
        : new THREE.Vector3(-e, 0, rnd());
      g.gremlins.push({ id: uid(), pos: sp, hp: 1 });
      changed = true;
    }

    // ── Player movement ───────────────────────────────────────────────────────
    const joy    = joystickRef.current;
    const moving = Math.hypot(joy.dx, joy.dz) > 0.05;
    if (moving) {
      const sp = PLAYER_SPEED * dt;
      g.player.pos.x = Math.max(-ARENA, Math.min(ARENA, g.player.pos.x + joy.dx * sp));
      g.player.pos.z = Math.max(-ARENA, Math.min(ARENA, g.player.pos.z + joy.dz * sp));
      g.player.facing = Math.atan2(joy.dx, joy.dz);
    }

    // ── Heart pickups (currency) ──────────────────────────────────────────────
    for (let i = g.hearts.length - 1; i >= 0; i--) {
      if (g.player.pos.distanceTo(g.hearts[i].pos) < PICKUP_R) {
        g.hearts.splice(i, 1);
        g.hearts_collected += 1;
        g.score += 5;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        changed = true;
      }
    }

    // ── Auto-fire at nearest gremlin ──────────────────────────────────────────
    g.fireT -= dt;
    if (g.fireT <= 0) {
      g.fireT = AUTO_FIRE_INTERVAL;
      // Find nearest gremlin
      let nearest: GremlinData | null = null;
      let nearestDist = Infinity;
      for (const gr of g.gremlins) {
        const d = g.player.pos.distanceTo(gr.pos);
        if (d < nearestDist) { nearestDist = d; nearest = gr; }
      }
      if (nearest) {
        _dir.subVectors(nearest.pos, g.player.pos).normalize();
        g.player.facing = Math.atan2(_dir.x, _dir.z);
        g.projs.push({
          id: uid(),
          pos: new THREE.Vector3(g.player.pos.x, 0.8, g.player.pos.z),
          dir: _dir.clone(),
        });
        changed = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }

    // ── Move gremlins → giant heart ───────────────────────────────────────────
    const gSpd = (GREMLIN_SPEED + (g.wave - 1) * GREMLIN_SPEED_INC) * dt;
    for (let i = g.gremlins.length - 1; i >= 0; i--) {
      const gr = g.gremlins[i];
      _dir.set(-gr.pos.x, 0, -gr.pos.z).normalize();
      gr.pos.addScaledVector(_dir, gSpd);
      if (gr.pos.length() < GIANT_ATTACK_R) {
        g.gremlins.splice(i, 1);
        g.giantHp = Math.max(0, g.giantHp - GREMLIN_DMG);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (g.giantHp <= 0) g.phase = "gameover";
        changed = true;
      }
    }

    // ── Move projectiles + collision ──────────────────────────────────────────
    const pSpd = PROJ_SPEED * dt;
    for (let pi = g.projs.length - 1; pi >= 0; pi--) {
      const p = g.projs[pi];
      p.pos.addScaledVector(p.dir, pSpd);
      if (Math.abs(p.pos.x) > ARENA + 3 || Math.abs(p.pos.z) > ARENA + 3) {
        g.projs.splice(pi, 1); changed = true; continue;
      }
      let hit = false;
      for (let gi = g.gremlins.length - 1; gi >= 0; gi--) {
        if (p.pos.distanceTo(g.gremlins[gi].pos) < GREMLIN_HIT_R) {
          g.gremlins[gi].hp--;
          if (g.gremlins[gi].hp <= 0) {
            g.gremlins.splice(gi, 1);
            g.score += 10;
            if (g.score % 100 === 0) g.wave++;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          hit = true; break;
        }
      }
      if (hit) { g.projs.splice(pi, 1); changed = true; }
    }

    // ── Update mesh transforms ────────────────────────────────────────────────
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

    // Giant heart pulse + HP tint
    if (giantMesh.current) {
      giantMesh.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.07);
      const r = g.giantHp / GIANT_HP_MAX;
      (giantMesh.current.material as THREE.MeshLambertMaterial).color.setRGB(1, r * 0.08, r * 0.18);
    }

    // ── Top-down camera follow ────────────────────────────────────────────────
    _camTgt.set(g.player.pos.x, 32, g.player.pos.z);
    camera.position.lerp(_camTgt, Math.min(dt * 5, 1));
    // Keep camera up vector pointing toward -Z so top of screen = north
    camera.up.set(0, 0, -1);
    camera.lookAt(g.player.pos.x, 0, g.player.pos.z);

    // ── HUD update ────────────────────────────────────────────────────────────
    if (g.frameN % 2 === 0) {
      onHudUpdate({
        giantHeartHp:      g.giantHp,
        heartsCollected:   g.hearts_collected,
        score:             g.score,
        wave:              g.wave,
        phase:             g.phase,
      });
    }

    if (changed) {
      setGremlinIds(g.gremlins.map(x => x.id));
      setHeartIds(g.hearts.map(x => x.id));
      setProjIds(g.projs.map(x => x.id));
    }
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={1.0} />
      <pointLight position={[0, 6, 0]} color="#ff3366" intensity={6} distance={20} decay={2} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ARENA * 2, ARENA * 2]} />
        <meshLambertMaterial color="#0e001f" />
      </mesh>
      <gridHelper args={[ARENA * 2, 32, "#220044", "#180030"]} />

      {/* Boundary markers */}
      {PILLARS.map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.6, pz]}>
          <cylinderGeometry args={[0.25, 0.35, 1.2, 6]} />
          <meshLambertMaterial color="#4a0080" />
        </mesh>
      ))}

      {/* Giant Heart — ASSET SLOT: replace with assets/models/giant-heart.glb */}
      <mesh ref={giantMesh} position={[0, 1.5, 0]}>
        <sphereGeometry args={[2.5, 24, 24]} />
        <meshLambertMaterial color="#ff0044" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.8, 5, 32]} />
        <meshBasicMaterial color="#ff0044" transparent opacity={0.1} />
      </mesh>

      {/* Player — ASSET SLOT: replace with assets/models/player.glb */}
      <mesh ref={playerMesh} position={[0, 0.75, 8]}>
        <boxGeometry args={[0.9, 1.5, 0.7]} />
        <meshLambertMaterial color="#2255ff" />
      </mesh>

      {/* Gremlins — ASSET SLOT: replace group with assets/models/gremlin.glb */}
      {gremlinIds.map(id => (
        <group
          key={id}
          ref={(el: THREE.Group | null) => {
            if (el) gremlinMap.current.set(id, el);
            else gremlinMap.current.delete(id);
          }}
        >
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

      {/* Collectible hearts (currency) — ASSET SLOT: replace with assets/models/heart-pickup.glb */}
      {heartIds.map(id => (
        <mesh
          key={id}
          ref={(el: THREE.Mesh | null) => {
            if (el) heartMap.current.set(id, el);
            else heartMap.current.delete(id);
          }}
        >
          <sphereGeometry args={[0.45, 12, 12]} />
          <meshLambertMaterial color="#ff3388" emissive="#ff1155" emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* Auto-fire projectiles */}
      {projIds.map(id => (
        <mesh
          key={id}
          ref={(el: THREE.Mesh | null) => {
            if (el) projMap.current.set(id, el);
            else projMap.current.delete(id);
          }}
        >
          <sphereGeometry args={[0.28, 10, 10]} />
          <meshLambertMaterial color="#ffaadd" emissive="#ff3366" emissiveIntensity={2.5} />
        </mesh>
      ))}
    </>
  );
}
