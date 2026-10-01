"use client";

import React, { useEffect, useState, useRef } from "react";
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
  ChevronDown,
  Check,
  AlertTriangle,
  X,
  ExternalLink,
  Shield,
  Layers,
  Server,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";
import { RoleBadge } from "../ui/Badges";
import { useTheme } from "./ThemeProvider";

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
  const { theme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [currentEnv, setCurrentEnv] = useState<"Production" | "Staging" | "Development">("Production");
  const [showEnvDropdown, setShowEnvDropdown] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  const envRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif-1",
      title: "Critical Dual-Custody Approval Required",
      description: "DevOps Agent requested delete_repository on GitHub enterprise production repo.",
      category: "CRITICAL",
      time: "2m ago",
      actionHref: "/approvals",
      actionLabel: "Review in Queue",
      read: false,
    },
    {
      id: "notif-2",
      title: "High-Risk Exfiltration Attempt Blocked",
      description: "Data Analyst Agent attempted to share Q3 financial ledger outside corporate domain.",
      category: "HIGH",
      time: "8m ago",
      actionHref: "/audit",
      actionLabel: "Inspect Audit Trail",
      read: false,
    },
    {
      id: "notif-3",
      title: "MCP Server Heartbeat Verified",
      description: "FastMCP PostgreSQL daemon and 6 SaaS bridges running with <45ms latency.",
      category: "INFO",
      time: "15m ago",
      actionHref: "/mcp-servers",
      actionLabel: "Inspect Servers",
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    let active = true;

    api.health()
      .then((res) => {
        if (active) setIsHealthy(res.status === "ok" || res.status === "healthy");
      })
      .catch(() => {
        if (active) setIsHealthy(false);
      });

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

    api.approvals.pending()
      .then((res) => {
        if (active) setPendingCount(res.length);
      })
      .catch(() => {
        if (active) setPendingCount(0);
      });

    // Close popups on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (envRef.current && !envRef.current.contains(e.target as Node)) setShowEnvDropdown(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      active = false;
      document.removeEventListener("mousedown", handleClickOutside);
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
        window.location.href = "/auth";
      }
    }
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
          className="lg:hidden p-1.5 -ml-1 rounded-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors shadow-2xs"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
            <span className="truncate">Global search (agents, runs, tools, policies, approvals)...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-xs bg-[var(--bg-secondary)] text-[10px] font-mono-tnum text-[var(--text-secondary)] border border-[var(--border)]">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right controls: Environment, Status, Notifications, Theme, User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Environment Selector Dropdown */}
        <div className="relative" ref={envRef}>
          <button
            onClick={() => setShowEnvDropdown(!showEnvDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] text-xs font-mono-tnum text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all shadow-2xs"
            title="Switch execution environment"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentEnv === "Production"
                  ? "bg-[var(--risk-critical)]"
                  : currentEnv === "Staging"
                  ? "bg-[var(--risk-medium)]"
                  : "bg-[var(--risk-low)]"
              }`}
            />
            <span className="font-semibold text-[11px] uppercase tracking-wider">{currentEnv}</span>
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
          </button>

          {showEnvDropdown && (
            <div className="absolute right-0 mt-1 w-44 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] shadow-lg py-1 z-30 font-mono-tnum text-xs">
              <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] text-[10px] uppercase text-[var(--text-muted)]">
                Execution Realm
              </div>
              {(["Production", "Staging", "Development"] as const).map((env) => (
                <button
                  key={env}
                  onClick={() => {
                    setCurrentEnv(env);
                    setShowEnvDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-[var(--bg-secondary)] ${
                    currentEnv === env ? "font-bold text-[var(--accent)]" : "text-[var(--text-primary)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        env === "Production"
                          ? "bg-[var(--risk-critical)]"
                          : env === "Staging"
                          ? "bg-[var(--risk-medium)]"
                          : "bg-[var(--risk-low)]"
                      }`}
                    />
                    <span>{env}</span>
                  </div>
                  {currentEnv === env && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* System Status Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] text-[11px] font-mono-tnum shadow-2xs"
          title={isHealthy !== false ? "MCP Sentinel Security Gateway: Online (Port 8000 + 5000)" : "Backend Security Gateway Offline"}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isHealthy === false
                ? "bg-[var(--danger)]"
                : "bg-[var(--risk-low)]"
            }`}
          />
          <span className="text-[var(--text-primary)] font-semibold text-[11px] hidden md:inline">
            {isHealthy === false ? "GATEWAY OFFLINE" : "LIVE GATEWAY"}
          </span>
        </div>

        {/* Notifications Drawer Toggle */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all shadow-2xs"
            title="Notification Center"
            aria-label="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--risk-critical)] text-white text-[9px] font-mono-tnum font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-1 w-80 sm:w-96 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] shadow-xl py-2 z-30 space-y-2">
              <div className="px-3.5 py-1 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Security Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-xs bg-[var(--risk-critical-bg)] border border-[var(--risk-critical-border)] text-[var(--risk-critical)] font-mono-tnum text-[10px] font-bold">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono-tnum"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)] px-2">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xs space-y-1.5 transition-colors ${
                      item.read ? "opacity-80" : "bg-[var(--bg-secondary)]/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            item.category === "CRITICAL"
                              ? "bg-[var(--risk-critical)]"
                              : item.category === "HIGH"
                              ? "bg-[var(--risk-high)]"
                              : "bg-[var(--risk-low)]"
                          }`}
                        />
                        <h4 className="text-xs font-bold text-[var(--text-primary)] leading-tight">{item.title}</h4>
                      </div>
                      <span className="text-[10px] font-mono-tnum text-[var(--text-muted)] flex-shrink-0">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed pl-3">{item.description}</p>
                    <div className="pl-3 pt-0.5">
                      <Link
                        href={item.actionHref}
                        onClick={() => setShowNotifications(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline"
                      >
                        <span>{item.actionLabel}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all shadow-2xs"
          title={theme === "architectural" ? "Switch to Midnight Theme" : "Switch to Architectural Theme"}
          aria-label="Toggle visual theme"
        >
          {theme === "architectural" ? (
            <Moon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-[var(--warning)]" />
          )}
        </button>

        {/* User Identity Menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-1 border-l border-[var(--border)] hover:opacity-85 transition-opacity"
            title="User Profile & Settings"
          >
            <div className="w-6 h-6 rounded-xs bg-[var(--border)] text-[var(--text-primary)] flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : "A"}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-medium text-[var(--text-primary)] leading-tight truncate max-w-[120px]">
                {currentUser?.name || "Security Admin"}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)] hidden sm:inline" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-1 w-56 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] shadow-xl py-2 z-30 font-sans text-xs">
              <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] space-y-0.5">
                <p className="font-bold text-[var(--text-primary)]">{currentUser?.name || "Security Admin"}</p>
                <p className="text-[10px] font-mono-tnum text-[var(--text-muted)] truncate">{currentUser?.email || "admin@sentinel.test"}</p>
                <div className="pt-1">
                  <RoleBadge role={currentUser?.role || "ADMIN"} />
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="block px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                >
                  Platform Settings
                </Link>
                <Link
                  href="/evaluation"
                  onClick={() => setShowUserMenu(false)}
                  className="block px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                >
                  Security Evaluation Suite
                </Link>
              </div>

              <div className="pt-1 border-t border-[var(--border-subtle)]">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-xs text-[var(--danger)] hover:bg-[var(--bg-secondary)]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Sentinel</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
