"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { THEME_PRESETS, ThemePreset } from "@/lib/themePresets";
import { getActiveAgencyId } from "@/lib/agencyContext";
import AppShell from "@/components/AppShell";

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isSuperUser, setIsSuperUser] = useState(false);

  const [navOpen, setNavOpen] = useState(false);       // mobile drawer
  const [collapsed, setCollapsed] = useState(false);   // desktop sidebar collapse
  const [isMobile, setIsMobile] = useState(false);

  function applyTheme(preset: ThemePreset) {
    const vars = THEME_PRESETS[preset] ?? THEME_PRESETS.obsidian;
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(`--${k}`, v);
    }
  }

  useEffect(() => {
    // Track screen size for hamburger behavior
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    async function loadThemeAndHeader() {
      // Close mobile drawer on navigation
      setNavOpen(false);

      // Default vendor theme
      applyTheme("obsidian");
      setAgencyName(null);
      setLogoUrl(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setIsSuperUser(false);
        return;
      }

      // Super user flag
      const { data: prof } = await supabase.from("profiles").select("is_super_user").eq("id", user.id).single();
      setIsSuperUser(!!prof?.is_super_user);

      // Agency context
      const activeAgencyId = getActiveAgencyId();
      if (!activeAgencyId) return;

      const { data: agency, error } = await supabase
        .from("agencies")
        .select("name, theme_preset, logo_url")
        .eq("id", activeAgencyId)
        .single();

      if (error) return;

      setAgencyName(agency?.name ?? null);
      setLogoUrl(agency?.logo_url ?? null);

      const preset = (agency?.theme_preset as ThemePreset) || "obsidian";
      applyTheme(preset);
    }

    loadThemeAndHeader();
    window.addEventListener("focus", loadThemeAndHeader);
    return () => window.removeEventListener("focus", loadThemeAndHeader);
  }, [pathname]);

  function onHamburger() {
    if (isMobile) setNavOpen(true);
    else setCollapsed((v) => !v);
  }

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgb(15, 19, 28)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            width: "100%",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Hamburger (mobile drawer / desktop collapse) */}
            <button
              onClick={onHamburger}
              aria-label="Menu"
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--text)",
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              ☰
            </button>

            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Agency logo"
                style={{
                  height: 28,
                  width: "auto",
                  maxWidth: 120,
                  objectFit: "contain",
                }}
              />
            ) : null}

            <div
              style={{
                fontWeight: 900,
                letterSpacing: -0.4,
                fontSize: 16,
              }}
            >
              {agencyName ?? "Agency"}
            </div>
          </div>
        </div>
      </header>

      <AppShell
        isSuperUser={isSuperUser}
        navOpen={navOpen}
        setNavOpen={setNavOpen}
        collapsed={collapsed}
      >
        {children}
      </AppShell>
    </>
  );
}