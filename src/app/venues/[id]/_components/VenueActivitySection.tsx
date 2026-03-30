"use client";

import { SectionCard } from "@/components/ui";

export default function VenueActivitySection() {
  return (
    <SectionCard title="Activity">
      <div style={{ fontSize: 14, color: "var(--mutedText)" }}>
        No activity yet.
      </div>
    </SectionCard>
  );
}