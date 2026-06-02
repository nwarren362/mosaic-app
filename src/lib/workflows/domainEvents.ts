import type { DomainEvent, WorkflowEntityType, WorkflowEventType } from "./types";

export function createDomainEvent<TMetadata extends Record<string, unknown> = Record<string, unknown>>({
  type,
  agencyId,
  entityType,
  entityId,
  actorUserId,
  metadata,
}: {
  type: WorkflowEventType;
  agencyId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  actorUserId: string;
  metadata?: TMetadata;
}): DomainEvent<TMetadata> {
  return {
    type,
    agencyId,
    entityType,
    entityId,
    actorUserId,
    occurredAt: new Date().toISOString(),
    metadata: (metadata ?? {}) as TMetadata,
  };
}

export function isGigEvent(event: DomainEvent) {
  return event.entityType === "gig" || event.type.startsWith("gig.");
}

export function isTaskEvent(event: DomainEvent) {
  return event.entityType === "task" || event.type.startsWith("task.");
}
