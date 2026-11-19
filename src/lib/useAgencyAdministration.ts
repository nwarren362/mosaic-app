"use client";

import { useEffect, useState } from "react";
import { getAdministrationAccess } from "@/lib/administrationAccess";

export function useAgencyAdministration(agencyId: string) {
  const [access, setAccess] = useState<{ agencyId: string; canDelete: boolean } | null>(null);
  useEffect(() => {
    if (!agencyId) return;
    let active = true;
    getAdministrationAccess().then(result => {
      if (active) setAccess({ agencyId, canDelete: result.isSuperUser || result.agencies.some(agency => agency.id === agencyId) });
    }).catch(() => {
      // A failed permissions lookup never offers permanent deletion.
      if (active) setAccess({ agencyId, canDelete: false });
    });
    return () => { active = false; };
  }, [agencyId]);
  return { canDelete: access?.agencyId === agencyId && access.canDelete, checking: access?.agencyId !== agencyId };
}
