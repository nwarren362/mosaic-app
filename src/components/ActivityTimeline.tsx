"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button, Field, Input, SectionCard, SegmentedControl, Textarea } from "@/components/ui";

type ActivityEntityType = "artist" | "venue" | "gig" | "contact" | "workflow";

type ActivityLogEntry = {
  id: string;
  activity_type: string;
  summary: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: string | null;
};

type EntryMode = "note" | "task";

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

function formatDueDate(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildCompletedTaskNotes(existingNotes: string | null, completionNote: string) {
  const completedLine = `Completed ${formatActivityDate(new Date().toISOString())}`;
  const trimmedCompletionNote = completionNote.trim();
  const trimmedExistingNotes = existingNotes?.trim() ?? "";

  const completionBlock = [
    completedLine,
    trimmedCompletionNote ? "" : null,
    trimmedCompletionNote || null,
  ]
    .filter(Boolean)
    .join("\n");

  if (!trimmedExistingNotes) {
    return completionBlock;
  }

  return `${completionBlock}\n\n--------------------------------\nOriginal task note below.\n--------------------------------\n${trimmedExistingNotes}`;
}

function isTask(entry: ActivityLogEntry) {
  return entry.activity_type === "task";
}

function isOpenTask(entry: ActivityLogEntry) {
  return isTask(entry) && !entry.completed_at;
}

export function ActivityTimeline({
  agencyId,
  entityType,
  entityId,
  title = "Activity",
}: ActivityTimelineProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [entryMode, setEntryMode] = useState<EntryMode>("note");
  const [newNote, setNewNote] = useState("");
  const [newTaskSummary, setNewTaskSummary] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

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
      .select("id, activity_type, summary, notes, due_at, completed_at, created_at, created_by")
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

    const sortedEntries = (data as ActivityLogEntry[]).sort((a, b) => {
      if (isOpenTask(a) && !isOpenTask(b)) return -1;
      if (!isOpenTask(a) && isOpenTask(b)) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setEntries(sortedEntries);
    setLoading(false);
  }

  async function handleAddEntry() {
    const trimmedNote = newNote.trim();
    const trimmedTaskSummary = newTaskSummary.trim();

    if (!agencyId || !entityId) return;
    if (entryMode === "note" && !trimmedNote) return;
    if (entryMode === "task" && !trimmedTaskSummary) return;

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert(userError?.message ?? "You must be signed in to add activity.");
      setSaving(false);
      return;
    }

    const payload =
      entryMode === "note"
        ? {
            agency_id: agencyId,
            entity_type: entityType,
            entity_id: entityId,
            activity_type: "note",
            summary: "Added a note",
            notes: trimmedNote,
            due_at: null,
            created_by: user.id,
          }
        : {
            agency_id: agencyId,
            entity_type: entityType,
            entity_id: entityId,
            activity_type: "task",
            summary: trimmedTaskSummary,
            notes: trimmedNote || null,
            due_at: newTaskDueDate ? new Date(`${newTaskDueDate}T12:00:00`).toISOString() : null,
            created_by: user.id,
          };

    const { error } = await supabase.from("activity_log").insert(payload);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setNewNote("");
    setNewTaskSummary("");
    setNewTaskDueDate("");
    await loadEntries();
  }

  async function handleCompleteTask(entry: ActivityLogEntry) {
    if (!isOpenTask(entry)) return;

    const completionNote = window.prompt(
      "Optional completion note",
      ""
    );

    if (completionNote === null) return;

    const completedAt = new Date().toISOString();

    setCompletingTaskId(entry.id);

    const { error } = await supabase
      .from("activity_log")
      .update({
        completed_at: completedAt,
        notes: buildCompletedTaskNotes(entry.notes, completionNote),
      })
      .eq("id", entry.id)
      .eq("agency_id", agencyId);

    setCompletingTaskId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadEntries();
  }

  return (
    <SectionCard title={`${title} (${entries.length})`}>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <SegmentedControl
            ariaLabel="Activity entry type"
            value={entryMode}
            onChange={setEntryMode}
            options={[
              { label: "Note", value: "note" },
              { label: "Task", value: "task" },
            ]}
          />

          {entryMode === "task" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Task">
                <Input
                  value={newTaskSummary}
                  onChange={(event) => setNewTaskSummary(event.target.value)}
                  placeholder="Follow up with venue, send brief, chase confirmation..."
                />
              </Field>

              <Field label="Due date">
                <Input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(event) => setNewTaskDueDate(event.target.value)}
                />
              </Field>
            </div>
          ) : null}

          <Field label={entryMode === "task" ? "Notes" : "Add note"}>
            <Textarea
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder={
                entryMode === "task"
                  ? "Optional extra detail for this follow-up task..."
                  : "Add a note, call summary, or useful context..."
              }
              style={{ minHeight: 100, resize: "vertical" }}
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              onClick={handleAddEntry}
              disabled={
                saving ||
                (entryMode === "note" && newNote.trim().length === 0) ||
                (entryMode === "task" && newTaskSummary.trim().length === 0)
              }
            >
              {saving ? "Adding…" : entryMode === "task" ? "Add task" : "Add note"}
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
                      display: "flex",
                      gap: "var(--space-2)",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {isTask(entry) ? (
                      <span aria-hidden="true">{entry.completed_at ? "☑" : "☐"}</span>
                    ) : null}
                    <span>{entry.summary}</span>
                    {isTask(entry) ? (
                      <span style={{ color: "var(--mutedText)", fontSize: 12 }}>
                        ·{" "}
                        {entry.completed_at
                          ? `Completed ${formatDueDate(entry.completed_at)}`
                          : `Due ${formatDueDate(entry.due_at)}`}
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-2)",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {isOpenTask(entry) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleCompleteTask(entry)}
                        disabled={completingTaskId === entry.id}
                      >
                        {completingTaskId === entry.id ? "Completing…" : "Complete"}
                      </Button>
                    ) : null}
                    <div style={{ color: "var(--mutedText)", fontSize: 12 }}>
                      {formatActivityDate(entry.created_at)}
                    </div>
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
