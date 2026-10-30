import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatMoney } from "../finance/finance.util";
import { ReportsService } from "./reports.service";

const euro = (cents: number) => Number((cents / 100).toFixed(2));

/** The monthly business report as an Excel workbook or a PDF - built from the same data as the on-screen report. */
@Injectable()
export class ReportsExportService {
  constructor(private readonly reports: ReportsService) {}

  async monthly(month: string | undefined, format: "xlsx" | "pdf") {
    const r = await this.reports.monthly(month);
    const filename = `illyrian-monthly-report-${r.month}.${format}`;
    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Illyrian Gym & CrossFit";
      const ws = wb.addWorksheet(`Report ${r.month}`);
      ws.addRow([`Monthly business report ${r.month}${r.period.isComplete ? "" : " (month in progress)"}`]).font = { bold: true, size: 14 };
      ws.addRow([]);
      const section = (title: string, rows: Array<[string, string | number]>) => {
        ws.addRow([title]).font = { bold: true };
        rows.forEach((row) => ws.addRow(row));
        ws.addRow([]);
      };
      const f = r.finance;
      section("Money (EUR)", [
        ["Received (revenue)", euro(f.receivedCents)],
        ["Invoiced (not revenue)", euro(f.billedCents)],
        ["Expenses", euro(f.expensesCents)],
        ["Net (received - expenses)", euro(f.netCents)],
        ["Unpaid balances (now)", euro(f.outstandingCents)],
        ["  of which overdue", euro(f.overdueCents)],
      ]);
      section("Members", [
        ["Registered in total", r.members.totalRegistered],
        ["Active at month end", r.members.activeAtEnd ?? "-"],
        ["New members", r.members.newMembers],
        ["New memberships sold", r.members.newMemberships],
        ["Renewals", r.members.renewals],
        ["Members lost", r.members.lost],
        ["Renewal rate %", r.members.renewalRatePercent ?? "-"],
      ]);
      section("Attendance", [
        ["Gym visits", r.attendance.totalVisits],
        ["Unique members", r.attendance.uniqueMembers],
        ["Busiest hour", r.attendance.peakHour ? `${r.attendance.peakHour.hour}:00 (${r.attendance.peakHour.visits} visits)` : "-"],
      ]);
      ws.addRow(["Packages (received)", "EUR", "Payments"]).font = { bold: true };
      r.packagesSold.forEach((p) => ws.addRow([p.name, euro(p.cents), p.count]));
      ws.addRow([]);
      ws.addRow(["Unpaid obligations - member", "Balance EUR", "Overdue EUR"]).font = { bold: true };
      r.unpaidObligations.forEach((d) => ws.addRow([`${"firstName" in d ? `${d.firstName} ${d.lastName}` : d.id}`, euro(d.balanceCents), euro(d.overdueCents)]));
      ws.columns.forEach((c) => (c.width = 32));
      return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const h = (t: string) => doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).fillColor("#0a0d0b").text(t);
      const line = (k: string, v: string) => doc.font("Helvetica").fontSize(10).fillColor("#0a0d0b").text(`${k}: `, { continued: true }).font("Helvetica-Bold").text(v);

      doc.font("Helvetica-Bold").fontSize(18).fillColor("#0a0d0b").text("Illyrian Gym & CrossFit");
      doc.font("Helvetica").fontSize(11).fillColor("#566057").text(`Monthly business report - ${r.month}${r.period.isComplete ? "" : " (month in progress)"}`);

      const f = r.finance;
      h("Money");
      line("Received (revenue)", formatMoney(f.receivedCents));
      line("Invoiced in the month (not revenue)", formatMoney(f.billedCents));
      line("Expenses", formatMoney(f.expensesCents));
      line("Net (received - expenses)", formatMoney(f.netCents));
      line("Unpaid balances (now)", formatMoney(f.outstandingCents));
      line("  of which overdue", formatMoney(f.overdueCents));
      if (f.receivedChangePercent !== null) line("Change vs previous period", `${f.receivedChangePercent}%`);

      h("Members");
      line("Registered in total", String(r.members.totalRegistered));
      line("Active at month end", String(r.members.activeAtEnd ?? "-"));
      line("New members", String(r.members.newMembers));
      line("New memberships sold", String(r.members.newMemberships));
      line("Renewals", String(r.members.renewals));
      line("Members lost", String(r.members.lost));
      line("Renewal rate", r.members.renewalRatePercent === null ? "-" : `${r.members.renewalRatePercent}%`);

      h("Attendance");
      line("Gym visits", String(r.attendance.totalVisits));
      line("Unique members", String(r.attendance.uniqueMembers));
      line("Busiest hour", r.attendance.peakHour ? `${r.attendance.peakHour.hour}:00 (${r.attendance.peakHour.visits} visits)` : "-");

      h("Received by package");
      r.packagesSold.forEach((p) => line(p.name, `${formatMoney(p.cents)} (${p.count} payments)`));
      if (r.packagesSold.length === 0) doc.font("Helvetica").fontSize(10).text("No payments received in this month.");

      h("Largest unpaid balances");
      r.unpaidObligations.slice(0, 10).forEach((d) => line("firstName" in d ? `${d.firstName} ${d.lastName}` : d.id, `${formatMoney(d.balanceCents)} (overdue ${formatMoney(d.overdueCents)})`));
      if (r.unpaidObligations.length === 0) doc.font("Helvetica").fontSize(10).text("No unpaid balances.");
      doc.end();
    });
    return { buffer, filename, contentType: "application/pdf" };
  }
}
