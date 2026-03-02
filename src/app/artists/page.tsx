"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  created_at: string;
};

export default function ArtistsPage() {
  const router = useRouter();

  const [agencyId, setAgencyId] = useState<string>("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  const canSubmit = useMemo(() => name.trim().length > 0 && !!agencyId, [name, agencyId]);

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

    const { data, error } = await supabase
      .from("artists")
      .select("id, agency_id, name, genre, contact_email, notes, created_at")
      .eq("agency_id", active)
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    setArtists((data ?? []) as Artist[]);
    setLoading(false);
  }

  async function createArtist(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!canSubmit) {
      setMessage("Please enter a name and ensure an active agency is selected.");
      return;
    }

    const { error } = await supabase.from("artists").insert({
      agency_id: agencyId,
      name: name.trim(),
      genre: genre.trim() ? genre.trim() : null,
      contact_email: contactEmail.trim() ? contactEmail.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    // clear form
    setName("");
    setGenre("");
    setContactEmail("");
    setNotes("");

    await load();
  }

  async function deleteArtist(id: string) {
    setMessage(null);

    const ok = confirm("Delete this artist? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase.from("artists").delete().eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }

    await load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page title="Artists">
      {message && (
        <p style={{ color: message.toLowerCase().includes("error") ? "#ff6b6b" : "var(--mutedText)" }}>
          {message}
        </p>
      )}

      <Card>
        <h2 style={{ marginBottom: "var(--space-3)" }}>Add artist</h2>

        <form onSubmit={createArtist} style={{ display: "grid", gap: "var(--space-3)", maxWidth: 720 }}>
          <label>
            Name
            <div style={{ marginTop: "var(--space-2)" }}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Iron Casket" />
            </div>
          </label>

          <label>
            Genre
            <div style={{ marginTop: "var(--space-2)" }}>
              <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="e.g. Metalcore" />
            </div>
          </label>

          <label>
            Contact email
            <div style={{ marginTop: "var(--space-2)" }}>
              <Input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. band@email.com"
              />
            </div>
          </label>

          <label>
            Notes
            <div style={{ marginTop: "var(--space-2)" }}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
          </label>

          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              Add artist
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/me")}>
              Back to /me
            </Button>
          </div>
        </form>
      </Card>

      <div style={{ marginTop: "var(--space-4)" }}>
        <Card>
          <h2 style={{ marginBottom: "var(--space-3)" }}>Artists</h2>

          {loading ? (
            <p style={{ color: "var(--mutedText)" }}>Loading…</p>
          ) : artists.length === 0 ? (
            <p style={{ color: "var(--mutedText)" }}>No artists yet. Add your first one above.</p>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {artists.map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-3)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "var(--font-size-md)", fontWeight: 700 }}><Link
  href={`/artists/${a.id}`}
  style={{
    fontWeight: 900,
    color: "var(--text)",
    textDecoration: "none",
  }}
>
  {a.name}
</Link></div>
                    <div style={{ color: "var(--mutedText)", fontSize: "var(--font-size-sm)" }}>
                      {a.genre || "—"}
                      {a.contact_email ? ` • ${a.contact_email}` : ""}
                    </div>
                    {a.notes ? (
                      <div style={{ marginTop: "var(--space-2)", color: "var(--mutedText)" }}>{a.notes}</div>
                    ) : null}
                  </div>

                  <Button variant="danger" type="button" onClick={() => deleteArtist(a.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}