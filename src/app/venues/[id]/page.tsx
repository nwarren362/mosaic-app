"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Page, Card, Button, Input, Textarea, Select, Field } from "@/components/ui";
import { Page, Card, SectionCard, Button, Input, Textarea, Select, Field } from "@/components/ui";

type Venue = {
  id: string;
  agency_id: string;
  name: string;
  city: string | null;
  country: string | null;
  capacity: number | null;
  website: string | null;
  notes: string | null;
  record_owner_id: string | null;
  updated_at: string;
};

type AgencyMembershipRow = {
  user_id: string;
  role: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type AgencyMember = {
  id: string;
  display_name: string | null;
  role: string;
};

function formatUpdatedAt(iso?: string | null) {
  if (!iso) return null;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function memberLabel(member: AgencyMember) {
  const base =
    member.display_name && member.display_name.trim().length > 0
      ? member.display_name.trim()
      : `Member ${member.id.slice(0, 8)}`;

  return member.role === "admin" ? `${base} (Admin)` : base;
}

export default function VenueDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const venueId = params?.id;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [capacity, setCapacity] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [recordOwnerId, setRecordOwnerId] = useState("");

  const canSave = useMemo(() => name.trim().length > 0 && !saving, [name, saving]);
  const updatedAtLabel = formatUpdatedAt(venue?.updated_at);

  useEffect(() => {
    if (!venueId) return;
    void loadVenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  async function loadVenue() {
    setLoading(true);

    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .eq("id", venueId)
      .single();

    if (error || !data) {
      if (error) {
        alert(error.message);
      }
      setVenue(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    const v = data as Venue;

    setVenue(v);
    setName(v.name ?? "");
    setCity(v.city ?? "");
    setCountry(v.country ?? "");
    setCapacity(v.capacity != null ? String(v.capacity) : "");
    setWebsite(v.website ?? "");
    setNotes(v.notes ?? "");
    setRecordOwnerId(v.record_owner_id ?? "");

    await loadMembers(v.agency_id);
    setLoading(false);
  }

  async function loadMembers(agencyId: string) {
    const { data: memberships, error: membershipsError } = await supabase
      .from("agency_memberships")
      .select("user_id, role")
      .eq("agency_id", agencyId);

    if (membershipsError || !memberships) {
      if (membershipsError) {
        console.warn("Failed to load memberships:", membershipsError.message);
      }
      setMembers([]);
      return;
    }

    if (memberships.length === 0) {
      setMembers([]);
      return;
    }

    const membershipRows = memberships as AgencyMembershipRow[];
    const userIds = membershipRows.map((m) => m.user_id);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    if (profilesError || !profiles) {
      if (profilesError) {
        console.warn("Failed to load profiles:", profilesError.message);
      }
      setMembers([]);
      return;
    }

    const profileRows = profiles as ProfileRow[];
    const roleMap = new Map<string, string>();
    membershipRows.forEach((m) => roleMap.set(m.user_id, m.role));

    const mergedMembers: AgencyMember[] = profileRows.map((p) => ({
      id: p.id,
      display_name: p.display_name,
      role: roleMap.get(p.id) ?? "agent",
    }));

    mergedMembers.sort((a, b) => memberLabel(a).localeCompare(memberLabel(b)));

    setMembers(mergedMembers);
  }

  async function handleSave() {
    if (!venue) return;

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      setSaving(false);
      return;
    }

    if (!user) {
      alert("You must be signed in to save changes.");
      setSaving(false);
      return;
    }

    const trimmedName = name.trim();
    const trimmedCity = city.trim();
    const trimmedCountry = country.trim();
    const trimmedWebsite = website.trim();
    const trimmedNotes = notes.trim();
    const trimmedCapacity = capacity.trim();

    const parsedCapacity =
      trimmedCapacity === "" ? null : Number.parseInt(trimmedCapacity, 10);

    if (trimmedCapacity !== "" && Number.isNaN(parsedCapacity)) {
      alert("Capacity must be a whole number.");
      setSaving(false);
      return;
    }

    const payload = {
      name: trimmedName,
      city: trimmedCity || null,
      country: trimmedCountry || null,
      capacity: parsedCapacity,
      website: trimmedWebsite || null,
      notes: trimmedNotes || null,
      record_owner_id: recordOwnerId || null,
      updated_by: user.id,
    };

    const { error } = await supabase.from("venues").update(payload).eq("id", venue.id);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await loadVenue();
    setSaving(false);
  }

  if (loading) {
    return (
      <Page title="Venue details">
        <Card>
          <div style={{ fontSize: 14, color: "var(--mutedText)" }}>Loading venue…</div>
        </Card>
      </Page>
    );
  }

  if (!venue) {
    return (
      <Page title="Venue details">
        <Card>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14 }}>Venue not found.</div>
            <div>
              <Button variant="secondary" onClick={() => router.push("/venues")}>
                Back to venues
              </Button>
            </div>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Venue details">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={() => router.push("/venues")}>
            Back
          </Button>

          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <Card>
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
        </Card>
      </div>
    </Page>
  );
}