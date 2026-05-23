"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Page, Card, Button, Input, IconButton, Field, Select, SegmentedControl, StatusBadge } from "@/components/ui";
import { ClearFiltersButton, FilterChip, FilterPanel, FilterRow } from "@/components/filters";

type VenueStatus = "new" | "approved" | "preferred" | "inactive";
type StatusFilter = "active" | "inactive" | "all";
type LifecycleFilter = "all" | "new" | "approved" | "preferred";

type Venue = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  display_address: string | null;
  status: VenueStatus | null;
  region_tag_ids: string[];
  attribute_tag_ids: string[];
};

type AgencyTag = {
  id: string;
  name: string;
  type: string;
};

type VenueTagRow = {
  venue_id: string;
  tag_id: string;
};

function venueStatusLabel(status: VenueStatus | null | undefined) {
  if (!status) return "New";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedRegionTagIds, setSelectedRegionTagIds] = useState<string[]>([]);
  const [selectedAttributeTagIds, setSelectedAttributeTagIds] = useState<string[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");

  const [regionTags, setRegionTags] = useState<AgencyTag[]>([]);
  const [attributeTags, setAttributeTags] = useState<AgencyTag[]>([]);

  const [showAddForm, setShowAddForm] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("UK");
  const [loading, setLoading] = useState(false);

  const [selectedRegionTagId, setSelectedRegionTagId] = useState("");

  useEffect(() => {
    loadVenueFilterTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionTags, attributeTags]);

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 0);
    }
  }, [showAddForm]);
  async function loadVenueFilterTags() {
    const agencyId = getActiveAgencyId();
    if (!agencyId) return;

    const { data, error } = await supabase
      .from("agency_tags")
      .select("id, name, type")
      .eq("agency_id", agencyId)
      .eq("active", true)
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!error && data) {
      const tags = data as AgencyTag[];
      setRegionTags(tags.filter((tag) => tag.type === "region"));
      setAttributeTags(tags.filter((tag) => tag.type !== "region"));
    }
  }

  async function loadVenues() {
    const agencyId = getActiveAgencyId();
    if (!agencyId) return;

    const { data, error } = await supabase
      .from("venues")
      .select("id, name, city, country, display_address, status")
      .eq("agency_id", agencyId)
      .order("name");

    if (error || !data) {
      setVenues([]);
      return;
    }

    const venueRows = data as Omit<Venue, "region_tag_ids" | "attribute_tag_ids">[];

    const { data: venueTagData, error: venueTagError } = await supabase
      .from("venue_tags")
      .select("venue_id, tag_id")
      .eq("agency_id", agencyId);

    if (venueTagError || !venueTagData) {
      setVenues(
        venueRows.map((venue) => ({
          ...venue,
          region_tag_ids: [],
          attribute_tag_ids: [],
        }))
      );
      return;
    }

    const venueTagRows = venueTagData as VenueTagRow[];
    const regionTagIdSet = new Set(regionTags.map((tag) => tag.id));
    const attributeTagIdSet = new Set(attributeTags.map((tag) => tag.id));

    const tagsByVenue = venueTagRows.reduce<
      Record<string, { region: string[]; attributes: string[] }>
    >((acc, row) => {
      if (!acc[row.venue_id]) acc[row.venue_id] = { region: [], attributes: [] };

      if (regionTagIdSet.has(row.tag_id)) {
        acc[row.venue_id].region.push(row.tag_id);
      }

      if (attributeTagIdSet.has(row.tag_id)) {
        acc[row.venue_id].attributes.push(row.tag_id);
      }

      return acc;
    }, {});

    setVenues(
      venueRows.map((venue) => ({
        ...venue,
        region_tag_ids: tagsByVenue[venue.id]?.region ?? [],
        attribute_tag_ids: tagsByVenue[venue.id]?.attributes ?? [],
      }))
    );
  }

  const filteredVenues = useMemo(() => {
    const q = search.trim().toLowerCase();

    return venues.filter((v) => {
      const venueStatus = v.status ?? "new";
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "inactive" ? venueStatus === "inactive" : venueStatus !== "inactive");

      const matchesLifecycle =
        lifecycleFilter === "all" || venueStatus === lifecycleFilter;

      const matchesRegion =
        selectedRegionTagIds.length === 0 ||
        selectedRegionTagIds.some((tagId) => v.region_tag_ids.includes(tagId));

      const matchesAttributes =
        selectedAttributeTagIds.length === 0 ||
        selectedAttributeTagIds.every((tagId) => v.attribute_tag_ids.includes(tagId));

      const matchesSearch =
        !q ||
        [v.name, v.city, v.country, v.display_address, venueStatusLabel(v.status)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      return matchesStatus && matchesLifecycle && matchesRegion && matchesAttributes && matchesSearch;
    });
  }, [venues, search, statusFilter, lifecycleFilter, selectedRegionTagIds, selectedAttributeTagIds]);

  const activeAdvancedFilterCount =
    selectedRegionTagIds.length +
    selectedAttributeTagIds.length +
    (lifecycleFilter === "all" ? 0 : 1);

  function toggleRegionFilter(tagId: string) {
    setSelectedRegionTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
  }

  function toggleAttributeFilter(tagId: string) {
    setSelectedAttributeTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
  }

  function clearAdvancedFilters() {
    setSelectedRegionTagIds([]);
    setSelectedAttributeTagIds([]);
    setLifecycleFilter("all");
  }

  async function handleCreateVenue() {
    const agencyId = getActiveAgencyId();

    if (!agencyId || !name.trim()) return;

    setLoading(true);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("venues")
        .insert({
          agency_id: agencyId,
          name: name.trim(),
          city: city.trim() || null,
          country: country.trim() || "UK",
          created_by: user.id,
          updated_by: user.id,
          record_owner_id: user.id,
        })
        .select()
        .single();

      if (error) return;

      if (selectedRegionTagId && data?.id) {
        const { error: tagError } = await supabase.from("venue_tags").insert({
          agency_id: agencyId,
          venue_id: data.id,
          tag_id: selectedRegionTagId,
        });

        if (tagError) {
          console.warn("Venue created, but failed to save region tag:", tagError.message);
        }
      }

      setName("");
      setCity("");
      setCountry("UK");
      setSelectedRegionTagId("");
      setShowAddForm(false);
      await loadVenues();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page title="">
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
          <h2 style={{ margin: 0 }}>Venues ({filteredVenues.length})</h2>

          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <SegmentedControl
              ariaLabel="Venue status filter"
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
              label="Add venue"
              variant={showAddForm ? "secondary" : "primary"}
              onClick={() => setShowAddForm((v) => !v)}
            >
              <Plus size={16} />
            </IconButton>
          </div>
        </div>

        <Input
          placeholder="Search venues"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />

        {showAdvancedFilters ? (
          <FilterPanel style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
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

            <FilterRow label="Status">
              {[
                { label: "All statuses", value: "all" },
                { label: "New", value: "new" },
                { label: "Approved", value: "approved" },
                { label: "Preferred", value: "preferred" },
              ].map((option) => (
                <FilterChip
                  key={option.value}
                  selected={lifecycleFilter === option.value}
                  onClick={() => setLifecycleFilter(option.value as LifecycleFilter)}
                >
                  {option.label}
                </FilterChip>
              ))}
            </FilterRow>

            {attributeTags.length > 0 ? (
              <FilterRow label="Venue attributes">
                {attributeTags.map((tag) => (
                  <FilterChip
                    key={tag.id}
                    selected={selectedAttributeTagIds.includes(tag.id)}
                    onClick={() => toggleAttributeFilter(tag.id)}
                  >
                    {tag.name}
                  </FilterChip>
                ))}
              </FilterRow>
            ) : null}

            <ClearFiltersButton
              visible={activeAdvancedFilterCount > 0}
              onClick={clearAdvancedFilters}
            />
          </FilterPanel>
        ) : null}
      </Card>

      {/* Add form */}
      {showAddForm && (
        <Card style={{ marginTop: "var(--space-4)" }}>
          <div style={{ display: "grid", gap: "var(--space-3)", maxWidth: 600 }}>
            <Field label="Venue name">
              <Input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>

            <Field label="Region tag">
              <Select
                value={selectedRegionTagId}
                onChange={(e) => setSelectedRegionTagId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {regionTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Country">
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={handleCreateVenue} disabled={loading}>
                {loading ? "Adding…" : "Add"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddForm(false);
                  setName("");
                  setCity("");
                  setCountry("UK");
                  setSelectedRegionTagId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Grid */}
      <div
        style={{
          marginTop: "var(--space-4)",
          display: "grid",
          gap: "var(--space-3)",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        {filteredVenues.map((venue) => (
          <Link
            key={venue.id}
            href={`/venues/${venue.id}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <Card>
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 800, color: "var(--text)" }}>{venue.name}</div>
                  <StatusBadge tone={(venue.status ?? "new") === "inactive" ? "muted" : "success"}>
                    {venueStatusLabel(venue.status)}
                  </StatusBadge>
                </div>

                <div style={{ fontSize: 13, color: "var(--mutedText)" }}>
                  {[venue.city, venue.country].filter(Boolean).join(" · ") || "No location"}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Page>
  );
}