import { Canvas } from "@react-three/fiber";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { GameHUD } from "@/components/ui/GameHUD";
import { Joystick } from "@/components/ui/Joystick";
import { GameScene } from "./GameScene";

export interface HudState {
  loveBar: number;
  giantHeartHp: number;
  score: number;
  wave: number;
  phase: "playing" | "gameover";
  canFire: boolean;
}

export interface JoystickState {
  dx: number;
  dz: number;
}

const INITIAL_HUD: HudState = {
  loveBar: 0,
  giantHeartHp: 100,
  score: 0,
  wave: 1,
  phase: "playing",
  canFire: false,
};

export default function GameWorld() {
  const joystickRef = useRef<JoystickState>({ dx: 0, dz: 0 });
  const fireRef = useRef(false);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [gameKey, setGameKey] = useState(0);

  const handleHudUpdate = useCallback((next: HudState) => {
    setHud(next);
  }, []);

  const handleFire = useCallback(() => {
    fireRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const handleRestart = useCallback(() => {
    setGameKey((k) => k + 1);
    setHud(INITIAL_HUD);
  }, []);

  return (
    <View style={styles.root}>
      <Canvas
        key={gameKey}
        style={StyleSheet.absoluteFillObject}
        gl={{ antialias: false }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 18, 14], fov: 55, near: 0.1, far: 300 }}
      >
        <GameScene
          joystickRef={joystickRef}
          fireRef={fireRef}
          onHudUpdate={handleHudUpdate}
        />
      </Canvas>

      <View style={styles.controls} pointerEvents="box-none">
        <Joystick joystickRef={joystickRef} />
        <GameHUD hud={hud} onFire={handleFire} onRestart={handleRestart} />
      </View>

      {/* Fallback shown only if WebGL is unavailable */}
      {false && null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0d0021",
  },
  controls: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
