"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";

interface SearchResult {
  title: string;
  category: string;
  href: string;
  icon: React.ElementType;
  description?: string;
}

const STATIC_TARGETS: SearchResult[] = [
  { title: "Security Dashboard", category: "Page", href: "/", icon: LayoutDashboard, description: "Overview of security metrics, system health, and recent decisions" },
  { title: "Approval Queue", category: "Governance", href: "/approvals", icon: ShieldAlert, description: "Review and gate high-risk or destructive MCP tool execution" },
  { title: "Policy Engine", category: "Governance", href: "/policies", icon: Sliders, description: "Inspect deterministic rules and multi-factor risk scoring matrix" },
  { title: "Guarded Agent Console", category: "AI Defense", href: "/agent", icon: Bot, description: "Interactive chat with Gemini reasoning agent protected by SecurityGate" },
  { title: "MCP Tool Registry", category: "Tools", href: "/tools", icon: Wrench, description: "Inspect registered FastMCP tools, schemas, and destructive boundaries" },
  { title: "Security Evaluation Suite", category: "Assurance", href: "/evaluation", icon: CheckCircle, description: "Run automated security scenarios testing prompt injection & replay attacks" },
  { title: "Cryptographic Audit Trail", category: "Compliance", href: "/audit", icon: ScrollText, description: "Query structured PostgreSQL audit logs of every event & parameter hash" },
  { title: "Platform Settings & RBAC", category: "Platform", href: "/settings", icon: Settings, description: "Configure system telemetry and switch active RBAC test identity" },
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

  if (!isOpen) return null;

  const filtered = STATIC_TARGETS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelect = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-xl bg-[#0F172A] border border-[#243044] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#243044] bg-[#111827]">
          <Search className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Type to search platform, tools, audit, approvals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400 hover:text-slate-200"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching pages or tools found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => handleSelect(item.href)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-left hover:bg-slate-800/70 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-slate-800 text-sky-400 group-hover:bg-sky-950/50 group-hover:text-sky-300 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                          {item.title}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                          {item.category}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-sky-400 transition-colors" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-[#243044] bg-[#0B0F14] flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>MCP-Sentinel Security Gateway</span>
          <span>Navigation Quick Search</span>
        </div>
      </div>
    </div>
  );
}
