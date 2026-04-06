"use client";

import { useMemo, useState } from "react";
import { Mail, Phone, Star, Trash2, Plus, Pencil, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  SectionCard,
  Field,
  Input,
  Textarea,
  Button,
  Badge,
  ActionTextLink,
  InlineAction,
  InfoTile,
  SectionActions,
} from "@/components/ui";
import type { Venue, VenueContact } from "../_lib/types";

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

  const canAddContact = useMemo(
    () => contactName.trim().length > 0 && !addingContact,
    [contactName, addingContact]
  );

  const canSaveEdit = useMemo(
    () => editName.trim().length > 0 && !savingEdit,
    [editName, savingEdit]
  );

  const canSendEmail = useMemo(
    () =>
      !!emailingContact?.email &&
      emailSubject.trim().length > 0 &&
      emailMessage.trim().length > 0 &&
      !sendingEmail,
    [emailingContact, emailSubject, emailMessage, sendingEmail]
  );

  function beginEdit(contact: VenueContact) {
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

  async function handleAddContact() {
    setAddingContact(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      setAddingContact(false);
      return;
    }

    if (!user) {
      alert("You must be signed in to add a contact.");
      setAddingContact(false);
      return;
    }

    const trimmedName = contactName.trim();
    const trimmedRole = contactRole.trim();
    const trimmedEmail = contactEmail.trim();
    const trimmedPhone = contactPhone.trim();
    const trimmedNotes = contactNotes.trim();

    if (!trimmedName) {
      alert("Contact name is required.");
      setAddingContact(false);
      return;
    }

    if (contactIsPrimary) {
      const { error: clearPrimaryError } = await supabase
        .from("venue_contacts")
        .update({ is_primary: false, updated_by: user.id })
        .eq("venue_id", venue.id)
        .eq("is_primary", true);

      if (clearPrimaryError) {
        alert(clearPrimaryError.message);
        setAddingContact(false);
        return;
      }
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
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      alert(error.message);
      setAddingContact(false);
      return;
    }

    setContactName("");
    setContactRole("");
    setContactEmail("");
    setContactPhone("");
    setContactNotes("");
    setContactIsPrimary(false);
    setShowAddForm(false);

    await onContactsChanged();
    setAddingContact(false);
  }

  async function handleSaveEdit(contactId: string) {
    setSavingEdit(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      setSavingEdit(false);
      return;
    }

    if (!user) {
      alert("You must be signed in to edit a contact.");
      setSavingEdit(false);
      return;
    }

    const trimmedName = editName.trim();
    const trimmedRole = editRole.trim();
    const trimmedEmail = editEmail.trim();
    const trimmedPhone = editPhone.trim();
    const trimmedNotes = editNotes.trim();

    if (!trimmedName) {
      alert("Contact name is required.");
      setSavingEdit(false);
      return;
    }

    if (editIsPrimary) {
      const { error: clearPrimaryError } = await supabase
        .from("venue_contacts")
        .update({ is_primary: false, updated_by: user.id })
        .eq("venue_id", venue.id)
        .neq("id", contactId)
        .eq("is_primary", true);

      if (clearPrimaryError) {
        alert(clearPrimaryError.message);
        setSavingEdit(false);
        return;
      }
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
        updated_by: user.id,
      })
      .eq("id", contactId);

    if (error) {
      alert(error.message);
      setSavingEdit(false);
      return;
    }

    await onContactsChanged();
    cancelEdit();
    setSavingEdit(false);
  }

  async function handleDeleteContact(contactId: string) {
    const confirmed = window.confirm("Delete this contact?");
    if (!confirmed) return;

    const { error } = await supabase.from("venue_contacts").delete().eq("id", contactId);

    if (error) {
      alert(error.message);
      return;
    }

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

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        alert(userError?.message || "Could not identify current user.");
        setSendingEmail(false);
        return;
      }

      const { error: insertError } = await supabase.from("contact_emails").insert({
        agency_id: venue.agency_id,
        venue_id: venue.id,
        venue_contact_id: emailingContact.id,
        actor_id: user.id,
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

      closeEmailComposer();
      alert("Email sent.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <>
      <SectionCard title={`Contacts (${contacts.length})`}>
        <div className="flex flex-col gap-4">
          {contacts.length === 0 ? (
            <div style={{ fontSize: 14, color: "var(--mutedText)" }}>
              No contacts yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {contacts.map((contact) => {
                const isEditing = editingContactId === contact.id;

                return (
                  <div
                    key={contact.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      background: contact.is_primary
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.01)",
                    }}
                  >
                    {!isEditing ? (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 16,
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{contact.name}</div>

                              {contact.is_primary ? (
                                <Badge>
                                  <Star size={12} />
                                  Primary
                                </Badge>
                              ) : null}
                            </div>

                            {contact.role ? (
                              <div style={{ fontSize: 13, color: "var(--mutedText)" }}>
                                {contact.role}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <ActionTextLink
                              onClick={() => beginEdit(contact)}
                              icon={<Pencil size={15} />}
                              muted
                            >
                              Edit
                            </ActionTextLink>

                            <ActionTextLink
                              onClick={() => handleDeleteContact(contact.id)}
                              icon={<Trash2 size={15} />}
                              muted
                            >
                              Delete
                            </ActionTextLink>
                          </div>
                        </div>

                        {(contact.email || contact.phone) && (
                          <div
                            style={{
                              display: "grid",
                              gap: 10,
                              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            }}
                          >
                            {contact.email ? (
                              <InfoTile
                                label="Email"
                                value={contact.email}
                                action={
                                  <ActionTextLink
                                    onClick={() => openEmailComposer(contact)}
                                    icon={<Mail size={15} />}
                                  >
                                    Email
                                  </ActionTextLink>
                                }
                              />
                            ) : null}

                            {contact.phone ? (
                              <InfoTile
                                label="Phone"
                                value={contact.phone}
                                action={
                                  <ActionTextLink
                                    href={`tel:${contact.phone}`}
                                    icon={<Phone size={15} />}
                                  >
                                    Call
                                  </ActionTextLink>
                                }
                              />
                            ) : null}
                          </div>
                        )}

                        {contact.notes ? (
                          <div
                            style={{
                              fontSize: 14,
                              color: "var(--mutedText)",
                              lineHeight: 1.5,
                            }}
                          >
                            {contact.notes}
                          </div>
                        ) : null}

                        <SectionActions>
                          {contact.email ? (
                            <InlineAction onClick={() => openEmailComposer(contact)}>
                              Send email
                            </InlineAction>
                          ) : null}

                          {contact.phone ? (
                            <ActionTextLink href={`tel:${contact.phone}`}>Make call</ActionTextLink>
                          ) : null}

                          <InlineAction muted>Log email</InlineAction>
                          <InlineAction muted>Log call</InlineAction>
                        </SectionActions>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>Edit contact</div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Name" required>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Contact name"
                            />
                          </Field>

                          <Field label="Role">
                            <Input
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              placeholder="Booker, promoter, production…"
                            />
                          </Field>

                          <Field label="Email">
                            <Input
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="Email"
                            />
                          </Field>

                          <Field label="Phone">
                            <Input
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="Phone"
                            />
                          </Field>
                        </div>

                        <Field label="Notes">
                          <Textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Notes about this contact"
                            style={{ minHeight: 100, resize: "vertical" }}
                          />
                        </Field>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <input
                            id={`edit-primary-${contact.id}`}
                            type="checkbox"
                            checked={editIsPrimary}
                            onChange={(e) => setEditIsPrimary(e.target.checked)}
                          />
                          <label htmlFor={`edit-primary-${contact.id}`} style={{ fontSize: 14 }}>
                            Set as primary contact
                          </label>
                        </div>

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

          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <Button
              variant={showAddForm ? "secondary" : "primary"}
              onClick={() => setShowAddForm((v) => !v)}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={16} />
                {showAddForm ? "Cancel" : "Add contact"}
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
                <Field label="Name" required>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contact name"
                  />
                </Field>

                <Field label="Role">
                  <Input
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    placeholder="Booker, promoter, production…"
                  />
                </Field>

                <Field label="Email">
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Email"
                  />
                </Field>

                <Field label="Phone">
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone"
                  />
                </Field>
              </div>

              <div style={{ marginTop: 16 }}>
                <Field label="Notes">
                  <Textarea
                    value={contactNotes}
                    onChange={(e) => setContactNotes(e.target.value)}
                    placeholder="Notes about this contact"
                    style={{ minHeight: 100, resize: "vertical" }}
                  />
                </Field>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <input
                  id="is-primary-contact"
                  type="checkbox"
                  checked={contactIsPrimary}
                  onChange={(e) => setContactIsPrimary(e.target.checked)}
                />
                <label htmlFor="is-primary-contact" style={{ fontSize: 14 }}>
                  Set as primary contact
                </label>
              </div>

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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
          onClick={closeEmailComposer}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 680,
              border: "1px solid var(--border)",
              borderRadius: 16,
              background: "var(--panel)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Send email</div>
                <div style={{ fontSize: 13, color: "var(--mutedText)", marginTop: 4 }}>
                  To {emailingContact.name}
                  {emailingContact.email ? ` · ${emailingContact.email}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={closeEmailComposer}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--mutedText)",
                }}
                title="Close"
              >
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

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                id="bcc-myself"
                type="checkbox"
                checked={bccMyself}
                onChange={(e) => setBccMyself(e.target.checked)}
              />
              <label htmlFor="bcc-myself" style={{ fontSize: 14 }}>
                BCC myself
              </label>
            </div>

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
