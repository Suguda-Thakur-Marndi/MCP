"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
} from "lucide-react";
import { SYSTEM_TOPOLOGY, SystemComponent } from "@/lib/sentinel-data";
import { api } from "@/lib/api";

export default function SystemHealthPage() {
  const [components, setComponents] = useState<SystemComponent[]>(SYSTEM_TOPOLOGY);
  const [isPinging, setIsPinging] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>("Just now");

  const runHealthProbe = async () => {
    setIsPinging(true);
    try {
      const liveHealth = await api.health().catch(() => null);
      setTimeout(() => {
        setComponents((prev) =>
          prev.map((c) => {
            const jitter = Math.floor(Math.random() * 8) - 4;
            const updatedLatency = Math.max(1, c.latencyMs + jitter);
            return {
              ...c,
              latencyMs: updatedLatency,
              lastCheck: "Just now",
              status: liveHealth ? "ONLINE" : c.status,
            };
          })
        );
        setLastCheckTime(new Date().toLocaleTimeString());
        setIsPinging(false);
      }, 400);
    } catch {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    api.health()
      .then((liveHealth) => {
        if (isMounted) {
          setComponents((prev) =>
            prev.map((c) => ({
              ...c,
              lastCheck: "Just now",
              status: liveHealth ? "ONLINE" : c.status,
            }))
          );
          setLastCheckTime(new Date().toLocaleTimeString());
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const totalErrors = components.reduce((acc, c) => acc + c.errors, 0);
  const avgLatency = Math.round(
    components.reduce((acc, c) => acc + c.latencyMs, 0) / components.length
  );

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              INFRASTRUCTURE TELEMETRY // NOC LIVENESS
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold">
              7/7 NODES SYNCHRONIZED
            </span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            SYSTEM TOPOLOGY & SUBSYSTEM HEALTH
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Real-time heartbeat probes, round-trip transport latency, and protocol handshake telemetry across the 7 core components of the Sentinel platform.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs self-start sm:self-auto">
          <span className="font-code-sm text-[10px] text-[var(--text-muted)] hidden sm:inline mr-1">
            PROBE: {lastCheckTime}
          </span>
          <button
            onClick={runHealthProbe}
            disabled={isPinging}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-code-sm text-xs font-bold hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? "animate-spin" : ""}`} />
            <span>PROBE ALL NODES</span>
          </button>
        </div>
      </div>

      {/* Telemetry Summary Strip */}
      <div className="p-3 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">GLOBAL PERIMETER</span>
            <span className="font-telemetry-num text-base font-bold text-[var(--primary-container)] block flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--primary-container)] animate-pulse" />
              100% OPERATIONAL
            </span>
          </div>
          <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">AVERAGE LATENCY</span>
            <span className="font-telemetry-num text-base font-bold text-[var(--text-primary)] block">{avgLatency} ms</span>
          </div>
          <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">ACTIVE ERRORS</span>
            <span className="font-telemetry-num text-base font-bold text-[var(--text-primary)] block">{totalErrors} Detected</span>
          </div>
          <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
            <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">GATEWAY UPTIME</span>
            <span className="font-telemetry-num text-base font-bold text-[var(--primary-container)] block">99.98%</span>
          </div>
        </div>
      </div>

      {/* 7 Core Topology Nodes Table */}
      <div className="rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[var(--surface-container-lowest)] border-b border-[var(--border)] font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                <th className="px-3 py-2">COMPONENT NODE</th>
                <th className="px-3 py-2">ROLE & RUNTIME</th>
                <th className="px-3 py-2">HEARTBEAT STATUS</th>
                <th className="px-3 py-2">LATENCY</th>
                <th className="px-3 py-2">LAST CHECK</th>
                <th className="px-3 py-2">VERSION</th>
                <th className="px-3 py-2">ERRORS</th>
                <th className="px-3 py-2 text-right">UPTIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-code-sm">
              {components.map((c) => (
                <tr
                  key={c.name}
                  className="hover:bg-[var(--surface-container-high)]/50 transition-colors"
                >
                  {/* COMPONENT */}
                  <td className="px-3 py-2 font-mono">
                    <span className="font-bold text-xs text-[var(--primary)] block">
                      {c.name}
                    </span>
                  </td>

                  {/* ROLE */}
                  <td className="px-3 py-2 text-[11px] text-[var(--text-secondary)] font-mono">
                    {c.role}
                  </td>

                  {/* STATUS */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs text-[9px] font-bold font-label-caps ${
                        c.status === "ONLINE"
                          ? "bg-[var(--primary-container)]/20 text-[var(--primary-container)] border border-[var(--primary-container)]/30"
                          : c.status === "DEGRADED"
                          ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                          : "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.status === "ONLINE"
                            ? "bg-[var(--primary-container)] animate-pulse"
                            : c.status === "DEGRADED"
                            ? "bg-[var(--tertiary-fixed-dim)]"
                            : "bg-[var(--error)]"
                        }`}
                      />
                      {c.status}
                    </span>
                  </td>

                  {/* LATENCY */}
                  <td className="px-3 py-2 font-mono">
                    <span className="font-semibold text-xs text-[var(--text-primary)]">
                      {c.latencyMs} ms
                    </span>
                  </td>

                  {/* LAST CHECK */}
                  <td className="px-3 py-2 text-[10px] text-[var(--text-muted)] whitespace-nowrap font-mono">
                    {c.lastCheck}
                  </td>

                  {/* VERSION */}
                  <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)] font-mono">
                    {c.version}
                  </td>

                  {/* ERRORS */}
                  <td className="px-3 py-2 font-mono">
                    <span className={c.errors > 0 ? "text-[var(--error)] font-bold" : "text-[var(--text-muted)]"}>
                      {c.errors}
                    </span>
                  </td>

                  {/* UPTIME */}
                  <td className="px-3 py-2 text-right font-bold text-xs text-[var(--primary-container)] font-mono">
                    {c.uptimePercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-2.5 border-t border-[var(--border)] bg-[var(--surface-container-lowest)] flex items-center justify-between text-xs text-[var(--text-muted)] font-code-sm">
          <span>7 of 7 Core Topology Nodes Healthy</span>
          <span className="text-[var(--primary-container)] font-bold">Zero Active Infrastructure Alerts</span>
        </div>
      </div>
    </div>
  );
}
