"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ActionMenu, Button, Field, Input, SectionCard, SegmentedControl, Select, Textarea } from "@/components/ui";

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
  assigned_to: string | null;
};

type EntryMode = "note" | "task";

type AgencyMemberOption = {
  user_id: string;
  display_name: string;
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

function toDateInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
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
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskSummary, setEditTaskSummary] = useState("");
  const [editTaskNotes, setEditTaskNotes] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState("");
  const [agencyMembers, setAgencyMembers] = useState<AgencyMemberOption[]>([]);
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, entityType, entityId]);

  useEffect(() => {
    void loadAgencyMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

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

  async function loadAgencyMembers() {
    if (!agencyId) {
      setAgencyMembers([]);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: membershipRows, error: membershipError } = await supabase
      .from("agency_memberships")
      .select("user_id")
      .eq("agency_id", agencyId);

    if (membershipError || !membershipRows) {
      if (membershipError) {
        console.warn("Failed to load agency members for task assignment:", membershipError.message);
      }

      setAgencyMembers(
        user
          ? [
              {
                user_id: user.id,
                display_name: user.email ?? "Me",
              },
            ]
          : []
      );
      return;
    }

    const userIds = Array.from(
      new Set(
        membershipRows
          .map((membership) => membership.user_id as string | null)
          .filter((userId): userId is string => Boolean(userId))
      )
    );

    if (user && !userIds.includes(user.id)) {
      userIds.unshift(user.id);
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profileError) {
      console.warn("Failed to load profiles for task assignment:", profileError.message);
    }

    const profileById = new Map(
      (profileRows ?? []).map((profile) => [
        profile.id as string,
        { full_name: profile.full_name as string | null },
      ])
    );

    const members = userIds
      .map((userId) => {
        const profile = profileById.get(userId);
        const displayName =
          profile?.full_name?.trim() ||
          (userId === user?.id ? user.email ?? "Me" : "Unknown agent");

        return {
          user_id: userId,
          display_name: userId === user?.id ? `${displayName} (me)` : displayName,
        };
      })
      .sort((a, b) => {
        if (a.user_id === user?.id) return -1;
        if (b.user_id === user?.id) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

    setAgencyMembers(members);
  }

  async function loadEntries() {
    if (!agencyId || !entityId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("activity_log")
      .select("id, activity_type, summary, notes, due_at, completed_at, created_at, created_by, assigned_to")
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

    const { error } =
      entryMode === "note"
        ? await supabase.from("activity_log").insert({
            agency_id: agencyId,
            entity_type: entityType,
            entity_id: entityId,
            activity_type: "note",
            summary: "Added a note",
            notes: trimmedNote,
            due_at: null,
            created_by: user.id,
          })
        : await supabase.from("activity_log").insert({
            agency_id: agencyId,
            entity_type: entityType,
            entity_id: entityId,
            activity_type: "task",
            summary: trimmedTaskSummary,
            notes: trimmedNote || null,
            due_at: newTaskDueDate ? new Date(`${newTaskDueDate}T12:00:00`).toISOString() : null,
            created_by: user.id,
            assigned_to: user.id,
          });

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

    const completionNote = window.prompt("Optional completion note", "");

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

    setOpenTaskMenuId(null);
    await loadEntries();
  }

  function startEditingTask(entry: ActivityLogEntry) {
    if (!isTask(entry)) return;

    setEditingTaskId(entry.id);
    setEditTaskSummary(entry.summary);
    setEditTaskNotes(entry.notes ?? "");
    setEditTaskDueDate(toDateInputValue(entry.due_at));
    setEditTaskAssignedTo(entry.assigned_to ?? "");
    setOpenTaskMenuId(null);
  }

  function cancelEditingTask() {
    setEditingTaskId(null);
    setEditTaskSummary("");
    setEditTaskNotes("");
    setEditTaskDueDate("");
    setEditTaskAssignedTo("");
  }

  async function handleSaveTaskEdit(entry: ActivityLogEntry) {
    const trimmedSummary = editTaskSummary.trim();

    if (!trimmedSummary) {
      alert("Task summary is required.");
      return;
    }

    if (!editTaskAssignedTo) {
      alert("Task assignee is required.");
      return;
    }

    setSavingTaskEdit(true);

    const { data: updatedRows, error } = await supabase
      .from("activity_log")
      .update({
        summary: trimmedSummary,
        notes: editTaskNotes.trim() || null,
        due_at: editTaskDueDate ? new Date(`${editTaskDueDate}T12:00:00`).toISOString() : null,
        assigned_to: editTaskAssignedTo,
      })
      .eq("id", entry.id)
      .eq("agency_id", agencyId)
      .select("id");

    setSavingTaskEdit(false);

    if (error) {
      alert(error.message);
      return;
    }
    if (!updatedRows || updatedRows.length === 0) {
      alert(
        "The task was not updated. You may not have permission to edit this task, or it may already have been changed."
      );
      return;
    }

    cancelEditingTask();
    await loadEntries();
  }

  async function handleDeleteTask(entry: ActivityLogEntry) {
    if (!isTask(entry)) return;

    const confirmed = window.confirm(`Delete task "${entry.summary}"?`);
    if (!confirmed) return;

    setDeletingTaskId(entry.id);

    const { data: deletedRows, error } = await supabase
      .from("activity_log")
      .delete()
      .eq("id", entry.id)
      .eq("agency_id", agencyId)
      .select("id");

    setDeletingTaskId(null);

    if (error) {
      alert(error.message);
      return;
    }
    if (!deletedRows || deletedRows.length === 0) {
      alert(
        "The task was not deleted. You may not have permission to delete this task, or it may already have been changed."
      );
      return;
    }

    if (editingTaskId === entry.id) {
      cancelEditingTask();
    }

    setOpenTaskMenuId(null);
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
                    {isTask(entry) ? (
                      <ActionMenu
                        label="Task actions"
                        open={openTaskMenuId === entry.id}
                        onOpenChange={(open) => setOpenTaskMenuId(open ? entry.id : null)}
                        items={[
                          ...(isOpenTask(entry)
                            ? [
                                {
                                  label:
                                    completingTaskId === entry.id ? "Completing…" : "Complete",
                                  onClick: () => handleCompleteTask(entry),
                                  disabled: completingTaskId === entry.id,
                                },
                              ]
                            : []),
                          {
                            label: "Edit",
                            onClick: () => startEditingTask(entry),
                          },
                          {
                            label: deletingTaskId === entry.id ? "Deleting…" : "Delete",
                            onClick: () => handleDeleteTask(entry),
                            disabled: deletingTaskId === entry.id,
                            tone: "danger",
                          },
                        ]}
                      />
                    ) : null}

                    <div style={{ color: "var(--mutedText)", fontSize: 12 }}>
                      {formatActivityDate(entry.created_at)}
                    </div>
                  </div>
                </div>

                {editingTaskId === entry.id ? (
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      display: "grid",
                      gap: "var(--space-3)",
                      borderTop: "1px solid rgba(255,255,255,0.10)",
                      paddingTop: "var(--space-3)",
                    }}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Task">
                        <Input
                          value={editTaskSummary}
                          onChange={(event) => setEditTaskSummary(event.target.value)}
                        />
                      </Field>

                      <Field label="Due date">
                        <Input
                          type="date"
                          value={editTaskDueDate}
                          onChange={(event) => setEditTaskDueDate(event.target.value)}
                        />
                      </Field>

                      <Field label="Assigned to">
                        <Select
                          value={editTaskAssignedTo}
                          onChange={(event) => setEditTaskAssignedTo(event.target.value)}
                        >
                          {agencyMembers.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                              {member.display_name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    <Field label="Notes">
                      <Textarea
                        value={editTaskNotes}
                        onChange={(event) => setEditTaskNotes(event.target.value)}
                        style={{ minHeight: 90, resize: "vertical" }}
                      />
                    </Field>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "var(--space-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      <Button type="button" variant="secondary" onClick={cancelEditingTask}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleSaveTaskEdit(entry)}
                        disabled={
                          savingTaskEdit ||
                          editTaskSummary.trim().length === 0 ||
                          !editTaskAssignedTo
                        }
                      >
                        {savingTaskEdit ? "Saving…" : "Save task"}
                      </Button>
                    </div>
                  </div>
                ) : entry.notes ? (
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
