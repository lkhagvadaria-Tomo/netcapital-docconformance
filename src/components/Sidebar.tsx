import { useState } from "react";
import { NavLink } from "react-router-dom";
import { mn } from "@/i18n/mn";
import { useAuth } from "@/lib/auth/AuthProvider";

const NAV_ITEMS: { to: string; label: string; enterpriseOnly?: boolean }[] = [
  { to: "/", label: mn.nav.home },
  { to: "/okr", label: mn.nav.okrDocuments },
  { to: "/frameworks", label: mn.nav.frameworksRules },
  { to: "/audit", label: mn.nav.audit },
  { to: "/findings", label: mn.nav.findings },
  { to: "/outputs", label: mn.nav.outputs },
  { to: "/approvals", label: mn.nav.approvals },
  { to: "/admin", label: mn.nav.admin, enterpriseOnly: false },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, isMock, signOut } = useAuth();

  return (
    // Below md: a horizontal, horizontally-scrollable strip (own overflow-x
    // container — the page body itself must never scroll sideways, §9).
    // At md+: the familiar fixed-width left column, collapsible.
    <aside
      className={`sticky top-0 z-20 flex flex-row items-center gap-2 overflow-x-auto border-b border-line bg-surface-2 p-2 md:z-auto md:h-screen md:flex-col md:items-stretch md:gap-4 md:overflow-visible md:border-b-0 md:border-r md:p-3 md:transition-[width] ${
        collapsed ? "md:w-[64px]" : "md:w-[230px]"
      }`}
    >
      <div className="flex flex-none items-center gap-2 px-1">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-[11px] font-bold text-accent-ink">
          DC
        </div>
        <div className={collapsed ? "md:hidden" : ""}>
          <div className="whitespace-nowrap text-[15px] font-semibold leading-tight">
            DocConformance
          </div>
          <div className="hidden whitespace-nowrap text-[10px] uppercase tracking-wide text-ink-3 md:block">
            Netcapital
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="ml-1 hidden rounded p-1 text-ink-3 hover:bg-surface-3 md:ml-auto md:block"
          aria-label="Collapse sidebar"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="flex flex-none flex-row gap-0.5 md:flex-1 md:flex-col md:overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-2.5 py-2 text-[13.5px] font-medium ${
                isActive
                  ? "bg-accent-soft text-accent-strong"
                  : "text-ink-2 hover:bg-surface-3 hover:text-ink"
              }`
            }
          >
            <span className="md:hidden">
              {collapsed ? item.label.slice(0, 1) : item.label}
            </span>
            <span className="hidden md:inline">
              {!collapsed ? item.label : item.label.slice(0, 1)}
            </span>
          </NavLink>
        ))}
      </nav>

      {!collapsed && profile && (
        <div className="hidden flex-col gap-2 border-t border-line pt-3 md:flex">
          {isMock && (
            <div className="rounded-md border border-warn-soft bg-warn-soft px-2 py-1 text-[10.5px] font-medium text-warn">
              {mn.auth.mockModeLabel}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2">
            <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
              {profile.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold">
                {profile.name}
              </div>
              <div className="truncate text-[10.5px] text-ink-3">
                {profile.role}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-line px-2.5 py-1.5 text-left text-[12px] font-medium text-ink-2 hover:border-ink-3"
          >
            {mn.auth.signOut}
          </button>
        </div>
      )}

      {/* Mobile-only: a compact avatar + sign-out, since the full card above is md+ only. */}
      {profile && (
        <button
          type="button"
          onClick={() => signOut()}
          className="ml-auto flex flex-none items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 md:hidden"
          title={mn.auth.signOut}
        >
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-ink">
            {profile.name.slice(0, 1)}
          </span>
        </button>
      )}
    </aside>
  );
}
