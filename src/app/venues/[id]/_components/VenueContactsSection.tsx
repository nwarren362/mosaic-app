"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Menu, Plus, Star, UserRound, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  SectionCard,
  Field,
  Input,
  Textarea,
  Button,
  IconButton,
} from "@/components/ui";
import type { Venue, VenueContact } from "../_lib/types";
import { logVenueActivity } from "../_lib/activity";

type Props = {
  venue: Venue;
  contacts: VenueContact[];
  onContactsChanged: () => Promise<void>;
};

export default function VenueContactsSection({
  venue,
  contacts,
  onContactsChanged,
}: Props) {
  const [addingContact, setAddingContact] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [openContactMenuId, setOpenContactMenuId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [emailingContact, setEmailingContact] = useState<VenueContact | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [bccMyself, setBccMyself] = useState(true);

  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIsPrimary, setEditIsPrimary] = useState(false);

  const addContactValidationError = useMemo(
    () => getContactValidationError(contactEmail, contactPhone),
    [contactEmail, contactPhone]
  );

  const editContactValidationError = useMemo(
    () => getContactValidationError(editEmail, editPhone),
    [editEmail, editPhone]
  );

  const canAddContact = useMemo(
    () => contactName.trim().length > 0 && !addingContact && !addContactValidationError,
    [contactName, addingContact, addContactValidationError]
  );

  const canSaveEdit = useMemo(
    () => editName.trim().length > 0 && !savingEdit && !editContactValidationError,
    [editName, savingEdit, editContactValidationError]
  );

  const canSendEmail = useMemo(
    () =>
      !!emailingContact?.email &&
      emailSubject.trim().length > 0 &&
      emailMessage.trim().length > 0 &&
      !sendingEmail,
    [emailingContact, emailSubject, emailMessage, sendingEmail]
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

  function resetAddForm() {
    setContactName("");
    setContactRole("");
    setContactEmail("");
    setContactPhone("");
    setContactNotes("");
    setContactIsPrimary(false);
  }

  function beginAddContact() {
    const opening = !showAddForm;

    if (opening) {
      resetAddForm();

      if (contacts.length === 0) {
        setContactIsPrimary(true);
      }
    }

    setShowAddForm((value) => !value);
  }

  function setAddPrimaryContact(value: boolean) {
    if (value && contacts.some((contact) => contact.is_primary)) {
      const confirmed = window.confirm(
        "Another venue contact is already primary. Selecting this contact will replace the existing primary contact. Continue?"
      );

      if (!confirmed) return;
    }

    setContactIsPrimary(value);
  }

  function setEditPrimaryContact(value: boolean) {
    if (
      value &&
      contacts.some((contact) => contact.is_primary && contact.id !== editingContactId)
    ) {
      const confirmed = window.confirm(
        "Another venue contact is already primary. Selecting this contact will replace the existing primary contact. Continue?"
      );

      if (!confirmed) return;
    }

    setEditIsPrimary(value);
  }

  function beginEdit(contact: VenueContact) {
    setOpenContactMenuId(null);
    setEditingContactId(contact.id);
    setEditName(contact.name ?? "");
    setEditRole(contact.role ?? "");
    setEditEmail(contact.email ?? "");
    setEditPhone(contact.phone ?? "");
    setEditNotes(contact.notes ?? "");
    setEditIsPrimary(!!contact.is_primary);
  }

  function cancelEdit() {
    setEditingContactId(null);
    setEditName("");
    setEditRole("");
    setEditEmail("");
    setEditPhone("");
    setEditNotes("");
    setEditIsPrimary(false);
  }

  function openEmailComposer(contact: VenueContact) {
    setOpenContactMenuId(null);
    setEmailingContact(contact);
    setEmailSubject("");
    setEmailMessage("");
    setBccMyself(true);
  }

  function closeEmailComposer() {
    setEmailingContact(null);
    setEmailSubject("");
    setEmailMessage("");
    setBccMyself(true);
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

  async function clearPrimaryContact(userId: string, excludingContactId?: string) {
    let query = supabase
      .from("venue_contacts")
      .update({ is_primary: false, updated_by: userId })
      .eq("venue_id", venue.id)
      .eq("is_primary", true);

    if (excludingContactId) {
      query = query.neq("id", excludingContactId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
  }

  async function handleAddContact() {
    setAddingContact(true);

    try {
      const userId = await getCurrentUserId();

      const trimmedName = contactName.trim();
      const trimmedRole = contactRole.trim();
      const trimmedEmail = contactEmail.trim();
      const trimmedPhone = contactPhone.trim();
      const trimmedNotes = contactNotes.trim();

      validateContactFields(trimmedEmail, trimmedPhone);

      if (!trimmedName) {
        alert("Contact name is required.");
        setAddingContact(false);
        return;
      }

      if (contactIsPrimary) {
        await clearPrimaryContact(userId);
      }

      const { error } = await supabase.from("venue_contacts").insert({
        agency_id: venue.agency_id,
        venue_id: venue.id,
        name: trimmedName,
        role: trimmedRole || null,
        email: trimmedEmail || null,
        phone: trimmedPhone || null,
        notes: trimmedNotes || null,
        is_primary: contactIsPrimary,
        created_by: userId,
        updated_by: userId,
      });

      if (error) throw new Error(error.message);

      await logVenueActivity({
        venue,
        activityType: "contact_added",
        summary: `Added contact ${trimmedName}${trimmedRole ? ` (${trimmedRole})` : ""}.`,
        metadata: {
          name: trimmedName,
          role: trimmedRole || null,
          email: trimmedEmail || null,
          phone: trimmedPhone || null,
        },
      });

      window.dispatchEvent(
        new CustomEvent("activity-log-changed", {
          detail: { entityType: "venue", entityId: venue.id },
        })
      );

      resetAddForm();
      setShowAddForm(false);
      await onContactsChanged();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add contact.");
    } finally {
      setAddingContact(false);
    }
  }

  async function handleSaveEdit(contactId: string) {
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
        alert("Contact name is required.");
        setSavingEdit(false);
        return;
      }

      if (editIsPrimary) {
        await clearPrimaryContact(userId, contactId);
      }

      const { error } = await supabase
        .from("venue_contacts")
        .update({
          name: trimmedName,
          role: trimmedRole || null,
          email: trimmedEmail || null,
          phone: trimmedPhone || null,
          notes: trimmedNotes || null,
          is_primary: editIsPrimary,
          updated_by: userId,
        })
        .eq("id", contactId);

      if (error) throw new Error(error.message);

      const originalContact = contacts.find((contact) => contact.id === contactId);

      const contactChanges: Array<{
        field: string;
        summary: string;
        from: unknown;
        to: unknown;
      }> = [
        {
          field: "name",
          summary: "Contact name updated.",
          from: originalContact?.name ?? "",
          to: trimmedName,
        },
        {
          field: "role",
          summary: "Contact role updated.",
          from: originalContact?.role ?? "",
          to: trimmedRole,
        },
        {
          field: "email",
          summary: "Contact email updated.",
          from: originalContact?.email ?? "",
          to: trimmedEmail,
        },
        {
          field: "phone",
          summary: "Contact phone updated.",
          from: originalContact?.phone ?? "",
          to: trimmedPhone,
        },
        {
          field: "notes",
          summary: "Contact notes updated.",
          from: originalContact?.notes ?? "",
          to: trimmedNotes,
        },
        {
          field: "is_primary",
          summary: editIsPrimary ? "Primary contact changed." : "Primary contact removed.",
          from: !!originalContact?.is_primary,
          to: editIsPrimary,
        },
      ].filter((change) => change.from !== change.to);

      for (const change of contactChanges) {
        await logVenueActivity({
          venue,
          activityType: "contact_updated",
          summary: change.summary,
          metadata: {
            contact_id: contactId,
            contact_name: trimmedName,
            field: change.field,
            from: change.from,
            to: change.to,
          },
        });
      }

      if (contactChanges.length > 0) {
        window.dispatchEvent(
          new CustomEvent("activity-log-changed", {
            detail: { entityType: "venue", entityId: venue.id },
          })
        );
      }

      await onContactsChanged();
      cancelEdit();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save contact.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId);

    if (contact?.is_primary) {
      alert(
        "You cannot delete the primary venue contact. Assign another primary contact first, or edit this contact and remove the primary role."
      );
      return;
    }

    const confirmed = window.confirm("Delete this contact?");
    if (!confirmed) return;

    const { error } = await supabase.from("venue_contacts").delete().eq("id", contactId);

    if (error) {
      alert(error.message);
      return;
    }

    await logVenueActivity({
      venue,
      activityType: "contact_deleted",
      summary: `Deleted contact ${contact?.name ?? "Unknown contact"}.`,
      metadata: {
        contact_id: contactId,
        name: contact?.name ?? null,
      },
    });

    window.dispatchEvent(
      new CustomEvent("activity-log-changed", {
        detail: { entityType: "venue", entityId: venue.id },
      })
    );

    setOpenContactMenuId(null);
    await onContactsChanged();
  }

  async function handleSendEmail() {
    if (!emailingContact?.email) return;

    setSendingEmail(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("You must be signed in to send email.");
        setSendingEmail(false);
        return;
      }

      const response = await fetch("/api/contact-emails/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          toEmail: emailingContact.email,
          subject: emailSubject.trim(),
          textBody: emailMessage.trim(),
          bccMyself,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result?.error || "Failed to send email.");
        setSendingEmail(false);
        return;
      }

      const userId = await getCurrentUserId();

      const { error: insertError } = await supabase.from("contact_emails").insert({
        agency_id: venue.agency_id,
        venue_id: venue.id,
        venue_contact_id: emailingContact.id,
        actor_id: userId,
        direction: "outbound",
        subject: emailSubject.trim(),
        text_body: emailMessage.trim(),
        html_body: null,
        resend_email_id: result.resendEmailId,
        thread_key: `venue-contact-${emailingContact.id}`,
        status: "sent",
        sent_at: new Date().toISOString(),
        from_name: result.fromName,
        from_email: result.fromEmail,
        to_email: result.toEmail,
        bcc_email: result.bccEmail,
      });

      if (insertError) {
        alert(insertError.message);
        setSendingEmail(false);
        return;
      }

      await logVenueActivity({
        venue,
        activityType: "email_sent",
        summary: `Sent email to ${emailingContact.name}${emailingContact.email ? ` (${emailingContact.email})` : ""}.`,
        metadata: {
          contact_id: emailingContact.id,
          subject: emailSubject.trim(),
          resend_email_id: result.resendEmailId,
        },
      });

      window.dispatchEvent(
        new CustomEvent("activity-log-changed", {
          detail: { entityType: "venue", entityId: venue.id },
        })
      );

      closeEmailComposer();
      alert("Email sent.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <>
      <SectionCard
        title={`Contacts (${contacts.length})`}
        actions={
          <IconButton
            label={showAddForm ? "Cancel add contact" : "Add contact"}
            variant={showAddForm ? "secondary" : "primary"}
            type="button"
            onClick={beginAddContact}
          >
            <Plus size={16} />
          </IconButton>
        }
      >
        <div className="flex flex-col gap-4">
          {contacts.length === 0 ? (
            <div style={{ fontSize: 14, color: "var(--mutedText)" }}>
              No contacts yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {contacts.map((contact) => {
                const isEditing = editingContactId === contact.id;

                return (
                  <div
                    key={contact.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: isEditing ? 16 : "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      background: contact.is_primary
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.01)",
                    }}
                  >
                    {!isEditing ? (
                      <div style={rowShellStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <div style={contactIconStyle}>
                            <UserRound size={17} />

                            {contact.is_primary ? (
                              <span title="Primary contact" style={miniBadgeStyle}>
                                <Star size={10} />
                              </span>
                            ) : null}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={rowNameStyle}>{contact.name}</div>
                            {contact.role ? <div style={rowMetaStyle}>{contact.role}</div> : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenContactMenuId(
                              openContactMenuId === contact.id ? null : contact.id
                            )
                          }
                          style={rowMenuButtonStyle}
                          aria-label={`Open menu for ${contact.name}`}
                        >
                          <Menu size={16} />
                        </button>

                        {openContactMenuId === contact.id ? (
                          <div style={menuPanelStyle}>
                            <button type="button" onClick={() => beginEdit(contact)} style={menuButtonStyle}>
                              Edit
                            </button>

                            {contact.email ? (
                              <button
                                type="button"
                                onClick={() => openEmailComposer(contact)}
                                style={menuButtonStyle}
                              >
                                Email
                              </button>
                            ) : null}

                            {contact.phone ? (
                              <a href={`tel:${contact.phone}`} style={menuLinkStyle}>
                                Call
                              </a>
                            ) : null}

                            <button type="button" disabled style={disabledMenuButtonStyle}>
                              Log email
                            </button>

                            <button type="button" disabled style={disabledMenuButtonStyle}>
                              Log call
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteContact(contact.id)}
                              style={menuButtonStyle}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>Edit contact</div>

                        <ContactFormFields
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
                          validationError={editContactValidationError}
                        />

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <Button
                            onClick={() => handleSaveEdit(contact.id)}
                            disabled={!canSaveEdit}
                          >
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
              <ContactFormFields
                name={contactName}
                setName={setContactName}
                role={contactRole}
                setRole={setContactRole}
                email={contactEmail}
                setEmail={setContactEmail}
                phone={contactPhone}
                setPhone={setContactPhone}
                notes={contactNotes}
                setNotes={setContactNotes}
                isPrimary={contactIsPrimary}
                setIsPrimary={setAddPrimaryContact}
                validationError={addContactValidationError}
              />

              <div style={{ marginTop: 16 }}>
                <Button onClick={handleAddContact} disabled={!canAddContact}>
                  {addingContact ? "Adding…" : "Save contact"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {emailingContact ? (
        <div style={modalOverlayStyle} onClick={closeEmailComposer}>
          <div onClick={(e) => e.stopPropagation()} style={modalPanelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Send email</div>
                <div style={{ fontSize: 13, color: "var(--mutedText)", marginTop: 4 }}>
                  To {emailingContact.name}
                  {emailingContact.email ? ` · ${emailingContact.email}` : ""}
                </div>
              </div>

              <button type="button" onClick={closeEmailComposer} style={closeButtonStyle} title="Close">
                <X size={18} />
              </button>
            </div>

            <Field label="Subject" required>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Subject"
              />
            </Field>

            <Field label="Message" required>
              <Textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Write your email..."
                style={{ minHeight: 220, resize: "vertical" }}
              />
            </Field>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={bccMyself}
                onChange={(e) => setBccMyself(e.target.checked)}
              />
              BCC myself
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={handleSendEmail} disabled={!canSendEmail}>
                {sendingEmail ? "Sending…" : "Send email"}
              </Button>

              <Button variant="secondary" onClick={closeEmailComposer}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ContactFormFields({
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
  validationError: string | null;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contact name"
          />
        </Field>

        <Field label="Role">
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Booker, promoter, production…"
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
          placeholder="Notes about this contact"
          style={{ minHeight: 100, resize: "vertical" }}
        />
      </Field>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
        />
        Primary venue contact
      </label>
    </div>
  );
}

const rowShellStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const contactIconStyle: CSSProperties = {
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
};

const miniBadgeStyle: CSSProperties = {
  position: "absolute",
  right: -5,
  bottom: -5,
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

const rowNameStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMetaStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--mutedText)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMenuButtonStyle: CSSProperties = {
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
};

const menuPanelStyle: CSSProperties = {
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
};

const menuButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text)",
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 13,
};

const disabledMenuButtonStyle: CSSProperties = {
  ...menuButtonStyle,
  color: "var(--mutedText)",
  cursor: "not-allowed",
};

const menuLinkStyle: CSSProperties = {
  ...menuButtonStyle,
  textDecoration: "none",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000,
};

const modalPanelStyle: CSSProperties = {
  width: "100%",
  maxWidth: 680,
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "var(--panel, rgba(24,24,28,0.98))",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};

const closeButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "var(--mutedText)",
};
