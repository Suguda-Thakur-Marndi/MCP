"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ShieldAlert,
  Bot,
  Wrench,
  Sliders,
  CheckCircle,
  ScrollText,
  ArrowRight,
  Layers,
  Server,
} from "lucide-react";

interface SearchEntity {
  id: string;
  title: string;
  category: "Agents" | "Runs" | "Tools" | "Integrations" | "Policies" | "Approvals" | "Audit Events" | "Evaluations";
  href: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

const SEARCH_CATALOG: SearchEntity[] = [
  // Agents
  { id: "agent-1", title: "DevOps Sentinel Agent", category: "Agents", href: "/agent-runs", icon: Bot, description: "Gemini 2.5 Pro autonomous infrastructure & CI/CD agent", badge: "CRITICAL" },
  { id: "agent-2", title: "Marketing Lead Agent", category: "Agents", href: "/agent-runs", icon: Bot, description: "Canva design synthesis & template compliance agent", badge: "ACTIVE" },
  { id: "agent-3", title: "Customer CRM Agent", category: "Agents", href: "/agent-runs", icon: Bot, description: "Customer account lifecycle & PostgreSQL supervisor", badge: "GATED" },

  // Runs
  { id: "run-1", title: "Run #90214 — github.delete_repository", category: "Runs", href: "/agent-runs", icon: Bot, description: "Production repo deletion blocked by Repository Protection Policy", badge: "BLOCKED" },
  { id: "run-2", title: "Run #90213 — canva.create_design", category: "Runs", href: "/agent-runs", icon: Bot, description: "Q4 Brand Banner generation completed through Canva MCP bridge", badge: "EXECUTED" },
  { id: "run-3", title: "Run #90212 — delete_customer", category: "Runs", href: "/agent-runs", icon: Bot, description: "GDPR erasure ticket awaiting human cryptographic sign-off", badge: "PENDING" },

  // Tools
  { id: "tool-1", title: "canva.create_design", category: "Tools", href: "/tools", icon: Wrench, description: "Generates brand asset layers with typography and color tokens", badge: "MEDIUM" },
  { id: "tool-2", title: "github.delete_repository", category: "Tools", href: "/tools", icon: Wrench, description: "Permanently deletes an organization version control repository", badge: "CRITICAL" },
  { id: "tool-3", title: "slack.send_message", category: "Tools", href: "/tools", icon: Wrench, description: "Dispatches formatted block kit messages to verified channels", badge: "LOW" },
  { id: "tool-4", title: "query_customer_records", category: "Tools", href: "/tools", icon: Wrench, description: "Reads filtered customer records with verified column projection", badge: "LOW" },
  { id: "tool-5", title: "purge_inactive_customer_data", category: "Tools", href: "/tools", icon: Wrench, description: "Purges inactive customer records subject to dual-custody approval", badge: "CRITICAL" },

  // Integrations
  { id: "int-1", title: "Canva", category: "Integrations", href: "/integrations", icon: Layers, description: "OAuth 2.0 visual communications platform — registered tools", badge: "CONNECTED" },
  { id: "int-2", title: "GitHub Enterprise", category: "Integrations", href: "/integrations", icon: Layers, description: "OAuth App source code management & PR gating", badge: "CRITICAL" },
  { id: "int-3", title: "Slack Enterprise Grid", category: "Integrations", href: "/integrations", icon: Layers, description: "Bot token communication gateway & incident channels", badge: "CONNECTED" },
  { id: "int-4", title: "Google Drive Vault", category: "Integrations", href: "/integrations", icon: Layers, description: "Google OAuth 2.0 cloud storage file repository", badge: "HIGH" },
  { id: "int-5", title: "Custom MCP Gateways", category: "Integrations", href: "/integrations", icon: Server, description: "Direct Model Context Protocol gateways connected to internal DB", badge: "LIVE" },

  // Policies
  { id: "pol-1", title: "Production Data Protection", category: "Policies", href: "/policies", icon: Sliders, description: "Blocks irreversible data destruction without two-person sign-off", badge: "ENFORCING" },
  { id: "pol-2", title: "Repository Protection Policy", category: "Policies", href: "/policies", icon: Sliders, description: "Forbids autonomous repository deletion and branch override", badge: "ENFORCING" },
  { id: "pol-3", title: "Financial Ledger Protection", category: "Policies", href: "/policies", icon: Sliders, description: "Requires dual-custody authorization for ledger modifications", badge: "ENFORCING" },

  // Approvals
  { id: "appr-1", title: "Approval Ticket #90212 — delete_customer", category: "Approvals", href: "/approvals", icon: ShieldAlert, description: "Customer account deletion request (Risk Score: 88/100)", badge: "PENDING" },
  { id: "appr-2", title: "Approval Ticket #90214 — pg_mutate_table", category: "Approvals", href: "/approvals", icon: ShieldAlert, description: "Batch modification on contracts table (Risk Score: 92/100)", badge: "PENDING" },

  // Audit Events
  { id: "aud-1", title: "Audit Event aud_98410294", category: "Audit Events", href: "/audit", icon: ScrollText, description: "BLOCKED invariant violation on destructive SQL with SHA-256 seal", badge: "VERIFIED" },
  { id: "aud-2", title: "Audit Event aud_98410295", category: "Audit Events", href: "/audit", icon: ScrollText, description: "ALLOWED customer read query under active rate limits", badge: "VERIFIED" },

  // Evaluations
  { id: "eval-1", title: "Prompt Injection Adversarial Suite", category: "Evaluations", href: "/evaluation", icon: CheckCircle, description: "Jailbreak & System Prompt Override defense scenarios", badge: "PASS" },
  { id: "eval-2", title: "Tool Abuse & Side-Effect Suite", category: "Evaluations", href: "/evaluation", icon: CheckCircle, description: "Parameter Tampering & State Pollution tests blocked", badge: "PASS" },
  { id: "eval-3", title: "SQL Injection Neutralization Suite", category: "Evaluations", href: "/evaluation", icon: CheckCircle, description: "Parameterized query builder defense against SQLi patterns", badge: "PASS" },
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
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(SEARCH_CATALOG.map((c) => c.category)));
    return ["ALL", ...cats];
  }, []);

  const filtered = useMemo(() => {
    return SEARCH_CATALOG.filter((item) => {
      const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
      const q = query.toLowerCase();
      const matchesQuery =
        !query ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchEntity[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return map;
  }, [filtered]);

  if (!isOpen) return null;

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl rounded-xl bg-surface-container-lowest border border-border shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-container-low">
          <Search className="w-4 h-4 text-primary shrink-0" />
          <input
            type="text"
            placeholder="Search agents, runs, tools, integrations, policies, approvals, audit, evaluations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface"
              aria-label="Clear query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-container-high border border-border text-[10px] font-mono text-on-surface-variant">
            ESC
          </kbd>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto text-xs font-mono">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-primary text-on-primary font-semibold"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grouped Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-on-surface-variant font-mono">
              No matching security entities found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-2 text-[10px] uppercase font-mono font-bold text-on-surface-variant tracking-wider">
                  {category} ({items.length})
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.href)}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-surface-container-low transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="p-1.5 rounded-lg bg-surface-container border border-border text-primary group-hover:bg-primary-fixed group-hover:border-primary/30 transition-colors shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-on-surface group-hover:text-primary truncate">
                                {item.title}
                              </span>
                              {item.badge && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-surface-container-high text-on-surface-variant">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-border bg-surface-container-low flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
          <span>MCP SENTINEL — ZERO-TRUST SECURITY GATEWAY</span>
          <span>ENTER TO JUMP</span>
        </div>
      </div>
    </div>
  );
}
