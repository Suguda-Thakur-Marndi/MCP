"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Building,
  Key,
  Lock,
  Server,
  Shield,
  Sliders,
  Bell,
  Palette,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sun,
  Monitor,
} from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { api, CurrentUser } from "@/lib/api";

type SettingsSection =
  | "account"
  | "organization"
  | "authentication"
  | "api-keys"
  | "mcp-connections"
  | "security"
  | "policies"
  | "notifications"
  | "appearance";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [copied, setCopied] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Masked keys state
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    api.auth
      .me()
      .then((data) => {
        if (isMounted) {
          setUser(data);
          setLoadingUser(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingUser(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleShowKey = (keyId: string) => {
    setShowKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
    { id: "account", label: "Account", icon: User },
    { id: "organization", label: "Organization", icon: Building },
    { id: "authentication", label: "Authentication", icon: Lock },
    { id: "api-keys", label: "API Keys", icon: Key },
    { id: "mcp-connections", label: "MCP Connections", icon: Server },
    { id: "security", label: "Security", icon: Shield },
    { id: "policies", label: "Policies", icon: Sliders },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
              SYSTEM CONFIGURATION // PLATFORM PARAMETERS
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-container)] animate-pulse" />
            <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-bold">
              ENCRYPTED ENVIRONMENT
            </span>
          </div>
          <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
            ENTERPRISE PLATFORM SETTINGS
          </h1>
          <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
            Manage organization credentials, API security keys, MCP daemon connections, and global invariant settings.
          </p>
        </div>
      </div>

      {/* Main Settings Layout: Sidebar Tabs + Content Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Sub-nav */}
        <div className="md:col-span-3 space-y-1">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xs text-xs font-mono transition-all text-left cursor-pointer ${
                  isActive
                    ? "bg-[var(--surface-container-low)] text-[var(--primary-container)] font-bold border-l-2 border-[var(--primary-container)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container-high)]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[var(--primary-container)]" : "text-[var(--text-muted)]"}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div className="md:col-span-9 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] p-4 sm:p-5 space-y-5">
          {/* 1. ACCOUNT */}
          {activeSection === "account" && (
            <div className="space-y-3 font-code-sm text-xs">
              <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
                ACTIVE OPERATOR ACCOUNT
              </h2>
              {loadingUser ? (
                <div className="py-4 text-center text-[var(--text-muted)] font-mono">Loading operator profile...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">DISPLAY NAME</label>
                    <input
                      type="text"
                      disabled
                      value={user?.display_name || user?.name || "Security Operator"}
                      className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] text-[var(--text-primary)] text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">EMAIL ADDRESS</label>
                    <input
                      type="text"
                      disabled
                      value={user?.email || "operator@mcp-sentinel.local"}
                      className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] text-[var(--text-primary)] text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">ASSIGNED RBAC ROLE</label>
                    <div className="pt-0.5">
                      <span className="px-2 py-0.5 rounded-xs font-label-caps text-[9px] font-bold bg-[var(--secondary-container)]/20 text-[var(--secondary-container)] border border-[var(--secondary-container)]/30">
                        {user?.role || "ADMIN"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">ACCOUNT STATUS</label>
                    <span className="text-[var(--primary-container)] block pt-1 font-bold font-mono">
                      {user?.is_active ? "AUTHENTICATED // ACTIVE" : "SUSPENDED"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. ORGANIZATION */}
          {activeSection === "organization" && (
            <div className="space-y-3 font-code-sm text-xs">
              <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
                ENTERPRISE ORGANIZATION
              </h2>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">ORGANIZATION IDENTIFIER</label>
                  <input
                    type="text"
                    disabled
                    value={user?.organization || "org_mcp_sentinel_enterprise"}
                    className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] text-[var(--text-primary)] text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                    <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">ACTIVE AGENTS LIMIT</span>
                    <span className="font-bold text-[var(--text-primary)] font-mono">Governed Security Envelope</span>
                  </div>
                  <div className="p-2.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                    <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">DUAL-CUSTODY MANDATE</span>
                    <span className="font-bold text-[var(--primary-container)] font-mono">ENFORCED (Global)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. AUTHENTICATION */}
          {activeSection === "authentication" && (
            <div className="space-y-3 font-code-sm text-xs">
              <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
                SECURITY & IDENTITY POSTURE
              </h2>
              <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--text-primary)] font-mono">Google Workspace OAuth 2.0</span>
                  <span className="text-[10px] text-[var(--primary-container)] font-bold font-mono">CONNECTED</span>
                </div>
                <p className="font-body-sm text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  SAML SSO and OAuth federated identity verified. Dual-factor authentication required for all approver accounts.
                </p>
              </div>
            </div>
          )}

          {/* 4. API KEYS (MASKED CREDENTIALS) */}
          {activeSection === "api-keys" && (
            <div className="space-y-3 font-code-sm text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
                <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  SENSITIVE CREDENTIALS & KEYS (MASKED)
                </h2>
                <span className="text-[10px] text-[var(--error)] font-bold flex items-center gap-1 font-mono">
                  <Lock className="w-3 h-3" />
                  RESTRICTED VAULT ACCESS
                </span>
              </div>

              <div className="space-y-2">
                {/* Gemini API Key */}
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-primary)] font-mono">GEMINI_API_KEY</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleShowKey("gemini")}
                        className="p-1 rounded-xs hover:bg-[var(--surface-container-high)] text-[var(--text-secondary)] cursor-pointer"
                        title={showKeys.gemini ? "Mask key" : "Unmask key"}
                      >
                        {showKeys.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(showKeys.gemini ? "AIzaSyD-live" : "••••••••••••••••••••", "gemini")}
                        className="p-1 rounded-xs hover:bg-[var(--surface-container-high)] text-[var(--text-secondary)] cursor-pointer"
                        title="Copy key"
                      >
                        {copied === "gemini" ? <Check className="w-3.5 h-3.5 text-[var(--primary-container)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <code className="text-xs text-[var(--secondary-container)] block font-mono">
                    {showKeys.gemini ? "configured-via-environment-variable" : "sk-gem-••••••••••••••••••••••••"}
                  </code>
                </div>

                {/* JWT Secret */}
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-primary)] font-mono">JWT_SECRET_KEY</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleShowKey("jwt")}
                        className="p-1 rounded-xs hover:bg-[var(--surface-container-high)] text-[var(--text-secondary)] cursor-pointer"
                      >
                        {showKeys.jwt ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(showKeys.jwt ? "sentinel-master-secret" : "••••••••••••", "jwt")}
                        className="p-1 rounded-xs hover:bg-[var(--surface-container-high)] text-[var(--text-secondary)] cursor-pointer"
                      >
                        {copied === "jwt" ? <Check className="w-3.5 h-3.5 text-[var(--primary-container)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <code className="text-xs text-[var(--secondary-container)] block font-mono">
                    {showKeys.jwt ? "sentinel-enterprise-jwt-master-secret-key-prod" : "sec-jwt-••••••••••••••••••••b819"}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* 5. MCP CONNECTIONS */}
          {activeSection === "mcp-connections" && (
            <div className="space-y-3 font-code-sm text-xs">
              <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
                MCP DAEMON CONNECTION LIMITS
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                  <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">MAX CONCURRENT DAEMONS</span>
                  <span className="text-base font-bold text-[var(--text-primary)] font-mono">32</span>
                </div>
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)]">
                  <span className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block">DEFAULT REQUEST TIMEOUT</span>
                  <span className="text-base font-bold text-[var(--text-primary)] font-mono">30 seconds</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. SECURITY */}
          {activeSection === "security" && (
            <div className="space-y-3 font-code-sm text-xs">
              <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
                SECURITY INVARIANT BOUNDARIES
              </h2>
              <div className="space-y-2 font-mono">
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[var(--text-primary)] block">Fail-Closed on Missing Context</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-sans">Immediately DENY if request attributes are missing</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-xs bg-[var(--primary-container)]/20 text-[var(--primary-container)] border border-[var(--primary-container)]/30 font-bold">
                    ACTIVE
                  </span>
                </div>
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[var(--text-primary)] block">HMAC-SHA256 Token Binding</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-sans">Ties single-use execution tokens to payload parameter hashes</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-xs bg-[var(--primary-container)]/20 text-[var(--primary-container)] border border-[var(--primary-container)]/30 font-bold">
                    ENFORCED
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 7. POLICIES */}
          {activeSection === "policies" && (
            <div className="space-y-3 font-code-sm text-xs">
              <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
                POLICY PRECEDENCE CONFIGURATION
              </h2>
              <p className="font-body-sm text-xs text-[var(--text-secondary)]">
                The global rule evaluation precedence is locked to:
              </p>
              <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-bold text-[var(--secondary-container)] font-mono">
                DENY &gt; REQUIRE_MFA &gt; REQUIRE_APPROVAL &gt; ALLOW
              </div>
            </div>
          )}

          {/* 8. NOTIFICATIONS */}
          {activeSection === "notifications" && (
            <div className="space-y-3 font-code-sm text-xs">
              <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
                SECURITY ALERT DISPATCH ROUTING
              </h2>
              <div className="space-y-2 font-mono">
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] flex justify-between items-center">
                  <span className="font-bold text-[var(--text-primary)]">Critical Approval SMS / Webhook</span>
                  <span className="text-[var(--primary-container)] font-bold">ENABLED</span>
                </div>
                <div className="p-3 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] flex justify-between items-center">
                  <span className="font-bold text-[var(--text-primary)]">Slack #security-alerts Feed</span>
                  <span className="text-[var(--primary-container)] font-bold">CONNECTED</span>
                </div>
              </div>
            </div>
          )}

          {/* 9. APPEARANCE */}
          {activeSection === "appearance" && (
            <div className="space-y-3 font-code-sm text-xs">
              <h2 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
                VISUAL SYSTEM & THEME
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { if (theme !== "control-room") toggleTheme(); }}
                  className={`p-3.5 rounded-xs border text-left space-y-1.5 transition-all cursor-pointer ${
                    theme === "control-room" || theme === "dark" || theme === "midnight"
                      ? "border-[var(--primary-container)] bg-[var(--surface-container-lowest)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--surface-container-high)] hover:border-[var(--border-interactive)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Monitor className="w-4 h-4 text-[var(--primary-container)]" />
                    {(theme === "control-room" || theme === "dark" || theme === "midnight") && (
                      <Check className="w-3.5 h-3.5 text-[var(--primary-container)]" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[var(--primary)] block font-mono">Tactical Control Room</span>
                    <span className="font-body-sm text-[10px] text-[var(--text-muted)] block">
                      Dense dark carbon, 1px micro-borders, electric lime telemetry.
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => { if (theme !== "architectural") toggleTheme(); }}
                  className={`p-3.5 rounded-xs border text-left space-y-1.5 transition-all cursor-pointer ${
                    theme === "architectural"
                      ? "border-[var(--primary-container)] bg-[var(--surface-container-lowest)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--surface-container-high)] hover:border-[var(--border-interactive)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Sun className="w-4 h-4 text-[var(--secondary-container)]" />
                    {theme === "architectural" && <Check className="w-3.5 h-3.5 text-[var(--primary-container)]" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[var(--primary)] block font-mono">Architectural Intelligence</span>
                    <span className="font-body-sm text-[10px] text-[var(--text-muted)] block">
                      Warm mineral light surface, deep ink graphite accents.
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
