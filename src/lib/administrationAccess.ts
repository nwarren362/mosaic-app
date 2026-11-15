import { supabase } from "@/lib/supabaseClient";

export type AdminAgency = { id: string; name: string };

// UI convenience only: database grants/RLS remain authoritative for every mutation.
export async function getAdministrationAccess() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) return { userId: null, isSuperUser: false, agencies: [] as AdminAgency[] };
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("is_super_user").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  const isSuperUser = Boolean(profile?.is_super_user);
  // Support users retain the existing membership-policy scope, including agencies
  // whose names are hidden by the separate agencies SELECT policy.
  let memberships = supabase.from("agency_memberships").select("agency_id");
  if (!isSuperUser) memberships = memberships.eq("user_id", user.id).eq("role", "admin");
  const { data: rows, error: membershipError } = await memberships;
  if (membershipError) throw new Error(membershipError.message);
  const agencyIds = [...new Set((rows ?? []).map(row => row.agency_id as string))];
  if (!agencyIds.length) return { userId: user.id, isSuperUser, agencies: [] as AdminAgency[] };
  const query = supabase.from("agencies").select("id,name").in("id", agencyIds).order("name", { ascending: true });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const names = new Map((data ?? []).map(row => [row.id as string, row.name as string]));
  const agencies = agencyIds.map(id => ({ id, name: names.get(id) ?? id }));
  return { userId: user.id, isSuperUser, agencies };
}
