"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  LayoutDashboard,
  ShieldAlert,
  Bot,
  Wrench,
  Sliders,
  CheckCircle,
  ScrollText,
  Settings,
  ArrowRight,
  Layers,
  Server,
  Activity,
  AlertTriangle,
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
  { id: "agent-3", title: "Customer CRM Agent", category: "Agents", href: "/agent-runs", icon: Bot, description: "Customer account lifecycle & GDPR erasure supervisor", badge: "GATED" },

  // Runs
  { id: "run-1", title: "Run #90214 — github.delete_repository", category: "Runs", href: "/agent-runs/run-90214", icon: Bot, description: "Production repo deletion blocked by Repository Protection Policy", badge: "BLOCKED" },
  { id: "run-2", title: "Run #90213 — canva.create_design", category: "Runs", href: "/agent-runs/run-90213", icon: Bot, description: "Q4 Brand Banner generation completed through Canva MCP bridge", badge: "EXECUTED" },
  { id: "run-3", title: "Run #90212 — mcp.delete_customer", category: "Runs", href: "/agent-runs/run-90212", icon: Bot, description: "GDPR erasure ticket awaiting human cryptographic sign-off", badge: "PENDING" },

  // Tools
  { id: "tool-1", title: "canva.create_design", category: "Tools", href: "/tools", icon: Wrench, description: "Generates brand asset layers with typography and color tokens", badge: "MEDIUM" },
  { id: "tool-2", title: "github.delete_repository", category: "Tools", href: "/tools", icon: Wrench, description: "Permanently deletes an organization version control repository", badge: "CRITICAL" },
  { id: "tool-3", title: "slack.send_message", category: "Tools", href: "/tools", icon: Wrench, description: "Dispatches formatted block kit messages to verified channels", badge: "LOW" },
  { id: "tool-4", title: "drive.delete_file", category: "Tools", href: "/tools", icon: Wrench, description: "Permanently purges files and folders from corporate Google Drive", badge: "CRITICAL" },
  { id: "tool-5", title: "jira.transition_issue", category: "Tools", href: "/tools", icon: Wrench, description: "Advances ticket state across production deployment workflows", badge: "HIGH" },

  // Integrations
  { id: "int-1", title: "Canva", category: "Integrations", href: "/integrations/canva", icon: Layers, description: "OAuth 2.0 visual communications platform — 4 registered tools", badge: "CONNECTED" },
  { id: "int-2", title: "GitHub Enterprise", category: "Integrations", href: "/integrations/github", icon: Layers, description: "OAuth App source code management & PR gating — 5 tools", badge: "CRITICAL" },
  { id: "int-3", title: "Slack Enterprise Grid", category: "Integrations", href: "/integrations/slack", icon: Layers, description: "Bot token communication gateway & incident war-rooms", badge: "CONNECTED" },
  { id: "int-4", title: "Google Drive Vault", category: "Integrations", href: "/integrations/google-drive", icon: Layers, description: "Google OAuth 2.0 cloud storage file repository", badge: "HIGH" },
  { id: "int-5", title: "Notion Workspace", category: "Integrations", href: "/integrations/notion", icon: Layers, description: "Internal engineering wiki & database query gateway", badge: "CONNECTED" },
  { id: "int-6", title: "Atlassian Jira", category: "Integrations", href: "/integrations/jira", icon: Layers, description: "Project management, ticket transitions & sprint governance", badge: "CONNECTED" },
  { id: "int-7", title: "Custom MCP Gateways", category: "Integrations", href: "/integrations/custom-mcp", icon: Server, description: "Direct Model Context Protocol gateways connected to internal DB", badge: "LIVE" },

  // Policies
  { id: "pol-1", title: "Production Data Protection", category: "Policies", href: "/policies/pol_prod_data", icon: Sliders, description: "Blocks irreversible data destruction without two-person sign-off", badge: "ENFORCING" },
  { id: "pol-2", title: "Repository Protection Policy", category: "Policies", href: "/policies/pol_repo_guard", icon: Sliders, description: "Forbids autonomous repository deletion and branch override", badge: "ENFORCING" },
  { id: "pol-3", title: "External Communication Policy", category: "Policies", href: "/policies/pol_ext_comm", icon: Sliders, description: "Governs public broadcast limits & prevents unauthorized mentions", badge: "ACTIVE" },
  { id: "pol-4", title: "Financial Action Policy", category: "Policies", href: "/policies/pol_financial", icon: Sliders, description: "Requires finance lead authorization for transfers > $500", badge: "ENFORCING" },
  { id: "pol-5", title: "Personal Data Policy", category: "Policies", href: "/policies/pol_pii", icon: Sliders, description: "Prevents external exfiltration of customer PII and tokens", badge: "ENFORCING" },

  // Approvals
  { id: "appr-1", title: "Approval Ticket #90212 — delete_customer", category: "Approvals", href: "/approvals", icon: ShieldAlert, description: "GDPR Article 17 Erasure for Customer 10842 (Risk Score: 88/100)", badge: "PENDING" },
  { id: "appr-2", title: "Approval Ticket #90214 — delete_repository", category: "Approvals", href: "/approvals", icon: ShieldAlert, description: "Attempted purge of sentinel-prod-backend-v1 (Risk Score: 98/100)", badge: "REJECTED" },

  // Audit Events
  { id: "aud-1", title: "Audit Event aud_98410294", category: "Audit Events", href: "/audit", icon: ScrollText, description: "BLOCKED invariant violation on github.delete_repository with SHA-256 seal", badge: "VERIFIED" },
  { id: "aud-2", title: "Audit Event aud_98410295", category: "Audit Events", href: "/audit", icon: ScrollText, description: "ALLOWED non-destructive design draft through canva.create_design", badge: "VERIFIED" },

  // Evaluations
  { id: "eval-1", title: "Prompt Injection Adversarial Suite", category: "Evaluations", href: "/evaluation", icon: CheckCircle, description: "12/12 Jailbreak & System Prompt Override defense scenarios passed", badge: "100% PASS" },
  { id: "eval-2", title: "Tool Abuse & Side-Effect Suite", category: "Evaluations", href: "/evaluation", icon: CheckCircle, description: "18/18 Parameter Tampering & State Pollution tests blocked", badge: "100% PASS" },
  { id: "eval-3", title: "Privilege Escalation & Bypass Suite", category: "Evaluations", href: "/evaluation", icon: CheckCircle, description: "15/15 Role Elevation & Secret Token exfiltration attempts blocked", badge: "100% PASS" },
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

  // Group by category for editorial presentation
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
        className="w-full max-w-2xl rounded-xs bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <Search className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search agents, runs, tools, integrations, policies, approvals, audit, evaluations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] text-[10px] font-mono-tnum text-[var(--text-secondary)]">
            ESC
          </kbd>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--border-subtle)] overflow-x-auto text-[11px] font-mono-tnum">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-xs transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-[var(--accent)] text-white font-semibold"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grouped Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] font-mono-tnum">
              No matching security entities found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="px-2 text-[10px] uppercase font-mono-tnum font-bold text-[var(--text-muted)] tracking-wider">
                  {category} ({items.length})
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item.href)}
                        className="w-full flex items-center justify-between p-2 rounded-xs text-left hover:bg-[var(--bg-secondary)] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="p-1.5 rounded-xs bg-[var(--bg-card)] border border-[var(--border)] text-[var(--accent)] group-hover:border-[var(--accent)] transition-colors flex-shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] truncate">
                                {item.title}
                              </span>
                              {item.badge && (
                                <span className="px-1.5 py-0.2 rounded-xs text-[9px] font-mono-tnum font-bold bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-secondary)]/40 flex items-center justify-between text-[10px] font-mono-tnum text-[var(--text-muted)]">
          <span>MCP SENTINEL — UNIVERSAL SECURITY GATEWAY</span>
          <span>ENTER TO JUMP</span>
        </div>
      </div>
    </div>
  );
}
