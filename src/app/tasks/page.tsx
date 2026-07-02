"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { createDomainEvent, dispatchDomainEvent } from "@/lib/workflows";
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

import type {
  AgencyMemberLookupRow,
  ArtistLookupRow,
  GigLookupRow,
  TaskFilter,
  TaskGroup,
  TaskOwnerFilter,
  TaskRow,
  VenueLookupRow,
} from "./taskTypes";

import {
  isOverdue,
  isDueToday,
  isDueSoon,
  buildCompletedTaskNotes,
  canUseManagerTaskView,
  compareTasksByUrgency,
  entityHref,
  entityLabel,
  formatDate,
  isAgencyOwnerFilter,
  isEscalatedTask,
  isMineOwnerFilter,
  notesPreview,
  possessiveName,
  taskDueLabel,
  taskDueTone,
  taskEntityKey,
  taskMatchesFilter,
  taskUrgencyGroupLabel,
  toDateInputValue,
} from "./taskFilters";

function shouldEscalateOverdueTask(task: TaskRow) {
  return (
    !task.completed_at &&
    !task.is_escalated &&
    !hasDeclinedManualEscalationForDueDate(task) &&
    (task.overdue_days ?? 0) > 7
  );
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function overdueEscalationCutoff() {
  const date = startOfToday();
  date.setDate(date.getDate() - 7);
  return date;
}

function shouldRemainEscalatedForDueDate(dueAt: string | null) {
  if (!dueAt) return false;

  const dueDate = new Date(dueAt);
  return !Number.isNaN(dueDate.getTime()) && dueDate < overdueEscalationCutoff();
}

function taskEscalationDeclinedDueAt(task: TaskRow) {
  const metadata = task.metadata;

  if (!metadata || typeof metadata !== "object") return null;

  const declinedDueAt = metadata.manual_escalation_declined_for_due_at;
  return typeof declinedDueAt === "string" ? declinedDueAt : null;
}

function hasDeclinedManualEscalationForDueDate(task: TaskRow) {
  return Boolean(task.due_at && taskEscalationDeclinedDueAt(task) === task.due_at);
}

function shouldPromptForManualEscalation(task: TaskRow, nextDueAt: string | null) {
  if (!nextDueAt || task.completed_at || task.is_escalated) return false;

  const dueDateChanged =
    toDateInputValue(task.due_at) !== toDateInputValue(nextDueAt);
  if (!dueDateChanged) return false;

  return shouldRemainEscalatedForDueDate(nextDueAt);
}

function mergeTaskMetadata(
  metadata: Record<string, unknown> | null,
  values: Record<string, unknown>,
) {
  return {
    ...(metadata ?? {}),
    ...values,
  };
}

export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<TaskOwnerFilter>("mine");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [agencyMembers, setAgencyMembers] = useState<AgencyMemberLookupRow[]>([]);
  const [canManageAgencyTasks, setCanManageAgencyTasks] = useState(false);
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
  const [manualEscalationTask, setManualEscalationTask] = useState<TaskRow | null>(null);

  async function loadTasks() {
    setLoading(true);
    setMessage(null);

    const activeAgencyId = getActiveAgencyId();

    if (!activeAgencyId) {
      setTasks([]);
      setEntityLabels({});
      setCurrentUserId(null);
      setAgencyMembers([]);
      setCanManageAgencyTasks(false);
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
      setCanManageAgencyTasks(false);
      setMessage(userError?.message ?? "You must be signed in to view tasks.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);
    const userCanManageAgencyTasks = await loadAgencyMembers(activeAgencyId, user.id);
    setCanManageAgencyTasks(userCanManageAgencyTasks);


    let taskQuery = supabase
      .from("task_status_view")
      .select(
        "id, agency_id, entity_type, entity_id, summary, notes, due_at, completed_at, created_at, assigned_to, metadata, escalated_at, escalation_level, escalation_workflow_event_id, is_overdue, is_due_today, is_due_soon, is_escalated, overdue_days"
      )
      .eq("agency_id", activeAgencyId)
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
    const escalatedCount = await escalateOverdueTasks(loadedTasks, activeAgencyId, user.id);

    setTasks(loadedTasks);
    await loadEntityLabels(loadedTasks, activeAgencyId);

    if (escalatedCount > 0) {
      setMessage(
        `${escalatedCount} overdue ${escalatedCount === 1 ? "task was" : "tasks were"} marked as escalated.`
      );
    }
  }

  async function loadAgencyMembers(agencyId: string, currentUserId: string) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("agency_memberships")
      .select("user_id, role")
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
          role: null,
        },
      ]);
      return false;
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

    const roleByUserId = new Map(
      (membershipRows ?? []).map((membership) => [
        membership.user_id as string,
        membership.role as string | null,
      ])
    );

    const currentUserRole = roleByUserId.get(currentUserId) ?? null;
    const userCanManageAgencyTasks = canUseManagerTaskView(currentUserRole);

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
          role: roleByUserId.get(userId) ?? null,
        };
      })
      .sort((a, b) => {
        if (a.user_id === currentUserId) return -1;
        if (b.user_id === currentUserId) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

    setAgencyMembers(members);
    return userCanManageAgencyTasks;
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

  async function hasTaskAlreadyBeenEscalated(agencyId: string, taskId: string) {
    const { data, error } = await supabase
      .from("workflow_events")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("event_type", "task.escalated")
      .contains("metadata", { original_task_id: taskId })
      .limit(1);

    if (error) {
      console.warn("Failed to check task escalation history:", error.message);
      return true;
    }

    return (data ?? []).length > 0;
  }

  async function escalateOverdueTasks(
    loadedTasks: TaskRow[],
    agencyId: string,
    actorUserId: string
  ) {
    const candidates = loadedTasks.filter(shouldEscalateOverdueTask);
    let escalatedCount = 0;

    for (const task of candidates) {
      const alreadyEscalated = await hasTaskAlreadyBeenEscalated(agencyId, task.id);
      if (alreadyEscalated) continue;

      const event = createDomainEvent({
        type: "task.escalated",
        agencyId,
        entityType: "task",
        entityId: task.id,
        actorUserId,
        metadata: {
          original_task_id: task.id,
          original_task_summary: task.summary,
          original_entity_type: task.entity_type,
          original_entity_id: task.entity_id,
          assigned_to: task.assigned_to,
          due_at: task.due_at,
          created_at: task.created_at,
          escalation_reason: "Task is more than 7 days overdue.",
        },
      });

      const workflowResult = await dispatchDomainEvent(
        {
          supabase,
          agencyId,
          actor: { userId: actorUserId },
        },
        event
      );

      if (workflowResult.ok) {
        const escalatedAt = new Date().toISOString();

        const { error: updateError } = await supabase
          .from("activity_log")
          .update({
            escalated_at: escalatedAt,
            escalation_level: "overdue_7_days",
            escalation_workflow_event_id: workflowResult.workflowEventId,
          })
          .eq("id", task.id)
          .eq("agency_id", agencyId);

        if (updateError) {
          console.warn("Failed to mark task as escalated:", updateError.message);
        } else {
          task.escalated_at = escalatedAt;
          task.escalation_level = "overdue_7_days";
          task.escalation_workflow_event_id = workflowResult.workflowEventId;
          task.is_escalated = true;
        }

        escalatedCount += 1;
      } else {
        console.warn("Task escalation workflow did not complete cleanly", workflowResult.failures);
      }
    }

    return escalatedCount;
  }

  useEffect(() => {
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerFilter]);

  const taskStats = useMemo(
    () => ({
      open: tasks.length,
      overdue: tasks.filter(isOverdue).length,
      escalated: tasks.filter(isEscalatedTask).length,
      dueToday: tasks.filter(isDueToday).length,
      dueSoon: tasks.filter(isDueSoon).length,
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

  const taskGroups = useMemo<TaskGroup[]>(() => {
    const groups = new Map<string, TaskRow[]>();

    for (const task of [...filteredTasks].sort(compareTasksByUrgency)) {
      const label = taskUrgencyGroupLabel(task);
      groups.set(label, [...(groups.get(label) ?? []), task]);
    }

    return ["Escalated", "Overdue", "Due today", "Due soon", "Later", "No due date"]
      .map((label) => ({
        label,
        tasks: groups.get(label) ?? [],
      }))
      .filter((group) => group.tasks.length > 0);
  }, [filteredTasks]);

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

  async function markTaskAsEscalated(task: TaskRow, actorUserId: string) {
    const event = createDomainEvent({
      type: "task.escalated",
      agencyId: task.agency_id,
      entityType: "task",
      entityId: task.id,
      actorUserId,
      metadata: {
        original_task_id: task.id,
        original_task_summary: task.summary,
        original_entity_type: task.entity_type,
        original_entity_id: task.entity_id,
        assigned_to: editTaskAssignedTo,
        due_at: editTaskDueDate
          ? new Date(`${editTaskDueDate}T12:00:00`).toISOString()
          : null,
        created_at: task.created_at,
        escalation_reason: "User confirmed manual escalation during task edit.",
      },
    });

    const workflowResult = await dispatchDomainEvent(
      {
        supabase,
        agencyId: task.agency_id,
        actor: { userId: actorUserId },
      },
      event,
    );

    if (!workflowResult.ok) {
      console.warn("Task escalation workflow did not complete cleanly", workflowResult.failures);
      return null;
    }

    return workflowResult.workflowEventId;
  }

  async function saveTaskEdit(task: TaskRow, flagAsEscalated: boolean) {
    const trimmedSummary = editTaskSummary.trim();

    if (!trimmedSummary) {
      setMessage("Task summary is required.");
      return;
    }

    setSavingTaskEdit(true);

    const nextDueAt = editTaskDueDate
      ? new Date(`${editTaskDueDate}T12:00:00`).toISOString()
      : null;

    const shouldClearEscalation =
      task.is_escalated && !shouldRemainEscalatedForDueDate(nextDueAt);

    const metadata = shouldClearEscalation
      ? mergeTaskMetadata(task.metadata, { manual_escalation_declined_for_due_at: null })
      : flagAsEscalated
        ? mergeTaskMetadata(task.metadata, { manual_escalation_declined_for_due_at: null })
        : shouldPromptForManualEscalation(task, nextDueAt)
          ? mergeTaskMetadata(task.metadata, { manual_escalation_declined_for_due_at: nextDueAt })
          : task.metadata;

    let escalationFields = {};

    if (flagAsEscalated) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSavingTaskEdit(false);
        setMessage(userError?.message ?? "You must be signed in to escalate this task.");
        return;
      }

      const workflowEventId = await markTaskAsEscalated(task, user.id);

      if (!workflowEventId) {
        setSavingTaskEdit(false);
        setMessage("The task was not saved because the escalation workflow failed. Please try again.");
        return;
      }

      escalationFields = {
        escalated_at: new Date().toISOString(),
        escalation_level: "overdue_7_days",
        escalation_workflow_event_id: workflowEventId,
      };
    }

    const updatePayload = {
      summary: trimmedSummary,
      notes: editTaskNotes.trim() || null,
      due_at: nextDueAt,
      assigned_to: editTaskAssignedTo,
      metadata,
      ...escalationFields,
      ...(shouldClearEscalation
        ? {
            escalated_at: null,
            escalation_level: null,
            escalation_workflow_event_id: null,
          }
        : {}),
    };

    const { data: updatedRows, error } = await supabase
      .from("activity_log")
      .update(updatePayload)
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

    setManualEscalationTask(null);
    cancelEditingTask();
    await loadTasks();
  }

  async function handleSaveTaskEdit(task: TaskRow) {
    const trimmedSummary = editTaskSummary.trim();

    if (!trimmedSummary) {
      setMessage("Task summary is required.");
      return;
    }

    const nextDueAt = editTaskDueDate
      ? new Date(`${editTaskDueDate}T12:00:00`).toISOString()
      : null;

    if (shouldPromptForManualEscalation(task, nextDueAt)) {
      setManualEscalationTask(task);
      return;
    }

    await saveTaskEdit(task, false);
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

      {manualEscalationTask ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-escalation-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "grid",
            placeItems: "center",
            padding: "var(--space-4)",
            background: "rgba(0,0,0,0.55)",
          }}
        >
          <div style={{ width: "min(420px, 100%)" }}>
            <Card>
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <div id="manual-escalation-title" style={{ fontWeight: 800, color: "var(--text)" }}>
                  Task was due more than seven days ago. Flag as Escalated?
                </div>
                <div style={{ color: "var(--mutedText)", fontSize: 14 }}>
                  Choose Yes to mark this task as escalated, or No to save the task without escalating it.
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "var(--space-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => saveTaskEdit(manualEscalationTask, false)}
                    disabled={savingTaskEdit}
                  >
                    No
                  </Button>
                  <Button
                    type="button"
                    onClick={() => saveTaskEdit(manualEscalationTask, true)}
                    disabled={savingTaskEdit}
                  >
                    Yes
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

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
          <StatTile label="Escalated" value={taskStats.escalated} />
          <StatTile label="Due today" value={taskStats.dueToday} />
          <StatTile label="Due soon" value={taskStats.dueSoon} />
          <StatTile label="No due date" value={taskStats.noDueDate} />
        </div>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <div style={{ display: "grid", gap: "var(--space-3)", width: "100%" }}>
            <div style={{ width: "100%", minWidth: 0 }}>
              <SegmentedControl
                ariaLabel="Task filter"
                value={filter}
                onChange={setFilter}
                options={[
                  { label: "All open", value: "all" },
                  { label: "Escalated", value: "escalated" },
                  { label: "Overdue", value: "overdue" },
                  { label: "Due today", value: "due_today" },
                  { label: "Due soon", value: "due_soon" },
                  { label: "No due date", value: "no_due" },
                ]}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
              <ActionMenu
                label="Agent filter"
                open={openTaskMenuId === "tasks-filter"}
                onOpenChange={(open) => setOpenTaskMenuId(open ? "tasks-filter" : null)}
                items={ownerFilterItems}
                menuAlign="right"
                menuPosition="fixedRight"
              />
            </div>
          </div>

          <Input
            placeholder="Search tasks, notes, artists, venues or gigs…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ width: "100%", minWidth: 0 }}
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <div style={{ color: "var(--mutedText)" }}>Loading tasks…</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ color: "var(--mutedText)" }}>No open tasks found.</div>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            {taskGroups.map((group) => (
              <section key={group.label} style={{ display: "grid", gap: "var(--space-2)" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    color: "var(--mutedText)",
                    fontSize: 13,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  <span>{group.label}</span>
                  <span>{group.tasks.length}</span>
                </div>

                <div style={{ display: "grid", gap: "var(--space-2)" }}>
                  {group.tasks.map((task) => {
                    const href = entityHref(task);
                    const entityName = entityLabels[taskEntityKey(task)] ?? "Unknown";
                    const preview = notesPreview(task.notes);

                    return (
                      <div
                        key={task.id}
                  style={{
                    display: "grid",
                    gap: "var(--space-3)",
                    border: isEscalatedTask(task)
                      ? "1px solid rgba(248,113,113,0.40)"
                      : "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "var(--radius-lg)",
                    padding: "12px 12px",
                    background: isEscalatedTask(task)
                      ? "rgba(127,29,29,0.14)"
                      : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: "var(--space-3)",
                      alignItems: "start",
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
                        {isEscalatedTask(task) && task.escalated_at ? (
                          <>
                            <span>·</span>
                            <span style={{ color: "#fecaca", fontWeight: 800 }}>
                              Escalated {formatDate(task.escalated_at)}
                            </span>
                          </>
                        ) : null}
                        {preview ? (
                          <>
                            <span>·</span>
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "normal",
                                maxWidth: "100%",
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
                        alignItems: "flex-start",
                        justifyContent: "flex-end",
                        gap: "var(--space-2)",
                        flexWrap: "wrap",
                        maxWidth: 156,
                      }}
                    >
                      <StatusBadge tone={taskDueTone(task)} wrap>
                        {taskDueLabel(task)}
                      </StatusBadge>
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
            </section>
          ))}
        </div>
        )}
      </Card>
    </Page>
  );
}
