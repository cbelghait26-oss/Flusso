// src/components/ui/BottomSheet.tsx
import React, { ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, View, StyleSheet, Platform, ScrollView, Keyboard } from "react-native";
import { useTheme } from "../theme/theme";
import { s } from "react-native-size-matters";

export function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors, radius } = useTheme();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Fullscreen container */}
      <View style={styles.root} pointerEvents="box-none">
        {/* Backdrop ONLY (captures outside taps) */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Sheet */}
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              marginBottom: keyboardHeight,
            },
          ]}
          pointerEvents="auto"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: s(16), flexGrow: 1 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: { 
    borderWidth: s(1),
    maxHeight: "90%",
  },
});
