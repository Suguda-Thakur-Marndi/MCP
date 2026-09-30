"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldAlert,
  Sliders,
  Bot,
  Wrench,
  CheckCircle,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  X,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";
import { RoleBadge } from "../ui/Badges";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badgeCount?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    api.auth.me()
      .then((u) => {
        if (active) setCurrentUser(u);
      })
      .catch(() => {
        if (active) {
          const role = typeof window !== "undefined" ? localStorage.getItem("sentinel_role") || "ADMIN" : "ADMIN";
          const email = typeof window !== "undefined" ? localStorage.getItem("sentinel_email") || "admin@sentinel.test" : "admin@sentinel.test";
          setCurrentUser({
            id: "usr_local",
            email,
            name: "Security Admin",
            display_name: "Security Admin",
            role,
            status: "ACTIVE",
            is_active: true,
            permissions: ["*"],
          });
        }
      });

    api.approvals.pending()
      .then((items) => {
        if (active) setPendingApprovalsCount(items.length);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [pathname]);

  const NAVIGATION: NavGroup[] = [
    {
      group: "Operations",
      items: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Guarded Agent", href: "/agent", icon: Bot },
        { label: "MCP Tools", href: "/tools", icon: Wrench },
      ],
    },
    {
      group: "Governance & Control",
      items: [
        { label: "Approval Queue", href: "/approvals", icon: ShieldAlert, badgeCount: pendingApprovalsCount },
        { label: "Policy Engine", href: "/policies", icon: Sliders },
      ],
    },
    {
      group: "Compliance & Audit",
      items: [
        { label: "Audit Ledger", href: "/audit", icon: ScrollText },
        { label: "Security Benchmarks", href: "/evaluation", icon: CheckCircle },
      ],
    },
    {
      group: "System",
      items: [
        { label: "Platform Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col transition-all duration-200 select-none ${
        isCollapsed ? "w-16" : "w-60"
      } ${
        isMobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-[var(--border)] px-3.5 flex items-center justify-between">
        <Link href="/" onClick={onCloseMobile} className="flex items-center gap-2.5 overflow-hidden group">
          <div className="w-7 h-7 rounded bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
            <Shield className="w-4 h-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold tracking-wider text-[var(--text-primary)] flex items-center">
                MCP<span className="text-[var(--accent)] font-semibold ml-0.5">SENTINEL</span>
              </span>
              <span className="text-[9px] text-[var(--text-muted)] font-mono tracking-wider">
                GATEKEEPER v1.0
              </span>
            </div>
          )}
        </Link>
        <div className="flex items-center gap-1">
          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors lg:hidden"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Organization Header */}
      {!isCollapsed && (
        <div className="px-3.5 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)]/50 flex items-center justify-between">
          <div className="truncate pr-2">
            <span className="text-[9px] uppercase font-semibold tracking-wider text-[var(--text-muted)] block">Workspace</span>
            <span className="text-xs font-medium text-[var(--text-primary)] truncate block">
              {currentUser?.organization || "Sentinel Enterprise"}
            </span>
          </div>
          {currentUser?.role && <RoleBadge role={currentUser.role} />}
        </div>
      )}

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAVIGATION.map((grp) => (
          <div key={grp.group}>
            {!isCollapsed && (
              <h5 className="px-2 mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {grp.group}
              </h5>
            )}
            <ul className="space-y-0.5">
              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}`));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                        isActive
                          ? "bg-[var(--bg-card)] text-[var(--accent)] font-semibold shadow-xs border-l-2 border-[var(--accent)]"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                      } ${isCollapsed ? "justify-center px-0" : ""}`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!isCollapsed && (item.badgeCount ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--risk-high-bg)] border border-[var(--risk-high-border)] text-[var(--risk-high)] font-mono-tnum text-[10px] font-bold">
                          {item.badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer / User Profile summary */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-primary)]/40">
        <div className={`flex items-center gap-2.5 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="w-6 h-6 rounded bg-[var(--border)] text-[var(--text-primary)] flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
            {currentUser?.name ? currentUser.name[0].toUpperCase() : "A"}
          </div>
          {!isCollapsed && (
            <div className="truncate flex-1">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">{currentUser?.name || "Security Operator"}</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate font-mono-tnum">{currentUser?.email || "admin@sentinel.test"}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
