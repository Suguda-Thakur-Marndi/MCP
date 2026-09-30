"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Command,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sun,
  Moon,
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
      className={`h-14 border-b border-[#D1CEC7] dark:border-[#243044] bg-[#F5F4F0]/90 dark:bg-[#0F172A]/90 backdrop-blur fixed top-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4 transition-all duration-200 left-0 ${
        sidebarCollapsed ? "lg:left-16" : "lg:left-64"
      }`}
    >
      {/* Global Quick Search Button & Mobile Hamburger */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-md">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 -ml-1 rounded text-[#4A4A4A] dark:text-slate-400 hover:text-[#1E1E1E] dark:hover:text-slate-200 hover:bg-[#E2DFDA] dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-md bg-[#E2DFDA]/70 dark:bg-[#111827] border border-[#D1CEC7] dark:border-[#243044] text-xs text-[#4A4A4A] dark:text-slate-400 hover:text-[#1E1E1E] dark:hover:text-slate-200 hover:border-[#B5B2AB] dark:hover:border-slate-600 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#7A7670] dark:text-slate-500" />
            <span className="truncate">Search tools, approvals, audit logs, policies...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#D1CEC7]/60 dark:bg-slate-800 text-[10px] font-mono text-[#1E1E1E] dark:text-slate-400 border border-[#B5B2AB] dark:border-slate-700">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right controls: Theme Toggle, Health, Pending approvals, User info, Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Architectural Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md border border-[#D1CEC7] dark:border-[#243044] bg-[#E2DFDA]/70 dark:bg-[#111827] text-[#4A4A4A] dark:text-slate-300 hover:text-[#D95E00] dark:hover:text-amber-400 hover:border-[#D95E00]/40 dark:hover:border-amber-500/40 transition-all shadow-sm"
          title={theme === "architectural" ? "Switch to Architectural Midnight (Dark)" : "Switch to Architectural Intelligence (Warm Ivory)"}
          aria-label="Toggle visual theme"
        >
          {theme === "architectural" ? (
            <Moon className="w-4 h-4 text-[#D95E00]" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>

        {/* System Health */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#E2DFDA]/80 dark:bg-[#111827] border border-[#D1CEC7] dark:border-[#243044] text-[11px] font-mono shadow-sm"
          title={isHealthy ? "FastMCP Gateway & Security Perimeter Online" : "Disconnected / Backend Offline"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy === true
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : isHealthy === false
                ? "bg-rose-500"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[#1E1E1E] dark:text-slate-300 font-semibold hidden sm:inline">
            {isHealthy === true ? "SYS ONLINE" : isHealthy === false ? "CONN ERR" : "PROBING"}
          </span>
        </div>

        {/* Pending Approvals quick badge */}
        <Link
          href="/approvals"
          className="relative p-2 rounded-md text-[#4A4A4A] dark:text-slate-400 hover:text-[#1E1E1E] dark:hover:text-slate-200 hover:bg-[#E2DFDA] dark:hover:bg-slate-800 transition-colors"
          title="Review Pending Approvals"
        >
          <ShieldAlert className="w-4 h-4 text-[#D95E00] dark:text-amber-400" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#D95E00] text-white font-mono text-[10px] font-bold flex items-center justify-center animate-pulse shadow-sm">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </Link>

        {/* User Identity & Role */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#D1CEC7] dark:border-[#243044]">
          <span className="text-xs text-[#1E1E1E] dark:text-slate-300 font-medium">{currentUser?.name || "Operator"}</span>
          {currentUser?.role && <RoleBadge role={currentUser.role} />}
        </div>

        {/* Settings / Switch role button */}
        <Link
          href="/settings"
          className="p-1.5 rounded-md text-[#4A4A4A] dark:text-slate-400 hover:text-[#D95E00] dark:hover:text-sky-400 hover:bg-[#E2DFDA] dark:hover:bg-slate-800 transition-colors"
          title="Security Settings & Role Switcher"
        >
          <ShieldCheck className="w-4 h-4" />
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-md text-[#4A4A4A] dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/30 transition-colors"
          title="Reset session / Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
