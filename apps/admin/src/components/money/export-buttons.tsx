"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { downloadFile } from "../../lib/use-fetch";
import { ApiError } from "../../lib/api";
import { qs } from "../../lib/api";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

/** Excel and PDF downloads of the same filtered view the person is looking at. */
export function ExportButtons({ type, filters }: { type: "summary" | "payments" | "invoices" | "expenses"; filters: Record<string, string | undefined> }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(format: "xlsx" | "pdf") {
    setBusy(format);
    try {
      await downloadFile(`admin/finance/export${qs({ ...filters, type, format })}`, `${type}.${format}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => run("xlsx")} loading={busy === "xlsx"}>
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        Excel
      </Button>
      <Button variant="secondary" onClick={() => run("pdf")} loading={busy === "pdf"}>
        <FileText className="h-4 w-4" aria-hidden="true" />
        PDF
      </Button>
    </>
  );
}
