"use client";

import { SectionCard, Badge } from "@/components/ui";
import type { VenueActivity } from "../_lib/types";
import { formatDateTime } from "../_lib/formatters";
import { logVenueActivity } from "../_lib/activity";

type Props = {
  activities: VenueActivity[];
};

function activityLabel(activityType: string) {
  switch (activityType) {
    case "contact_added":
      return "Contact added";
    case "contact_updated":
      return "Contact updated";
    case "contact_deleted":
      return "Contact deleted";
    case "email_sent":
      return "Email sent";
    case "feedback_added":
      return "Feedback added";
    case "venue_updated":
      return "Venue updated";
    default:
      return activityType;
  }
}

export default function VenueActivitySection({ activities }: Props) {
  return (
    <SectionCard title={`Activity (${activities.length})`}>
      <div className="flex flex-col gap-4">
        {activities.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--mutedText)" }}>
            No activity yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activities.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: "rgba(255,255,255,0.01)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <Badge tone="muted">{activityLabel(item.activity_type)}</Badge>

                  <div style={{ fontSize: 12, color: "var(--mutedText)" }}>
                    {formatDateTime(item.created_at)}
                  </div>
                </div>

                {item.summary ? (
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--text)",
                      lineHeight: 1.5,
                    }}
                  >
                    {item.summary}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}