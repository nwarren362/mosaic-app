"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { THEME_PRESETS, ThemePreset } from "@/lib/themePresets";

type AgencyThemeRow = {
  id: string;
  name: string;
  theme_preset: string | null;
  logo_url: string | null;
};

function applyPreset(presetKey: ThemePreset) {
  const vars = THEME_PRESETS[presetKey];
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v);
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadTheme() {
      // Default theme (vendor)
      applyPreset("obsidian");
      setAgencyName(null);
      setLogoUrl(null);

      const agencyId = getActiveAgencyId();
      if (!agencyId) return;

      // If user is not logged in, we *can't* read agencies from DB safely (RLS).
      // So on login/signup screens, we’ll show vendor branding unless user already has a session.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { data, error } = await supabase
        .from("agencies")
        .select("id, name, theme_preset, logo_url")
        .eq("id", agencyId)
        .single();

      if (error || !data) return;

      const row = data as AgencyThemeRow;
      const preset = (row.theme_preset ?? "obsidian") as ThemePreset;

      if (THEME_PRESETS[preset]) applyPreset(preset);
      setAgencyName(row.name);
      setLogoUrl(row.logo_url);
    }

    loadTheme();
  }, []);

  return (
    <>
      {/* Simple header */}
      <header
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Agency logo" style={{ height: 28, width: 28, borderRadius: 6 }} />
        ) : (
          <div style={{ height: 28, width: 28, borderRadius: 6, background: "var(--card)", border: "1px solid var(--border)" }} />
        )}

        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <strong style={{ fontSize: 14 }}>{agencyName ?? "Mosaic"}</strong>
          <span style={{ fontSize: 12, color: "var(--mutedText)" }}>
            {agencyName ? "Agency workspace" : "Mosaic platform"}
          </span>
        </div>
      </header>

      {children}
    </>
  );
}