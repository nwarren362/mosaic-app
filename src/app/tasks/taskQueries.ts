import { supabase } from "@/lib/supabaseClient";
import { createDomainEvent, dispatchDomainEvent } from "@/lib/workflows";

import type {
  AgencyMemberLookupRow,
  ArtistLookupRow,
  GigLookupRow,
  TaskOwnerFilter,
  TaskRow,
  VenueLookupRow,
} from "./taskTypes";

import {
  isAgencyOwnerFilter,
  isMineOwnerFilter,
  canUseManagerTaskView,
  buildCompletedTaskNotes,
} from "./taskFilters";

import {
  ESCALATION_LEVEL_OVERDUE_7_DAYS,
  manualEscalationMetadata,
  overdueEscalationMetadata,
  shouldEscalateOverdueTask,
} from "./taskWorkflow";

export async function getSignedInUser() {
  return supabase.auth.getUser();
}

export async function fetchOpenTasks(agencyId: string, ownerFilter: TaskOwnerFilter, userId: string) {
  let taskQuery = supabase
    .from("task_status_view")
    .select(
      "id, agency_id, entity_type, entity_id, summary, notes, due_at, completed_at, created_at, assigned_to, metadata, escalated_at, escalation_level, escalation_workflow_event_id, is_overdue, is_due_today, is_due_soon, is_escalated, overdue_days"
    )
    .eq("agency_id", agencyId)
    .is("completed_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (isMineOwnerFilter(ownerFilter)) {
    taskQuery = taskQuery.eq("assigned_to", userId);
  } else if (!isAgencyOwnerFilter(ownerFilter)) {
    taskQuery = taskQuery.eq("assigned_to", ownerFilter);
  }

  const { data, error } = await taskQuery;

  return {
    data: data as TaskRow[] | null,
    error,
  };
}

export async function fetchAgencyMembersForTasks(agencyId: string, currentUserId: string) {
  const { data: membershipRows, error: membershipError } = await supabase
    .from("agency_memberships")
    .select("user_id, role")
    .eq("agency_id", agencyId);

  if (membershipError || !membershipRows) {
    if (membershipError) {
      console.warn("Failed to load agency memberships for task filters:", membershipError.message);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return {
      members: [
        {
          user_id: currentUserId,
          display_name: user?.email ?? "Me",
          role: null,
        },
      ] as AgencyMemberLookupRow[],
      canManageAgencyTasks: false,
    };
  }

  const userIds = Array.from(
    new Set(
      membershipRows
        .map((membership) => membership.user_id as string | null)
        .filter((userId): userId is string => Boolean(userId))
    )
  );

  if (!userIds.includes(currentUserId)) {
    userIds.unshift(currentUserId);
  }

  const roleByUserId = new Map(
    (membershipRows ?? []).map((membership) => [
      membership.user_id as string,
      membership.role as string | null,
    ])
  );

  const currentUserRole = roleByUserId.get(currentUserId) ?? null;
  const canManageAgencyTasks = canUseManagerTaskView(currentUserRole);

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  if (profileError) {
    console.warn("Failed to load task assignee profiles:", profileError.message);
  }

  const profileById = new Map(
    (profileRows ?? []).map((profile) => [
      profile.id as string,
      {
        full_name: profile.full_name as string | null,
      },
    ])
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const members = userIds
    .map((userId) => {
      const profile = profileById.get(userId);
      const displayName =
        profile?.full_name?.trim() ||
        (userId === currentUserId ? user?.email ?? "Me" : "Unknown agent");

      return {
        user_id: userId,
        display_name: userId === currentUserId ? `${displayName} (me)` : displayName,
        role: roleByUserId.get(userId) ?? null,
      };
    })
    .sort((a, b) => {
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      return a.display_name.localeCompare(b.display_name);
    });

  return { members, canManageAgencyTasks };
}

export async function fetchTaskEntityLabels(loadedTasks: TaskRow[], agencyId: string) {
  const artistIds = loadedTasks
    .filter((task) => task.entity_type === "artist")
    .map((task) => task.entity_id);

  const venueIds = loadedTasks
    .filter((task) => task.entity_type === "venue")
    .map((task) => task.entity_id);

  const gigIds = loadedTasks
    .filter((task) => task.entity_type === "gig")
    .map((task) => task.entity_id);

  const [artistResult, venueResult, gigResult] = await Promise.all([
    artistIds.length > 0
      ? supabase.from("artists").select("id, name").eq("agency_id", agencyId).in("id", artistIds)
      : Promise.resolve({ data: [], error: null }),
    venueIds.length > 0
      ? supabase.from("venues").select("id, name").eq("agency_id", agencyId).in("id", venueIds)
      : Promise.resolve({ data: [], error: null }),
    gigIds.length > 0
      ? supabase
          .from("gigs")
          .select("id, title, artists:artists(name)")
          .eq("agency_id", agencyId)
          .in("id", gigIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (artistResult.error) console.warn("Failed to load artist task labels:", artistResult.error.message);
  if (venueResult.error) console.warn("Failed to load venue task labels:", venueResult.error.message);
  if (gigResult.error) console.warn("Failed to load gig task labels:", gigResult.error.message);

  const labels: Record<string, string> = {};

  for (const artist of (artistResult.data ?? []) as ArtistLookupRow[]) {
    labels[`artist:${artist.id}`] = artist.name;
  }

  for (const venue of (venueResult.data ?? []) as VenueLookupRow[]) {
    labels[`venue:${venue.id}`] = venue.name;
  }

  for (const gig of (gigResult.data ?? []) as unknown as GigLookupRow[]) {
    labels[`gig:${gig.id}`] = gig.title?.trim() || gig.artists?.name || "Untitled gig";
  }

  return labels;
}

async function hasTaskAlreadyBeenEscalated(agencyId: string, taskId: string) {
  const { data, error } = await supabase
    .from("workflow_events")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("event_type", "task.escalated")
    .contains("metadata", { original_task_id: taskId })
    .limit(1);

  if (error) {
    console.warn("Failed to check task escalation history:", error.message);
    return true;
  }

  return (data ?? []).length > 0;
}

export async function escalateOverdueTasks(
  loadedTasks: TaskRow[],
  agencyId: string,
  actorUserId: string
) {
  const candidates = loadedTasks.filter(shouldEscalateOverdueTask);
  let escalatedCount = 0;

  for (const task of candidates) {
    const alreadyEscalated = await hasTaskAlreadyBeenEscalated(agencyId, task.id);
    if (alreadyEscalated) continue;

    const event = createDomainEvent({
      type: "task.escalated",
      agencyId,
      entityType: "task",
      entityId: task.id,
      actorUserId,
      metadata: overdueEscalationMetadata(task),
    });

    const workflowResult = await dispatchDomainEvent(
      {
        supabase,
        agencyId,
        actor: { userId: actorUserId },
      },
      event
    );

    if (workflowResult.ok) {
      const escalatedAt = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("activity_log")
        .update({
          escalated_at: escalatedAt,
          escalation_level: ESCALATION_LEVEL_OVERDUE_7_DAYS,
          escalation_workflow_event_id: workflowResult.workflowEventId,
        })
        .eq("id", task.id)
        .eq("agency_id", agencyId);

      if (updateError) {
        console.warn("Failed to mark task as escalated:", updateError.message);
      } else {
        task.escalated_at = escalatedAt;
        task.escalation_level = ESCALATION_LEVEL_OVERDUE_7_DAYS;
        task.escalation_workflow_event_id = workflowResult.workflowEventId;
        task.is_escalated = true;
      }

      escalatedCount += 1;
    } else {
      console.warn("Task escalation workflow did not complete cleanly", workflowResult.failures);
    }
  }

  return escalatedCount;
}

export async function completeTask(task: TaskRow, completionNote: string) {
  const completedAt = new Date().toISOString();

  return supabase
    .from("activity_log")
    .update({
      completed_at: completedAt,
      notes: buildCompletedTaskNotes(task.notes, completionNote),
    })
    .eq("id", task.id)
    .eq("agency_id", task.agency_id)
    .select("id");
}

export async function createManualTaskEscalation(task: TaskRow, actorUserId: string, assignedTo: string, nextDueAt: string | null) {
  const event = createDomainEvent({
    type: "task.escalated",
    agencyId: task.agency_id,
    entityType: "task",
    entityId: task.id,
    actorUserId,
    metadata: manualEscalationMetadata(task, assignedTo, nextDueAt),
  });

  const workflowResult = await dispatchDomainEvent(
    {
      supabase,
      agencyId: task.agency_id,
      actor: { userId: actorUserId },
    },
    event,
  );

  if (!workflowResult.ok) {
    console.warn("Task escalation workflow did not complete cleanly", workflowResult.failures);
    return null;
  }

  return workflowResult.workflowEventId;
}

export async function updateTask(task: TaskRow, updatePayload: Record<string, unknown>) {
  return supabase
    .from("activity_log")
    .update(updatePayload)
    .eq("id", task.id)
    .eq("agency_id", task.agency_id)
    .select("id");
}

export async function deleteTask(task: TaskRow) {
  return supabase
    .from("activity_log")
    .delete()
    .eq("id", task.id)
    .eq("agency_id", task.agency_id)
    .select("id");
}
