"use client";

import React, { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Shield,
  Key,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Sliders,
  Check,
  Server,
  RefreshCw,
  Play,
  XCircle,
} from "lucide-react";
import { INTEGRATIONS, Integration } from "@/lib/sentinel-data";
import { api, ToolExecutionResponse } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

export interface ExtendedIntegrationTool {
  id?: string;
  tool_id?: string;
  name?: string;
  tool_name?: string;
  description?: string;
  desc?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_level?: string;
  riskScore?: number;
  requiresApproval?: boolean;
  approval_required?: boolean;
  isDestructive?: boolean;
  is_destructive?: boolean;
  destructive?: boolean;
  allowedResources?: string[];
  policy?: string;
  policy_id?: string;
  parametersSchema?: Record<string, unknown>;
  recentExecutionsCount?: number;
  state?: string;
}

export interface LiveIntegrationState {
  id: string;
  name: string;
  category: "Design" | "Source Control" | "Communication" | "Cloud Storage" | "Knowledgebase" | "Project Management" | "Custom Protocol";
  logo: string;
  status: "CONNECTED" | "DEGRADED" | "DISCONNECTED";
  authType: "OAuth 2.0" | "OAuth App" | "Bot Token" | "Service Account" | "Internal Token" | "mTLS / Secret";
  connectionEndpoint?: string;
  connection_endpoint?: string;
  toolsCount?: number;
  tools_count?: number;
  lastActivity?: string;
  last_activity?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_level?: string;
  permissions?: string[];
  scopes?: string[];
  description: string;
  activePolicies?: string[];
  tools: ExtendedIntegrationTool[];
  live_status?: string;
  authenticated_user?: { login?: string; [key: string]: unknown };
  masked_token?: string;
}

export interface TestResultData {
  success?: boolean;
  message?: string;
  latency_ms?: number;
  server_version?: string;
  details?: {
    username?: string;
    rate_limit_remaining?: number | string;
    authenticated?: boolean;
    login?: string;
  };
}

export default function IntegrationDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const integrationId = resolvedParams.id;

  const staticIntegration: Integration =
    INTEGRATIONS.find((i) => i.id === integrationId) || INTEGRATIONS[0];

  const [integration, setIntegration] = useState<LiveIntegrationState>(staticIntegration);
  const [tools, setTools] = useState<ExtendedIntegrationTool[]>(staticIntegration.tools);
  const [, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResultData | null>(null);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Connect Modal State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectToken, setConnectToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);

  // Governed Action Playground State
  const [selectedTool, setSelectedTool] = useState("github.merge_pull_request");
  const [repoParam, setRepoParam] = useState("octocat/sentinel-demo");
  const [numberParam, setNumberParam] = useState(42);
  const ownerParam = repoParam.includes("/") ? repoParam.split("/")[0] : "octocat";
  const [runLoading, setRunLoading] = useState(false);
  const [executionResult, setExecutionResult] = useState<ToolExecutionResponse | null>(null);
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [approvalActionLoading, setApprovalActionLoading] = useState(false);

  const fetchLiveStatus = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      if (integrationId === "github") {
        const statusData = await api.integrations.status("github").catch(() => null);
        const toolsData = await api.integrations.tools("github").catch(() => []);
        if (statusData) {
          setIntegration((prev) => ({
            ...prev,
            ...statusData,
            status: (statusData.status as LiveIntegrationState["status"]) || prev.status,
            toolsCount: toolsData.length || statusData.tools_count || 10,
            permissions: statusData.scopes?.length ? statusData.scopes : prev.permissions || [],
          }));
        }
        if (toolsData && toolsData.length > 0) {
          setTools(toolsData as unknown as ExtendedIntegrationTool[]);
        } else {
          setTools(staticIntegration.tools);
        }
      } else {
        const liveDetail = await api.integrations.get(integrationId).catch(() => null);
        const toolsData = await api.integrations.tools(integrationId).catch(() => []);
        if (liveDetail) {
          setIntegration((prev) => ({
            ...prev,
            ...liveDetail,
            status: (liveDetail.status as LiveIntegrationState["status"]) || prev.status,
          }));
        }
        if (toolsData && toolsData.length > 0) {
          setTools(toolsData as unknown as ExtendedIntegrationTool[]);
        } else {
          setTools(staticIntegration.tools);
        }
      }
    } catch {
      setTools(staticIntegration.tools);
    } finally {
      setLoading(false);
    }
  }, [integrationId, staticIntegration]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLiveStatus(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLiveStatus]);

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await api.integrations.test(integrationId);
      setTestResult(res as unknown as TestResultData);
      await fetchLiveStatus(false);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to test connection",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${integration.name}? This will revoke access and wipe credentials from the secure vault.`)) {
      return;
    }
    try {
      setDisconnecting(true);
      await api.integrations.disconnect(integrationId);
      setTestResult(null);
      await fetchLiveStatus(false);
    } catch (err: unknown) {
      alert(`Disconnect failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectToken.trim()) return;
    try {
      setConnecting(true);
      setConnectMessage(null);
      await api.integrations.connect(integrationId, {
        access_token: connectToken.trim(),
        token_type: "Bearer",
      });
      setConnectMessage("Successfully connected!");
      setConnectToken("");
      setShowConnectModal(false);
      await fetchLiveStatus(false);
    } catch (err: unknown) {
      setConnectMessage(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleOAuthConnect = async () => {
    try {
      setOauthLoading(true);
      if (integrationId === "github") {
        const data = await api.integrations.getGithubOAuthUrl();
        if (data.authorization_url) {
          window.location.href = data.authorization_url;
        }
      }
    } catch (err: unknown) {
      alert(`OAuth initialization failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOauthLoading(false);
    }
  };

  const handleExecuteGovernedTool = async () => {
    try {
      setRunLoading(true);
      setExecutionResult(null);
      let params: Record<string, unknown> = {};

      if (selectedTool === "github.merge_pull_request") {
        params = {
          owner: ownerParam,
          repo: repoParam.includes("/") ? repoParam.split("/")[1] : repoParam,
          pull_number: Number(numberParam),
          merge_method: "merge",
          commit_title: "Governed PR Merge by Sentinel Security Gateway",
        };
      } else if (selectedTool === "github.delete_repository") {
        const rName = repoParam.includes("/") ? repoParam.split("/")[1] : repoParam;
        params = {
          owner: ownerParam,
          repo: rName,
          confirmation: rName,
        };
      } else if (selectedTool === "github.list_repositories") {
        params = { limit: 10, visibility: "all" };
      } else if (selectedTool === "github.get_authenticated_user") {
        params = {};
      }

      const res = await api.integrations.executeTool(
        selectedTool,
        params,
        undefined,
        "Governed execution test from MCP Sentinel UI"
      );
      setExecutionResult(res);
      if (res.status === "PENDING_APPROVAL" && res.approval_ticket_id) {
        setPendingTicketId(res.approval_ticket_id);
      }
    } catch (err: unknown) {
      setExecutionResult({
        success: false,
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunLoading(false);
    }
  };

  const handleApprovePendingTicket = async () => {
    if (!pendingTicketId) return;
    try {
      setApprovalActionLoading(true);
      await api.approvals.approve(pendingTicketId, "Approved via Sentinel Integrations console");

      let params: Record<string, unknown> = {};
      if (selectedTool === "github.merge_pull_request") {
        params = {
          owner: ownerParam,
          repo: repoParam.includes("/") ? repoParam.split("/")[1] : repoParam,
          pull_number: Number(numberParam),
          merge_method: "merge",
          commit_title: "Governed PR Merge by Sentinel Security Gateway",
        };
      } else if (selectedTool === "github.delete_repository") {
        const rName = repoParam.includes("/") ? repoParam.split("/")[1] : repoParam;
        params = {
          owner: ownerParam,
          repo: rName,
          confirmation: rName,
        };
      }

      const postApprovalRes = await api.integrations.executeTool(
        selectedTool,
        params,
        pendingTicketId,
        "Executing approved operation"
      );
      setExecutionResult(postApprovalRes);
      setPendingTicketId(null);
    } catch (err: unknown) {
      alert(`Approval execution failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setApprovalActionLoading(false);
    }
  };

  const handleRejectPendingTicket = async () => {
    if (!pendingTicketId) return;
    try {
      setApprovalActionLoading(true);
      await api.approvals.deny(pendingTicketId, "Rejected by Security Operator");
      setExecutionResult({
        success: false,
        status: "BLOCKED",
        error: "Action rejected by human operator. Execution aborted.",
        stages_completed: ["1. Identity Verified", "2. Integration Authorized", "3. Tool Registry Validated", "4. Policy Evaluated", "5. Risk Assessed", "6. Human Rejected -> Gated Closed"],
      });
      setPendingTicketId(null);
    } catch (err: unknown) {
      alert(`Rejection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setApprovalActionLoading(false);
    }
  };

  const isConnected = integration.status === "CONNECTED";

  return (
    <div className="p-3 sm:p-5 max-w-6xl mx-auto space-y-4 font-sans select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-code-sm uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <Link href="/integrations" className="hover:text-[var(--text-primary)] flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              <span>INTEGRATIONS</span>
            </Link>
            <span>/</span>
            <span className="font-bold text-[var(--primary)] uppercase font-mono">{integration.name}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xl">{integration.logo || "🐙"}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-md text-lg sm:text-xl font-bold tracking-tight text-[var(--primary)]">
                  {integration.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs text-[9px] font-label-caps font-bold ${
                    isConnected
                      ? "bg-[var(--primary-container)]/20 border border-[var(--primary-container)]/30 text-[var(--primary-container)]"
                      : "bg-[var(--error-container)] border border-[var(--error)]/40 text-[var(--on-error-container)]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? "bg-[var(--primary-container)] animate-pulse" : "bg-[var(--error)]"
                    }`}
                  />
                  {integration.status || "DISCONNECTED"}
                </span>
                <span className="px-1.5 py-0.2 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] text-[9px] font-mono text-[var(--text-secondary)]">
                  {integration.authType || "OAuth 2.0 / Vault"}
                </span>
              </div>
              <p className="font-body-sm text-xs text-[var(--text-secondary)] mt-0.5">
                {integration.description}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons: Connect, Test, Disconnect */}
        <div className="flex flex-wrap items-center gap-2 font-code-sm text-xs self-start sm:self-auto">
          {!isConnected ? (
            <button
              onClick={() => setShowConnectModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold hover:brightness-110 shadow-sm transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>CONNECT {integration.name?.toUpperCase()}</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xs border border-[var(--error)]/40 bg-[var(--error-container)] text-[var(--on-error-container)] font-bold hover:brightness-110 shadow-sm transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{disconnecting ? "Disconnecting..." : `DISCONNECT`}</span>
            </button>
          )}

          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] hover:border-[var(--secondary-container)] text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--secondary-container)] ${testing ? "animate-spin" : ""}`} />
            <span>{testing ? "Testing..." : "TEST LINK"}</span>
          </button>

          <Link
            href="/policies"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-high)] hover:border-[var(--secondary-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--secondary-container)]" />
            <span>POLICIES</span>
          </Link>
        </div>
      </div>

      {/* Test Connection Banner / Toast */}
      {testResult && (
        <div
          className={`p-3 rounded-xs border font-code-sm text-xs animate-in fade-in ${
            testResult.success
              ? "bg-[var(--surface-container-low)] border-[var(--primary-container)]/40 text-[var(--text-primary)]"
              : "bg-[var(--surface-container-low)] border-[var(--error)]/40 text-[var(--error)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--primary-container)]" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[var(--error)]" />
              )}
              <span className="font-bold">{testResult.message}</span>
            </div>
            {testResult.latency_ms !== undefined && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono">{testResult.latency_ms} ms</span>
            )}
          </div>
          {testResult.details && (
            <div className="mt-2 pt-2 border-t border-[var(--border)] text-[10px] font-mono grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-[var(--text-muted)]">User: </span>
                <span className="font-semibold text-[var(--secondary-container)]">
                  {testResult.details.username || "anonymous"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Rate Limit: </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {testResult.details.rate_limit_remaining ?? "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Authenticated: </span>
                <span className="font-semibold text-[var(--primary-container)]">
                  {testResult.details.authenticated ? "Yes (Valid)" : "No"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Server: </span>
                <span className="font-semibold text-[var(--text-primary)]">{testResult.server_version || "GitHub-API/v3"}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Structured Status Grid: Connection, Authentication, Security Policy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-code-sm text-xs">
        {/* Connection */}
        <div className="p-3.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-2">
          <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--border)] font-label-caps text-[9px] uppercase font-bold text-[var(--text-muted)]">
            <Server className="w-3.5 h-3.5 text-[var(--secondary-container)]" />
            <span>LINK TELEMETRY</span>
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Status:</span>
              <span
                className={`font-bold ${
                  isConnected ? "text-[var(--primary-container)]" : "text-[var(--error)]"
                }`}
              >
                {integration.status || "DISCONNECTED"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Endpoint:</span>
              <span className="font-semibold text-[var(--text-primary)] truncate max-w-[170px]">
                {integration.connection_endpoint || integration.connectionEndpoint || "https://api.github.com"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Activity:</span>
              <span className="text-[var(--text-primary)]">
                {integration.last_activity ? new Date(integration.last_activity).toLocaleTimeString() : "Just now"}
              </span>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="p-3.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-2">
          <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--border)] font-label-caps text-[9px] uppercase font-bold text-[var(--text-muted)]">
            <Key className="w-3.5 h-3.5 text-[var(--primary-container)]" />
            <span>FERNET CREDENTIAL VAULT</span>
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Identity:</span>
              <span className="font-bold text-[var(--secondary-container)]">
                {integration.authenticated_user?.login ? `@${integration.authenticated_user.login}` : "Unauthenticated"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Storage:</span>
              <span
                className={`font-semibold ${
                  integration.masked_token ? "text-[var(--primary-container)]" : "text-[var(--text-muted)]"
                }`}
              >
                {integration.masked_token ? "FERNET AES-256 SEALED" : "NONE STORED"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Mask:</span>
              <code className="text-[10px] text-[var(--text-secondary)]">
                {integration.masked_token || "—"}
              </code>
            </div>
          </div>
        </div>

        {/* Security Policy */}
        <div className="p-3.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-2">
          <div className="flex items-center gap-2 pb-1.5 border-b border-[var(--border)] font-label-caps text-[9px] uppercase font-bold text-[var(--text-muted)]">
            <Shield className="w-3.5 h-3.5 text-[var(--tertiary-fixed-dim)]" />
            <span>SECURITY INVARIANT STATUS</span>
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Risk Tier:</span>
              <span className="px-1.5 py-0.2 rounded-xs font-label-caps text-[9px] font-bold bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40">
                {integration.risk_level || "CRITICAL"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Gate Mode:</span>
              <span className="text-[var(--primary-container)] font-semibold">9-STAGE INVARIANT</span>
            </div>
            <div className="text-[11px] text-[var(--text-primary)] font-semibold truncate pt-0.5">
              Policy: {integration.activePolicies?.[0] || "Repository Protection Policy"}
            </div>
          </div>
        </div>
      </div>

      {/* Permissions / Granted OAuth Scopes Section */}
      <div className="p-3.5 rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-2">
        <h3 className="font-label-caps text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-1.5 border-b border-[var(--border)]">
          GRANTED OAUTH SCOPES & CRYPTOGRAPHIC PERMISSIONS
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(integration.permissions || ["repo", "read:user", "user:email"]).map((perm: string) => (
            <div
              key={perm}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-mono text-[10px] text-[var(--text-primary)]"
            >
              <Check className="w-3 h-3 text-[var(--primary-container)]" />
              <span>{perm}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Governed Action Playground */}
      <div className="rounded-xs border border-[var(--border-interactive)] bg-[var(--surface-container-low)] p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div>
            <span className="font-label-caps text-[8px] uppercase tracking-wider text-[var(--secondary-container)] font-bold block">
              HUMAN-IN-THE-LOOP ZERO-TRUST GATING
            </span>
            <h3 className="font-headline-sm text-xs sm:text-sm font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Shield className="w-3.5 h-3.5 text-[var(--primary-container)]" />
              GOVERNED ACTION VERIFICATION CONSOLE
            </h3>
          </div>
          <span className="font-code-sm text-[10px] text-[var(--primary-container)] font-mono font-bold">
            9-STAGE GATEWAY ENFORCED
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 font-code-sm text-xs">
          <div>
            <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block mb-1">
              APPLICATION
            </label>
            <div className="px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-bold text-[var(--text-primary)] font-mono">
              GitHub
            </div>
          </div>

          <div>
            <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block mb-1">
              TOOL CAPABILITY
            </label>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] font-semibold text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--secondary-container)] font-mono"
            >
              <option value="github.merge_pull_request">github.merge_pull_request (HIGH)</option>
              <option value="github.delete_repository">github.delete_repository (CRITICAL)</option>
              <option value="github.list_repositories">github.list_repositories (LOW)</option>
              <option value="github.get_authenticated_user">github.get_authenticated_user (LOW)</option>
            </select>
          </div>

          <div>
            <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block mb-1">
              REPOSITORY TARGET
            </label>
            <input
              type="text"
              value={repoParam}
              onChange={(e) => setRepoParam(e.target.value)}
              placeholder="owner/repo"
              className="w-full px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--secondary-container)] font-mono"
            />
          </div>

          {selectedTool === "github.merge_pull_request" ? (
            <div>
              <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block mb-1">
                PULL REQUEST #
              </label>
              <input
                type="number"
                value={numberParam}
                onChange={(e) => setNumberParam(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--secondary-container)] font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="font-label-caps text-[8px] text-[var(--text-muted)] uppercase block mb-1">
                CALLING AGENT
              </label>
              <div className="px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-[var(--text-secondary)] font-mono truncate">
                sentinel-agent-v1
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-code-sm border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Risk: </span>
              <span
                className={`px-1.5 py-0.2 rounded-xs font-label-caps text-[9px] font-bold ${
                  selectedTool.includes("delete")
                    ? "bg-[var(--error-container)] text-[var(--on-error-container)]"
                    : selectedTool.includes("merge")
                    ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)]"
                    : "bg-[var(--primary-container)]/20 text-[var(--primary-container)]"
                }`}
              >
                {selectedTool.includes("delete") ? "CRITICAL (98)" : selectedTool.includes("merge") ? "HIGH (85)" : "LOW (15)"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Policy: </span>
              <span className="font-semibold text-[var(--text-primary)] font-mono">sentinel-core-policy</span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Gating: </span>
              <span
                className={`font-semibold font-mono ${
                  selectedTool.includes("list") || selectedTool.includes("get_auth")
                    ? "text-[var(--primary-container)]"
                    : "text-[var(--tertiary-fixed-dim)]"
                }`}
              >
                {selectedTool.includes("list") || selectedTool.includes("get_auth")
                  ? "Automatic Pass"
                  : "Dual-Custody Escrow"}
              </span>
            </div>
          </div>

          <button
            onClick={handleExecuteGovernedTool}
            disabled={runLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold hover:brightness-110 shadow-sm transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{runLoading ? "EVALUATING INVARIANTS..." : "EXECUTE VIA SENTINEL GATEWAY"}</span>
          </button>
        </div>

        {/* Execution Result Banner */}
        {executionResult && (
          <div className="p-3 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] font-code-sm text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--text-primary)]">Execution Status:</span>
                <span
                  className={`px-1.5 py-0.5 rounded-xs font-bold text-[10px] font-mono ${
                    executionResult.status === "EXECUTED"
                      ? "bg-[var(--primary-container)]/20 text-[var(--primary-container)] border border-[var(--primary-container)]/30"
                      : executionResult.status === "PENDING_APPROVAL"
                      ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40 animate-pulse"
                      : "bg-[var(--error-container)] text-[var(--on-error-container)]"
                  }`}
                >
                  {executionResult.status}
                </span>
                {executionResult.approval_ticket_id && (
                  <span className="text-[10px] text-[var(--secondary-container)] font-mono font-bold">
                    Ticket: {executionResult.approval_ticket_id}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {executionResult.latency_ms || 0} ms
              </span>
            </div>

            {/* Stages completed */}
            {Array.isArray(executionResult.stages_completed) && executionResult.stages_completed.length > 0 ? (
              <div className="space-y-1 pt-1 border-t border-[var(--border)] text-[10px]">
                <span className="text-[9px] text-[var(--text-muted)] uppercase block font-mono">
                  Gateway Pipeline Execution Stages:
                </span>
                <div className="flex flex-wrap gap-1 font-mono">
                  {executionResult.stages_completed.map((st: string) => (
                    <span
                      key={st}
                      className="px-1.5 py-0.2 rounded-xs bg-[var(--surface-container-high)] border border-[var(--border)] text-[9px] text-[var(--text-primary)]"
                    >
                      {st}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Pending Approval Actions */}
            {pendingTicketId ? (
              <div className="p-2.5 rounded-xs border border-[var(--tertiary-fixed-dim)]/40 bg-[var(--surface-container-low)] flex items-center justify-between gap-3 mt-1">
                <div className="space-y-0.5">
                  <div className="font-bold text-[var(--tertiary-fixed-dim)] flex items-center gap-1.5 font-mono">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Dual-Custody Gating Intercepted Destructive Call</span>
                  </div>
                  <p className="font-body-sm text-[11px] text-[var(--text-secondary)]">
                    Ticket <code className="font-bold text-[var(--secondary-container)] font-mono">{pendingTicketId}</code> generated and bound to SHA-256 payload parameters.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApprovePendingTicket}
                    disabled={approvalActionLoading}
                    className="px-2.5 py-1 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold text-xs hover:brightness-110 cursor-pointer"
                  >
                    AUTHORIZE & DISPATCH
                  </button>
                  <button
                    onClick={handleRejectPendingTicket}
                    disabled={approvalActionLoading}
                    className="px-2.5 py-1 rounded-xs bg-[var(--error)] text-white font-bold text-xs hover:brightness-110 cursor-pointer"
                  >
                    ABORT & QUARANTINE
                  </button>
                </div>
              </div>
            ) : null}

            {executionResult.error && !pendingTicketId ? (
              <p className="text-xs text-[var(--error)] pt-1 font-mono">{executionResult.error}</p>
            ) : null}

            {executionResult.data ? (
              <pre className="p-2 rounded-xs bg-[var(--surface-container-low)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-primary)] overflow-x-auto max-h-40">
                {JSON.stringify(executionResult.data, null, 2)}
              </pre>
            ) : null}
          </div>
        )}
      </div>

      {/* Available Tools Section */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--surface-container-low)] space-y-3 p-3.5 sm:p-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div>
            <span className="font-label-caps text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">
              CAPABILITY REGISTRY
            </span>
            <h3 className="font-headline-sm text-xs sm:text-sm font-bold text-[var(--primary)] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Wrench className="w-3.5 h-3.5 text-[var(--secondary-container)]" />
              AVAILABLE GOVERNED TOOLS ({tools.length})
            </h3>
          </div>
          <span className="font-code-sm text-[10px] text-[var(--text-muted)] font-mono">
            Enforced by Policy & Invariant Risk Engine
          </span>
        </div>

        <div className="space-y-2">
          {tools.map((tool) => {
            const toolRisk = tool.risk_level || tool.riskLevel || "LOW";
            const reqApproval = Boolean(tool.approval_required ?? tool.requiresApproval);
            const isDestructive = Boolean(tool.is_destructive ?? tool.destructive ?? toolRisk === "CRITICAL");

            return (
              <div
                key={tool.id || tool.tool_id || tool.name}
                className="p-3 rounded-xs border border-[var(--border)] bg-[var(--surface-container-lowest)] space-y-1.5 hover:border-[var(--border-interactive)] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-bold font-mono text-[var(--secondary-container)]">
                      {tool.name || tool.tool_name}
                    </code>
                    <span
                      className={`px-1.5 py-0.2 rounded-xs font-label-caps text-[9px] font-bold ${
                        toolRisk === "CRITICAL"
                          ? "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/40"
                          : toolRisk === "HIGH"
                          ? "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40"
                          : "bg-[var(--primary-container)]/20 text-[var(--primary-container)] border border-[var(--primary-container)]/30"
                      }`}
                    >
                      {toolRisk}
                    </span>
                    {reqApproval && (
                      <span className="px-1.5 py-0.2 rounded-xs bg-[var(--tertiary-container)] border border-[var(--tertiary-fixed-dim)]/40 text-[8px] font-label-caps font-bold text-[var(--on-tertiary-container)]">
                        ESCROW GATED
                      </span>
                    )}
                    {isDestructive && (
                      <span className="px-1.5 py-0.2 rounded-xs bg-[var(--error-container)] border border-[var(--error)]/40 text-[8px] font-label-caps font-bold text-[var(--on-error-container)]">
                        DESTRUCTIVE
                      </span>
                    )}
                  </div>

                  <span className="font-code-sm text-[10px] text-[var(--text-muted)] font-mono">
                    {tool.recentExecutionsCount ? `${tool.recentExecutionsCount} calls` : "Governed"}
                  </span>
                </div>

                <p className="font-body-sm text-xs text-[var(--text-secondary)] leading-relaxed">
                  {tool.description || tool.desc}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[var(--border)] font-code-sm text-[10px]">
                  <div>
                    <span className="text-[var(--text-muted)]">State: </span>
                    <span className="text-[var(--primary-container)] font-semibold font-mono">
                      {tool.state || (isConnected ? "ONLINE & AVAILABLE" : "DISCOVERED")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Active Policy: </span>
                    <span className="text-[var(--text-primary)] font-semibold font-mono">
                      {tool.policy_id || "sentinel-core-policy"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 animate-in fade-in">
          <div className="w-full max-w-md rounded-xs border border-[var(--border-interactive)] bg-[var(--surface-container-low)] p-4 sm:p-5 space-y-3 shadow-2xl font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">{integration.logo || "🐙"}</span>
                <h3 className="font-headline-sm text-xs sm:text-sm font-bold text-[var(--primary)] font-mono">
                  AUTHORIZE {integration.name?.toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="font-body-sm text-xs text-[var(--text-secondary)] leading-relaxed">
              Connect your GitHub account using OAuth 2.0 or provide a Personal Access Token (PAT). All tokens are encrypted at rest with 256-bit Fernet AES-CBC keys.
            </p>

            {/* Option 1: GitHub OAuth App Button */}
            <div className="space-y-1.5">
              <span className="font-label-caps text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">
                OPTION 1: RECOMMENDED OAUTH 2.0 FLOW
              </span>
              <button
                type="button"
                onClick={handleOAuthConnect}
                disabled={oauthLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold text-xs hover:brightness-110 shadow-sm transition-all cursor-pointer font-mono"
              >
                <span>Authorize with GitHub (OAuth 2.0)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[var(--border)]" />
              <span className="flex-shrink mx-2 font-code-sm text-[9px] text-[var(--text-muted)] uppercase">
                Or
              </span>
              <div className="flex-grow border-t border-[var(--border)]" />
            </div>

            {/* Option 2: PAT Input */}
            <form onSubmit={handleConnectToken} className="space-y-2.5">
              <span className="font-label-caps text-[8px] uppercase tracking-wider text-[var(--text-muted)] block">
                OPTION 2: PERSONAL ACCESS TOKEN (PAT)
              </span>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={connectToken}
                onChange={(e) => setConnectToken(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xs bg-[var(--surface-container-lowest)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-mono focus:outline-hidden focus:border-[var(--secondary-container)]"
              />

              {connectMessage && (
                <p className="text-xs text-[var(--error)] font-mono">
                  {connectMessage}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-2.5 py-1 rounded-xs border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={connecting || !connectToken.trim()}
                  className="px-3.5 py-1 rounded-xs bg-[var(--primary-container)] text-[var(--surface-container-lowest)] font-bold text-xs font-mono hover:brightness-110 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {connecting ? "CONNECTING..." : "SEAL & VERIFY"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
