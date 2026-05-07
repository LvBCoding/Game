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
  hud: HudState;
  onRestart: () => void;
}

export function GameHUD({ hud, onRestart }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { giantHeartHp, heartsCollected, score, wave, phase } = hud;
  const hpRatio = Math.max(0, giantHeartHp) / 100;

  return (
    <>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]} pointerEvents="none">
        {/* Giant heart HP */}
        <View style={styles.hpBlock}>
          <Ionicons name="heart" size={16} color="#ff3366" />
          <View style={styles.hpBg}>
            <View
              style={[
                styles.hpFill,
                {
                  width: `${hpRatio * 100}%` as any,
                  backgroundColor:
                    hpRatio > 0.5 ? "#ff3366" : hpRatio > 0.25 ? "#ff8800" : "#ff0000",
                },
              ]}
            />
          </View>
        </View>

        {/* Wave */}
        <Text style={styles.waveText}>W{wave}</Text>

        {/* Score */}
        <Text style={styles.scoreText}>{score}</Text>
      </View>

      {/* Hearts currency — bottom center above joystick */}
      <View style={styles.currencyBadge} pointerEvents="none">
        <Ionicons name="heart" size={18} color="#ff3366" />
        <Text style={styles.currencyText}>{heartsCollected}</Text>
      </View>

      {/* Game over */}
      {phase === "gameover" && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.overTitle}>THE HEART FELL</Text>
            <Text style={styles.overSub}>Score</Text>
            <Text style={styles.overScore}>{score}</Text>
            <Text style={styles.overHearts}>
              <Ionicons name="heart" size={18} color="#ff3366" /> {heartsCollected} hearts collected
            </Text>
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
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10,
  },
  hpBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hpBg: {
    flex: 1,
    height: 10,
    backgroundColor: "#1e003a",
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#5a0080",
    maxWidth: 180,
  },
  hpFill: {
    height: "100%",
    borderRadius: 5,
  },
  waveText: {
    color: "#aa77cc",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  scoreText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    minWidth: 40,
    textAlign: "right",
  },
  currencyBadge: {
    position: "absolute",
    bottom: 180,
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    zIndex: 10,
  },
  currencyText: {
    color: "#ff99cc",
    fontSize: 22,
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
    width: "80%",
  },
  overTitle: {
    color: "#ff3366",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: "center",
  },
  overSub: {
    color: "#aa77aa",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    letterSpacing: 2,
    marginBottom: 4,
  },
  overScore: {
    color: "#fff",
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  overHearts: {
    color: "#ff99cc",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
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
