"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import {
  Page,
  Card,
  Button,
  Input,
  Textarea,
  Field,
  IconButton,
  SegmentedControl,
  StatusBadge,
} from "@/components/ui";
import { ClearFiltersButton, FilterChip, FilterPanel, FilterRow } from "@/components/filters";

type ArtistStatus = "active" | "inactive";
type StatusFilter = "active" | "inactive" | "all";

type AgencyTag = {
  id: string;
  name: string;
  type: string;
  sort_order: number | null;
};

type ArtistTagRow = {
  artist_id: string;
  tag_id: string;
};

type Artist = {
  id: string;
  agency_id: string;
  name: string;
  genre: string | null;
  home_city: string | null;
  n_piece: number | null;
  region_tag_ids: string[];
  notes: string | null;
  status: ArtistStatus | null;
  image_url: string | null;
  banner_position_x: number | null;
  banner_position_y: number | null;
  banner_zoom: number | null;
  created_at: string;
};

export default function ArtistsPage() {
  const router = useRouter();

  const [agencyId, setAgencyId] = useState<string>("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [regionTags, setRegionTags] = useState<AgencyTag[]>([]);
  const [selectedRegionTagIds, setSelectedRegionTagIds] = useState<string[]>([]);
  const [maxBandSizeFilter, setMaxBandSizeFilter] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [notes, setNotes] = useState("");

  const canSubmit = useMemo(
    () => name.trim().length > 0 && !!agencyId,
    [name, agencyId]
  );

  const filteredArtists = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return artists.filter((artist) => {
      const artistStatus = artist.status ?? "active";
      const matchesStatus = statusFilter === "all" || artistStatus === statusFilter;

      const matchesRegion =
        selectedRegionTagIds.length === 0 ||
        selectedRegionTagIds.some((tagId) => artist.region_tag_ids.includes(tagId));

      const maxBandSize = maxBandSizeFilter === "all" ? null : Number(maxBandSizeFilter);
      const matchesBandSize =
        maxBandSize == null || (artist.n_piece != null && artist.n_piece <= maxBandSize);

      const searchableText = [artist.name, artist.genre, artist.home_city, artist.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesStatus && matchesRegion && matchesBandSize && matchesSearch;
    });
  }, [artists, searchText, statusFilter, selectedRegionTagIds, maxBandSizeFilter]);

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
      .select("id, agency_id, name, genre, home_city, n_piece, notes, status, image_url, banner_position_x, banner_position_y, banner_zoom, created_at")
      .eq("agency_id", active)
      .order("name", { ascending: true });

    if (error) {
      setMessage(error.message);
      setArtists([]);
      setLoading(false);
      return;
    }

    const artistRows = (data ?? []) as Omit<Artist, "region_tag_ids">[];

    const { data: tagData, error: tagError } = await supabase
      .from("agency_tags")
      .select("id, name, type, sort_order")
      .eq("agency_id", active)
      .eq("type", "region")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (tagError) {
      setMessage(tagError.message);
      setRegionTags([]);
    } else {
      setRegionTags((tagData ?? []) as AgencyTag[]);
    }

    const { data: artistTagData, error: artistTagError } = await supabase
      .from("artist_tags")
      .select("artist_id, tag_id")
      .eq("agency_id", active);

    if (artistTagError) {
      setMessage(artistTagError.message);
      setArtists(artistRows.map((artist) => ({ ...artist, region_tag_ids: [] })) as Artist[]);
      setLoading(false);
      return;
    }

    const artistTagRows = (artistTagData ?? []) as ArtistTagRow[];
    const regionTagIdSet = new Set(((tagData ?? []) as AgencyTag[]).map((tag) => tag.id));

    const regionTagsByArtist = artistTagRows.reduce<Record<string, string[]>>((acc, row) => {
      if (!regionTagIdSet.has(row.tag_id)) return acc;

      if (!acc[row.artist_id]) acc[row.artist_id] = [];
      acc[row.artist_id].push(row.tag_id);
      return acc;
    }, {});

    setArtists(
      artistRows.map((artist) => ({
        ...artist,
        region_tag_ids: regionTagsByArtist[artist.id] ?? [],
      })) as Artist[]
    );

    setLoading(false);
  }

  function resetForm() {
    setName("");
    setGenre("");
    setNotes("");
  }

  function toggleAddForm() {
    const opening = !showAddForm;

    if (opening) {
      resetForm();
    }

    setShowAddForm((value) => !value);
  }

  function toggleRegionFilter(tagId: string) {
    setSelectedRegionTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
  }

  function clearAdvancedFilters() {
    setSelectedRegionTagIds([]);
    setMaxBandSizeFilter("all");
  }

  async function createArtist(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!canSubmit) {
      setMessage("Please enter an artist name.");
      return;
    }

    const { data, error } = await supabase
      .from("artists")
      .insert({
        agency_id: agencyId,
        name: name.trim(),
        genre: genre.trim() ? genre.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    resetForm();
    setShowAddForm(false);

    if (data?.id) {
      router.push(`/artists/${data.id}`);
      return;
    }

    await load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAdvancedFilterCount =
    selectedRegionTagIds.length + (maxBandSizeFilter === "all" ? 0 : 1);

  return (
    <Page title="">
      {message ? (
        <p style={{ color: message.toLowerCase().includes("error") ? "#ff6b6b" : "var(--mutedText)" }}>
          {message}
        </p>
      ) : null}

      {showAddForm ? (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <h2 style={{ marginBottom: "var(--space-3)" }}>Add artist</h2>

          <form onSubmit={createArtist} style={{ display: "grid", gap: "var(--space-4)", maxWidth: 760 }}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Iron Casket" />
              </Field>

              <Field label="Genre">
                <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="e.g. Metalcore" />
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
                style={{ minHeight: 110, resize: "vertical" }}
              />
            </Field>

            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Button type="submit" variant="primary" disabled={!canSubmit}>
                Add artist
              </Button>
              <Button type="button" variant="secondary" onClick={toggleAddForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

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
          <h2 style={{ margin: 0 }}>Artists ({filteredArtists.length})</h2>

          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <SegmentedControl
              ariaLabel="Artist status filter"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
                { label: "All", value: "all" },
              ]}
            />

            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAdvancedFilters((value) => !value)}
            >
              {showAdvancedFilters
                ? "Hide filters"
                : activeAdvancedFilterCount > 0
                  ? `Filters (${activeAdvancedFilterCount})`
                  : "Filters"}
            </Button>

            <IconButton
              label={showAddForm ? "Cancel add artist" : "Add artist"}
              variant={showAddForm ? "secondary" : "primary"}
              type="button"
              onClick={toggleAddForm}
            >
              <Plus size={16} />
            </IconButton>
          </div>
        </div>

        <div
          style={{
            maxWidth: 520,
            marginBottom: "var(--space-4)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Search size={16} style={{ color: "var(--mutedText)", flex: "0 0 auto" }} />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search artists by name, genre, city or notes…"
          />
        </div>

        {showAdvancedFilters ? (
          <FilterPanel>
            <FilterRow label="Region">
              <FilterChip
                selected={selectedRegionTagIds.length === 0}
                onClick={() => setSelectedRegionTagIds([])}
              >
                All regions
              </FilterChip>

              {regionTags.map((tag) => (
                <FilterChip
                  key={tag.id}
                  selected={selectedRegionTagIds.includes(tag.id)}
                  onClick={() => toggleRegionFilter(tag.id)}
                >
                  {tag.name}
                </FilterChip>
              ))}
            </FilterRow>

            <FilterRow label="Band size">
              {[
                { label: "Any size", value: "all" },
                { label: "Up to 2-piece", value: "2" },
                { label: "Up to 3-piece", value: "3" },
                { label: "Up to 4-piece", value: "4" },
                { label: "Up to 5-piece", value: "5" },
              ].map((option) => (
                <FilterChip
                  key={option.value}
                  selected={maxBandSizeFilter === option.value}
                  onClick={() => setMaxBandSizeFilter(option.value)}
                >
                  {option.label}
                </FilterChip>
              ))}
            </FilterRow>

            <ClearFiltersButton
              visible={activeAdvancedFilterCount > 0}
              onClick={clearAdvancedFilters}
            />
          </FilterPanel>
        ) : null}

        {loading ? (
          <p style={{ color: "var(--mutedText)" }}>Loading…</p>
        ) : artists.length === 0 ? (
          <p style={{ color: "var(--mutedText)" }}>No artists yet. Use the + button to add your first artist.</p>
        ) : filteredArtists.length === 0 ? (
          <p style={{ color: "var(--mutedText)" }}>No artists match the current filters.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "var(--space-3)",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 320px))",
              justifyContent: "start",
            }}
          >
            {filteredArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artists/${artist.id}`}
                style={{ color: "inherit", textDecoration: "none", display: "block" }}
              >
                <article
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.24)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  }}
                  style={{
                    minHeight: 190,
                    border: "1px solid var(--border)",
                    borderRadius: 18,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.02)",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    transition: "transform 140ms ease, border-color 140ms ease, background 140ms ease",
                  }}
                >
                  <div
                    style={{
                      height: 96,
                      borderBottom: "1px solid var(--border)",
                      position: "relative",
                      overflow: "hidden",
                      background:
                        "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(255,255,255,0.04))",
                    }}
                  >
                    {artist.image_url ? (
                      <img
                        src={artist.image_url}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: `${artist.banner_position_x ?? 50}% ${artist.banner_position_y ?? 50}%`,
                          transform: `scale(${(artist.banner_zoom ?? 100) / 100})`,
                          transformOrigin: `${artist.banner_position_x ?? 50}% ${artist.banner_position_y ?? 50}%`,
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "var(--space-3)",
                          fontSize: 28,
                          fontWeight: 950,
                          letterSpacing: -0.5,
                          textAlign: "center",
                          color: "var(--text)",
                        }}
                      >
                        {artist.name}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "var(--space-3)", display: "grid", gap: "var(--space-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {artist.name}
                        </div>
                        <div style={{ color: "var(--mutedText)", fontSize: 13, marginTop: 2 }}>
                          {[artist.genre || "No genre", artist.home_city, artist.n_piece ? `${artist.n_piece}-piece` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>

                      <StatusBadge tone={(artist.status ?? "active") === "active" ? "success" : "muted"}>
                        {artist.status ?? "active"}
                      </StatusBadge>
                    </div>

                    {artist.notes ? (
                      <div
                        style={{
                          color: "var(--mutedText)",
                          fontSize: 13,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {artist.notes}
                      </div>
                    ) : null}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
