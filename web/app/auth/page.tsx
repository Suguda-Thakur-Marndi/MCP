"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  LogOut,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { api, type CurrentUser, type HealthStatus } from "@/lib/api";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const nextParam = searchParams.get("next") || "/";

  const [error, setError] = useState<string | null>(() => {
    if (!errorParam) return null;
    switch (errorParam) {
      case "access_denied":
        return "Google sign-in was cancelled or access was denied.";
      case "invalid_state":
        return "Authentication security token expired or invalid. Please try again.";
      case "account_takeover_prevented":
        return "Account security conflict: An account with this email already exists under a different provider.";
      case "unverified_email":
        return "Your Google account email is not verified. Please verify your email first.";
      case "domain_restricted":
        return "Your email domain is not authorized for this SentinelCore workspace.";
      default:
        return `Authentication failed: ${errorParam}`;
    }
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const [devLoginLoading, setDevLoginLoading] = useState<string | null>(null);
  const [showDevPersonas, setShowDevPersonas] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    // 1. Check if returning from Google OAuth with a session token in fragment
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash && hash.includes("session_token=")) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const token = params.get("session_token");
        if (token) {
          localStorage.setItem("sentinel_token", token);
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          api.auth
            .me()
            .then((user) => {
              if (!active) return;
              setCurrentUser(user);
              localStorage.setItem("sentinel_role", user.role);
              localStorage.setItem("sentinel_email", user.email);
              router.push(nextParam);
            })
            .catch(() => {
              if (active) {
                setError("Failed to initialize session after Google authentication.");
              }
            });
          return;
        }
      }
    }

    // 2. Query real current session status (only genuine backend sessions)
    api.auth
      .me()
      .then((user) => {
        if (active) setCurrentUser(user);
      })
      .catch(() => {
        if (active) setCurrentUser(null);
      });

    // 3. Query real backend operational health
    api
      .healthReady()
      .then((res) => {
        if (active) setHealth(res);
      })
      .catch(() => {
        if (active) {
          setHealth({
            status: "unreachable",
            database: "disconnected",
            service: "sentinelcore",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [router, nextParam]);

  const handleGoogleLogin = () => {
    setIsRedirecting(true);
    setError(null);
    try {
      window.location.href = api.auth.loginUrl(nextParam);
    } catch {
      setIsRedirecting(false);
      setError("Failed to construct Google OAuth authorization URL.");
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await api.auth.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sentinel_token");
        localStorage.removeItem("sentinel_role");
        localStorage.removeItem("sentinel_email");
      }
      setCurrentUser(null);
      setSigningOut(false);
    }
  };

  // Legitimate dev test login via POST /api/auth/login (only active in non-production)
  const handleDevTokenLogin = async (role: string, email: string) => {
    setDevLoginLoading(role);
    setError(null);
    try {
      const testToken = `test-token:${email}:${role}`;
      const res = await api.auth.loginWithToken(testToken);
      if (res && res.access_token) {
        localStorage.setItem("sentinel_token", res.access_token);
        localStorage.setItem("sentinel_role", res.user.role);
        localStorage.setItem("sentinel_email", res.user.email);
        setCurrentUser(res.user);
        router.push(nextParam);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Development authentication failed.";
      setError(msg);
    } finally {
      setDevLoginLoading(null);
    }
  };

  const isBackendHealthy = health?.status === "ready" || health?.status === "healthy";
  const isDbConnected = health?.database === "connected";
  const isDevEnvironment = health?.environment !== "production";

  return (
    <div className="w-full max-w-[440px] mx-auto antialiased">
      {/* Main Architectural Authentication Card */}
      <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--border)] p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xs">
        {/* Top hairline indicator */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent" />

        {/* Header & Identity Section */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--surface-container)] flex items-center justify-center mb-3.5 border border-[var(--border)] shadow-xs">
            <Shield className="w-6 h-6 text-[var(--primary)]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--surface-container-low)] text-[var(--on-surface-variant)] font-mono text-[10px] uppercase tracking-wider mb-2.5 border border-[var(--border)]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendHealthy ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{isBackendHealthy ? "GATEWAY OPERATIONAL" : "CONNECTING TO GATEWAY"}</span>
          </div>

          <h1 className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-[var(--on-surface)]">
            SENTINELCORE
          </h1>
          <p className="font-sans text-xs sm:text-sm text-[var(--on-surface-variant)] mt-1 max-w-[320px] leading-relaxed">
            AI Security &amp; Approval Platform
          </p>
          <p className="font-mono text-[10px] text-[var(--primary)] mt-1.5 uppercase tracking-wider">
            Secure AI Agents. Controlled Actions. Trusted Execution.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--error-container)]/20 border border-[var(--error)]/30 text-[var(--error)] font-mono text-xs flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* Genuine Active Session Box (Rendered only when confirmed by backend) */}
        {currentUser && currentUser.is_active && (
          <div className="mt-5 p-3.5 rounded-xl bg-[var(--surface-container-low)] border border-[var(--border)] text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] uppercase text-[var(--on-surface-variant)] font-semibold tracking-wider">
                Active Session Detected
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified</span>
              </span>
            </div>
            <div className="font-sans font-semibold text-sm text-[var(--on-surface)] truncate">
              {currentUser.name || currentUser.email}
            </div>
            <div className="font-mono text-xs text-[var(--on-surface-variant)] truncate mt-0.5">
              {currentUser.email} • Role:{" "}
              <span className="text-[var(--primary)] font-semibold">{currentUser.role}</span>
            </div>
            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(nextParam)}
                className="flex-1 h-9 px-3 bg-[var(--primary)] hover:bg-[var(--primary)]/90 active:bg-[var(--primary)] text-[var(--on-primary)] font-sans font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Enter Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="h-9 px-3 bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] font-mono text-xs rounded-lg transition-colors border border-[var(--border)] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {signingOut ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Security Perimeter Notice */}
        <div className="mt-5 p-3 rounded-lg bg-[var(--surface-container-low)] border border-[var(--border)] flex items-start gap-2.5 text-left">
          <Lock className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
          <div className="text-left">
            <div className="font-mono text-[11px] font-semibold text-[var(--on-surface)] uppercase tracking-wider">
              Enterprise Security Perimeter
            </div>
            <p className="font-sans text-[12px] text-[var(--on-surface-variant)] mt-0.5 leading-relaxed">
              Authentication enforced via OAuth 2.0 / OpenID Connect with PKCE. All tool dispatches,
              approval requests, and policy decisions are immutably audit-logged.
            </p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="mt-5 space-y-3">
          {/* Primary Action: Continue with Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isRedirecting}
            className="w-full h-11 px-4 bg-white hover:bg-neutral-100 active:bg-neutral-200 text-neutral-900 font-sans font-medium text-sm rounded-lg flex items-center justify-between transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--background)] cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            id="btn-google-login"
          >
            <div className="flex items-center gap-3">
              {isRedirecting ? (
                <RefreshCw className="w-4 h-4 text-neutral-700 animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
              )}
              <span className="font-semibold text-neutral-900 tracking-tight">
                {isRedirecting ? "Connecting to Google..." : "Continue with Google"}
              </span>
            </div>
            <span className="font-mono text-[10px] bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
              OIDC
            </span>
          </button>

          {/* Development / Test Mode Fast-Sign-In (Only rendered in non-production environments) */}
          {isDevEnvironment && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowDevPersonas(!showDevPersonas)}
                className="w-full py-2 px-3 bg-[var(--surface-container-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] text-xs font-mono rounded-lg flex items-center justify-between border border-[var(--border)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                  <span>Development Test Credentials</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    showDevPersonas ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showDevPersonas && (
                <div className="mt-2 p-2.5 rounded-lg bg-[var(--surface-container-low)] border border-[var(--border)] space-y-1.5 font-mono text-xs">
                  <div className="text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wider px-1">
                    Authenticates via backend POST /api/auth/login:
                  </div>
                  {[
                    { role: "ADMIN", name: "Security Administrator", email: "admin@sentinel.test" },
                    { role: "APPROVER", name: "Authorizing Officer", email: "approver@sentinel.test" },
                    { role: "OPERATOR", name: "System Operator", email: "operator@sentinel.test" },
                    { role: "VIEWER", name: "Compliance Auditor", email: "viewer@sentinel.test" },
                  ].map((id) => (
                    <button
                      key={id.role}
                      type="button"
                      disabled={Boolean(devLoginLoading)}
                      onClick={() => handleDevTokenLogin(id.role, id.email)}
                      className="w-full p-2 rounded bg-[var(--surface-container-lowest)] hover:bg-[var(--surface-container)] border border-[var(--border)] text-left flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div>
                        <div className="font-sans font-medium text-[var(--on-surface)] text-xs">
                          {id.name}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--on-surface-variant)]">
                          {id.email}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-container)] text-[var(--primary)] font-bold">
                        {devLoginLoading === id.role ? "Signing in..." : id.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Real Live Backend Telemetry Indicator (Ground truth from /api/health/ready) */}
      <div className="mt-4 p-2.5 rounded-lg bg-[var(--surface-container-low)] border border-[var(--border)] text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--on-surface-variant)]">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isBackendHealthy ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span>Gateway: {isBackendHealthy ? "Online" : "Connecting"}</span>
          </div>
          <span className="text-[var(--border)]">•</span>
          <div className="flex items-center gap-1">
            <span>Database:</span>
            <span
              className={
                isDbConnected
                  ? "text-emerald-400 font-medium"
                  : "text-amber-400 font-medium"
              }
            >
              {isDbConnected ? "Supabase Connected" : "Connecting"}
            </span>
          </div>
          <span className="text-[var(--border)]">•</span>
          <div className="flex items-center gap-1">
            <span>Auth:</span>
            <span className="text-[var(--primary)] font-medium">Google OIDC</span>
          </div>
        </div>
      </div>

      {/* Administrative Standards & System Health Link */}
      <div className="mt-3.5 flex items-center justify-between px-1 font-mono text-[11px] text-[var(--on-surface-variant)]">
        <span>NIST SP 800-207 Zero-Trust</span>
        <Link
          className="hover:text-[var(--primary)] transition-colors flex items-center gap-1"
          href="/health"
        >
          <span>System Health</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[300px] flex items-center justify-center font-mono text-xs text-[var(--on-surface-variant)]">
          Loading authentication gateway...
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
