"use client";

import { useState } from "react";
import { Map, MapPin } from "lucide-react";
import { SectionCard, Field, Input, Select, Textarea, IconButton } from "@/components/ui";
import type { AgencyMember } from "../_lib/types";

type Props = {
  name: string;
  setName: (value: string) => void;
  displayAddress: string;
  setDisplayAddress: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  postcode: string;
  setPostcode: (value: string) => void;
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

function ownerLabel(member: AgencyMember) {
  const candidate = member as AgencyMember & {
    email?: string | null;
    name?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    profile?: {
      email?: string | null;
      name?: string | null;
      full_name?: string | null;
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  };

  const profile = candidate.profile;
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();

  return (
    fullName ||
    profile?.full_name ||
    profile?.display_name ||
    profile?.name ||
    candidate.full_name ||
    candidate.display_name ||
    candidate.name ||
    profile?.email ||
    candidate.email ||
    member.id
  );
}

export default function VenueDetailsSection({
  name,
  setName,
  displayAddress,
  setDisplayAddress,
  city,
  setCity,
  postcode,
  setPostcode,
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
  const [showLocationFields, setShowLocationFields] = useState(false);

  const trimmedDisplayAddress = displayAddress.trim();

  const generatedGoogleMapsUrl = trimmedDisplayAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedDisplayAddress)}`
    : "";

  const effectiveGoogleMapsUrl = googleMapsUrl.trim() || generatedGoogleMapsUrl;

  return (
    <SectionCard title="Venue details">
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Venue name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Venue name"
            />
          </Field>

          <Field label="Record owner">
            <Select
              value={recordOwnerId}
              onChange={(e) => setRecordOwnerId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m, index) => {
                const candidate = m as AgencyMember & {
                  user_id?: string | null;
                  id?: string | null;
                };

                const value = candidate.user_id || candidate.id || "";

                if (!value) return null;

                return (
                  <option key={`${value}-${index}`} value={value}>
                    {ownerLabel(m)}
                  </option>
                );
              })}
            </Select>
          </Field>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "var(--space-4)",
            display: "grid",
            gap: "var(--space-3)",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "20px 1fr auto",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <MapPin
              size={16}
              aria-hidden="true"
              style={{
                color: "var(--mutedText)",
                flexShrink: 0,
              }}
            />

            <Input
              value={displayAddress}
              onChange={(e) => setDisplayAddress(e.target.value)}
              placeholder="Venue address"
            />

            <IconButton
              label="Edit location fields"
              variant={showLocationFields ? "primary" : "secondary"}
              type="button"
              onClick={() => setShowLocationFields((value) => !value)}
            >
              <Map size={16} />
            </IconButton>
          </div>

          {showLocationFields ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="City">
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </Field>

              <Field label="Postcode">
                <Input
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="Postcode"
                />
              </Field>

              <Field label="Country">
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                />
              </Field>
            </div>
          ) : null}

          <Field label="Google Maps URL">
            <Input
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </Field>

          {effectiveGoogleMapsUrl ? (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <a
                href={effectiveGoogleMapsUrl}
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
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "var(--space-4)",
            display: "grid",
            gap: "var(--space-4)",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Capacity">
              <Input
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Capacity"
                inputMode="numeric"
              />
            </Field>

            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Website"
            />
          </div>
        </div>

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
