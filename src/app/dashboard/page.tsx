"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Page, Card, Button } from "@/components/ui";

type GigRow = {
  id: string;
  artist_id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  status: "confirmed" | "pending" | "cancelled";
  fee_cents: number;
};

function KpiCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "accent" }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "var(--radius-lg)",
        background:
          tone === "accent"
            ? "linear-gradient(135deg, rgba(124,58,237,0.20), rgba(0,0,0,0.15))"
            : "rgba(255,255,255,0.03)",
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

function startOfWeek(d: Date) {
  // Monday start (UK-friendly)
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [agencyId, setAgencyId] = useState<string>("");
  const [agencyName, setAgencyName] = useState<string>("");

  const [activeArtists, setActiveArtists] = useState<number>(0);
  const [weekGigs, setWeekGigs] = useState<GigRow[]>([]);
  const [upcomingGigs, setUpcomingGigs] = useState<GigRow[]>([]);

  const revenueThisWeek = useMemo(() => {
    const cents = weekGigs.reduce((sum, g) => sum + (g.fee_cents || 0), 0);
    return `£${(cents / 100).toFixed(2)}`;
  }, [weekGigs]);

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

    const { data: agencyRow } = await supabase
      .from("agencies")
      .select("name")
      .eq("id", active)
      .single();

    setAgencyName(agencyRow?.name ?? active);

    // 1) Active artists count (status = 'active' OR status null treated as active)
    const { count: artistCount, error: artistErr } = await supabase
      .from("artists")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", active)
      .or("status.eq.active,status.is.null");

    if (artistErr) {
      setMessage(artistErr.message);
    } else {
      setActiveArtists(artistCount ?? 0);
    }

    // Date range for “this week”
    const now = new Date();
    const wkStart = startOfWeek(now).toISOString();
    const wkEnd = endOfWeek(now).toISOString();

    // 2) Gigs this week
    const { data: wkData, error: wkErr } = await supabase
      .from("gigs")
      .select("id,artist_id,title,venue,city,starts_at,status,fee_cents")
      .eq("agency_id", active)
      .gte("starts_at", wkStart)
      .lt("starts_at", wkEnd)
      .order("starts_at", { ascending: true })
      .limit(20);

    if (wkErr) {
      setMessage(wkErr.message);
      setWeekGigs([]);
    } else {
      setWeekGigs((wkData ?? []) as GigRow[]);
    }

    // 3) Upcoming gigs (next 5)
    const { data: upData, error: upErr } = await supabase
      .from("gigs")
      .select("id,artist_id,title,venue,city,starts_at,status,fee_cents")
      .eq("agency_id", active)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5);

    if (upErr) {
      setMessage(upErr.message);
      setUpcomingGigs([]);
    } else {
      setUpcomingGigs((upData ?? []) as GigRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page title="Dashboard">
      {message && <p style={{ color: "var(--mutedText)" }}>{message}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
        <div style={{ color: "var(--mutedText)" }}>
          <div style={{ color: "var(--mutedText)" }}>
            Agency: <span style={{ color: "var(--text)", fontWeight: 900 }}>{agencyName || agencyId}</span>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "var(--space-3)",
          marginBottom: "var(--space-4)",
        }}
      >
        <KpiCard label="Active artists" value={loading ? "…" : String(activeArtists)} tone="accent" />
        <KpiCard label="Gigs this week" value={loading ? "…" : String(weekGigs.length)} tone="accent" />
        <KpiCard label="Revenue this week" value={loading ? "…" : revenueThisWeek} hint="Sum of fees (this week)" tone="accent" />
        <KpiCard label="Open tasks" value="—" hint="Coming soon" tone="accent" />
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--space-4)" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Upcoming gigs</div>
            <Link href="/gigs" style={{ color: "var(--mutedText)", textDecoration: "none", fontWeight: 800 }}>
              View all →
            </Link>
          </div>

          <div style={{ marginTop: "var(--space-3)", display: "grid", gap: "var(--space-2)" }}>
            {loading ? (
              <div style={{ color: "var(--mutedText)" }}>Loading…</div>
            ) : upcomingGigs.length === 0 ? (
              <div style={{ color: "var(--mutedText)" }}>No upcoming gigs yet.</div>
            ) : (
              upcomingGigs.map((g) => (
                <div
                  key={g.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "var(--radius-lg)",
                    padding: "12px 12px",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{g.title}</div>
                    <div style={{ color: "var(--mutedText)", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
                      {g.status}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, color: "var(--mutedText)", fontSize: 14 }}>
                    {new Date(g.starts_at).toLocaleString()} · {g.city ?? "—"} · {g.venue ?? "—"} · £
                    {(g.fee_cents / 100).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Recent activity</div>
          <div style={{ marginTop: "var(--space-3)", color: "var(--mutedText)" }}>
            Coming soon. (We’ll add an activity_log table and wire this up.)
          </div>

          <div style={{ height: 18 }} />

          <div style={{ fontWeight: 900, fontSize: 18 }}>Urgent tasks</div>
          <div style={{ marginTop: "var(--space-3)", color: "var(--mutedText)" }}>
            Coming soon. (We’ll add a tasks table and role-based assignment.)
          </div>
        </Card>
      </div>

      {/* Mobile */}
      <style jsx>{`
        @media (max-width: 900px) {
          div[style*="repeat(4"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          div[style*="grid-template-columns: 1.3fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Page>
  );
}