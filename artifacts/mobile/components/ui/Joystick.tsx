import React, { useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { JoystickState } from "@/components/game/GameWorld";

const { width: SW } = Dimensions.get("window");

const BASE_R = 64;
const KNOB_R = 28;
const MAX_DIST = BASE_R - KNOB_R;

interface Props {
  joystickRef: React.MutableRefObject<JoystickState>;
}

export function Joystick({ joystickRef }: Props) {
  const insets = useSafeAreaInsets();
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, state) => {
        const dist = Math.min(Math.hypot(state.dx, state.dy), MAX_DIST);
        const angle = Math.atan2(state.dy, state.dx);
        const kx = Math.cos(angle) * dist;
        const ky = Math.sin(angle) * dist;
        setKnob({ x: kx, y: ky });
        joystickRef.current = {
          dx: kx / MAX_DIST,
          dz: ky / MAX_DIST,
        };
      },
      onPanResponderRelease: () => {
        setKnob({ x: 0, y: 0 });
        joystickRef.current = { dx: 0, dz: 0 };
      },
      onPanResponderTerminate: () => {
        setKnob({ x: 0, y: 0 });
        joystickRef.current = { dx: 0, dz: 0 };
      },
    })
  ).current;

  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View
      style={[
        styles.base,
        {
          bottom: botPad + 60,
          left: SW / 2 - BASE_R,
          width: BASE_R * 2,
          height: BASE_R * 2,
          borderRadius: BASE_R,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.knob,
          {
            width: KNOB_R * 2,
            height: KNOB_R * 2,
            borderRadius: KNOB_R,
            transform: [{ translateX: knob.x }, { translateY: knob.y }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 2,
    borderColor: "rgba(255,51,102,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  knob: {
    backgroundColor: "rgba(255,51,102,0.7)",
    borderWidth: 2,
    borderColor: "#ff99cc",
  },
});
