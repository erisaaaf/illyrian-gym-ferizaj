import { ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { color, radius, spacing, typography } from "@illyrian/config";

/** Standard scrolling screen with pull-to-refresh. */
export function Screen({ children, onRefresh }: { children: ReactNode; onRefresh?: () => Promise<void> | void }) {
  const [refreshing, setRefreshing] = useState(false);
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            tintColor={color.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await onRefresh();
              setRefreshing(false);
            }}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({ title, children, accessibilityLabel }: { title?: string; children: ReactNode; accessibilityLabel?: string }) {
  return (
    <View style={styles.card} accessibilityLabel={accessibilityLabel ?? title}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";
const TONE: Record<Tone, string> = {
  neutral: color.textSecondary,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
  info: color.info,
};

export function Pill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.pill, { borderColor: TONE[tone] }]}>
      <Text style={[styles.pillText, { color: TONE[tone] }]}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  small,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  small?: boolean;
}) {
  const bg = variant === "primary" ? color.accent : "transparent";
  const border = variant === "primary" ? color.accent : variant === "danger" ? color.danger : color.border;
  const text = variant === "danger" ? color.danger : color.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, borderColor: border, opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={text} size="small" /> : <Text style={[styles.buttonText, { color: text }]}>{label}</Text>}
    </Pressable>
  );
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.centered} accessibilityLabel={label}>
      <ActivityIndicator color={color.accent} />
      <Text style={[styles.muted, { marginTop: spacing.xs }]}>{label}</Text>
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" small onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={[styles.muted, { textAlign: "center" }]}>{message}</Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={color.textMuted} {...props} style={[styles.input, props.style]} accessibilityLabel={label} />
    </View>
  );
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: { color: color.textMuted, fontSize: typography.size.xs, textTransform: "uppercase", letterSpacing: 0.6 },
  heading: { color: color.textPrimary, fontSize: typography.size.lg, fontWeight: "700" },
  muted: { color: color.textMuted, fontSize: typography.size.sm },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 2, alignSelf: "flex-start" },
  pillText: { fontSize: typography.size.xs, fontWeight: "600" },
  button: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSmall: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  buttonText: { fontWeight: "600", fontSize: typography.size.sm },
  centered: { alignItems: "center", padding: spacing.lg },
  errorBox: {
    borderWidth: 1,
    borderColor: color.danger,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: "rgba(225,54,44,0.08)",
  },
  errorText: { color: color.danger, fontSize: typography.size.sm },
  empty: {
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xxs,
  },
  emptyTitle: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  fieldLabel: { color: color.textMuted, fontSize: typography.size.xs, marginBottom: spacing.xxs },
  input: {
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    color: color.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.size.md,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  tileValue: { color: color.textPrimary, fontSize: typography.size.xl, fontWeight: "700" },
  tileLabel: { color: color.textMuted, fontSize: typography.size.xs, marginTop: spacing.xxs },
});
