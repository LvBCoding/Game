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
  onFire: () => void;
  onRestart: () => void;
}

export function GameHUD({ hud, onFire, onRestart }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const { loveBar, giantHeartHp, score, wave, phase, canFire } = hud;
  const hpRatio = Math.max(0, giantHeartHp) / 100;

  return (
    <>
      {/* Top HUD */}
      <View
        style={[styles.topHud, { paddingTop: topPad + 8 }]}
        pointerEvents="none"
      >
        <View style={styles.heartHpBlock}>
          <Ionicons name="heart" size={18} color="#ff3366" />
          <View style={styles.hpBarBg}>
            <View
              style={[
                styles.hpBarFill,
                {
                  width: `${hpRatio * 100}%` as any,
                  backgroundColor:
                    hpRatio > 0.5
                      ? "#ff3366"
                      : hpRatio > 0.25
                        ? "#ff8800"
                        : "#ff0000",
                },
              ]}
            />
          </View>
          <Text style={styles.hpText}>{Math.ceil(giantHeartHp)}</Text>
        </View>

        <View style={styles.rightInfo}>
          <Text style={styles.waveText}>W{wave}</Text>
          <Text style={styles.scoreText}>{score}</Text>
        </View>
      </View>

      {/* Bottom panel */}
      <View style={[styles.bottomPanel, { paddingBottom: botPad + 8 }]}>
        <View style={styles.loveBarRow}>
          <Ionicons
            name="heart"
            size={16}
            color={canFire ? "#ff3366" : "#441133"}
          />
          <View style={styles.loveBarBg}>
            <View
              style={[styles.loveBarFill, { width: `${loveBar}%` as any }]}
            />
          </View>
          <Text style={styles.lovePct}>{Math.round(loveBar)}%</Text>
        </View>

        {/* Fire button — bottom right */}
        <TouchableOpacity
          style={[styles.fireBtn, canFire && styles.fireBtnReady]}
          onPress={onFire}
          disabled={!canFire}
          activeOpacity={0.7}
        >
          <Ionicons
            name="flame"
            size={28}
            color={canFire ? "#fff" : "#441133"}
          />
          <Text
            style={[styles.fireBtnLabel, canFire && styles.fireBtnLabelReady]}
          >
            {canFire ? "FIRE!" : "CHARGE"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={[styles.legend, { top: topPad + 60 }]} pointerEvents="none">
        <Text style={styles.legendText}>Walk over hearts to collect</Text>
      </View>

      {/* Game Over overlay */}
      {phase === "gameover" && (
        <View style={styles.overlay}>
          <View style={styles.overCard}>
            <Text style={styles.overTitle}>THE HEART FELL</Text>
            <Text style={styles.overSub}>Final Score</Text>
            <Text style={styles.overScore}>{score}</Text>
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
  topHud: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 10,
  },
  heartHpBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  hpBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: "#1e003a",
    borderRadius: 5,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#5a0080",
    maxWidth: 160,
  },
  hpBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  hpText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 28,
  },
  rightInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  },
  legend: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5,
  },
  legendText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(10,0,30,0.85)",
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#3a0060",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loveBarRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loveBarBg: {
    flex: 1,
    height: 14,
    backgroundColor: "#1e003a",
    borderRadius: 7,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#5a0080",
  },
  loveBarFill: {
    height: "100%",
    backgroundColor: "#ff3366",
    borderRadius: 7,
  },
  lovePct: {
    color: "#cc77aa",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    minWidth: 36,
    textAlign: "right",
  },
  fireBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#1e003a",
    borderWidth: 2,
    borderColor: "#3a0060",
  },
  fireBtnReady: {
    backgroundColor: "#ff3366",
    borderColor: "#ff99cc",
    shadowColor: "#ff3366",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  fireBtnLabel: {
    color: "#441133",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  fireBtnLabelReady: {
    color: "#fff",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },
  overCard: {
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
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginBottom: 16,
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
