"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Page, Card, Button, Input } from "@/components/ui";

type ArtistOption = { id: string; name: string };

type GigRow = {
  id: string;
  agency_id: string;
  artist_id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  status: "confirmed" | "pending" | "cancelled";
  fee_cents: number;
  notes: string | null;
};

function centsFromPounds(input: string) {
  const v = Number(input);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100);
}

function poundsFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function GigDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const gigId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [artists, setArtists] = useState<ArtistOption[]>([]);

  // Form state
  const [artistId, setArtistId] = useState("");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState(""); // yyyy-mm-dd
  const [time, setTime] = useState("20:00");
  const [status, setStatus] = useState<GigRow["status"]>("pending");
  const [fee, setFee] = useState("0.00");
  const [notes, setNotes] = useState("");

  const startsAtIso = useMemo(() => {
    // Combine date + time into ISO. We store as timestamptz. This is “good enough” for now.
    if (!date) return "";
    const t = time || "20:00";
    const local = new Date(`${date}T${t}:00`);
    return local.toISOString();
  }, [date, time]);

  async function load() {
    setMessage(null);
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      router.push("/login");
      return;
    }

    const activeAgency = getActiveAgencyId();
    if (!activeAgency) {
      setLoading(false);
      setMessage("No active agency selected. Go to /me and choose an agency.");
      return;
    }

    // Load artists (for dropdown)
    const { data: artistRows, error: artistErr } = await supabase
      .from("artists")
      .select("id,name")
      .eq("agency_id", activeAgency)
      .order("name", { ascending: true });

    if (artistErr) {
      setMessage(artistErr.message);
      setArtists([]);
    } else {
      setArtists((artistRows ?? []) as ArtistOption[]);
    }

    // Load gig
    const { data: gig, error: gigErr } = await supabase
      .from("gigs")
      .select("id,agency_id,artist_id,title,venue,city,starts_at,status,fee_cents,notes")
      .eq("id", gigId)
      .single();

    if (gigErr) {
      setMessage(gigErr.message);
      setLoading(false);
      return;
    }

    const g = gig as GigRow;

    setArtistId(g.artist_id);
    setTitle(g.title ?? "");
    setVenue(g.venue ?? "");
    setCity(g.city ?? "");
    setStatus(g.status ?? "pending");
    setFee(poundsFromCents(g.fee_cents ?? 0));
    setNotes(g.notes ?? "");

    // Split datetime into date+time for editing
    const d = new Date(g.starts_at);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
    setTime(`${hh}:${mi}`);

    setLoading(false);
  }

  async function save() {
    setMessage(null);
    setSaving(true);

    if (!artistId) {
      setMessage("Please select an artist.");
      setSaving(false);
      return;
    }
    if (!title.trim()) {
      setMessage("Please enter a gig title.");
      setSaving(false);
      return;
    }
    if (!date) {
      setMessage("Please choose a date.");
      setSaving(false);
      return;
    }

    const payload = {
      artist_id: artistId,
      title: title.trim(),
      venue: venue.trim() || null,
      city: city.trim() || null,
      starts_at: startsAtIso,
      status,
      fee_cents: centsFromPounds(fee),
      notes: notes.trim() || null,
    };

    const { error } = await supabase.from("gigs").update(payload).eq("id", gigId);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setMessage("Saved.");
  }

  async function deleteGig() {
    const ok = confirm("Delete this gig? This cannot be undone.");
    if (!ok) return;

    setMessage(null);
    setSaving(true);

    const { error } = await supabase.from("gigs").delete().eq("id", gigId);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push("/gigs");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page title="Gig">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/gigs" style={{ textDecoration: "none" }}>
            <Button type="button" variant="secondary">
              Back to Gigs
            </Button>
          </Link>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button type="button" variant="danger" onClick={deleteGig} disabled={saving || loading}>
            Delete
          </Button>
          <Button type="button" onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {message && <p style={{ color: "var(--mutedText)" }}>{message}</p>}

      <Card>
        {loading ? (
          <div style={{ color: "var(--mutedText)" }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>Artist</div>
              <select
                value={artistId}
                onChange={(e) => setArtistId(e.target.value)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.03)",
                  color: "var(--text)",
                }}
              >
                <option value="">Select…</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>Title</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Victoria Inn — Derby" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>Venue</div>
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. The Victoria Inn" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>City</div>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Derby" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>Date</div>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>Performance time</div>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>Fee (£)</div>
                <Input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>Status</div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.03)",
                    color: "var(--text)",
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "var(--mutedText)", fontWeight: 800 }}>Comments</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Load-in time, soundcheck, promoter notes…"
                style={{
                  marginTop: 6,
                  width: "100%",
                  minHeight: 110,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.03)",
                  color: "var(--text)",
                  resize: "vertical",
                }}
              />
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}