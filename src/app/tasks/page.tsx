"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import {
  ActionMenu,
  Button,
  Card,
  Field,
  Input,
  Page,
  SegmentedControl,
  Select,
  StatTile,
  StatusBadge,
  Textarea,
} from "@/components/ui";

type TaskEntityType = "artist" | "venue" | "gig" | "contact" | "workflow";
type TaskFilter = "all" | "overdue" | "due_today" | "no_due";
type TaskOwnerFilter = "mine" | "agency" | string;

type TaskRow = {
  id: string;
  agency_id: string;
  entity_type: TaskEntityType;
  entity_id: string;
  summary: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_to: string;
};

type ArtistLookupRow = {
  id: string;
  name: string;
};

type VenueLookupRow = {
  id: string;
  name: string;
};

type GigLookupRow = {
  id: string;
  title: string | null;
  artists: { name: string } | null;
};

type AgencyMemberLookupRow = {
  user_id: string;
  display_name: string;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatDate(value: string | null) {
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

  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function taskDueTone(task: TaskRow) {
  if (task.completed_at) return "muted";
  if (!task.due_at) return "muted";

  const dueDate = new Date(task.due_at);

  if (!Number.isNaN(dueDate.getTime()) && dueDate < startOfToday()) {
    return "danger";
  }

  return "warning";
}

function isOverdue(task: TaskRow) {
  if (!task.due_at || task.completed_at) return false;

  const dueDate = new Date(task.due_at);
  return !Number.isNaN(dueDate.getTime()) && dueDate < startOfToday();
}

function isDueToday(task: TaskRow) {
  if (!task.due_at || task.completed_at) return false;

  const dueDate = new Date(task.due_at);
  return (
    !Number.isNaN(dueDate.getTime()) &&
    dueDate >= startOfToday() &&
    dueDate <= endOfToday()
  );
}

function taskDueLabel(task: TaskRow) {
  if (task.completed_at) return "Completed";
  if (!task.due_at) return "No due date";
  if (isOverdue(task)) return "Overdue";

  return `Due ${formatDate(task.due_at)}`;
}

function entityHref(task: TaskRow) {
  if (task.entity_type === "artist") return `/artists/${task.entity_id}#activity`;
  if (task.entity_type === "venue") return `/venues/${task.entity_id}#activity`;
  if (task.entity_type === "gig") return `/gigs/${task.entity_id}#activity`;
  return null;
}

function entityLabel(entityType: TaskEntityType) {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1);
}

function taskEntityKey(task: TaskRow) {
  return `${task.entity_type}:${task.entity_id}`;
}

function notesPreview(notes: string | null) {
  const normalized = notes?.replace(/\s+/g, " ").trim();

  if (!normalized) return null;

  return normalized.length > 110 ? `${normalized.slice(0, 110)}…` : normalized;
}

function buildCompletedTaskNotes(existingNotes: string | null, completionNote: string) {
  const completedLine = `Completed ${new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
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

function taskMatchesFilter(task: TaskRow, filter: TaskFilter) {
  if (filter === "overdue") return isOverdue(task);
  if (filter === "due_today") return isDueToday(task);
  if (filter === "no_due") return !task.due_at;
  return true;
}

function isAgencyOwnerFilter(value: TaskOwnerFilter) {
  return value === "agency";
}

function isMineOwnerFilter(value: TaskOwnerFilter) {
  return value === "mine";
}

function possessiveName(name: string) {
  return name.endsWith("s") ? `${name}' tasks` : `${name}'s tasks`;
}

export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<TaskOwnerFilter>("mine");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [agencyMembers, setAgencyMembers] = useState<AgencyMemberLookupRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});

  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskSummary, setEditTaskSummary] = useState("");
  const [editTaskNotes, setEditTaskNotes] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState("");
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    setMessage(null);

    const activeAgencyId = getActiveAgencyId();

    if (!activeAgencyId) {
      setTasks([]);
      setEntityLabels({});
      setCurrentUserId(null);
      setAgencyMembers([]);
      setMessage("No active agency selected. Go to /me and choose an agency.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setTasks([]);
      setEntityLabels({});
      setCurrentUserId(null);
      setAgencyMembers([]);
      setMessage(userError?.message ?? "You must be signed in to view tasks.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);
    await loadAgencyMembers(activeAgencyId, user.id);

    let taskQuery = supabase
      .from("activity_log")
      .select("id, agency_id, entity_type, entity_id, summary, notes, due_at, completed_at, created_at, assigned_to")
      .eq("agency_id", activeAgencyId)
      .eq("activity_type", "task")
      .is("completed_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (isMineOwnerFilter(ownerFilter)) {
      taskQuery = taskQuery.eq("assigned_to", user.id);
    } else if (!isAgencyOwnerFilter(ownerFilter)) {
      taskQuery = taskQuery.eq("assigned_to", ownerFilter);
    }

    const { data, error } = await taskQuery;

    setLoading(false);

    if (error || !data) {
      setTasks([]);
      setEntityLabels({});
      setMessage(error?.message ?? "Could not load tasks.");
      return;
    }

    const loadedTasks = data as TaskRow[];
    setTasks(loadedTasks);
    await loadEntityLabels(loadedTasks, activeAgencyId);
  }

  async function loadAgencyMembers(agencyId: string, currentUserId: string) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("agency_memberships")
      .select("user_id")
      .eq("agency_id", agencyId);

    if (membershipError || !membershipRows) {
      if (membershipError) {
        console.warn("Failed to load agency memberships for task filters:", membershipError.message);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setAgencyMembers([
        {
          user_id: currentUserId,
          display_name: user?.email ?? "Me",
        },
      ]);
      return;
    }

    const userIds = Array.from(
      new Set(
        membershipRows
          .map((membership) => membership.user_id as string | null)
          .filter((userId): userId is string => Boolean(userId))
      )
    );

    if (!userIds.includes(currentUserId)) {
      userIds.unshift(currentUserId);
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profileError) {
      console.warn("Failed to load task assignee profiles:", profileError.message);
    }

    const profileById = new Map(
      (profileRows ?? []).map((profile) => [
        profile.id as string,
        {
          full_name: profile.full_name as string | null,
        },
      ])
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const members = userIds
      .map((userId) => {
        const profile = profileById.get(userId);
        const displayName =
          profile?.full_name?.trim() ||
          (userId === currentUserId ? user?.email ?? "Me" : "Unknown agent");

        return {
          user_id: userId,
          display_name: userId === currentUserId ? `${displayName} (me)` : displayName,
        };
      })
      .sort((a, b) => {
        if (a.user_id === currentUserId) return -1;
        if (b.user_id === currentUserId) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

    setAgencyMembers(members);
  }

  async function loadEntityLabels(loadedTasks: TaskRow[], agencyId: string) {
    const artistIds = loadedTasks
      .filter((task) => task.entity_type === "artist")
      .map((task) => task.entity_id);

    const venueIds = loadedTasks
      .filter((task) => task.entity_type === "venue")
      .map((task) => task.entity_id);

    const gigIds = loadedTasks
      .filter((task) => task.entity_type === "gig")
      .map((task) => task.entity_id);

    const [artistResult, venueResult, gigResult] = await Promise.all([
      artistIds.length > 0
        ? supabase.from("artists").select("id, name").eq("agency_id", agencyId).in("id", artistIds)
        : Promise.resolve({ data: [], error: null }),
      venueIds.length > 0
        ? supabase.from("venues").select("id, name").eq("agency_id", agencyId).in("id", venueIds)
        : Promise.resolve({ data: [], error: null }),
      gigIds.length > 0
        ? supabase
            .from("gigs")
            .select("id, title, artists:artists(name)")
            .eq("agency_id", agencyId)
            .in("id", gigIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (artistResult.error) console.warn("Failed to load artist task labels:", artistResult.error.message);
    if (venueResult.error) console.warn("Failed to load venue task labels:", venueResult.error.message);
    if (gigResult.error) console.warn("Failed to load gig task labels:", gigResult.error.message);

    const nextLabels: Record<string, string> = {};

    for (const artist of (artistResult.data ?? []) as ArtistLookupRow[]) {
      nextLabels[`artist:${artist.id}`] = artist.name;
    }

    for (const venue of (venueResult.data ?? []) as VenueLookupRow[]) {
      nextLabels[`venue:${venue.id}`] = venue.name;
    }

    for (const gig of (gigResult.data ?? []) as unknown as GigLookupRow[]) {
      nextLabels[`gig:${gig.id}`] = gig.title?.trim() || gig.artists?.name || "Untitled gig";
    }

    setEntityLabels(nextLabels);
  }

  useEffect(() => {
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter]);

  const taskStats = useMemo(
    () => ({
      open: tasks.length,
      overdue: tasks.filter(isOverdue).length,
      dueToday: tasks.filter(isDueToday).length,
      noDueDate: tasks.filter((task) => !task.due_at).length,
    }),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const search = query.trim().toLowerCase();

    return tasks.filter((task) => {
      if (!taskMatchesFilter(task, filter)) return false;

      if (!search) return true;

      const entityName = entityLabels[taskEntityKey(task)] ?? "";
      const haystack = `${task.summary} ${task.notes ?? ""} ${task.entity_type} ${entityName}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [entityLabels, filter, query, tasks]);

  async function handleCompleteTask(task: TaskRow) {
    setCompletingTaskId(task.id);

    const completionNote = window.prompt("Completion note (optional)");
    if (completionNote === null) {
      setCompletingTaskId(null);
      return;
    }

    const completedAt = new Date().toISOString();

    const { data: updatedRows, error } = await supabase
      .from("activity_log")
      .update({
        completed_at: completedAt,
        notes: buildCompletedTaskNotes(task.notes, completionNote),
      })
      .eq("id", task.id)
      .eq("agency_id", task.agency_id)
      .select("id");

    setCompletingTaskId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      setMessage("The task was not completed. You may not have permission to update it.");
      return;
    }

    setOpenTaskMenuId(null);
    await loadTasks();
  }

  function startEditingTask(task: TaskRow) {
    setEditingTaskId(task.id);
    setEditTaskSummary(task.summary);
    setEditTaskNotes(task.notes ?? "");
    setEditTaskDueDate(toDateInputValue(task.due_at));
    setEditTaskAssignedTo(task.assigned_to);
    setOpenTaskMenuId(null);
  }

  function cancelEditingTask() {
    setEditingTaskId(null);
    setEditTaskSummary("");
    setEditTaskNotes("");
    setEditTaskDueDate("");
    setEditTaskAssignedTo("");
  }

  async function handleSaveTaskEdit(task: TaskRow) {
    const trimmedSummary = editTaskSummary.trim();

    if (!trimmedSummary) {
      setMessage("Task summary is required.");
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
      .eq("id", task.id)
      .eq("agency_id", task.agency_id)
      .select("id");

    setSavingTaskEdit(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      setMessage("The task was not updated. You may not have permission to edit it.");
      return;
    }

    cancelEditingTask();
    await loadTasks();
  }

  async function handleDeleteTask(task: TaskRow) {
    const confirmed = window.confirm(`Delete task "${task.summary}"?`);
    if (!confirmed) return;

    setDeletingTaskId(task.id);

    const { data: deletedRows, error } = await supabase
      .from("activity_log")
      .delete()
      .eq("id", task.id)
      .eq("agency_id", task.agency_id)
      .select("id");

    setDeletingTaskId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      setMessage("The task was not deleted. You may not have permission to delete it.");
      return;
    }

    if (editingTaskId === task.id) {
      cancelEditingTask();
    }

    setOpenTaskMenuId(null);
    await loadTasks();
  }

  const selectedAgentName =
    !isMineOwnerFilter(ownerFilter) && !isAgencyOwnerFilter(ownerFilter)
      ? agencyMembers.find((member) => member.user_id === ownerFilter)?.display_name ?? "Agent"
      : null;

  const pageTitle = isMineOwnerFilter(ownerFilter)
    ? "My tasks"
    : isAgencyOwnerFilter(ownerFilter)
      ? "All tasks"
      : possessiveName(selectedAgentName ?? "Agent");

  const ownerFilterItems = [
    {
      label: "All",
      onClick: () => {
        setOwnerFilter("agency");
        setOpenTaskMenuId(null);
      },
    },
    {
      label: "Mine",
      onClick: () => {
        setOwnerFilter("mine");
        setOpenTaskMenuId(null);
      },
    },
    ...agencyMembers
      .filter((member) => member.user_id !== currentUserId)
      .sort((a, b) => a.display_name.localeCompare(b.display_name))
      .map((member) => ({
        label: member.display_name,
        onClick: () => {
          setOwnerFilter(member.user_id);
          setOpenTaskMenuId(null);
        },
      })),
  ];

  return (
    <Page title={`${pageTitle} (${filteredTasks.length})`}>
      {message ? <p style={{ color: "var(--mutedText)" }}>{message}</p> : null}

      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "var(--space-3)",
            marginBottom: "var(--space-4)",
          }}
        >
          <StatTile label="Open" value={taskStats.open} />
          <StatTile label="Overdue" value={taskStats.overdue} />
          <StatTile label="Due today" value={taskStats.dueToday} />
          <StatTile label="No due date" value={taskStats.noDueDate} />
        </div>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 420px" }}>
              <SegmentedControl
                ariaLabel="Task filter"
                value={filter}
                onChange={setFilter}
                options={[
                  { label: "All open", value: "all" },
                  { label: "Overdue", value: "overdue" },
                  { label: "Due today", value: "due_today" },
                  { label: "No due date", value: "no_due" },
                ]}
              />
            </div>

            <ActionMenu
              label="Agent filter"
              open={openTaskMenuId === "tasks-filter"}
              onOpenChange={(open) => setOpenTaskMenuId(open ? "tasks-filter" : null)}
              items={ownerFilterItems}
            />
          </div>

          <Input
            placeholder="Search tasks, notes, artists, venues or gigs…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ minWidth: 240 }}
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <div style={{ color: "var(--mutedText)" }}>Loading tasks…</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ color: "var(--mutedText)" }}>No open tasks found.</div>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {filteredTasks.map((task) => {
              const href = entityHref(task);
              const entityName = entityLabels[taskEntityKey(task)] ?? "Unknown";
              const preview = notesPreview(task.notes);

              return (
                <div
                  key={task.id}
                  style={{
                    display: "grid",
                    gap: "var(--space-3)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "var(--radius-lg)",
                    padding: "12px 12px",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "var(--space-3)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "var(--text)" }}>{task.summary}</div>
                      <div
                        style={{
                          color: "var(--mutedText)",
                          fontSize: 13,
                          marginTop: 4,
                          display: "flex",
                          gap: "var(--space-2)",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{entityLabel(task.entity_type)}</span>
                        <span>·</span>
                        {href ? (
                          <Link href={href} style={{ color: "inherit", textDecoration: "underline" }}>
                            {entityName}
                          </Link>
                        ) : (
                          <span>{entityName}</span>
                        )}
                        <span>·</span>
                        <span>Created {formatDate(task.created_at)}</span>
                        {preview ? (
                          <>
                            <span>·</span>
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: 520,
                              }}
                              title={preview}
                            >
                              {preview}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "var(--space-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      <StatusBadge tone={taskDueTone(task)}>{taskDueLabel(task)}</StatusBadge>
                      <ActionMenu
                        label="Task actions"
                        open={openTaskMenuId === task.id}
                        onOpenChange={(open) => setOpenTaskMenuId(open ? task.id : null)}
                        items={[
                          {
                            label: completingTaskId === task.id ? "Completing…" : "Complete",
                            onClick: () => handleCompleteTask(task),
                            disabled: completingTaskId === task.id,
                          },
                          {
                            label: "Edit",
                            onClick: () => startEditingTask(task),
                          },
                          ...(href
                            ? [
                                {
                                  label: "Open record",
                                  onClick: () => {
                                    window.location.href = href;
                                  },
                                },
                              ]
                            : []),
                          {
                            label: deletingTaskId === task.id ? "Deleting…" : "Delete",
                            onClick: () => handleDeleteTask(task),
                            disabled: deletingTaskId === task.id,
                            tone: "danger" as const,
                          },
                        ]}
                      />
                    </div>
                  </div>

                  {editingTaskId === task.id ? (
                    <div
                      style={{
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
                          style={{ minHeight: 100, resize: "vertical" }}
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
                          onClick={() => handleSaveTaskEdit(task)}
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
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </Page>
  );
}
