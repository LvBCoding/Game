import React, { useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { JoystickState } from "@/components/game/GameWorld";

const BASE_R = 60;
const KNOB_R = 26;
const MAX_DIST = BASE_R - KNOB_R;

interface Props {
  joystickRef: React.MutableRefObject<JoystickState>;
}

export function Joystick({ joystickRef }: Props) {
  const insets = useSafeAreaInsets();
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        active.current = true;
      },
      onPanResponderMove: (_, state) => {
        const rawX = state.dx;
        const rawY = state.dy;
        const dist = Math.min(Math.hypot(rawX, rawY), MAX_DIST);
        const angle = Math.atan2(rawY, rawX);
        const kx = Math.cos(angle) * dist;
        const ky = Math.sin(angle) * dist;
        setKnob({ x: kx, y: ky });
        joystickRef.current = {
          dx: kx / MAX_DIST,
          dz: ky / MAX_DIST,
        };
      },
      onPanResponderRelease: () => {
        active.current = false;
        setKnob({ x: 0, y: 0 });
        joystickRef.current = { dx: 0, dz: 0 };
      },
      onPanResponderTerminate: () => {
        active.current = false;
        setKnob({ x: 0, y: 0 });
        joystickRef.current = { dx: 0, dz: 0 };
      },
    })
  ).current;

  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View
      style={[
        styles.joystickBase,
        {
          bottom: botPad + 110,
          left: 32,
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
  joystickBase: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(255,51,102,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  knob: {
    backgroundColor: "rgba(255,51,102,0.75)",
    borderWidth: 2,
    borderColor: "#ff99cc",
  },
});
