"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Settings,
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
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { RoleBadge } from "@/components/ui/Badges";

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

  // Masked keys state
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <span className="font-bold text-[var(--text-primary)]">MCP SENTINEL</span>
            <span>/</span>
            <span className="text-[var(--accent)] font-semibold">SYSTEM</span>
            <span>/</span>
            <span className="text-[var(--text-secondary)]">PLATFORM SETTINGS</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Enterprise Platform Settings
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
            Manage organization credentials, API security keys, MCP daemon connections, and global invariant settings.
          </p>
        </div>
      </div>

      {/* Main Settings Layout: Sidebar Tabs + Content Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Sub-nav */}
        <div className="md:col-span-3 space-y-1">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xs text-xs font-medium transition-colors text-left ${
                  isActive
                    ? "bg-[var(--bg-card)] text-[var(--accent)] font-bold shadow-2xs border-l-2 border-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div className="md:col-span-9 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-2xs space-y-6">
          {/* 1. ACCOUNT */}
          {activeSection === "account" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
                Active Operator Account
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase block">Display Name</label>
                  <input
                    type="text"
                    disabled
                    value="Security Administrator"
                    className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase block">Email Address</label>
                  <input
                    type="text"
                    disabled
                    value="admin@sentinel.test"
                    className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase block">Assigned RBAC Role</label>
                  <div className="pt-1">
                    <RoleBadge role="ADMIN" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase block">Session Token Expiration</label>
                  <span className="text-[var(--text-primary)] block pt-1.5 font-bold">23h 48m Remaining</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. ORGANIZATION */}
          {activeSection === "organization" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
                Enterprise Organization
              </h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--text-muted)] uppercase block">Organization Identifier</label>
                  <input
                    type="text"
                    disabled
                    value="org_mcp_sentinel_enterprise_prod"
                    className="w-full p-2 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase block">Active Agents Limit</span>
                    <span className="font-bold text-[var(--text-primary)]">Unlimited (Enterprise Plan)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase block">Dual-Custody Mandate</span>
                    <span className="font-bold text-[var(--risk-low)]">ENFORCED (Global)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. AUTHENTICATION */}
          {activeSection === "authentication" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
                Security & Identity Posture
              </h2>
              <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--text-primary)]">Google Workspace OAuth 2.0</span>
                  <span className="text-[10px] text-[var(--risk-low)] font-bold">CONNECTED</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] font-sans">
                  SAML SSO and OAuth federated identity verified. Dual-factor authentication required for all approver accounts.
                </p>
              </div>
            </div>
          )}

          {/* 4. API KEYS (MASKED CREDENTIALS) */}
          {activeSection === "api-keys" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Sensitive Credentials & Keys (Masked)
                </h2>
                <span className="text-[10px] text-[var(--risk-critical)] font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  RESTRICTED ACCESS
                </span>
              </div>

              <div className="space-y-3">
                {/* Gemini API Key */}
                <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-primary)]">GEMINI_API_KEY</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleShowKey("gemini")}
                        className="p-1 rounded-xs hover:bg-[var(--border-subtle)] text-[var(--text-secondary)]"
                        title={showKeys.gemini ? "Mask key" : "Unmask key"}
                      >
                        {showKeys.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(showKeys.gemini ? "AIzaSyB...live" : "••••••••••••••••••••", "gemini")}
                        className="p-1 rounded-xs hover:bg-[var(--border-subtle)] text-[var(--text-secondary)]"
                        title="Copy key"
                      >
                        {copied === "gemini" ? <Check className="w-3.5 h-3.5 text-[var(--risk-low)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <code className="text-xs text-[var(--accent)] block font-mono-tnum">
                    {showKeys.gemini ? "AIzaSyD-p8K491_sentinel_live_key_9941a" : "sk-gem-••••••••••••••••••••3a8f"}
                  </code>
                </div>

                {/* JWT Secret */}
                <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-primary)]">JWT_SECRET_KEY</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleShowKey("jwt")}
                        className="p-1 rounded-xs hover:bg-[var(--border-subtle)] text-[var(--text-secondary)]"
                      >
                        {showKeys.jwt ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(showKeys.jwt ? "sentinel-master-secret" : "••••••••••••", "jwt")}
                        className="p-1 rounded-xs hover:bg-[var(--border-subtle)] text-[var(--text-secondary)]"
                      >
                        {copied === "jwt" ? <Check className="w-3.5 h-3.5 text-[var(--risk-low)]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <code className="text-xs text-[var(--accent)] block font-mono-tnum">
                    {showKeys.jwt ? "sentinel-enterprise-jwt-master-secret-key-prod" : "sec-jwt-••••••••••••••••••••b819"}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* 5. MCP CONNECTIONS */}
          {activeSection === "mcp-connections" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
                MCP Daemon Connection Limits
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase block">Max Concurrent Daemons</span>
                  <span className="text-base font-bold text-[var(--text-primary)]">32</span>
                </div>
                <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase block">Default Request Timeout</span>
                  <span className="text-base font-bold text-[var(--text-primary)]">30 seconds</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. SECURITY */}
          {activeSection === "security" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
                Security Invariant Boundaries
              </h2>
              <div className="space-y-2">
                <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[var(--text-primary)] block">Fail-Closed on Missing Context</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Immediately DENY if request attributes are missing</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-xs bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)] font-bold">
                    ACTIVE
                  </span>
                </div>
                <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[var(--text-primary)] block">HMAC-SHA256 Token Binding</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Ties single-use execution tokens to payload parameter hashes</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-xs bg-[var(--risk-low-bg)] text-[var(--risk-low)] border border-[var(--risk-low-border)] font-bold">
                    ENFORCED
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 7. POLICIES */}
          {activeSection === "policies" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
                Policy Precedence Configuration
              </h2>
              <p className="text-xs text-[var(--text-secondary)] font-sans">
                The global rule evaluation precedence is locked to:
              </p>
              <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] font-bold text-[var(--accent)]">
                DENY &gt; REQUIRE_MFA &gt; REQUIRE_APPROVAL &gt; ALLOW
              </div>
            </div>
          )}

          {/* 8. NOTIFICATIONS */}
          {activeSection === "notifications" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
                Security Alert Dispatch Routing
              </h2>
              <div className="space-y-2">
                <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] flex justify-between items-center">
                  <span className="font-bold text-[var(--text-primary)]">Critical Approval SMS / Webhook</span>
                  <span className="text-[var(--risk-low)] font-bold">ENABLED</span>
                </div>
                <div className="p-3 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] flex justify-between items-center">
                  <span className="font-bold text-[var(--text-primary)]">Slack #security-alerts Feed</span>
                  <span className="text-[var(--risk-low)] font-bold">CONNECTED</span>
                </div>
              </div>
            </div>
          )}

          {/* 9. APPEARANCE */}
          {activeSection === "appearance" && (
            <div className="space-y-4 font-mono-tnum text-xs">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
                Visual System & Theme
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { if (theme !== "architectural") toggleTheme(); }}
                  className={`p-4 rounded-xs border text-left space-y-2 transition-all ${
                    theme === "architectural"
                      ? "border-[var(--accent)] bg-[var(--bg-secondary)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Sun className="w-4 h-4 text-[var(--accent)]" />
                    {theme === "architectural" && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">Architectural Intelligence</span>
                    <span className="text-[10px] text-[var(--text-muted)] block font-sans">
                      Warm mineral white, deep ink graphite, burnt orange accent.
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => { if (theme !== "midnight") toggleTheme(); }}
                  className={`p-4 rounded-xs border text-left space-y-2 transition-all ${
                    theme === "midnight"
                      ? "border-[var(--accent)] bg-[var(--bg-secondary)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Moon className="w-4 h-4 text-[var(--accent)]" />
                    {theme === "midnight" && <Check className="w-3.5 h-3.5 text-[var(--accent)]" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">Midnight Theme</span>
                    <span className="text-[10px] text-[var(--text-muted)] block font-sans">
                      Low-light graphite darkroom palette.
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
