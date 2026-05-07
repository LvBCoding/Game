import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { HudState, PlayerClass, Upgrades } from "@/components/game/GameWorld";
import type { ScoreEntry } from "@/utils/leaderboard";

interface Props {
  hud:         HudState;
  onRestart:   () => void;
  leaderboard: ScoreEntry[];
  playerClass: PlayerClass;
  upgrades:    Upgrades;
}

const MAX_HARVEST_LEVEL = 5;

export function GameHUD({ hud, onRestart, leaderboard, playerClass, upgrades }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { giantHeartHp, heartsCollected, score, wave, phase,
          gremlinsLeft, gremlinsTotal, magnetActive, magnetTimer,
          gatlingCharge } = hud;
  const hpRatio      = Math.max(0, giantHeartHp) / 100;
  const waveProgress = Math.max(0, gremlinsTotal - gremlinsLeft) / Math.max(1, gremlinsTotal);

  const currentRank = leaderboard.findIndex(e => e.score === score && e.wave === wave) + 1;

  const isPlaying = phase === "playing" || phase === "waveclear";

  const classColor =
    playerClass === "gatling" ? "#ff8800"
    : playerClass === "sniper" ? "#00ddaa"
    : "#5588ff";

  // Build stat rows per class
  const statRows: { icon: string; color: string; label: string; val: string }[] = [];
  if (playerClass === "classic") {
    statRows.push({ icon: "flash",        color: "#ffaa00", label: "Atk",  val: `Lv${upgrades.attackLevel}` });
    statRows.push({ icon: "flame",        color: "#ff5500", label: "Dmg",  val: `Lv${upgrades.damageLevel}` });
    statRows.push({ icon: "heart-circle", color: "#ff3388", label: "Hvst", val: `Lv${upgrades.harvestLevel}${upgrades.harvestLevel >= MAX_HARVEST_LEVEL ? "!" : ""}` });
  } else if (playerClass === "gatling") {
    statRows.push({ icon: "speedometer",  color: "#ff8800", label: "Chrg", val: `Lv${upgrades.cooldownLevel}` });
    statRows.push({ icon: "heart-circle", color: "#ff3388", label: "Hvst", val: `Lv${upgrades.harvestLevel}${upgrades.harvestLevel >= MAX_HARVEST_LEVEL ? "!" : ""}` });
  } else {
    statRows.push({ icon: "expand",       color: "#00ddaa", label: "Size", val: `Lv${upgrades.bulletSizeLevel}` });
    statRows.push({ icon: "rocket",       color: "#00aaff", label: "Spd",  val: `Lv${upgrades.bulletSpeedLevel}` });
    statRows.push({ icon: "heart-circle", color: "#ff3388", label: "Hvst", val: `Lv${upgrades.harvestLevel}${upgrades.harvestLevel >= MAX_HARVEST_LEVEL ? "!" : ""}` });
  }

  return (
    <>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 6 }]} pointerEvents="none">
        <View style={styles.hpBlock}>
          <Ionicons name="heart" size={15} color="#ff3366" />
          <View style={styles.hpBg}>
            <View style={[
              styles.hpFill,
              { width: `${hpRatio * 100}%` as any,
                backgroundColor: hpRatio > 0.5 ? "#ff3366" : hpRatio > 0.25 ? "#ff8800" : "#ff2200" },
            ]} />
          </View>
          <Text style={styles.hpNum}>{Math.ceil(giantHeartHp)}</Text>
        </View>

        <View style={styles.midBlock}>
          <Text style={styles.waveLabel}>WAVE {wave}</Text>
          <View style={styles.waveBg}>
            <View style={[styles.waveFill, { width: `${waveProgress * 100}%` as any }]} />
          </View>
          <Text style={styles.gremlinCount}>{gremlinsLeft} left</Text>
        </View>

        <Text style={styles.scoreText}>{score}</Text>
      </View>

      {/* Gatling spin-up gauge */}
      {playerClass === "gatling" && isPlaying && (
        <View style={styles.gaugeRow} pointerEvents="none">
          <Ionicons name="reload" size={12} color="#ff8800" />
          <Text style={styles.gaugeLabel}>SPIN</Text>
          <View style={styles.gaugeBg}>
            <View style={[
              styles.gaugeFill,
              {
                width: `${gatlingCharge * 100}%` as any,
                backgroundColor:
                  gatlingCharge < 0.4 ? "#aa4400"
                  : gatlingCharge < 0.75 ? "#ff8800"
                  : "#ffdd00",
              },
            ]} />
          </View>
          <Text style={styles.gaugePct}>
            {gatlingCharge >= 0.99 ? "MAX" : `${Math.round(gatlingCharge * 100)}%`}
          </Text>
        </View>
      )}

      {/* Magnet active badge */}
      {magnetActive && (
        <View style={styles.magnetBadge} pointerEvents="none">
          <Text style={styles.magnetIcon}>🧲</Text>
          <Text style={styles.magnetTimer}>{magnetTimer.toFixed(1)}s</Text>
        </View>
      )}

      {/* Hearts currency */}
      <View style={styles.currencyBadge} pointerEvents="none">
        <Ionicons name="heart" size={17} color="#ff3366" />
        <Text style={styles.currencyNum}>{heartsCollected}</Text>
      </View>

      {/* Stats sidebar — shown during play */}
      {isPlaying && (
        <View style={[styles.statsSidebar, { top: topPad + 82 + (playerClass === "gatling" ? 28 : 0) }]} pointerEvents="none">
          <View style={[styles.sidebarTag, { borderColor: classColor + "55", backgroundColor: classColor + "11" }]}>
            <Text style={[styles.sidebarClassName, { color: classColor }]}>
              {playerClass === "classic" ? "HB" : playerClass === "gatling" ? "GG" : "SN"}
            </Text>
          </View>
          {statRows.map((row, i) => (
            <View key={i} style={styles.statRow}>
              <Ionicons name={row.icon as any} size={13} color={row.color} />
              <Text style={styles.statVal}>{row.val}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Game over */}
      {phase === "gameover" && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.overTitle}>THE HEART FELL</Text>
            <Text style={styles.overSubLine}>Wave {wave}  ·  Score {score}</Text>
            {currentRank > 0 && currentRank <= 3 && (
              <Text style={styles.rankBadge}>
                {currentRank === 1 ? "🥇 NEW HIGH SCORE" : currentRank === 2 ? "🥈 2nd Place" : "🥉 3rd Place"}
              </Text>
            )}

            <View style={styles.lbContainer}>
              <Text style={styles.lbTitle}>TOP SCORES</Text>
              <ScrollView style={styles.lbScroll} nestedScrollEnabled>
                {leaderboard.length === 0 && (
                  <Text style={styles.lbEmpty}>No scores yet</Text>
                )}
                {leaderboard.map((entry, i) => {
                  const isThis = i === currentRank - 1;
                  return (
                    <View key={i} style={[styles.lbRow, isThis && styles.lbRowHighlight]}>
                      <Text style={[styles.lbRank, isThis && styles.lbTextHL]}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </Text>
                      <Text style={[styles.lbScore, isThis && styles.lbTextHL]}>{entry.score}</Text>
                      <Text style={[styles.lbWave, isThis && styles.lbTextHL]}>W{entry.wave}</Text>
                      <Text style={styles.lbDate}>{entry.date}</Text>
                    </View>
                  );
                })}
              </ScrollView>
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
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10,
  },
  hpBlock: { flexDirection: "row", alignItems: "center", gap: 5 },
  hpBg: {
    width: 80, height: 9,
    backgroundColor: "#1e003a", borderRadius: 5, overflow: "hidden",
    borderWidth: 1, borderColor: "#5a0080",
  },
  hpFill:  { height: "100%", borderRadius: 5 },
  hpNum:   { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 22 },
  midBlock:{ flex: 1, alignItems: "center" },
  waveLabel:    { color: "#cc99ff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, marginBottom: 3 },
  waveBg:  {
    width: "100%", maxWidth: 100, height: 5,
    backgroundColor: "#1e003a", borderRadius: 3, overflow: "hidden",
    borderWidth: 1, borderColor: "#440080",
  },
  waveFill:     { height: "100%", backgroundColor: "#9933ff", borderRadius: 3 },
  gremlinCount: { color: "#8855cc", fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
  scoreText:    { color: "#fff", fontSize: 19, fontFamily: "Inter_700Bold", minWidth: 36, textAlign: "right" },

  gaugeRow: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 10,
    marginTop: 58,
  },
  gaugeLabel: { color: "#ff8800", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 2, minWidth: 26 },
  gaugeBg: {
    flex: 1, height: 8,
    backgroundColor: "#1a0800", borderRadius: 4, overflow: "hidden",
    borderWidth: 1, borderColor: "#884400",
  },
  gaugeFill: { height: "100%", borderRadius: 4 },
  gaugePct: { color: "#ffcc88", fontSize: 10, fontFamily: "Inter_700Bold", minWidth: 32, textAlign: "right" },

  magnetBadge: {
    position: "absolute", top: 90, right: 14,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#332200", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#ffaa00", zIndex: 11,
  },
  magnetIcon:  { fontSize: 18 },
  magnetTimer: { color: "#ffdd00", fontSize: 14, fontFamily: "Inter_700Bold" },

  currencyBadge: {
    position: "absolute", bottom: 200, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 6, zIndex: 10,
  },
  currencyNum: { color: "#ff99cc", fontSize: 20, fontFamily: "Inter_700Bold" },

  statsSidebar: {
    position: "absolute",
    right: 10,
    zIndex: 10,
    alignItems: "center",
    gap: 6,
  },
  sidebarTag: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
    marginBottom: 2,
  },
  sidebarClassName: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  statRow: {
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#2a0050",
    minWidth: 40,
  },
  statVal: {
    color: "#ccaaee",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center", alignItems: "center", zIndex: 30,
  },
  card: {
    backgroundColor: "#1a003a", borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 24,
    alignItems: "center", borderWidth: 1, borderColor: "#5a0080",
    width: "90%", maxHeight: "90%",
  },
  overTitle:   { color: "#ff3366", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 2, marginBottom: 6 },
  overSubLine: { color: "#aa77aa", fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 1, marginBottom: 8 },
  rankBadge:   { fontSize: 16, marginBottom: 12, fontFamily: "Inter_700Bold", color: "#ffdd00" },

  lbContainer: { width: "100%", marginBottom: 16 },
  lbTitle:     { color: "#9933ff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 3, marginBottom: 8, textAlign: "center" },
  lbScroll:    { maxHeight: 200 },
  lbEmpty:     { color: "#553366", fontSize: 13, textAlign: "center", padding: 12, fontFamily: "Inter_400Regular" },
  lbRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, marginBottom: 3,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 8,
  },
  lbRowHighlight: { backgroundColor: "rgba(255,51,102,0.15)", borderWidth: 1, borderColor: "#ff336655" },
  lbRank:  { width: 32, color: "#aa77aa", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  lbScore: { flex: 1, color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  lbWave:  { color: "#9933ff", fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 28 },
  lbDate:  { color: "#553366", fontSize: 11, fontFamily: "Inter_400Regular", minWidth: 60, textAlign: "right" },
  lbTextHL:{ color: "#ff99cc" },

  restartBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ff3366", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30,
  },
  restartLabel: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 2 },
});
