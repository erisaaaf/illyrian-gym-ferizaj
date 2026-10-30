import { ColorValue } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { color } from "@illyrian/config";
import { Icon, IconName } from "../../components/icons";
import { useAuth } from "../../lib/auth-context";

// One icon family across the product (the staff web app uses Lucide too).
const icon = (name: IconName) =>
  function TabIcon({ color: c, size }: { color: ColorValue; size: number }) {
    return <Icon name={name} color={c} size={size} strokeWidth={2.2} />;
  };

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }
  // A temporary password must be replaced first (the API refuses everything else until it is).
  if (user?.mustChangePassword) {
    return <Redirect href="/change-password" />;
  }

  // Progress tracking and the AI coach are member features; staff get the
  // schedule (with participant check-in), today's WOD and their profile.
  const isMember = user?.role === "MEMBER";

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
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("Home") }} />
      <Tabs.Screen name="card" options={{ title: "My card", href: isMember ? undefined : null, tabBarIcon: icon("QrCode") }} />
      <Tabs.Screen name="clients" options={{ title: "Clients", href: user?.role === "COACH" ? undefined : null, tabBarIcon: icon("Contact") }} />
      <Tabs.Screen name="schedule" options={{ title: isMember ? "Schedule" : "Classes", tabBarIcon: icon("CalendarDays") }} />
      <Tabs.Screen name="wod" options={{ title: "WOD", tabBarIcon: icon("Flame") }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", href: isMember ? undefined : null, tabBarIcon: icon("TrendingUp") }} />
      <Tabs.Screen name="coach" options={{ title: "AI Coach", href: isMember ? undefined : null, tabBarIcon: icon("Bot") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("User") }} />
    </Tabs>
  );
}
