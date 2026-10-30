import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { color, spacing, typography } from "@illyrian/config";
import { API_URL } from "../lib/api-config";
import { tokenStorage } from "../lib/token-storage";
import { useApi } from "../lib/use-api";
import { fmtDate } from "../lib/format";
import { Button, Card, ErrorBlock, Loading, Muted, Pill, Screen, StatTile } from "../components/ui";

const euro = (cents: number, currency = "EUR") => new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(cents / 100);

interface Summary {
  currency: string;
  balanceCents: number;
  overdueCents: number;
  totalPaidCents: number;
  openInvoiceCount: number;
  nextPayment: { number: string; dueDate: string; balanceCents: number; status: string } | null;
}
interface Invoice {
  id: string;
  number: string;
  description: string;
  displayStatus: string;
  issuedAt: string;
  dueDate: string;
  totalCents: number;
  balanceCents: number;
}
interface Payment {
  id: string;
  amountCents: number;
  method: string;
  receivedAt: string;
  invoice: { number: string } | null;
}
interface Page<T> {
  data: T[];
}

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { PAID: "success", PARTIAL: "warning", PENDING: "warning", OVERDUE: "danger", VOID: "neutral" };
const METHOD: Record<string, string> = { CASH: "Cash", BANK: "Bank transfer", CARD: "Card" };

/** Opens an invoice PDF. Web downloads it; native sharing of files is not wired up yet, so the desk can print a copy. */
async function openPdf(invoice: Invoice): Promise<string | null> {
  if (Platform.OS !== "web") return "Saving the PDF on a phone is not available yet. Ask the front desk for a printed copy.";
  const token = await tokenStorage.getAccessToken();
  const res = await fetch(`${API_URL}/invoices/me/${invoice.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return "Could not download the invoice. Try again.";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

export default function BillingScreen() {
  const summary = useApi<Summary>("/billing/me");
  const invoices = useApi<Page<Invoice>>("/invoices/me?pageSize=20");
  const payments = useApi<Page<Payment>>("/payments/me?pageSize=20");
  const [note, setNote] = useState<string | null>(null);

  return (
    <>
      <Stack.Screen options={{ title: "Payments & invoices", headerStyle: { backgroundColor: color.surface }, headerTintColor: color.textPrimary }} />
      <Screen onRefresh={async () => void (await Promise.all([summary.reload(), invoices.reload(), payments.reload()]))}>
        {summary.loading && !summary.data && <Loading />}
        {summary.error && <ErrorBlock message={summary.error} onRetry={summary.reload} />}
        {summary.data && (
          <View style={styles.tiles}>
            <StatTile label="You owe" value={euro(summary.data.balanceCents, summary.data.currency)} />
            <StatTile label="Paid so far" value={euro(summary.data.totalPaidCents, summary.data.currency)} />
          </View>
        )}
        {summary.data?.nextPayment && (
          <Card title="Next payment">
            <Text style={styles.strong}>
              {euro(summary.data.nextPayment.balanceCents, summary.data.currency)} · {summary.data.nextPayment.number}
            </Text>
            <Muted>Due {fmtDate(summary.data.nextPayment.dueDate)}. Payments are made at the front desk.</Muted>
          </Card>
        )}
        {note && <Text style={{ color: color.warning, fontSize: typography.size.sm }}>{note}</Text>}

        <Card title="Invoices">
          {invoices.data?.data.length === 0 && <Muted>No invoices yet.</Muted>}
          {invoices.data?.data.map((i) => (
            <View key={i.id} style={styles.line}>
              <View style={styles.row}>
                <Text style={styles.strong}>{i.number}</Text>
                <Pill label={i.displayStatus.charAt(0) + i.displayStatus.slice(1).toLowerCase()} tone={TONE[i.displayStatus] ?? "neutral"} />
              </View>
              <Muted>
                {i.description} · {euro(i.totalCents)}
                {i.balanceCents > 0 ? ` · ${euro(i.balanceCents)} left` : ""}
              </Muted>
              <Muted>
                Issued {fmtDate(i.issuedAt)} · due {fmtDate(i.dueDate)}
              </Muted>
              <Button label="Download PDF" variant="secondary" small onPress={async () => setNote(await openPdf(i))} />
            </View>
          ))}
        </Card>

        <Card title="Payments received">
          {payments.data?.data.length === 0 && <Muted>No payments yet.</Muted>}
          {payments.data?.data.map((p) => (
            <View key={p.id} style={styles.line}>
              <View style={styles.row}>
                <Text style={styles.strong}>{euro(p.amountCents)}</Text>
                <Muted>{fmtDate(p.receivedAt)}</Muted>
              </View>
              <Muted>
                {METHOD[p.method] ?? p.method}
                {p.invoice ? ` · ${p.invoice.number}` : ""}
              </Muted>
            </View>
          ))}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  strong: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  line: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs, marginTop: spacing.xs, gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
