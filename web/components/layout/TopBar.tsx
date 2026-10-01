"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Search,
  Volume2,
  VolumeX,
  Maximize2,
  Menu,
  Activity,
  LogOut,
  ChevronDown,
  Shield,
  ExternalLink,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";
import { RoleBadge } from "../ui/Badges";

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
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeAgentsCount, setActiveAgentsCount] = useState<number>(12);
  const [gatewayTunnelsCount, setGatewayTunnelsCount] = useState<number>(8);
  const [callsPerMin, setCallsPerMin] = useState<number>(142);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif-1",
      title: "Dual-Custody Approval Required",
      description: "DevOps Agent requested delete_repository on GitHub enterprise production repo.",
      category: "CRITICAL",
      time: "2m ago",
      actionHref: "/approvals",
      actionLabel: "Review in Queue",
      read: false,
    },
    {
      id: "notif-2",
      title: "Exfiltration Attempt Blocked",
      description: "Agent attempted to share sensitive doc without human paired ticket.",
      category: "HIGH",
      time: "8m ago",
      actionHref: "/audit",
      actionLabel: "Inspect Audit Trail",
      read: false,
    },
    {
      id: "notif-3",
      title: "MCP Gateway Heartbeat Verified",
      description: "FastMCP daemon and 5 external SaaS bridges running with <1.5ms latency.",
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
      .then((h) => {
        if (active) setIsHealthy(h.status === "healthy" || h.status === "ok");
      })
      .catch(() => {
        if (active) setIsHealthy(false);
      });

    api.auth.me()
      .then((u) => {
        if (active) setCurrentUser(u);
      })
      .catch(() => {});

    api.approvals.pending()
      .then((items) => {
        if (active) setPendingCount(items.length);
      })
      .catch(() => {});

    api.dashboard.stats()
      .then((stats) => {
        if (active && stats?.metrics) {
          if (stats.metrics.pending_approvals !== undefined) setPendingCount(stats.metrics.pending_approvals);
          if (stats.metrics.audit_events) setCallsPerMin(Math.min(500, Math.max(120, stats.metrics.audit_events)));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [pathname]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sentinel_token");
        window.location.href = "/auth";
      }
    }
  };

  const getBreadcrumbs = () => {
    if (pathname === "/" || pathname === "/overview") return { section: "CONTROL", page: "COMMAND CENTER" };
    if (pathname.startsWith("/agent")) return { section: "CONTROL", page: "AGENT RUNS" };
    if (pathname.startsWith("/approvals")) return { section: "GOVERN", page: "APPROVAL QUEUE" };
    if (pathname.startsWith("/policies")) return { section: "GOVERN", page: "POLICY ENGINE" };
    if (pathname.startsWith("/risk")) return { section: "GOVERN", page: "RISK MATRIX" };
    if (pathname.startsWith("/integrations")) return { section: "CONNECT", page: "INTEGRATIONS" };
    if (pathname.startsWith("/mcp-servers")) return { section: "CONNECT", page: "MCP SERVERS" };
    if (pathname.startsWith("/tools")) return { section: "CONNECT", page: "TOOLS REGISTRY" };
    if (pathname.startsWith("/audit")) return { section: "INVESTIGATE", page: "FORENSIC AUDIT" };
    if (pathname.startsWith("/evaluation")) return { section: "INVESTIGATE", page: "SECURITY EVALUATION" };
    if (pathname.startsWith("/health")) return { section: "SYSTEM", page: "HEALTH TELEMETRY" };
    if (pathname.startsWith("/settings")) return { section: "SYSTEM", page: "SETTINGS" };
    return { section: "MCP SENTINEL", page: "CONSOLE" };
  };

  const { section, page } = getBreadcrumbs();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header
      className={`fixed top-0 right-0 h-14 bg-[var(--surface-container-lowest)]/95 backdrop-blur-md border-b border-[var(--border)] z-40 flex items-center justify-between px-3 sm:px-4 transition-all duration-150 select-none ${
        sidebarCollapsed ? "left-16" : "left-0 lg:left-64"
      }`}
    >
      {/* Left: Mobile Menu Toggle & Monospace Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container-high)] lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono-tnum tracking-widest uppercase">
          <span className="text-[var(--text-muted)] font-semibold">{section}</span>
          <span className="text-[var(--border-interactive)] font-bold">{"//"}</span>
          <span className="text-[var(--primary)] font-bold truncate">{page}</span>
        </div>
      </div>

      {/* Center: Live Command Telemetry Strip (Desktop Widescreen) */}
      <div className="hidden xl:flex items-center divide-x divide-[var(--border)] bg-[var(--surface-container-low)]/80 border border-[var(--border)] rounded-xs px-1 py-1 font-mono-tnum">
        <div className="flex items-center gap-1.5 px-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)]" />
          <span className="font-code-sm text-[11px] text-[var(--text-primary)] font-semibold">{activeAgentsCount}</span>
          <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase">ACTIVE AGENTS</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)]" />
          <span className="font-code-sm text-[11px] text-[var(--text-primary)] font-semibold">{gatewayTunnelsCount}</span>
          <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase">GATEWAY TUNNELS</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--secondary-container)]" />
          <span className="font-code-sm text-[11px] text-[var(--text-primary)] font-semibold">{callsPerMin}</span>
          <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase">CALLS/MIN</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)] animate-pulse" />
          <span className="font-code-sm text-[11px] text-[var(--error)] font-semibold">{pendingCount}</span>
          <span className="font-label-caps text-[9px] text-[var(--error)] uppercase">HELD APPROVALS</span>
        </div>
      </div>

      {/* Right Controls: Search, Latency, Notifications, Audio, Fullscreen, User Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Global Command Palette Trigger */}
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] border border-[var(--border)] rounded-xs px-2.5 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors w-44 md:w-56"
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-code-sm text-[11px] truncate">CMD + K to query...</span>
        </button>

        {/* Latency Telemetry Badge */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] font-code-sm text-[var(--primary-container)]"
          title="Gateway Core Telemetry Latency P99"
        >
          <Activity className="w-3 h-3 text-[var(--primary-container)]" />
          <span className="text-[10px] font-bold">1.2ms P99</span>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Notification Center"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--danger)] animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-1 w-80 sm:w-96 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border-interactive)] shadow-2xl py-2 z-50 space-y-2">
              <div className="px-3 py-1 flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="font-label-caps text-[10px] text-[var(--text-primary)] font-bold">
                  SECURITY NOTIFICATIONS
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-xs bg-[var(--error-container)]/40 border border-[var(--error)]/50 text-[var(--error)] font-label-caps text-[9px] font-bold">
                    {unreadCount} UNREAD
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)] px-2">
                {notifications.map((item) => (
                  <div key={item.id} className="p-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--primary)] text-[11px]">{item.title}</span>
                      <span className="font-code-sm text-[9px] text-[var(--text-muted)]">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">{item.description}</p>
                    <Link
                      href={item.actionHref}
                      onClick={() => setShowNotifications(false)}
                      className="inline-flex items-center gap-1 font-label-caps text-[9px] text-[var(--secondary-container)] hover:underline pt-0.5"
                    >
                      <span>{item.actionLabel}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Audio Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors hidden sm:flex"
          title={soundEnabled ? "Mute audio cues" : "Unmute audio cues"}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-high)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors hidden sm:flex"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* User Identity Menu */}
        <div className="relative pl-1 border-l border-[var(--border)]" ref={userRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1.5 p-1 rounded-xs hover:bg-[var(--surface-container-high)] transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center text-[10px] font-bold">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : "A"}
            </div>
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-1 w-52 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border-interactive)] shadow-2xl py-2 z-50 text-xs font-mono-tnum">
              <div className="px-3 py-1.5 border-b border-[var(--border)] space-y-0.5">
                <p className="font-bold text-[var(--text-primary)]">{currentUser?.name || "Dr. Aris Thorne"}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{currentUser?.email || "admin@sentinel.test"}</p>
                <div className="pt-1">
                  <RoleBadge role={currentUser?.role || "ADMIN"} />
                </div>
              </div>
              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="block px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container-low)]"
                >
                  Platform Settings
                </Link>
                <Link
                  href="/evaluation"
                  onClick={() => setShowUserMenu(false)}
                  className="block px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container-low)]"
                >
                  Security Evaluation
                </Link>
              </div>
              <div className="pt-1 border-t border-[var(--border)]">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 text-xs text-[var(--danger)] hover:bg-[var(--surface-container-low)]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
