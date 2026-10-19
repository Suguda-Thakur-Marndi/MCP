"use client";

import React, { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle2, RefreshCw, Activity, X } from "lucide-react";
import { api, IntegrationListItem, ToolInfo } from "@/lib/api";
import { riskBadgeClass } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function IntegrationDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const integrationId = resolvedParams.id;

  const [integration, setIntegration] = useState<IntegrationListItem | null>(null);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [intRes, toolsRes] = await Promise.all([
        api.integrations.get(integrationId),
        api.integrations.tools(integrationId).catch(() => []),
      ]);
      setIntegration(intRes);
      setTools(toolsRes || []);
    } catch (err: unknown) {
      console.warn("Failed to load integration:", err);
      setError(`Integration "${integrationId}" could not be retrieved from the catalog.`);
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setActionFeedback(null);
    try {
      const res = await api.integrations.test(integrationId);
      setTestResult(res);
      setActionFeedback("Handshake probe completed successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Handshake probe failed.";
      setTestResult({ success: false, error: msg });
      setActionFeedback(`Probe error: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.integrations.disconnect(integrationId);
      setActionFeedback("Disconnected integration.");
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Disconnect failed.";
      setActionFeedback(`Error: ${msg}`);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-12 text-center font-label-mono text-on-surface-variant">
        Loading integration configuration for {integrationId}...
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="w-full max-w-3xl mx-auto p-8 text-center space-y-4 font-label-mono">
        <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-rose-400" />
        </div>
        <h2 className="font-headline-md text-on-surface font-bold">Integration Not Found</h2>
        <p className="text-body-sm text-on-surface-variant">{error || `No integration: ${integrationId}`}</p>
        <Link
          href="/integrations"
          className="inline-block px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-ui text-label-ui font-semibold"
        >
          ← Back to Integrations Catalog
        </Link>
      </div>
    );
  }

  const isConnected = (integration.live_status || integration.status) === "CONNECTED";

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl max-w-5xl mx-auto">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/integrations"
          className="flex items-center gap-1.5 font-label-mono text-label-mono text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Integrations Catalog</span>
        </Link>
        <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant">
          ID: {integration.id}
        </span>
      </div>

      {/* Action Feedback */}
      {actionFeedback && (
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container font-label-mono text-label-mono text-on-surface flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-space-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="cursor-pointer font-bold text-on-surface-variant hover:text-on-surface">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Details Card */}
      <section className="bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container space-y-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-md pb-space-md border-b border-surface-container">
          <div>
            <div className="flex items-center gap-space-xs font-label-mono text-[11px] text-on-surface-variant mb-1">
              <span className="font-bold text-cyan-400">{integration.category}</span>
              <span>•</span>
              <span>{integration.protocol_type}</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              {integration.name}
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-2xl">
              {integration.description}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 font-label-mono text-label-mono">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-space-sm py-1 rounded font-bold text-xs ${
                  isConnected ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {integration.live_status || integration.status}
              </span>
              <span
                className={`px-space-sm py-1 rounded font-bold text-xs ${
                  integration.credential_status === "CONFIGURED"
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                }`}
              >
                {integration.credential_status === "CONFIGURED" ? "CREDENTIALS CONFIGURED" : "CREDENTIALS MISSING"}
              </span>
              <span
                className={`px-space-sm py-1 rounded font-bold text-xs ${
                  integration.write_enabled
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-surface-container-high text-cyan-300 border border-cyan-500/20"
                }`}
              >
                {integration.write_enabled ? "READ/WRITE CAPABILITY" : "READ-ONLY CAPABILITY"}
              </span>
            </div>
            {integration.masked_token && (
              <span className="text-[11px] text-on-surface-variant">
                Masked Key: <span className="text-on-surface font-semibold">{integration.masked_token}</span>
              </span>
            )}
          </div>
        </div>

        {/* 5-Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-space-sm font-label-mono text-label-mono">
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Auth Type</span>
            <div className="font-bold text-on-surface mt-0.5 truncate">{integration.auth_type}</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Protocol</span>
            <div className="font-bold text-cyan-400 mt-0.5 truncate">{integration.protocol_type}</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Permission Mode</span>
            <div className={`font-bold mt-0.5 truncate ${integration.write_enabled ? "text-amber-400" : "text-cyan-400"}`}>
              {integration.write_enabled ? "Read/Write" : "Read-Only"}
            </div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Tools Count</span>
            <div className="font-bold text-on-surface mt-0.5">{tools.length} Tools Bound</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Endpoint</span>
            <div className="font-bold text-on-surface mt-0.5 truncate">{integration.connection_endpoint || "Local stdio"}</div>
          </div>
        </div>

        {/* Integration Specific Telemetry (Notion Workspace or Supabase Project) */}
        {integration.workspace_info && (
          <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container grid grid-cols-2 sm:grid-cols-3 gap-space-sm font-label-mono text-label-mono text-xs">
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase block">Workspace Name</span>
              <span className="font-bold text-on-surface">{integration.workspace_info.workspace_name || "Authorized Workspace"}</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase block">Bot Identity</span>
              <span className="font-bold text-cyan-400">{integration.workspace_info.bot_name || "MCP Sentinel"}</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase block">API Version</span>
              <span className="font-bold text-on-surface">{integration.workspace_info.api_version || "2022-06-28"}</span>
            </div>
          </div>
        )}

        {integration.project_info && (
          <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container grid grid-cols-2 sm:grid-cols-4 gap-space-sm font-label-mono text-label-mono text-xs">
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase block">Target Host</span>
              <span className="font-bold text-on-surface truncate block" title={integration.project_info.host}>{integration.project_info.host}</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase block">Port &amp; Database</span>
              <span className="font-bold text-cyan-400">{integration.project_info.port} / {integration.project_info.database}</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase block">Security &amp; TLS</span>
              <span className="font-bold text-emerald-400">TLS Enforced</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase block">Pool Connections</span>
              <span className="font-bold text-on-surface">
                {integration.project_info.pool
                  ? `${integration.project_info.pool.total} Total (${integration.project_info.pool.used} Used / ${integration.project_info.pool.free} Free)`
                  : "Active"}
              </span>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="pt-space-sm border-t border-surface-container flex flex-wrap items-center gap-space-sm">
          <Link
            href="/integrations"
            className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-ui text-label-ui font-semibold cursor-pointer"
          >
            Configure Credentials
          </Link>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-ui text-label-ui font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 ${testing ? "animate-spin" : ""}`} />
            <span>{testing ? "Testing Live Handshake..." : "Test Connection"}</span>
          </button>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-error-container hover:text-on-error-container transition-colors font-label-ui text-label-ui font-semibold cursor-pointer"
            >
              Disconnect Gateway
            </button>
          )}
        </div>

        {/* Test Result Box (Live or Last Test Result) */}
        {(testResult || integration.last_test_result) && (
          <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container space-y-1 font-label-mono text-label-mono">
            <div className="flex items-center justify-between text-[10px] text-on-surface-variant uppercase font-semibold">
              <span>{testResult ? "Live Handshake Telemetry Response" : "Last Verification Telemetry"}</span>
              {testResult?.latency_ms ? (
                <span className="text-cyan-400">{String(testResult.latency_ms)} ms latency</span>
              ) : integration.last_test_result?.latency_ms ? (
                <span className="text-cyan-400">{integration.last_test_result.latency_ms} ms latency</span>
              ) : null}
            </div>
            <pre className="p-space-sm bg-surface-container rounded-lg text-code-sm text-on-surface overflow-x-auto border border-surface-container">
              {JSON.stringify(testResult || integration.last_test_result, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Bound Tools Section */}
      <section className="bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container space-y-space-md">
        <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
            Bound FastMCP Tools ({tools.length})
          </h2>
          <span className="font-label-mono text-[11px] text-on-surface-variant">
            Governed by Sentinel Policy Engine &amp; Gate
          </span>
        </div>

        {tools.length === 0 ? (
          <div className="p-8 text-center font-label-mono text-on-surface-variant text-body-sm">
            No tools explicitly bound to this integration in the database.
          </div>
        ) : (
          <div className="space-y-space-xs">
            {tools.map((t, idx) => {
              const name = String(t.name || t.tool_name || `tool-${idx}`);
              const desc = String(t.description || "FastMCP operational tool");
              const risk = String(t.risk_level || "LOW");
              const isApproval = Boolean(t.requires_approval || t.approval_required);
              const isEnabled = t.enabled !== false;

              return (
                <div
                  key={idx}
                  className={`p-space-md rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm transition-opacity ${
                    isEnabled
                      ? "bg-surface-container-low border-surface-container"
                      : "bg-surface-container-lowest/80 border-surface-container/60 opacity-80"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-space-xs font-label-mono text-[11px] mb-0.5 flex-wrap">
                      <span className="font-bold text-on-surface">{name}</span>
                      {isEnabled ? (
                        <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-semibold text-[10px] border border-emerald-500/20">
                          AVAILABLE
                        </span>
                      ) : (
                        <span className="bg-amber-500/15 text-amber-400 px-1.5 py-0.2 rounded font-semibold text-[10px] border border-amber-500/30">
                          BLOCKED (READ-ONLY GATE)
                        </span>
                      )}
                      {isApproval && (
                        <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold text-[10px]">
                          APPROVAL GATED
                        </span>
                      )}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {desc}
                    </p>
                    {!isEnabled && (
                      <p className="font-label-mono text-[11px] text-amber-400/90 mt-1">
                        Requires write permission. Blocked in read-only integration configuration.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-space-xs font-label-mono text-label-mono shrink-0">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${riskBadgeClass(risk)}`}>
                      {risk}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
