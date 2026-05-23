"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import {
  Page,
  SectionCard,
  Button,
  Input,
  Field,
  Select,
  Textarea,
  StatusBadge,
  StatTile,
  IconButton,
  SegmentedControl,
} from "@/components/ui";

import ArtistMembersSection, {
  type ArtistMember,
} from "./_components/ArtistMembersSection";

type Artist = {
  id: string;
  agency_id: string;
  name: string;
  genre: string | null;
  home_city: string | null;
  home_country: string | null;
  n_piece: number | null;
  notes: string | null;
  image_url: string | null;
  banner_position_x: number | null;
  banner_position_y: number | null;
  banner_zoom: number | null;
  status: "active" | "inactive" | null;
  created_at: string;
  updated_at: string;
};

type Gig = {
  id: string;
  title: string;
  venue_id: string | null;
  venue: string | null;
  city: string | null;
  starts_at: string;
  status: "confirmed" | "cancelled" | "pending";
  fee_cents: number;
};

type VenueOption = {
  id: string;
  name: string;
  city: string | null;
};

type AgencyTag = {
  id: string;
  name: string;
  type: string;
  sort_order: number | null;
};

type ArtistTagRow = {
  tag_id: string;
};

export default function ArtistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const [agencyId, setAgencyId] = useState<string>("");

  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [artistMembers, setArtistMembers] = useState<ArtistMember[]>([]);
  const [regionTags, setRegionTags] = useState<AgencyTag[]>([]);
  const [selectedRegionTagIds, setSelectedRegionTagIds] = useState<string[]>([]);
  const [savingRegionTagId, setSavingRegionTagId] = useState<string | null>(null);

  const [upcomingGigs, setUpcomingGigs] = useState<Gig[]>([]);
  const [pastGigs, setPastGigs] = useState<Gig[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [activeGigTab, setActiveGigTab] = useState<"all" | "upcoming" | "past">("upcoming");

  const [showAddGig, setShowAddGig] = useState(false);
  const [gigTitle, setGigTitle] = useState("");
  const [gigVenueId, setGigVenueId] = useState("");
  const [gigStartsAt, setGigStartsAt] = useState("");
  const [gigStatus, setGigStatus] = useState<"confirmed" | "pending" | "cancelled">(
    "confirmed"
  );
  const [gigFeePounds, setGigFeePounds] = useState<string>("0");
  const [gigSaving, setGigSaving] = useState(false);

  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editVenueId, setEditVenueId] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editStatus, setEditStatus] = useState<"confirmed" | "pending" | "cancelled">(
    "confirmed"
  );
  const [editFeePounds, setEditFeePounds] = useState<string>("0");
  const [editSaving, setEditSaving] = useState(false);

  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [nPiece, setNPiece] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [notes, setNotes] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [bannerPositionX, setBannerPositionX] = useState(50);
  const [bannerPositionY, setBannerPositionY] = useState(50);
  const [bannerZoom, setBannerZoom] = useState(100);
  const [showBannerReposition, setShowBannerReposition] = useState(false);
  const [savingBannerPosition, setSavingBannerPosition] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [showBannerMenu, setShowBannerMenu] = useState(false);
  const [showArtistMenu, setShowArtistMenu] = useState(false);

  const dirty = useMemo(() => {
    if (!artist) return false;
    return (
      name !== artist.name ||
      (genre || "") !== (artist.genre || "") ||
      (homeCity || "") !== (artist.home_city || "") ||
      (homeCountry || "") !== (artist.home_country || "") ||
      (nPiece || "") !== (artist.n_piece == null ? "" : String(artist.n_piece)) ||
      (imageUrl || "") !== (artist.image_url || "") ||
      (status || "active") !== (artist.status || "active") ||
      (notes || "") !== (artist.notes || "") ||
      bannerPositionX !== (artist.banner_position_x ?? 50) ||
      bannerPositionY !== (artist.banner_position_y ?? 50) ||
      bannerZoom !== (artist.banner_zoom ?? 100)
    );
  }, [artist, name, genre, homeCity, homeCountry, nPiece, imageUrl, status, notes, bannerPositionX, bannerPositionY, bannerZoom]);

  const currentBannerImage = bannerPreviewUrl || imageUrl;

  const visibleGigs = useMemo(() => {
    if (activeGigTab === "upcoming") return upcomingGigs;
    if (activeGigTab === "past") return pastGigs;

    return [...upcomingGigs, ...pastGigs].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  }, [activeGigTab, upcomingGigs, pastGigs]);

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
      .select(
        "id, agency_id, name, genre, home_city, home_country, n_piece, notes, image_url, banner_position_x, banner_position_y, banner_zoom, status, created_at, updated_at"
      )
      .eq("id", id)
      .eq("agency_id", active)
      .single();

    if (error) {
      setMessage(error.message);
      setArtist(null);
      setLoading(false);
      return;
    }

    const a = data as Artist;
    setArtist(a);

    setName(a.name);
    setGenre(a.genre ?? "");
    setHomeCity(a.home_city ?? "");
    setHomeCountry(a.home_country ?? "");
    setNPiece(a.n_piece == null ? "" : String(a.n_piece));
    setImageUrl(a.image_url ?? "");
    setBannerPreviewUrl(null);
    setBannerPositionX(a.banner_position_x ?? 50);
    setBannerPositionY(a.banner_position_y ?? 50);
    setBannerZoom(a.banner_zoom ?? 100);
    setShowBannerReposition(false);
    setStatus((a.status ?? "active") as "active" | "inactive");
    setNotes(a.notes ?? "");

    const nowIso = new Date().toISOString();

    const { data: upData, error: upErr } = await supabase
      .from("gigs")
      .select("id,title,venue_id,venue,city,starts_at,status,fee_cents")
      .eq("agency_id", active)
      .eq("artist_id", id)
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(5);

    if (upErr) {
      setMessage(upErr.message);
    } else {
      setUpcomingGigs((upData ?? []) as Gig[]);
    }

    const { data: pastData, error: pastErr } = await supabase
      .from("gigs")
      .select("id,title,venue_id,venue,city,starts_at,status,fee_cents")
      .eq("agency_id", active)
      .eq("artist_id", id)
      .lt("starts_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(5);

    if (pastErr) {
      setMessage(pastErr.message);
    } else {
      setPastGigs((pastData ?? []) as Gig[]);
    }

    const { data: venueData, error: venueErr } = await supabase
      .from("venues")
      .select("id,name,city")
      .eq("agency_id", active)
      .order("name", { ascending: true });

    if (venueErr) {
      setMessage(venueErr.message);
    } else {
      setVenues((venueData ?? []) as VenueOption[]);
    }

    const { data: memberData, error: memberErr } = await supabase
      .from("artist_members")
      .select(
        "id, agency_id, artist_id, profile_id, name, role, email, phone, notes, is_primary, receives_gig_notifications, is_default_approver, approval_notes, portal_enabled, portal_invited_at, portal_last_seen_at, created_at, updated_at, created_by, updated_by"
      )
      .eq("agency_id", active)
      .eq("artist_id", id)
      .order("is_primary", { ascending: false })
      .order("is_default_approver", { ascending: false })
      .order("name", { ascending: true });

    if (memberErr) {
      setMessage(memberErr.message);
    } else {
      setArtistMembers((memberData ?? []) as ArtistMember[]);
    }

    const { data: tagData, error: tagErr } = await supabase
      .from("agency_tags")
      .select("id, name, type, sort_order")
      .eq("agency_id", active)
      .eq("type", "region")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (tagErr) {
      setMessage(tagErr.message);
    } else {
      setRegionTags((tagData ?? []) as AgencyTag[]);
    }

    const { data: selectedTagData, error: selectedTagErr } = await supabase
      .from("artist_tags")
      .select("tag_id")
      .eq("agency_id", active)
      .eq("artist_id", id);

    if (selectedTagErr) {
      setMessage(selectedTagErr.message);
    } else {
      setSelectedRegionTagIds(
        ((selectedTagData ?? []) as ArtistTagRow[]).map((row) => row.tag_id)
      );
    }

    setLoading(false);
  }

  async function reloadArtistMembers() {
    const active = agencyId || getActiveAgencyId();
    if (!active) return;

    const { data, error } = await supabase
      .from("artist_members")
      .select(
        "id, agency_id, artist_id, profile_id, name, role, email, phone, notes, is_primary, receives_gig_notifications, is_default_approver, approval_notes, portal_enabled, portal_invited_at, portal_last_seen_at, created_at, updated_at, created_by, updated_by"
      )
      .eq("agency_id", active)
      .eq("artist_id", id)
      .order("is_primary", { ascending: false })
      .order("is_default_approver", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setArtistMembers((data ?? []) as ArtistMember[]);
  }

  async function toggleRegionTag(tagId: string) {
    if (!artist) return;

    const isSelected = selectedRegionTagIds.includes(tagId);
    setSavingRegionTagId(tagId);
    setMessage(null);

    if (isSelected) {
      const { error } = await supabase
        .from("artist_tags")
        .delete()
        .eq("agency_id", agencyId)
        .eq("artist_id", artist.id)
        .eq("tag_id", tagId);

      setSavingRegionTagId(null);

      if (error) {
        setMessage(error.message);
        return;
      }

      setSelectedRegionTagIds((current) => current.filter((id) => id !== tagId));
      return;
    }

    const { error } = await supabase.from("artist_tags").insert({
      agency_id: agencyId,
      artist_id: artist.id,
      tag_id: tagId,
    });

    setSavingRegionTagId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedRegionTagIds((current) => [...current, tagId]);
  }


  async function logArtistActivity({
    summary,
    metadata = {},
  }: {
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!artist) return false;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("activity_log").insert({
      agency_id: artist.agency_id,
      entity_type: "artist",
      entity_id: artist.id,
      activity_type: "system",
      summary,
      metadata,
      created_by: user?.id ?? null,
    });

    if (error) {
      console.warn("Failed to record artist activity:", error.message);
      return false;
    }

    window.dispatchEvent(
      new CustomEvent("activity-log-changed", {
        detail: { entityType: "artist", entityId: artist.id },
      })
    );

    return true;
  }

  async function save() {
    if (!artist) return;
    setMessage(null);
    setSaving(true);

    const { error } = await supabase
      .from("artists")
      .update({
        name: name.trim(),
        genre: genre.trim() ? genre.trim() : null,
        home_city: homeCity.trim() ? homeCity.trim() : null,
        home_country: homeCountry.trim() ? homeCountry.trim() : null,
        n_piece: nPiece.trim() ? Number(nPiece) : null,
        image_url: imageUrl.trim() ? imageUrl.trim() : null,
        banner_position_x: bannerPositionX,
        banner_position_y: bannerPositionY,
        banner_zoom: bannerZoom,
        status,
        notes: notes.trim() ? notes.trim() : null,
      })
      .eq("id", artist.id)
      .eq("agency_id", agencyId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const parsedNPiece = nPiece.trim() ? Number(nPiece) : null;

    const artistActivityChanges: Array<{
      field: string;
      summary: string;
      from: unknown;
      to: unknown;
    }> = [
      {
        field: "name",
        summary: "Artist name updated.",
        from: artist.name ?? "",
        to: name.trim(),
      },
      {
        field: "genre",
        summary: "Genre updated.",
        from: artist.genre ?? "",
        to: genre.trim(),
      },
      {
        field: "home_city",
        summary: "Home city updated.",
        from: artist.home_city ?? "",
        to: homeCity.trim(),
      },
      {
        field: "home_country",
        summary: "Home country updated.",
        from: artist.home_country ?? "",
        to: homeCountry.trim(),
      },
      {
        field: "n_piece",
        summary: "Band size updated.",
        from: artist.n_piece ?? null,
        to: parsedNPiece,
      },
      {
        field: "status",
        summary: "Artist status updated.",
        from: artist.status ?? "active",
        to: status,
      },
      {
        field: "notes",
        summary: "Artist notes updated.",
        from: artist.notes ?? "",
        to: notes.trim(),
      },
      {
        field: "image_url",
        summary: imageUrl.trim() ? "Artist image updated." : "Artist image removed.",
        from: artist.image_url ?? "",
        to: imageUrl.trim(),
      },
    ].filter((change) => change.from !== change.to);

    for (const change of artistActivityChanges) {
      await logArtistActivity({
        summary: change.summary,
        metadata: {
          field: change.field,
          from: change.from,
          to: change.to,
        },
      });
    }

    setMessage("Saved.");
    await load();
  }

  async function saveAndClose() {
    if (!artist) return;
    setMessage(null);
    setSaving(true);

    const { error } = await supabase
      .from("artists")
      .update({
        name: name.trim(),
        genre: genre.trim() ? genre.trim() : null,
        home_city: homeCity.trim() ? homeCity.trim() : null,
        home_country: homeCountry.trim() ? homeCountry.trim() : null,
        n_piece: nPiece.trim() ? Number(nPiece) : null,
        image_url: imageUrl.trim() ? imageUrl.trim() : null,
        banner_position_x: bannerPositionX,
        banner_position_y: bannerPositionY,
        banner_zoom: bannerZoom,
        status,
        notes: notes.trim() ? notes.trim() : null,
      })
      .eq("id", artist.id)
      .eq("agency_id", agencyId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/artists");
  }

  function navigateBackToArtists() {
    if (dirty) {
      const ok = confirm("You have unsaved changes. Leave this page and discard them?");
      if (!ok) return;
    }

    router.push("/artists");
  }

  async function handleBannerFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (!artist) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    setShowBannerMenu(false);

    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      e.target.value = "";
      return;
    }

    const maxBytes = 6 * 1024 * 1024;
    if (file.size > maxBytes) {
      setMessage("Image is too large. Please choose an image under 6 MB.");
      e.target.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setBannerPreviewUrl(objectUrl);
    setBannerUploading(true);

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const safeExtension = (extension || "jpg").toLowerCase();
    const filePath = `${agencyId}/${artist.id}/${Date.now()}.${safeExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("artist-images")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      setBannerUploading(false);
      setBannerPreviewUrl(null);
      setMessage(uploadError.message);
      e.target.value = "";
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("artist-images")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("artists")
      .update({
        image_url: publicUrl,
        banner_position_x: 50,
        banner_position_y: 50,
        banner_zoom: 100,
      })
      .eq("id", artist.id)
      .eq("agency_id", agencyId);

    if (updateError) {
      setBannerUploading(false);
      setBannerPreviewUrl(null);
      setMessage(updateError.message);
      e.target.value = "";
      return;
    }

    setImageUrl(publicUrl);
    setBannerPositionX(50);
    setBannerPositionY(50);
    setBannerZoom(100);
    setArtist({
      ...artist,
      image_url: publicUrl,
      banner_position_x: 50,
      banner_position_y: 50,
      banner_zoom: 100,
    });
    setBannerPreviewUrl(null);
    setBannerUploading(false);
    setMessage("Banner image updated.");
    e.target.value = "";
  }

  async function saveBannerPosition() {
    if (!artist) return;

    setMessage(null);
    setSavingBannerPosition(true);

    const { error } = await supabase
      .from("artists")
      .update({
        banner_position_x: bannerPositionX,
        banner_position_y: bannerPositionY,
        banner_zoom: bannerZoom,
      })
      .eq("id", artist.id)
      .eq("agency_id", agencyId);

    setSavingBannerPosition(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setArtist({
      ...artist,
      banner_position_x: bannerPositionX,
      banner_position_y: bannerPositionY,
      banner_zoom: bannerZoom,
    });
    setShowBannerReposition(false);
    setMessage("Banner position saved.");
  }


  function toDatetimeLocalValue(iso: string) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function formatActivityDate(iso: string) {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return "unknown date";
    }

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function beginEditGig(g: Gig) {
    setEditingGig(g);
    setEditTitle(g.title ?? "");
    setEditVenueId(g.venue_id ?? "");
    setEditStartsAt(toDatetimeLocalValue(g.starts_at));
    setEditStatus(g.status);
    setEditFeePounds(String(((g.fee_cents ?? 0) / 100).toFixed(2)));
  }

  async function saveGigEdits() {
    if (!editingGig) return;

    if (!editTitle.trim()) {
      setMessage("Please enter a gig title.");
      return;
    }

    if (!editStartsAt) {
      setMessage("Please choose a date/time.");
      return;
    }

    const selectedVenue = venues.find((v) => v.id === editVenueId) ?? null;

    setMessage(null);
    setEditSaving(true);

    const feeCents = Math.round((Number(editFeePounds) || 0) * 100);
    const startsAtIso = new Date(editStartsAt).toISOString();

    const { error } = await supabase
      .from("gigs")
      .update({
        title: editTitle.trim(),
        venue_id: editVenueId || null,
        venue: selectedVenue?.name ?? null,
        city: selectedVenue?.city ?? null,
        starts_at: startsAtIso,
        status: editStatus,
        fee_cents: feeCents,
      })
      .eq("id", editingGig.id)
      .eq("agency_id", agencyId);

    setEditSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    // Activity logging for gig edits (single summary entry)
    const originalVenueName = editingGig.venue ?? "Unassigned venue";
    const updatedVenueName = selectedVenue?.name ?? "Unassigned venue";

    const changedFields: string[] = [];

    if ((editingGig.title ?? "") !== editTitle.trim()) {
      changedFields.push("title");
    }

    if ((editingGig.venue_id ?? "") !== (editVenueId || "")) {
      changedFields.push("venue");
    }

    if (
      toDatetimeLocalValue(editingGig.starts_at) !==
      toDatetimeLocalValue(startsAtIso)
    ) {
      changedFields.push("date/time");
    }

    if (editingGig.status !== editStatus) {
      changedFields.push("status");
    }

    if ((editingGig.fee_cents ?? 0) !== feeCents) {
      changedFields.push("fee");
    }

    if (changedFields.length > 0) {
      await logArtistActivity({
        summary: `Gig updated: ${editTitle.trim()}.`,
        metadata: {
          gig_id: editingGig.id,
          gig_title: editTitle.trim(),
          changed_fields: changedFields,
          original_venue: originalVenueName,
          updated_venue: updatedVenueName,
          original_starts_at: editingGig.starts_at,
          updated_starts_at: startsAtIso,
          original_starts_at_display: formatActivityDate(editingGig.starts_at),
          updated_starts_at_display: formatActivityDate(startsAtIso),
          original_status: editingGig.status,
          updated_status: editStatus,
          original_fee_cents: editingGig.fee_cents ?? 0,
          updated_fee_cents: feeCents,
        },
      });
    }

    setEditingGig(null);
    await load();
  }

  async function deleteGig() {
    if (!editingGig) return;

    const ok = confirm(`Delete gig "${editingGig.title}"? This cannot be undone.`);
    if (!ok) return;

    setMessage(null);
    setEditSaving(true);

    const { data: deletedRows, error } = await supabase
      .from("gigs")
      .delete()
      .eq("id", editingGig.id)
      .eq("agency_id", agencyId)
      .select("id");

    setEditSaving(false);

    if (error) {
      if (
        error.message.includes("permission") ||
        error.message.includes("policy") ||
        error.code === "42501"
      ) {
        setMessage(
          "You do not have permission to delete gigs. Consider setting the gig status to Cancelled instead."
        );
      } else {
        setMessage(`Failed to delete gig: ${error.message}`);
      }
      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      setMessage(
        "The gig was not deleted. You may not have permission to delete gigs, or the record may already have been changed. Consider setting the gig status to Cancelled instead."
      );
      return;
    }

    await logArtistActivity({
      summary: `Gig deleted: ${editingGig.title}.`,
      metadata: {
        gig_id: editingGig.id,
        gig_title: editingGig.title,
        venue: editingGig.venue ?? null,
        starts_at: editingGig.starts_at,
      },
    });
    setEditingGig(null);
    setUpcomingGigs((prev) => prev.filter((g) => g.id !== editingGig.id));
    setPastGigs((prev) => prev.filter((g) => g.id !== editingGig.id));

    await load();
  }

  async function addGig() {
    if (!artist) return;

    setMessage(null);

    if (!gigTitle.trim()) {
      setMessage("Please enter a gig title.");
      return;
    }

    if (!gigStartsAt) {
      setMessage("Please choose a date/time for the gig.");
      return;
    }

    const startsAtIso = new Date(gigStartsAt).toISOString();
    const pounds = Number(gigFeePounds);
    const feeCents = Number.isFinite(pounds) ? Math.round(pounds * 100) : 0;

    const selectedVenue = venues.find((v) => v.id === gigVenueId) ?? null;

    setGigSaving(true);

    const { error } = await supabase.from("gigs").insert({
      agency_id: agencyId,
      artist_id: artist.id,
      title: gigTitle.trim(),
      venue_id: gigVenueId || null,
      venue: selectedVenue?.name ?? null,
      city: selectedVenue?.city ?? null,
      starts_at: startsAtIso,
      status: gigStatus,
      fee_cents: feeCents,
    });

    setGigSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await logArtistActivity({
      summary: `Gig added: ${gigTitle.trim() || new Date(startsAtIso).toLocaleDateString("en-GB")}.`,
      metadata: {
        title: gigTitle.trim(),
        venue_id: gigVenueId || null,
        venue: selectedVenue?.name ?? null,
        city: selectedVenue?.city ?? null,
        starts_at: startsAtIso,
        status: gigStatus,
        fee_cents: feeCents,
      },
    });

    setGigTitle("");
    setGigVenueId("");
    setGigStartsAt("");
    setGigStatus("confirmed");
    setGigFeePounds("0");
    setShowAddGig(false);

    await load();
  }

  async function handleArtistLifecycleAction() {
    if (!artist) return;

    setMessage(null);
    setShowArtistMenu(false);

    const { count: gigCount, error: gigCountError } = await supabase
      .from("gigs")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("artist_id", artist.id);

    if (gigCountError) {
      setMessage(gigCountError.message);
      return;
    }

    const { count: memberCount, error: memberCountError } = await supabase
      .from("artist_members")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("artist_id", artist.id);

    if (memberCountError) {
      setMessage(memberCountError.message);
      return;
    }

    const hasRelatedData = (gigCount ?? 0) > 0 || (memberCount ?? 0) > 0;

    if (hasRelatedData) {
      const ok = confirm(
        `"${artist.name}" has related data (${gigCount ?? 0} gigs, ${memberCount ?? 0} members), so it cannot be safely deleted.\n\nWould you like to mark this artist as Inactive instead?`
      );

      if (!ok) return;

      const { error } = await supabase
        .from("artists")
        .update({ status: "inactive" })
        .eq("id", artist.id)
        .eq("agency_id", agencyId);

      if (error) {
        setMessage(error.message);
        return;
      }

      setStatus("inactive");
      setArtist({ ...artist, status: "inactive" });
      setMessage("Artist marked as inactive.");
      await load();
      return;
    }

    const ok = confirm(
      `Delete "${artist.name}"? This artist has no gigs or members. This cannot be undone.`
    );

    if (!ok) return;

    const { error } = await supabase
      .from("artists")
      .delete()
      .eq("id", artist.id)
      .eq("agency_id", agencyId);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/artists");
  }

  async function reactivateArtist() {
    if (!artist) return;

    setMessage(null);
    setShowArtistMenu(false);

    const ok = confirm(`Reactivate "${artist.name}"?`);
    if (!ok) return;

    const { error } = await supabase
      .from("artists")
      .update({ status: "active" })
      .eq("id", artist.id)
      .eq("agency_id", agencyId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStatus("active");
    setArtist({ ...artist, status: "active" });
    setMessage("Artist reactivated.");
    await load();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty]);

  return (
    <Page title={artist?.name || name || "Artist"}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginBottom: "var(--space-3)",
        }}
      >
        <div style={{ color: "var(--mutedText)", fontSize: 14, lineHeight: 1.5 }}>
          {artist ? (
            <>
              {artist.genre || "No genre"} · {status === "active" ? "Active" : "Inactive"}
            </>
          ) : (
            "Loading artist…"
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            alignItems: "center",
            position: "relative",
          }}
        >
          <Button variant="secondary" type="button" onClick={navigateBackToArtists}>
            Back
          </Button>

          <Button
            variant="secondary"
            type="button"
            onClick={save}
            disabled={!dirty || saving || !artist}
          >
            {saving ? "Saving…" : "Save"}
          </Button>

          <Button
            variant="primary"
            type="button"
            onClick={saveAndClose}
            disabled={saving || !artist}
          >
            {saving ? "Saving…" : "Save & close"}
          </Button>

          <IconButton
            label="Artist actions"
            variant="secondary"
            type="button"
            disabled={!artist}
            onClick={() => setShowArtistMenu((value) => !value)}
          >
            <MoreHorizontal size={16} />
          </IconButton>

          {showArtistMenu && artist ? (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 42,
                zIndex: 20,
                minWidth: 180,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(18,18,22,0.98)",
                boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
                padding: 6,
                display: "grid",
                gap: 4,
              }}
            >
              {status === "inactive" ? (
                <button
                  type="button"
                  onClick={reactivateArtist}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text)",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Reactivate artist
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleArtistLifecycleAction}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffb4ab",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {status === "active" ? "Delete / deactivate artist" : "Delete artist"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {message && <p style={{ color: "var(--mutedText)" }}>{message}</p>}

      {loading ? (
        <SectionCard title="Artist details">
          <p style={{ color: "var(--mutedText)" }}>Loading…</p>
        </SectionCard>
      ) : !artist ? (
        <SectionCard title="Artist details">
          <p style={{ color: "var(--mutedText)" }}>
            Artist not found (or you don’t have access).
          </p>
        </SectionCard>
      ) : (
        <>
          <div
            style={{
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              boxShadow: "var(--shadow-strong)",
              marginBottom: "var(--space-4)",
            }}
          >
            <div
              style={{
                height: 160,
                position: "relative",
                overflow: "hidden",
                background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(0,0,0,0.90))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {currentBannerImage ? (
                <>
                  <img
                    src={currentBannerImage}
                    alt=""
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: `${bannerPositionX}% ${bannerPositionY}%`,
                      transform: `scale(${bannerZoom / 100})`,
                      transformOrigin: `${bannerPositionX}% ${bannerPositionY}%`,
                      display: "block",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.80))",
                      pointerEvents: "none",
                    }}
                  />
                </>
              ) : null}
              {!currentBannerImage && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "0 16px",
                    position: "relative",
                    zIndex: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      letterSpacing: -0.5,
                    }}
                  >
                    {artist.name}
                  </div>
                  {artist.genre && (
                    <div
                      style={{
                        marginTop: 6,
                        color: "var(--mutedText)",
                        fontSize: 14,
                      }}
                    >
                      {artist.genre}
                    </div>
                  )}
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  zIndex: 3,
                }}
              >
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerFileChange}
                  style={{ display: "none" }}
                />

                <button
                  type="button"
                  onClick={() => setShowBannerMenu((v) => !v)}
                  style={{
                    background: "rgba(0,0,0,0.42)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: 999,
                    width: 30,
                    height: 30,
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.92)",
                    fontSize: 15,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={currentBannerImage ? "Banner image options" : "Upload banner image"}
                  aria-label={currentBannerImage ? "Banner image options" : "Upload banner image"}
                >
                  ✎
                </button>

                {showBannerMenu && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: 38,
                      minWidth: 170,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(18,18,22,0.96)",
                      boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
                      padding: 6,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text)",
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      {currentBannerImage ? "Upload new image" : "Upload image"}
                    </button>

                    {currentBannerImage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setShowBannerReposition(true);
                            setShowBannerMenu(false);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text)",
                            textAlign: "left",
                            padding: "8px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          Crop / reposition
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            if (!artist) return;

                            setMessage(null);
                            setShowBannerMenu(false);
                            setBannerUploading(true);

                            const { error } = await supabase
                              .from("artists")
                              .update({ image_url: null })
                              .eq("id", artist.id)
                              .eq("agency_id", agencyId);

                            setBannerUploading(false);

                            if (error) {
                              setMessage(error.message);
                              return;
                            }

                            setImageUrl("");
                            setArtist({ ...artist, image_url: null });
                            setBannerPreviewUrl(null);
                            setBannerPositionX(50);
                            setBannerPositionY(50);
                            setBannerZoom(100);
                            setShowBannerReposition(false);
                            setMessage("Banner image removed.");
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text)",
                            textAlign: "left",
                            padding: "8px 10px",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          Remove image
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showBannerReposition && currentBannerImage ? (
            <SectionCard title="Reposition banner image">
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <div style={{ fontSize: 13, color: "var(--mutedText)" }}>
                  Use zoom first if left/right focus appears to have little effect. Wider or more zoomed images have more room to move horizontally.
                </div>

                <Field label="Zoom">
                  <Input
                    type="range"
                    min="100"
                    max="220"
                    value={bannerZoom}
                    onChange={(e) => setBannerZoom(Number(e.target.value))}
                  />
                </Field>

                <Field label="Horizontal focus">
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={bannerPositionX}
                    onChange={(e) => setBannerPositionX(Number(e.target.value))}
                  />
                </Field>

                <Field label="Vertical focus">
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={bannerPositionY}
                    onChange={(e) => setBannerPositionY(Number(e.target.value))}
                  />
                </Field>

                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setShowBannerReposition(false)}
                  >
                    Done
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setBannerPositionX(artist?.banner_position_x ?? 50);
                      setBannerPositionY(artist?.banner_position_y ?? 50);
                      setBannerZoom(artist?.banner_zoom ?? 100);
                      setShowBannerReposition(false);
                    }}
                    disabled={savingBannerPosition}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "var(--space-3)",
              marginBottom: "var(--space-4)",
            }}
          >
            <StatTile
              label="Members"
              value={String(artistMembers.length)}
              hint="Band contacts"
            />
            <StatTile
              label="Upcoming gigs"
              value={String(upcomingGigs.length)}
              hint="Next 5 shown below"
            />
            <StatTile
              label="Revenue"
              value={`£${(
                upcomingGigs.reduce((sum, g) => sum + (g.fee_cents || 0), 0) / 100
              ).toFixed(2)}`}
              hint="Upcoming only (for now)"
            />
            <StatTile
              label="Status"
              value={status === "active" ? "Active" : "Inactive"}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
            }}
          >
            {artistMembers.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "14px 14px",
                  background: "rgba(124,58,237,0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>No band members yet</div>
                  <div style={{ fontSize: 13, color: "var(--mutedText)", marginTop: 2 }}>
                    Add a primary contact to manage gigs and communication.
                  </div>
                </div>

                <Button
                  variant="primary"
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("artist-members-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Add member
                </Button>
              </div>
            )}

            <div id="artist-members-section">
              <ArtistMembersSection
                artist={artist}
                members={artistMembers}
                onMembersChanged={reloadArtistMembers}
              />
            </div>

            <SectionCard
              title={`Gigs (${upcomingGigs.length + pastGigs.length})`}
              controls={
                <SegmentedControl
                  ariaLabel="Gig filter"
                  value={activeGigTab}
                  onChange={setActiveGigTab}
                  options={[
                    { label: "All", value: "all" },
                    { label: `Upcoming (${upcomingGigs.length})`, value: "upcoming" },
                    { label: `Past (${pastGigs.length})`, value: "past" },
                  ]}
                />
              }
              actions={
                <IconButton
                  label={showAddGig ? "Cancel add gig" : "Add gig"}
                  variant={showAddGig ? "secondary" : "primary"}
                  type="button"
                  onClick={() => setShowAddGig((v) => !v)}
                >
                  <Plus size={16} />
                </IconButton>
              }
            >
              <div style={{ marginTop: "var(--space-3)" }}>
                {showAddGig && (
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: "var(--radius-lg)",
                      padding: "12px 12px",
                      background: "rgba(255,255,255,0.02)",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    <div style={{ display: "grid", gap: "var(--space-3)" }}>
                      <Field label="Title" required>
                        <Input
                          value={gigTitle}
                          onChange={(e) => setGigTitle(e.target.value)}
                          placeholder="e.g. Album Launch Show"
                        />
                      </Field>

                      <div style={{ display: "grid", gap: "var(--space-3)" }}>
                        <Field label="Venue">
                          <Select
                            value={gigVenueId}
                            onChange={(e) => setGigVenueId(e.target.value)}
                          >
                            <option value="">Select venue</option>
                            {venues.map((venue) => (
                              <option key={venue.id} value={venue.id}>
                                {venue.name}
                                {venue.city ? ` · ${venue.city}` : ""}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        {gigVenueId ? (
                          <div style={{ fontSize: 13, color: "var(--mutedText)" }}>
                            City will be filled automatically from the selected venue.
                          </div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "var(--space-3)",
                        }}
                      >
                        <Field label="Starts at" required>
                          <Input
                            type="datetime-local"
                            value={gigStartsAt}
                            onChange={(e) => setGigStartsAt(e.target.value)}
                          />
                        </Field>

                        <Field label="Status">
                          <Select
                            value={gigStatus}
                            onChange={(e) => setGigStatus(e.target.value as any)}
                          >
                            <option value="confirmed">confirmed</option>
                            <option value="pending">pending</option>
                            <option value="cancelled">cancelled</option>
                          </Select>
                        </Field>

                        <Field label="Fee (£)">
                          <Input
                            value={gigFeePounds}
                            onChange={(e) => setGigFeePounds(e.target.value)}
                          />
                        </Field>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "var(--space-2)",
                          flexWrap: "wrap",
                          marginTop: 4,
                        }}
                      >
                        <Button
                          type="button"
                          variant="primary"
                          onClick={addGig}
                          disabled={gigSaving}
                        >
                          {gigSaving ? "Saving…" : "Save gig"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setShowAddGig(false)}
                          disabled={gigSaving}
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                )}


                <div
                  style={{
                    marginTop: "var(--space-3)",
                    display: "grid",
                    gap: "var(--space-2)",
                  }}
                >
                  {visibleGigs.length === 0 ? (
                    <div style={{ color: "var(--mutedText)" }}>No gigs yet.</div>
                  ) : (
                    visibleGigs.map((g) => (
                      <div
                        key={g.id}
                        onClick={() => beginEditGig(g)}
                        style={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: "var(--radius-lg)",
                          padding: "12px 12px",
                          background: "rgba(255,255,255,0.02)",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>{g.title}</div>
                          <StatusBadge
                            tone={
                              g.status === "confirmed"
                                ? "success"
                                : g.status === "pending"
                                ? "warning"
                                : "danger"
                            }
                          >
                            {g.status}
                          </StatusBadge>
                        </div>

                        <div style={{ marginTop: 6, color: "var(--mutedText)", fontSize: 14 }}>
                          {new Date(g.starts_at).toLocaleString()} · {g.city ?? "—"} ·{" "}
                          {g.venue ?? "—"} · £{(g.fee_cents / 100).toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {editingGig && (
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "var(--radius-lg)",
                      padding: 12,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>Edit gig</div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingGig(null)}
                        disabled={editSaving}
                      >
                        Close
                      </Button>
                    </div>

                    <div style={{ height: 10 }} />

                    <div style={{ display: "grid", gap: "var(--space-3)" }}>
                      <Field label="Title" required>
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      </Field>

                      <div style={{ display: "grid", gap: "var(--space-3)" }}>
                        <Field label="Venue">
                          <Select
                            value={editVenueId}
                            onChange={(e) => setEditVenueId(e.target.value)}
                          >
                            <option value="">Select venue</option>
                            {venues.map((venue) => (
                              <option key={venue.id} value={venue.id}>
                                {venue.name}
                                {venue.city ? ` · ${venue.city}` : ""}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        {editVenueId ? (
                          <div style={{ fontSize: 13, color: "var(--mutedText)" }}>
                            City will be filled automatically from the selected venue.
                          </div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "var(--space-3)",
                        }}
                      >
                        <Field label="Starts at" required>
                          <Input
                            type="datetime-local"
                            value={editStartsAt}
                            onChange={(e) => setEditStartsAt(e.target.value)}
                          />
                        </Field>

                        <Field label="Status">
                          <Select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as any)}
                          >
                            <option value="confirmed">confirmed</option>
                            <option value="pending">pending</option>
                            <option value="cancelled">cancelled</option>
                          </Select>
                        </Field>

                        <Field label="Fee (£)">
                          <Input
                            value={editFeePounds}
                            onChange={(e) => setEditFeePounds(e.target.value)}
                          />
                        </Field>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "var(--space-2)",
                          flexWrap: "wrap",
                          marginTop: 6,
                        }}
                      >
                        <Button
                          type="button"
                          variant="primary"
                          onClick={saveGigEdits}
                          disabled={editSaving}
                        >
                          {editSaving ? "Saving…" : "Save changes"}
                        </Button>

                        <Button
                          type="button"
                          variant="danger"
                          onClick={deleteGig}
                          disabled={editSaving}
                        >
                          Delete gig
                        </Button>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <div style={{ marginTop: "var(--space-4)" }}>
            <SectionCard title="Details">
              <div style={{ display: "grid", gap: "var(--space-3)", maxWidth: 800 }}>
                <Field label="Name" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>

                <Field label="Genre">
                  <Input value={genre} onChange={(e) => setGenre(e.target.value)} />
                </Field>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "var(--space-3)",
                  }}
                >
                  <Field label="Home city">
                    <Input value={homeCity} onChange={(e) => setHomeCity(e.target.value)} />
                  </Field>

                  <Field label="Home country">
                    <Input value={homeCountry} onChange={(e) => setHomeCountry(e.target.value)} />
                  </Field>

                  <Field label="Band size">
                    <Input
                      type="number"
                      min="1"
                      value={nPiece}
                      onChange={(e) => setNPiece(e.target.value)}
                      placeholder="e.g. 4"
                    />
                  </Field>
                </div>

                <Field label="Willing to travel to">
                  <div style={{ display: "grid", gap: "var(--space-3)" }}>
                    {regionTags.length === 0 ? (
                      <div style={{ color: "var(--mutedText)", fontSize: 14 }}>
                        No region tags have been created for this agency yet.
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {regionTags.map((tag) => {
                          const selected = selectedRegionTagIds.includes(tag.id);
                          const savingThisTag = savingRegionTagId === tag.id;

                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleRegionTag(tag.id)}
                              disabled={!!savingRegionTagId}
                              style={{
                                border: selected
                                  ? "1px solid var(--primary)"
                                  : "1px solid var(--border)",
                                background: selected
                                  ? "rgba(124,58,237,0.22)"
                                  : "rgba(255,255,255,0.03)",
                                color: selected ? "var(--text)" : "var(--mutedText)",
                                borderRadius: 999,
                                padding: "7px 11px",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: savingRegionTagId ? "not-allowed" : "pointer",
                                opacity: savingRegionTagId && !savingThisTag ? 0.55 : 1,
                              }}
                            >
                              {savingThisTag ? "Saving…" : tag.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Field>



                <Field label="Notes">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} />
                </Field>

                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={save}
                    disabled={!dirty || saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>

                  <Button variant="secondary" type="button" onClick={load} disabled={saving}>
                    Reset
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>

          <div style={{ marginTop: "var(--space-4)" }}>
            <ActivityTimeline
              agencyId={artist.agency_id}
              entityType="artist"
              entityId={artist.id}
            />
          </div>

          <style jsx>{`
            @media (max-width: 900px) {
              div[style*="grid-template-columns: 1fr 1fr"] {
                grid-template-columns: 1fr !important;
              }
              div[style*="repeat(4"] {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
        </>
      )}
    </Page>
  );
}