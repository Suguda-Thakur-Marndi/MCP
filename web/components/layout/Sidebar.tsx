"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldAlert,
  Sliders,
  Bot,
  Wrench,
  CheckCircle,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  X,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";
import { RoleBadge } from "../ui/Badges";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badgeCount?: number;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
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
      .then((items) => {
        if (active) setPendingApprovalsCount(items.length);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [pathname]);

  const NAVIGATION: NavGroup[] = [
    {
      group: "Overview",
      items: [
        { label: "Dashboard", href: "/", icon: LayoutDashboard },
      ],
    },
    {
      group: "Governance & Approvals",
      items: [
        { label: "Approval Queue", href: "/approvals", icon: ShieldAlert, badgeCount: pendingApprovalsCount },
        { label: "Policy Engine", href: "/policies", icon: Sliders },
      ],
    },
    {
      group: "AI & MCP Operations",
      items: [
        { label: "Guarded Agent", href: "/agent", icon: Bot },
        { label: "MCP Tools", href: "/tools", icon: Wrench },
      ],
    },
    {
      group: "Assurance & Compliance",
      items: [
        { label: "Security Tests", href: "/evaluation", icon: CheckCircle },
        { label: "Audit Logs", href: "/audit", icon: ScrollText },
      ],
    },
    {
      group: "Platform",
      items: [
        { label: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-40 bg-[#0F172A] border-r border-[#243044] flex flex-col transition-all duration-200 select-none ${
        isCollapsed ? "w-16" : "w-64"
      } ${
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-[#243044] px-4 flex items-center justify-between">
        <Link href="/" onClick={onCloseMobile} className="flex items-center gap-2.5 overflow-hidden group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 p-[1px] shadow-md shadow-cyan-500/20 flex-shrink-0 group-hover:scale-105 transition-transform">
            <div className="w-full h-full rounded-[7px] bg-[#0A0E17] flex items-center justify-center font-black text-cyan-400 text-xs tracking-wider">
              MS
            </div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-xs font-black tracking-[0.14em] text-white flex items-center">
                MCP<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400">SENTINEL</span>
              </span>
              <span className="text-[9px] text-slate-400 font-mono tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                SECURITY GATEWAY
              </span>
            </div>
          )}
        </Link>
        <div className="flex items-center gap-1">
          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors lg:hidden"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:block p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Organization Header */}
      {!isCollapsed && (
        <div className="px-3 py-2 bg-[#111827] border-b border-[#243044] flex items-center justify-between">
          <div className="truncate">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 block">Organization</span>
            <span className="text-xs font-medium text-slate-200 truncate block">
              {currentUser?.organization || "Sentinel Enterprise"}
            </span>
          </div>
          {currentUser?.role && <RoleBadge role={currentUser.role} />}
        </div>
      )}

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAVIGATION.map((grp) => (
          <div key={grp.group}>
            {!isCollapsed && (
              <h5 className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {grp.group}
              </h5>
            )}
            <ul className="space-y-0.5">
              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}`));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-blue-600/20 text-sky-400 border border-sky-500/30 font-semibold"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      } ${isCollapsed ? "justify-center px-0" : ""}`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-sky-400" : "text-slate-400"}`} />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!isCollapsed && (item.badgeCount ?? 0) > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold">
                          {item.badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer / User Profile summary */}
      <div className="p-3 border-t border-[#243044] bg-[#0B0F14]/50">
        <div className={`flex items-center gap-2.5 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300 flex-shrink-0">
            {currentUser?.name ? currentUser.name[0].toUpperCase() : "A"}
          </div>
          {!isCollapsed && (
            <div className="truncate flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">{currentUser?.name || "Operator"}</p>
              <p className="text-[10px] text-slate-500 truncate font-mono">{currentUser?.email || "admin@sentinel.test"}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
