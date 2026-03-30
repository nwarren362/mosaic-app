"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Page, SectionCard, Button } from "@/components/ui";
import VenueDetailsSection from "./_components/VenueDetailsSection";
import VenueContactsSection from "./_components/VenueContactsSection";
import VenueFeedbackSection from "./_components/VenueFeedbackSection";
import VenueActivitySection from "./_components/VenueActivitySection";
import {
  formatDateTime,
  memberLabel,
} from "./_lib/formatters";
import type {
  AgencyMember,
  AgencyMembershipRow,
  Artist,
  Gig,
  ProfileRow,
  Venue,
  VenueContact,
  VenueFeedback,
} from "./_lib/types";

export default function VenueDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const venueId = params?.id;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [members, setMembers] = useState<AgencyMember[]>([]);
  const [contacts, setContacts] = useState<VenueContact[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<VenueFeedback[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [capacity, setCapacity] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [recordOwnerId, setRecordOwnerId] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");

  const canSave = useMemo(() => name.trim().length > 0 && !saving, [name, saving]);
  const updatedAtLabel = formatDateTime(venue?.updated_at);

  useEffect(() => {
    if (!venueId) return;
    void loadVenuePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  async function loadVenuePage() {
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
      setContacts([]);
      setFeedbackItems([]);
      setArtists([]);
      setGigs([]);
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
    setGoogleMapsUrl(v.google_maps_url ?? "");

    await Promise.all([
      loadMembers(v.agency_id),
      loadContacts(v.id),
      loadFeedback(v.id),
      loadArtists(v.agency_id),
      loadGigs(v.agency_id, v.id),
    ]);

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

  async function loadContacts(currentVenueId: string) {
    const { data, error } = await supabase
      .from("venue_contacts")
      .select("*")
      .eq("venue_id", currentVenueId)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });

    if (error || !data) {
      if (error) {
        console.warn("Failed to load contacts:", error.message);
      }
      setContacts([]);
      return;
    }

    setContacts(data as VenueContact[]);
  }

  async function loadFeedback(currentVenueId: string) {
    const { data, error } = await supabase
      .from("venue_feedback")
      .select("*")
      .eq("venue_id", currentVenueId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      if (error) {
        console.warn("Failed to load feedback:", error.message);
      }
      setFeedbackItems([]);
      return;
    }

    setFeedbackItems(data as VenueFeedback[]);
  }

  async function loadArtists(agencyId: string) {
    const { data, error } = await supabase
      .from("artists")
      .select("id, name")
      .eq("agency_id", agencyId)
      .order("name", { ascending: true });

    if (error || !data) {
      if (error) {
        console.warn("Failed to load artists:", error.message);
      }
      setArtists([]);
      return;
    }

    setArtists(data as Artist[]);
  }

  async function loadGigs(agencyId: string, currentVenueId: string) {
    const { data, error } = await supabase
      .from("gigs")
      .select("id, title, starts_at")
      .eq("agency_id", agencyId)
      .eq("venue_id", currentVenueId)
      .order("starts_at", { ascending: false });

    if (error || !data) {
      if (error) {
        console.warn("Failed to load gigs:", error.message);
      }
      setGigs([]);
      return;
    }

    setGigs(data as Gig[]);
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
    const trimmedGoogleMapsUrl = googleMapsUrl.trim();

    const parsedCapacity =
      trimmedCapacity === "" ? null : Number.parseInt(trimmedCapacity, 10);

    if (trimmedCapacity !== "" && Number.isNaN(parsedCapacity)) {
      alert("Capacity must be a whole number.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("venues").update({
      name: trimmedName,
      city: trimmedCity || null,
      country: trimmedCountry || null,
      capacity: parsedCapacity,
      website: trimmedWebsite || null,
      notes: trimmedNotes || null,
      record_owner_id: recordOwnerId || null,
      google_maps_url: trimmedGoogleMapsUrl || null,
      updated_by: user.id,
    }).eq("id", venue.id);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await loadVenuePage();
    setSaving(false);
  }

  if (loading) {
    return (
      <Page title="Venue details">
        <SectionCard title="Venue details">
          <div style={{ fontSize: 14, color: "var(--mutedText)" }}>Loading venue…</div>
        </SectionCard>
      </Page>
    );
  }

  if (!venue) {
    return (
      <Page title="Venue details">
        <SectionCard title="Venue details">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14 }}>Venue not found.</div>
            <div>
              <Button variant="secondary" onClick={() => router.push("/venues")}>
                Back to venues
              </Button>
            </div>
          </div>
        </SectionCard>
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

        <VenueDetailsSection
          name={name}
          setName={setName}
          city={city}
          setCity={setCity}
          country={country}
          setCountry={setCountry}
          capacity={capacity}
          setCapacity={setCapacity}
          website={website}
          setWebsite={setWebsite}
          recordOwnerId={recordOwnerId}
          setRecordOwnerId={setRecordOwnerId}
          googleMapsUrl={googleMapsUrl}
          setGoogleMapsUrl={setGoogleMapsUrl}
          notes={notes}
          setNotes={setNotes}
          members={members}
          updatedAtLabel={updatedAtLabel}
        />

        <VenueContactsSection
          venue={venue}
          contacts={contacts}
          onContactsChanged={() => loadContacts(venue.id)}
        />

        <VenueFeedbackSection
          venue={venue}
          feedbackItems={feedbackItems}
          artists={artists}
          gigs={gigs}
          onFeedbackChanged={() => loadFeedback(venue.id)}
        />

        <VenueActivitySection />
      </div>
    </Page>
  );
}