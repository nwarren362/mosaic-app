import type { DomainEvent, WorkflowContext } from "./types";
import { createActivityEntry, createTask } from "./taskActions";

export async function handleGigCancelled(context: WorkflowContext, event: DomainEvent) {
  if (event.type !== "gig.cancelled") return;

  await createActivityEntry(context, {
    agencyId: event.agencyId,
    entityType: "gig",
    entityId: event.entityId,
    activityType: "system",
    summary: "Gig cancelled.",
    createdBy: event.actorUserId,
    metadata: {
      event_type: event.type,
      occurred_at: event.occurredAt,
      ...event.metadata,
    },
  });

  await createTask(context, {
    agencyId: event.agencyId,
    entityType: "gig",
    entityId: event.entityId,
    summary: "Notify relevant parties about gig cancellation",
    notes: "Confirm that artist, venue and any relevant contacts have been informed.",
    dueAt: new Date().toISOString(),
    assignedTo: event.actorUserId,
    createdBy: event.actorUserId,
    metadata: {
      event_type: event.type,
      occurred_at: event.occurredAt,
      due_reason: "Cancellation notifications should be handled immediately.",
      ...event.metadata,
    },
  });
}

export async function handleGigConfirmed(context: WorkflowContext, event: DomainEvent) {
  if (event.type !== "gig.confirmed") return;

  await createActivityEntry(context, {
    agencyId: event.agencyId,
    entityType: "gig",
    entityId: event.entityId,
    activityType: "system",
    summary: "Gig confirmed.",
    createdBy: event.actorUserId,
    metadata: {
      event_type: event.type,
      occurred_at: event.occurredAt,
      ...event.metadata,
    },
  });

  await createTask(context, {
    agencyId: event.agencyId,
    entityType: "gig",
    entityId: event.entityId,
    summary: "Confirm all parties have final gig details",
    notes: "Check that the artist, venue and relevant contacts have the final confirmed gig details.",
    dueAt: new Date().toISOString(),
    assignedTo: event.actorUserId,
    createdBy: event.actorUserId,
    metadata: {
      event_type: event.type,
      occurred_at: event.occurredAt,
      due_reason: "Confirmed gig details should be checked promptly.",
      ...event.metadata,
    },
  });
}
