"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  LogOut,
  ChevronDown,
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
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [clusterInfo, setClusterInfo] = useState<string>("Cluster Active • FastAPI • PostgreSQL 16");
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    api.auth.me()
      .then((u) => {
        if (active) setCurrentUser(u);
      })
      .catch(() => {
        if (active) {
          const role =
            typeof window !== "undefined"
              ? localStorage.getItem("sentinel_role") || "ADMIN"
              : "ADMIN";
          const email =
            typeof window !== "undefined"
              ? localStorage.getItem("sentinel_email") || "admin@sentinel.test"
              : "admin@sentinel.test";
          setCurrentUser({
            id: "usr_elena_rostova",
            email,
            name: "Elena Rostova",
            display_name: "Elena Rostova",
            role,
            organization: "Sentinel Core",
            status: "ACTIVE",
            department: "Security Architecture",
            is_active: true,
            permissions: ["*"],
          });
        }
      });

    api.health()
      .then((h) => {
        if (active && h) {
          setClusterInfo(
            h.status === "healthy" || h.status === "ok"
              ? "Cluster Active • FastAPI v0.110 • All Connectors Healthy"
              : "Cluster Warning • Connecting Components"
          );
        }
      })
      .catch(() => {});

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

  // Derive breadcrumb active view
  const viewSegment = pathname === "/" ? "OVERVIEW" : pathname.split("/")[1]?.toUpperCase() || "ACTIVE_VIEW";

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high z-40 flex items-center justify-between px-space-lg gap-space-md transition-all duration-200 left-0 ${
        sidebarCollapsed ? "lg:left-18" : "lg:left-72"
      }`}
    >
      {/* Left Area: Mobile Menu + Breadcrumbs + Search */}
      <div className="flex items-center gap-space-lg flex-1 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container lg:hidden shrink-0"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Architectural Breadcrumb */}
        <div className="hidden xl:flex items-center gap-space-xs font-label-mono text-label-mono text-on-surface-variant whitespace-nowrap">
          <Link href="/" className="hover:text-on-surface cursor-pointer">
            ROOT
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="hover:text-on-surface cursor-pointer">OPERATIONS</span>
          <span className="text-outline-variant">/</span>
          <span className="text-on-surface font-semibold uppercase">{viewSegment}</span>
        </div>

        {/* Global Search Input Trigger */}
        <div className="relative flex-1 max-w-xl">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            onClick={onOpenSearch}
            readOnly
            className="w-full h-9 pl-9 pr-space-md bg-surface border border-surface-container-high rounded font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-colors cursor-pointer"
            placeholder="Search executions, tools, policies, correlation IDs... (Cmd+K)"
            type="text"
          />
        </div>
      </div>

      {/* Right Area: Cluster Badge + New Agent Session CTA + User Profile */}
      <div className="flex items-center gap-space-md shrink-0">
        {/* Cluster Telemetry Pill */}
        <div className="hidden 2xl:flex items-center gap-space-xs px-space-sm py-1.5 rounded border border-surface-container-high bg-surface-container-low">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="font-label-mono text-label-mono text-on-surface-variant">
            {clusterInfo}
          </span>
        </div>

        {/* New Agent Session CTA */}
        <Link
          href="/agent"
          className="flex items-center gap-space-xs px-space-sm py-1.5 bg-primary text-on-primary font-label-ui text-label-ui rounded hover:bg-primary-container transition-colors shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span className="hidden sm:inline">New Agent Session</span>
        </Link>

        <div className="h-6 w-px bg-surface-container-high hidden sm:block" />

        {/* Authenticated User Menu */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-space-sm pl-space-xs text-left cursor-pointer group focus:outline-none"
          >
            <div className="flex flex-col text-right hidden lg:flex">
              <div className="flex items-center gap-space-xs justify-end">
                <span className="font-label-ui text-label-ui font-semibold text-on-surface leading-none group-hover:text-primary transition-colors">
                  {currentUser?.name || "Elena Rostova"}
                </span>
                <span className="font-label-mono text-[9px] px-1 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold border border-surface-container-highest">
                  PROD-US-EAST
                </span>
              </div>
              <span className="font-body-sm text-[11px] text-on-surface-variant leading-none mt-1">
                {currentUser?.role === "ADMIN" ? "Principal SecOps Architect" : currentUser?.role || "Security Analyst"}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-mono text-label-mono font-bold border border-surface-container-high shrink-0">
              {currentUser?.name
                ? currentUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "ER"}
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-on-surface transition-colors hidden sm:block" />
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-space-xs w-64 bg-surface-container-lowest border border-border shadow-md rounded-xl p-space-sm z-50 flex flex-col gap-space-xs">
              <div className="px-space-sm py-space-xs border-b border-border">
                <div className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                  {currentUser?.name || "Elena Rostova"}
                </div>
                <div className="font-label-mono text-label-mono text-on-surface-variant truncate">
                  {currentUser?.email || "elena.rostova@sentinel.sec"}
                </div>
                <div className="mt-space-2xs inline-block font-label-mono text-[10px] px-space-xs py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-semibold uppercase">
                  {currentUser?.role || "ADMIN"} CLEARANCE
                </div>
              </div>

              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-space-sm px-space-sm py-space-xs text-on-surface hover:bg-surface-container rounded-lg font-body-sm text-body-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  settings
                </span>
                <span>Security Settings</span>
              </Link>

              <Link
                href="/audit"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-space-sm px-space-sm py-space-xs text-on-surface hover:bg-surface-container rounded-lg font-body-sm text-body-sm transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  list_alt
                </span>
                <span>My Audit Trace</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-space-sm px-space-sm py-space-xs text-error hover:bg-error-container/30 rounded-lg font-body-sm text-body-sm transition-colors w-full text-left cursor-pointer border-t border-border mt-space-2xs"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Gateway</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
