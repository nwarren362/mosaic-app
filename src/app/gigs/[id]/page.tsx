"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Page, Card, Button, Input, Select, Field, SectionCard, StatTile, StatusBadge, Textarea } from "@/components/ui";
import { ActivityTimeline } from "../../../components/ActivityTimeline";
import { createDomainEvent, dispatchDomainEvent } from "@/lib/workflows";

type GigStatus = "confirmed" | "pending" | "cancelled";

type Gig = {
  id: string;
  agency_id: string;
  artist_id: string | null;
  venue_id: string | null;
  title: string | null;
  starts_at: string | null;
  status: GigStatus | null;
  fee_cents: number | null;
  city: string | null;
  venue: string | null;
  notes: string | null;
  promo_image_url: string | null;
};

type Artist = {
  id: string;
  name: string;
};

type VenueOption = {
  id: string;
  name: string;
  display_address: string | null;
};


function toDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function formatMoneyFromCents(value: number | null) {
  if (value == null) return "";
  return (value / 100).toFixed(2);
}

function parseMoneyToCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed)) return null;

  return Math.round(parsed * 100);
}

function formatGigDate(value: string | null) {
  if (!value) return "Date TBC";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBC";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function gigDisplayStatus(status: GigStatus | null | undefined, startsAt: string | null) {
  if (status === "confirmed" && startsAt) {
    const date = new Date(startsAt);
    if (!Number.isNaN(date.getTime()) && date < new Date()) {
      return "performed";
    }
  }

  return status ?? "confirmed";
}

function gigStatusLabel(status: string | null | undefined) {
  if (!status) return "Confirmed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function gigStatusTone(status: string | null | undefined) {
  if (status === "cancelled") return "danger";
  if (status === "pending") return "warning";
  if (status === "performed") return "muted";
  return "success";
}

export default function GigDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const gigId = params?.id;

  const [gig, setGig] = useState<Gig | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [artistId, setArtistId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [status, setStatus] = useState<GigStatus>("confirmed");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");
  const [promoImageUrl, setPromoImageUrl] = useState("");
  const [venueDisplayAddress, setVenueDisplayAddress] = useState("");
  const [venueName, setVenueName] = useState("");

  const selectedArtistName =
    artists.find((artist) => artist.id === artistId)?.name ?? "Unassigned artist";

  const selectedVenueName =
    venues.find((venue) => venue.id === venueId)?.name ?? (venueName || "Unassigned venue");

  const displayStatus = gigDisplayStatus(status, fromDateTimeLocal(startsAt));

  const dirty = useMemo(() => {
    if (!gig) return false;

    return (
      title !== (gig.title ?? "") ||
      artistId !== (gig.artist_id ?? "") ||
      venueId !== (gig.venue_id ?? "") ||
      startsAt !== toDateTimeLocal(gig.starts_at) ||
      status !== (gig.status ?? "confirmed") ||
      fee !== formatMoneyFromCents(gig.fee_cents) ||
      notes !== (gig.notes ?? "") ||
      promoImageUrl !== (gig.promo_image_url ?? "") ||
      venueName !== (gig.venue ?? "")
    );
  }, [gig, title, artistId, venueId, startsAt, status, fee, notes, promoImageUrl, venueName]);

  const canSave = useMemo(() => Boolean(gig) && !saving && dirty, [gig, saving, dirty]);

  useEffect(() => {
    if (!gigId) return;
    void loadGigPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigId]);

  useEffect(() => {
    if (!gig) return;
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
  }, [gig]);

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
    const selectedVenue = venues.find((venue) => venue.id === venueId);
    setVenueDisplayAddress(selectedVenue?.display_address ?? "");
  }, [venueId, venues]);

  function handleBack() {
    if (dirty) {
      const ok = confirm("You have unsaved changes. Leave this page and discard them?");
      if (!ok) return;
    }

    router.back();
  }

  async function handleSaveAndClose() {
    const saved = await handleSave();
    if (!saved) return;
    router.back();
  }

  function handleEditPromoImageUrl() {
    const nextUrl = prompt("Paste promo image URL", promoImageUrl);
    if (nextUrl === null) return;
    setPromoImageUrl(nextUrl.trim());
  }

  async function loadGigPage() {
    setLoading(true);

    const { data, error } = await supabase
      .from("gigs")
      .select("*")
      .eq("id", gigId)
      .maybeSingle();

    if (error || !data) {
      if (error) alert(error.message);
      setGig(null);
      setArtists([]);
      setVenues([]);
      setLoading(false);
      return;
    }

    const loadedGig = data as Gig;

    setGig(loadedGig);
    setTitle(loadedGig.title ?? "");
    setArtistId(loadedGig.artist_id ?? "");
    setVenueId(loadedGig.venue_id ?? "");
    setStartsAt(toDateTimeLocal(loadedGig.starts_at));
    setStatus(loadedGig.status ?? "confirmed");
    setFee(formatMoneyFromCents(loadedGig.fee_cents));
    setNotes(loadedGig.notes ?? "");
    setPromoImageUrl(loadedGig.promo_image_url ?? "");
    setVenueName(loadedGig.venue ?? "");

    await Promise.all([
      loadArtists(loadedGig.agency_id),
      loadVenues(loadedGig.agency_id),
    ]);

    setLoading(false);
  }

  async function loadArtists(agencyId: string) {
    const { data, error } = await supabase
      .from("artists")
      .select("id, name")
      .eq("agency_id", agencyId)
      .order("name", { ascending: true });

    if (error || !data) {
      if (error) console.warn("Failed to load artists:", error.message);
      setArtists([]);
      return;
    }

    setArtists(data as Artist[]);
  }

  async function loadVenues(agencyId: string) {
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, display_address")
      .eq("agency_id", agencyId)
      .order("name", { ascending: true });

    if (error || !data) {
      if (error) console.warn("Failed to load venues:", error.message);
      setVenues([]);
      return;
    }

    setVenues(data as VenueOption[]);
  }

  async function handleSave(): Promise<boolean> {
    if (!gig) return false;

    setSaving(true);

    const payload = {
      title: title.trim() || null,
      artist_id: artistId || null,
      venue_id: venueId || null,
      starts_at: fromDateTimeLocal(startsAt),
      status,
      fee_cents: parseMoneyToCents(fee) ?? 0,
      notes: notes.trim() || null,
      promo_image_url: promoImageUrl.trim() || null,
      venue: venueName.trim() || null,
    };

    const { error } = await supabase
      .from("gigs")
      .update(payload)
      .eq("id", gig.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return false;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const previousStatus = gig.status ?? "confirmed";

    if (
      previousStatus !== status &&
      (status === "cancelled" || status === "confirmed") &&
      user
    ) {
      const workflowEventType = status === "cancelled" ? "gig.cancelled" : "gig.confirmed";

      const event = createDomainEvent({
        type: workflowEventType,
        agencyId: gig.agency_id,
        entityType: "gig",
        entityId: gig.id,
        actorUserId: user.id,
        metadata: {
          previous_status: previousStatus,
          next_status: status,
          title: title.trim() || gig.title || null,
          artist_id: artistId || null,
          venue_id: venueId || null,
          starts_at: fromDateTimeLocal(startsAt),
        },
      });

      const workflowResult = await dispatchDomainEvent(
        {
          supabase,
          agencyId: gig.agency_id,
          actor: { userId: user.id },
        },
        event
      );

      if (!workflowResult.ok) {
        console.warn(`${workflowEventType} workflow did not complete cleanly`, workflowResult.failures);
      }
    }

    const oldStartsAt = gig.starts_at;
    const newStartsAt = fromDateTimeLocal(startsAt);
    const oldFee = gig.fee_cents ?? 0;
    const newFee = parseMoneyToCents(fee) ?? 0;
    const oldArtistName = artists.find((artist) => artist.id === gig.artist_id)?.name ?? "Unassigned artist";
    const newArtistName = artists.find((artist) => artist.id === artistId)?.name ?? "Unassigned artist";
    const oldVenueName = gig.venue ?? "Unassigned venue";
    const newVenueName = venueName.trim() || "Unassigned venue";

    const activityRows: Array<{
      agency_id: string;
      entity_type: "gig";
      entity_id: string;
      activity_type: "status_change" | "system";
      summary: string;
      notes?: string | null;
      metadata?: Record<string, unknown>;
      created_by?: string | null;
    }> = [];

    if (status !== (gig.status ?? "confirmed")) {
      activityRows.push({
        agency_id: gig.agency_id,
        entity_type: "gig",
        entity_id: gig.id,
        activity_type: "status_change",
        summary: `Status changed from ${gigStatusLabel(gig.status ?? "confirmed")} to ${gigStatusLabel(status)}.`,
        metadata: { from: gig.status ?? "confirmed", to: status },
      });
    }

    if (
      toDateTimeLocal(newStartsAt) !== toDateTimeLocal(oldStartsAt)
    ) {
      activityRows.push({
        agency_id: gig.agency_id,
        entity_type: "gig",
        entity_id: gig.id,
        activity_type: "system",
        summary: `Date changed from ${formatGigDate(oldStartsAt)} to ${formatGigDate(newStartsAt)}.`,
        metadata: { from: oldStartsAt, to: newStartsAt },
      });
    }

    if (artistId !== (gig.artist_id ?? "")) {
      activityRows.push({
        agency_id: gig.agency_id,
        entity_type: "gig",
        entity_id: gig.id,
        activity_type: "system",
        summary: `Artist changed from ${oldArtistName} to ${newArtistName}.`,
        metadata: { from: gig.artist_id, to: artistId || null },
      });
    }

    if (venueId !== (gig.venue_id ?? "")) {
      activityRows.push({
        agency_id: gig.agency_id,
        entity_type: "gig",
        entity_id: gig.id,
        activity_type: "system",
        summary: `Venue changed from ${oldVenueName} to ${newVenueName}.`,
        metadata: { from: gig.venue_id, to: venueId || null },
      });
    }

    if (newFee !== oldFee) {
      activityRows.push({
        agency_id: gig.agency_id,
        entity_type: "gig",
        entity_id: gig.id,
        activity_type: "system",
        summary: `Fee changed from £${(oldFee / 100).toFixed(2)} to £${(newFee / 100).toFixed(2)}.`,
        metadata: { from: oldFee, to: newFee },
      });
    }

    if (title.trim() !== (gig.title ?? "")) {
      activityRows.push({
        agency_id: gig.agency_id,
        entity_type: "gig",
        entity_id: gig.id,
        activity_type: "system",
        summary: "Title updated.",
        metadata: { from: gig.title, to: title.trim() || null },
      });
    }

    if (notes.trim() !== (gig.notes ?? "")) {
      activityRows.push({
        agency_id: gig.agency_id,
        entity_type: "gig",
        entity_id: gig.id,
        activity_type: "system",
        summary: "Performance brief updated.",
      });
    }

    if (promoImageUrl.trim() !== (gig.promo_image_url ?? "")) {
      activityRows.push({
        agency_id: gig.agency_id,
        entity_type: "gig",
        entity_id: gig.id,
        activity_type: "system",
        summary: promoImageUrl.trim() ? "Promo image updated." : "Promo image removed.",
      });
    }

    if (activityRows.length > 0) {
      const rowsWithUser = activityRows.map((row) => ({
        ...row,
        created_by: user?.id ?? null,
      }));

      const { error: activityError } = await supabase.from("activity_log").insert(rowsWithUser);

      if (activityError) {
        console.warn("Failed to record activity:", activityError.message);
      }
    }

    await loadGigPage();
    return true;
  }

  if (loading) {
    return (
      <Page title="Gig details">
        <Card>
          <div style={{ color: "var(--mutedText)", fontSize: 14 }}>Loading gig…</div>
        </Card>
      </Page>
    );
  }

  if (!gig) {
    return (
      <Page title="Gig details">
        <Card>
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div>Gig not found.</div>
            <Button variant="secondary" type="button" onClick={handleBack}>
              Back
            </Button>
          </div>
        </Card>
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
          <div>
            <h1 style={{ margin: 0 }}>{selectedArtistName}</h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                flexWrap: "wrap",
                color: "var(--mutedText)",
                marginTop: 8,
                fontSize: 14,
              }}
            >
              <span>{[selectedVenueName, formatGigDate(gig.starts_at)].filter(Boolean).join(" · ")}</span>
              <span
                title={
                  displayStatus === "performed"
                    ? "Displayed as Performed because this confirmed gig is in the past."
                    : undefined
                }
              >
                <StatusBadge tone={gigStatusTone(displayStatus)}>
                  {gigStatusLabel(displayStatus)}
                </StatusBadge>
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button variant="secondary" type="button" onClick={handleBack}>
              Back
            </Button>
            <Button variant="secondary" type="button" onClick={handleSave} disabled={!canSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" onClick={handleSaveAndClose} disabled={!canSave}>
              {saving ? "Saving…" : "Save & close"}
            </Button>
          </div>
        </div>

        <Card>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: "var(--space-4)",
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 18,
                border: "1px solid var(--border)",
                background:
                  "linear-gradient(135deg, rgba(139,92,246,0.22), rgba(255,255,255,0.035))",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {promoImageUrl ? (
                <img
                  src={promoImageUrl}
                  alt={`${selectedArtistName} gig promo`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "var(--space-4)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--mutedText)", }}>
                    {selectedArtistName}
                  </div>
                  <div style={{ color: "var(--mutedText)", marginTop: 6 }}>
                    {selectedVenueName}
                  </div>
                  <div style={{ color: "var(--mutedText)", marginTop: 4, fontSize: 13 }}>
                    {formatGigDate(gig.starts_at)}
                  </div>
                </div>
              )}
              <button
                type="button"
                aria-label="Edit promo image URL"
                title="Edit promo image URL"
                onClick={handleEditPromoImageUrl}
                style={{
                  position: "absolute",
                  right: 10,
                  bottom: 10,
                  zIndex: 2,
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(0,0,0,0.62)",
                  color: "var(--text)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
              >
                <Pencil size={16} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
                gap: "var(--space-3)",
                alignContent: "start",
              }}
            >
              <StatTile label="Audience" value="TBA" hint="Actual / target" />
              <StatTile label="Revenue" value="TBA" hint="Actual / target" />
              <StatTile label="Rating" value="—" hint="Artist feedback" />
            </div>
          </div>
        </Card>

        <SectionCard title="Gig details">
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Artist">
                <Select value={artistId} onChange={(e) => setArtistId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Venue">
                <Select
                  value={venueId}
                  onChange={(e) => {
                    const nextVenueId = e.target.value;
                    const nextVenue = venues.find((venue) => venue.id === nextVenueId);
                    setVenueId(nextVenueId);
                    setVenueName(nextVenue?.name ?? "");
                    setVenueDisplayAddress(nextVenue?.display_address ?? "");
                  }}
                >
                  <option value="">Unassigned</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Starts at">
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </Field>

              <Field label="Status">
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as GigStatus)}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </Field>

              <Field label="Title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Gig title"
                />
              </Field>

              <Field label="Fee">
                <Input
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Venue address">
                <Input
                  value={venueDisplayAddress}
                  readOnly
                  placeholder="No address recorded"
                />
              </Field>
            </div>

            <Field label="Notes / performance brief">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Load-in times, parking, set lengths, payment notes, technical details, contact instructions..."
                style={{ minHeight: 180, resize: "vertical" }}
              />
            </Field>
          </div>
        </SectionCard>
      <div id="activity">
        <ActivityTimeline
          agencyId={gig.agency_id}
          entityType="gig"
          entityId={gig.id}
        />
      </div>
      </div>
    </Page>
  );
}