"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  LayoutDashboard,
  ShieldAlert,
  FileText,
  Blocks,
  ShieldCheck,
  Wrench,
  Settings,
} from "lucide-react";
import { api } from "@/lib/api";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [daemonHealthy, setDaemonHealthy] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    // Load real pending approvals count from database
    api.approvals
      .pending()
      .then((items) => {
        if (active && Array.isArray(items)) {
          setPendingCount(items.length);
        }
      })
      .catch(() => {});

    // Check real backend health
    api.health()
      .then((h) => {
        if (active && h) {
          setDaemonHealthy(h.status === "healthy" || h.status === "ok");
        }
      })
      .catch(() => {
        if (active) setDaemonHealthy(false);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  const navSections: NavSection[] = [
    {
      title: "OPERATIONS",
      items: [
        {
          label: "Overview",
          href: "/",
          icon: LayoutDashboard,
        },
        {
          label: "Approvals",
          href: "/approvals",
          icon: ShieldAlert,
          badge:
            pendingCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-mono font-bold border border-amber-500/30">
                {pendingCount}
              </span>
            ) : null,
        },
        {
          label: "Audit Ledger",
          href: "/audit",
          icon: FileText,
        },
      ],
    },
    {
      title: "GOVERNANCE & DATA",
      items: [
        {
          label: "Integrations",
          href: "/integrations",
          icon: Blocks,
        },
        {
          label: "Policies",
          href: "/policies",
          icon: ShieldCheck,
        },
        {
          label: "MCP Tools",
          href: "/tools",
          icon: Wrench,
        },
      ],
    },
    {
      title: "CONFIGURATION",
      items: [
        {
          label: "Settings",
          href: "/settings",
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[var(--surface-container-lowest)] border-r border-[var(--border)] z-50 flex flex-col justify-between select-none transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-64"
      } ${
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Top Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-container-lowest)]">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 overflow-hidden group min-w-0"
          >
            <div className="w-7 h-7 rounded bg-[var(--primary)] flex items-center justify-center text-[var(--on-primary)] shrink-0 shadow-sm font-bold">
              <Shield className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-[var(--on-surface)] tracking-tight font-bold truncate leading-none">
                  SENTINELCORE
                </span>
                <span className="font-mono text-[9px] text-[var(--on-surface-variant)] uppercase tracking-wider mt-1 truncate">
                  AI Security Platform
                </span>
              </div>
            )}
          </Link>

          <div className="flex items-center gap-1">
            {isMobileOpen && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container)] lg:hidden"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1 rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container)] transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <nav className="space-y-4">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-2.5 py-1 font-mono text-[9px] text-[var(--on-surface-variant)] uppercase tracking-wider font-semibold">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href || pathname?.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      title={isCollapsed ? item.label : undefined}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                        isActive
                          ? "bg-[var(--surface-container-high)] text-[var(--primary)] font-semibold border-l-2 border-[var(--primary)]"
                          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)]"}`} />
                        {!isCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </div>
                      {!isCollapsed && item.badge}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Footer Daemon Status */}
      <div className="p-2 border-t border-[var(--border)] bg-[var(--surface-container-low)]">
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  daemonHealthy ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
              <span className="font-mono text-[10px] text-[var(--on-surface-variant)] uppercase font-semibold">
                FASTMCP DAEMON
              </span>
            </div>
            <span className="font-mono text-[9px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
              ACTIVE
            </span>
          </div>
        ) : (
          <div className="flex justify-center py-1" title="FastMCP Daemon Online">
            <span
              className={`w-2 h-2 rounded-full ${
                daemonHealthy ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
