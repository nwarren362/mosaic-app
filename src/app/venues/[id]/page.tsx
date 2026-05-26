"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Page, SectionCard, Button, Select, StatTile, SegmentedControl, StatusBadge } from "@/components/ui";
import { FilterChip, FilterRow } from "@/components/filters";
import VenueDetailsSection from "./_components/VenueDetailsSection";
import VenueContactsSection from "./_components/VenueContactsSection";
import VenueFeedbackSection from "./_components/VenueFeedbackSection";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { logVenueActivity } from "./_lib/activity";
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

type AgencyTagType = {
  id: string;
  agency_id: string;
  type: string;
  label: string;
  description: string | null;
  sort_order: number | null;
  active: boolean | null;
};

type AgencyTag = {
  id: string;
  agency_id: string;
  name: string;
  type: string;
  sort_order: number | null;
  active: boolean | null;
};


type VenueTagRow = {
  tag_id: string;
};

function venueStatusLabel(status: string | null | undefined) {
  if (!status) return "New";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type VenueLifecycleStatus = "new" | "approved" | "preferred" | "inactive";

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
  const [activeGigTab, setActiveGigTab] = useState<"all" | "upcoming" | "past">("upcoming");
  const [tagTypes, setTagTypes] = useState<AgencyTagType[]>([]);
  const [agencyTags, setAgencyTags] = useState<AgencyTag[]>([]);
  const [selectedVenueTagIds, setSelectedVenueTagIds] = useState<string[]>([]);
  const [savingVenueTagId, setSavingVenueTagId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLifecycleMenu, setShowLifecycleMenu] = useState(false);
  const lifecycleMenuRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [displayAddress, setDisplayAddress] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [region, setRegion] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [capacity, setCapacity] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [recordOwnerId, setRecordOwnerId] = useState("");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("");

  const dirty = useMemo(() => {
    if (!venue) return false;

    return (
      name !== (venue.name ?? "") ||
      displayAddress !==
        (venue.display_address ||
          [venue.address_line1, venue.address_line2, venue.city, venue.region, venue.postcode, venue.country]
            .filter(Boolean)
            .join(", ")) ||
      addressLine1 !== (venue.address_line1 ?? "") ||
      addressLine2 !== (venue.address_line2 ?? "") ||
      region !== (venue.region ?? "") ||
      postcode !== (venue.postcode ?? "") ||
      city !== (venue.city ?? "") ||
      country !== (venue.country ?? "") ||
      capacity !== (venue.capacity != null ? String(venue.capacity) : "") ||
      website !== (venue.website ?? "") ||
      notes !== (venue.notes ?? "") ||
      recordOwnerId !== (venue.record_owner_id ?? "") ||
      googleMapsUrl !== (venue.google_maps_url ?? "")
    );
  }, [
    venue,
    name,
    displayAddress,
    addressLine1,
    addressLine2,
    region,
    postcode,
    city,
    country,
    capacity,
    website,
    notes,
    recordOwnerId,
    googleMapsUrl,
  ]);

  const canSave = useMemo(
    () => name.trim().length > 0 && !saving && dirty,
    [name, saving, dirty]
  );
  const updatedAtLabel = formatDateTime(venue?.updated_at);


  useEffect(() => {
    if (!venueId) return;
    void loadVenuePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  useEffect(() => {
    if (!venue) return;
    if (window.location.hash !== "#activity") return;

    const timeoutIds = [100, 300, 600, 1000].map((delay) =>
      window.setTimeout(() => {
        document.getElementById("activity")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, delay)
    );

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [venue]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty]);

  useEffect(() => {
    if (!showLifecycleMenu) return;

    function handleDocumentMouseDown(event: MouseEvent) {
      if (!lifecycleMenuRef.current) return;
      if (lifecycleMenuRef.current.contains(event.target as Node)) return;
      setShowLifecycleMenu(false);
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [showLifecycleMenu]);

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
      setTagTypes([]);
      setAgencyTags([]);
      setSelectedVenueTagIds([]);
      setLoading(false);
      return;
    }

    const v = data as Venue;

    setVenue(v);
    setName(v.name ?? "");
    setDisplayAddress(
      v.display_address ||
        [v.address_line1, v.address_line2, v.city, v.region, v.postcode, v.country]
          .filter(Boolean)
          .join(", ")
    );
    setAddressLine1(v.address_line1 ?? "");
    setAddressLine2(v.address_line2 ?? "");
    setRegion(v.region ?? "");
    setPostcode(v.postcode ?? "");
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
      loadVenueTags(v.agency_id, v.id),
    ]);

    setLoading(false);
  }

  async function loadVenueTags(agencyId: string, currentVenueId: string) {
    const { data: tagTypeData, error: tagTypeError } = await supabase
      .from("agency_tag_types")
      .select("id, agency_id, type, label, description, sort_order, active")
      .eq("agency_id", agencyId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (tagTypeError || !tagTypeData) {
      if (tagTypeError) {
        console.warn("Failed to load tag types:", tagTypeError.message);
      }
      setTagTypes([]);
    } else {
      setTagTypes(tagTypeData as AgencyTagType[]);
    }

    const { data: tagData, error: tagError } = await supabase
      .from("agency_tags")
      .select("id, agency_id, name, type, sort_order, active")
      .eq("agency_id", agencyId)
      .eq("active", true)
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (tagError || !tagData) {
      if (tagError) {
        console.warn("Failed to load agency tags:", tagError.message);
      }
      setAgencyTags([]);
    } else {
      setAgencyTags(tagData as AgencyTag[]);
    }

    const { data: selectedTagData, error: selectedTagError } = await supabase
      .from("venue_tags")
      .select("tag_id")
      .eq("agency_id", agencyId)
      .eq("venue_id", currentVenueId);

    if (selectedTagError || !selectedTagData) {
      if (selectedTagError) {
        console.warn("Failed to load venue tags:", selectedTagError.message);
      }
      setSelectedVenueTagIds([]);
      return;
    }

    setSelectedVenueTagIds(
      (selectedTagData as VenueTagRow[]).map((row) => row.tag_id)
    );
  }
  async function toggleVenueTag(tagId: string) {
    if (!venue || savingVenueTagId) return;

    const selected = selectedVenueTagIds.includes(tagId);
    setSavingVenueTagId(tagId);

    if (selected) {
      const { error } = await supabase
        .from("venue_tags")
        .delete()
        .eq("agency_id", venue.agency_id)
        .eq("venue_id", venue.id)
        .eq("tag_id", tagId);

      setSavingVenueTagId(null);

      if (error) {
        alert(error.message);
        return;
      }

      setSelectedVenueTagIds((current) => current.filter((id) => id !== tagId));
      return;
    }

    const { error } = await supabase.from("venue_tags").insert({
      agency_id: venue.agency_id,
      venue_id: venue.id,
      tag_id: tagId,
    });

    setSavingVenueTagId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedVenueTagIds((current) => [...current, tagId]);
  }

  async function setVenueRegionTag(nextTagId: string) {
    if (!venue || savingVenueTagId) return;

    const regionTagIds = agencyTags
      .filter((tag) => tag.type === "region")
      .map((tag) => tag.id);

    setSavingVenueTagId(nextTagId || "region");

    if (regionTagIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("venue_tags")
        .delete()
        .eq("agency_id", venue.agency_id)
        .eq("venue_id", venue.id)
        .in("tag_id", regionTagIds);

      if (deleteError) {
        setSavingVenueTagId(null);
        alert(deleteError.message);
        return;
      }
    }

    if (nextTagId) {
      const { error: insertError } = await supabase.from("venue_tags").insert({
        agency_id: venue.agency_id,
        venue_id: venue.id,
        tag_id: nextTagId,
      });

      if (insertError) {
        setSavingVenueTagId(null);
        alert(insertError.message);
        return;
      }
    }

    setSelectedVenueTagIds((current) => [
      ...current.filter((id) => !regionTagIds.includes(id)),
      ...(nextTagId ? [nextTagId] : []),
    ]);

    setSavingVenueTagId(null);
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
      .select("id, display_name, first_name, last_name, full_name")
      .in("id", userIds);

    if (profilesError || !profiles) {
      if (profilesError) {
        console.warn("Failed to load profiles:", profilesError.message);
      }
      setMembers([]);
      return;
    }

    type ProfileWithName = ProfileRow & {
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
    };

    const profileRows = profiles as ProfileWithName[];
    const roleMap = new Map<string, string>();
    membershipRows.forEach((m) => roleMap.set(m.user_id, m.role));

    const mergedMembers: AgencyMember[] = profileRows.map((p) => ({
      id: p.id,
      user_id: p.id,
      display_name:
        [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
        p.full_name ||
        p.display_name,
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
      .select("id, title, starts_at, artist_id, status, fee_cents, city, venue")
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


  async function refreshContactsAndActivity() {
    if (!venue) return;
    await loadContacts(venue.id);
  }

  async function refreshFeedbackAndActivity() {
    if (!venue) return;
    await loadFeedback(venue.id);
  }

  async function handleSave(): Promise<boolean> {
    if (!venue) return false;

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      setSaving(false);
      return false;
    }

    if (!user) {
      alert("You must be signed in to save changes.");
      setSaving(false);
      return false;
    }

    const trimmedName = name.trim();
    const trimmedAddressLine1 = addressLine1.trim();
    const trimmedAddressLine2 = addressLine2.trim();
    const trimmedCity = city.trim();
    const trimmedRegion = region.trim();
    const trimmedPostcode = postcode.trim();
    const trimmedCountry = country.trim();
    const trimmedWebsite = website.trim();
    const trimmedNotes = notes.trim();
    const trimmedCapacity = capacity.trim();
    const trimmedGoogleMapsUrl = googleMapsUrl.trim();

    const parsedCapacity =
      trimmedCapacity === "" ? null : Number.parseInt(trimmedCapacity, 10);


    const { error } = await supabase.from("venues").update({
      name: trimmedName,
      display_address: displayAddress.trim() || null,
      address_line1: trimmedAddressLine1 || null,
      address_line2: trimmedAddressLine2 || null,
      city: trimmedCity || null,
      region: trimmedRegion || null,
      postcode: trimmedPostcode || null,
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
      return false;
    }


    const previousDisplayAddress =
      venue.display_address ||
      [
        venue.address_line1,
        venue.address_line2,
        venue.city,
        venue.region,
        venue.postcode,
        venue.country,
      ]
        .filter(Boolean)
        .join(", ");

    const venueActivityChanges: Array<{
      field: string;
      summary: string;
      from: unknown;
      to: unknown;
    }> = [
      {
        field: "name",
        summary: "Venue name updated.",
        from: venue.name ?? "",
        to: trimmedName,
      },
      {
        field: "display_address",
        summary: "Display address updated.",
        from: previousDisplayAddress,
        to: displayAddress.trim(),
      },
      {
        field: "city",
        summary: "City updated.",
        from: venue.city ?? "",
        to: trimmedCity,
      },
      {
        field: "postcode",
        summary: "Postcode updated.",
        from: venue.postcode ?? "",
        to: trimmedPostcode,
      },
      {
        field: "country",
        summary: "Country updated.",
        from: venue.country ?? "",
        to: trimmedCountry,
      },
      {
        field: "capacity",
        summary: "Capacity updated.",
        from: venue.capacity ?? null,
        to: parsedCapacity,
      },
      {
        field: "website",
        summary: "Website updated.",
        from: venue.website ?? "",
        to: trimmedWebsite,
      },
      {
        field: "google_maps_url",
        summary: "Google Maps URL updated.",
        from: venue.google_maps_url ?? "",
        to: trimmedGoogleMapsUrl,
      },
      {
        field: "record_owner_id",
        summary: "Record owner updated.",
        from: venue.record_owner_id ?? "",
        to: recordOwnerId || "",
      },
      {
        field: "notes",
        summary: "Notes updated.",
        from: venue.notes ?? "",
        to: trimmedNotes,
      },
    ].filter((change) => change.from !== change.to);

    for (const change of venueActivityChanges) {
      await logVenueActivity({
        venue,
        activityType: "venue_updated",
        summary: change.summary,
        metadata: {
          field: change.field,
          from: change.from,
          to: change.to,
        },
      });
    }

    await loadVenuePage();
    setSaving(false);
    return true;
  }

  async function handleSaveAndClose() {
    if (!dirty) {
      router.push("/venues");
      return;
    }

    const saved = await handleSave();
    if (saved) {
      router.push("/venues");
    }
  }

  async function handleVenueStatusChange(nextStatus: VenueLifecycleStatus) {
    if (!venue) return;

    const { error } = await supabase
      .from("venues")
      .update({ status: nextStatus })
      .eq("id", venue.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logVenueActivity({
      venue,
      activityType: "venue_updated",
      summary: `Set ${venue.name} status to ${venueStatusLabel(nextStatus)}.`,
      metadata: { status: nextStatus },
    });

    await loadVenuePage();
  }

  function handleBack() {
    if (dirty) {
      const ok = confirm("You have unsaved changes. Leave this page and discard them?");
      if (!ok) return;
    }

    router.push("/venues");
  }

  async function handleDeleteOrDeactivateVenue() {
    if (!venue) return;

    setShowLifecycleMenu(false);

    if (venue.status === "inactive") {
      const ok = confirm(`Reactivate ${venue.name}?`);
      if (!ok) return;

      const { error } = await supabase
        .from("venues")
        .update({ status: "approved" })
        .eq("id", venue.id);

      if (error) {
        alert(error.message);
        return;
      }

      await logVenueActivity({
        venue,
        activityType: "venue_updated",
        summary: `Reactivated ${venue.name}.`,
        metadata: { status: "approved" },
      });

      await loadVenuePage();
      return;
    }

    const dependencyMessages = [
      gigs.length > 0 ? `${gigs.length} gig${gigs.length === 1 ? "" : "s"}` : null,
      contacts.length > 0 ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : null,
      feedbackItems.length > 0
        ? `${feedbackItems.length} feedback item${feedbackItems.length === 1 ? "" : "s"}`
        : null,
    ].filter(Boolean);

    if (dependencyMessages.length === 0) {
      const ok = confirm(`Delete ${venue.name}? This cannot be undone.`);
      if (!ok) return;

      const { error } = await supabase.from("venues").delete().eq("id", venue.id);

      if (error) {
        alert(error.message);
        return;
      }

      router.push("/venues");
      return;
    }

    const ok = confirm(
      `This venue has related data (${dependencyMessages.join(", ")}), so it should not be deleted. Set it as inactive instead?`
    );

    if (!ok) return;

    const { error } = await supabase
      .from("venues")
      .update({ status: "inactive" })
      .eq("id", venue.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logVenueActivity({
      venue,
      activityType: "venue_updated",
      summary: `Set ${venue.name} as inactive.`,
      metadata: { status: "inactive" },
    });

    await loadVenuePage();
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
    <Page title="">
      <div className="flex flex-col gap-4">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <h1 style={{ margin: 0 }}>{name || venue.name}</h1>
            <div style={{ color: "var(--mutedText)", fontSize: 14 }}>
              {[city, capacity ? `${capacity} capacity` : null]
                .filter(Boolean)
                .join(" · ") || "Venue details"}
            </div>

          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="secondary" type="button" onClick={handleBack}>
              Back
            </Button>

            <Button variant="secondary" type="button" onClick={handleSave} disabled={!canSave}>
              {saving ? "Saving…" : "Save"}
            </Button>

            <Button variant="primary" type="button" onClick={handleSaveAndClose} disabled={saving || !venue}>
              {saving ? "Saving…" : "Save & close"}
            </Button>

            <div ref={lifecycleMenuRef} style={{ position: "relative" }}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowLifecycleMenu((value) => !value)}
                aria-label="More venue actions"
              >
                …
              </Button>

              {showLifecycleMenu ? (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    minWidth: 220,
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    background: "var(--surface)",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
                    padding: 6,
                    zIndex: 20,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleDeleteOrDeactivateVenue}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 10,
                      fontSize: 14,
                    }}
                  >
                    {venue.status === "inactive" ? "Reactivate venue" : "Delete / Deactivate venue"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          {(() => {
            const now = new Date();

            const upcomingGigs = gigs.filter((g) => new Date(g.starts_at) >= now).length;
            const pastGigs = gigs.filter((g) => new Date(g.starts_at) < now).length;

            const ratings = feedbackItems
              .map((f: any) => f.rating)
              .filter((r: number | null) => typeof r === "number");

            const avgRating =
              ratings.length > 0
                ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1)
                : "–";

            return (
              <>
                <StatTile
                  label="Upcoming gigs"
                  value={upcomingGigs}
                  hint={upcomingGigs > 0 ? "More details below" : "None scheduled"}
                />
                <StatTile
                  label="Past gigs"
                  value={pastGigs}
                  hint={pastGigs > 0 ? "More details below" : "No past gigs"}
                />
                <StatTile
                  label="Avg rating"
                  value={avgRating}
                  hint={ratings.length > 0 ? `n = ${ratings.length}` : "No ratings yet"}
                />
                <StatTile
                  label="Status"
                  value={venueStatusLabel(venue.status)}
                  hint="Managed in Tags"
                />
              </>
            );
          })()}
        </div>

        <SectionCard
          title={`Gigs (${gigs.length})`}
          controls={
            <SegmentedControl
              ariaLabel="Gig filter"
              value={activeGigTab}
              onChange={setActiveGigTab}
              options={[
                { label: "All", value: "all" },
                {
                  label: `Upcoming (${
                    gigs.filter((gig) => new Date(gig.starts_at) >= new Date()).length
                  })`,
                  value: "upcoming",
                },
                {
                  label: `Past (${
                    gigs.filter((gig) => new Date(gig.starts_at) < new Date()).length
                  })`,
                  value: "past",
                },
              ]}
            />
          }
        >
          {(() => {
            type VenueGig = Gig & {
              artist_id?: string | null;
              status?: "confirmed" | "pending" | "cancelled" | null;
              fee_cents?: number | null;
            };

            function formatGigDateTime(value: string | null | undefined) {
              if (!value) return "Date TBC";

              const date = new Date(value);

              if (Number.isNaN(date.getTime())) {
                return "Date TBC";
              }

              return date.toLocaleString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            }

            const now = new Date();
            const artistNameById = new Map(artists.map((artist) => [artist.id, artist.name]));

            const sortedGigs = [...(gigs as VenueGig[])].sort(
              (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
            );

            const visibleGigs =
              activeGigTab === "upcoming"
                ? sortedGigs.filter((gig) => new Date(gig.starts_at) >= now)
                : activeGigTab === "past"
                  ? sortedGigs
                      .filter((gig) => new Date(gig.starts_at) < now)
                      .reverse()
                  : sortedGigs;

            if (visibleGigs.length === 0) {
              return <div style={{ color: "var(--mutedText)" }}>No gigs yet.</div>;
            }

            return (
              <div
                style={{
                  marginTop: "var(--space-3)",
                  display: "grid",
                  gap: "var(--space-2)",
                }}
              >
                {visibleGigs.map((gig) => {
                  const artistName = gig.artist_id
                    ? artistNameById.get(gig.artist_id) ?? "Unknown artist"
                    : "Unknown artist";

                  const status = gig.status ?? "confirmed";
                  const feeCents = gig.fee_cents ?? 0;
                  const titleDetail = gig.title && gig.title !== artistName ? gig.title : null;

                  return (
                    <Link
                      key={gig.id}
                      href={`/gigs/${gig.id}`}
                      aria-label={`Open gig for ${artistName}`}
                      style={{
                        display: "block",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: "var(--radius-lg)",
                        padding: "12px 12px",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{artistName}</div>
                        <StatusBadge
                          tone={
                            status === "confirmed"
                              ? "success"
                              : status === "pending"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {status}
                        </StatusBadge>
                      </div>

                      <div style={{ marginTop: 6, color: "var(--mutedText)", fontSize: 14 }}>
                        {[
                          formatGigDateTime(gig.starts_at),
                          titleDetail,
                          `£${(feeCents / 100).toFixed(2)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })()}
        </SectionCard>

        <VenueDetailsSection
          name={name}
          setName={setName}
          displayAddress={displayAddress}
          setDisplayAddress={setDisplayAddress}
          city={city}
          setCity={setCity}
          postcode={postcode}
          setPostcode={setPostcode}
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

        <SectionCard title="Tags">
          <div style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
            <FilterRow label="Region" labelWidth={140}>
              <Select
                value={
                  selectedVenueTagIds.find((id) =>
                    agencyTags.some((tag) => tag.id === id && tag.type === "region")
                  ) ?? ""
                }
                onChange={(e) => setVenueRegionTag(e.target.value)}
                style={{ maxWidth: 220 }}
              >
                <option value="">Unassigned</option>
                {agencyTags
                  .filter((tag) => tag.type === "region")
                  .map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
              </Select>
            </FilterRow>

            <FilterRow label="Status" labelWidth={140}>
              <Select
                value={(venue.status ?? "new") as VenueLifecycleStatus}
                onChange={(e) => handleVenueStatusChange(e.target.value as VenueLifecycleStatus)}
                style={{ maxWidth: 220 }}
              >
                <option value="new">New</option>
                <option value="approved">Approved</option>
                <option value="preferred">Preferred</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FilterRow>
          </div>
          {tagTypes.length === 0 ? (
            <div style={{ color: "var(--mutedText)", fontSize: 14 }}>
              No tag entities have been created yet. Manage tags in Settings.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {tagTypes
                .filter((tagType) => tagType.type !== "region")
                .map((tagType) => {
                  const tagsForType = agencyTags.filter((tag) => tag.type === tagType.type);

                  if (tagsForType.length === 0) return null;

                  return (
                    <FilterRow key={tagType.id} label={tagType.label} labelWidth={140}>
                      {tagsForType.map((tag) => {
                        const selected = selectedVenueTagIds.includes(tag.id);
                        const savingThisTag = savingVenueTagId === tag.id;

                        return (
                          <FilterChip
                            key={tag.id}
                            selected={selected}
                            disabled={!!savingVenueTagId}
                            onClick={() => toggleVenueTag(tag.id)}
                          >
                            {savingThisTag ? "Saving…" : tag.name}
                          </FilterChip>
                        );
                      })}
                    </FilterRow>
                  );
                })}
            </div>
          )}
        </SectionCard>

        <VenueContactsSection
          venue={venue}
          contacts={contacts}
          onContactsChanged={refreshContactsAndActivity}
        />

        <VenueFeedbackSection
          venue={venue}
          feedbackItems={feedbackItems}
          artists={artists}
          gigs={gigs}
          onFeedbackChanged={refreshFeedbackAndActivity}
        />

        <div id="activity">
          <ActivityTimeline
            agencyId={venue.agency_id}
            entityType="venue"
            entityId={venue.id}
          />
        </div>
      </div>
    </Page>
  );
}