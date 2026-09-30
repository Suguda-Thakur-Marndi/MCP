"use client";

import React, { useState, useRef } from "react";
import {
  ShieldCheck,
  Bot,
  Wrench,
  UserCheck,
  Database,
  Lock,
  Radio,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Terminal,
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
  color: "burnt" | "teal" | "amber" | "slate";
}

const NODES: NodeTelemetry[] = [
  {
    id: "agent",
    name: "AI Reasoning Agent",
    category: "LLM INFERENCE NODE",
    status: "ACTIVE",
    icon: Bot,
    details: "Google Gemini 2.5 Flash under continuous LangGraph supervision.",
    securityInvariant: "Real-time prompt injection & data leak filtering.",
    latency: "340ms",
    color: "burnt",
  },
  {
    id: "mcp",
    name: "FastMCP Tool Bus",
    category: "HOST PROVIDER",
    status: "SECURED",
    icon: Wrench,
    details: "Authoritative in-process provider hosting enterprise MCP tools.",
    securityInvariant: "Pre-execution hook parameter schema validation.",
    latency: "0.8ms",
    color: "teal",
  },
  {
    id: "approvals",
    name: "Dual-Custody Gate",
    category: "HUMAN GOVERNANCE",
    status: "GATED",
    icon: UserCheck,
    details: "Cryptographic human-in-the-loop authorization barrier.",
    securityInvariant: "SHA-256 parameter seal prevents in-flight tampering.",
    latency: "Async",
    color: "amber",
  },
  {
    id: "database",
    name: "Tamper-Evident Ledger",
    category: "CRYPTOGRAPHIC AUDIT",
    status: "ONLINE",
    icon: Database,
    details: "PostgreSQL immutable append-only trail with signed events.",
    securityInvariant: "Cryptographic replay verification on all tool dispatches.",
    latency: "1.4ms",
    color: "slate",
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
    const x = (e.clientX - rect.left - rect.width / 2) / 28;
    const y = (e.clientY - rect.top - rect.height / 2) / 28;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div className="relative rounded-xl border border-[#D1CEC7] dark:border-[#26344A] bg-[#FFFFFF] dark:bg-[#131923] overflow-hidden shadow-lg transition-colors duration-200">
      {/* Precision Corner Rivets / Architectural Markings */}
      <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#D1CEC7] dark:bg-[#34445F]" />
      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#D1CEC7] dark:bg-[#34445F]" />
      <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-[#D1CEC7] dark:bg-[#34445F]" />
      <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-[#D1CEC7] dark:bg-[#34445F]" />

      {/* Subtle Border Beam with brand colors */}
      <BorderBeam size={320} duration={16} colorFrom="#D05A40" colorTo="#3A8A7F" />

      {/* Header Bar */}
      <div className="relative z-10 px-5 py-4 border-b border-[#D1CEC7] dark:border-[#26344A] bg-[#F8F6F0]/80 dark:bg-[#17202E]/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D05A40]/10 border border-[#D05A40]/30 flex items-center justify-center text-[#D05A40]">
            <Cpu className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#D05A40] font-semibold">
                The Security Machine
              </span>
              <span className="text-slate-400 dark:text-slate-600">|</span>
              <span className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] uppercase tracking-wide">
                Hardware Gating Engine
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/20 dark:text-[#4EA699] dark:border-[#3A8A7F]/40 font-bold">
                ENFORCED
              </span>
            </div>
            <p className="text-[11px] text-[#475063] dark:text-[#94A3B8]">
              Dimensional spatial core intercepting agent reasoning, MCP tool bus invocations, and cryptographic dual-custody gates.
            </p>
          </div>
        </div>

        {/* HUD Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setTiltEnabled(!tiltEnabled)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors border ${
              tiltEnabled
                ? "bg-[#D05A40]/15 border-[#D05A40]/40 text-[#D05A40]"
                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500"
            }`}
            title="Toggle 3D spatial perspective mouse tilt"
          >
            Spatial 3D: {tiltEnabled ? "ON" : "OFF"}
          </button>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#EFECE5] dark:bg-[#1A2436] border border-[#D1CEC7] dark:border-[#26344A] text-[11px] font-mono text-[#475063] dark:text-[#94A3B8]">
            <Lock className="w-3 h-3 text-[#3A8A7F]" />
            Zero-Trust Intercept
          </span>
        </div>
      </div>

      {/* Main 3D Topology Stage */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative py-8 px-4 sm:py-10 sm:px-6 arch-grid flex flex-col lg:flex-row items-center justify-between gap-8 [perspective:1200px] overflow-hidden min-h-[440px]"
      >
        {/* Visual 3D Spatial Canvas */}
        <div
          className="relative w-full max-w-lg aspect-[4/3] flex items-center justify-center transition-transform duration-200 ease-out select-none [transform-style:preserve-3d]"
          style={{
            transform: tiltEnabled
              ? `rotateY(${tilt.x}deg) rotateX(${-tilt.y}deg)`
              : "none",
          }}
        >
          {/* Outer Stator Plate with Brushed Metallic Border */}
          <div className="absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full border-2 border-dashed border-[#D05A40]/25 animate-spin-slow pointer-events-none" />

          {/* Inner Counter-Rotating Gear Ring */}
          <div className="absolute w-56 h-56 sm:w-64 sm:h-64 rounded-full border border-[#3A8A7F]/30 animate-spin-reverse-slow pointer-events-none" />

          {/* Architectural SVG Power Conduits & Telemetry Beams */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 500 400">
            <defs>
              <linearGradient id="beam-burnt" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D05A40" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#3A8A7F" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="beam-teal" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3A8A7F" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#D05A40" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="beam-amber" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#E3A03E" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#D05A40" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="beam-slate" x1="100%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#64748B" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3A8A7F" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Top-Left: Agent -> Core */}
            <path
              d="M 90 70 Q 180 140 250 200"
              fill="none"
              stroke="url(#beam-burnt)"
              strokeWidth="2"
              className="animate-beam-flow"
            />
            {/* Top-Right: FastMCP -> Core */}
            <path
              d="M 410 70 Q 320 140 250 200"
              fill="none"
              stroke="url(#beam-teal)"
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
              stroke="url(#beam-slate)"
              strokeWidth="2"
              className="animate-beam-flow"
            />
          </svg>

          {/* Central Mainframe Core Node ("The Security Machine Core") */}
          <div
            className="relative z-20 flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-[#242C3A] via-[#1A2230] to-[#121822] border-2 border-[#D05A40]/60 shadow-[0_0_40px_rgba(208,90,64,0.25)] [transform:translateZ(45px)] group cursor-pointer hover:border-[#D05A40] transition-all"
            onClick={() =>
              setSelectedNode({
                id: "core",
                name: "The Security Machine Core",
                category: "CENTRAL INTERCEPTOR",
                status: "SECURED",
                icon: ShieldCheck,
                details: "Precision-engineered cryptographic policy enforcement gateway intercepting every LLM tool invocation.",
                securityInvariant: "Inviolable pre-hook authorization barrier with SHA-256 seal.",
                latency: "<0.4ms",
                color: "burnt",
              })
            }
          >
            {/* Glass Orb Core with Pulsing Brand Light */}
            <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-[#D05A40]/30 to-[#3A8A7F]/30 border border-[#D05A40]/50 flex items-center justify-center text-white mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-8 h-8 text-[#D05A40] group-hover:text-white transition-colors" />
              <div className="absolute inset-0 rounded-xl bg-radial from-[#D05A40]/30 to-transparent blur-xs pointer-events-none" />
            </div>

            <div className="text-center">
              <div className="text-[10px] font-mono tracking-widest text-[#D05A40] font-bold uppercase">
                SECURITY CORE
              </div>
              <div className="text-xs font-bold text-[#F4F6F9] font-sans">
                FastMCP Gate
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3A8A7F] animate-ping" />
                <span className="text-[9px] font-mono text-[#3A8A7F]">
                  OPERATIONAL
                </span>
              </div>
            </div>
          </div>

          {/* Node 1: AI Reasoning Agent (Top-Left) */}
          <div
            className={`absolute top-4 left-4 z-20 p-3 rounded-xl border cursor-pointer transition-all duration-200 [transform:translateZ(30px)] ${
              selectedNode.id === "agent"
                ? "bg-[#D05A40]/15 border-[#D05A40] shadow-md shadow-[#D05A40]/20"
                : "bg-[#FFFFFF] dark:bg-[#17202E] border-[#D1CEC7] dark:border-[#26344A] hover:border-[#D05A40]/50"
            }`}
            onClick={() => setSelectedNode(NODES[0])}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#D05A40]/10 border border-[#D05A40]/30 flex items-center justify-center text-[#D05A40]">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[9px] font-mono text-[#D05A40] uppercase font-semibold">
                  AI AGENT
                </div>
                <div className="text-[11px] font-bold text-[#1A202E] dark:text-[#F4F6F9]">
                  Gemini 2.5 Flash
                </div>
              </div>
            </div>
          </div>

          {/* Node 2: FastMCP Tools (Top-Right) */}
          <div
            className={`absolute top-4 right-4 z-20 p-3 rounded-xl border cursor-pointer transition-all duration-200 [transform:translateZ(30px)] ${
              selectedNode.id === "mcp"
                ? "bg-[#3A8A7F]/15 border-[#3A8A7F] shadow-md shadow-[#3A8A7F]/20"
                : "bg-[#FFFFFF] dark:bg-[#17202E] border-[#D1CEC7] dark:border-[#26344A] hover:border-[#3A8A7F]/50"
            }`}
            onClick={() => setSelectedNode(NODES[1])}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#3A8A7F]/10 border border-[#3A8A7F]/30 flex items-center justify-center text-[#3A8A7F]">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[9px] font-mono text-[#3A8A7F] uppercase font-semibold">
                  FAST-MCP BUS
                </div>
                <div className="text-[11px] font-bold text-[#1A202E] dark:text-[#F4F6F9]">
                  {toolCount} Tools Active
                </div>
              </div>
            </div>
          </div>

          {/* Node 3: Dual-Custody Approval Gate (Bottom-Left) */}
          <div
            className={`absolute bottom-4 left-4 z-20 p-3 rounded-xl border cursor-pointer transition-all duration-200 [transform:translateZ(30px)] ${
              selectedNode.id === "approvals"
                ? "bg-[#E3A03E]/15 border-[#E3A03E] shadow-md shadow-[#E3A03E]/20"
                : "bg-[#FFFFFF] dark:bg-[#17202E] border-[#D1CEC7] dark:border-[#26344A] hover:border-[#E3A03E]/50"
            }`}
            onClick={() => setSelectedNode(NODES[2])}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#E3A03E]/10 border border-[#E3A03E]/30 flex items-center justify-center text-[#E3A03E]">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[9px] font-mono text-[#E3A03E] uppercase font-semibold">
                  APPROVAL GATE
                </div>
                <div className="text-[11px] font-bold text-[#1A202E] dark:text-[#F4F6F9]">
                  {pendingCount} Pending
                </div>
              </div>
            </div>
          </div>

          {/* Node 4: Audit Ledger (Bottom-Right) */}
          <div
            className={`absolute bottom-4 right-4 z-20 p-3 rounded-xl border cursor-pointer transition-all duration-200 [transform:translateZ(30px)] ${
              selectedNode.id === "database"
                ? "bg-[#3A8A7F]/15 border-[#3A8A7F] shadow-md shadow-[#3A8A7F]/20"
                : "bg-[#FFFFFF] dark:bg-[#17202E] border-[#D1CEC7] dark:border-[#26344A] hover:border-slate-500"
            }`}
            onClick={() => setSelectedNode(NODES[3])}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[9px] font-mono text-slate-500 uppercase font-semibold">
                  LEDGER STORE
                </div>
                <div className="text-[11px] font-bold text-[#1A202E] dark:text-[#F4F6F9]">
                  PostgreSQL 16
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Selected Telemetry Node Inspection HUD */}
        <div className="w-full lg:w-72 p-4 rounded-xl bg-[#F8F6F0] dark:bg-[#17202E] border border-[#D1CEC7] dark:border-[#26344A] flex flex-col justify-between space-y-3 shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#D1CEC7] dark:border-[#26344A]">
              <span className="text-[10px] font-mono uppercase text-[#D05A40] font-bold tracking-wider">
                Telemetry Readout
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-teal-50 text-[#2C6E65] border border-teal-300 dark:bg-[#3A8A7F]/20 dark:text-[#4EA699] dark:border-[#3A8A7F]/40">
                {selectedNode.status}
              </span>
            </div>

            <div className="mt-3 flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-[#FFFFFF] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A] text-[#D05A40]">
                <selectedNode.icon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#1A202E] dark:text-[#F4F6F9] font-sans">
                  {selectedNode.name}
                </h4>
                <span className="text-[10px] font-mono text-[#475063] dark:text-[#94A3B8]">
                  {selectedNode.category}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#475063] dark:text-[#94A3B8] mt-2.5 leading-relaxed">
              {selectedNode.details}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#D1CEC7] dark:border-[#26344A] text-[11px]">
            <div className="p-2 rounded bg-[#FFFFFF] dark:bg-[#131923] border border-[#D1CEC7] dark:border-[#26344A]">
              <span className="text-[9px] font-mono uppercase text-[#D05A40] block mb-0.5 font-bold">
                Security Invariant
              </span>
              <span className="text-[#1A202E] dark:text-slate-200 font-mono text-[10px]">
                {selectedNode.securityInvariant}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-[#475063] dark:text-[#94A3B8] px-1">
              <span>Latency:</span>
              <span className="font-mono-tnum font-bold text-[#1A202E] dark:text-[#F4F6F9]">
                {selectedNode.latency}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
