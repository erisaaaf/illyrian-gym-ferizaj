import { ScrollView, StyleSheet } from "react-native";
import { color, spacing } from "@illyrian/config";
import { EmptyState } from "../../components/empty-state";

export default function WodScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md }}>
      <EmptyState
        title="Today's WOD"
        message="Warm-up, strength, metcon, and cooldown sections land here in Phase 2, with workout tracking in Phase 3."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
});
