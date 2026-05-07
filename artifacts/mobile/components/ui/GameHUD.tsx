import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { HudState } from "@/components/game/GameWorld";

interface Props {
  hud:       HudState;
  onRestart: () => void;
}

export function GameHUD({ hud, onRestart }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { giantHeartHp, heartsCollected, score, wave, phase, gremlinsLeft, gremlinsTotal } = hud;
  const hpRatio = Math.max(0, giantHeartHp) / 100;
  const waveProgress = Math.max(0, gremlinsTotal - gremlinsLeft) / Math.max(1, gremlinsTotal);

  return (
    <>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 6 }]} pointerEvents="none">
        {/* Giant heart HP */}
        <View style={styles.hpBlock}>
          <Ionicons name="heart" size={15} color="#ff3366" />
          <View style={styles.hpBg}>
            <View
              style={[
                styles.hpFill,
                {
                  width: `${hpRatio * 100}%` as any,
                  backgroundColor:
                    hpRatio > 0.5 ? "#ff3366" : hpRatio > 0.25 ? "#ff8800" : "#ff2200",
                },
              ]}
            />
          </View>
          <Text style={styles.hpNum}>{Math.ceil(giantHeartHp)}</Text>
        </View>

        <View style={styles.midBlock}>
          <Text style={styles.waveLabel}>WAVE {wave}</Text>
          {/* Wave progress bar */}
          <View style={styles.waveBg}>
            <View style={[styles.waveFill, { width: `${waveProgress * 100}%` as any }]} />
          </View>
          <Text style={styles.gremlinCount}>{gremlinsLeft} left</Text>
        </View>

        <Text style={styles.scoreText}>{score}</Text>
      </View>

      {/* Hearts currency badge */}
      <View style={styles.currencyBadge} pointerEvents="none">
        <Ionicons name="heart" size={17} color="#ff3366" />
        <Text style={styles.currencyNum}>{heartsCollected}</Text>
      </View>

      {/* Game over overlay */}
      {phase === "gameover" && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.overTitle}>THE HEART FELL</Text>
            <Text style={styles.overSub}>Wave {wave}  ·  Score</Text>
            <Text style={styles.overScore}>{score}</Text>
            <View style={styles.overHeartRow}>
              <Ionicons name="heart" size={18} color="#ff3366" />
              <Text style={styles.overHeartText}>{heartsCollected} hearts collected</Text>
            </View>
            <TouchableOpacity style={styles.restartBtn} onPress={onRestart}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.restartLabel}>TRY AGAIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  hpBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  hpBg: {
    width: 80,
    height: 9,
    backgroundColor: "#1e003a",
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#5a0080",
  },
  hpFill: {
    height: "100%",
    borderRadius: 5,
  },
  hpNum: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    minWidth: 22,
  },
  midBlock: {
    flex: 1,
    alignItems: "center",
  },
  waveLabel: {
    color: "#cc99ff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginBottom: 3,
  },
  waveBg: {
    width: "100%",
    maxWidth: 100,
    height: 5,
    backgroundColor: "#1e003a",
    borderRadius: 3,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#440080",
  },
  waveFill: {
    height: "100%",
    backgroundColor: "#9933ff",
    borderRadius: 3,
  },
  gremlinCount: {
    color: "#8855cc",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  scoreText: {
    color: "#fff",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    minWidth: 36,
    textAlign: "right",
  },
  currencyBadge: {
    position: "absolute",
    bottom: 200,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    zIndex: 10,
  },
  currencyNum: {
    color: "#ff99cc",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },
  card: {
    backgroundColor: "#1a003a",
    borderRadius: 24,
    padding: 36,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#5a0080",
    width: "82%",
  },
  overTitle: {
    color: "#ff3366",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginBottom: 14,
  },
  overSub: {
    color: "#aa77aa",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
    marginBottom: 4,
  },
  overScore: {
    color: "#fff",
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  overHeartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 28,
  },
  overHeartText: {
    color: "#ff99cc",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
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
