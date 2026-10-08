import { StyleSheet, Text, View } from "react-native";
import { color, radius, spacing, typography } from "@illyrian/config";

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  title: {
    color: color.textPrimary,
    fontSize: typography.size.md,
    fontWeight: "600",
    marginBottom: spacing.xxs,
  },
  message: {
    color: color.textMuted,
    fontSize: typography.size.sm,
    textAlign: "center",
  },
});
