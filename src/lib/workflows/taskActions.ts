import type { CompleteTaskInput, CreateActivityInput, CreateTaskInput, WorkflowContext } from "./types";

function buildCompletedTaskNotes(existingNotes: string | null, completionNote: string | null) {
  const trimmedCompletionNote = completionNote?.trim();
  const originalNotes = existingNotes?.trim() ?? "";

  if (!trimmedCompletionNote) {
    return originalNotes || null;
  }

  return [
    `Completed ${new Date().toLocaleDateString("en-GB")}`,
    "--------------------------------",
    trimmedCompletionNote,
    originalNotes
      ? ["", "--------------------------------", "Original task notes:", originalNotes].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function createTask({ supabase }: WorkflowContext, input: CreateTaskInput) {
  const { data, error } = await supabase
    .from("activity_log")
    .insert({
      agency_id: input.agencyId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      activity_type: "task",
      summary: input.summary,
      notes: input.notes ?? null,
      due_at: input.dueAt ?? null,
      assigned_to: input.assignedTo,
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  return data;
}

export async function createActivityEntry(
  { supabase }: WorkflowContext,
  input: CreateActivityInput
) {
  const { data, error } = await supabase
    .from("activity_log")
    .insert({
      agency_id: input.agencyId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      activity_type: input.activityType,
      summary: input.summary,
      notes: input.notes ?? null,
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create activity entry: ${error.message}`);
  }

  return data;
}

export async function completeTask({ supabase }: WorkflowContext, input: CompleteTaskInput) {
  const { data: existingTask, error: loadError } = await supabase
    .from("activity_log")
    .select("id, notes")
    .eq("id", input.taskId)
    .eq("agency_id", input.agencyId)
    .eq("activity_type", "task")
    .single();

  if (loadError) {
    throw new Error(`Failed to load task: ${loadError.message}`);
  }

  const completedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("activity_log")
    .update({
      completed_at: completedAt,
      notes: buildCompletedTaskNotes(existingTask.notes, input.completionNote ?? null),
      metadata: {
        completed_by: input.completedBy,
      },
    })
    .eq("id", input.taskId)
    .eq("agency_id", input.agencyId)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to complete task: ${error.message}`);
  }

  return data;
}
