"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck,
  Bot,
  Wrench,
  UserCheck,
  Database,
  Lock,
  Radio,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import { BorderBeam } from "../ui/BorderBeam";

interface NodeTelemetry {
  id: string;
  name: string;
  category: string;
  status: "ONLINE" | "SECURED" | "GATED" | "ACTIVE";
  icon: React.ElementType;
  details: string;
  securityInvariant: string;
  latency: string;
  color: "cyan" | "violet" | "emerald" | "amber";
}

const NODES: NodeTelemetry[] = [
  {
    id: "agent",
    name: "AI Reasoning Agent",
    category: "LLM EXECUTION",
    status: "ACTIVE",
    icon: Bot,
    details: "Google Gemini 2.5 Flash under continuous LangGraph supervision.",
    securityInvariant: "Real-time prompt injection & data leak filtering.",
    latency: "340ms",
    color: "cyan",
  },
  {
    id: "mcp",
    name: "FastMCP Server",
    category: "TOOL BUS",
    status: "SECURED",
    icon: Wrench,
    details: "Authoritative in-process provider hosting 6 enterprise tools.",
    securityInvariant: "Pre-execution hook parameter schema validation.",
    latency: "0.8ms",
    color: "emerald",
  },
  {
    id: "approvals",
    name: "Dual-Custody Gate",
    category: "GOVERNANCE",
    status: "GATED",
    icon: UserCheck,
    details: "Cryptographic human-in-the-loop authorization barrier.",
    securityInvariant: "SHA-256 parameter seal prevents in-flight tampering.",
    latency: "Async",
    color: "amber",
  },
  {
    id: "database",
    name: "Audit Ledger",
    category: "CRYPTOGRAPHIC LEDGER",
    status: "ONLINE",
    icon: Database,
    details: "PostgreSQL 16 tamper-evident record store with signed events.",
    securityInvariant: "Immutable append-only replay verification.",
    latency: "1.4ms",
    color: "violet",
  },
];

export function SecurityCore3D({
  systemHealthy = true,
  pendingCount = 0,
  blockedCount = 0,
  toolCount = 6,
}: {
  systemHealthy?: boolean;
  pendingCount?: number;
  blockedCount?: number;
  toolCount?: number;
}) {
  const [selectedNode, setSelectedNode] = useState<NodeTelemetry>(NODES[0]);
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tiltEnabled, setTiltEnabled] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltEnabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 35;
    const y = (e.clientY - rect.top - rect.height / 2) / 35;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div className="relative rounded-xl border border-[#243044] bg-[#0B0F14] overflow-hidden shadow-2xl">
      {/* Magic UI Border Beam on the container */}
      <BorderBeam size={320} duration={14} colorFrom="#38BDF8" colorTo="#818CF8" />

      {/* Ambient Radial Lights */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />

      {/* Card Header & Controls */}
      <div className="relative z-10 p-4 sm:p-5 border-b border-[#243044] bg-[#0F172A]/70 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Cryptographic Perimeter & Topology
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE 3D HUD
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Dimensional spatial model of MCP-Sentinel security gateway, connected actors, and enforcement boundaries.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setTiltEnabled(!tiltEnabled)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors border ${
              tiltEnabled
                ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
            title="Toggle 3D spatial perspective mouse tilt"
          >
            3D Tilt: {tiltEnabled ? "ON" : "OFF"}
          </button>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111827] border border-[#243044] text-[11px] font-mono text-slate-400">
            <Lock className="w-3 h-3 text-cyan-400" />
            Zero-Trust Intercept
          </span>
        </div>
      </div>

      {/* Main 3D Topology Stage */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative py-8 px-4 sm:py-12 sm:px-8 cyber-grid flex flex-col lg:flex-row items-center justify-between gap-8 [perspective:1200px] overflow-hidden min-h-[460px]"
      >
        {/* Visual 3D Spatial Canvas */}
        <div
          className="relative w-full max-w-xl aspect-[4/3] flex items-center justify-center transition-transform duration-300 ease-out select-none [transform-style:preserve-3d]"
          style={{
            transform: tiltEnabled
              ? `rotateY(${tilt.x}deg) rotateX(${-tilt.y}deg)`
              : "none",
          }}
        >
          {/* Cybernetic Orbital Ring Outer */}
          <div className="absolute w-72 h-72 sm:w-88 sm:h-88 rounded-full border border-dashed border-cyan-500/20 animate-spin-slow pointer-events-none" />

          {/* Cybernetic Orbital Ring Inner */}
          <div className="absolute w-56 h-56 sm:w-68 sm:h-68 rounded-full border border-slate-700/60 animate-spin-reverse-slow pointer-events-none" />

          {/* SVG Animated Beams connecting nodes to central core */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 500 400">
            <defs>
              <linearGradient id="beam-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#818CF8" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="beam-emerald" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#34D399" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="beam-amber" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="beam-violet" x1="100%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Top-Left: Agent -> Core */}
            <path
              d="M 90 70 Q 180 140 250 200"
              fill="none"
              stroke="url(#beam-cyan)"
              strokeWidth="2"
              className="animate-beam-flow"
            />
            {/* Top-Right: FastMCP -> Core */}
            <path
              d="M 410 70 Q 320 140 250 200"
              fill="none"
              stroke="url(#beam-emerald)"
              strokeWidth="2"
              className="animate-beam-flow"
            />
            {/* Bottom-Left: Human Gate -> Core */}
            <path
              d="M 90 330 Q 180 260 250 200"
              fill="none"
              stroke="url(#beam-amber)"
              strokeWidth="2"
              className="animate-beam-flow"
            />
            {/* Bottom-Right: Ledger -> Core */}
            <path
              d="M 410 330 Q 320 260 250 200"
              fill="none"
              stroke="url(#beam-violet)"
              strokeWidth="2"
              className="animate-beam-flow"
            />
          </svg>

          {/* Central 3D Security Core Shield (High Elevation) */}
          <div
            className="relative z-20 flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-[#1E293B] via-[#0F172A] to-[#0A0E17] border-2 border-cyan-500/50 shadow-[0_0_50px_rgba(56,189,248,0.25)] [transform:translateZ(45px)] group cursor-pointer hover:border-cyan-400 transition-all"
            onClick={() =>
              setSelectedNode({
                id: "core",
                name: "MCP-Sentinel Security Gateway",
                category: "CENTRAL INTERCEPTOR",
                status: "SECURED",
                icon: ShieldCheck,
                details: "Cryptographic policy enforcement gate intercepting every agent tool invocation.",
                securityInvariant: "Inviolable pre-hook authorization barrier with SHA-256 seal.",
                latency: "<0.4ms",
                color: "cyan",
              })
            }
          >
            {/* Holographic icon container */}
            <div className="relative w-16 h-16 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-600 to-indigo-600 p-[1.5px] shadow-lg shadow-cyan-500/30 mb-2">
              <div className="w-full h-full rounded-[10px] bg-[#0A0E17] flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
              </div>
            </div>

            <span className="text-[11px] font-mono font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 uppercase">
              SECURITY CORE
            </span>
            <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              GATEWAY ENFORCED
            </span>
          </div>

          {/* Satellite Node 1: AI Reasoning Agent (Top-Left) */}
          <button
            onClick={() => setSelectedNode(NODES[0])}
            className={`absolute top-2 left-2 sm:top-6 sm:left-6 z-20 flex items-center gap-2 p-2.5 rounded-xl border transition-all [transform:translateZ(25px)] ${
              selectedNode.id === "agent"
                ? "bg-cyan-950/70 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.3)] scale-105"
                : "bg-[#111827]/90 border-[#243044] hover:border-slate-500 hover:bg-[#1A2332]"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Bot className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-mono text-slate-400 leading-tight">AI AGENT</p>
              <p className="text-xs font-bold text-slate-200">Gemini 2.5 Flash</p>
            </div>
          </button>

          {/* Satellite Node 2: FastMCP Server (Top-Right) */}
          <button
            onClick={() => setSelectedNode(NODES[1])}
            className={`absolute top-2 right-2 sm:top-6 sm:right-6 z-20 flex items-center gap-2 p-2.5 rounded-xl border transition-all [transform:translateZ(25px)] ${
              selectedNode.id === "mcp"
                ? "bg-emerald-950/70 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)] scale-105"
                : "bg-[#111827]/90 border-[#243044] hover:border-slate-500 hover:bg-[#1A2332]"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-mono text-slate-400 leading-tight">FASTMCP TOOLS</p>
              <p className="text-xs font-bold text-slate-200">{toolCount} Registered</p>
            </div>
          </button>

          {/* Satellite Node 3: Dual-Custody Approval (Bottom-Left) */}
          <button
            onClick={() => setSelectedNode(NODES[2])}
            className={`absolute bottom-2 left-2 sm:bottom-6 sm:left-6 z-20 flex items-center gap-2 p-2.5 rounded-xl border transition-all [transform:translateZ(25px)] ${
              selectedNode.id === "approvals"
                ? "bg-amber-950/70 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-105"
                : "bg-[#111827]/90 border-[#243044] hover:border-slate-500 hover:bg-[#1A2332]"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-mono text-slate-400 leading-tight">HUMAN GATING</p>
              <p className="text-xs font-bold text-slate-200">
                {pendingCount > 0 ? `${pendingCount} Pending` : "Dual-Custody"}
              </p>
            </div>
          </button>

          {/* Satellite Node 4: Audit Ledger (Bottom-Right) */}
          <button
            onClick={() => setSelectedNode(NODES[3])}
            className={`absolute bottom-2 right-2 sm:bottom-6 sm:right-6 z-20 flex items-center gap-2 p-2.5 rounded-xl border transition-all [transform:translateZ(25px)] ${
              selectedNode.id === "database"
                ? "bg-indigo-950/70 border-indigo-400 shadow-[0_0_20px_rgba(129,140,248,0.3)] scale-105"
                : "bg-[#111827]/90 border-[#243044] hover:border-slate-500 hover:bg-[#1A2332]"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-mono text-slate-400 leading-tight">AUDIT LEDGER</p>
              <p className="text-xs font-bold text-slate-200">PostgreSQL 16</p>
            </div>
          </button>
        </div>

        {/* Live HUD Telemetry Card (Right Panel) */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-3 z-10">
          <div className="p-4 rounded-xl bg-[#111827]/90 border border-[#243044] backdrop-blur relative shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#243044]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                  {selectedNode.category}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-200 border border-slate-700">
                {selectedNode.status}
              </span>
            </div>

            <div className="pt-3 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <selectedNode.icon className="w-4 h-4 text-cyan-400" />
                  {selectedNode.name}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {selectedNode.details}
                </p>
              </div>

              {/* Security Invariant Guarantee */}
              <div className="p-2.5 rounded-lg bg-[#0B0F14] border border-[#243044]">
                <span className="text-[10px] font-mono uppercase font-semibold text-cyan-400 block mb-1">
                  Active Security Invariant
                </span>
                <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  {selectedNode.securityInvariant}
                </p>
              </div>

              {/* Latency & Overhead stats */}
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Overhead</span>
                  <span className="text-emerald-400 font-bold">{selectedNode.latency}</span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Replay Defense</span>
                  <span className="text-sky-400 font-bold">1-Time Token</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-[#111827] border border-[#243044]">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">Blocked Actions</span>
              <span className="text-lg font-bold font-mono text-emerald-400">{blockedCount}</span>
              <span className="text-[10px] text-slate-500 block">Strictly Neutralized</span>
            </div>
            <div className="p-3 rounded-lg bg-[#111827] border border-[#243044]">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">System Integrity</span>
              <span className="text-lg font-bold font-mono text-cyan-400">100%</span>
              <span className="text-[10px] text-slate-500 block">Invariance Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
