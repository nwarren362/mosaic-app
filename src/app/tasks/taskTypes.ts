export type TaskEntityType = "artist" | "venue" | "gig" | "contact" | "workflow";

export type TaskFilter =
  | "all"
  | "escalated"
  | "overdue"
  | "due_today"
  | "due_soon"
  | "no_due";

export type TaskOwnerFilter = "mine" | "agency" | string;

export type TaskRow = {
  id: string;
  agency_id: string;
  entity_type: TaskEntityType;
  entity_id: string;
  summary: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  assigned_to: string;
  metadata: Record<string, unknown> | null;
  escalated_at: string | null;
  escalation_level: string | null;
  escalation_workflow_event_id: string | null;
  is_overdue: boolean;
  is_due_today: boolean;
  is_due_soon: boolean;
  is_escalated: boolean;
  overdue_days: number | null;
};

export type ArtistLookupRow = {
  id: string;
  name: string;
};

export type VenueLookupRow = {
  id: string;
  name: string;
};

export type GigLookupRow = {
  id: string;
  title: string | null;
  artists: { name: string } | null;
};

export type AgencyMemberLookupRow = {
  user_id: string;
  display_name: string;
  role?: string | null;
};

export type TaskGroup = {
  label: string;
  tasks: TaskRow[];
};