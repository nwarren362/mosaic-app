import type { DomainEvent, WorkflowContext } from "./types";

export type StoredWorkflowEvent = {
  id: string;
  agency_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_user_id: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function saveWorkflowEvent(
  { supabase }: WorkflowContext,
  event: DomainEvent
) {
  const { data, error } = await supabase
    .from("workflow_events")
    .insert({
      agency_id: event.agencyId,
      event_type: event.type,
      entity_type: event.entityType,
      entity_id: event.entityId,
      actor_user_id: event.actorUserId,
      occurred_at: event.occurredAt,
      metadata: event.metadata ?? {},
    })
    .select(
      "id, agency_id, event_type, entity_type, entity_id, actor_user_id, occurred_at, metadata, created_at"
    )
    .single();

  if (error) {
    throw new Error(`Failed to save workflow event: ${error.message}`);
  }

  return data as StoredWorkflowEvent;
}

export async function loadWorkflowEvent(
  { supabase }: WorkflowContext,
  {
    agencyId,
    eventId,
  }: {
    agencyId: string;
    eventId: string;
  }
) {
  const { data, error } = await supabase
    .from("workflow_events")
    .select(
      "id, agency_id, event_type, entity_type, entity_id, actor_user_id, occurred_at, metadata, created_at"
    )
    .eq("agency_id", agencyId)
    .eq("id", eventId)
    .single();

  if (error) {
    throw new Error(`Failed to load workflow event: ${error.message}`);
  }

  return data as StoredWorkflowEvent;
}
