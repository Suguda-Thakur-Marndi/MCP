"use client";

import React, { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, IntegrationListItem, ToolInfo } from "@/lib/api";
import { formatTime, riskBadgeClass } from "@/lib/utils";

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
          <span className="material-symbols-outlined text-[24px]">error</span>
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
          className="flex items-center gap-1 font-label-mono text-label-mono text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
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
            <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="cursor-pointer font-bold text-on-surface-variant hover:text-on-surface">
            ✕
          </button>
        </div>
      )}

      {/* Main Details Card */}
      <section className="bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container space-y-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-md pb-space-md border-b border-surface-container">
          <div>
            <div className="flex items-center gap-space-xs font-label-mono text-[11px] text-on-surface-variant mb-1">
              <span className="font-bold text-primary">{integration.category}</span>
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
            <span
              className={`px-space-sm py-1 rounded font-bold text-xs ${
                isConnected ? "bg-secondary text-on-secondary" : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {integration.live_status || integration.status}
            </span>
          </div>
        </div>

        {/* 4-Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm font-label-mono text-label-mono">
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Auth Type</span>
            <div className="font-bold text-on-surface mt-0.5 truncate">{integration.auth_type}</div>
          </div>
          <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
            <span className="text-[10px] text-on-surface-variant uppercase">Protocol</span>
            <div className="font-bold text-secondary mt-0.5 truncate">{integration.protocol_type}</div>
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

        {/* Actions Bar */}
        <div className="pt-space-sm border-t border-surface-container flex flex-wrap items-center gap-space-sm">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-ui text-label-ui font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {testing ? "sync" : "network_check"}
            </span>
            <span>{testing ? "Probing Integration..." : "Test Connection"}</span>
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

        {/* Test Result Box */}
        {testResult && (
          <div className="p-space-md bg-surface-container-low rounded-xl border border-surface-container space-y-1 font-label-mono text-label-mono">
            <div className="text-[10px] text-on-surface-variant uppercase font-semibold">
              Handshake Telemetry Response
            </div>
            <pre className="p-space-sm bg-surface-container rounded-lg text-code-sm text-on-surface overflow-x-auto border border-surface-container">
              {JSON.stringify(testResult, null, 2)}
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
            Governed by Sentinel Policy Engine
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
              const isApproval = Boolean(t.requires_approval);

              return (
                <div
                  key={idx}
                  className="p-space-md rounded-xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm"
                >
                  <div>
                    <div className="flex items-center gap-space-xs font-label-mono text-[11px] mb-0.5">
                      <span className="font-bold text-on-surface">{name}</span>
                      {isApproval && (
                        <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold text-[10px]">
                          APPROVAL GATED
                        </span>
                      )}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {desc}
                    </p>
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
