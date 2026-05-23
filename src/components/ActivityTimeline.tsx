"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button, Field, SectionCard, Textarea } from "@/components/ui";

type ActivityEntityType = "artist" | "venue" | "gig" | "contact" | "workflow";

type ActivityLogEntry = {
  id: string;
  activity_type: string;
  summary: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

type ActivityTimelineProps = {
  agencyId: string;
  entityType: ActivityEntityType;
  entityId: string;
  title?: string;
};

function formatActivityDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityTimeline({
  agencyId,
  entityType,
  entityId,
  title = "Activity",
}: ActivityTimelineProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, entityType, entityId]);

  useEffect(() => {
    function handleActivityChanged(event: Event) {
      const customEvent = event as CustomEvent<{
        entityType?: ActivityEntityType;
        entityId?: string;
      }>;

      if (
        customEvent.detail?.entityType === entityType &&
        customEvent.detail?.entityId === entityId
      ) {
        void loadEntries();
      }
    }

    window.addEventListener("activity-log-changed", handleActivityChanged);

    return () => {
      window.removeEventListener("activity-log-changed", handleActivityChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function loadEntries() {
    if (!agencyId || !entityId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("activity_log")
      .select("id, activity_type, summary, notes, created_at, created_by")
      .eq("agency_id", agencyId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error || !data) {
      if (error) console.warn("Failed to load activity:", error.message);
      setEntries([]);
      setLoading(false);
      return;
    }

    setEntries(data as ActivityLogEntry[]);
    setLoading(false);
  }

  async function handleAddNote() {
    const trimmedNote = newNote.trim();
    if (!trimmedNote || !agencyId || !entityId) return;

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert(userError?.message ?? "You must be signed in to add an activity note.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("activity_log").insert({
      agency_id: agencyId,
      entity_type: entityType,
      entity_id: entityId,
      activity_type: "note",
      summary: "Added a note",
      notes: trimmedNote,
      created_by: user.id,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setNewNote("");
    await loadEntries();
  }

  return (
    <SectionCard title={`${title} (${entries.length})`}>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <Field label="Add note">
            <Textarea
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder="Add a note, call summary, or follow-up reminder..."
              style={{ minHeight: 100, resize: "vertical" }}
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              onClick={handleAddNote}
              disabled={saving || newNote.trim().length === 0}
            >
              {saving ? "Adding…" : "Add note"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: "var(--mutedText)", fontSize: 14 }}>Loading activity…</div>
        ) : entries.length === 0 ? (
          <div style={{ color: "var(--mutedText)", fontSize: 14 }}>
            No activity recorded yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: "var(--radius-lg)",
                  padding: "12px 12px",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      color: "var(--mutedText)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {entry.summary}
                  </div>
                  <div style={{ color: "var(--mutedText)", fontSize: 12 }}>
                    {formatActivityDate(entry.created_at)}
                  </div>
                </div>

                {entry.notes ? (
                  <div
                    style={{
                      color: "var(--mutedText)",
                      fontSize: 14,
                      marginTop: 6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {entry.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}