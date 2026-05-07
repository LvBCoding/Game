import { Canvas } from "@react-three/fiber";
import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { GameHUD } from "@/components/ui/GameHUD";
import { Joystick } from "@/components/ui/Joystick";
import { GameScene } from "./GameScene";

export interface HudState {
  giantHeartHp:    number;
  heartsCollected: number;
  score:           number;
  wave:            number;
  phase:           "playing" | "gameover";
}

export interface JoystickState {
  dx: number;
  dz: number;
}

const INITIAL_HUD: HudState = {
  giantHeartHp: 100,
  heartsCollected: 0,
  score: 0,
  wave: 1,
  phase: "playing",
};

export default function GameWorld() {
  const joystickRef = useRef<JoystickState>({ dx: 0, dz: 0 });
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [gameKey, setGameKey] = useState(0);

  const handleHudUpdate = useCallback((next: HudState) => {
    setHud(next);
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
        camera={{ position: [0, 32, 0.001], fov: 55, near: 0.1, far: 300 }}
      >
        <GameScene
          joystickRef={joystickRef}
          onHudUpdate={handleHudUpdate}
        />
      </Canvas>

      <View style={styles.overlay} pointerEvents="box-none">
        <Joystick joystickRef={joystickRef} />
        <GameHUD hud={hud} onRestart={handleRestart} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0d0021",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
