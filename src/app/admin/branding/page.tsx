"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Page, Card, Button, Input } from "@/components/ui";
import { THEME_PRESETS, ThemePreset } from "@/lib/themePresets";
import { getActiveAgencyId, setActiveAgencyId } from "@/lib/agencyContext";

type AgencyRow = {
  id: string;
  name: string;
  theme_preset: string;
  logo_url: string | null;
};

export default function BrandingPage() {
  const router = useRouter();

  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [agencyId, setAgencyIdState] = useState<string>("");
  const [preset, setPreset] = useState<ThemePreset>("obsidian");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentAgency = useMemo(() => agencies.find((a) => a.id === agencyId), [agencies, agencyId]);

  useEffect(() => {
    async function load() {
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // Only super users should access this page
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("is_super_user")
        .eq("id", user.id)
        .single();

      if (pErr) {
        setMessage(pErr.message);
        return;
      }

      if (!prof?.is_super_user) {
        setMessage("Not allowed. Super user only.");
        return;
      }

      const { data, error } = await supabase
        .from("agencies")
        .select("id, name, theme_preset, logo_url")
        .order("name", { ascending: true });

      if (error) {
        setMessage(error.message);
        return;
      }

      const rows = (data ?? []) as AgencyRow[];
      setAgencies(rows);

      const stored = getActiveAgencyId();
      const initialId = stored && rows.some((r) => r.id === stored) ? stored : rows[0]?.id ?? "";
      setAgencyIdState(initialId);

      const initial = rows.find((r) => r.id === initialId);
      if (initial) {
        setPreset((initial.theme_preset as ThemePreset) || "obsidian");
        setLogoUrl(initial.logo_url ?? "");
      }
    }

    load();
  }, [router]);

  useEffect(() => {
    if (!currentAgency) return;
    setPreset((currentAgency.theme_preset as ThemePreset) || "obsidian");
    setLogoUrl(currentAgency.logo_url ?? "");
  }, [currentAgency]);

  async function save() {
    setMessage(null);
    if (!agencyId) return;

    setBusy(true);

    const { error } = await supabase
      .from("agencies")
      .update({
        theme_preset: preset,
        logo_url: logoUrl.trim() ? logoUrl.trim() : null,
      })
      .eq("id", agencyId);

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Branding saved. Refresh /me to see it.");
    setActiveAgencyId(agencyId);

    // refresh local list
    const { data } = await supabase.from("agencies").select("id, name, theme_preset, logo_url").order("name");
    setAgencies((data ?? []) as AgencyRow[]);
  }

  return (
    <Page title="Branding (Super User)">
      {message && <p style={{ color: message.toLowerCase().includes("saved") ? "var(--primary)" : "#ff6b6b" }}>{message}</p>}

      <Card>
        <div style={{ display: "grid", gap: 12 }}>
          <label>
            Agency
            <select
              value={agencyId}
              onChange={(e) => setAgencyIdState(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                marginTop: 6,
              }}
            >
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Theme preset
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as ThemePreset)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                marginTop: 6,
              }}
            >
              {Object.keys(THEME_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <label>
            Logo URL (temporary)
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              autoComplete="off"
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving..." : "Save branding"}
            </Button>
            <Button variant="ghost" onClick={() => router.push("/me")}>
              Back to /me
            </Button>
          </div>

          <p style={{ color: "var(--mutedText)", fontSize: 13, marginTop: 8 }}>
            Presets are constrained to keep text readable. Logo upload via Supabase Storage comes next.
          </p>
        </div>
      </Card>
    </Page>
  );
}