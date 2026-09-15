"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { api, type CurrentUser } from "@/lib/api";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/approvals",
    label: "Approvals",
    badgeKey: "pending_approvals",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/agent",
    label: "AI Agent",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8V4H8" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </svg>
    ),
  },
  {
    href: "/tools",
    label: "MCP Tools",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    href: "/policies",
    label: "Policy Engine",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    href: "/evaluation",
    label: "Security Tests",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m9 11 3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: "/audit",
    label: "Audit Logs",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    // Check health and pending approvals
    api.health()
      .then((h) => {
        startTransition(() => {
          setIsHealthy(h.status === "ok" || h.status === "healthy");
        });
      })
      .catch(() => {
        startTransition(() => {
          setIsHealthy(false);
        });
      });

    api.approvals.pending()
      .then((list) => {
        startTransition(() => {
          setPendingCount(list.length);
        });
      })
      .catch(() => {
        startTransition(() => {
          setPendingCount(null);
        });
      });

    // Fetch real authenticated identity from backend
    api.auth.me()
      .then((u) => {
        startTransition(() => {
          setCurrentUser(u);
        });
      })
      .catch(() => {
        startTransition(() => {
          setCurrentUser(null);
        });
      });
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignored
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sentinel_token");
        localStorage.removeItem("sentinel_role");
        localStorage.removeItem("sentinel_email");
        router.push("/");
      }
    }
  };

  return (
    <aside
      className="w-64 flex flex-col border-r flex-shrink-0"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Brand Header */}
      <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shadow-md"
            style={{
              background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-white">MCP-SENTINEL</div>
            <div className="text-[11px] font-mono tracking-wider" style={{ color: "var(--text-secondary)" }}>
              SECURITY PLATFORM
            </div>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="mt-4 flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-mono" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: isHealthy === null ? "#f59e0b" : isHealthy ? "#22c55e" : "#ef4444",
                boxShadow: isHealthy ? "0 0 8px #22c55e" : undefined,
              }}
            />
            <span style={{ color: "var(--text-secondary)" }}>
              {isHealthy === null ? "CONNECTING" : isHealthy ? "SYSTEM SECURE" : "OFFLINE"}
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(56, 189, 248, 0.1)", color: "var(--accent)" }}>
            v1.0.0
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const hasBadge = item.badgeKey === "pending_approvals" && pendingCount !== null && pendingCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? "active" : ""}`}
            >
              <span style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {hasBadge && (
                <span
                  className="px-1.5 py-0.5 text-[11px] font-bold rounded-full"
                  style={{
                    background: "rgba(245, 158, 11, 0.2)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Session footer */}
      <div
        className="p-4 border-t text-xs"
        style={{ borderColor: "var(--border)", background: "rgba(11, 15, 25, 0.5)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[11px]"
            style={{
              background:
                currentUser?.role === "ADMIN"
                  ? "#2563eb"
                  : currentUser?.role === "APPROVER"
                  ? "#d97706"
                  : currentUser?.role === "SECURITY_ANALYST"
                  ? "#7c3aed"
                  : "#059669",
            }}
          >
            {(currentUser?.display_name || currentUser?.name)
              ? (currentUser.display_name || currentUser.name || "")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "AD"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate">
              {currentUser?.display_name || currentUser?.name || "Security Admin"}
            </div>
            <div
              className="text-[10px] font-mono truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {currentUser?.email || "admin@sentinel.test"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
              style={{
                background:
                  currentUser?.role === "ADMIN"
                    ? "rgba(34, 197, 94, 0.15)"
                    : currentUser?.role === "APPROVER"
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(56, 189, 248, 0.15)",
                color:
                  currentUser?.role === "ADMIN"
                    ? "#22c55e"
                    : currentUser?.role === "APPROVER"
                    ? "#f59e0b"
                    : "#38bdf8",
                border:
                  currentUser?.role === "ADMIN"
                    ? "1px solid rgba(34, 197, 94, 0.3)"
                    : currentUser?.role === "APPROVER"
                    ? "1px solid rgba(245, 158, 11, 0.3)"
                    : "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              {currentUser?.role || "ADMIN"}
            </span>
            <button
              onClick={handleLogout}
              title="Sign Out / Revoke Session"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
