
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Page, Card, Button, Input, Textarea, Select } from "@/components/ui";

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
};

type AgencyMember = {
  id: string;
  display_name: string | null;
  role: string;
};

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
  const [country, setCountry] = useState("UK");
  const [capacity, setCapacity] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [recordOwnerId, setRecordOwnerId] = useState("");

  const canSave = useMemo(() => name.trim().length > 0 && !saving, [name, saving]);

  useEffect(() => {
    if (!venueId) return;
    loadVenue();
  }, [venueId]);

  async function loadVenue() {
    setLoading(true);

    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .eq("id", venueId)
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const v = data as Venue;
    setVenue(v);

    setName(v.name ?? "");
    setCity(v.city ?? "");
    setCountry(v.country ?? "UK");
    setCapacity(v.capacity ? String(v.capacity) : "");
    setWebsite(v.website ?? "");
    setNotes(v.notes ?? "");
    setRecordOwnerId(v.record_owner_id ?? "");

    await loadMembers(v.agency_id);

    setLoading(false);
  }

  async function loadMembers(agencyId: string) {
    const { data: memberships } = await supabase
      .from("agency_memberships")
      .select("user_id, role")
      .eq("agency_id", agencyId);

    if (!memberships) return;

    const userIds = memberships.map((m: any) => m.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    if (!profiles) return;

    const roleMap = new Map<string, string>();
    memberships.forEach((m: any) => roleMap.set(m.user_id, m.role));

    const mapped = profiles.map((p: any) => ({
      id: p.id,
      display_name: p.display_name,
      role: roleMap.get(p.id) ?? "agent",
    }));

    setMembers(mapped);
  }

  async function handleSave() {
    if (!venue) return;

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const payload = {
      name,
      city: city || null,
      country,
      capacity: capacity ? Number(capacity) : null,
      website: website || null,
      notes: notes || null,
      record_owner_id: recordOwnerId || null,
      updated_by: user.id,
    };

    const { error } = await supabase
      .from("venues")
      .update(payload)
      .eq("id", venue.id);

    if (error) {
      alert(error.message);
    } else {
      await loadVenue();
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <Page title="Venue">
        <Card>
          <div className="p-4 text-sm opacity-70">Loading…</div>
        </Card>
      </Page>
    );
  }

  if (!venue) {
    return (
      <Page title="Venue">
        <Card>
          <div className="p-4 text-sm opacity-70">Venue not found.</div>
        </Card>
      </Page>
    );
  }

  return (
    <Page title={name || "Venue"}>
      <div className="space-y-4">

        <div className="flex items-center">
          <Button onClick={() => router.push("/venues")}>Back</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">

          <Card>
            <div className="p-4 space-y-3">
              <div className="text-sm font-medium opacity-80">Venue details</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Venue name" />
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-3">
              <div className="text-sm font-medium opacity-80">Capacity & web</div>
              <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity" />
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" />
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-3">
              <div className="text-sm font-medium opacity-80">Relationship manager</div>

              <Select
                value={recordOwnerId}
                onChange={(e) => setRecordOwnerId(e.target.value)}
              >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.display_name ?? "Unnamed user") +
                        (m.role === "admin" ? " (Admin)" : "")}
                    </option>
                  ))}
              </Select>
            </div>
          </Card>

          <Card className="md:col-span-2">
            <div className="p-4 space-y-3">
              <div className="text-sm font-medium opacity-80">Notes</div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes"
                style={{ minHeight: 140, resize: "vertical" }}
              />
            </div>
          </Card>

        </div>

        <div className="md:hidden sticky bottom-3">
          <div className="rounded-xl border border-white/10 bg-black/60 backdrop-blur p-3">
            <Button onClick={handleSave} disabled={!canSave} className="w-full">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

      </div>
    </Page>
  );
}
