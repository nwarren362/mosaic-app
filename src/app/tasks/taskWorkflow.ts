import type { TaskRow } from "./taskTypes";
import { toDateInputValue } from "./taskFilters";

export const ESCALATION_LEVEL_OVERDUE_7_DAYS = "overdue_7_days";

export function shouldEscalateOverdueTask(task: TaskRow) {
  return (
    !task.completed_at &&
    !task.is_escalated &&
    !hasDeclinedManualEscalationForDueDate(task) &&
    (task.overdue_days ?? 0) > 7
  );
}

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function overdueEscalationCutoff() {
  const date = startOfToday();
  date.setDate(date.getDate() - 7);
  return date;
}

export function shouldRemainEscalatedForDueDate(dueAt: string | null) {
  if (!dueAt) return false;

  const dueDate = new Date(dueAt);
  return !Number.isNaN(dueDate.getTime()) && dueDate < overdueEscalationCutoff();
}

export function taskEscalationDeclinedDueAt(task: TaskRow) {
  const metadata = task.metadata;

  if (!metadata || typeof metadata !== "object") return null;

  const declinedDueAt = metadata.manual_escalation_declined_for_due_at;
  return typeof declinedDueAt === "string" ? declinedDueAt : null;
}

export function hasDeclinedManualEscalationForDueDate(task: TaskRow) {
  return Boolean(task.due_at && taskEscalationDeclinedDueAt(task) === task.due_at);
}

export function shouldPromptForManualEscalation(task: TaskRow, nextDueAt: string | null) {
  if (!nextDueAt || task.completed_at || task.is_escalated) return false;

  const dueDateChanged =
    toDateInputValue(task.due_at) !== toDateInputValue(nextDueAt);
  if (!dueDateChanged) return false;

  return shouldRemainEscalatedForDueDate(nextDueAt);
}

export function dueAtFromDateInput(dateInputValue: string) {
  return dateInputValue ? new Date(`${dateInputValue}T12:00:00`).toISOString() : null;
}

export function mergeTaskMetadata(
  metadata: Record<string, unknown> | null,
  values: Record<string, unknown>,
) {
  return {
    ...(metadata ?? {}),
    ...values,
  };
}

export function editTaskMetadata(
  task: TaskRow,
  nextDueAt: string | null,
  flagAsEscalated: boolean,
) {
  const shouldClearEscalation =
    task.is_escalated && !shouldRemainEscalatedForDueDate(nextDueAt);

  const metadata = shouldClearEscalation
    ? mergeTaskMetadata(task.metadata, { manual_escalation_declined_for_due_at: null })
    : flagAsEscalated
      ? mergeTaskMetadata(task.metadata, { manual_escalation_declined_for_due_at: null })
      : shouldPromptForManualEscalation(task, nextDueAt)
        ? mergeTaskMetadata(task.metadata, { manual_escalation_declined_for_due_at: nextDueAt })
        : task.metadata;

  return { metadata, shouldClearEscalation };
}

export function overdueEscalationMetadata(task: TaskRow) {
  return {
    original_task_id: task.id,
    original_task_summary: task.summary,
    original_entity_type: task.entity_type,
    original_entity_id: task.entity_id,
    assigned_to: task.assigned_to,
    due_at: task.due_at,
    created_at: task.created_at,
    escalation_reason: "Task is more than 7 days overdue.",
  };
}

export function manualEscalationMetadata(
  task: TaskRow,
  assignedTo: string,
  nextDueAt: string | null,
) {
  return {
    original_task_id: task.id,
    original_task_summary: task.summary,
    original_entity_type: task.entity_type,
    original_entity_id: task.entity_id,
    assigned_to: assignedTo,
    due_at: nextDueAt,
    created_at: task.created_at,
    escalation_reason: "User confirmed manual escalation during task edit.",
  };
}
