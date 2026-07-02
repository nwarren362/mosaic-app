import type { DomainEvent, WorkflowContext, WorkflowEntityType } from "./types";
import { createActivityEntry } from "./taskActions";

function getStringMetadata(event: DomainEvent, key: string) {
  const value = event.metadata[key];
  return typeof value === "string" ? value : null;
}

export async function handleTaskEscalated(context: WorkflowContext, event: DomainEvent) {
  if (event.type !== "task.escalated") return;

  const originalEntityType =
    (getStringMetadata(event, "original_entity_type") as WorkflowEntityType | null) ??
    event.entityType;
  const originalEntityId = getStringMetadata(event, "original_entity_id") ?? event.entityId;
  const originalTaskSummary = getStringMetadata(event, "original_task_summary") ?? "task";

  await createActivityEntry(context, {
    agencyId: event.agencyId,
    entityType: originalEntityType,
    entityId: originalEntityId,
    activityType: "system",
    summary: `Task escalated: ${originalTaskSummary}.`,
    createdBy: event.actorUserId,
    metadata: {
      event_type: event.type,
      occurred_at: event.occurredAt,
      ...event.metadata,
    },
  });
}