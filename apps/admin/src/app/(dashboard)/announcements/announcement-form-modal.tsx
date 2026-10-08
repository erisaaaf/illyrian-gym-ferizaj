"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { TextField, TextAreaField, SelectField } from "../../../components/ui/field";
import { Button } from "../../../components/ui/button";
import { AnnouncementItem } from "./types";

export function AnnouncementFormModal({
  open,
  onClose,
  onSaved,
  announcement,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  announcement: AnnouncementItem | null;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(announcement?.title ?? "");
      setContent(announcement?.content ?? "");
      setPriority(announcement?.priority ?? "NORMAL");
      setError(null);
    }
  }, [open, announcement]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { title, content, priority };
      if (announcement) {
        await api.patch(`announcements/${announcement.id}`, payload);
      } else {
        await api.post("announcements", payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this announcement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={announcement ? "Edit Announcement" : "New Announcement"}>
      <form onSubmit={onSubmit}>
        {error && <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</p>}
        <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextAreaField label="Content" required value={content} onChange={(e) => setContent(e.target.value)} />
        <SelectField label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="NORMAL">Normal</option>
          <option value="IMPORTANT">Important</option>
          <option value="URGENT">Urgent</option>
        </SelectField>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {announcement ? "Save changes" : "Create announcement"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
