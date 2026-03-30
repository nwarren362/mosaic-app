export type Venue = {
  id: string;
  agency_id: string;
  name: string;
  city: string | null;
  country: string | null;
  capacity: number | null;
  website: string | null;
  notes: string | null;
  record_owner_id: string | null;
  updated_at: string;
  google_maps_url: string | null;
};

export type AgencyMembershipRow = {
  user_id: string;
  role: string;
};

export type ProfileRow = {
  id: string;
  display_name: string | null;
};

export type AgencyMember = {
  id: string;
  display_name: string | null;
  role: string;
};

export type VenueContact = {
  id: string;
  agency_id: string;
  venue_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type Artist = {
  id: string;
  name: string;
};

export type Gig = {
  id: string;
  title: string;
  starts_at: string;
};

export type VenueFeedback = {
  id: string;
  agency_id: string;
  venue_id: string;
  author_id: string;
  gig_id: string | null;
  artist_id: string | null;
  feedback_type: string | null;
  rating: number | null;
  content: string;
  created_at: string;
  updated_at: string;
};