"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Mail, Menu, Phone, Plus, Star, Trash2, UserRound, Zap } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  SectionCard,
  Field,
  Input,
  Textarea,
  Button,
  IconButton,
} from "@/components/ui";

export type ArtistMember = {
  id: string;
  agency_id: string;
  artist_id: string;
  profile_id: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
  receives_gig_notifications: boolean;
  is_default_approver: boolean;
  approval_notes: string | null;
  portal_enabled: boolean;
  portal_invited_at: string | null;
  portal_last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type ArtistForMembers = {
  id: string;
  agency_id: string;
  name: string;
};

type Props = {
  artist: ArtistForMembers;
  members: ArtistMember[];
  onMembersChanged: () => Promise<void>;
};

export default function ArtistMembersSection({
  artist,
  members,
  onMembersChanged,
}: Props) {
  const [addingMember, setAddingMember] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [openMemberMenuId, setOpenMemberMenuId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberNotes, setMemberNotes] = useState("");
  const [memberIsPrimary, setMemberIsPrimary] = useState(false);
  const [memberReceivesGigNotifications, setMemberReceivesGigNotifications] = useState(true);
  const [memberIsDefaultApprover, setMemberIsDefaultApprover] = useState(false);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editReceivesGigNotifications, setEditReceivesGigNotifications] = useState(true);
  const [editIsDefaultApprover, setEditIsDefaultApprover] = useState(false);

  const addContactValidationError = useMemo(
    () => getContactValidationError(memberEmail, memberPhone),
    [memberEmail, memberPhone]
  );

  const editContactValidationError = useMemo(
    () => getContactValidationError(editEmail, editPhone),
    [editEmail, editPhone]
  );

  const canAddMember = useMemo(
    () => memberName.trim().length > 0 && !addingMember && !addContactValidationError,
    [memberName, addingMember, addContactValidationError]
  );

  const canSaveEdit = useMemo(
    () => editName.trim().length > 0 && !savingEdit && !editContactValidationError,
    [editName, savingEdit, editContactValidationError]
  );

  function getContactValidationError(email: string, phone: string) {
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return "Please enter a valid email address.";
    }

    if (trimmedPhone && !/^[+()0-9\s.-]{7,}$/.test(trimmedPhone)) {
      return "Please enter a valid phone number. Use numbers, spaces, +, brackets or hyphens only.";
    }

    return null;
  }

  function validateContactFields(email: string, phone: string) {
    const validationError = getContactValidationError(email, phone);

    if (validationError) {
      throw new Error(validationError);
    }
  }

  function beginAddMember() {
    const opening = !showAddForm;

    if (opening) {
      resetAddForm();
      setMemberReceivesGigNotifications(true);

      if (members.length === 0) {
        setMemberIsPrimary(true);
        setMemberIsDefaultApprover(true);
      }
    }

    setShowAddForm((v) => !v);
  }

  function setAddPrimaryContact(value: boolean) {
    if (value && members.some((member) => member.is_primary)) {
      const confirmed = window.confirm(
        "Another band member is already the primary contact. Selecting this member will replace the existing primary contact. Continue?"
      );

      if (!confirmed) return;
    }

    setMemberIsPrimary(value);
  }

  function setEditPrimaryContact(value: boolean) {
    if (
      value &&
      members.some((member) => member.is_primary && member.id !== editingMemberId)
    ) {
      const confirmed = window.confirm(
        "Another band member is already the primary contact. Selecting this member will replace the existing primary contact. Continue?"
      );

      if (!confirmed) return;
    }

    setEditIsPrimary(value);
  }

  function beginEdit(member: ArtistMember) {
    setOpenMemberMenuId(null);
    setEditingMemberId(member.id);
    setEditName(member.name ?? "");
    setEditRole(member.role ?? "");
    setEditEmail(member.email ?? "");
    setEditPhone(member.phone ?? "");
    setEditNotes(member.notes ?? "");
    setEditIsPrimary(!!member.is_primary);
    setEditReceivesGigNotifications(!!member.receives_gig_notifications);
    setEditIsDefaultApprover(!!member.is_default_approver);
  }

  function cancelEdit() {
    setEditingMemberId(null);
    setEditName("");
    setEditRole("");
    setEditEmail("");
    setEditPhone("");
    setEditNotes("");
    setEditIsPrimary(false);
    setEditReceivesGigNotifications(true);
    setEditIsDefaultApprover(false);
  }

  function resetAddForm() {
    setMemberName("");
    setMemberRole("");
    setMemberEmail("");
    setMemberPhone("");
    setMemberNotes("");
    setMemberIsPrimary(false);
    setMemberReceivesGigNotifications(true);
    setMemberIsDefaultApprover(false);
  }

  async function getCurrentUserId() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new Error(error.message);
    }

    if (!user) {
      throw new Error("You must be signed in.");
    }

    return user.id;
  }

  async function logArtistMemberActivity({
    summary,
    metadata = {},
  }: {
    summary: string;
    metadata?: Record<string, unknown>;
  }) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.warn("Failed to get user for artist member activity:", userError.message);
      return false;
    }

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
      console.warn("Failed to record artist member activity:", error.message);
      return false;
    }

    window.dispatchEvent(
      new CustomEvent("activity-log-changed", {
        detail: { entityType: "artist", entityId: artist.id },
      })
    );

    return true;
  }

  async function clearPrimaryMember(excludingMemberId?: string) {
    let query = supabase
      .from("artist_members")
      .update({ is_primary: false })
      .eq("artist_id", artist.id)
      .eq("is_primary", true);

    if (excludingMemberId) {
      query = query.neq("id", excludingMemberId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
  }

  async function clearDefaultApprover(excludingMemberId?: string) {
    let query = supabase
      .from("artist_members")
      .update({ is_default_approver: false })
      .eq("artist_id", artist.id)
      .eq("is_default_approver", true);

    if (excludingMemberId) {
      query = query.neq("id", excludingMemberId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
  }

  async function handleAddMember() {
    setAddingMember(true);

    try {
      const userId = await getCurrentUserId();

      const trimmedName = memberName.trim();
      const trimmedRole = memberRole.trim();
      const trimmedEmail = memberEmail.trim();
      const trimmedPhone = memberPhone.trim();
      const trimmedNotes = memberNotes.trim();

      validateContactFields(trimmedEmail, trimmedPhone);

      if (!trimmedName) {
        alert("Member name is required.");
        setAddingMember(false);
        return;
      }

      if (memberIsPrimary) {
        await clearPrimaryMember();
      }

      if (memberIsDefaultApprover) {
        await clearDefaultApprover();
      }

      const { error } = await supabase.from("artist_members").insert({
        agency_id: artist.agency_id,
        artist_id: artist.id,
        name: trimmedName,
        role: trimmedRole || null,
        email: trimmedEmail || null,
        phone: trimmedPhone || null,
        notes: trimmedNotes || null,
        approval_notes: null,
        is_primary: memberIsPrimary,
        receives_gig_notifications: memberReceivesGigNotifications,
        is_default_approver: memberIsDefaultApprover,
        created_by: userId,
        updated_by: userId,
      });

      if (error) throw new Error(error.message);

      await logArtistMemberActivity({
        summary: `Member added: ${trimmedName}.`,
        metadata: {
          name: trimmedName,
          role: trimmedRole || null,
          email: trimmedEmail || null,
          phone: trimmedPhone || null,
          is_primary: memberIsPrimary,
          receives_gig_notifications: memberReceivesGigNotifications,
          is_default_approver: memberIsDefaultApprover,
        },
      });

      resetAddForm();
      setShowAddForm(false);
      await onMembersChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleSaveEdit(memberId: string) {
    setSavingEdit(true);

    try {
      const userId = await getCurrentUserId();

      const trimmedName = editName.trim();
      const trimmedRole = editRole.trim();
      const trimmedEmail = editEmail.trim();
      const trimmedPhone = editPhone.trim();
      const trimmedNotes = editNotes.trim();

      validateContactFields(trimmedEmail, trimmedPhone);

      if (!trimmedName) {
        alert("Member name is required.");
        setSavingEdit(false);
        return;
      }

      if (editIsPrimary) {
        await clearPrimaryMember(memberId);
      }

      if (editIsDefaultApprover) {
        await clearDefaultApprover(memberId);
      }

      const { error } = await supabase
        .from("artist_members")
        .update({
          name: trimmedName,
          role: trimmedRole || null,
          email: trimmedEmail || null,
          phone: trimmedPhone || null,
          notes: trimmedNotes || null,
          is_primary: editIsPrimary,
          receives_gig_notifications: editReceivesGigNotifications,
          is_default_approver: editIsDefaultApprover,
          updated_by: userId,
        })
        .eq("id", memberId);

      if (error) throw new Error(error.message);

      const originalMember = members.find((member) => member.id === memberId);

      const memberChanges: Array<{
        field: string;
        summary: string;
        from: unknown;
        to: unknown;
      }> = [
        {
          field: "name",
          summary: "Member name updated.",
          from: originalMember?.name ?? "",
          to: trimmedName,
        },
        {
          field: "role",
          summary: "Member role updated.",
          from: originalMember?.role ?? "",
          to: trimmedRole,
        },
        {
          field: "email",
          summary: "Member email updated.",
          from: originalMember?.email ?? "",
          to: trimmedEmail,
        },
        {
          field: "phone",
          summary: "Member phone updated.",
          from: originalMember?.phone ?? "",
          to: trimmedPhone,
        },
        {
          field: "notes",
          summary: "Member notes updated.",
          from: originalMember?.notes ?? "",
          to: trimmedNotes,
        },
        {
          field: "is_primary",
          summary: editIsPrimary ? "Primary artist contact changed." : "Primary artist contact removed.",
          from: !!originalMember?.is_primary,
          to: editIsPrimary,
        },
        {
          field: "receives_gig_notifications",
          summary: "Gig notification setting updated.",
          from: !!originalMember?.receives_gig_notifications,
          to: editReceivesGigNotifications,
        },
        {
          field: "is_default_approver",
          summary: editIsDefaultApprover ? "Default approver changed." : "Default approver removed.",
          from: !!originalMember?.is_default_approver,
          to: editIsDefaultApprover,
        },
      ].filter((change) => change.from !== change.to);

      for (const change of memberChanges) {
        await logArtistMemberActivity({
          summary: change.summary,
          metadata: {
            member_id: memberId,
            member_name: trimmedName,
            field: change.field,
            from: change.from,
            to: change.to,
          },
        });
      }

      await onMembersChanged();
      cancelEdit();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save member.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteMember(memberId: string) {
    const member = members.find((item) => item.id === memberId);

    if (member?.is_primary) {
      alert("You cannot delete the primary artist contact. Assign another primary contact first, or edit this member and remove the primary contact role.");
      return;
    }

    const confirmed = window.confirm("Delete this artist member?");
    if (!confirmed) return;

    const { error } = await supabase.from("artist_members").delete().eq("id", memberId);

    if (error) {
      alert(error.message);
      return;
    }

    await logArtistMemberActivity({
      summary: `Member deleted: ${member?.name ?? "Unknown member"}.`,
      metadata: {
        member_id: memberId,
        member_name: member?.name ?? null,
        role: member?.role ?? null,
      },
    });

    setOpenMemberMenuId(null);
    await onMembersChanged();
  }

  return (
    <SectionCard
      title={`Members (${members.length})`}
      actions={
        <IconButton
          label={showAddForm ? "Cancel add member" : "Add member"}
          variant={showAddForm ? "secondary" : "primary"}
          type="button"
          onClick={beginAddMember}
        >
          <Plus size={16} />
        </IconButton>
      }
    >
      <div className="flex flex-col gap-4">
        {members.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--mutedText)" }}>No members yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((member) => {
              const isEditing = editingMemberId === member.id;

              return (
                <div
                  key={member.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: isEditing ? 16 : "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    background:
                      member.is_primary || member.is_default_approver
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.01)",
                  }}
                >
                  {!isEditing ? (
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            position: "relative",
                            width: 34,
                            height: 34,
                            borderRadius: 999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid var(--border)",
                            flex: "0 0 auto",
                          }}
                        >
                          <UserRound size={17} />

                          <div
                            style={{
                              position: "absolute",
                              right: -7,
                              bottom: -6,
                              display: "flex",
                              gap: 2,
                            }}
                          >
                            {member.is_primary ? (
                              <span title="Primary contact" style={miniBadgeStyle}>
                                <Star size={10} />
                              </span>
                            ) : null}

                            {member.is_default_approver ? (
                              <span title="Default approver" style={miniBadgeStyle}>
                                <CheckCircle2 size={10} />
                              </span>
                            ) : null}

                            {member.receives_gig_notifications ? (
                              <span title="Receives gig notifications" style={miniBadgeStyle}>
                                <Zap size={10} />
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 15,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {member.name}
                          </div>
                          {member.role ? (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--mutedText)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {member.role}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setOpenMemberMenuId(openMemberMenuId === member.id ? null : member.id)
                        }
                        style={{
                          border: "1px solid var(--border)",
                          background: "rgba(255,255,255,0.03)",
                          color: "var(--text)",
                          borderRadius: 999,
                          width: 32,
                          height: 32,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flex: "0 0 auto",
                        }}
                        aria-label={`Open menu for ${member.name}`}
                      >
                        <Menu size={16} />
                      </button>

                      {openMemberMenuId === member.id ? (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 40,
                            zIndex: 10,
                            minWidth: 150,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "rgba(18,18,22,0.98)",
                            boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
                            padding: 6,
                            display: "grid",
                            gap: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => beginEdit(member)}
                            style={menuButtonStyle}
                          >
                            Edit
                          </button>

                          {member.email ? (
                            <a href={`mailto:${member.email}`} style={menuLinkStyle}>
                              Email
                            </a>
                          ) : null}

                          {member.phone ? (
                            <a href={`tel:${member.phone}`} style={menuLinkStyle}>
                              Call
                            </a>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleDeleteMember(member.id)}
                            style={menuButtonStyle}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Edit member</div>

                      <MemberFormFields
                        name={editName}
                        setName={setEditName}
                        role={editRole}
                        setRole={setEditRole}
                        email={editEmail}
                        setEmail={setEditEmail}
                        phone={editPhone}
                        setPhone={setEditPhone}
                        notes={editNotes}
                        setNotes={setEditNotes}
                        isPrimary={editIsPrimary}
                        setIsPrimary={setEditPrimaryContact}
                        receivesGigNotifications={editReceivesGigNotifications}
                        setReceivesGigNotifications={setEditReceivesGigNotifications}
                        isDefaultApprover={editIsDefaultApprover}
                        setIsDefaultApprover={setEditIsDefaultApprover}
                        validationError={editContactValidationError}
                      />

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button onClick={() => handleSaveEdit(member.id)} disabled={!canSaveEdit}>
                          {savingEdit ? "Saving…" : "Save changes"}
                        </Button>

                        <Button variant="secondary" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}


        {showAddForm ? (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 16,
            }}
          >
            <MemberFormFields
              name={memberName}
              setName={setMemberName}
              role={memberRole}
              setRole={setMemberRole}
              email={memberEmail}
              setEmail={setMemberEmail}
              phone={memberPhone}
              setPhone={setMemberPhone}
              notes={memberNotes}
              setNotes={setMemberNotes}
              isPrimary={memberIsPrimary}
              setIsPrimary={setAddPrimaryContact}
              receivesGigNotifications={memberReceivesGigNotifications}
              setReceivesGigNotifications={setMemberReceivesGigNotifications}
              isDefaultApprover={memberIsDefaultApprover}
              setIsDefaultApprover={setMemberIsDefaultApprover}
              validationError={addContactValidationError}
            />

            <div style={{ marginTop: 16 }}>
              <Button onClick={handleAddMember} disabled={!canAddMember}>
                {addingMember ? "Adding…" : "Save member"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function MemberFormFields({
  name,
  setName,
  role,
  setRole,
  email,
  setEmail,
  phone,
  setPhone,
  notes,
  setNotes,
  isPrimary,
  setIsPrimary,
  receivesGigNotifications,
  setReceivesGigNotifications,
  isDefaultApprover,
  setIsDefaultApprover,
  validationError,
}: {
  name: string;
  setName: (value: string) => void;
  role: string;
  setRole: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  isPrimary: boolean;
  setIsPrimary: (value: boolean) => void;
  receivesGigNotifications: boolean;
  setReceivesGigNotifications: (value: boolean) => void;
  isDefaultApprover: boolean;
  setIsDefaultApprover: (value: boolean) => void;
  validationError: string | null;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Band member name" />
        </Field>

        <Field label="Role">
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Vocalist, manager, tour manager…"
          />
        </Field>

        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
        </Field>

        <Field label="Phone">
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
          />
        </Field>
      </div>

      {validationError ? (
        <div style={{ color: "#ffb4ab", fontSize: 13 }}>
          {validationError}
        </div>
      ) : null}

      <Field label="Notes">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="General notes about this member"
          style={{ minHeight: 100, resize: "vertical" }}
        />
      </Field>

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Primary artist contact
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={receivesGigNotifications}
            onChange={(e) => setReceivesGigNotifications(e.target.checked)}
          />
          Receives gig notifications
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={isDefaultApprover}
            onChange={(e) => setIsDefaultApprover(e.target.checked)}
          />
          Default approver
        </label>
      </div>
    </div>
  );
}

const miniBadgeStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(18,18,22,0.96)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

const menuButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text)",
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
};

const menuLinkStyle: React.CSSProperties = {
  ...menuButtonStyle,
  textDecoration: "none",
};