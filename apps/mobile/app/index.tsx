import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { color } from "@illyrian/config";
import { useAuth } from "../lib/auth-context";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.background }}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/login"} />;
}
