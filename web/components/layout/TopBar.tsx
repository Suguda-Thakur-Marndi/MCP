"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Command,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  Sun,
  Moon,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";
import { RoleBadge } from "../ui/Badges";
import { useTheme } from "./ThemeProvider";

export function TopBar({
  onOpenSearch,
  sidebarCollapsed,
  onToggleMobileMenu,
}: {
  onOpenSearch: () => void;
  sidebarCollapsed: boolean;
  onToggleMobileMenu?: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let active = true;

    // Health probe
    api.health()
      .then((res) => {
        if (active) setIsHealthy(res.status === "ok" || res.status === "healthy");
      })
      .catch(() => {
        if (active) setIsHealthy(false);
      });

    // Current user
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

    // Pending approvals count
    api.approvals.pending()
      .then((res) => {
        if (active) setPendingCount(res.length);
      })
      .catch(() => {
        if (active) setPendingCount(0);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sentinel_token");
        window.location.href = "/";
      }
    }
  };

  return (
    <header
      className={`h-14 border-b border-[var(--border)] bg-[var(--bg-primary)]/90 backdrop-blur-xs fixed top-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4 transition-all duration-200 left-0 ${
        sidebarCollapsed ? "lg:left-16" : "lg:left-60"
      }`}
    >
      {/* Global Quick Search Button & Mobile Hamburger */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-md">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 -ml-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="truncate">Quick jump (tools, approvals, policies, logs)...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[10px] font-mono-tnum text-[var(--text-secondary)] border border-[var(--border)]">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right controls: Theme Toggle, Health, Pending approvals, User info, Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all shadow-xs"
          title={theme === "architectural" ? "Switch to Midnight Theme" : "Switch to Architectural Theme"}
          aria-label="Toggle visual theme"
        >
          {theme === "architectural" ? (
            <Moon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-[var(--warning)]" />
          )}
        </button>

        {/* System Health */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[11px] font-mono-tnum shadow-xs"
          title={isHealthy !== false ? "RiskWise 2.0 Policy Gateway & Invariant Perimeter Operational" : "Backend Gateway Offline"}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isHealthy === false
                ? "bg-[var(--danger)]"
                : "bg-[var(--risk-low)]"
            }`}
          />
          <span className="text-[var(--text-primary)] font-semibold text-[11px] hidden sm:inline">
            {isHealthy === false ? "GATEWAY OFFLINE" : "OPERATIONAL"}
          </span>
        </div>

        {/* Pending Approvals quick badge */}
        <Link
          href="/approvals"
          className="relative p-1.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all shadow-xs"
          title={pendingCount > 0 ? `${pendingCount} dual-custody approval requests pending` : "No pending approvals"}
          aria-label="Approvals"
        >
          <ShieldAlert className={`w-3.5 h-3.5 ${pendingCount > 0 ? "text-[var(--risk-high)]" : ""}`} />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--risk-high)] text-white text-[9px] font-mono-tnum font-bold flex items-center justify-center">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </Link>

        {/* User Identity and Role */}
        <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-[var(--border)]">
          <div className="flex flex-col text-right">
            <span className="text-xs font-medium text-[var(--text-primary)] leading-tight truncate max-w-[120px]">
              {currentUser?.name || "Security Admin"}
            </span>
          </div>
          {currentUser?.role && <RoleBadge role={currentUser.role} />}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-1.5 rounded border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-all shadow-xs"
          title="Sign out of Sentinel session"
          aria-label="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
