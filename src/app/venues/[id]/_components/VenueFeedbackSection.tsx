"use client";

import { useMemo, useState } from "react";
import { MessageSquarePlus, Star, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  SectionCard,
  Field,
  Input,
  Textarea,
  Select,
  Button,
  Badge,
  InlineAction,
  InfoTile,
  SectionActions,
  ActionTextLink,
} from "@/components/ui";
import type { Artist, Gig, Venue, VenueFeedback } from "../_lib/types";
import {
  artistNameById,
  formatDateTime,
  formatGigDate,
  gigLabelById,
} from "../_lib/formatters";
import { logVenueActivity } from "../_lib/activity";
import StarRatingInput from "./StarRatingInput";

type Props = {
  venue: Venue;
  feedbackItems: VenueFeedback[];
  artists: Artist[];
  gigs: Gig[];
  onFeedbackChanged: () => Promise<void>;
};

export default function VenueFeedbackSection({
  venue,
  feedbackItems,
  artists,
  gigs,
  onFeedbackChanged,
}: Props) {
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [feedbackType, setFeedbackType] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackArtistId, setFeedbackArtistId] = useState("");
  const [feedbackGigId, setFeedbackGigId] = useState("");
  const [viewingFeedbackId, setViewingFeedbackId] = useState<string | null>(null);
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<string[]>([]);
  const [deletingFeedback, setDeletingFeedback] = useState(false);

  const canAddFeedback = useMemo(
    () => feedbackContent.trim().length > 0 && !addingFeedback,
    [feedbackContent, addingFeedback]
  );

  const allSelected =
    feedbackItems.length > 0 && selectedFeedbackIds.length === feedbackItems.length;

  function toggleSelected(feedbackId: string) {
    setSelectedFeedbackIds((current) =>
      current.includes(feedbackId)
        ? current.filter((id) => id !== feedbackId)
        : [...current, feedbackId]
    );
  }

  function toggleSelectAll() {
    setSelectedFeedbackIds(allSelected ? [] : feedbackItems.map((item) => item.id));
  }

  async function handleAddFeedback() {
    setAddingFeedback(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      setAddingFeedback(false);
      return;
    }

    if (!user) {
      alert("You must be signed in to add feedback.");
      setAddingFeedback(false);
      return;
    }

    const trimmedType = feedbackType.trim();
    const trimmedContent = feedbackContent.trim();

    if (!trimmedContent) {
      alert("Feedback content is required.");
      setAddingFeedback(false);
      return;
    }

    const { error } = await supabase.from("venue_feedback").insert({
      agency_id: venue.agency_id,
      venue_id: venue.id,
      author_id: user.id,
      gig_id: feedbackGigId || null,
      artist_id: feedbackArtistId || null,
      feedback_type: trimmedType || null,
      rating: feedbackRating,
      content: trimmedContent,
    });

    if (error) {
      alert(error.message);
      setAddingFeedback(false);
      return;
    }

    await logVenueActivity({
      venue,
      activityType: "feedback_added",
      summary: `Added feedback${trimmedType ? ` (${trimmedType})` : ""}.`,
      metadata: {
        feedback_type: trimmedType || null,
        rating: feedbackRating,
        artist_id: feedbackArtistId || null,
        gig_id: feedbackGigId || null,
      },
    });

    setFeedbackType("");
    setFeedbackRating(null);
    setFeedbackContent("");
    setFeedbackArtistId("");
    setFeedbackGigId("");
    setShowAddForm(false);

    await onFeedbackChanged();
    setAddingFeedback(false);
  }

  async function handleDeleteSingle(item: VenueFeedback) {
    const confirmed = window.confirm("Delete this feedback?");
    if (!confirmed) return;

    setDeletingFeedback(true);

    const { error } = await supabase.from("venue_feedback").delete().eq("id", item.id);

    if (error) {
      alert(error.message);
      setDeletingFeedback(false);
      return;
    }

    await logVenueActivity({
      venue,
      activityType: "feedback_deleted",
      summary: `Deleted feedback${item.feedback_type ? ` (${item.feedback_type})` : ""}.`,
      metadata: {
        feedback_id: item.id,
        feedback_type: item.feedback_type,
        rating: item.rating,
      },
    });

    setSelectedFeedbackIds((current) => current.filter((id) => id !== item.id));
    if (viewingFeedbackId === item.id) {
      setViewingFeedbackId(null);
    }

    await onFeedbackChanged();
    setDeletingFeedback(false);
  }

  async function handleDeleteSelected() {
    if (selectedFeedbackIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedFeedbackIds.length} feedback record${selectedFeedbackIds.length === 1 ? "" : "s"}?`
    );
    if (!confirmed) return;

    setDeletingFeedback(true);

    const itemsToDelete = feedbackItems.filter((item) => selectedFeedbackIds.includes(item.id));

    const { error } = await supabase
      .from("venue_feedback")
      .delete()
      .in("id", selectedFeedbackIds);

    if (error) {
      alert(error.message);
      setDeletingFeedback(false);
      return;
    }

    await logVenueActivity({
      venue,
      activityType: "feedback_deleted_bulk",
      summary: `Deleted ${selectedFeedbackIds.length} feedback record${selectedFeedbackIds.length === 1 ? "" : "s"}.`,
      metadata: {
        feedback_ids: selectedFeedbackIds,
        count: selectedFeedbackIds.length,
        feedback_types: itemsToDelete.map((item) => item.feedback_type).filter(Boolean),
      },
    });

    setSelectedFeedbackIds([]);
    if (viewingFeedbackId && selectedFeedbackIds.includes(viewingFeedbackId)) {
      setViewingFeedbackId(null);
    }

    await onFeedbackChanged();
    setDeletingFeedback(false);
  }

  return (
    <SectionCard title={`Feedback (${feedbackItems.length})`}>
      <div className="flex flex-col gap-4">
        {feedbackItems.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--mutedText)" }}>
            No feedback yet.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  color: "var(--mutedText)",
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                Select all
              </label>

              {selectedFeedbackIds.length > 0 ? (
                <Button
                  variant="secondary"
                  onClick={handleDeleteSelected}
                  disabled={deletingFeedback}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Trash2 size={16} />
                    {deletingFeedback
                      ? "Deleting…"
                      : `Delete selected (${selectedFeedbackIds.length})`}
                  </span>
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              {feedbackItems.map((item) => {
                const createdLabel = formatDateTime(item.created_at);
                const artistName = artistNameById(artists, item.artist_id);
                const gigLabel = gigLabelById(gigs, item.gig_id);
                const isExpanded = viewingFeedbackId === item.id;
                const isSelected = selectedFeedbackIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      background: isSelected
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(255,255,255,0.01)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 14,
                            color: "var(--mutedText)",
                            paddingTop: 2,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(item.id)}
                          />
                        </label>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {item.feedback_type ? (
                            <Badge>{item.feedback_type}</Badge>
                          ) : (
                            <Badge tone="muted">Feedback</Badge>
                          )}

                          {item.rating != null ? (
                            <Badge tone="muted">
                              <Star size={12} />
                              {item.rating}/5
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        {createdLabel ? (
                          <div style={{ fontSize: 12, color: "var(--mutedText)" }}>
                            {createdLabel}
                          </div>
                        ) : null}

                        <ActionTextLink
                          onClick={() => handleDeleteSingle(item)}
                          icon={<Trash2 size={15} />}
                          muted
                        >
                          Delete
                        </ActionTextLink>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: "var(--text)",
                      }}
                    >
                      {isExpanded || item.content.length <= 220
                        ? item.content
                        : `${item.content.slice(0, 220)}…`}
                    </div>

                    {(artistName || gigLabel) && (
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        }}
                      >
                        {artistName ? <InfoTile label="Artist" value={artistName} /> : null}
                        {gigLabel ? <InfoTile label="Gig" value={gigLabel} /> : null}
                      </div>
                    )}

                    <SectionActions>
                      {item.content.length > 220 ? (
                        <InlineAction
                          onClick={() =>
                            setViewingFeedbackId(isExpanded ? null : item.id)
                          }
                        >
                          {isExpanded ? "Show less" : "View full feedback"}
                        </InlineAction>
                      ) : null}
                    </SectionActions>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button
            variant={showAddForm ? "secondary" : "primary"}
            onClick={() => setShowAddForm((v) => !v)}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <MessageSquarePlus size={16} />
              {showAddForm ? "Cancel" : "Add feedback"}
            </span>
          </Button>
        </div>

        {showAddForm ? (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 16,
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Feedback type">
                <Input
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                  placeholder="Promoter, production, audience, payment…"
                />
              </Field>

              <Field label="Rating">
                <StarRatingInput value={feedbackRating} onChange={setFeedbackRating} />
              </Field>

              <Field label="Artist">
                <Select
                  value={feedbackArtistId}
                  onChange={(e) => setFeedbackArtistId(e.target.value)}
                >
                  <option value="">None</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Gig">
                <Select
                  value={feedbackGigId}
                  onChange={(e) => setFeedbackGigId(e.target.value)}
                >
                  <option value="">None</option>
                  {gigs.map((gig) => (
                    <option key={gig.id} value={gig.id}>
                      {gig.title}
                      {gig.starts_at ? ` (${formatGigDate(gig.starts_at)})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div style={{ marginTop: 16 }}>
              <Field label="Feedback" required>
                <Textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="What should the agency remember about this venue?"
                  style={{ minHeight: 120, resize: "vertical" }}
                />
              </Field>
            </div>

            <div style={{ marginTop: 16 }}>
              <Button onClick={handleAddFeedback} disabled={!canAddFeedback}>
                {addingFeedback ? "Adding…" : "Save feedback"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
