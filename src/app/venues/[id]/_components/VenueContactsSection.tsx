"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SectionCard, Field, Input, Textarea, Button } from "@/components/ui";
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

  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  const canAddContact = useMemo(
    () => contactName.trim().length > 0 && !addingContact,
    [contactName, addingContact]
  );

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

  return (
    <SectionCard title={`Contacts (${contacts.length})`}>
      <div className="flex flex-col gap-4">
        {contacts.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--mutedText)" }}>
            No contacts yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
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
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {contact.name}
                      {contact.is_primary ? " · Primary" : ""}
                    </div>

                    {contact.role ? (
                      <div style={{ fontSize: 13, color: "var(--mutedText)", marginTop: 2 }}>
                        {contact.role}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        style={{
                          fontSize: 13,
                          textDecoration: "underline",
                        }}
                      >
                        Email
                      </a>
                    ) : null}

                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        style={{
                          fontSize: 13,
                          textDecoration: "underline",
                        }}
                      >
                        Call
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleDeleteContact(contact.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        fontSize: 13,
                        textDecoration: "underline",
                        color: "var(--mutedText)",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {(contact.email || contact.phone) && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      fontSize: 14,
                    }}
                  >
                    {contact.email ? <div>{contact.email}</div> : null}
                    {contact.phone ? <div>{contact.phone}</div> : null}
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
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button
            variant={showAddForm ? "secondary" : "primary"}
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? "Cancel" : "Add contact"}
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
  );
}