"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Terminal,
  Activity,
  Bot,
  ShieldCheck,
  Sliders,
  ShieldAlert,
  Layers,
  Server,
  Wrench,
  ScrollText,
  CheckCircle2,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Radio,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
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
  const [systemUptime] = useState<string>("99.98%");

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
            id: "usr_aris_thorne",
            email,
            name: "Dr. Aris Thorne",
            display_name: "Dr. Aris Thorne",
            role,
            organization: "Sentinel Core",
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
      group: "1. Control",
      items: [
        { label: "Command Center", href: "/", icon: Terminal },
        {
          label: "Live Activity",
          href: "/audit",
          icon: Radio,
          badge: (
            <span className="px-1.5 py-0.5 rounded-xs bg-[var(--secondary-container)]/10 border border-[var(--secondary-container)]/30 text-[var(--secondary-container)] font-label-caps text-[9px] tracking-wider">
              LIVE STREAM
            </span>
          ),
        },
        { label: "Agent Runs", href: "/agent", icon: Bot },
      ],
    },
    {
      group: "2. Govern",
      items: [
        {
          label: "Approvals",
          href: "/approvals",
          icon: ShieldCheck,
          badge: pendingApprovalsCount > 0 ? (
            <span className="px-1.5 py-0.5 rounded-xs bg-[var(--error-container)]/40 border border-[var(--error)]/50 text-[var(--error)] font-label-caps text-[9px] tracking-wider">
              {pendingApprovalsCount} PENDING
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-xs bg-[var(--surface-container-high)] text-[var(--text-muted)] font-label-caps text-[9px]">
              0 PENDING
            </span>
          ),
        },
        { label: "Policies", href: "/policies", icon: Sliders },
        { label: "Risk", href: "/risk", icon: ShieldAlert },
      ],
    },
    {
      group: "3. Connect",
      items: [
        { label: "Integrations", href: "/integrations", icon: Layers },
        { label: "MCP Servers", href: "/mcp-servers", icon: Server },
        { label: "Tools", href: "/tools", icon: Wrench },
      ],
    },
    {
      group: "4. Investigate",
      items: [
        { label: "Audit", href: "/audit", icon: ScrollText },
        { label: "Security Evaluation", href: "/evaluation", icon: CheckCircle2 },
      ],
    },
    {
      group: "5. System",
      items: [
        {
          label: "Health",
          href: "/health",
          icon: Activity,
          badge: (
            <span className="font-code-sm text-code-sm text-[var(--primary-container)]">
              {systemUptime}
            </span>
          ),
        },
        { label: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[var(--surface-container-lowest)] border-r border-[var(--border)] z-50 flex flex-col justify-between select-none transition-all duration-150 ${
        isCollapsed ? "w-16" : "w-64"
      } ${
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="h-14 px-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-container-low)]/50 flex-shrink-0">
          <Link href="/" onClick={onCloseMobile} className="flex items-center gap-2 overflow-hidden group">
            <div className="relative flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-[var(--primary-container)]" />
              <div className="absolute w-3.5 h-3.5 rounded-full bg-[var(--primary-container)]/20 animate-ping" />
            </div>
            {!isCollapsed && (
              <span className="font-label-caps text-[11px] tracking-widest text-[var(--primary)] font-bold uppercase truncate">
                MCP SENTINEL
              </span>
            )}
          </Link>
          <div className="flex items-center gap-1">
            {!isCollapsed && (
              <span className="px-1.5 py-0.5 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border-interactive)] font-code-sm text-[10px] text-[var(--secondary-container)]">
                v3.0-NOC
              </span>
            )}
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] lg:hidden"
              title="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container-high)] transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="px-1.5 py-2 space-y-3">
          {NAVIGATION.map((grp) => (
            <div key={grp.group} className="space-y-0.5">
              {!isCollapsed && (
                <div className="px-2 py-1 font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
                  {grp.group}
                </div>
              )}
              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname === "/overview"
                    : pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={`${grp.group}-${item.href}`}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-xs transition-colors duration-150 text-xs ${
                      isActive
                        ? "bg-[var(--surface-container-high)] text-[var(--primary)] border-l-2 border-[var(--primary-container)] font-semibold pl-[7px]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container-low)]"
                    } ${isCollapsed ? "justify-center px-0" : ""}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[var(--primary-container)]" : "text-[var(--text-muted)]"}`} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Sidebar Footer Deck */}
      <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-container-lowest)] space-y-1.5 flex-shrink-0">
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between px-2 py-1 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] font-code-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)]" />
                <span className="text-[var(--text-primary)] text-[10px] uppercase font-bold tracking-wider">SYSTEM ONLINE</span>
              </div>
              <span className="text-[var(--text-muted)] text-[10px]">0 FAILURES</span>
            </div>

            <div className="flex items-center justify-between px-2 py-1 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)]">
              <span className="font-label-caps text-[9px] text-[var(--text-muted)]">ENV</span>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border-interactive)] font-code-sm text-[10px] text-[var(--secondary)]">
                <span className="font-bold tracking-wider uppercase">DEVELOPMENT</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center font-bold text-xs flex-shrink-0">
                  <User className="w-4 h-4 text-[var(--on-primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-body-sm text-[12px] font-semibold text-[var(--text-primary)] truncate">
                    {currentUser?.name || "Dr. Aris Thorne"}
                  </div>
                  <div className="font-code-sm text-[9px] text-[var(--text-muted)] truncate">
                    {currentUser?.role || "CSO"} • {currentUser?.organization || "Sentinel Core"}
                  </div>
                </div>
              </div>
              <Link href="/settings" className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <Settings className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <span className="w-2 h-2 rounded-full bg-[var(--primary-container)]" title="System Online" />
            <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center text-[10px] font-bold">
              <User className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
