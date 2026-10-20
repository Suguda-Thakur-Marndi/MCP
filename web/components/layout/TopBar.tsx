"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  LogOut,
  ChevronDown,
  Search,
  Database,
  User,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";

export function TopBar({
  onOpenSearch,
  sidebarCollapsed,
  onToggleMobileMenu,
}: {
  onOpenSearch: () => void;
  sidebarCollapsed: boolean;
  onToggleMobileMenu?: () => void;
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [clusterReady, setClusterReady] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<string>("Supabase PostgreSQL Connected");
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    api.auth
      .me()
      .then((u) => {
        if (active) setCurrentUser(u);
      })
      .catch(() => {
        if (active) {
          setCurrentUser(null);
        }
      });

    // Check actual readiness and database status
    api
      .healthReady()
      .then((res) => {
        if (active && res) {
          setClusterReady(res.status === "ready" || res.status === "healthy");
          const dbDep = res.dependencies?.database || res.database || "connected";
          setDbStatus(
            dbDep === "connected"
              ? "Supabase PostgreSQL • Online"
              : "Database Degraded"
          );
        }
      })
      .catch(() => {
        if (active) {
          setClusterReady(false);
          setDbStatus("Backend Unreachable");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("sentinel_token");
      localStorage.removeItem("sentinel_role");
      localStorage.removeItem("sentinel_email");
    }
    router.push("/auth");
  };

  return (
    <header
      className={`fixed top-0 right-0 h-14 bg-[var(--surface-container-lowest)]/95 backdrop-blur-sm border-b border-[var(--border)] z-30 flex items-center justify-between px-4 transition-all duration-200 left-0 ${
        sidebarCollapsed ? "lg:left-16" : "lg:left-64"
      }`}
    >
      {/* Left: Mobile Toggle & Cluster Telemetry Status */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--surface-container)] border border-[var(--border)] text-[var(--on-surface-variant)]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                clusterReady ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="hidden sm:inline font-semibold text-[var(--on-surface)]">
              FASTAPI READY
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--surface-container)] border border-[var(--border)] text-[var(--on-surface-variant)]">
            <Database className="w-3 h-3 text-emerald-400" />
            <span>{dbStatus}</span>
          </div>
        </div>
      </div>

      {/* Right: Search trigger & Operator profile */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] border border-[var(--border)] text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono text-[11px]">Command Palette</span>
          <kbd className="hidden sm:inline font-mono text-[9px] px-1 py-0.5 rounded bg-[var(--surface-container-highest)] border border-[var(--border)] text-[var(--on-surface-variant)]">
            ⌘K
          </kbd>
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--surface-container)] transition-colors text-xs text-left cursor-pointer"
          >
            <div className="w-6 h-6 rounded bg-[var(--surface-container-highest)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] font-bold text-[10px]">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-[var(--on-surface)] leading-none truncate max-w-[120px]">
                {currentUser?.display_name || currentUser?.name || "Security Operator"}
              </span>
              <span className="font-mono text-[9px] text-[var(--on-surface-variant)] uppercase tracking-wider mt-0.5">
                {currentUser?.role || "ADMIN"}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-[var(--on-surface-variant)]" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-1 w-56 rounded-md bg-[var(--surface-container-low)] border border-[var(--border)] shadow-xl py-1 z-50 text-xs font-mono">
              <div className="px-3 py-2 border-b border-[var(--border)]">
                <p className="font-bold text-[var(--on-surface)] truncate">
                  {currentUser?.name || "Security Operator"}
                </p>
                <p className="text-[10px] text-[var(--on-surface-variant)] truncate mt-0.5">
                  {currentUser?.email || "operator@sentinelcore.local"}
                </p>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  ROLE: {currentUser?.role || "ADMIN"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Terminate Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
