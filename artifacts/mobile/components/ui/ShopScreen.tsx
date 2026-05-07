import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PlayerClass, Upgrades } from "@/components/game/GameWorld";

const MAX_HARVEST_LEVEL = 5;

interface Props {
  wave:            number;
  nextWave:        number;
  initialHearts:   number;
  initialGiantHp:  number;
  upgrades:        Upgrades;
  score:           number;
  playerClass:     PlayerClass;
  onStart: (remainingHearts: number, upgrades: Upgrades, giantHp: number) => void;
}

function classicFireInterval(lvl: number) {
  return Math.max(0.1, 1.8 - lvl * 0.22).toFixed(2);
}

function attackCost(lvl: number)      { return 10 + lvl * 8; }
function damageCost(lvl: number)      { return 12 + lvl * 10; }
function harvestCost(lvl: number)     { return 8  + lvl * 6; }
function healCost(count: number)      { return 6  + count * 4; }
function cooldownCost(lvl: number)    { return 10 + lvl * 8; }
function bulletSizeCost(lvl: number)  { return 10 + lvl * 8; }
function bulletSpeedCost(lvl: number) { return 10 + lvl * 9; }

export function ShopScreen({
  wave, nextWave, initialHearts, initialGiantHp, upgrades, score, playerClass, onStart,
}: Props) {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const [hearts, setHearts]   = useState(initialHearts);
  const [upgs, setUpgs]       = useState<Upgrades>({ ...upgrades });
  const [giantHp, setGiantHp] = useState(initialGiantHp);
  const [healUsed, setHealUsed] = useState(false);

  type BuyType = "attack" | "damage" | "harvest" | "heal" | "cooldown" | "bulletSize" | "bulletSpeed";

  const buy = (type: BuyType) => {
    const cost =
      type === "attack"      ? attackCost(upgs.attackLevel)
      : type === "damage"      ? damageCost(upgs.damageLevel)
      : type === "harvest"     ? harvestCost(upgs.harvestLevel)
      : type === "cooldown"    ? cooldownCost(upgs.cooldownLevel)
      : type === "bulletSize"  ? bulletSizeCost(upgs.bulletSizeLevel)
      : type === "bulletSpeed" ? bulletSpeedCost(upgs.bulletSpeedLevel)
      : healCost(upgs.healCount);

    if (hearts < cost) return;
    if (type === "heal" && (healUsed || giantHp >= 100)) return;
    if (type === "harvest" && upgs.harvestLevel >= MAX_HARVEST_LEVEL) return;

    setHearts(h => h - cost);

    if (type === "heal") {
      setGiantHp(hp => Math.min(100, hp + 5));
      setHealUsed(true);
      setUpgs(prev => ({ ...prev, healCount: prev.healCount + 1 }));
    } else {
      setUpgs(prev => ({
        ...prev,
        attackLevel:      type === "attack"      ? prev.attackLevel + 1      : prev.attackLevel,
        damageLevel:      type === "damage"      ? prev.damageLevel + 1      : prev.damageLevel,
        harvestLevel:     type === "harvest"     ? prev.harvestLevel + 1     : prev.harvestLevel,
        cooldownLevel:    type === "cooldown"    ? prev.cooldownLevel + 1    : prev.cooldownLevel,
        bulletSizeLevel:  type === "bulletSize"  ? prev.bulletSizeLevel + 1  : prev.bulletSizeLevel,
        bulletSpeedLevel: type === "bulletSpeed" ? prev.bulletSpeedLevel + 1 : prev.bulletSpeedLevel,
      }));
    }
  };

  const canAfford = (cost: number) => hearts >= cost;
  const harvestMaxed = upgs.harvestLevel >= MAX_HARVEST_LEVEL;

  const classLabel =
    playerClass === "classic" ? "Heartbreaker"
    : playerClass === "gatling" ? "Gatling Gunner"
    : "Sniper";

  const classColor =
    playerClass === "classic" ? "#2255ff"
    : playerClass === "gatling" ? "#ff8800"
    : "#00ddaa";

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: botPad }]}>
      <View style={styles.header}>
        <Text style={styles.waveComplete}>WAVE {wave} COMPLETE</Text>
        <View style={styles.classTag}>
          <Text style={[styles.classLabel, { color: classColor }]}>{classLabel}</Text>
        </View>
        <Text style={styles.score}>Score: {score}</Text>
      </View>

      <View style={styles.currencyRow}>
        <Ionicons name="heart" size={22} color="#ff3366" />
        <Text style={styles.heartsNum}>{hearts}</Text>
        <Text style={styles.heartsLabel}>hearts to spend</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.cards}>

        {/* ── Classic upgrades ── */}
        {playerClass === "classic" && (
          <>
            <UpgradeCard
              icon="flash"
              color="#ffaa00"
              title="Attack Speed"
              desc={`Fire interval: ${classicFireInterval(upgs.attackLevel)}s → ${classicFireInterval(upgs.attackLevel + 1)}s`}
              level={upgs.attackLevel}
              cost={attackCost(upgs.attackLevel)}
              canAfford={canAfford(attackCost(upgs.attackLevel))}
              maxed={parseFloat(classicFireInterval(upgs.attackLevel)) <= 0.1}
              onBuy={() => buy("attack")}
            />
            <UpgradeCard
              icon="flame"
              color="#ff4400"
              title="Power"
              desc={`Damage per shot: ${1 + upgs.damageLevel} → ${2 + upgs.damageLevel} HP`}
              level={upgs.damageLevel}
              cost={damageCost(upgs.damageLevel)}
              canAfford={canAfford(damageCost(upgs.damageLevel))}
              onBuy={() => buy("damage")}
            />
          </>
        )}

        {/* ── Gatling upgrades ── */}
        {playerClass === "gatling" && (
          <UpgradeCard
            icon="speedometer"
            color="#ff8800"
            title="Charge Speed"
            desc={`Spins up ${Math.round((0.15 + upgs.cooldownLevel * 0.05) * 100)}% faster per shot → ${Math.round((0.15 + (upgs.cooldownLevel + 1) * 0.05) * 100)}% faster`}
            level={upgs.cooldownLevel}
            cost={cooldownCost(upgs.cooldownLevel)}
            canAfford={canAfford(cooldownCost(upgs.cooldownLevel))}
            onBuy={() => buy("cooldown")}
          />
        )}

        {/* ── Sniper upgrades ── */}
        {playerClass === "sniper" && (
          <>
            <UpgradeCard
              icon="expand"
              color="#00ddaa"
              title="Bullet Size"
              desc={`Radius: ${(0.6 + upgs.bulletSizeLevel * 0.25).toFixed(2)} → ${(0.6 + (upgs.bulletSizeLevel + 1) * 0.25).toFixed(2)} (wider beam)`}
              level={upgs.bulletSizeLevel}
              cost={bulletSizeCost(upgs.bulletSizeLevel)}
              canAfford={canAfford(bulletSizeCost(upgs.bulletSizeLevel))}
              onBuy={() => buy("bulletSize")}
            />
            <UpgradeCard
              icon="rocket"
              color="#00aaff"
              title="Bullet Speed"
              desc={`Speed: ${50 + upgs.bulletSpeedLevel * 12} → ${50 + (upgs.bulletSpeedLevel + 1) * 12} units/s`}
              level={upgs.bulletSpeedLevel}
              cost={bulletSpeedCost(upgs.bulletSpeedLevel)}
              canAfford={canAfford(bulletSpeedCost(upgs.bulletSpeedLevel))}
              onBuy={() => buy("bulletSpeed")}
            />
          </>
        )}

        {/* ── Harvest (all classes, capped) ── */}
        <UpgradeCard
          icon="heart-circle"
          color="#ff3388"
          title="Harvest"
          desc={`Hearts per pickup: ${1 + upgs.harvestLevel} → ${2 + upgs.harvestLevel}${harvestMaxed ? " (MAX)" : ""}`}
          level={upgs.harvestLevel}
          cost={harvestCost(upgs.harvestLevel)}
          canAfford={canAfford(harvestCost(upgs.harvestLevel)) && !harvestMaxed}
          maxed={harvestMaxed}
          onBuy={() => buy("harvest")}
        />

        {/* ── Heal (all classes) ── */}
        <UpgradeCard
          icon="add-circle"
          color="#44ff88"
          title="Heal Giant Heart"
          desc={`Giant Heart: ${giantHp} → ${Math.min(100, giantHp + 5)} HP`}
          level={-1}
          cost={healCost(upgs.healCount)}
          canAfford={canAfford(healCost(upgs.healCount)) && !healUsed && giantHp < 100}
          disabled={healUsed || giantHp >= 100}
          disabledReason={healUsed ? "Used this wave" : giantHp >= 100 ? "Already full" : undefined}
          onBuy={() => buy("heal")}
        />
      </ScrollView>

      <View style={styles.hpPreview}>
        <Ionicons name="heart" size={16} color="#ff3366" />
        <Text style={styles.hpLabel}>Giant Heart: </Text>
        <View style={styles.hpBarBg}>
          <View style={[styles.hpBarFill, { width: `${giantHp}%` as any }]} />
        </View>
        <Text style={styles.hpNum}>{giantHp}/100</Text>
      </View>

      <TouchableOpacity
        style={styles.startBtn}
        onPress={() => onStart(hearts, upgs, giantHp)}
        activeOpacity={0.8}
      >
        <Ionicons name="play-circle" size={26} color="#fff" />
        <Text style={styles.startLabel}>BEGIN WAVE {nextWave}</Text>
      </TouchableOpacity>
    </View>
  );
}

interface CardProps {
  icon: string;
  color: string;
  title: string;
  desc: string;
  level: number;
  cost: number;
  canAfford: boolean;
  disabled?: boolean;
  disabledReason?: string;
  maxed?: boolean;
  onBuy: () => void;
}

function UpgradeCard({ icon, color, title, desc, level, cost, canAfford, disabled, disabledReason, maxed, onBuy }: CardProps) {
  const isDisabled = disabled || !canAfford || maxed;
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconBox, { backgroundColor: color + "22", borderColor: color + "55" }]}>
          <Ionicons name={icon as any} size={28} color={color} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
          {level >= 0 && (
            <View style={styles.levels}>
              {Array.from({ length: Math.max(level, 1) + 3 }).map((_, i) => (
                <View key={i} style={[styles.levelDot, i < level && styles.levelDotFilled]} />
              ))}
            </View>
          )}
          {disabledReason && <Text style={styles.disabledReason}>{disabledReason}</Text>}
          {maxed && <Text style={styles.maxedLabel}>MAXED OUT</Text>}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.buyBtn, isDisabled && styles.buyBtnDisabled]}
        onPress={onBuy}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        {maxed ? (
          <Text style={styles.maxedBtnText}>MAX</Text>
        ) : (
          <>
            <Ionicons name="heart" size={12} color={isDisabled ? "#553344" : "#ff3366"} />
            <Text style={[styles.buyBtnText, isDisabled && styles.buyBtnTextDisabled]}>{cost}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#09001a",
    paddingHorizontal: 16,
  },
  header: {
    alignItems: "center",
    paddingVertical: 14,
  },
  waveComplete: {
    color: "#ff3366",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
  },
  classTag: {
    marginTop: 4,
    marginBottom: 2,
  },
  classLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  score: {
    color: "#aa77aa",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
    letterSpacing: 1,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1a0035",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#3a0060",
    marginBottom: 14,
  },
  heartsNum: {
    color: "#ff99cc",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  heartsLabel: {
    color: "#aa77aa",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  scroll: {
    flex: 1,
  },
  cards: {
    gap: 10,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: "#130028",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2a0050",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  cardDesc: {
    color: "#aa77aa",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  levels: {
    flexDirection: "row",
    gap: 4,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2a0050",
    borderWidth: 1,
    borderColor: "#5a0090",
  },
  levelDotFilled: {
    backgroundColor: "#ff3366",
    borderColor: "#ff99cc",
  },
  disabledReason: {
    color: "#664444",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  maxedLabel: {
    color: "#ff3366",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
    letterSpacing: 1,
  },
  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2a0050",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#5a0090",
    minWidth: 52,
    justifyContent: "center",
    marginLeft: 10,
  },
  buyBtnDisabled: {
    backgroundColor: "#150025",
    borderColor: "#2a0040",
  },
  buyBtnText: {
    color: "#ff99cc",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  buyBtnTextDisabled: {
    color: "#553344",
  },
  maxedBtnText: {
    color: "#553344",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  hpPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  hpLabel: {
    color: "#aa77aa",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  hpBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#1e003a",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#5a0080",
  },
  hpBarFill: {
    height: "100%",
    backgroundColor: "#ff3366",
    borderRadius: 4,
  },
  hpNum: {
    color: "#ff99cc",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    minWidth: 48,
    textAlign: "right",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#ff3366",
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: "#ff3366",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  startLabel: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
});
