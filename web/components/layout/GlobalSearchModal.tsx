"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ShieldAlert,
  Wrench,
  ShieldCheck,
  FileText,
  Blocks,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { api, ToolInfo, ApprovalRecord } from "@/lib/api";

interface SearchEntity {
  id: string;
  title: string;
  category: "Navigation" | "MCP Tools" | "Pending Approvals";
  href: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

const STATIC_NAV_ENTITIES: SearchEntity[] = [
  {
    id: "nav-overview",
    title: "Overview & Telemetry",
    category: "Navigation",
    href: "/",
    icon: LayoutDashboard,
    description: "Backend health, Supabase pool status, and recent audit activity",
  },
  {
    id: "nav-approvals",
    title: "Human Approval Queue",
    category: "Navigation",
    href: "/approvals",
    icon: ShieldAlert,
    description: "Review pending, approved, and denied dual-custody operation tickets",
  },
  {
    id: "nav-audit",
    title: "Audit Ledger",
    category: "Navigation",
    href: "/audit",
    icon: FileText,
    description: "Append-only security audit log with parameter verification",
  },
  {
    id: "nav-integrations",
    title: "Software Integrations",
    category: "Navigation",
    href: "/integrations",
    icon: Blocks,
    description: "Supabase PostgreSQL, Notion, and connected software catalog",
  },
  {
    id: "nav-policies",
    title: "Policy Engine & Invariants",
    category: "Navigation",
    href: "/policies",
    icon: ShieldCheck,
    description: "Deterministic security rules and execution guardrails",
  },
  {
    id: "nav-tools",
    title: "MCP Tools Inventory",
    category: "Navigation",
    href: "/tools",
    icon: Wrench,
    description: "Registered FastMCP tools, schemas, and risk classifications",
  },
  {
    id: "nav-settings",
    title: "Operational Settings",
    category: "Navigation",
    href: "/settings",
    icon: Settings,
    description: "Cluster configuration, database parameters, and session controls",
  },
];

export function GlobalSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [pendingTickets, setPendingTickets] = useState<ApprovalRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);

      // Load real tools and pending tickets
      api.policies
        .tools()
        .then((t) => {
          if (Array.isArray(t)) setTools(t);
        })
        .catch(() => {});

      api.approvals
        .pending()
        .then((a) => {
          if (Array.isArray(a)) setPendingTickets(a);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Global key listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build combined catalog from real data
  const dynamicCatalog: SearchEntity[] = useMemo(() => {
    const list: SearchEntity[] = [...STATIC_NAV_ENTITIES];

    for (const t of tools) {
      const name = t.tool_name || t.name;
      list.push({
        id: `tool-${name}`,
        title: name,
        category: "MCP Tools",
        href: "/tools",
        icon: Wrench,
        description: t.description || `FastMCP tool: ${name}`,
        badge: t.is_destructive ? "DESTRUCTIVE" : t.risk_level || "ALLOW",
      });
    }

    for (const p of pendingTickets) {
      const ticketId = p.ticket_id || p.id || "ticket";
      list.push({
        id: `ticket-${ticketId}`,
        title: `Pending Approval: ${p.tool_name || p.action}`,
        category: "Pending Approvals",
        href: "/approvals",
        icon: ShieldAlert,
        description: `Target ID: ${p.target_id || "resource"} • Requester: ${p.requester || "agent"}`,
        badge: "PENDING",
      });
    }

    return list;
  }, [tools, pendingTickets]);

  const filteredEntities = useMemo(() => {
    if (!query.trim()) return dynamicCatalog.slice(0, 10);
    const q = query.toLowerCase();
    return dynamicCatalog
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [query, dynamicCatalog]);

  const handleSelect = (item: SearchEntity) => {
    router.push(item.href);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredEntities.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredEntities.length) % Math.max(1, filteredEntities.length));
    } else if (e.key === "Enter" && filteredEntities[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredEntities[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl rounded-lg bg-[var(--surface-container-low)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-container-lowest)]">
          <Search className="w-4 h-4 text-[var(--on-surface-variant)] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, tools, or pending tickets..."
            className="w-full bg-transparent text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] outline-none font-mono"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredEntities.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--on-surface-variant)] font-mono">
              No matching commands or entities found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredEntities.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[var(--surface-container-high)] text-[var(--on-surface)]"
                      : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded bg-[var(--surface-container)] border border-[var(--border)] flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-[var(--primary)]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--on-surface)] truncate">
                          {item.title}
                        </span>
                        <span className="font-mono text-[9px] text-[var(--on-surface-variant)] uppercase px-1 py-0.2 rounded bg-[var(--surface-container)]">
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--on-surface-variant)] truncate mt-0.5">
                        {item.description}
                      </span>
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ml-2 shrink-0 border ${
                        item.badge === "PENDING"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : item.badge === "DESTRUCTIVE"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--surface-container-lowest)] flex items-center justify-between font-mono text-[10px] text-[var(--on-surface-variant)]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Dismiss</span>
          </div>
          <span>SentinelCore</span>
        </div>
      </div>
    </div>
  );
}
