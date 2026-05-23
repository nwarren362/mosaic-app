import { supabase } from "@/lib/supabaseClient";
import type { Venue } from "./types";

type LogVenueActivityArgs = {
  venue: Venue;
  activityType: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

function mapVenueActivityType(activityType: string) {
  if (activityType.includes("status")) return "status_change";
  if (activityType.includes("feedback")) return "feedback";
  return "system";
}

export async function logVenueActivity({
  venue,
  activityType,
  summary,
  metadata = null,
}: LogVenueActivityArgs) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("logVenueActivity: failed to get current user", userError);
    return false;
  }

  const { error } = await supabase.from("activity_log").insert({
    agency_id: venue.agency_id,
    entity_type: "venue",
    entity_id: venue.id,
    activity_type: mapVenueActivityType(activityType),
    summary,
    metadata: {
      legacy_activity_type: activityType,
      ...(metadata ?? {}),
    },
    created_by: user?.id ?? null,
  });

  if (error) {
    console.error("logVenueActivity: failed to insert shared activity", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      venueId: venue.id,
      agencyId: venue.agency_id,
      actorId: user?.id ?? null,
      activityType,
      summary,
      metadata,
    });
    return false;
  }

  return true;
}