"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getActiveAgencyId } from "@/lib/agencyContext";
import { Page, Card, Button, Input } from "@/components/ui";

type Venue = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("UK");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVenues();
  }, []);

  async function loadVenues() {
    const agencyId = getActiveAgencyId();
    if (!agencyId) return;

    const { data, error } = await supabase
      .from("venues")
      .select("id, name, city, country")
      .eq("agency_id", agencyId)
      .order("name");

    if (!error && data) {
      setVenues(data);
    }
  }

  
  async function handleCreateVenue() {
    const agencyId = getActiveAgencyId();

    if (!agencyId) {
      console.error("No active agency id");
      alert("No active agency selected.");
      return;
    }

    if (!name.trim()) {
      alert("Please enter a venue name.");
      return;
    }

    setLoading(true);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const user = userRes?.user;
      if (!user) {
        alert("You are not signed in.");
        return;
      }

      const payload = {
        agency_id: agencyId,
        name: name.trim(),
        city: city.trim() || null,
        country: country.trim() || "UK",
        created_by: user.id,
        updated_by: user.id,
        record_owner_id: user.id,
      };

      console.log("Creating venue payload:", payload);

      const { data, error } = await supabase
        .from("venues")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Insert venue error:", error);
        alert(`Failed to create venue: ${error.message}`);
        return;
      }

      console.log("Venue created:", data);

      setName("");
      setCity("");
      await loadVenues();
    } catch (e) {
      console.error("Unexpected error creating venue:", e);
      alert("Unexpected error creating venue. Check console for details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page title="Venues">
      <Card>
        <div className="space-y-4">
          <Input
            placeholder="Venue name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <Button onClick={handleCreateVenue} disabled={loading}>
            Add Venue
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        {venues.map((venue) => (
          <Card key={venue.id}>
            <Link href={`/venues/${venue.id}`}>
              <div className="cursor-pointer">
                <div className="font-medium">{venue.name}</div>
                <div className="text-sm text-muted">
                  {venue.city} {venue.country}
                </div>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </Page>
  );
}