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
  Layers,
  Server,
  Activity,
  AlertTriangle,
  HelpCircle,
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
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

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
            organization: "Sentinel Enterprise Core",
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
      group: "Overview",
      items: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
      ],
    },
    {
      group: "Operations",
      items: [
        { label: "Agent Runs", href: "/agent-runs", icon: Bot },
        { label: "Approvals", href: "/approvals", icon: ShieldAlert, badgeCount: pendingApprovalsCount },
        { label: "Audit Logs", href: "/audit", icon: ScrollText },
      ],
    },
    {
      group: "Security",
      items: [
        { label: "Policies", href: "/policies", icon: Sliders },
        { label: "Risk Rules", href: "/risk", icon: AlertTriangle },
        { label: "Security Evaluation", href: "/evaluation", icon: CheckCircle },
      ],
    },
    {
      group: "Integrations",
      items: [
        { label: "Connected Software", href: "/integrations", icon: Layers },
        { label: "MCP Servers", href: "/mcp-servers", icon: Server },
        { label: "Tool Registry", href: "/tools", icon: Wrench },
      ],
    },
    {
      group: "System",
      items: [
        { label: "System Health", href: "/health", icon: Activity },
        { label: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <>
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
            <div className="w-7 h-7 rounded-xs bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
              <Shield className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold tracking-wider text-[var(--text-primary)] flex items-center">
                  MCP<span className="text-[var(--accent)] font-semibold ml-0.5">SENTINEL</span>
                </span>
                <span className="text-[9px] text-[var(--text-muted)] font-mono-tnum tracking-wider">
                  SECURITY GATEWAY
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

        {/* Organization & Environment Indicator */}
        {!isCollapsed && (
          <div className="px-3.5 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)]/50 flex items-center justify-between">
            <div className="truncate pr-2">
              <span className="text-[9px] uppercase font-semibold tracking-wider text-[var(--text-muted)] block">Organization</span>
              <span className="text-xs font-medium text-[var(--text-primary)] truncate block">
                {currentUser?.organization || "Sentinel Enterprise"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs bg-[var(--risk-low-bg)] border border-[var(--risk-low-border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-low)] animate-pulse" />
              <span className="text-[9px] font-mono-tnum font-bold text-[var(--risk-low)]">PROD</span>
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3.5">
          {NAVIGATION.map((grp) => (
            <div key={grp.group}>
              {!isCollapsed && grp.group !== "Overview" && (
                <h5 className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {grp.group}
                </h5>
              )}
              <ul className="space-y-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/"
                      ? pathname === "/" || pathname === "/overview"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xs text-xs transition-colors ${
                          isActive
                            ? "bg-[var(--bg-card)] text-[var(--accent)] font-semibold shadow-2xs border-l-2 border-[var(--accent)]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                        } ${isCollapsed ? "justify-center px-0" : ""}`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isCollapsed && (item.badgeCount ?? 0) > 0 && (
                          <span className="px-1.5 py-0.2 rounded-xs bg-[var(--risk-high-bg)] border border-[var(--risk-high-border)] text-[var(--risk-high)] font-mono-tnum text-[10px] font-bold">
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

        {/* Footer / User Profile & Help summary */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-primary)]/40 space-y-2">
          {!isCollapsed && (
            <button
              onClick={() => setShowHelpModal(true)}
              className="w-full flex items-center justify-between px-2 py-1 rounded-xs text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[var(--accent-2)]" />
                <span>Security Pipeline Architecture</span>
              </div>
              <span className="font-mono-tnum text-[9px] text-[var(--text-muted)]">v1.0</span>
            </button>
          )}

          <div className={`flex items-center gap-2.5 ${isCollapsed ? "justify-center" : ""}`}>
            <div className="w-6 h-6 rounded-xs bg-[var(--border)] text-[var(--text-primary)] flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : "A"}
            </div>
            {!isCollapsed && (
              <div className="truncate flex-1">
                <p className="text-xs font-medium text-[var(--text-primary)] truncate">{currentUser?.name || "Security Operator"}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] truncate font-mono-tnum">{currentUser?.email || "admin@sentinel.test"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Help Modal: Architectural Pipeline Explainer */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xs bg-[var(--bg-card)] border border-[var(--border)] shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  MCP Sentinel — Security Pipeline
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Every action an AI agent attempts across your connected software is visible, evaluated and controlled through a deterministic multi-stage invariant pipeline:
            </p>

            <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2 font-mono-tnum text-xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-xs bg-[var(--accent)] text-white text-[10px] flex items-center justify-center font-bold">1</span>
                <span className="font-bold text-[var(--text-primary)]">AGENT</span>
                <span className="text-[var(--text-muted)]">Autonomous model issues tool execution candidate.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-xs bg-[var(--border)] text-[var(--text-primary)] text-[10px] flex items-center justify-center font-bold">2</span>
                <span className="font-bold text-[var(--text-primary)]">MCP GATEWAY</span>
                <span className="text-[var(--text-muted)]">Standardized protocol schema validation & typing.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-xs bg-[var(--border)] text-[var(--text-primary)] text-[10px] flex items-center justify-center font-bold">3</span>
                <span className="font-bold text-[var(--text-primary)]">POLICY ENGINE</span>
                <span className="text-[var(--text-muted)]">Deterministic rules evaluated (Precedence: DENY &gt; MFA &gt; APPROVAL &gt; ALLOW).</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-xs bg-[var(--border)] text-[var(--text-primary)] text-[10px] flex items-center justify-center font-bold">4</span>
                <span className="font-bold text-[var(--text-primary)]">RISK ENGINE</span>
                <span className="text-[var(--text-muted)]">6-factor scoring: Low, Medium, High, or Critical.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-xs bg-[var(--border)] text-[var(--text-primary)] text-[10px] flex items-center justify-center font-bold">5</span>
                <span className="font-bold text-[var(--text-primary)]">APPROVAL</span>
                <span className="text-[var(--text-muted)]">High-risk actions require dual-custody cryptographic sign-off.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-xs bg-[var(--risk-low)] text-white text-[10px] flex items-center justify-center font-bold">6</span>
                <span className="font-bold text-[var(--text-primary)]">ACTION & AUDIT</span>
                <span className="text-[var(--text-muted)]">Signed dispatch to external software + immutable log entry.</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-3.5 py-1.5 rounded-xs text-xs font-semibold bg-[var(--accent)] text-white hover:opacity-95"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
