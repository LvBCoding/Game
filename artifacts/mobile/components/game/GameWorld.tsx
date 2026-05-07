import { Canvas } from "@react-three/fiber";
import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { GameHUD } from "@/components/ui/GameHUD";
import { Joystick } from "@/components/ui/Joystick";
import { ShopScreen } from "@/components/ui/ShopScreen";
import { GameScene } from "./GameScene";

export interface HudState {
  giantHeartHp:    number;
  heartsCollected: number;
  score:           number;
  wave:            number;
  phase:           "playing" | "waveclear" | "gameover";
  gremlinsLeft:    number;
  gremlinsTotal:   number;
}

export interface JoystickState {
  dx: number;
  dz: number;
}

export interface Upgrades {
  attackLevel:  number;   // each +1 = -0.22s fire interval (base 1.8s, min 0.5s)
  damageLevel:  number;   // each +1 = +1 HP damage (base 1)
  harvestLevel: number;   // each +1 = +1 heart per pickup (base 1)
}

export interface WaveClearSummary {
  heartsCollected: number;
  giantHp:         number;
  wave:            number;
  score:           number;
}

export interface NextWaveSignal {
  ready:    boolean;
  wave:     number;
  giantHp:  number;
  hearts:   number;
}

const INITIAL_HUD: HudState = {
  giantHeartHp: 100, heartsCollected: 0, score: 0,
  wave: 1, phase: "playing", gremlinsLeft: 8, gremlinsTotal: 8,
};

const INITIAL_UPGRADES: Upgrades = { attackLevel: 0, damageLevel: 0, harvestLevel: 0 };

export default function GameWorld() {
  const joystickRef   = useRef<JoystickState>({ dx: 0, dz: 0 });
  const upgradesRef   = useRef<Upgrades>(INITIAL_UPGRADES);
  const nextWaveRef   = useRef<NextWaveSignal>({ ready: false, wave: 1, giantHp: 100, hearts: 0 });

  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [gameKey, setGameKey] = useState(0);

  // Shop state
  const [shopOpen, setShopOpen]     = useState(false);
  const [shopSummary, setShopSummary] = useState<WaveClearSummary | null>(null);
  const [upgrades, setUpgrades]     = useState<Upgrades>(INITIAL_UPGRADES);

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
    // Apply upgrades to the ref so GameScene reads them immediately
    upgradesRef.current = newUpgrades;
    setUpgrades(newUpgrades);
    // Signal GameScene to start next wave
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
    setGameKey((k) => k + 1);
    setHud(INITIAL_HUD);
  }, []);

  return (
    <View style={styles.root}>
      <Canvas
        key={gameKey}
        // Disable R3F's built-in event system so touch events reach the overlay
        style={StyleSheet.absoluteFillObject}
        gl={{ antialias: false }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 32, 0.001], fov: 55, near: 0.1, far: 300 }}
      >
        <GameScene
          joystickRef={joystickRef}
          upgradesRef={upgradesRef}
          nextWaveRef={nextWaveRef}
          onHudUpdate={handleHudUpdate}
          onWaveClear={handleWaveClear}
        />
      </Canvas>

      {/* UI overlay — no pointerEvents restriction so joystick works */}
      <View style={styles.overlay}>
        {!shopOpen && (
          <>
            <Joystick joystickRef={joystickRef} />
            <GameHUD hud={hud} onRestart={handleRestart} />
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
