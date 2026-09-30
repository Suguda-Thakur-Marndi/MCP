"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertTriangle,
  KeyRound,
  Check,
  Cpu,
  Layers,
  Terminal,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";
import { RoleBadge } from "@/components/ui/Badges";
import { BorderBeam } from "@/components/ui/BorderBeam";

const TEST_IDENTITIES = [
  {
    role: "ADMIN",
    name: "Security Admin",
    email: "admin@sentinel.test",
    desc: "Full administrative oversight, approvals, and policy management",
  },
  {
    role: "APPROVER",
    name: "Authorizing Officer",
    email: "approver@sentinel.test",
    desc: "Authorized to review and sign dual-custody gated operations",
  },
  {
    role: "SECURITY_ANALYST",
    name: "Security Auditor",
    email: "analyst@sentinel.test",
    desc: "Audit logs inspection and automated attack evaluation runs",
  },
  {
    role: "OPERATOR",
    name: "System Operator",
    email: "operator@sentinel.test",
    desc: "Interactive agent usage and standard tool dispatches",
  },
  {
    role: "VIEWER",
    name: "Compliance Auditor",
    email: "viewer@sentinel.test",
    desc: "Read-only access to dashboard metrics and tool registry",
  },
];

function InteractiveTelemetryCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.02;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Draw subtle concentric telemetry rings
      ctx.strokeStyle = "rgba(209, 206, 199, 0.08)";
      ctx.lineWidth = 1;
      for (let r = 40; r <= 140; r += 30) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw 3 pipeline nodes (Agent -> Gate -> MCP)
      const nodes = [
        { label: "AGENT", x: cx - 110, y: cy, color: "#3A8A7F" },
        { label: "SECURITY GATE", x: cx, y: cy, color: "#D05A40" },
        { label: "FAST-MCP", x: cx + 110, y: cy, color: "#E3A03E" },
      ];

      // Draw connecting conduit lines
      ctx.strokeStyle = "rgba(209, 206, 199, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      ctx.lineTo(nodes[2].x, nodes[2].y);
      ctx.stroke();

      // Animated packet moving along conduit
      const packetPhase = (t % 2) / 2; // 0 to 1
      const packetX = nodes[0].x + packetPhase * (nodes[2].x - nodes[0].x);
      ctx.fillStyle = packetPhase < 0.5 ? "#3A8A7F" : "#D05A40";
      ctx.beginPath();
      ctx.arc(packetX, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw nodes
      nodes.forEach((n, idx) => {
        const pulse = Math.sin(t * 2 + idx) * 2;
        ctx.fillStyle = "#131B27";
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.arc(n.x, n.y, 16 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Node center pip
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillStyle = "#A3A099";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y + 32);
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="w-full h-44 rounded-xl bg-[#131B27]/80 border border-[#26344A] p-2 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[9px] font-mono text-[#76736C]">
        <Terminal className="w-3 h-3 text-[#D05A40]" />
        <span>GATEWAY_INTERCEPTOR_BUS</span>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={160}
        className="w-full h-full max-w-[360px] max-h-[160px]"
      />
    </div>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [error, setError] = useState<string | null>(errorParam);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.auth
      .me()
      .then((user) => setCurrentUser(user))
      .catch(() => setCurrentUser(null));
  }, []);

  const handleTestLogin = (identity: (typeof TEST_IDENTITIES)[0]) => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("sentinel_role", identity.role);
        localStorage.setItem("sentinel_email", identity.email);
        localStorage.removeItem("sentinel_token");
      }
      setTimeout(() => {
        router.push("/");
      }, 250);
    } catch {
      setError("Failed to initialize session identity");
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    window.location.href = `${apiUrl}/api/auth/google/authorize?next=/`;
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] dark:bg-[#101722] text-[#1A202E] dark:text-slate-100 flex items-stretch">
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* Left Editorial Branding Panel (Hidden on small mobile, visible lg+) */}
        <div className="lg:col-span-5 bg-[#131B27] border-r border-[#26344A] p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle architectural background grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#26344A_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

          {/* Top Brand Monogram */}
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-[#D05A40] flex items-center justify-center font-bold text-white text-sm shadow-md ring-1 ring-white/20">
                MS
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-wider text-slate-100">
                  MCP-<span className="text-[#D05A40]">SENTINEL</span>
                </span>
                <span className="text-[10px] text-[#A3A099] font-mono tracking-widest uppercase">
                  Architectural Intelligence
                </span>
              </div>
            </Link>
          </div>

          {/* Central Editorial Statement */}
          <div className="relative z-10 py-10 space-y-6">
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D05A40] font-semibold">
                Autonomous AI Defense
              </span>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-100 leading-tight">
                Architectural Intelligence for Autonomous Systems
              </h1>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-sans max-w-md">
                Deterministic security gateways, SHA-256 parameter seal checks, and dual-custody approval ticketing for model tool dispatches.
              </p>
            </div>

            {/* Interactive Telemetry Canvas Centerpiece */}
            <InteractiveTelemetryCanvas />
          </div>

          {/* Invariant Footer Callout */}
          <div className="relative z-10 pt-6 border-t border-[#26344A]/80 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3A8A7F]" />
              <span className="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">Zero-Trust Invariant</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Every destructive MCP tool execution requires cryptographic parameter verification before dispatch.
            </p>
          </div>
        </div>

        {/* Right Authentication Panel */}
        <div className="lg:col-span-7 bg-[#F8F6F0] dark:bg-[#17202E] p-6 sm:p-10 md:p-14 flex flex-col justify-center items-center">
          <div className="w-full max-w-md space-y-6">

            {/* Mobile Brand Header */}
            <div className="lg:hidden text-center mb-4">
              <Link href="/" className="inline-flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[#D05A40] text-white font-bold text-xs flex items-center justify-center">
                  MS
                </div>
                <span className="text-sm font-bold text-[#1A202E] dark:text-slate-100">
                  MCP-SENTINEL
                </span>
              </Link>
            </div>

            {/* Title Section */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#76736C] dark:text-slate-400 mb-1">
                Access Gateway
              </div>
              <h2 className="text-2xl font-serif font-bold text-[#1A202E] dark:text-slate-100 tracking-tight">
                Authenticate Session
              </h2>
              <p className="text-xs text-[#76736C] dark:text-slate-400 mt-1">
                Sign in with enterprise SSO or simulate an authorized security persona.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 rounded-lg text-xs flex items-center gap-2.5 border border-[#D64541]/40 bg-[#D64541]/10 text-[#D64541]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Active Session Detected Card */}
            {currentUser && (
              <div className="p-4 rounded-xl bg-[#EFECE6] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A] shadow-sm space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-[#D1CEC7] dark:border-[#26344A]">
                  <span className="text-[10px] font-mono font-semibold uppercase text-[#76736C] dark:text-slate-400">
                    Active Session Detected
                  </span>
                  <RoleBadge role={currentUser.role} />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-xs font-semibold text-[#1A202E] dark:text-slate-100">{currentUser.name}</p>
                    <p className="text-[11px] font-mono text-[#76736C] dark:text-slate-400">{currentUser.email}</p>
                  </div>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#D05A40] hover:bg-[#B84B33] text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    <span>Enter Gateway</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Main Auth Form Container */}
            <div className="relative overflow-hidden rounded-2xl bg-[#F8F6F0] dark:bg-[#131B27] border border-[#D1CEC7] dark:border-[#26344A] shadow-lg p-6 space-y-6">
              <BorderBeam size={220} duration={12} colorFrom="#D05A40" colorTo="#3A8A7F" />

              {/* Google Workspace SSO */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#76736C] dark:text-slate-400 block mb-2 font-semibold">
                  Enterprise Single Sign-On
                </span>
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[#D1CEC7] dark:border-[#26344A] bg-[#EFECE6] dark:bg-[#17202E] hover:bg-[#E2DFD7] dark:hover:bg-[#1E293B] text-xs font-bold transition-all shadow-sm text-[#1A202E] dark:text-slate-100"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google Workspace</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#D1CEC7] dark:border-[#26344A]" />
                </div>
                <span className="relative px-3 bg-[#F8F6F0] dark:bg-[#131B27] text-[10px] font-mono uppercase text-[#76736C] dark:text-slate-400">
                  Or simulate operational role
                </span>
              </div>

              {/* Persona Selector Cards */}
              <div className="space-y-2">
                {TEST_IDENTITIES.map((id) => (
                  <button
                    key={id.role}
                    onClick={() => handleTestLogin(id)}
                    disabled={loading}
                    className="w-full p-3 rounded-lg border border-[#D1CEC7] dark:border-[#26344A] hover:border-[#D05A40] dark:hover:border-[#D05A40] bg-[#EFECE6]/70 dark:bg-[#17202E]/70 hover:bg-[#EAE6DE] dark:hover:bg-[#1E293B] text-left transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <div className="truncate pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1A202E] dark:text-slate-100 group-hover:text-[#D05A40] transition-colors">
                          {id.name}
                        </span>
                        <RoleBadge role={id.role} />
                      </div>
                      <p className="text-[11px] text-[#76736C] dark:text-slate-400 truncate mt-0.5 font-mono">
                        {id.email}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#76736C] dark:text-slate-500 group-hover:text-[#D05A40] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Invariant Footer Badges */}
            <div className="text-center space-y-2 pt-2">
              <div className="flex items-center justify-center gap-3 text-[11px] font-mono text-[#76736C] dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-[#3A8A7F]" />
                  HttpOnly Secure Session
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-[#D05A40]" />
                  HS256 Gated
                </span>
              </div>
              <p className="text-[10px] text-[#76736C] dark:text-slate-500">
                MCP-Sentinel FastMCP Zero-Trust Gateway Interceptor
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8F6F0] dark:bg-[#101722] flex items-center justify-center p-4">
          <div className="text-xs font-mono text-[#76736C] dark:text-slate-400 animate-pulse">
            INITIALIZING SECURITY GATEWAY...
          </div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
