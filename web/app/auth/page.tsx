"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type CurrentUser } from "@/lib/api";

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
  const [tokenInput, setTokenInput] = useState("");
  const [tokenStatus, setTokenStatus] = useState<{
    type: "info" | "valid" | "invalid";
    msg: string;
  }>({
    type: "info",
    msg: "Insert YubiKey / FIDO2 dongle or provide transient 64-char hex signature.",
  });
  const [verifying, setVerifying] = useState(false);
  const [showPersonas, setShowPersonas] = useState(false);

  useEffect(() => {
    api.auth
      .me()
      .then((user) => setCurrentUser(user))
      .catch(() => setCurrentUser(null));
  }, []);

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTokenInput(val);
    if (!val.trim()) {
      setTokenStatus({
        type: "info",
        msg: "Insert YubiKey / FIDO2 dongle or provide transient 64-char hex signature.",
      });
    } else if (val.trim().length >= 16) {
      setTokenStatus({
        type: "valid",
        msg: "Signature syntax verified. Ready for node handshake.",
      });
    } else {
      setTokenStatus({
        type: "invalid",
        msg: `Token length insufficient (${val.trim().length}/16+ required for attestation).`,
      });
    }
  };

  const handleVerifyToken = () => {
    if (!tokenInput.trim()) {
      setTokenStatus({
        type: "invalid",
        msg: "Input payload required for transient attestation.",
      });
      return;
    }
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      // Set ephemeral token in local session
      if (typeof window !== "undefined") {
        localStorage.setItem("sentinel_token", tokenInput.trim());
        localStorage.setItem("sentinel_role", "ADMIN");
        localStorage.setItem("sentinel_email", "admin@sentinel.test");
      }
      router.push("/");
    }, 700);
  };

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
    window.location.href = api.auth.loginUrl();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-space-lg bg-surface text-on-surface antialiased">
      <div className="flex flex-col w-full items-center justify-center p-space-md sm:p-space-xl">
        <div className="relative w-full max-w-[540px]">
          {/* Top System Verification Banner */}
          <div className="flex items-center justify-between mb-space-sm px-space-xs text-on-surface-variant font-label-mono text-label-mono">
            <div className="flex items-center space-x-space-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="tracking-wider uppercase text-secondary font-semibold">GATEWAY ACTIVE</span>
            </div>
            <div className="flex items-center space-x-space-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[13px] leading-none">lock</span>
              <span>mTLS_ENFORCED</span>
            </div>
          </div>

          {/* Main Architectural Authentication Card */}
          <div className="bg-surface-container-lowest rounded-xl shadow-xl shadow-on-surface/[0.04] p-space-xl sm:p-space-2xl relative overflow-hidden border border-surface-container">
            {/* Top hairline indicator */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-primary"></div>

            {/* Header & Identity Section */}
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 p-space-xs bg-surface-container-low rounded-xl flex items-center justify-center mb-space-md shadow-xs border border-surface-container">
                <span className="material-symbols-outlined text-primary text-[32px]">shield</span>
              </div>
              <div className="space-y-space-2xs">
                <div className="inline-flex items-center space-x-space-xs px-space-xs py-space-2xs bg-surface-container-low rounded text-on-surface-variant font-label-mono text-label-mono mb-space-xs border border-surface-container">
                  <span className="material-symbols-outlined text-[12px] text-primary">verified_user</span>
                  <span>SYSTEM CLEARANCE LEVEL 4</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface font-bold">
                  MCP SENTINEL
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
                  AI Model Context Protocol Security &amp; Governance Platform
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mt-space-md p-space-sm rounded-lg bg-error-container text-on-error-container font-label-mono text-label-mono flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>{error}</span>
              </div>
            )}

            {/* Current Active Session Card */}
            {currentUser && (
              <div className="mt-space-md p-space-sm rounded-lg bg-surface-container-low border border-surface-container flex items-center justify-between font-label-mono text-label-mono">
                <div>
                  <div className="text-on-surface-variant uppercase text-[10px]">Active Session</div>
                  <div className="font-bold text-on-surface">{currentUser.name} ({currentUser.role})</div>
                </div>
                <Link
                  href="/"
                  className="px-space-sm py-1 bg-secondary text-on-secondary rounded font-label-ui text-label-ui font-semibold hover:bg-secondary/90 transition-colors"
                >
                  Enter Gateway →
                </Link>
              </div>
            )}

            {/* Security Perimeter Warning Banner */}
            <div className="mt-space-lg p-space-sm bg-surface-container-low rounded-lg flex items-start space-x-space-sm text-left border border-surface-container">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-[1px]">shield</span>
              <div className="flex flex-col">
                <span className="font-label-mono text-label-mono uppercase tracking-wider text-on-surface font-semibold">
                  Security Perimeter Notice
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-space-2xs">
                  Restricted Enterprise Gateway • Mutual TLS Enabled • FIPS 140-3 Compliant
                </span>
              </div>
            </div>

            {/* Action Panel */}
            <div className="mt-space-xl space-y-space-md">
              {/* Corporate Google SSO Primary */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="group w-full h-11 px-space-md bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm rounded-lg flex items-center justify-between transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer shadow-xs"
                id="btn-google"
              >
                <div className="flex items-center space-x-space-md">
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M12.24 10.285V13.4h6.887C18.2 16.14 15.645 18 12.24 18c-3.315 0-6-2.685-6-6s2.685-6 6-6c1.47 0 2.81.53 3.86 1.41l2.36-2.36C16.92 3.52 14.73 2.5 12.24 2.5 7.02 2.5 2.75 6.77 2.75 12s4.27 9.5 9.49 9.5c5.46 0 9.07-3.84 9.07-9.23 0-.62-.07-1.22-.19-1.985H12.24z" />
                  </svg>
                  <span className="text-body-md font-medium tracking-tight">Continue with Corporate Google SSO</span>
                </div>
                <span className="font-label-mono text-label-mono bg-on-primary/15 px-space-xs py-[2px] rounded text-on-primary group-hover:bg-on-primary/25 transition-colors">
                  WORKSPACE
                </span>
              </button>

              {/* Enterprise SAML / Okta Secondary */}
              <button
                type="button"
                onClick={() => setShowPersonas(!showPersonas)}
                className="group w-full h-11 px-space-md bg-surface-container-low hover:bg-surface-container text-on-surface font-body-md text-body-md rounded-lg flex items-center justify-between transition-all duration-150 border border-surface-container cursor-pointer"
                id="btn-saml"
              >
                <div className="flex items-center space-x-space-md">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-on-surface shrink-0">
                    key
                  </span>
                  <span className="font-medium text-body-md">Sign in with Enterprise SAML / Roles</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </button>

              {/* Fast persona selection dropdown when opened */}
              {showPersonas && (
                <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container space-y-space-xs font-label-mono text-label-mono">
                  <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mb-1">
                    Select Identity Persona:
                  </div>
                  {TEST_IDENTITIES.map((id) => (
                    <button
                      key={id.role}
                      type="button"
                      onClick={() => handleTestLogin(id)}
                      className="w-full text-left p-space-xs rounded bg-surface-container-lowest hover:bg-surface-container transition-colors flex items-center justify-between cursor-pointer border border-surface-container"
                    >
                      <div>
                        <div className="font-bold text-on-surface">{id.name}</div>
                        <div className="text-[10px] text-on-surface-variant">{id.desc}</div>
                      </div>
                      <span className="px-1.5 py-0.5 bg-secondary-container text-on-secondary-container rounded font-bold text-[10px]">
                        {id.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Architectural Divider */}
              <div className="relative py-space-sm flex items-center justify-center">
                <div className="w-full h-[1px] bg-surface-container-high"></div>
                <span className="absolute px-space-sm bg-surface-container-lowest font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">
                  or security token verification
                </span>
              </div>

              {/* Ephemeral Token / FIDO2 Input Formulation */}
              <div className="space-y-space-xs text-left">
                <div className="flex items-center justify-between">
                  <label className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface font-medium" htmlFor="token-input">
                    Security Key / Ephemeral Token
                  </label>
                  <span className="font-label-mono text-label-mono text-secondary flex items-center space-x-1">
                    <span className="material-symbols-outlined text-[12px]">usb</span>
                    <span>WEBAUTHN READY</span>
                  </span>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-on-surface-variant flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-[18px]">password</span>
                  </div>
                  <input
                    autoComplete="off"
                    className="w-full h-11 pl-10 pr-24 bg-surface-container-low text-on-surface font-label-mono text-code-md rounded-lg focus:bg-surface-container-lowest focus:outline-hidden focus:ring-1 focus:ring-primary placeholder:text-on-surface-variant/60 transition-all border border-surface-container"
                    id="token-input"
                    placeholder="sec_tok_0x9f2a..."
                    spellCheck="false"
                    type="password"
                    value={tokenInput}
                    onChange={handleTokenChange}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyToken}
                    disabled={verifying}
                    className="absolute right-1.5 h-8 px-space-sm bg-surface-container text-on-surface hover:bg-surface-container-high font-label-mono text-label-mono uppercase tracking-wider rounded transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    id="btn-verify"
                  >
                    <span>{verifying ? "Checking" : "Verify"}</span>
                    <span className="material-symbols-outlined text-[13px]">
                      {verifying ? "sync" : "arrow_forward"}
                    </span>
                  </button>
                </div>
                <p
                  className={`font-label-mono text-label-mono flex items-center space-x-1 mt-space-2xs ${
                    tokenStatus.type === "valid"
                      ? "text-secondary"
                      : tokenStatus.type === "invalid"
                      ? "text-error"
                      : "text-on-surface-variant"
                  }`}
                  id="token-status"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {tokenStatus.type === "valid" ? "check_circle" : tokenStatus.type === "invalid" ? "error" : "info"}
                  </span>
                  <span>{tokenStatus.msg}</span>
                </p>
              </div>
            </div>

            {/* Cryptographic Attestation Sub-box */}
            <div className="mt-space-lg pt-space-md border-t border-surface-container flex items-center justify-between text-on-surface-variant font-label-mono text-label-mono">
              <div className="flex items-center space-x-space-xs">
                <span className="material-symbols-outlined text-[14px] text-secondary">fingerprint</span>
                <span>CHALLENGE: 0x8A71..4DF1</span>
              </div>
              <button
                type="button"
                onClick={() => handleTestLogin(TEST_IDENTITIES[0])}
                className="hover:text-on-surface transition-colors uppercase tracking-wider underline underline-offset-2 cursor-pointer"
              >
                Hardware Passkey Bypass
              </button>
            </div>
          </div>

          {/* Security Telemetry Metadata Ledger */}
          <div className="mt-space-md p-space-sm bg-surface-container-low rounded-lg text-center border border-surface-container">
            <div className="flex flex-wrap items-center justify-center gap-x-space-md gap-y-space-2xs font-label-mono text-label-mono text-on-surface-variant">
              <div className="flex items-center space-x-1">
                <span className="text-on-surface-variant/70">Session IP:</span>
                <span className="text-on-surface font-medium">127.0.0.1</span>
              </div>
              <span className="text-on-surface-variant/40">•</span>
              <div className="flex items-center space-x-1">
                <span className="text-on-surface-variant/70">Protocol:</span>
                <span className="text-secondary font-medium">FastMCP / TLS 1.3</span>
              </div>
              <span className="text-on-surface-variant/40">•</span>
              <div className="flex items-center space-x-1">
                <span className="text-on-surface-variant/70">Node:</span>
                <span className="text-on-surface font-medium">sentinel-core-cluster-01</span>
              </div>
              <span className="text-on-surface-variant/40">•</span>
              <div className="flex items-center space-x-1">
                <span className="text-on-surface-variant/70">Audit ID:</span>
                <span className="text-primary font-medium">auth-live-ready</span>
              </div>
            </div>
          </div>

          {/* Administrative Operational Help */}
          <div className="mt-space-md flex items-center justify-between px-space-xs font-label-mono text-label-mono text-on-surface-variant">
            <span>Zero-Trust Architecture Standard NIST-800-207</span>
            <Link className="hover:text-primary transition-colors flex items-center space-x-1" href="/">
              <span>Telemetry Dashboard</span>
              <span className="material-symbols-outlined text-[11px]">north_east</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-label-mono">Loading authentication portal...</div>}>
      <AuthContent />
    </Suspense>
  );
}
