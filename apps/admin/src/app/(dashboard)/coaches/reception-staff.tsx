"use client";

import { FormEvent, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { api, ApiError, qs } from "../../../lib/api";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { useFetch } from "../../../lib/use-fetch";
import { formatDate, fullName } from "../../../lib/format";
import { SearchInput } from "../../../components/ui/page-header";
import { Table, Thead, Th, Tbody, Tr, Td, Pagination } from "../../../components/ui/table";
import { UserStatusBadge, Badge } from "../../../components/ui/badge";
import { DataEmptyState, ErrorState, TableSkeleton } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";
import { TextField } from "../../../components/ui/field";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { ResetPasswordModal } from "../../../components/reset-password-modal";
import { CredentialsPanel } from "../../../components/credentials-panel";
import { useToast } from "../../../components/ui/toast";

interface Staff {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  mustChangePassword: boolean;
  createdAt: string;
}
interface Paged {
  data: Staff[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

/** Front-desk (reception) accounts. They can run the desk but see no business reports or owner settings. */
export function ReceptionStaff() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [debounced]);
  const { data, loading, error, reload } = useFetch<Paged>(`admin/staff${qs({ search: debounced, page, pageSize: 20 })}`);

  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<{ staff: Staff; temporaryPassword: string } | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState<Staff | null>(null);
  const [toggle, setToggle] = useState<Staff | null>(null);

  function close() {
    setAdding(false);
    setCreated(null);
    setFirst("");
    setLast("");
    setEmail("");
    setPhone("");
    setFormError(null);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const r = await api.post<{ staff: Staff; temporaryPassword: string }>("admin/staff", { firstName: first, lastName: last, email, phone: phone || undefined });
      setCreated(r);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? (err.errors?.validation?.[0] ?? err.message) : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Name or email" label="Search reception staff" />
        <Button variant="primary" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add reception staff
        </Button>
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <TableSkeleton cols={5} rows={3} />}
      {data && data.data.length === 0 && <DataEmptyState title="No reception staff" message="Add a receptionist so the front desk can check members in, sell memberships and take payments." />}
      {data && data.data.length > 0 && (
        <>
          <Table caption="Reception staff">
            <Thead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Added</Th>
              <Th>Account</Th>
              <Th />
            </Thead>
            <Tbody>
              {data.data.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-semibold">{fullName(s)}</Td>
                  <Td className="text-text-secondary">{s.email}</Td>
                  <Td className="text-text-secondary">{formatDate(s.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <UserStatusBadge status={s.status} />
                      {s.mustChangePassword && <Badge variant="info">Not signed in yet</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setReset(s)}>
                        Reset password
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToggle(s)}>
                        {s.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
        </>
      )}

      {created ? (
        <Modal open onClose={close} title="Reception account created" persistent footer={<Button variant="primary" onClick={close}>Done</Button>}>
          <CredentialsPanel name={fullName(created.staff)} email={created.staff.email} password={created.temporaryPassword} audience="trainer" />
          <p className="text-xs text-text-muted">They sign in to this staff console and are asked to choose their own password first.</p>
        </Modal>
      ) : (
        <Modal
          open={adding}
          onClose={close}
          title="Add reception staff"
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" form="staff-form" loading={busy}>
                Create account
              </Button>
            </>
          }
        >
          <form id="staff-form" onSubmit={create}>
            {formError && (
              <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                {formError}
              </p>
            )}
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <TextField label="First name" required value={first} onChange={(e) => setFirst(e.target.value)} />
              <TextField label="Last name" required value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
            <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </form>
        </Modal>
      )}
      {reset && <ResetPasswordModal open onClose={() => setReset(null)} name={fullName(reset)} path={`admin/staff/${reset.id}/reset-password`} audience="trainer" />}
      <ConfirmDialog
        open={toggle !== null}
        onClose={() => setToggle(null)}
        title={toggle?.status === "ACTIVE" ? "Deactivate this account?" : "Reactivate this account?"}
        message={toggle?.status === "ACTIVE" ? "They are signed out and can no longer use the staff console. Their history is kept." : "They can sign in again."}
        danger={toggle?.status === "ACTIVE"}
        onConfirm={async () => {
          await api.patch(`admin/staff/${toggle!.id}/status`, { status: toggle!.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
          toast.success("Account updated");
          reload();
        }}
      />
    </div>
  );
}
