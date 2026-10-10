"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
} from "lucide-react";
import { api } from "@/lib/api";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: string;
    badge?: React.ReactNode;
  }[];
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

    // Load real pending approvals count from PostgreSQL
    api.approvals.pending()
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
      title: "CORE",
      items: [
        {
          label: "Overview",
          href: "/",
          icon: "grid_view",
        },
        {
          label: "AI Command Center",
          href: "/agent",
          icon: "terminal",
        },
        {
          label: "Agent Runs",
          href: "/agent-runs",
          icon: "fast_forward",
        },
        {
          label: "Approvals",
          href: "/approvals",
          icon: "verified_user",
          badge:
            pendingCount > 0 ? (
              <span className="px-space-xs py-0.5 rounded-xs bg-primary-container text-on-primary font-label-mono text-label-mono font-bold">
                {pendingCount}
              </span>
            ) : null,
        },
      ],
    },
    {
      title: "GOVERNANCE & TELEMETRY",
      items: [
        {
          label: "Audit Logs",
          href: "/audit",
          icon: "list_alt",
        },
        {
          label: "Security Evaluation",
          href: "/evaluation",
          icon: "shield_with_heart",
        },
        {
          label: "System Health",
          href: "/health",
          icon: "vital_signs",
        },
        {
          label: "Risk Analysis",
          href: "/risk",
          icon: "warning",
        },
      ],
    },
    {
      title: "INFRASTRUCTURE",
      items: [
        {
          label: "Integrations",
          href: "/integrations",
          icon: "hub",
        },
        {
          label: "MCP Servers",
          href: "/mcp-servers",
          icon: "dns",
        },
        {
          label: "Policies",
          href: "/policies",
          icon: "policy",
        },
        {
          label: "Tool Registry",
          href: "/tools",
          icon: "build_circle",
        },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        {
          label: "Settings",
          href: "/settings",
          icon: "settings",
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-surface-container-lowest border-r border-surface-container-high z-50 flex flex-col justify-between select-none transition-all duration-200 ${
        isCollapsed ? "w-18" : "w-72"
      } ${
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Top Header */}
        <div className="h-16 px-space-lg flex items-center justify-between border-b border-surface-container-high bg-surface-container-lowest">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-space-sm overflow-hidden group min-w-0"
          >
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-xs">
              <Shield className="w-4.5 h-4.5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold truncate leading-none">
                  MCP SENTINEL
                </span>
                <span className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider mt-space-2xs truncate">
                  AI Security &amp; Governance
                </span>
              </div>
            )}
          </Link>

          <div className="flex items-center gap-1">
            {/* Mobile Close Button */}
            {isMobileOpen && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container lg:hidden"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-space-sm py-space-md space-y-space-lg">
          <nav className="space-y-space-lg">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-space-2xs">
                {!isCollapsed && (
                  <div className="px-space-sm py-space-xs font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => {
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
                      className={`flex items-center justify-between px-space-sm py-space-xs rounded transition-colors ${
                        isActive
                          ? "bg-surface-container-high text-on-surface font-semibold"
                          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-body-md text-body-md"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      <div className="flex items-center gap-space-sm min-w-0">
                        <span
                          className={`material-symbols-outlined text-[18px] shrink-0 ${
                            isActive
                              ? "text-on-surface"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {item.icon}
                        </span>
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
      <div className="p-space-sm border-t border-surface-container-high bg-surface-container-low">
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-space-xs py-space-2xs">
            <div className="flex items-center gap-space-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  daemonHealthy ? "bg-secondary animate-pulse" : "bg-error"
                }`}
              />
              <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">
                MCP DAEMON 2.4
              </span>
            </div>
            <span className="font-label-mono text-label-mono text-on-surface font-semibold bg-surface-container-highest px-space-xs py-0.5 rounded-xs">
              ARM64
            </span>
          </div>
        ) : (
          <div className="flex justify-center py-space-xs" title="MCP Daemon 2.4 Online">
            <span
              className={`w-2 h-2 rounded-full ${
                daemonHealthy ? "bg-secondary animate-pulse" : "bg-error"
              }`}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
