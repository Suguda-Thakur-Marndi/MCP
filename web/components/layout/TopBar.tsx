"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  LogOut,
  ChevronDown,
  Shield,
  Check,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  category: "CRITICAL" | "HIGH" | "INFO";
  time: string;
  actionHref: string;
  actionLabel: string;
  read: boolean;
}

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
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif-1",
      title: "Dual-Custody Approval Required",
      description: "Autonomous Agent requested pg_mutate_table on prod_customers_db.",
      category: "CRITICAL",
      time: "2m ago",
      actionHref: "/approvals",
      actionLabel: "Review Gate",
      read: false,
    },
    {
      id: "notif-2",
      title: "Zero-Trust Invariant Blocked",
      description: "Attempted SQL injection syntax neutralized before query execution.",
      category: "HIGH",
      time: "14m ago",
      actionHref: "/audit",
      actionLabel: "View Forensic Trace",
      read: false,
    },
    {
      id: "notif-3",
      title: "PostgreSQL Connector Healthy",
      description: "Cluster connection pool operating with 12ms average latency.",
      category: "INFO",
      time: "1h ago",
      actionHref: "/health",
      actionLabel: "System Status",
      read: true,
    },
  ]);

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

    return () => {
      active = false;
    };
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
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
      // ignore
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sentinel_token");
        localStorage.removeItem("sentinel_role");
        localStorage.removeItem("sentinel_email");
      }
      router.push("/auth");
    }
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-surface-container-lowest border-b border-border shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-space-md lg:px-space-xl transition-all duration-200 ${
        sidebarCollapsed ? "left-0 lg:left-18" : "left-0 lg:left-72"
      }`}
    >
      {/* Left Area: Mobile Trigger & Precision Pipeline Flow Crumb */}
      <div className="flex items-center gap-space-md lg:gap-space-xl overflow-hidden">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container lg:hidden"
            aria-label="Open mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Precision Stepper Pipeline Crumb */}
        <div className="hidden xl:flex items-center gap-space-xs font-code-sm text-code-sm text-on-surface-variant bg-surface-container-low px-space-sm py-space-xs rounded-lg border border-border">
          <span className="text-on-surface font-semibold">Client</span>
          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
          <span className="text-secondary font-semibold">MCP Gateway</span>
          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
          <span>Policy Engine</span>
          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
          <span>Risk Eval</span>
          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
          <span className="text-tertiary font-semibold">Human Gate</span>
          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
          <span>DB Exec</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-space-sm sm:gap-space-md lg:gap-space-lg">
        {/* Quick Search Button */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-low border border-border rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          <span className="font-label-md text-label-md hidden sm:inline">
            Quick Search / Exec
          </span>
          <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-medium">
            ⌘K
          </span>
        </button>

        {/* Enforce & Validate Badge */}
        <div className="hidden md:flex items-center gap-space-xs px-space-sm py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed font-code-sm text-code-sm font-semibold border border-secondary/20">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          Enforce &amp; Validate
        </div>

        {/* Notifications Button & Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex items-center justify-center p-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            aria-label="Open notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-tertiary"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface-container-lowest border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-space-md bg-surface-container-low border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    Security Alerts
                  </span>
                  {unreadCount > 0 && (
                    <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="font-code-sm text-code-sm text-secondary hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-space-md hover:bg-surface-container-low transition-colors ${
                      item.read ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-space-xs mb-1">
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        {item.title}
                      </span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant shrink-0">
                        {item.time}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-xs">
                      {item.description}
                    </p>
                    <Link
                      href={item.actionHref}
                      onClick={() => setShowNotifications(false)}
                      className="font-label-md text-label-md text-primary font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      {item.actionLabel} →
                    </Link>
                  </div>
                ))}
              </div>

              <div className="p-space-xs bg-surface-container-low border-t border-border text-center">
                <Link
                  href="/audit"
                  onClick={() => setShowNotifications(false)}
                  className="font-code-sm text-code-sm text-secondary hover:underline block py-1"
                >
                  View complete forensic telemetry →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar & Menu */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-space-xs cursor-pointer group"
            aria-label="User profile menu"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-xs">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-on-surface transition-colors hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-surface-container-lowest border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-space-md bg-surface-container-low border-b border-border">
                <div className="font-headline-sm text-headline-sm text-on-surface truncate">
                  {currentUser?.name || "Dr. Aris Thorne"}
                </div>
                <div className="font-code-sm text-code-sm text-on-surface-variant truncate">
                  {currentUser?.email || "admin@sentinel.test"}
                </div>
                <div className="mt-space-xs flex items-center gap-space-xs">
                  <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed font-semibold uppercase">
                    {currentUser?.role || "ADMIN"}
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    {currentUser?.organization || "Sentinel SOC"}
                  </span>
                </div>
              </div>

              <div className="p-space-xs flex flex-col">
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="px-space-md py-space-sm rounded-lg text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md flex items-center gap-space-xs"
                >
                  <Shield className="w-4 h-4 text-secondary" />
                  Security Settings
                </Link>
                <Link
                  href="/health"
                  onClick={() => setShowUserMenu(false)}
                  className="px-space-md py-space-sm rounded-lg text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md flex items-center gap-space-xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-tertiary">
                    monitor_heart
                  </span>
                  Gateway Connectivity
                </Link>
              </div>

              <div className="p-space-xs bg-surface-container-low border-t border-border">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-space-md py-space-sm rounded-lg text-error hover:bg-error-container hover:text-on-error-container transition-colors font-label-md text-label-md flex items-center gap-space-xs text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out of Console
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
