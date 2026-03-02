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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentAgency = useMemo(
    () => agencies.find((a) => a.id === agencyId),
    [agencies, agencyId]
  );

  useEffect(() => {
    async function load() {
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // Super user check
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
      const initialId =
        stored && rows.some((r) => r.id === stored) ? stored : rows[0]?.id ?? "";

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
    setSelectedFile(null);
  }, [currentAgency]);

  async function refreshAgencyList() {
    const { data } = await supabase
      .from("agencies")
      .select("id, name, theme_preset, logo_url")
      .order("name", { ascending: true });
    setAgencies((data ?? []) as AgencyRow[]);
  }

  async function savePresetAndUrl() {
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
    await refreshAgencyList();
  }

  async function uploadLogoAndSave() {
    setMessage(null);

    if (!agencyId) {
      setMessage("Select an agency first.");
      return;
    }
    if (!selectedFile) {
      setMessage("Choose a logo file first.");
      return;
    }

    setBusy(true);

    try {
      const ext = (selectedFile.name.split(".").pop() || "png").toLowerCase();
      const path = `${agencyId}/logo.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("agency-logos")
        .upload(path, selectedFile, { upsert: true });

      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage
        .from("agency-logos")
        .getPublicUrl(path);

      const publicUrl = pub.publicUrl;

      const { error: saveErr } = await supabase
        .from("agencies")
        .update({ logo_url: publicUrl })
        .eq("id", agencyId);

      if (saveErr) throw new Error(saveErr.message);

      setLogoUrl(publicUrl);
      setSelectedFile(null);

      setMessage("Logo uploaded and saved. Refresh /me to see it.");
      setActiveAgencyId(agencyId);
      await refreshAgencyList();
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to upload logo.");
    } finally {
      setBusy(false);
    }
  }

  const messageIsError =
    !!message &&
    (message.toLowerCase().includes("failed") ||
      message.toLowerCase().includes("not allowed") ||
      message.toLowerCase().includes("error"));

  return (
    <Page title="Branding (Super User)">
      {message && (
        <p style={{ color: messageIsError ? "#ff6b6b" : "var(--primary)" }}>
          {message}
        </p>
      )}

      <Card>
        <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: 680 }}>
          <label>
            Agency
            <select
              value={agencyId}
              onChange={(e) => setAgencyIdState(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                marginTop: "var(--space-2)",
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
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                marginTop: "var(--space-2)",
              }}
            >
              {Object.keys(THEME_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          {/* Logo upload */}
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <label style={{ fontSize: "var(--font-size-sm)" }}>
              Logo upload (recommended)
            </label>

            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Button
                variant="secondary"
                type="button"
                onClick={() =>
                  document.getElementById("logoFileInput")?.click()
                }
              >
                Choose file
              </Button>

              <span
                style={{
                  color: "var(--mutedText)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {selectedFile ? selectedFile.name : "No file selected"}
              </span>
            </div>

            <input
              id="logoFileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: "none" }}
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />

            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Button
                onClick={uploadLogoAndSave}
                disabled={busy || !selectedFile}
                variant="primary"
                type="button"
              >
                {busy ? "Uploading..." : "Upload logo"}
              </Button>

              <Button
                onClick={() => setSelectedFile(null)}
                disabled={busy}
                variant="secondary"
                type="button"
              >
                Clear selection
              </Button>
            </div>

            <p style={{ color: "var(--mutedText)", fontSize: "var(--font-size-sm)" }}>
              Recommended: PNG/SVG with transparent background. Height around 64–128px works best.
            </p>

            <p style={{ color: "var(--mutedText)", fontSize: "var(--font-size-sm)" }}>
              Uploaded to Supabase Storage bucket <code>agency-logos</code>, then saved as{" "}
              <code>agencies.logo_url</code>.
            </p>
          </div>

          <label>
            Logo URL (fallback / advanced)
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              autoComplete="off"
            />
          </label>

          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button onClick={savePresetAndUrl} disabled={busy} variant="secondary" type="button">
              Save preset + URL
            </Button>
            <Button variant="secondary" type="button" onClick={() => router.push("/me")}>
              Back to /me
            </Button>
          </div>

          {logoUrl && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <p style={{ color: "var(--mutedText)", fontSize: "var(--font-size-sm)" }}>
                Current logo preview:
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Agency logo preview"
                style={{
                  height: 56,
                  width: "auto",
                  maxWidth: 260,
                  objectFit: "contain",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                }}
              />
            </div>
          )}
        </div>
      </Card>
    </Page>
  );
}
