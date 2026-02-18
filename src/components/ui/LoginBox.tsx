import { StyleSheet, Text, TouchableOpacity } from "react-native";
import React from "react";
import { s } from "react-native-size-matters";



type Props = {
  title: string;
  color: string;
  onPress?: () => void;
};

const LoginBox = ({ title, color, onPress }: Props) => {
  return (
    <TouchableOpacity
      style={[styles.buttonLogin, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.textLogin}>{title}</Text>
    </TouchableOpacity>
  );
};

export default LoginBox;

const styles = StyleSheet.create({
  buttonLogin: {
    height: s(46),
    width: s(311),
    borderRadius: s(25),
    justifyContent: "center",
    alignItems: "center",
    marginVertical: s(1),
    bottom: s(-40),
  },
  textLogin: {
    color: "#ffffff",
    fontSize: s(18),
    fontWeight: "bold",
  },
});
