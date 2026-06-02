import type { DomainEvent, WorkflowContext } from "./types";
import { handleGigCancelled, handleGigConfirmed } from "./gigWorkflows";
import { saveWorkflowEvent } from "./eventStore";

type WorkflowHandler = (context: WorkflowContext, event: DomainEvent) => Promise<void>;

const handlers: WorkflowHandler[] = [
  handleGigCancelled,
  handleGigConfirmed,
];

export async function dispatchDomainEvent(context: WorkflowContext, event: DomainEvent) {
  const failures: Error[] = [];
  let storedEventId: string | null = null;

  try {
    const storedEvent = await saveWorkflowEvent(context, event);
    storedEventId = storedEvent.id;
  } catch (error) {
    console.error("Failed to persist workflow event", error);

    return {
      ok: false,
      failures: [error instanceof Error ? error : new Error(String(error))],
      workflowEventId: storedEventId,
    };
  }

  const eventWithPersistenceMetadata: DomainEvent = {
    ...event,
    metadata: {
      ...event.metadata,
      workflow_event_id: storedEventId,
    },
  };

  for (const handler of handlers) {
    try {
      await handler(context, eventWithPersistenceMetadata);
    } catch (error) {
      failures.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  if (failures.length > 0) {
    console.warn("One or more workflow handlers failed", {
      event: eventWithPersistenceMetadata,
      failures: failures.map((failure) => failure.message),
    });
  }

  return {
    ok: failures.length === 0,
    failures,
    workflowEventId: storedEventId,
  };
}
