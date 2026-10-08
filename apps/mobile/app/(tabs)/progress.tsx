import { ScrollView, StyleSheet } from "react-native";
import { color, spacing } from "@illyrian/config";
import { EmptyState } from "../../components/empty-state";

export default function ProgressScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <EmptyState title="Workout history" message="Lands in Phase 3 (Training)." />
      <EmptyState title="My PRs" message="Personal records by exercise, with full history - lands in Phase 4." />
      <EmptyState title="Training stats" message="Classes attended, streaks, and frequency land in Phase 3." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
});
