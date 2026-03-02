"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Page, Card, Button, Input } from "@/components/ui";

type Artist = {
  id: string;
  agency_id: string;
  name: string;
  genre: string | null;
  contact_email: string | null;
  notes: string | null;
  image_url: string | null;
  status: "active" | "inactive" | null;
  created_at: string;
  updated_at: string;
};

type Gig = {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  status: "confirmed" | "cancelled" | "pending";
  fee_cents: number;
};

function GigStatusBadge({ status }: { status: "confirmed" | "pending" | "cancelled" }) {
  const styles: Record<string, { bg: string; border: string; text: string }> = {
    confirmed: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.22)", text: "rgba(134,239,172,0.95)" },
    pending: { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.22)", text: "rgba(253,230,138,0.95)" },
    cancelled: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.22)", text: "rgba(254,202,202,0.95)" },
  };

  const s = styles[status] ?? styles.pending;

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.text,
        fontWeight: 900,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "var(--radius-lg)",
        background: "rgba(255,255,255,0.03)",
        padding: "14px 14px",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--mutedText)", letterSpacing: 0.4, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900, letterSpacing: -0.6 }}>{value}</div>
      {hint && <div style={{ marginTop: 4, fontSize: 12, color: "var(--mutedText)" }}>{hint}</div>}
    </div>
  );
}

export default function ArtistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [agencyId, setAgencyId] = useState<string>("");

  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [upcomingGigs, setUpcomingGigs] = useState<Gig[]>([]);
  const [pastGigs, setPastGigs] = useState<Gig[]>([]);
  const [activeGigTab, setActiveGigTab] = useState<"upcoming" | "past">("upcoming");
  const [showAddGig, setShowAddGig] = useState(false);
  const [gigTitle, setGigTitle] = useState("");
  const [gigVenue, setGigVenue] = useState("");
  const [gigCity, setGigCity] = useState("");
  const [gigStartsAt, setGigStartsAt] = useState(""); // datetime-local value
  const [gigStatus, setGigStatus] = useState<"confirmed" | "pending" | "cancelled">("confirmed");
  const [gigFeePounds, setGigFeePounds] = useState<string>("0");
  const [gigSaving, setGigSaving] = useState(false);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editStatus, setEditStatus] = useState<"confirmed" | "pending" | "cancelled">("confirmed");
  const [editFeePounds, setEditFeePounds] = useState<string>("0");
  const [editSaving, setEditSaving] = useState(false);


  // editable fields
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [notes, setNotes] = useState("");

  const dirty = useMemo(() => {
    if (!artist) return false;
    return (
      name !== artist.name ||
      (genre || "") !== (artist.genre || "") ||
      (contactEmail || "") !== (artist.contact_email || "") ||
      (imageUrl || "") !== (artist.image_url || "") ||
      (status || "active") !== (artist.status || "active") ||
      (notes || "") !== (artist.notes || "")
    );
  }, [artist, name, genre, contactEmail, imageUrl, status, notes]);

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

    setAgencyId(active);

    // Note: If your artists table does NOT have image_url/status yet,
    // the select will fail. In that case, tell me and we’ll adjust.
    const { data, error } = await supabase
      .from("artists")
      .select("id, agency_id, name, genre, contact_email, notes, image_url, status, created_at, updated_at")
      .eq("id", id)
      .eq("agency_id", active)
      .single();

    if (error) {
      setMessage(error.message);
      setArtist(null);
      setLoading(false);
      return;
    }

    const a = data as Artist;
    setArtist(a);

    setName(a.name);
    setGenre(a.genre ?? "");
    setContactEmail(a.contact_email ?? "");
    setImageUrl(a.image_url ?? "");
    setStatus((a.status ?? "active") as "active" | "inactive");
    setNotes(a.notes ?? "");

    // Load gigs for this artist (upcoming + past)
const nowIso = new Date().toISOString();

const { data: upData, error: upErr } = await supabase
  .from("gigs")
  .select("id,title,venue,city,starts_at,status,fee_cents")
  .eq("agency_id", active)
  .eq("artist_id", id)
  .gte("starts_at", nowIso)
  .order("starts_at", { ascending: true })
  .limit(5);

if (upErr) {
  setMessage(upErr.message);
} else {
  setUpcomingGigs((upData ?? []) as Gig[]);
}

const { data: pastData, error: pastErr } = await supabase
  .from("gigs")
  .select("id,title,venue,city,starts_at,status,fee_cents")
  .eq("agency_id", active)
  .eq("artist_id", id)
  .lt("starts_at", nowIso)
  .order("starts_at", { ascending: false })
  .limit(5);

if (pastErr) {
  setMessage(pastErr.message);
} else {
  setPastGigs((pastData ?? []) as Gig[]);
}
    setLoading(false);
  }

  async function save() {
    if (!artist) return;
    setMessage(null);
    setSaving(true);

    const { error } = await supabase
      .from("artists")
      .update({
        name: name.trim(),
        genre: genre.trim() ? genre.trim() : null,
        contact_email: contactEmail.trim() ? contactEmail.trim() : null,
        image_url: imageUrl.trim() ? imageUrl.trim() : null,
        status: status,
        notes: notes.trim() ? notes.trim() : null,
      })
      .eq("id", artist.id)
      .eq("agency_id", agencyId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Saved.");
    await load();
  }

function toDatetimeLocalValue(iso: string) {
  // Converts ISO -> "YYYY-MM-DDTHH:mm" for datetime-local inputs
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function beginEditGig(g: Gig) {
  setEditingGig(g);
  setEditTitle(g.title ?? "");
  setEditVenue(g.venue ?? "");
  setEditCity(g.city ?? "");
  setEditStartsAt(toDatetimeLocalValue(g.starts_at));
  setEditStatus(g.status);
  setEditFeePounds(String(((g.fee_cents ?? 0) / 100).toFixed(2)));
}

async function saveGigEdits() {
  if (!editingGig) return;

  if (!editTitle.trim()) {
    setMessage("Please enter a gig title.");
    return;
  }
  if (!editStartsAt) {
    setMessage("Please choose a date/time.");
    return;
  }

  setMessage(null);
  setEditSaving(true);

  const feeCents = Math.round((Number(editFeePounds) || 0) * 100);
  const startsAtIso = new Date(editStartsAt).toISOString();

  const { error } = await supabase
    .from("gigs")
    .update({
      title: editTitle.trim(),
      venue: editVenue.trim() ? editVenue.trim() : null,
      city: editCity.trim() ? editCity.trim() : null,
      starts_at: startsAtIso,
      status: editStatus,
      fee_cents: feeCents,
    })
    .eq("id", editingGig.id)
    .eq("agency_id", agencyId);

  setEditSaving(false);

  if (error) {
    setMessage(error.message);
    return;
  }

  setEditingGig(null);
  await load(); // refresh gigs + KPIs
}

async function deleteGig() {
  if (!editingGig) return;
  const ok = confirm(`Delete gig "${editingGig.title}"? This cannot be undone.`);
  if (!ok) return;

  setMessage(null);
  setEditSaving(true);

  const { error } = await supabase
    .from("gigs")
    .delete()
    .eq("id", editingGig.id)
    .eq("agency_id", agencyId);

  setEditSaving(false);

  if (error) {
    setMessage(error.message);
    return;
  }

  setEditingGig(null);

  // Remove it from the UI immediately
  setUpcomingGigs((prev) => prev.filter((g) => g.id !== editingGig.id));
  setPastGigs((prev) => prev.filter((g) => g.id !== editingGig.id));

  // Then refresh from DB to keep KPIs perfect
  await load();

  }

  async function addGig() {
    if (!artist) return;

    setMessage(null);

    if (!gigTitle.trim()) {
      setMessage("Please enter a gig title.");
      return;
    }
    if (!gigStartsAt) {
      setMessage("Please choose a date/time for the gig.");
      return;
    }

    // Convert datetime-local -> ISO string
    const startsAtIso = new Date(gigStartsAt).toISOString();

    // Pounds -> cents
    const pounds = Number(gigFeePounds);
    const feeCents = Number.isFinite(pounds) ? Math.round(pounds * 100) : 0;

    setGigSaving(true);

    const { error } = await supabase.from("gigs").insert({
      agency_id: agencyId,
      artist_id: artist.id,
      title: gigTitle.trim(),
      venue: gigVenue.trim() ? gigVenue.trim() : null,
      city: gigCity.trim() ? gigCity.trim() : null,
      starts_at: startsAtIso,
      status: gigStatus,
      fee_cents: feeCents,
    });

    setGigSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    // Clear + close
    setGigTitle("");
    setGigVenue("");
    setGigCity("");
    setGigStartsAt("");
    setGigStatus("confirmed");
    setGigFeePounds("0");
    setShowAddGig(false);

    // Reload gigs + KPIs
    await load();
  }

  async function deleteArtist() {
    if (!artist) return;
    const ok = confirm(`Delete "${artist.name}"? This cannot be undone.`);
    if (!ok) return;

    const { error } = await supabase
      .from("artists")
      .delete()
      .eq("id", artist.id)
      .eq("agency_id", agencyId);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/artists");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Page title="Artist">
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        <Button variant="secondary" type="button" onClick={() => router.push("/artists")}>
          Back to Artists
        </Button>
        <Button variant="danger" type="button" onClick={deleteArtist} disabled={!artist}>
          Delete
        </Button>
      </div>

      {message && <p style={{ color: "var(--mutedText)" }}>{message}</p>}

      {loading ? (
        <Card>
          <p style={{ color: "var(--mutedText)" }}>Loading…</p>
        </Card>
      ) : !artist ? (
        <Card>
          <p style={{ color: "var(--mutedText)" }}>Artist not found (or you don’t have access).</p>
        </Card>
      ) : (
        <>
          {/* HERO */}
          <div
            style={{
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              boxShadow: "var(--shadow-strong)",
              marginBottom: "var(--space-4)",
            }}
          >
            <div
              style={{
                height: 160,
                background:
                  imageUrl
                    ? `linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.80)), url(${imageUrl}) center/cover`
                    : "linear-gradient(135deg, rgba(124,58,237,0.20), rgba(0,0,0,0.90))",
              }}
            />
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 950, letterSpacing: -1 }}>{artist.name}</div>
                  <div style={{ color: "var(--mutedText)", marginTop: 4 }}>
                    {artist.genre ?? "No genre"}
                  </div>
                </div>

                <div
                  style={{
                    alignSelf: "center",
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: status === "active" ? "rgba(34,197,94,0.10)" : "rgba(148,163,184,0.10)",
                    color: status === "active" ? "rgba(134,239,172,0.95)" : "rgba(203,213,225,0.95)",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    fontSize: 12,
                    letterSpacing: 0.6,
                  }}
                >
                  {status}
                </div>
              </div>
            </div>
          </div>

          {/* KPI ROW (placeholders for now) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "var(--space-3)",
              marginBottom: "var(--space-4)",
            }}
          >
            <KpiCard label="Members" value="—" hint="Coming soon" />
            <KpiCard label="Upcoming gigs" value={String(upcomingGigs.length)} hint="Next 5 shown below" />
            <KpiCard
              label="Revenue"
              value={`£${((upcomingGigs.reduce((sum, g) => sum + (g.fee_cents || 0), 0)) / 100).toFixed(2)}`}
              hint="Upcoming only (for now)"
            />
            <KpiCard label="Status" value={status === "active" ? "Active" : "Inactive"} />
          </div>

          {/* MAIN GRID */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
            }}
          >
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Members</div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button variant="secondary" type="button" disabled>
                    Invite
                  </Button>
                  <Button variant="primary" type="button" disabled>
                    + Add
                  </Button>
                </div>
              </div>

              <div style={{ marginTop: "var(--space-3)", color: "var(--mutedText)" }}>
                No members yet. (We’ll add this after gigs.)
              </div>
            </Card>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Gigs</div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button variant="secondary" type="button" disabled>
                    View all
                  </Button>
                  <Button
                    variant={showAddGig ? "secondary" : "primary"}
                    type="button"
                    onClick={() => setShowAddGig((v) => !v)}
                  >
                    {showAddGig ? "Cancel" : "+ Add gig"}
                  </Button>
                </div>
              </div>

              <div style={{ marginTop: "var(--space-3)" }}>
                {showAddGig && (
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: "var(--radius-lg)",
                      padding: "12px 12px",
                      background: "rgba(255,255,255,0.02)",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
                      <label>
                        Title
                        <div style={{ marginTop: 6 }}>
                          <Input value={gigTitle} onChange={(e) => setGigTitle(e.target.value)} placeholder="e.g. The Victoria Inn" />
                        </div>
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                        <label>
                          Venue
                          <div style={{ marginTop: 6 }}>
                            <Input value={gigVenue} onChange={(e) => setGigVenue(e.target.value)} placeholder="e.g. The Victoria Inn" />
                          </div>
                        </label>

                        <label>
                          City
                          <div style={{ marginTop: 6 }}>
                            <Input value={gigCity} onChange={(e) => setGigCity(e.target.value)} placeholder="e.g. Derby" />
                          </div>
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)" }}>
                        <label>
                          Starts at
                          <div style={{ marginTop: 6 }}>
                            <input
                              type="datetime-local"
                              value={gigStartsAt}
                              onChange={(e) => setGigStartsAt(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid rgba(255,255,255,0.14)",
                                background: "rgba(255,255,255,0.03)",
                                color: "var(--text)",
                              }}
                            />
                          </div>
                        </label>

                        <label>
                          Status
                          <div style={{ marginTop: 6 }}>
                            <select
                              value={gigStatus}
                              onChange={(e) => setGigStatus(e.target.value as any)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid rgba(255,255,255,0.14)",
                                background: "rgba(255,255,255,0.03)",
                                color: "var(--text)",
                              }}
                            >
                              <option value="confirmed">confirmed</option>
                              <option value="pending">pending</option>
                              <option value="cancelled">cancelled</option>
                            </select>
                          </div>
                        </label>

                        <label>
                          Fee (£)
                          <div style={{ marginTop: 6 }}>
                            <Input value={gigFeePounds} onChange={(e) => setGigFeePounds(e.target.value)} />
                          </div>
                        </label>
                      </div>

                      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginTop: 4 }}>
                        <Button type="button" variant="primary" onClick={addGig} disabled={gigSaving}>
                          {gigSaving ? "Saving…" : "Save gig"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowAddGig(false)} disabled={gigSaving}>
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
  <Button
    type="button"
    variant={activeGigTab === "upcoming" ? "primary" : "secondary"}
    onClick={() => setActiveGigTab("upcoming")}
  >
    Upcoming ({upcomingGigs.length})
  </Button>

  <Button
    type="button"
    variant={activeGigTab === "past" ? "primary" : "secondary"}
    onClick={() => setActiveGigTab("past")}
  >
    Past ({pastGigs.length})
  </Button>
</div>

<div style={{ marginTop: "var(--space-3)", display: "grid", gap: "var(--space-2)" }}>
  {(activeGigTab === "upcoming" ? upcomingGigs : pastGigs).length === 0 ? (
    <div style={{ color: "var(--mutedText)" }}>No gigs yet.</div>
  ) : (
    (activeGigTab === "upcoming" ? upcomingGigs : pastGigs).map((g) => (
      <div
        key={g.id}
        onClick={() => beginEditGig(g)}
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "var(--radius-lg)",
          padding: "12px 12px",
          background: "rgba(255,255,255,0.02)",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>{g.title}</div>
          <GigStatusBadge status={g.status} />
        </div>

        <div style={{ marginTop: 6, color: "var(--mutedText)", fontSize: 14 }}>
          {new Date(g.starts_at).toLocaleString()} · {g.city ?? "—"} · {g.venue ?? "—"} · £{(g.fee_cents / 100).toFixed(2)}
        </div>
      </div>
    ))
  )}
</div>

                {editingGig && (
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "var(--radius-lg)",
                      padding: 12,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>Edit gig</div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingGig(null)}
                        disabled={editSaving}
                      >
                        Close
                      </Button>
                    </div>

                    <div style={{ height: 10 }} />

                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
                      <label>
                        Title
                        <div style={{ marginTop: 6 }}>
                          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                        </div>
                      </label>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                        <label>
                          Venue
                          <div style={{ marginTop: 6 }}>
                            <Input value={editVenue} onChange={(e) => setEditVenue(e.target.value)} />
                          </div>
                        </label>

                        <label>
                          City
                          <div style={{ marginTop: 6 }}>
                            <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                          </div>
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)" }}>
                        <label>
                          Starts at
                          <div style={{ marginTop: 6 }}>
                            <input
                              type="datetime-local"
                              value={editStartsAt}
                              onChange={(e) => setEditStartsAt(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid rgba(255,255,255,0.14)",
                                background: "rgba(255,255,255,0.03)",
                                color: "var(--text)",
                              }}
                            />
                          </div>
                        </label>

                        <label>
                          Status
                          <div style={{ marginTop: 6 }}>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as any)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid rgba(255,255,255,0.14)",
                                background: "rgba(255,255,255,0.03)",
                                color: "var(--text)",
                              }}
                            >
                              <option value="confirmed">confirmed</option>
                              <option value="pending">pending</option>
                              <option value="cancelled">cancelled</option>
                            </select>
                          </div>
                        </label>

                        <label>
                          Fee (£)
                          <div style={{ marginTop: 6 }}>
                            <Input value={editFeePounds} onChange={(e) => setEditFeePounds(e.target.value)} />
                          </div>
                        </label>
                      </div>

                      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginTop: 6 }}>
                        <Button type="button" variant="primary" onClick={saveGigEdits} disabled={editSaving}>
                          {editSaving ? "Saving…" : "Save changes"}
                        </Button>

                        <Button type="button" variant="danger" onClick={deleteGig} disabled={editSaving}>
                          Delete gig
                        </Button>
                      </div>

                      <div style={{ color: "var(--mutedText)", fontSize: 12 }}>
                        Tip: If delete fails for an agent user, that’s expected (admin-only delete policy).
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* EDITABLE DETAILS */}
          <div style={{ marginTop: "var(--space-4)" }}>
            <Card>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: "var(--space-3)" }}>Details</div>

              <div style={{ display: "grid", gap: "var(--space-3)", maxWidth: 800 }}>
                <label>
                  Name
                  <div style={{ marginTop: "var(--space-2)" }}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                </label>

                <label>
                  Genre
                  <div style={{ marginTop: "var(--space-2)" }}>
                    <Input value={genre} onChange={(e) => setGenre(e.target.value)} />
                  </div>
                </label>

                <label>
                  Contact email
                  <div style={{ marginTop: "var(--space-2)" }}>
                    <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                  </div>
                </label>

                <label>
                  Image URL (banner)
                  <div style={{ marginTop: "var(--space-2)" }}>
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                  </div>
                </label>

                <label>
                  Status
                  <div style={{ marginTop: "var(--space-2)" }}>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.03)",
                        color: "var(--text)",
                      }}
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </div>
                </label>

                <label>
                  Notes
                  <div style={{ marginTop: "var(--space-2)" }}>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={6}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.03)",
                        color: "var(--text)",
                        outline: "none",
                      }}
                    />
                  </div>
                </label>

                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <Button variant="primary" type="button" onClick={save} disabled={!dirty || saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>

                  <Button variant="secondary" type="button" onClick={load} disabled={saving}>
                    Reset
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Mobile responsiveness */}
          <style jsx>{`
            @media (max-width: 900px) {
              div[style*="grid-template-columns: 1fr 1fr"] {
                grid-template-columns: 1fr !important;
              }
              div[style*="repeat(4"] {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
        </>
      )}
    </Page>
  );
}