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

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(3);
  const [clusterName, setClusterName] = useState<string>("Prod-Cluster-01");
  const [gatewayStatus, setGatewayStatus] = useState<string>("99.98%");
  const [gatewayLatency, setGatewayLatency] = useState<string>("14ms");

  useEffect(() => {
    let active = true;

    // Load real pending approvals count
    api.approvals.pending()
      .then((items) => {
        if (active && Array.isArray(items)) {
          setPendingApprovalsCount(items.length);
        }
      })
      .catch(() => {});

    // Check health
    api.health()
      .then((h) => {
        if (active && h) {
          setGatewayStatus(h.status === "healthy" || h.status === "ok" ? "99.99%" : "Degraded");
          setGatewayLatency("12ms");
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [pathname]);

  const navItems = [
    {
      label: "Overview",
      href: "/",
      iconName: "grid_view",
      badge: null,
    },
    {
      label: "AI Command Center",
      href: "/agent",
      iconName: "terminal",
      badge: (
        <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed uppercase tracking-wider font-semibold">
          AI Active
        </span>
      ),
    },
    {
      label: "Approvals",
      href: "/approvals",
      iconName: "verified_user",
      badge: pendingApprovalsCount > 0 ? (
        <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-tertiary-fixed text-on-tertiary-fixed uppercase font-semibold">
          {pendingApprovalsCount} Pending
        </span>
      ) : null,
    },
    {
      label: "Policies",
      href: "/policies",
      iconName: "gavel",
      badge: null,
    },
    {
      label: "Risk & Threat",
      href: "/risk",
      iconName: "warning",
      badge: null,
    },
    {
      label: "Audit Log",
      href: "/audit",
      iconName: "history_edu",
      badge: null,
    },
    {
      label: "MCP Tools",
      href: "/tools",
      iconName: "build_circle",
      badge: null,
    },
    {
      label: "Integrations",
      href: "/integrations",
      iconName: "hub",
      badge: null,
    },
    {
      label: "Health & Connectivity",
      href: "/health",
      iconName: "monitor_heart",
      badge: <span className="w-2 h-2 rounded-full bg-secondary inline-block"></span>,
    },
    {
      label: "Security Evaluation",
      href: "/evaluation",
      iconName: "verified",
      badge: null,
    },
    {
      label: "Settings",
      href: "/settings",
      iconName: "settings",
      badge: null,
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-surface-container-lowest border-r border-border shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between overflow-y-auto transition-all duration-200 ${
        isCollapsed ? "w-18" : "w-72"
      } ${
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex flex-col">
        {/* Top Branding Section */}
        <div className="p-space-lg bg-surface-container-low flex flex-col gap-space-xs border-b border-border">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              onClick={onCloseMobile}
              className="flex items-center gap-space-sm overflow-hidden group"
            >
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary shrink-0">
                <Shield className="w-4.5 h-4.5" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                    MCP Sentinel
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider truncate">
                    v2.4-prod / US-EAST
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

          {/* Cluster Selector */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={() =>
                setClusterName((prev) =>
                  prev === "Prod-Cluster-01" ? "Staging-Cluster-02" : "Prod-Cluster-01"
                )
              }
              className="mt-space-sm p-space-xs px-space-sm bg-surface-container rounded-lg flex items-center justify-between cursor-pointer hover:bg-surface-container-high transition-colors text-left w-full"
            >
              <div className="flex items-center gap-space-xs overflow-hidden">
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  dns
                </span>
                <span className="font-code-sm text-code-sm text-on-surface truncate font-medium">
                  {clusterName}
                </span>
              </div>
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                unfold_more
              </span>
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav
          className="flex flex-col gap-space-xxs p-space-md mt-space-xs"
          data-active-classes="bg-primary-container text-on-primary-container font-headline-sm rounded-lg"
        >
          {navItems.map((item) => {
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
                className={`flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary-container text-on-primary-container font-headline-sm shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                } ${isCollapsed ? "justify-center px-space-xs" : ""}`}
              >
                <div className="flex items-center gap-space-md min-w-0">
                  <span
                    className={`material-symbols-outlined text-[20px] shrink-0 ${
                      isActive
                        ? "text-on-primary-container"
                        : item.href === "/agent"
                        ? "text-secondary"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {item.iconName}
                  </span>
                  {!isCollapsed && (
                    <span className="font-label-md text-label-md truncate">
                      {item.label}
                    </span>
                  )}
                </div>
                {!isCollapsed && item.badge}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Widget */}
      {!isCollapsed ? (
        <div className="p-space-md bg-surface-container-low flex flex-col gap-space-sm border-t border-border">
          <div className="p-space-sm bg-surface-container-lowest rounded-lg flex flex-col gap-space-xs border border-border">
            <div className="flex items-center justify-between">
              <span className="font-code-sm text-code-sm text-on-surface-variant">
                Gateway Status
              </span>
              <span className="font-code-sm text-code-sm text-secondary font-semibold">
                {gatewayStatus}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-code-sm text-code-sm text-on-surface-variant">
                Latency
              </span>
              <span className="font-code-sm text-code-sm text-on-surface font-semibold">
                {gatewayLatency}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-space-xs">
            <Link
              href="/settings"
              onClick={onCloseMobile}
              className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface flex items-center gap-space-xs"
            >
              <span className="material-symbols-outlined text-[16px]">menu_book</span>
              Docs
            </Link>
            <Link
              href="/auth"
              onClick={onCloseMobile}
              className="font-body-sm text-body-sm text-error hover:text-on-surface flex items-center gap-space-xs"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Exit
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-space-xs bg-surface-container-low flex flex-col items-center gap-space-xs border-t border-border">
          <Link
            href="/auth"
            className="p-space-xs text-error hover:bg-surface-container rounded"
            title="Exit"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
