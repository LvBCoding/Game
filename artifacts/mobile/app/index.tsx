import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

const { width: SW, height: SH } = Dimensions.get("window");

const HEART_SIZE = 48;
const GREMLIN_SIZE = 52;
const PROJ_W = 14;
const PROJ_H = 28;
const LOVE_PER_HEART = 20;
const GREMLIN_SPEED_BASE = 0.9;
const PROJ_SPEED = 14;
const HEART_SPAWN_MS = 1400;
const GREMLIN_SPAWN_MS = 2800;
const TICK_MS = 30;

interface HeartEntity {
  id: string;
  x: number;
  y: number;
  dy: number;
}

interface GremlinEntity {
  id: string;
  x: number;
  y: number;
  dy: number;
  hp: number;
  shake: number;
}

interface Projectile {
  id: string;
  x: number;
  y: number;
}

interface GameState {
  hearts: HeartEntity[];
  gremlins: GremlinEntity[];
  projectiles: Projectile[];
  loveBar: number;
  score: number;
  lives: number;
  phase: "playing" | "gameover";
  wave: number;
}

function makeId(ref: React.MutableRefObject<number>) {
  return String(++ref.current);
}

const PALETTE = colors.light;

export default function GameScreen() {
  const insets = useSafeAreaInsets();

  const topPad =
    insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad =
    insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const idRef = useRef(0);
  const stateRef = useRef<GameState>({
    hearts: [],
    gremlins: [],
    projectiles: [],
    loveBar: 0,
    score: 0,
    lives: 3,
    phase: "playing",
    wave: 1,
  });

  const [display, setDisplay] = useState<GameState>(stateRef.current);

  const sync = useCallback(() => {
    setDisplay({ ...stateRef.current });
  }, []);

  const bottomLine = SH - botPad - 120;

  const spawnHeart = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "playing") return;
    s.hearts.push({
      id: makeId(idRef),
      x: 16 + Math.random() * (SW - HEART_SIZE - 32),
      y: -HEART_SIZE,
      dy: 0.5 + Math.random() * 0.5,
    });
  }, []);

  const spawnGremlin = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "playing") return;
    const speed = GREMLIN_SPEED_BASE + (s.wave - 1) * 0.25;
    s.gremlins.push({
      id: makeId(idRef),
      x: 16 + Math.random() * (SW - GREMLIN_SIZE - 32),
      y: -GREMLIN_SIZE,
      dy: speed,
      hp: 1,
      shake: 0,
    });
  }, []);

  const tapHeart = useCallback(
    (heartId: string) => {
      const s = stateRef.current;
      if (s.phase !== "playing") return;
      const idx = s.hearts.findIndex((h) => h.id === heartId);
      if (idx === -1) return;
      s.hearts.splice(idx, 1);
      s.loveBar = Math.min(100, s.loveBar + LOVE_PER_HEART);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sync();
    },
    [sync]
  );

  const fire = useCallback(() => {
    const s = stateRef.current;
    if (s.loveBar < 100 || s.phase !== "playing") return;
    s.loveBar = 0;
    s.projectiles.push({
      id: makeId(idRef),
      x: SW / 2 - PROJ_W / 2,
      y: bottomLine - 40,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    sync();
  }, [bottomLine, sync]);

  const restart = useCallback(() => {
    stateRef.current = {
      hearts: [],
      gremlins: [],
      projectiles: [],
      loveBar: 0,
      score: 0,
      lives: 3,
      phase: "playing",
      wave: 1,
    };
    sync();
  }, [sync]);

  useEffect(() => {
    const tick = setInterval(() => {
      const s = stateRef.current;
      if (s.phase !== "playing") return;

      s.hearts = s.hearts.filter((h) => {
        h.y += h.dy;
        return h.y < SH + HEART_SIZE;
      });

      for (let i = s.gremlins.length - 1; i >= 0; i--) {
        const g = s.gremlins[i];
        g.y += g.dy;
        if (g.shake > 0) g.shake--;
        if (g.y > bottomLine) {
          s.gremlins.splice(i, 1);
          s.lives -= 1;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          if (s.lives <= 0) {
            s.lives = 0;
            s.phase = "gameover";
          }
        }
      }

      for (let pi = s.projectiles.length - 1; pi >= 0; pi--) {
        const p = s.projectiles[pi];
        p.y -= PROJ_SPEED;

        if (p.y < -PROJ_H) {
          s.projectiles.splice(pi, 1);
          continue;
        }

        let hit = false;
        for (let gi = s.gremlins.length - 1; gi >= 0; gi--) {
          const g = s.gremlins[gi];
          const dx = p.x + PROJ_W / 2 - (g.x + GREMLIN_SIZE / 2);
          const dy = p.y + PROJ_H / 2 - (g.y + GREMLIN_SIZE / 2);
          const dist = Math.hypot(dx, dy);
          if (dist < (PROJ_W / 2 + GREMLIN_SIZE / 2) * 0.75) {
            g.hp -= 1;
            g.shake = 6;
            hit = true;
            if (g.hp <= 0) {
              s.gremlins.splice(gi, 1);
              s.score += 10;
              if (s.score % 50 === 0) s.wave += 1;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            break;
          }
        }

        if (hit) {
          s.projectiles.splice(pi, 1);
        }
      }

      setDisplay({ ...s });
    }, TICK_MS);

    const heartTimer = setInterval(spawnHeart, HEART_SPAWN_MS);
    const gremlinTimer = setInterval(spawnGremlin, GREMLIN_SPAWN_MS);

    return () => {
      clearInterval(tick);
      clearInterval(heartTimer);
      clearInterval(gremlinTimer);
    };
  }, [spawnHeart, spawnGremlin, bottomLine]);

  const { hearts, gremlins, projectiles, loveBar, score, lives, phase, wave } =
    display;

  const canFire = loveBar >= 100;

  return (
    <View style={styles.root}>
      <View style={styles.starsLayer} pointerEvents="none">
        {STARS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.star,
              { left: s.x, top: s.y, width: s.r, height: s.r, opacity: s.op },
            ]}
          />
        ))}
      </View>

      <View style={[styles.hud, { paddingTop: topPad + 8 }]}>
        <View style={styles.livesRow}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < lives ? "heart" : "heart-outline"}
              size={22}
              color={i < lives ? PALETTE.primary : "#44224a"}
              style={{ marginRight: 4 }}
            />
          ))}
        </View>
        <View style={styles.hudCenter}>
          <Text style={styles.waveText}>WAVE {wave}</Text>
        </View>
        <Text style={styles.scoreText}>{score}</Text>
      </View>

      {hearts.map((h) => (
        <TouchableOpacity
          key={h.id}
          activeOpacity={0.6}
          onPress={() => tapHeart(h.id)}
          style={[styles.heartBtn, { left: h.x, top: h.y }]}
        >
          <Ionicons name="heart" size={HEART_SIZE} color="#ff3366" />
        </TouchableOpacity>
      ))}

      {gremlins.map((g) => (
        <View
          key={g.id}
          style={[
            styles.gremlin,
            {
              left: g.x + (g.shake > 0 ? (g.shake % 2 === 0 ? 4 : -4) : 0),
              top: g.y,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="alien"
            size={GREMLIN_SIZE}
            color="#4dff44"
          />
        </View>
      ))}

      {projectiles.map((p) => (
        <View key={p.id} style={[styles.projectile, { left: p.x, top: p.y }]}>
          <Ionicons name="heart" size={PROJ_W + 8} color="#ff3366" />
        </View>
      ))}

      <View style={[styles.loveSection, { paddingBottom: botPad + 12 }]}>
        <View style={styles.barRow}>
          <MaterialCommunityIcons
            name="heart-flash"
            size={22}
            color={canFire ? "#ff3366" : "#441133"}
          />
          <View style={styles.barBg}>
            <View
              style={[styles.barFill, { width: `${loveBar}%` as any }]}
            />
          </View>
          <Text style={styles.barPct}>{Math.round(loveBar)}%</Text>
        </View>

        <TouchableOpacity
          style={[styles.fireBtn, canFire && styles.fireBtnReady]}
          onPress={fire}
          disabled={!canFire}
          activeOpacity={0.75}
        >
          <Ionicons
            name="flame"
            size={30}
            color={canFire ? "#fff" : "#441133"}
          />
          <Text style={[styles.fireBtnLabel, canFire && styles.fireBtnLabelReady]}>
            {canFire ? "FIRE!" : "FILL BAR"}
          </Text>
        </TouchableOpacity>
      </View>

      {phase === "gameover" && (
        <View style={styles.overlay}>
          <View style={styles.gameOverCard}>
            <MaterialCommunityIcons
              name="alien"
              size={56}
              color="#4dff44"
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.gameOverTitle}>THE GREMLINS WON</Text>
            <Text style={styles.gameOverSub}>Final Score</Text>
            <Text style={styles.gameOverScore}>{score}</Text>
            <TouchableOpacity style={styles.restartBtn} onPress={restart}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.restartLabel}>TRY AGAIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const STARS = Array.from({ length: 60 }).map(() => ({
  x: Math.random() * SW,
  y: Math.random() * SH,
  r: 1 + Math.random() * 2.5,
  op: 0.2 + Math.random() * 0.7,
}));

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0d0021",
  },
  starsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: "#fff",
  },
  hud: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  livesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hudCenter: {
    flex: 1,
    alignItems: "center",
  },
  waveText: {
    color: "#aa77cc",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
  },
  scoreText: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    minWidth: 50,
    textAlign: "right",
  },
  heartBtn: {
    position: "absolute",
    zIndex: 5,
  },
  gremlin: {
    position: "absolute",
    zIndex: 5,
    width: GREMLIN_SIZE,
    height: GREMLIN_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  projectile: {
    position: "absolute",
    zIndex: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ff3366",
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  loveSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,0,30,0.92)",
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#3a0060",
    zIndex: 10,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  barBg: {
    flex: 1,
    height: 14,
    backgroundColor: "#1e003a",
    borderRadius: 7,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#5a0080",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#ff3366",
    borderRadius: 7,
  },
  barPct: {
    color: "#cc77aa",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    minWidth: 36,
    textAlign: "right",
  },
  fireBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#1e003a",
    borderWidth: 2,
    borderColor: "#3a0060",
    gap: 8,
  },
  fireBtnReady: {
    backgroundColor: "#ff3366",
    borderColor: "#ff99cc",
    shadowColor: "#ff3366",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  fireBtnLabel: {
    color: "#441133",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  fireBtnLabelReady: {
    color: "#fff",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  gameOverCard: {
    backgroundColor: "#1a003a",
    borderRadius: 24,
    padding: 36,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#5a0080",
    width: SW * 0.8,
  },
  gameOverTitle: {
    color: "#4dff44",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 20,
  },
  gameOverSub: {
    color: "#aa77aa",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 2,
    marginBottom: 4,
  },
  gameOverScore: {
    color: "#fff",
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    marginBottom: 28,
  },
  restartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ff3366",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  restartLabel: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
});
