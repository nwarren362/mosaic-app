"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Button, Card, Input, Page, StatusBadge } from "@/components/ui";

type TaskEntityType = "artist" | "venue" | "gig" | "contact" | "workflow";

type TaskRow = {
  id: string;
  agency_id: string;
  entity_type: TaskEntityType;
  entity_id: string;
  summary: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type ArtistLookupRow = {
  id: string;
  name: string;
};

type VenueLookupRow = {
  id: string;
  name: string;
};

type GigLookupRow = {
  id: string;
  title: string | null;
  artists: { name: string } | null;
};

function formatDate(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function taskDueTone(task: TaskRow) {
  if (task.completed_at) return "muted";
  if (!task.due_at) return "muted";

  const dueDate = new Date(task.due_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!Number.isNaN(dueDate.getTime()) && dueDate < today) {
    return "danger";
  }

  return "warning";
}

function taskDueLabel(task: TaskRow) {
  if (task.completed_at) return "Completed";
  if (!task.due_at) return "No due date";

  const dueDate = new Date(task.due_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!Number.isNaN(dueDate.getTime()) && dueDate < today) {
    return "Overdue";
  }

  return `Due ${formatDate(task.due_at)}`;
}

function entityHref(task: TaskRow) {
  if (task.entity_type === "artist") return `/artists/${task.entity_id}#activity`;
  if (task.entity_type === "venue") return `/venues/${task.entity_id}#activity`;
  if (task.entity_type === "gig") return `/gigs/${task.entity_id}#activity`;
  return null;
}

function entityLabel(entityType: TaskEntityType) {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1);
}

function taskEntityKey(task: TaskRow) {
  return `${task.entity_type}:${task.entity_id}`;
}

function notesPreview(notes: string | null) {
  const normalized = notes?.replace(/\s+/g, " ").trim();

  if (!normalized) return null;

  return normalized.length > 90 ? `${normalized.slice(0, 90)}…` : normalized;
}

export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    setMessage(null);

    const activeAgencyId = getActiveAgencyId();

    if (!activeAgencyId) {
      setTasks([]);
      setEntityLabels({});
      setMessage("No active agency selected. Go to /me and choose an agency.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("activity_log")
      .select("id, agency_id, entity_type, entity_id, summary, notes, due_at, completed_at, created_at")
      .eq("agency_id", activeAgencyId)
      .eq("activity_type", "task")
      .is("completed_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    setLoading(false);

    if (error || !data) {
      setTasks([]);
      setEntityLabels({});
      setMessage(error?.message ?? "Could not load tasks.");
      return;
    }

    const loadedTasks = data as TaskRow[];
    setTasks(loadedTasks);
    await loadEntityLabels(loadedTasks, activeAgencyId);
  }

  async function loadEntityLabels(loadedTasks: TaskRow[], agencyId: string) {
    const artistIds = loadedTasks
      .filter((task) => task.entity_type === "artist")
      .map((task) => task.entity_id);

    const venueIds = loadedTasks
      .filter((task) => task.entity_type === "venue")
      .map((task) => task.entity_id);

    const gigIds = loadedTasks
      .filter((task) => task.entity_type === "gig")
      .map((task) => task.entity_id);

    const [artistResult, venueResult, gigResult] = await Promise.all([
      artistIds.length > 0
        ? supabase.from("artists").select("id, name").eq("agency_id", agencyId).in("id", artistIds)
        : Promise.resolve({ data: [], error: null }),
      venueIds.length > 0
        ? supabase.from("venues").select("id, name").eq("agency_id", agencyId).in("id", venueIds)
        : Promise.resolve({ data: [], error: null }),
      gigIds.length > 0
        ? supabase
            .from("gigs")
            .select("id, title, artists:artists(name)")
            .eq("agency_id", agencyId)
            .in("id", gigIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (artistResult.error) console.warn("Failed to load artist task labels:", artistResult.error.message);
    if (venueResult.error) console.warn("Failed to load venue task labels:", venueResult.error.message);
    if (gigResult.error) console.warn("Failed to load gig task labels:", gigResult.error.message);

    const nextLabels: Record<string, string> = {};

    for (const artist of (artistResult.data ?? []) as ArtistLookupRow[]) {
      nextLabels[`artist:${artist.id}`] = artist.name;
    }

    for (const venue of (venueResult.data ?? []) as VenueLookupRow[]) {
      nextLabels[`venue:${venue.id}`] = venue.name;
    }

    for (const gig of (gigResult.data ?? []) as unknown as GigLookupRow[]) {
      nextLabels[`gig:${gig.id}`] = gig.title?.trim() || gig.artists?.name || "Untitled gig";
    }

    setEntityLabels(nextLabels);
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return tasks;

    return tasks.filter((task) => {
      const entityName = entityLabels[taskEntityKey(task)] ?? "";
      const haystack = `${task.summary} ${task.notes ?? ""} ${task.entity_type} ${entityName}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [entityLabels, query, tasks]);

  async function handleCompleteTask(task: TaskRow) {
    setCompletingTaskId(task.id);

    const completionNote = window.prompt("Completion note (optional)");
    if (completionNote === null) {
      setCompletingTaskId(null);
      return;
    }

    const completedAt = new Date().toISOString();
    const trimmedCompletionNote = completionNote.trim();
    const originalNotes = task.notes?.trim() ?? "";
    const nextNotes = trimmedCompletionNote
      ? [
          `Completed ${formatDate(completedAt)}`,
          "--------------------------------",
          trimmedCompletionNote,
          originalNotes
            ? ["", "--------------------------------", "Original task notes:", originalNotes].join("\n")
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : originalNotes;

    const { error } = await supabase
      .from("activity_log")
      .update({
        completed_at: completedAt,
        notes: nextNotes || null,
      })
      .eq("id", task.id)
      .eq("agency_id", task.agency_id);

    setCompletingTaskId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadTasks();
  }

  return (
    <Page title="Tasks">
      {message ? <p style={{ color: "var(--mutedText)" }}>{message}</p> : null}

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
          <h2 style={{ margin: 0 }}>Open tasks ({filteredTasks.length})</h2>

          <Button type="button" variant="secondary" onClick={loadTasks} disabled={loading}>
            Refresh
          </Button>
        </div>

        <Input
          placeholder="Search tasks…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ minWidth: 240 }}
        />
      </Card>

      <Card>
        {loading ? (
          <div style={{ color: "var(--mutedText)" }}>Loading tasks…</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ color: "var(--mutedText)" }}>No open tasks found.</div>
        ) : (
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {filteredTasks.map((task) => {
              const href = entityHref(task);
              const entityName = entityLabels[taskEntityKey(task)] ?? "Unknown";
              const preview = notesPreview(task.notes);

              const row = (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "var(--space-3)",
                    alignItems: "center",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "var(--radius-lg)",
                    padding: "12px 12px",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "var(--text)" }}>{task.summary}</div>
                    <div
                      style={{
                        color: "var(--mutedText)",
                        fontSize: 13,
                        marginTop: 4,
                        display: "flex",
                        gap: "var(--space-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>{entityLabel(task.entity_type)}</span>
                      <span>·</span>
                      <span>{entityName}</span>
                      <span>·</span>
                      <span>Created {formatDate(task.created_at)}</span>
                      {preview ? (
                        <>
                          <span>·</span>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 420,
                            }}
                            title={preview}
                          >
                            {preview}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: "var(--space-2)",
                      flexWrap: "wrap",
                    }}
                  >
                    <StatusBadge tone={taskDueTone(task)}>{taskDueLabel(task)}</StatusBadge>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={(event) => {
                        event.preventDefault();
                        void handleCompleteTask(task);
                      }}
                      disabled={completingTaskId === task.id}
                    >
                      {completingTaskId === task.id ? "Completing…" : "Complete"}
                    </Button>
                  </div>
                </div>
              );

              return href ? (
                <Link key={task.id} href={href} style={{ textDecoration: "none", color: "inherit" }}>
                  {row}
                </Link>
              ) : (
                <div key={task.id}>{row}</div>
              );
            })}
          </div>
        )}
      </Card>
    </Page>
  );
}