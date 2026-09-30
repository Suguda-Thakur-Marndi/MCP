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
  Activity,
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
  { title: "Security Dashboard", category: "Core", href: "/", icon: LayoutDashboard, description: "Overview of security metrics, system posture, and recent decisions" },
  { title: "Guarded Agent Console", category: "AI Defense", href: "/agent", icon: Bot, description: "Interactive chat with Gemini reasoning agent protected by SecurityGate" },
  { title: "System Health & Telemetry", category: "Diagnostics", href: "/health", icon: Activity, description: "Real-time service telemetry, latency waterfall, and pipeline topology" },
  { title: "Approval Queue", category: "Governance", href: "/approvals", icon: ShieldAlert, description: "Review and gate high-risk or destructive MCP tool execution" },
  { title: "Policy Engine", category: "Governance", href: "/policies", icon: Sliders, description: "Inspect deterministic rules and multi-factor risk scoring matrix" },
  { title: "MCP Tool Registry", category: "Tools", href: "/tools", icon: Wrench, description: "Inspect registered FastMCP tools, schemas, and destructive boundaries" },
  { title: "Security Evaluation Suite", category: "Assurance", href: "/evaluation", icon: CheckCircle, description: "Run automated security scenarios testing prompt injection & replay attacks" },
  { title: "Cryptographic Audit Trail", category: "Compliance", href: "/audit", icon: ScrollText, description: "Query structured PostgreSQL audit logs of every event & parameter hash" },
  { title: "Platform Settings & RBAC", category: "Administration", href: "/settings", icon: Settings, description: "Configure system telemetry and switch active RBAC test identity" },
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
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-[#F8F6F0] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#D1CEC7] dark:border-[#26344A] bg-[#EFECE6]/70 dark:bg-[#131B27]/70">
          <Search className="w-4 h-4 text-[#D05A40] flex-shrink-0" />
          <input
            type="text"
            placeholder="Type to search pages, telemetry, tools, audit, policies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-[#1A202E] dark:text-slate-100 placeholder-[#76736C] dark:placeholder-slate-500 focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-[#76736C] hover:text-[#1A202E] dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-1.5 py-0.5 rounded bg-[#E2DFD7] dark:bg-[#202C3D] border border-[#D1CEC7] dark:border-[#26344A] text-[10px] font-mono text-[#76736C] dark:text-slate-400"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#76736C] dark:text-slate-400">
              No matching pages or tools found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => handleSelect(item.href)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-left hover:bg-[#EAE6DE] dark:hover:bg-[#202C3D] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-[#E2DFD7] dark:bg-[#131B27] text-[#D05A40] group-hover:bg-[#D05A40]/10 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#1A202E] dark:text-slate-100 group-hover:text-[#D05A40] dark:group-hover:text-amber-400 transition-colors">
                          {item.title}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#E2DFD7] dark:bg-[#131B27] text-[#76736C] dark:text-slate-400 border border-[#D1CEC7] dark:border-[#26344A]">
                          {item.category}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-[#76736C] dark:text-slate-400 mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#76736C] dark:text-slate-500 group-hover:text-[#D05A40] group-hover:translate-x-0.5 transition-all" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-[#D1CEC7] dark:border-[#26344A] bg-[#EFECE6] dark:bg-[#101722] flex items-center justify-between text-[11px] font-mono text-[#76736C] dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3A8A7F]" />
            MCP-Sentinel Architectural Navigation
          </span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
}
