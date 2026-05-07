import { Canvas } from "@react-three/fiber";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { GameHUD } from "@/components/ui/GameHUD";
import { Joystick } from "@/components/ui/Joystick";
import { ClassSelectScreen } from "@/components/ui/ClassSelectScreen";
import { ShopScreen } from "@/components/ui/ShopScreen";
import { addScore, getLeaderboard, ScoreEntry } from "@/utils/leaderboard";
import { GameScene } from "./GameScene";

export type PlayerClass = "classic" | "gatling" | "sniper";

export interface HudState {
  giantHeartHp:    number;
  heartsCollected: number;
  score:           number;
  wave:            number;
  phase:           "playing" | "waveclear" | "gameover";
  gremlinsLeft:    number;
  gremlinsTotal:   number;
  magnetActive:    boolean;
  magnetTimer:     number;
}

export interface JoystickState {
  dx: number;
  dz: number;
}

export interface Upgrades {
  attackLevel:      number;
  damageLevel:      number;
  harvestLevel:     number;
  healCount:        number;
  cooldownLevel:    number;
  bulletSizeLevel:  number;
  bulletSpeedLevel: number;
}

export interface WaveClearSummary {
  heartsCollected: number;
  giantHp:         number;
  wave:            number;
  score:           number;
}

export interface NextWaveSignal {
  ready:   boolean;
  wave:    number;
  giantHp: number;
  hearts:  number;
}

const INITIAL_HUD: HudState = {
  giantHeartHp: 100, heartsCollected: 0, score: 0,
  wave: 1, phase: "playing", gremlinsLeft: 8, gremlinsTotal: 8,
  magnetActive: false, magnetTimer: 0,
};

const INITIAL_UPGRADES: Upgrades = {
  attackLevel: 0, damageLevel: 0, harvestLevel: 0, healCount: 0,
  cooldownLevel: 0, bulletSizeLevel: 0, bulletSpeedLevel: 0,
};

export default function GameWorld() {
  const joystickRef = useRef<JoystickState>({ dx: 0, dz: 0 });
  const upgradesRef = useRef<Upgrades>(INITIAL_UPGRADES);
  const nextWaveRef = useRef<NextWaveSignal>({ ready: false, wave: 1, giantHp: 100, hearts: 0 });

  const [hud, setHud]         = useState<HudState>(INITIAL_HUD);
  const [gameKey, setGameKey] = useState(0);
  const [shopOpen, setShopOpen]         = useState(false);
  const [shopSummary, setShopSummary]   = useState<WaveClearSummary | null>(null);
  const [upgrades, setUpgrades]         = useState<Upgrades>(INITIAL_UPGRADES);
  const [leaderboard, setLeaderboard]   = useState<ScoreEntry[]>(getLeaderboard);
  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);
  const gameoverSavedRef = useRef(false);

  useEffect(() => {
    if (hud.phase === "gameover" && !gameoverSavedRef.current) {
      gameoverSavedRef.current = true;
      const updated = addScore(hud.score, hud.wave);
      setLeaderboard(updated);
    }
  }, [hud.phase, hud.score, hud.wave]);

  const handleHudUpdate = useCallback((next: HudState) => {
    setHud(next);
  }, []);

  const handleWaveClear = useCallback((summary: WaveClearSummary) => {
    setShopSummary(summary);
    setShopOpen(true);
  }, []);

  const handleShopStart = useCallback((
    remainingHearts: number,
    newUpgrades: Upgrades,
    newGiantHp: number,
  ) => {
    upgradesRef.current = newUpgrades;
    setUpgrades(newUpgrades);
    nextWaveRef.current = {
      ready:   true,
      wave:    (shopSummary?.wave ?? 1) + 1,
      giantHp: newGiantHp,
      hearts:  remainingHearts,
    };
    setShopOpen(false);
  }, [shopSummary]);

  const handleRestart = useCallback(() => {
    upgradesRef.current = INITIAL_UPGRADES;
    nextWaveRef.current = { ready: false, wave: 1, giantHp: 100, hearts: 0 };
    setUpgrades(INITIAL_UPGRADES);
    setShopOpen(false);
    setShopSummary(null);
    gameoverSavedRef.current = false;
    setSelectedClass(null);
  }, []);

  const handleClassSelect = useCallback((cls: PlayerClass) => {
    setSelectedClass(cls);
    setGameKey((k) => k + 1);
    setHud(INITIAL_HUD);
  }, []);

  if (!selectedClass) {
    return (
      <View style={styles.root}>
        <ClassSelectScreen onSelect={handleClassSelect} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Canvas
        key={gameKey}
        style={StyleSheet.absoluteFillObject}
        gl={{ antialias: false }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 32, 0.001], fov: 55, near: 0.1, far: 300 }}
      >
        <GameScene
          joystickRef={joystickRef}
          upgradesRef={upgradesRef}
          nextWaveRef={nextWaveRef}
          playerClass={selectedClass}
          onHudUpdate={handleHudUpdate}
          onWaveClear={handleWaveClear}
        />
      </Canvas>

      <View style={styles.overlay}>
        {!shopOpen && (
          <>
            <Joystick joystickRef={joystickRef} />
            <GameHUD hud={hud} onRestart={handleRestart} leaderboard={leaderboard} />
          </>
        )}
        {shopOpen && shopSummary && (
          <ShopScreen
            wave={shopSummary.wave}
            nextWave={shopSummary.wave + 1}
            initialHearts={shopSummary.heartsCollected}
            initialGiantHp={shopSummary.giantHp}
            upgrades={upgrades}
            score={shopSummary.score}
            playerClass={selectedClass}
            onStart={handleShopStart}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#0d0021" },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
});
