"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Page, Card, Button, Input } from "@/components/ui";

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
  artists: { id: string; name: string } | null;
};

function StatusBadge({ status }: { status: GigRow["status"] }) {
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

export default function GigsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [agencyId, setAgencyId] = useState<string>("");

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");

  const [gigs, setGigs] = useState<GigRow[]>([]);

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

    const nowIso = new Date().toISOString();

    let q = supabase
      .from("gigs")
      .select(
        "id,agency_id,artist_id,title,venue,city,starts_at,status,fee_cents, artists:artists(id,name)"
      )
      .eq("agency_id", active)
      .order("starts_at", { ascending: tab === "upcoming" });

    if (tab === "upcoming") q = q.gte("starts_at", nowIso);
    else q = q.lt("starts_at", nowIso);

    // (Search is done client-side for simplicity; we can move it server-side later.)
    const { data, error } = await q.limit(200);

    if (error) {
      setMessage(error.message);
      setGigs([]);
      setLoading(false);
      return;
    }

    setGigs((data ?? []) as unknown as GigRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
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

  return (
    <Page title="Gigs">
      {message && <p style={{ color: "var(--mutedText)" }}>{message}</p>}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            type="button"
            variant={tab === "upcoming" ? "primary" : "secondary"}
            onClick={() => setTab("upcoming")}
          >
            Upcoming
          </Button>
          <Button
            type="button"
            variant={tab === "past" ? "primary" : "secondary"}
            onClick={() => setTab("past")}
          >
            Past
          </Button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Input
            placeholder="Search title, venue, city, artist…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <Button type="button" variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>
            {tab === "upcoming" ? "Upcoming gigs" : "Past gigs"}{" "}
            <span style={{ color: "var(--mutedText)", fontWeight: 700 }}>({filtered.length})</span>
          </div>
          <div style={{ color: "var(--mutedText)", fontSize: 12 }}>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {loading ? (
          <div style={{ color: "var(--mutedText)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "var(--mutedText)" }}>No gigs found.</div>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {filtered.map((g) => (
              <Link
                key={g.id}
                href={`/gigs/${g.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
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
                    <StatusBadge status={g.status} />
                  </div>

                  <div style={{ marginTop: 6, color: "var(--mutedText)", fontSize: 14 }}>
                    <span style={{ color: "var(--text)", fontWeight: 800 }}>
                      {g.artists?.name ?? "Unknown artist"}
                    </span>{" "}
                    · {new Date(g.starts_at).toLocaleString()} · {g.city ?? "—"} · {g.venue ?? "—"} · £
                    {(g.fee_cents / 100).toFixed(2)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}