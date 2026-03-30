"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Music,
  Building2,
  Mail,
  Palette,
  Wrench,
  FileText,
  Calendar,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  Icon: any;
};

function NavLink({ href, label, Icon, collapsed }: NavItem & { collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        position: "relative",
        color: active ? "var(--text)" : "var(--mutedText)",
        background: active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
        border: active
          ? "1px solid rgba(255,255,255,0.16)"
          : "1px solid rgba(255,255,255,0.08)",
        transition: "var(--transition-fast)",
        fontWeight: active ? 900 : 650,
        whiteSpace: "nowrap",
      }}
      title={collapsed ? label : undefined}
    >
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 999,
            background: "var(--primary)",
          }}
        />
      )}

      <Icon size={18} strokeWidth={1.6} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export default function AppShell({
  children,
  isSuperUser,
  navOpen,
  setNavOpen,
  collapsed,
}: {
  children: React.ReactNode;
  isSuperUser: boolean;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  collapsed: boolean;
}) {
  const primary: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", Icon: LayoutGrid },
    { href: "/artists", label: "Artists", Icon: Music },
    { href: "/venues", label: "Venues", Icon: Building2 },
    { href: "/gigs", label: "Gigs", Icon: Calendar },
    { href: "/me", label: "Me", Icon: FileText },
    { href: "/admin/invitations", label: "Invitations", Icon: Mail },
  ];

  const admin: NavItem[] = [
    { href: "/admin/branding", label: "Branding", Icon: Palette },
    { href: "/admin/test-tools", label: "Test tools", Icon: Wrench },
  ];

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`}>
        <div style={{ padding: "var(--space-4)" }}>
          <nav style={{ display: "grid", gap: "var(--space-2)" }}>
            {primary.map((i) => (
              <NavLink key={i.href} {...i} collapsed={collapsed} />
            ))}
          </nav>

          {isSuperUser && (
            <>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--mutedText)",
                  marginTop: "var(--space-5)",
                  marginBottom: "var(--space-2)",
                }}
              >
                Super user
              </div>
              <nav style={{ display: "grid", gap: "var(--space-2)" }}>
                {admin.map((i) => (
                  <NavLink key={i.href} {...i} collapsed={collapsed} />
                ))}
              </nav>
            </>
          )}
        </div>
      </aside>

      {navOpen && (
        <div className="app-drawer-overlay" onClick={() => setNavOpen(false)}>
          <div className="app-drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "var(--space-4)" }}>
              <nav style={{ display: "grid", gap: "var(--space-2)" }}>
                {primary.map((i) => (
                  <div key={i.href} onClick={() => setNavOpen(false)}>
                    <NavLink {...i} collapsed={false} />
                  </div>
                ))}
              </nav>

              {isSuperUser && (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--mutedText)",
                      marginTop: "var(--space-5)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    Super user
                  </div>
                  <nav style={{ display: "grid", gap: "var(--space-2)" }}>
                    {admin.map((i) => (
                      <div key={i.href} onClick={() => setNavOpen(false)}>
                        <NavLink {...i} collapsed={false} />
                      </div>
                    ))}
                  </nav>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="app-main">{children}</div>
    </div>
  );
}
