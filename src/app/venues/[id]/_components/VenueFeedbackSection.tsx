"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SectionCard, Field, Input, Textarea, Select, Button } from "@/components/ui";
import type { Artist, Gig, Venue, VenueFeedback } from "../_lib/types";
import { artistNameById, formatDateTime, formatGigDate, gigLabelById } from "../_lib/formatters";
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

  const canAddFeedback = useMemo(
    () => feedbackContent.trim().length > 0 && !addingFeedback,
    [feedbackContent, addingFeedback]
  );

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

    setFeedbackType("");
    setFeedbackRating(null);
    setFeedbackContent("");
    setFeedbackArtistId("");
    setFeedbackGigId("");
    setShowAddForm(false);

    await onFeedbackChanged();
    setAddingFeedback(false);
  }

  return (
    <SectionCard title={`Feedback (${feedbackItems.length})`}>
      <div className="flex flex-col gap-4">
        {feedbackItems.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--mutedText)" }}>
            No feedback yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {feedbackItems.map((item) => {
              const createdLabel = formatDateTime(item.created_at);
              const artistName = artistNameById(artists, item.artist_id);
              const gigLabel = gigLabelById(gigs, item.gig_id);

              return (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    background: "rgba(255,255,255,0.01)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {item.feedback_type ? (
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                          {item.feedback_type}
                        </span>
                      ) : null}

                      {item.rating != null ? (
                        <span style={{ fontSize: 13, color: "var(--mutedText)" }}>
                          Rating: {item.rating}/5
                        </span>
                      ) : null}
                    </div>

                    {createdLabel ? (
                      <div style={{ fontSize: 12, color: "var(--mutedText)" }}>
                        {createdLabel}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{item.content}</div>

                  {artistName || gigLabel ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                      {artistName ? (
                        <div style={{ fontSize: 13, color: "var(--mutedText)" }}>
                          Artist: {artistName}
                        </div>
                      ) : null}

                      {gigLabel ? (
                        <div style={{ fontSize: 13, color: "var(--mutedText)" }}>
                          Gig: {gigLabel}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button
            variant={showAddForm ? "secondary" : "primary"}
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? "Cancel" : "Add feedback"}
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