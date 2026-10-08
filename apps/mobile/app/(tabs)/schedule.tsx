import { ScrollView, StyleSheet } from "react-native";
import { color, spacing } from "@illyrian/config";
import { EmptyState } from "../../components/empty-state";

export default function ScheduleScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md }}>
      <EmptyState
        title="Class schedule"
        message="Browse classes, view details, and book a spot - lands in Phase 2 (Gym Core)."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
});
