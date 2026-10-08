import { Redirect, Tabs } from "expo-router";
import { color } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.surface },
        headerTitleStyle: { color: color.textPrimary },
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule" }} />
      <Tabs.Screen name="wod" options={{ title: "WOD" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="coach" options={{ title: "AI Coach" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
