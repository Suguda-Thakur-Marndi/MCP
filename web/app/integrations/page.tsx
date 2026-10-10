"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { api, IntegrationListItem } from "@/lib/api";

export default function IntegrationsPage() {
  const [items, setItems] = useState<IntegrationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const loadIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.integrations.list();
      setItems(list || []);
    } catch (err: unknown) {
      console.warn("Failed to load integrations:", err);
      setError("Unable to connect to integrations catalog. Verify backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegrations();
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
    return ["ALL", ...cats];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const status = item.live_status || item.status;
      if (selectedStatus !== "ALL" && status !== selectedStatus) return false;
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

  const connectedCount = items.filter((i) => (i.live_status || i.status) === "CONNECTED").length;

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Header Banner */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-space-xxs">
            <span className="font-label-mono text-label-mono text-secondary font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              MULTI-SOFTWARE BOUNDARY GATEWAY
            </span>
            <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant">
              {connectedCount} OF {items.length} CONNECTED
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Connected Software &amp; Boundary Registry
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Enterprise integrations and custom MCP servers connected through Sentinel. Every tool call and permission boundary is evaluated in real time.
          </p>
        </div>

        <div className="flex items-center gap-space-xs font-label-mono text-label-mono">
          <Link
            href="/mcp-servers"
            className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">dns</span>
            <span>MCP Servers</span>
          </Link>
          <Link
            href="/tools"
            className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-semibold shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">construction</span>
            <span>All Tools Inventory</span>
          </Link>
        </div>
      </section>

      {/* Error state */}
      {error && (
        <div className="p-space-md rounded-xl bg-error-container text-on-error-container font-label-mono text-label-mono flex items-center justify-between border border-error/20">
          <span>{error}</span>
          <button onClick={() => void loadIntegrations()} className="cursor-pointer font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <section className="bg-surface-container-lowest p-space-md sm:p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-wrap items-center gap-space-sm font-label-mono text-label-mono">
        <div className="flex-1 min-w-[240px] relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search integration by name, endpoint..."
            className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant px-space-md py-1.5 pl-8 rounded-lg font-body-sm text-body-sm border border-surface-container outline-hidden focus:bg-surface-container"
          />
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2.5 pointer-events-none">
            search
          </span>
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-surface-container-low text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container outline-hidden cursor-pointer"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              Category: {c}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-surface-container-low text-on-surface px-space-md py-1.5 rounded-lg border border-surface-container outline-hidden cursor-pointer"
        >
          <option value="ALL">Status: All</option>
          <option value="CONNECTED">CONNECTED</option>
          <option value="DISCONNECTED">DISCONNECTED</option>
          <option value="ERROR">ERROR</option>
        </select>
      </section>

      {/* Integrations Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
        {loading ? (
          <div className="col-span-full bg-surface-container-lowest p-12 rounded-xl text-center font-label-mono text-on-surface-variant border border-surface-container">
            Loading integrations catalog from PostgreSQL...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full bg-surface-container-lowest p-12 rounded-xl text-center font-label-mono text-on-surface-variant border border-surface-container">
            No integrations match search filters.
          </div>
        ) : (
          filtered.map((item) => {
            const isConnected = (item.live_status || item.status) === "CONNECTED";
            return (
              <div
                key={item.id}
                className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col justify-between gap-space-md hover:border-border transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-space-xs mb-space-xs">
                    <div>
                      <span className="font-label-mono text-[10px] text-on-surface-variant uppercase">
                        {item.category}
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-0.5">
                        {item.name}
                      </h3>
                    </div>
                    <span
                      className={`font-label-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                        isConnected ? "bg-secondary text-on-secondary" : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {item.live_status || item.status}
                    </span>
                  </div>

                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <div className="space-y-1 font-label-mono text-label-mono text-[11px]">
                  <div className="p-space-xs bg-surface-container-low rounded border border-surface-container flex justify-between">
                    <span className="text-on-surface-variant">Auth Type:</span>
                    <span className="font-semibold text-on-surface">{item.auth_type}</span>
                  </div>
                  <div className="p-space-xs bg-surface-container-low rounded border border-surface-container flex justify-between">
                    <span className="text-on-surface-variant">Protocol:</span>
                    <span className="font-semibold text-on-surface">{item.protocol_type}</span>
                  </div>
                </div>

                <div className="pt-space-xs border-t border-surface-container flex items-center justify-between">
                  <span className="font-label-mono text-[10px] text-on-surface-variant truncate max-w-[140px]">
                    {item.connection_endpoint || "Local"}
                  </span>
                  <Link
                    href={`/integrations/${item.id}`}
                    className="font-label-ui text-label-ui text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Configure &amp; Test</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
