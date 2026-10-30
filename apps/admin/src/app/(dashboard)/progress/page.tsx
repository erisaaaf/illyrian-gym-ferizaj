"use client";

import { useState } from "react";
import { useFetch } from "../../../lib/use-fetch";
import { fullName } from "../../../lib/format";
import { PageHeader } from "../../../components/ui/page-header";
import { SelectField } from "../../../components/ui/field";
import { DataEmptyState } from "../../../components/ui/states";
import { ClientReport } from "../../../components/coaching/client-report";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
}

/** Progress reports: pick a client, read (and print) their report. Trainers see their own clients; the owner sees all. */
export default function ProgressPage() {
  const clients = useFetch<{ data: Client[] }>("clients?pageSize=100");
  const [clientId, setClientId] = useState("");

  return (
    <div>
      <PageHeader eyebrow="Training" title="Progress reports" description="Workout frequency, plan adherence, strength and personal records, attendance and your notes for one client." />
      <div className="mb-5 max-w-sm">
        <SelectField label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Choose a client…</option>
          {clients.data?.data.map((c) => (
            <option key={c.id} value={c.id}>
              {fullName(c)} {c.memberNumber ? `(${c.memberNumber})` : ""}
            </option>
          ))}
        </SelectField>
      </div>
      {clientId ? <ClientReport clientId={clientId} /> : <DataEmptyState title="Choose a client" message="Pick a client above to see their progress report." />}
    </div>
  );
}
