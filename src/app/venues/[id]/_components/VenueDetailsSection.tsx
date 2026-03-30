"use client";

import { SectionCard, Field, Input, Select, Textarea } from "@/components/ui";
import type { AgencyMember } from "../_lib/types";
import { memberLabel } from "../_lib/formatters";

type Props = {
  name: string;
  setName: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  capacity: string;
  setCapacity: (value: string) => void;
  website: string;
  setWebsite: (value: string) => void;
  recordOwnerId: string;
  setRecordOwnerId: (value: string) => void;
  googleMapsUrl: string;
  setGoogleMapsUrl: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  members: AgencyMember[];
  updatedAtLabel: string | null;
};

export default function VenueDetailsSection({
  name,
  setName,
  city,
  setCity,
  country,
  setCountry,
  capacity,
  setCapacity,
  website,
  setWebsite,
  recordOwnerId,
  setRecordOwnerId,
  googleMapsUrl,
  setGoogleMapsUrl,
  notes,
  setNotes,
  members,
  updatedAtLabel,
}: Props) {
  return (
    <SectionCard title="Venue details">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Venue name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Venue name"
            />
          </Field>

          <Field label="City">
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
            />
          </Field>

          <Field label="Country">
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
            />
          </Field>

          <Field label="Capacity">
            <Input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Capacity"
              inputMode="numeric"
            />
          </Field>

          <Field label="Website">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Website"
            />
          </Field>

          <Field label="Record owner">
            <Select
              value={recordOwnerId}
              onChange={(e) => setRecordOwnerId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Google Maps URL">
          <Input
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            placeholder="https://maps.google.com/..."
          />
        </Field>

        {googleMapsUrl.trim() ? (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 13,
                color: "var(--mutedText)",
                textDecoration: "underline",
              }}
            >
              Open map in Google Maps
            </a>
          </div>
        ) : null}

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            style={{ minHeight: 140, resize: "vertical" }}
          />
        </Field>

        {updatedAtLabel ? (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 12, color: "var(--mutedText)" }}>
              Updated {updatedAtLabel}
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}