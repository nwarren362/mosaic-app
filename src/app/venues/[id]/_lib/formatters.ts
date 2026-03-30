import type { AgencyMember, Artist, Gig } from "./types";

export function formatDateTime(iso?: string | null) {
  if (!iso) return null;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatGigDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function memberLabel(member: AgencyMember) {
  const base =
    member.display_name && member.display_name.trim().length > 0
      ? member.display_name.trim()
      : `Member ${member.id.slice(0, 8)}`;

  return member.role === "admin" ? `${base} (Admin)` : base;
}

export function artistNameById(artists: Artist[], id?: string | null) {
  if (!id) return null;
  return artists.find((artist) => artist.id === id)?.name ?? null;
}

export function gigLabelById(gigs: Gig[], id?: string | null) {
  if (!id) return null;
  const gig = gigs.find((item) => item.id === id);
  if (!gig) return null;
  const date = formatGigDate(gig.starts_at);
  return date ? `${gig.title} (${date})` : gig.title;
}