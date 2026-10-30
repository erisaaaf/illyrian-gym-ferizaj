import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { color, radius, spacing, typography } from "@illyrian/config";
import { apiClient } from "../../lib/api-client";
import { errorMessage, useApi } from "../../lib/use-api";
import { fmtDate } from "../../lib/format";
import { Button, Card, ErrorBlock, Field, Loading, Muted, Pill, Screen } from "../../components/ui";
import { QrCode } from "../../components/qr-code";

interface MemberCard {
  memberNumber: string | null;
  name: string;
  qrToken: string;
  visitCount: number;
  membership: { plan: string; planType: string; period: string; startDate: string; endDate: string; daysRemaining: number; status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "FROZEN" | "CANCELLED" } | null;
}
interface MembershipRequest {
  id: string;
  type: "RENEWAL" | "FREEZE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  handledNote: string | null;
}

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  EXPIRING_SOON: { label: "Expiring soon", tone: "warning" },
  EXPIRED: { label: "Expired", tone: "danger" },
  FROZEN: { label: "Frozen", tone: "info" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export default function CardScreen() {
  const card = useApi<MemberCard>("/me/card");
  const requests = useApi<MembershipRequest[]>("/membership-requests/me");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await apiClient.post("/membership-requests", body);
      setMessage({ ok: true, text: done });
      setFreezeOpen(false);
      await requests.reload();
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const m = card.data?.membership ?? null;
  const pending = (type: string) => requests.data?.some((r) => r.type === type && r.status === "PENDING") ?? false;

  return (
    <Screen onRefresh={async () => void (await Promise.all([card.reload(), requests.reload()]))}>
      {card.loading && !card.data && <Loading />}
      {card.error && <ErrorBlock message={card.error} onRetry={card.reload} />}
      {card.data && (
        <View style={styles.passport}>
          <Text style={styles.brand}>ILLYRIAN GYM &amp; CROSSFIT</Text>
          <Text style={styles.name}>{card.data.name}</Text>
          <Text style={styles.number}>{card.data.memberNumber ?? "No member number yet"}</Text>
          <View style={styles.qr}>
            <QrCode value={card.data.qrToken} />
          </View>
          <Text style={styles.scanHint}>Show this code at the front desk to check in. It only identifies you: your membership is checked live.</Text>
          {m ? (
            <View style={styles.membershipRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.plan}>{m.plan}</Text>
                <Text style={styles.until}>
                  {m.status === "EXPIRED" ? "Ended" : "Valid until"} {fmtDate(m.endDate)}
                  {m.status !== "EXPIRED" && m.status !== "CANCELLED" ? ` · ${m.daysRemaining} days left` : ""}
                </Text>
              </View>
              <Pill label={STATUS[m.status]?.label ?? m.status} tone={STATUS[m.status]?.tone ?? "neutral"} />
            </View>
          ) : (
            <Text style={styles.until}>You do not have a membership yet. Ask the front desk to set one up.</Text>
          )}
        </View>
      )}

      {card.data && (
        <Card title="Your membership">
          <Muted>{card.data.visitCount} gym visits recorded.</Muted>
          {message && <Text style={{ color: message.ok ? color.success : color.danger, fontSize: typography.size.sm }}>{message.text}</Text>}
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            <Button
              label={pending("RENEWAL") ? "Renewal requested" : "Request renewal"}
              variant="secondary"
              disabled={pending("RENEWAL")}
              loading={busy}
              onPress={() => send({ type: "RENEWAL" }, "Request sent. The front desk will contact you; payment is made at the desk.")}
            />
            <Button label={pending("FREEZE") ? "Freeze requested" : "Request a freeze"} variant="secondary" disabled={pending("FREEZE")} onPress={() => setFreezeOpen((o) => !o)} />
          </View>
          {freezeOpen && (
            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              <View style={{ flexDirection: "row", gap: spacing.xs }}>
                <Field label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} autoCapitalize="none" placeholder="2026-12-01" />
                <Field label="Until (YYYY-MM-DD)" value={until} onChangeText={setUntil} autoCapitalize="none" placeholder="2026-12-15" />
              </View>
              <Button
                label="Send freeze request"
                loading={busy}
                disabled={!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(until)}
                onPress={() => send({ type: "FREEZE", requestedFrom: `${from}T00:00:00.000Z`, requestedUntil: `${until}T23:59:59.000Z` }, "Freeze request sent. Nothing changes until the gym approves it.")}
              />
            </View>
          )}
        </Card>
      )}

      {requests.data && requests.data.length > 0 && (
        <Card title="Your requests">
          {requests.data.map((r) => (
            <View key={r.id} style={styles.requestRow}>
              <Text style={styles.requestText}>
                {r.type === "RENEWAL" ? "Renewal" : "Freeze"} · {fmtDate(r.createdAt)}
              </Text>
              <Pill label={r.status === "PENDING" ? "Waiting" : r.status === "APPROVED" ? "Approved" : "Declined"} tone={r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "warning"} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  passport: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, padding: spacing.lg, alignItems: "center", gap: spacing.xs },
  brand: { color: color.accent, fontSize: typography.size.xs, letterSpacing: 2.4, fontWeight: "800" },
  name: { color: color.textPrimary, fontSize: typography.size.xl, fontWeight: "800", marginTop: spacing.xs, textAlign: "center" },
  number: { color: color.accent, fontSize: typography.size.md, fontWeight: "700", letterSpacing: 1 },
  qr: { marginVertical: spacing.md },
  scanHint: { color: color.textMuted, fontSize: typography.size.xs, textAlign: "center", maxWidth: 280 },
  membershipRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "stretch", marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.sm },
  plan: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "700" },
  until: { color: color.textSecondary, fontSize: typography.size.sm, marginTop: 2 },
  requestRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xxs },
  requestText: { color: color.textPrimary, fontSize: typography.size.sm },
});
