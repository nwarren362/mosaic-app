const STORAGE_KEY = "active_agency_id";

export function getActiveAgencyId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setActiveAgencyId(agencyId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, agencyId);
}

export function clearActiveAgencyId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}