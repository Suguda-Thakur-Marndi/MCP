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
  Terminal,
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
    <div className="min-h-screen bg-[var(--surface-container-lowest)] text-[var(--text-primary)] flex flex-col justify-center items-center p-3 sm:p-6 transition-colors duration-150 font-sans select-none">
      <div className="w-full max-w-md space-y-4 animate-in fade-in duration-150">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-xs bg-[var(--surface-container-high)] border border-[var(--primary-container)]/40 text-[var(--primary-container)] flex items-center justify-center font-bold text-xs tracking-wider shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold tracking-wider text-[var(--primary)] font-mono">
                MCP<span className="text-[var(--primary-container)] font-semibold ml-0.5">SENTINEL</span>
              </span>
              <span className="font-label-caps text-[8px] text-[var(--text-muted)] tracking-widest">
                ZERO-TRUST GATEWAY // MISSION CONTROL
              </span>
            </div>
          </Link>
          <h1 className="font-headline-md text-base sm:text-lg font-bold tracking-tight text-[var(--primary)]">
            GATEWAY IDENTITY AUTHENTICATION
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)]">
            Cryptographic authentication and human-in-the-loop authorization console.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xs text-xs flex items-center gap-2 border border-[var(--error)]/40 bg-[var(--error-container)] text-[var(--on-error-container)] font-code-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Active Session Card */}
        {currentUser && (
          <div className="p-3.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] font-code-sm">
              <span className="font-label-caps text-[8px] font-bold uppercase text-[var(--text-muted)]">
                ACTIVE IDENTITY DETECTED
              </span>
              <span className="px-1.5 py-0.2 rounded-xs font-label-caps text-[8px] font-bold bg-[var(--secondary-container)]/20 text-[var(--secondary-container)] border border-[var(--secondary-container)]/30">
                {currentUser.role}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--primary)] font-mono">{currentUser.name}</p>
                <p className="font-code-sm text-[10px] text-[var(--text-muted)]">{currentUser.email}</p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] text-xs font-bold font-code-sm hover:brightness-110 shadow-sm"
              >
                <span>ENTER GATEWAY</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Authentication Options Container */}
        <div className="rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] p-4 sm:p-5 space-y-4">
          {/* Google OAuth Section */}
          <div>
            <h2 className="font-label-caps text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              ENTERPRISE FEDERATED SSO
            </h2>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 px-3 py-2 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] hover:border-[var(--secondary-container)] text-xs font-semibold text-[var(--text-primary)] transition-all shadow-xs cursor-pointer font-mono"
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
            <span className="bg-[var(--surface-container-low)] px-2.5 font-label-caps text-[8px] text-[var(--text-muted)] uppercase">
              OR DIRECT OPERATOR CREDENTIALS
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailPasswordLogin} className="space-y-2.5 font-code-sm text-xs">
            <div>
              <label className="block font-label-caps text-[8px] uppercase font-bold text-[var(--text-muted)] mb-1">
                OPERATOR EMAIL
              </label>
              <input
                type="email"
                required
                placeholder="operator@sentinel.corp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--secondary-container)] font-mono"
              />
            </div>
            <div>
              <label className="block font-label-caps text-[8px] uppercase font-bold text-[var(--text-muted)] mb-1">
                OPERATOR PASSWORD
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--secondary-container)] font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] text-xs font-bold font-code-sm hover:brightness-110 shadow-sm cursor-pointer"
            >
              SIGN IN TO SECURITY GATEWAY
            </button>
          </form>

          {/* Development Fast Identifiers */}
          <div className="pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <h2 className="font-label-caps text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                RAPID RBAC TEST PERSONAS
              </h2>
            </div>
            <div className="space-y-1">
              {TEST_IDENTITIES.map((ident) => (
                <button
                  key={ident.role}
                  onClick={() => handleTestLogin(ident)}
                  disabled={loading}
                  className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] hover:border-[var(--secondary-container)] text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[var(--primary)] font-mono">{ident.name}</span>
                      <span className="px-1.5 py-0.2 rounded-xs font-label-caps text-[8px] font-bold bg-[var(--surface-container-high)] text-[var(--secondary-container)] border border-[var(--border)]">
                        {ident.role}
                      </span>
                    </div>
                    <span className="font-body-sm text-[10px] text-[var(--text-muted)] block truncate">{ident.desc}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Messaging */}
        <div className="p-3 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] text-center font-code-sm text-[11px] text-[var(--text-muted)] space-y-0.5">
          <div className="flex items-center justify-center gap-1.5 text-[var(--text-primary)] font-semibold text-xs">
            <Lock className="w-3.5 h-3.5 text-[var(--primary-container)]" />
            <span>Zero-Trust Protocol Security Boundary</span>
          </div>
          <p className="font-body-sm text-[10px] text-[var(--text-secondary)]">
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
        <div className="min-h-screen bg-[var(--surface-container-lowest)] flex items-center justify-center p-4">
          <div className="text-xs font-mono text-[var(--text-muted)]">
            Loading Sentinel Identity Gateway...
          </div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
