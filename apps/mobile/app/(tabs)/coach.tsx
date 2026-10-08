import { View, StyleSheet } from "react-native";
import { color, spacing } from "@illyrian/config";
import { EmptyState } from "../../components/empty-state";

export default function CoachScreen() {
  return (
    <View style={styles.screen}>
      <EmptyState
        title="AI Assistant Coach"
        message="Ask about today's WOD, your PRs, or your training progress - lands in Phase 5, backed by real data only (see docs/architecture.md#ai-architecture)."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background, padding: spacing.md, justifyContent: "center" },
});
