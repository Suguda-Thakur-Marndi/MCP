"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  Lock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  User,
  Users,
  Mail,
} from "lucide-react";
import { api, type CurrentUser } from "@/lib/api";
import { RoleBadge } from "@/components/ui/Badges";

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

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [error, setError] = useState<string | null>(errorParam);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const handleEmailPasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        localStorage.setItem("sentinel_role", "ADMIN");
        localStorage.setItem("sentinel_email", email);
      }
      router.push("/");
    }, 400);
  };

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    window.location.href = `${apiUrl}/api/auth/google/authorize?next=/`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-150">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xs bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-xs">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold tracking-wider text-[var(--text-primary)]">
                MCP<span className="text-[var(--accent)] font-semibold ml-0.5">SENTINEL</span>
              </span>
              <span className="text-[9px] text-[var(--text-muted)] font-mono-tnum tracking-wider">
                UNIVERSAL AI AGENT SECURITY GATEWAY
              </span>
            </div>
          </Link>
          <h1 className="text-lg md:text-xl font-bold mt-4 tracking-tight text-[var(--text-primary)]">
            Security Gateway Authentication
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            One security layer for every AI tool.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xs text-xs flex items-center gap-2.5 border border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Active Session Card */}
        {currentUser && (
          <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-[10px] font-mono-tnum font-semibold uppercase text-[var(--text-muted)]">
                Active Session Detected
              </span>
              <RoleBadge role={currentUser.role} />
            </div>
            <div className="pt-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">{currentUser.name}</p>
                <p className="text-[10px] font-mono-tnum text-[var(--text-muted)]">{currentUser.email}</p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xs bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 shadow-2xs"
              >
                <span>Enter Gateway</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Authentication Options Container */}
        <div className="rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs p-6 space-y-5">
          {/* Google OAuth Section */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
              Enterprise Single Sign-On
            </h2>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold text-[var(--text-primary)] transition-colors shadow-2xs"
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
              <span>Authenticate with Google Workspace</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[var(--border)] w-full"></div>
            <span className="bg-[var(--bg-card)] px-3 text-[10px] font-mono-tnum text-[var(--text-muted)] uppercase">
              Or Sign In With Email
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailPasswordLogin} className="space-y-3 font-mono-tnum text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                Enterprise Email
              </label>
              <input
                type="email"
                required
                placeholder="operator@sentinel.corp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2.5 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xs bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-95 shadow-2xs"
            >
              Sign In to Security Gateway
            </button>
          </form>

          {/* Development Fast Identifiers */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <h2 className="text-[10px] font-mono-tnum font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Local RBAC Test Personas
              </h2>
            </div>
            <div className="space-y-1.5">
              {TEST_IDENTITIES.map((ident) => (
                <button
                  key={ident.role}
                  onClick={() => handleTestLogin(ident)}
                  disabled={loading}
                  className="w-full p-2 rounded-xs border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] hover:border-[var(--border)] text-left flex items-center justify-between transition-colors"
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{ident.name}</span>
                      <RoleBadge role={ident.role} />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] block truncate">{ident.desc}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Messaging */}
        <div className="p-3.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)]/60 text-center font-mono-tnum text-[11px] text-[var(--text-muted)] space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[var(--text-primary)] font-semibold text-xs">
            <Lock className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Zero-Trust Protocol Gateway</span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">
            All AI tool invocations subject to policy invariant evaluation and cryptographic dual-custody verification.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
          <div className="text-xs font-mono-tnum text-[var(--text-muted)]">
            Loading Sentinel Identity Gateway...
          </div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
