"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getActiveAgencyId } from "@/lib/agencyContext";
import {
  ActionMenu,
  Button,
  Card,
  Field,
  Input,
  Page,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";

import type {
  AgencyMemberLookupRow,
  TaskFilter,
  TaskGroup,
  TaskOwnerFilter,
  TaskRow,
} from "./taskTypes";

import {
  isOverdue,
  isDueToday,
  isDueSoon,
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

import {
  ESCALATION_LEVEL_OVERDUE_7_DAYS,
  dueAtFromDateInput,
  editTaskMetadata,
  shouldPromptForManualEscalation,
} from "./taskWorkflow";

import {
  completeTask,
  createManualTaskEscalation,
  deleteTask,
  escalateOverdueTasks,
  fetchAgencyMembersForTasks,
  fetchOpenTasks,
  fetchTaskEntityLabels,
  getSignedInUser,
  updateTask,
} from "./taskQueries";

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
    } = await getSignedInUser();

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

    const { members, canManageAgencyTasks: userCanManageAgencyTasks } =
      await fetchAgencyMembersForTasks(activeAgencyId, user.id);
    setAgencyMembers(members);
    setCanManageAgencyTasks(userCanManageAgencyTasks);

    const { data, error } = await fetchOpenTasks(activeAgencyId, ownerFilter, user.id);

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
    setEntityLabels(await fetchTaskEntityLabels(loadedTasks, activeAgencyId));

    if (escalatedCount > 0) {
      setMessage(
        `${escalatedCount} overdue ${escalatedCount === 1 ? "task was" : "tasks were"} marked as escalated.`
      );
    }
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

    const { data: updatedRows, error } = await completeTask(task, completionNote);

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

  async function saveTaskEdit(task: TaskRow, flagAsEscalated: boolean) {
    const trimmedSummary = editTaskSummary.trim();

    if (!trimmedSummary) {
      setMessage("Task summary is required.");
      return;
    }

    setSavingTaskEdit(true);

    const nextDueAt = dueAtFromDateInput(editTaskDueDate);
    const { metadata, shouldClearEscalation } = editTaskMetadata(
      task,
      nextDueAt,
      flagAsEscalated,
    );

    let escalationFields = {};

    if (flagAsEscalated) {
      const {
        data: { user },
        error: userError,
      } = await getSignedInUser();

      if (userError || !user) {
        setSavingTaskEdit(false);
        setMessage(userError?.message ?? "You must be signed in to escalate this task.");
        return;
      }

      const workflowEventId = await createManualTaskEscalation(
        task,
        user.id,
        editTaskAssignedTo,
        nextDueAt,
      );

      if (!workflowEventId) {
        setSavingTaskEdit(false);
        setMessage("The task was not saved because the escalation workflow failed. Please try again.");
        return;
      }

      escalationFields = {
        escalated_at: new Date().toISOString(),
        escalation_level: ESCALATION_LEVEL_OVERDUE_7_DAYS,
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

    const { data: updatedRows, error } = await updateTask(task, updatePayload);

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

    const nextDueAt = dueAtFromDateInput(editTaskDueDate);

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

    const { data: deletedRows, error } = await deleteTask(task);

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


  const kpiFilterCards: Array<{ label: string; value: number; filter: TaskFilter }> = [
    { label: "Open", value: taskStats.open, filter: "all" },
    { label: "Overdue", value: taskStats.overdue, filter: "overdue" },
    { label: "Escalated", value: taskStats.escalated, filter: "escalated" },
    { label: "Due today", value: taskStats.dueToday, filter: "due_today" },
    { label: "Due soon", value: taskStats.dueSoon, filter: "due_soon" },
    { label: "No due date", value: taskStats.noDueDate, filter: "no_due" },
  ];

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
          {kpiFilterCards.map((card) => {
            const isActive = filter === card.filter;

            return (
              <Button
                key={card.filter}
                type="button"
                variant="secondary"
                onClick={() => setFilter(card.filter)}
                aria-pressed={isActive}
                style={{
                  display: "grid",
                  justifyItems: "start",
                  gap: "var(--space-2)",
                  minHeight: 108,
                  padding: "var(--space-4)",
                  borderRadius: "var(--radius-lg)",
                  borderColor: isActive ? "var(--accent)" : "var(--border)",
                  background: isActive ? "var(--accentSoft)" : "var(--surfaceRaised)",
                  color: "var(--text)",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    color: "var(--mutedText)",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {card.label}
                </span>
                <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{card.value}</span>
              </Button>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
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
