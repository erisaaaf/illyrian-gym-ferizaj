import { Stack } from "expo-router";
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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.background } }}>
            <Stack.Screen name="billing" options={{ headerShown: true }} />
            <Stack.Screen name="body" options={{ headerShown: true }} />
          </Stack>
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
