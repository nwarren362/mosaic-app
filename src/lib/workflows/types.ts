import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkflowEntityType = "artist" | "venue" | "gig" | "task" | "workflow";

export type WorkflowEventType =
  | "gig.created"
  | "gig.updated"
  | "gig.confirmed"
  | "gig.cancelled"
  | "task.created"
  | "task.completed"
  | "task.reassigned";

export type WorkflowActor = {
  userId: string;
};

export type WorkflowContext = {
  supabase: SupabaseClient;
  agencyId: string;
  actor: WorkflowActor;
};

export type DomainEvent<TMetadata extends Record<string, unknown> = Record<string, unknown>> = {
  type: WorkflowEventType;
  agencyId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  actorUserId: string;
  occurredAt: string;
  metadata: TMetadata;
};

export type CreateTaskInput = {
  agencyId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  summary: string;
  notes?: string | null;
  dueAt?: string | null;
  assignedTo: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
};

export type CreateActivityInput = {
  agencyId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  activityType: string;
  summary: string;
  notes?: string | null;
  createdBy: string;
  metadata?: Record<string, unknown>;
};

export type CompleteTaskInput = {
  taskId: string;
  agencyId: string;
  completedBy: string;
  completionNote?: string | null;
};
