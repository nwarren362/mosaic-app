"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import {
  Page,
  Card,
  Button,
  Input,
  Select,
  Field,
  IconButton,
  SegmentedControl,
  StatusBadge,
} from "@/components/ui";

type GigStatus = "confirmed" | "pending" | "cancelled";

type GigRow = {
  id: string;
  agency_id: string;
  artist_id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  status: GigStatus;
  fee_cents: number | null;
  artists: { id: string; name: string } | null;
};

type ArtistOption = {
  id: string;
  name: string;
};

type VenueOption = {
  id: string;
  name: string;
  city: string | null;
};

type GigTab = "upcoming" | "past" | "all";

function formatGigDate(value: string) {
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

function fromDateTimeLocal(value: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function parseMoneyToCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed)) return null;

  return Math.round(parsed * 100);
}

function gigDisplayStatus(status: GigRow["status"], startsAt: string) {
  if (status === "confirmed") {
    const date = new Date(startsAt);
    if (!Number.isNaN(date.getTime()) && date < new Date()) {
      return "performed";
    }
  }

  return status;
}

function gigStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function gigStatusTone(status: string) {
  if (status === "cancelled") return "danger";
  if (status === "pending") return "warning";
  if (status === "performed") return "muted";
  return "success";
}

export default function GigsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingNewGig, setSavingNewGig] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [tab, setTab] = useState<GigTab>("upcoming");
  const [query, setQuery] = useState("");

  const [gigs, setGigs] = useState<GigRow[]>([]);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newArtistId, setNewArtistId] = useState("");
  const [newVenueId, setNewVenueId] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newStatus, setNewStatus] = useState<GigStatus>("confirmed");
  const [newFee, setNewFee] = useState("");

  async function load() {
    setMessage(null);
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      router.push("/login");
      return;
    }

    const active = getActiveAgencyId();
    if (!active) {
      setLoading(false);
      setMessage("No active agency selected. Go to /me and choose an agency.");
      return;
    }

    const nowIso = new Date().toISOString();

    let q = supabase
      .from("gigs")
      .select(
        "id,agency_id,artist_id,title,venue,city,starts_at,status,fee_cents, artists:artists(id,name)"
      )
      .eq("agency_id", active)
      .order("starts_at", { ascending: tab !== "past" });

    if (tab === "upcoming") q = q.gte("starts_at", nowIso);
    if (tab === "past") q = q.lt("starts_at", nowIso);

    const [
      { data: gigData, error: gigError },
      { data: artistData, error: artistError },
      { data: venueData, error: venueError },
    ] = await Promise.all([
      q.limit(200),
      supabase
        .from("artists")
        .select("id,name")
        .eq("agency_id", active)
        .order("name", { ascending: true }),
      supabase
        .from("venues")
        .select("id,name,city")
        .eq("agency_id", active)
        .order("name", { ascending: true }),
    ]);

    if (gigError || artistError || venueError) {
      setMessage(gigError?.message ?? artistError?.message ?? venueError?.message ?? "Could not load gigs.");
      setGigs([]);
      setArtists([]);
      setVenues([]);
      setLoading(false);
      return;
    }

    setGigs((gigData ?? []) as unknown as GigRow[]);
    setArtists((artistData ?? []) as ArtistOption[]);
    setVenues((venueData ?? []) as VenueOption[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return gigs;
    return gigs.filter((g) => {
      const hay =
        `${g.title} ${g.venue ?? ""} ${g.city ?? ""} ${g.artists?.name ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [gigs, query]);

  function resetNewGigForm() {
    setNewArtistId("");
    setNewVenueId("");
    setNewStartsAt("");
    setNewStatus("confirmed");
    setNewFee("");
  }

  async function handleCreateGig() {
    const active = getActiveAgencyId();

    if (!active) {
      setMessage("No active agency selected. Go to /me and choose an agency.");
      return;
    }

    if (!newArtistId) {
      setMessage("Artist is required.");
      return;
    }

    setSavingNewGig(true);
    setMessage(null);

    const selectedArtist = artists.find((artist) => artist.id === newArtistId);
    const selectedVenue = venues.find((venue) => venue.id === newVenueId);

    const fallbackTitle = [
      selectedArtist?.name ?? "Gig",
      selectedVenue?.name,
      newStartsAt ? formatGigDate(fromDateTimeLocal(newStartsAt) ?? "") : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const { data, error } = await supabase
      .from("gigs")
      .insert({
        agency_id: active,
        title: fallbackTitle,
        artist_id: newArtistId,
        venue_id: newVenueId || null,
        starts_at: fromDateTimeLocal(newStartsAt),
        status: newStatus,
        fee_cents: parseMoneyToCents(newFee) ?? 0,
        venue: selectedVenue?.name ?? null,
        city: selectedVenue?.city ?? null,
      })
      .select("id")
      .single();

    setSavingNewGig(false);

    if (error || !data?.id) {
      setMessage(error?.message ?? "Could not create gig.");
      return;
    }

    const newGigId = data.id;

    resetNewGigForm();
    setShowAddForm(false);
    router.push(`/gigs/${newGigId}`);
  }

  return (
    <Page title="Gigs">
      {message ? <p style={{ color: "var(--mutedText)" }}>{message}</p> : null}

      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-3)",
            flexWrap: "wrap",
            marginBottom: "var(--space-4)",
          }}
        >
          <h2 style={{ margin: 0 }}>Gigs ({filtered.length})</h2>

          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <SegmentedControl
              ariaLabel="Gig date filter"
              value={tab}
              onChange={setTab}
              options={[
                { label: "Upcoming", value: "upcoming" },
                { label: "Past", value: "past" },
                { label: "All", value: "all" },
              ]}
            />

            <IconButton
              label="Add gig"
              variant={showAddForm ? "secondary" : "primary"}
              type="button"
              onClick={() => setShowAddForm((value) => !value)}
            >
              <Plus size={16} />
            </IconButton>
          </div>
        </div>

        <Input
          placeholder="Search artist, venue, city or title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ minWidth: 240 }}
        />

        {showAddForm ? (
          <div
            style={{
              marginTop: "var(--space-4)",
              borderTop: "1px solid var(--border)",
              paddingTop: "var(--space-4)",
              display: "grid",
              gap: "var(--space-4)",
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Artist" required>
                <Select value={newArtistId} onChange={(e) => setNewArtistId(e.target.value)}>
                  <option value="">Select artist</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Venue">
                <Select value={newVenueId} onChange={(e) => setNewVenueId(e.target.value)}>
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
                  value={newStartsAt}
                  onChange={(e) => setNewStartsAt(e.target.value)}
                />
              </Field>

              <Field label="Status">
                <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as GigStatus)}>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </Field>

              <Field label="Fee">
                <Input
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </Field>
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  resetNewGigForm();
                  setShowAddForm(false);
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateGig} disabled={savingNewGig || !newArtistId}>
                {savingNewGig ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        {loading ? (
          <div style={{ color: "var(--mutedText)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "var(--mutedText)" }}>No gigs found.</div>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {filtered.map((g) => {
              const displayStatus = gigDisplayStatus(g.status, g.starts_at);
              const artistName = g.artists?.name ?? "Unknown artist";
              const venueName = g.venue ?? "Unassigned venue";
              const fee = g.fee_cents == null ? null : `£${(g.fee_cents / 100).toFixed(2)}`;

              return (
                <Link
                  key={g.id}
                  href={`/gigs/${g.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(120px, 170px) 1fr auto",
                      gap: "var(--space-3)",
                      alignItems: "center",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: "var(--radius-lg)",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ color: "var(--mutedText)", fontSize: 13 }}>
                      {formatGigDate(g.starts_at)}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {artistName}
                      </div>
                      <div style={{ color: "var(--mutedText)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 3 }}>
                        {[venueName, g.city, g.title, fee].filter(Boolean).join(" · ")}
                      </div>
                    </div>

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
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </Page>
  );
}
