import type { TaskEntityType, TaskFilter, TaskOwnerFilter, TaskRow } from "./taskTypes";

export function formatDate(value: string | null) {
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

export function toDateInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

export function isEscalatedTask(task: TaskRow) {
  return task.is_escalated;
}

export function taskDueTone(task: TaskRow) {
  if (task.completed_at) return "muted";
  if (!task.due_at) return "muted";
  if (task.is_overdue) return "danger";

  return "warning";
}

export function isOverdue(task: TaskRow) {
  return task.is_overdue;
}

export function isDueToday(task: TaskRow) {
  return task.is_due_today;
}

export function isDueSoon(task: TaskRow) {
  return task.is_due_soon;
}

export function taskDueLabel(task: TaskRow) {
  if (task.completed_at) return "Completed";
  if (!task.due_at) return "No due date";
  if (isEscalatedTask(task) && isOverdue(task)) {
    return `Escalated · Overdue · ${formatDate(task.due_at)}`;
  }
  if (isOverdue(task)) return `Overdue · ${formatDate(task.due_at)}`;
  if (isDueToday(task)) return "Due today";
  if (isDueSoon(task)) return `Due soon · ${formatDate(task.due_at)}`;

  return `Due ${formatDate(task.due_at)}`;
}

export function entityHref(task: TaskRow) {
  if (task.entity_type === "artist") return `/artists/${task.entity_id}#activity`;
  if (task.entity_type === "venue") return `/venues/${task.entity_id}#activity`;
  if (task.entity_type === "gig") return `/gigs/${task.entity_id}#activity`;
  return null;
}

export function entityLabel(entityType: TaskEntityType) {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1);
}

export function taskEntityKey(task: TaskRow) {
  return `${task.entity_type}:${task.entity_id}`;
}

export function notesPreview(notes: string | null) {
  const normalized = notes?.replace(/\s+/g, " ").trim();

  if (!normalized) return null;

  return normalized.length > 110 ? `${normalized.slice(0, 110)}…` : normalized;
}

export function buildCompletedTaskNotes(existingNotes: string | null, completionNote: string) {
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

export function taskMatchesFilter(task: TaskRow, filter: TaskFilter) {
  if (filter === "escalated") return isEscalatedTask(task);
  if (filter === "overdue") return isOverdue(task);
  if (filter === "due_today") return isDueToday(task);
  if (filter === "due_soon") return isDueSoon(task);
  if (filter === "no_due") return !task.due_at;
  return true;
}

function taskUrgencyRank(task: TaskRow) {
  if (isEscalatedTask(task)) return 0;
  if (isOverdue(task)) return 1;
  if (isDueToday(task)) return 2;
  if (isDueSoon(task)) return 3;
  if (!task.due_at) return 5;
  return 4;
}

export function taskUrgencyGroupLabel(task: TaskRow) {
  if (isEscalatedTask(task)) return "Escalated";
  if (isOverdue(task)) return "Overdue";
  if (isDueToday(task)) return "Due today";
  if (isDueSoon(task)) return "Due soon";
  if (!task.due_at) return "No due date";
  return "Later";
}

export function compareTasksByUrgency(a: TaskRow, b: TaskRow) {
  const urgencyDifference = taskUrgencyRank(a) - taskUrgencyRank(b);
  if (urgencyDifference !== 0) return urgencyDifference;

  const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;

  if (aDue !== bDue) return aDue - bDue;

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function isAgencyOwnerFilter(value: TaskOwnerFilter) {
  return value === "agency";
}

export function isMineOwnerFilter(value: TaskOwnerFilter) {
  return value === "mine";
}

export function possessiveName(name: string) {
  return name.endsWith("s") ? `${name}' tasks` : `${name}'s tasks`;
}

export function canUseManagerTaskView(role?: string | null) {
  return ["agency_admin", "admin", "manager", "owner"].includes(role ?? "");
}
