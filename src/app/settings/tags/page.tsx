"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Page, Card, Button, Field, Input, Textarea, IconButton } from "@/components/ui";

type AgencyTagType = {
  id: string;
  agency_id: string;
  type: string;
  label: string;
  description: string | null;
  sort_order: number | null;
  active: boolean | null;
  created_at: string;
};

type AgencyTag = {
  id: string;
  type: string;
};

function toTypeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function TagsSettingsPage() {
  const router = useRouter();

  const [agencyId, setAgencyId] = useState("");
  const [tagTypes, setTagTypes] = useState<AgencyTagType[]>([]);
  const [tags, setTags] = useState<AgencyTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityDescription, setNewEntityDescription] = useState("");
  const [addingEntity, setAddingEntity] = useState(false);

  const tagCounts = useMemo(() => {
    return tags.reduce<Record<string, number>>((acc, tag) => {
      acc[tag.type] = (acc[tag.type] ?? 0) + 1;
      return acc;
    }, {});
  }, [tags]);

  async function load() {
    setLoading(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      router.push("/login");
      return;
    }

    const activeAgencyId = getActiveAgencyId();

    if (!activeAgencyId) {
      setLoading(false);
      setMessage("No active agency selected. Go to /me and choose an agency.");
      return;
    }

    setAgencyId(activeAgencyId);

    const { data: typeData, error: typeError } = await supabase
      .from("agency_tag_types")
      .select("id, agency_id, type, label, description, sort_order, active, created_at")
      .eq("agency_id", activeAgencyId)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (typeError) {
      setMessage(typeError.message);
      setTagTypes([]);
      setLoading(false);
      return;
    }

    const { data: tagData, error: tagError } = await supabase
      .from("agency_tags")
      .select("id, type")
      .eq("agency_id", activeAgencyId);

    if (tagError) {
      setMessage(tagError.message);
      setTags([]);
    } else {
      setTags((tagData ?? []) as AgencyTag[]);
    }

    setTagTypes((typeData ?? []) as AgencyTagType[]);
    setLoading(false);
  }

  async function addEntity() {
    const label = newEntityName.trim();
    const description = newEntityDescription.trim();
    const type = toTypeSlug(label);

    if (!label || !type || !agencyId || addingEntity) return;

    const duplicate = tagTypes.some((entity) => entity.type === type);

    if (duplicate) {
      setMessage("A tag entity with that name already exists.");
      return;
    }

    setAddingEntity(true);
    setMessage(null);

    const nextSortOrder =
      tagTypes.length > 0 ? Math.max(...tagTypes.map((item) => item.sort_order ?? 0)) + 1 : 1;

    const { error } = await supabase
      .from("agency_tag_types")
      .insert({
        agency_id: agencyId,
        type,
        label,
        description: description || null,
        sort_order: nextSortOrder,
        active: true,
      });

    setAddingEntity(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewEntityName("");
    setNewEntityDescription("");
    setShowAddForm(false);
    router.push(`/settings/tags/${type}`);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page title="">
      {message ? (
        <p style={{ color: message.toLowerCase().includes("error") ? "#ff6b6b" : "var(--mutedText)" }}>
          {message}
        </p>
      ) : null}

      {showAddForm ? (
        <Card style={{ marginBottom: "var(--space-4)" }}>
          <h2 style={{ marginBottom: "var(--space-3)" }}>Add tag entity</h2>

          <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: 760 }}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Entity name" required>
                <Input
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="e.g. Venue attributes"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEntity();
                    }
                  }}
                />
              </Field>
            </div>

            <Field label="Description">
              <Textarea
                value={newEntityDescription}
                onChange={(e) => setNewEntityDescription(e.target.value)}
                placeholder="Describe how this tag group should be used."
                style={{ minHeight: 90, resize: "vertical" }}
              />
            </Field>

            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Button
                type="button"
                variant="primary"
                onClick={addEntity}
                disabled={!newEntityName.trim() || addingEntity || !agencyId}
              >
                {addingEntity ? "Adding…" : "Add entity"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
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
          <div>
            <h2 style={{ margin: 0 }}>Tag entities ({tagTypes.length})</h2>
            <p style={{ color: "var(--mutedText)", margin: "6px 0 0", fontSize: 14 }}>
              Define reusable agency-specific tag groups for use within the application.
            </p>
          </div>

          <IconButton
            label={showAddForm ? "Cancel add entity" : "Add entity"}
            variant={showAddForm ? "secondary" : "primary"}
            type="button"
            onClick={() => setShowAddForm((value) => !value)}
          >
            <Plus size={16} />
          </IconButton>
        </div>

        {loading ? (
          <p style={{ color: "var(--mutedText)" }}>Loading…</p>
        ) : tagTypes.length === 0 ? (
          <p style={{ color: "var(--mutedText)" }}>No tag entities yet. Use the + button to add one.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "var(--space-3)",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 320px))",
              justifyContent: "start",
            }}
          >
            {tagTypes.map((entity) => {
              const active = entity.active ?? true;

              return (
                <Link
                  key={entity.id}
                  href={`/settings/tags/${entity.type}`}
                  style={{ color: "inherit", textDecoration: "none", display: "block" }}
                >
                  <article
                    style={{
                      minHeight: 150,
                      border: "1px solid var(--border)",
                      borderRadius: 18,
                      padding: "var(--space-3)",
                      background: "rgba(255,255,255,0.02)",
                      display: "grid",
                      gap: "var(--space-2)",
                      opacity: active ? 1 : 0.55,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{entity.label}</div>
                      <div style={{ color: "var(--mutedText)", fontSize: 13 }}>
                        {tagCounts[entity.type] ?? 0} tags
                      </div>
                    </div>

                    {entity.description ? (
                      <div
                        style={{
                          color: "var(--mutedText)",
                          fontSize: 13,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {entity.description}
                      </div>
                    ) : (
                      <div style={{ color: "var(--mutedText)", fontSize: 13 }}>No description.</div>
                    )}
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </Page>
  );
}
