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

import type { PlayerClass } from "@/components/game/GameWorld";

interface ClassInfo {
  id: PlayerClass;
  name: string;
  tagline: string;
  color: string;
  icon: string;
  traits: string[];
}

const CLASSES: ClassInfo[] = [
  {
    id: "classic",
    name: "Heartbreaker",
    tagline: "Balanced fighter with upgradeable power",
    color: "#2255ff",
    icon: "heart",
    traits: [
      "Moderate damage & fire rate",
      "Upgrades: Attack Speed, Power, Harvest",
      "Attack speed caps at 0.1s fire rate",
      "Kill gremlins to charge a LASER ULTIMATE",
      "Max attack speed unlocks Bullet Size",
    ],
  },
  {
    id: "gatling",
    name: "Gatling Gunner",
    tagline: "Slow to start, but an unstoppable storm",
    color: "#ff8800",
    icon: "reload",
    traits: [
      "Tiny bullets, 5 hits to kill",
      "Fire rate ramps up while targeting",
      "Loses speed if no target for 1 second",
      "30% spin retained between waves",
      "Max charge speed unlocks Damage boost",
    ],
  },
  {
    id: "sniper",
    name: "Sniper",
    tagline: "One shot, one kill from across the map",
    color: "#00ddaa",
    icon: "eye",
    traits: [
      "Massive damage, sees entire arena",
      "Slow fire rate (upgradeable via overflow)",
      "Giant fast laser beam bullets",
      "Upgrades: Bullet Size, Bullet Speed",
      "Max both unlocks Attack Speed",
    ],
  },
  {
    id: "shotgunner",
    name: "Shotgunner",
    tagline: "Get close, unload, devastate everything",
    color: "#cc44ff",
    icon: "git-branch",
    traits: [
      "Very high damage per bullet, short range",
      "Fires a spread of bullets each shot",
      "Upgrade: Spread (more bullets, wider cone)",
      "Max spread unlocks Power upgrade",
    ],
  },
];

interface Props {
  onSelect: (cls: PlayerClass) => void;
}

export function ClassSelectScreen({ onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: botPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>CHOOSE YOUR CLASS</Text>
        <Text style={styles.subtitle}>Your choice lasts the entire run</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.cards}>
        {CLASSES.map((cls) => (
          <TouchableOpacity
            key={cls.id}
            style={[styles.card, { borderColor: cls.color + "66" }]}
            onPress={() => onSelect(cls.id)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: cls.color + "22", borderColor: cls.color + "55" }]}>
              <Ionicons name={cls.icon as any} size={36} color={cls.color} />
            </View>
            <View style={styles.info}>
              <Text style={[styles.className, { color: cls.color }]}>{cls.name}</Text>
              <Text style={styles.tagline}>{cls.tagline}</Text>
              {cls.traits.map((t, i) => (
                <View key={i} style={styles.traitRow}>
                  <Text style={[styles.bullet, { color: cls.color }]}>•</Text>
                  <Text style={styles.trait}>{t}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.selectChip, { backgroundColor: cls.color + "22", borderColor: cls.color }]}>
              <Text style={[styles.selectText, { color: cls.color }]}>SELECT</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    paddingVertical: 20,
  },
  title: {
    color: "#ff3366",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 3,
  },
  subtitle: {
    color: "#aa77aa",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
    letterSpacing: 1,
  },
  scroll: { flex: 1 },
  cards:  { gap: 14, paddingBottom: 16 },
  card: {
    backgroundColor: "#130028",
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  info:     { flex: 1 },
  className: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  tagline: {
    color: "#aa77aa",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  traitRow: { flexDirection: "row", gap: 6, marginBottom: 3 },
  bullet:   { fontSize: 12, fontFamily: "Inter_700Bold", lineHeight: 18 },
  trait: {
    color: "#ccaacc",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  selectChip: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "center",
    marginLeft: 4,
  },
  selectText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
});
