import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { color } from "@illyrian/config";
import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: color.background }}>
          <StatusBar style="light" />
          <Slot />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
