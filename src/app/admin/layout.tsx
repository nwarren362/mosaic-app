"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAdministrationAccess } from "@/lib/administrationAccess";
import { Card, Page } from "@/components/ui";

type Decision = { path: string; allowed: boolean; message: string };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [decision, setDecision] = useState<Decision | null>(null);
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const access = await getAdministrationAccess();
        const agencyAdminPage = pathname === "/admin/invitations" || pathname === "/admin/email";
        const allowed = access.isSuperUser || (agencyAdminPage && access.agencies.length > 0);
        if (active) setDecision({ path: pathname, allowed, message: !access.userId
          ? "Please sign in to use administration tools."
          : agencyAdminPage ? "Agency administrator access is required." : "Super-user access is required." });
      } catch {
        if (active) setDecision({ path: pathname, allowed: false, message: "Could not verify administrator access. Refresh the page to try again." });
      }
    }
    void check();
    window.addEventListener("focus", check);
    return () => { active = false; window.removeEventListener("focus", check); };
  }, [pathname]);
  if (!decision || decision.path !== pathname) return <Page title="Administration"><Card>Checking administrator access…</Card></Page>;
  if (!decision.allowed) return <Page title="Administration"><Card><p role="alert">{decision.message}</p></Card></Page>;
  return children;
}
