import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@illyrian/database";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../prisma/prisma.service";
import { InvoicesService, INVOICE_INCLUDE } from "./invoices.service";
import { FinanceReportsService } from "./finance-reports.service";
import { FinanceExportQueryDto } from "./dto/finance.dto";
import { formatMoney } from "./finance.util";

export interface ExportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const euro = (cents: number) => Number((cents / 100).toFixed(2));

function pdfToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

/** Simple table renderer with automatic page breaks. */
function pdfTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], widths: number[]) {
  const left = doc.page.margins.left;
  const drawRow = (cells: string[], bold: boolean) => {
    const y = doc.y;
    if (y > doc.page.height - doc.page.margins.bottom - 24) doc.addPage();
    let x = left;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor("#0a0d0b");
    const top = doc.y;
    cells.forEach((c, i) => {
      doc.text(c, x, top, { width: widths[i] - 6, lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    doc.y = top + 15;
    doc.moveTo(left, doc.y - 3).lineTo(left + widths.reduce((a, b) => a + b, 0), doc.y - 3).strokeColor("#e1e5da").lineWidth(0.5).stroke();
  };
  drawRow(headers, true);
  rows.forEach((r) => drawRow(r, false));
}

@Injectable()
export class FinanceExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly reports: FinanceReportsService,
  ) {}

  // --- Management reports (Excel / PDF) ---------------------------------------

  async export(query: FinanceExportQueryDto): Promise<ExportFile> {
    const { from, to } = this.reports.resolvePeriod(query);
    const stamp = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
    const title = { summary: "Financial summary", payments: "Payments received", invoices: "Invoices", expenses: "Expenses" }[query.type];

    const table = await this.tableFor(query, from, to);
    const summary = query.type === "summary" ? await this.reports.summary(query) : null;

    if (query.format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Illyrian Gym & CrossFit";
      if (summary) this.summarySheet(wb, summary, title);
      else {
        const ws = wb.addWorksheet(title.slice(0, 30));
        ws.addRow([`${title} - ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`]).font = { bold: true, size: 13 };
        ws.addRow([]);
        ws.addRow(table.headers).font = { bold: true };
        table.rows.forEach((r) => ws.addRow(r));
        table.headers.forEach((_, i) => (ws.getColumn(i + 1).width = Math.max(14, String(table.headers[i]).length + 4)));
      }
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      return { buffer, filename: `illyrian-${query.type}-${stamp}.xlsx`, contentType: XLSX };
    }

    const buffer = await pdfToBuffer((doc) => {
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#0a0d0b").text("Illyrian Gym & CrossFit");
      doc.font("Helvetica").fontSize(11).fillColor("#566057").text(`${title}  |  ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`);
      doc.moveDown();
      if (summary) {
        const t = summary.totals;
        const lines: Array<[string, string]> = [
          ["Received (revenue)", formatMoney(t.receivedCents)],
          ["Invoiced in period (not revenue)", formatMoney(t.billedCents)],
          ["Expenses", formatMoney(t.expensesCents)],
          ["Net (received - expenses)", formatMoney(t.netCents)],
          ["Outstanding balances (now)", formatMoney(t.outstandingCents)],
          ["  of which overdue", formatMoney(t.overdueCents)],
        ];
        lines.forEach(([k, v]) => doc.font("Helvetica").fontSize(10).fillColor("#0a0d0b").text(`${k}: `, { continued: true }).font("Helvetica-Bold").text(v));
        doc.moveDown();
        pdfTable(doc, ["Period", "Received", "Expenses"], summary.series.map((s) => [s.bucket, formatMoney(s.receivedCents), formatMoney(s.expensesCents)]), [160, 160, 160]);
        doc.moveDown();
        pdfTable(doc, ["Method", "Received", "Payments"], summary.byMethod.map((m) => [m.method, formatMoney(m.cents), String(m.count)]), [160, 160, 160]);
        doc.moveDown();
        pdfTable(doc, ["Package", "Received", "Payments"], summary.byPlan.map((m) => [m.name, formatMoney(m.cents), String(m.count)]), [200, 140, 140]);
      } else {
        const w = Math.floor((doc.page.width - 96) / table.headers.length);
        pdfTable(doc, table.headers, table.rows.map((r) => r.map((c) => String(c ?? ""))), table.headers.map(() => w));
      }
    });
    return { buffer, filename: `illyrian-${query.type}-${stamp}.pdf`, contentType: "application/pdf" };
  }

  private summarySheet(wb: ExcelJS.Workbook, s: Awaited<ReturnType<FinanceReportsService["summary"]>>, title: string) {
    const ws = wb.addWorksheet("Summary");
    ws.addRow([`${title} - ${s.period.from.slice(0, 10)} to ${s.period.to.slice(0, 10)}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    const t = s.totals;
    [
      ["Received (revenue)", euro(t.receivedCents)],
      ["Invoiced in period (not revenue)", euro(t.billedCents)],
      ["Expenses", euro(t.expensesCents)],
      ["Net (received - expenses)", euro(t.netCents)],
      ["Outstanding balances (now)", euro(t.outstandingCents)],
      ["  of which overdue", euro(t.overdueCents)],
    ].forEach((r) => (ws.addRow(r).getCell(1).font = { bold: true }));
    ws.addRow([]);
    ws.addRow(["Period", "Received", "Expenses"]).font = { bold: true };
    s.series.forEach((r) => ws.addRow([r.bucket, euro(r.receivedCents), euro(r.expensesCents)]));
    ws.addRow([]);
    ws.addRow(["Method", "Received", "Payments"]).font = { bold: true };
    s.byMethod.forEach((r) => ws.addRow([r.method, euro(r.cents), r.count]));
    ws.addRow([]);
    ws.addRow(["Package", "Received", "Payments"]).font = { bold: true };
    s.byPlan.forEach((r) => ws.addRow([r.name, euro(r.cents), r.count]));
    ws.columns.forEach((c) => (c.width = 28));
  }

  private async tableFor(query: FinanceExportQueryDto, from: Date, to: Date): Promise<{ headers: string[]; rows: Array<Array<string | number>> }> {
    const db = this.prisma.client;
    if (query.type === "payments") {
      const where: Prisma.PaymentWhereInput = {
        status: "COMPLETED",
        receivedAt: { gte: from, lte: to },
        ...(query.method ? { method: query.method } : {}),
        ...(query.planId ? { membership: { planId: query.planId } } : {}),
      };
      const rows = await db.payment.findMany({
        where,
        orderBy: { receivedAt: "asc" },
        include: { user: { select: { firstName: true, lastName: true, memberNumber: true } }, invoice: { select: { number: true } }, membership: { select: { plan: { select: { name: true } } } } },
      });
      return {
        headers: ["Date", "Member no.", "Member", "Invoice", "Package", "Method", "Amount (EUR)", "Reference"],
        rows: rows.map((p) => [p.receivedAt.toISOString().slice(0, 10), p.user.memberNumber ?? "", `${p.user.firstName} ${p.user.lastName}`, p.invoice?.number ?? "", p.membership?.plan.name ?? "", p.method, euro(p.amountCents), p.reference ?? ""]),
      };
    }
    if (query.type === "invoices") {
      const rows = await db.invoice.findMany({
        where: { issuedAt: { gte: from, lte: to }, ...(query.planId ? { membership: { planId: query.planId } } : {}) },
        orderBy: { issuedAt: "asc" },
        include: INVOICE_INCLUDE,
      });
      return {
        headers: ["Number", "Issued", "Due", "Member no.", "Member", "Total (EUR)", "Paid (EUR)", "Balance (EUR)", "Status"],
        rows: rows.map((r) => {
          const i = this.invoices.present(r);
          return [i.number, i.issuedAt.toISOString().slice(0, 10), i.dueDate.toISOString().slice(0, 10), i.user.memberNumber ?? "", `${i.user.firstName} ${i.user.lastName}`, euro(i.totalCents), euro(i.paidCents), euro(i.balanceCents), i.displayStatus];
        }),
      };
    }
    if (query.type === "expenses") {
      const rows = await db.expense.findMany({ where: { voidedAt: null, spentAt: { gte: from, lte: to } }, orderBy: { spentAt: "asc" } });
      return { headers: ["Date", "Category", "Description", "Amount (EUR)"], rows: rows.map((e) => [e.spentAt.toISOString().slice(0, 10), e.category, e.description, euro(e.amountCents)]) };
    }
    return { headers: [], rows: [] };
  }

  // --- A single invoice as PDF -------------------------------------------------

  /** `requesterId` is set for members, so a member can only ever download their own invoice. */
  async invoicePdf(invoiceId: string, requesterId?: string): Promise<ExportFile> {
    const invoice = await this.prisma.client.invoice.findFirst({
      where: { id: invoiceId, ...(requesterId ? { userId: requesterId, status: "OPEN" } : {}) },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    const inv = this.invoices.present(invoice);
    const settings = await this.prisma.client.gymSettings.findUnique({ where: { id: "default" } });

    const buffer = await pdfToBuffer((doc) => {
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#0a0d0b").text(settings?.name ?? "Illyrian Gym & CrossFit");
      doc.font("Helvetica").fontSize(9).fillColor("#566057");
      [settings?.address, settings?.contactPhone, settings?.contactEmail].filter(Boolean).forEach((l) => doc.text(l as string));
      doc.moveDown(1.5);

      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0a0d0b").text(`Invoice ${inv.number}`);
      doc.font("Helvetica").fontSize(10).fillColor("#566057").text(`Status: ${inv.displayStatus}`);
      doc.text(`Issued: ${inv.issuedAt.toISOString().slice(0, 10)}    Due: ${inv.dueDate.toISOString().slice(0, 10)}`);
      doc.moveDown();
      doc.fillColor("#0a0d0b").font("Helvetica-Bold").text("Billed to");
      doc.font("Helvetica").text(`${inv.user.firstName} ${inv.user.lastName}${inv.user.memberNumber ? `  (${inv.user.memberNumber})` : ""}`);
      doc.text(inv.user.email);
      doc.moveDown();

      pdfTable(doc, ["Description", "Amount"], inv.lines.map((l) => [l.description, formatMoney(l.amountCents, inv.currency)]), [380, 110]);
      doc.moveDown(0.5);
      const row = (k: string, v: string, bold = false) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#0a0d0b").text(`${k}: ${v}`, { align: "right" });
      };
      row("Subtotal", formatMoney(inv.subtotalCents, inv.currency));
      if (inv.discountCents > 0) row("Discount", `-${formatMoney(inv.discountCents, inv.currency)}`);
      row("Total", formatMoney(inv.totalCents, inv.currency), true);
      row("Received", formatMoney(inv.paidCents, inv.currency));
      row("Balance due", formatMoney(inv.balanceCents, inv.currency), true);

      const completed = inv.payments.filter((p) => p.status === "COMPLETED");
      if (completed.length > 0) {
        doc.moveDown();
        doc.font("Helvetica-Bold").fontSize(10).text("Payments received");
        pdfTable(doc, ["Date", "Method", "Amount"], completed.map((p) => [p.receivedAt.toISOString().slice(0, 10), p.method, formatMoney(p.amountCents, p.currency)]), [160, 160, 160]);
      }
      if (inv.notes) {
        doc.moveDown();
        doc.font("Helvetica").fontSize(9).fillColor("#566057").text(inv.notes);
      }
    });
    return { buffer, filename: `${inv.number}.pdf`, contentType: "application/pdf" };
  }
}
