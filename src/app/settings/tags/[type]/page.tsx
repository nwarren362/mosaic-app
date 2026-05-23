"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Page, Card, Button, Field, Input, Textarea, SegmentedControl } from "@/components/ui";

type TagStatusFilter = "active" | "inactive" | "all";

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
  agency_id: string;
  name: string;
  type: string;
  sort_order: number | null;
  active: boolean | null;
  created_at: string;
};

export default function TagEntityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const type = String(params.type ?? "");

  const [agencyId, setAgencyId] = useState("");
  const [entity, setEntity] = useState<AgencyTagType | null>(null);
  const [tags, setTags] = useState<AgencyTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [entityActive, setEntityActive] = useState(true);

  const [statusFilter, setStatusFilter] = useState<TagStatusFilter>("active");
  const [showAddTagForm, setShowAddTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTagId, setSavingTagId] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (!entity) return false;

    return (
      label !== entity.label ||
      description !== (entity.description ?? "") ||
      entityActive !== (entity.active ?? true)
    );
  }, [description, entity, entityActive, label]);

  const filteredTags = useMemo(() => {
    return tags.filter((tag) => {
      const isActive = tag.active ?? true;
      if (statusFilter === "active") return isActive;
      if (statusFilter === "inactive") return !isActive;
      return true;
    });
  }, [statusFilter, tags]);

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

    const { data: entityData, error: entityError } = await supabase
      .from("agency_tag_types")
      .select("id, agency_id, type, label, description, sort_order, active, created_at")
      .eq("agency_id", activeAgencyId)
      .eq("type", type)
      .single();

    if (entityError) {
      setMessage(entityError.message);
      setEntity(null);
      setLoading(false);
      return;
    }

    const loadedEntity = entityData as AgencyTagType;
    setEntity(loadedEntity);
    setLabel(loadedEntity.label);
    setDescription(loadedEntity.description ?? "");
    setEntityActive(loadedEntity.active ?? true);

    const { data: tagData, error: tagError } = await supabase
      .from("agency_tags")
      .select("id, agency_id, name, type, sort_order, active, created_at")
      .eq("agency_id", activeAgencyId)
      .eq("type", type)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (tagError) {
      setMessage(tagError.message);
      setTags([]);
    } else {
      setTags((tagData ?? []) as AgencyTag[]);
    }

    setLoading(false);
  }

  async function save() {
    if (!entity || saving) return;

    const nextLabel = label.trim();
    const nextDescription = description.trim();

    if (!nextLabel) {
      setMessage("Entity name is required.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("agency_tag_types")
      .update({
        label: nextLabel,
        description: nextDescription || null,
        active: entityActive,
      })
      .eq("id", entity.id)
      .eq("agency_id", agencyId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEntity({
      ...entity,
      label: nextLabel,
      description: nextDescription || null,
      active: entityActive,
    });
    setLabel(nextLabel);
    setDescription(nextDescription);
    setMessage("Entity saved.");
  }

  async function saveAndClose() {
    await save();
    router.push("/settings/tags");
  }

  function navigateBack() {
    if (dirty) {
      const ok = confirm("You have unsaved changes. Leave this page and discard them?");
      if (!ok) return;
    }

    router.push("/settings/tags");
  }

  async function addTag() {
    const name = newTagName.trim();
    if (!name || !agencyId || addingTag || !entity) return;

    const duplicate = tags.some((tag) => tag.name.trim().toLowerCase() === name.toLowerCase());

    if (duplicate) {
      setMessage(`A ${entity.label} tag with that name already exists.`);
      return;
    }

    setAddingTag(true);
    setMessage(null);

    const nextSortOrder =
      tags.length > 0 ? Math.max(...tags.map((tag) => tag.sort_order ?? 0)) + 1 : 1;

    const { data, error } = await supabase
      .from("agency_tags")
      .insert({
        agency_id: agencyId,
        name,
        type,
        sort_order: nextSortOrder,
        active: true,
      })
      .select("id, agency_id, name, type, sort_order, active, created_at")
      .single();

    setAddingTag(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTags((current) => [...current, data as AgencyTag]);
    setNewTagName("");
    setShowAddTagForm(false);
  }

  async function renameTag(tag: AgencyTag, nextName: string) {
    const name = nextName.trim();
    if (!name || savingTagId) return;
    if (name === tag.name) return;

    const duplicate = tags.some(
      (item) => item.id !== tag.id && item.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setMessage(`A ${entity?.label ?? "tag"} tag with that name already exists.`);
      return;
    }

    setSavingTagId(tag.id);
    setMessage(null);

    const { error } = await supabase
      .from("agency_tags")
      .update({ name })
      .eq("id", tag.id)
      .eq("agency_id", agencyId);

    setSavingTagId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTags((current) => current.map((item) => (item.id === tag.id ? { ...item, name } : item)));
  }

  async function setTagActive(tag: AgencyTag, active: boolean) {
    if (savingTagId) return;

    setSavingTagId(tag.id);
    setMessage(null);

    const { error } = await supabase
      .from("agency_tags")
      .update({ active })
      .eq("id", tag.id)
      .eq("agency_id", agencyId);

    setSavingTagId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setTags((current) =>
      current.map((item) => (item.id === tag.id ? { ...item, active } : item))
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <Page title="">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginBottom: "var(--space-4)",
        }}
      >
        <div>
        <h1 style={{ margin: 0 }}>{entity?.label ?? "Tag entity"}</h1>
        </div>
            

        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Button variant="secondary" type="button" onClick={navigateBack}>
            Back
          </Button>
          <Button variant="secondary" type="button" onClick={save} disabled={!dirty || saving || !entity}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="primary" type="button" onClick={saveAndClose} disabled={saving || !entity}>
            {saving ? "Saving…" : "Save & close"}
          </Button>
        </div>
      </div>

      {message ? (
        <p style={{ color: message.toLowerCase().includes("error") ? "#ff6b6b" : "var(--mutedText)" }}>
          {message}
        </p>
      ) : null}

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{ marginBottom: "var(--space-3)" }}>Details</h2>

        {loading ? (
          <p style={{ color: "var(--mutedText)" }}>Loading…</p>
        ) : !entity ? (
          <p style={{ color: "var(--mutedText)" }}>Tag entity not found.</p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "var(--space-3)",
                alignItems: "end",
              }}
            >
              <Field label="Entity name">
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </Field>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, paddingBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={entityActive}
                  onChange={(e) => setEntityActive(e.target.checked)}
                />
                Active
              </label>
            </div>

            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ minHeight: 100, resize: "vertical" }}
              />
            </Field>
          </div>
        )}
      </Card>

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
          <h2 style={{ margin: 0 }}>Tags ({filteredTags.length})</h2>

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
            <SegmentedControl
              ariaLabel="Tag status filter"
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
            variant={showAddTagForm ? "secondary" : "primary"}
            onClick={() => setShowAddTagForm((value) => !value)}
            >
            <Plus size={15} />
            </Button>
          </div>
        </div>

        {showAddTagForm ? (
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "flex-end",
              flexWrap: "wrap",
              marginBottom: "var(--space-4)",
            }}
          >
            <Field label={`Add ${entity?.label.toLowerCase() ?? "tag"} tag`}>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g. North East"
                style={{ minWidth: 260 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
            </Field>

            <Button
              type="button"
              variant="primary"
              onClick={addTag}
              disabled={!newTagName.trim() || addingTag || !agencyId || !entity}
            >
              {addingTag ? "Adding…" : "Add"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddTagForm(false);
                setNewTagName("");
              }}
            >
              Cancel
            </Button>
          </div>
        ) : null}

        {loading ? (
          <p style={{ color: "var(--mutedText)" }}>Loading…</p>
        ) : filteredTags.length === 0 ? (
          <p style={{ color: "var(--mutedText)" }}>
            {tags.length === 0 ? "No tags yet. Use Add tag to create the first one." : "No tags match the current filter."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {filteredTags.map((tag) => {
              const active = tag.active ?? true;
              const savingThisTag = savingTagId === tag.id;

              return (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  active={active}
                  saving={savingThisTag}
                  disabled={!!savingTagId && !savingThisTag}
                  onRename={(name) => renameTag(tag, name)}
                  onSetActive={(nextActive) => setTagActive(tag, nextActive)}
                />
              );
            })}
          </div>
        )}
      </Card>
    </Page>
  );
}

function TagRow({
  tag,
  active,
  saving,
  disabled,
  onRename,
  onSetActive,
}: {
  tag: AgencyTag;
  active: boolean;
  saving: boolean;
  disabled: boolean;
  onRename: (name: string) => void;
  onSetActive: (active: boolean) => void;
}) {
  const [draftName, setDraftName] = useState(tag.name);
  const [draftActive, setDraftActive] = useState(active);

  useEffect(() => {
    setDraftName(tag.name);
    setDraftActive(active);
  }, [tag.name, active]);

  const nameDirty = draftName.trim() !== tag.name;
  const activeDirty = draftActive !== active;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "var(--space-3)",
        alignItems: "center",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "10px 12px",
        background: active ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Input
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        disabled={saving || disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onRename(draftName);
          }
        }}
      />

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={draftActive}
            disabled={saving || disabled}
            onChange={(e) => {
              const nextActive = e.target.checked;
              setDraftActive(nextActive);
              onSetActive(nextActive);
            }}
          />
          Active
        </label>

        {nameDirty ? (
          <Button type="button" variant="secondary" onClick={() => onRename(draftName)} disabled={saving || disabled}>
            <Save size={15} />
            Save
          </Button>
        ) : null}

        {activeDirty ? (
          <span style={{ color: "var(--mutedText)", fontSize: 12 }}>Saving…</span>
        ) : null}
      </div>
    </div>
  );
}
