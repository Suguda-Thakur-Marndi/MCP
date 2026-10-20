"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Wrench,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Database,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  ExternalLink,
  Power,
  Key,
  Layers,
  Eye,
  EyeOff,
  Server,
  Zap,
} from "lucide-react";
import { api, IntegrationListItem } from "@/lib/api";

export default function IntegrationsPage() {
  const [items, setItems] = useState<IntegrationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notifications / Feedback
  const [bannerNotice, setBannerNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Per-card operation state (testing or disconnecting)
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, Record<string, unknown>>>({});
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Modals state
  const [notionModalOpen, setNotionModalOpen] = useState(false);
  const [notionTab, setNotionTab] = useState<"oauth" | "token">("oauth");
  const [notionToken, setNotionToken] = useState("");
  const [showNotionToken, setShowNotionToken] = useState(false);
  const [notionSubmitting, setNotionSubmitting] = useState(false);
  const [notionModalError, setNotionModalError] = useState<string | null>(null);

  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const [supabaseTab, setSupabaseTab] = useState<"form" | "uri">("form");
  const [supabaseHost, setSupabaseHost] = useState("");
  const [supabasePort, setSupabasePort] = useState(5432);
  const [supabaseDb, setSupabaseDb] = useState("postgres");
  const [supabaseUser, setSupabaseUser] = useState("postgres");
  const [supabasePassword, setSupabasePassword] = useState("");
  const [showSupabasePassword, setShowSupabasePassword] = useState(false);
  const [supabaseUri, setSupabaseUri] = useState("");
  const [supabaseSubmitting, setSupabaseSubmitting] = useState(false);
  const [supabaseModalError, setSupabaseModalError] = useState<string | null>(null);

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.integrations.list();
      setItems(list || []);
    } catch (err: unknown) {
      console.warn("Failed to load integrations:", err);
      setError("Unable to connect to integrations catalog. Verify backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();

    // Check query params on mount for OAuth redirects or errors
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connected = params.get("connected");
      const workspace = params.get("workspace");
      const err = params.get("error");

      if (connected === "notion") {
        setBannerNotice({
          type: "success",
          message: `Successfully connected Notion workspace ${workspace ? `"${workspace}"` : ""} via OAuth 2.0!`,
        });
        window.history.replaceState({}, "", "/integrations");
      } else if (err) {
        let msg = "Integration connection error.";
        if (err === "invalid_state") msg = "OAuth security state verification failed. Please try again.";
        else if (err === "token_exchange_failed") msg = "Failed to exchange Notion OAuth authorization code.";
        else if (err === "access_denied") msg = "Notion workspace authorization request was cancelled.";
        else msg = `Integration error: ${err}`;
        setBannerNotice({ type: "error", message: msg });
        window.history.replaceState({}, "", "/integrations");
      }
    }
  }, [loadIntegrations]);

  const notionItem = useMemo(() => items.find((i) => i.id === "notion"), [items]);
  const supabaseItem = useMemo(() => items.find((i) => i.id === "supabase"), [items]);

  const connectedCount = items.filter(
    (i) => (i.live_status || i.status) === "CONNECTED"
  ).length;

  // Handlers for Notion
  const handleTestConnection = async (integrationId: string) => {
    setTestingId(integrationId);
    try {
      const res = await api.integrations.test(integrationId);
      setTestResults((prev) => ({ ...prev, [integrationId]: res }));
      setBannerNotice({
        type: res.success ? "success" : "error",
        message: `${integrationId === "notion" ? "Notion" : "Supabase"}: ${res.message || (res.success ? "Probe passed" : "Probe failed")}`,
      });
      await loadIntegrations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Handshake probe failed.";
      setTestResults((prev) => ({
        ...prev,
        [integrationId]: { success: false, message: msg, latency_ms: 0 },
      }));
      setBannerNotice({ type: "error", message: msg });
    } finally {
      setTestingId(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!window.confirm(`Are you sure you want to disconnect ${integrationId === "notion" ? "Notion" : "Supabase"}? Active session tokens and connection pool handles will be revoked.`)) {
      return;
    }
    setDisconnectingId(integrationId);
    try {
      await api.integrations.disconnect(integrationId);
      setBannerNotice({
        type: "success",
        message: `Successfully disconnected ${integrationId === "notion" ? "Notion" : "Supabase"}. Gateway connection revoked.`,
      });
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[integrationId];
        return next;
      });
      await loadIntegrations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Disconnect failed.";
      setBannerNotice({ type: "error", message: msg });
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleNotionConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notionToken.trim()) {
      setNotionModalError("Integration token cannot be empty.");
      return;
    }

    setNotionSubmitting(true);
    setNotionModalError(null);
    try {
      const res = await api.integrations.connect("notion", {
        api_key: notionToken.trim(),
      });
      setNotionModalOpen(false);
      setNotionToken("");
      setBannerNotice({
        type: "success",
        message: String(res.message || "Connected to Notion workspace successfully."),
      });
      await loadIntegrations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect Notion.";
      setNotionModalError(msg);
    } finally {
      setNotionSubmitting(false);
    }
  };

  const handleNotionOAuthClick = async () => {
    setNotionSubmitting(true);
    setNotionModalError(null);
    try {
      const authUrl = await api.integrations.notionOAuthAuthorizeUrl();
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Notion OAuth 2.0 flow is not configured.";
      setNotionModalError(msg);
      setNotionSubmitting(false);
    }
  };

  const handleSupabaseConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseSubmitting(true);
    setSupabaseModalError(null);

    const payload =
      supabaseTab === "uri"
        ? { connection_string: supabaseUri.trim() }
        : {
            host: supabaseHost.trim(),
            port: Number(supabasePort) || 5432,
            database: supabaseDb.trim() || "postgres",
            username: supabaseUser.trim() || "postgres",
            password: supabasePassword,
            ssl_mode: "require",
          };

    try {
      const res = await api.integrations.connect("supabase", payload);
      setSupabaseModalOpen(false);
      setSupabasePassword("");
      setSupabaseUri("");
      setBannerNotice({
        type: "success",
        message: String(res.message || "Connected to Supabase PostgreSQL pool successfully."),
      });
      await loadIntegrations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to Supabase PostgreSQL.";
      setSupabaseModalError(msg);
    } finally {
      setSupabaseSubmitting(false);
    }
  };

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-xl">
      {/* Header Banner */}
      <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-xs border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-space-xxs">
            <span className="font-label-mono text-label-mono text-cyan-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              MULTI-SOFTWARE BOUNDARY GATEWAY
            </span>
            <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-surface-container text-on-surface-variant">
              {connectedCount} OF 2 ENTERPRISE CONNECTORS ACTIVE
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Connected Software &amp; Boundary Registry
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Zero-Trust enterprise data connections for Notion and Supabase. Every tool execution is evaluated by SentinelCore&apos;s Policy Engine in real time.
          </p>
        </div>

        <div className="flex items-center gap-space-xs font-label-mono text-label-mono">
          <button
            onClick={() => void loadIntegrations()}
            className="p-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            title="Reload Integrations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/tools"
            className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Wrench className="w-4 h-4" />
            <span>MCP Tools Inventory</span>
          </Link>
        </div>
      </section>

      {/* Dynamic Feedback Banner */}
      {bannerNotice && (
        <div
          className={`p-space-md rounded-xl font-label-mono text-label-mono flex items-center justify-between border shadow-xs ${
            bannerNotice.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-error-container text-on-error-container border-error/20"
          }`}
        >
          <div className="flex items-center gap-space-sm">
            {bannerNotice.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{bannerNotice.message}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="cursor-pointer text-on-surface-variant hover:text-on-surface p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Error State */}
      {error && (
        <div className="p-space-md rounded-xl bg-error-container text-on-error-container font-label-mono text-label-mono flex items-center justify-between border border-error/20">
          <span>{error}</span>
          <button onClick={() => void loadIntegrations()} className="cursor-pointer font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Dedicated Integrations Dashboard Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl">
        {/* ================================================================= */}
        {/* CARD 1: NOTION WORKSPACE */}
        {/* ================================================================= */}
        <div className="bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container flex flex-col justify-between gap-space-lg relative overflow-hidden">
          <div className="space-y-space-md">
            {/* Top Identity & Status */}
            <div className="flex items-start justify-between gap-space-sm pb-space-sm border-b border-surface-container">
              <div className="flex items-start gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-center text-2xl shadow-xs shrink-0">
                  📑
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                      Notion Workspace
                    </h2>
                    <span className="font-label-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-cyan-400 font-semibold border border-cyan-500/20">
                      REST API
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 max-w-md">
                    Official Notion API connector for searching pages, querying databases, and gating document archival with human approval.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {(() => {
                  const isConnected = (notionItem?.live_status || notionItem?.status) === "CONNECTED";
                  const isError = (notionItem?.live_status || notionItem?.status) === "ERROR";
                  return (
                    <span
                      className={`font-label-mono text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1.5 ${
                        isConnected
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : isError
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isConnected ? "bg-emerald-400 animate-pulse" : isError ? "bg-rose-400" : "bg-neutral-500"
                        }`}
                      ></span>
                      {notionItem?.live_status || notionItem?.status || "DISCONNECTED"}
                    </span>
                  );
                })()}

                <span
                  className={`font-label-mono text-[10px] px-2 py-0.5 rounded ${
                    notionItem?.credential_status === "CONFIGURED"
                      ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  }`}
                >
                  {notionItem?.credential_status === "CONFIGURED" ? "CREDENTIALS CONFIGURED" : "CREDENTIALS MISSING"}
                </span>
              </div>
            </div>

            {/* Workspace Information Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm font-label-mono text-label-mono text-xs">
              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Authorized Workspace</span>
                <span className="font-bold text-on-surface mt-0.5 truncate block">
                  {notionItem?.workspace_info?.workspace_name ||
                    (notionItem?.status === "CONNECTED" ? "Authorized Workspace" : "Not Connected")}
                </span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Bot Identity</span>
                <span className="font-bold text-cyan-400 mt-0.5 truncate block">
                  {notionItem?.workspace_info?.bot_name || "SentinelCore"}
                </span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">API Version</span>
                <span className="font-bold text-on-surface mt-0.5 block">2022-06-28</span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Capability Mode</span>
                <span
                  className={`font-bold mt-0.5 block ${
                    notionItem?.write_enabled ? "text-amber-400" : "text-cyan-400"
                  }`}
                >
                  {notionItem?.write_enabled ? "Read/Write (Gated)" : "Read-Only (Enforced)"}
                </span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Bound Tools</span>
                <span className="font-bold text-on-surface mt-0.5 block">4 FastMCP Tools</span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Connection Endpoint</span>
                <span className="font-bold text-on-surface mt-0.5 truncate block" title="https://api.notion.com/v1">
                  api.notion.com/v1
                </span>
              </div>
            </div>

            {/* Live Telemetry / Handshake Box if probe was run */}
            {(testResults["notion"] || notionItem?.last_test_result) && (
              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container font-label-mono text-label-mono text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant uppercase font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Probe Telemetry Result
                  </span>
                  {testResults["notion"]?.latency_ms !== undefined ? (
                    <span className="text-cyan-400">{String(testResults["notion"].latency_ms)} ms latency</span>
                  ) : notionItem?.last_test_result?.latency_ms !== undefined ? (
                    <span className="text-cyan-400">{notionItem.last_test_result.latency_ms} ms latency</span>
                  ) : null}
                </div>
                <div className="text-on-surface text-[11px] p-2 bg-surface-container rounded border border-surface-container">
                  {String(
                    testResults["notion"]?.message ||
                      notionItem?.last_test_result?.message ||
                      "Live handshake verified."
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-space-md border-t border-surface-container flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setNotionModalOpen(true)}
                className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-ui text-label-ui font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                id="btn-connect-notion"
              >
                <Key className="w-4 h-4" />
                <span>{(notionItem?.live_status || notionItem?.status) === "CONNECTED" ? "Reconfigure Notion" : "Connect Notion"}</span>
              </button>

              <button
                onClick={() => void handleTestConnection("notion")}
                disabled={testingId === "notion"}
                className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-ui text-label-ui font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                id="btn-test-notion"
              >
                <Activity className={`w-4 h-4 ${testingId === "notion" ? "animate-spin text-cyan-400" : ""}`} />
                <span>{testingId === "notion" ? "Testing API Handshake..." : "Test Connection"}</span>
              </button>

              {(notionItem?.live_status || notionItem?.status) === "CONNECTED" && (
                <button
                  onClick={() => void handleDisconnect("notion")}
                  disabled={disconnectingId === "notion"}
                  className="px-space-sm py-2 rounded-lg bg-surface-container text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors font-label-ui text-label-ui font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Revoke and Disconnect Notion Gateway"
                >
                  <Power className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>

            <Link
              href="/integrations/notion"
              className="font-label-ui text-label-ui text-primary hover:underline font-semibold flex items-center gap-1 text-xs"
            >
              <span>View 4 Bound Tools &amp; Policies</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* ================================================================= */}
        {/* CARD 2: SUPABASE POSTGRESQL POOL */}
        {/* ================================================================= */}
        <div className="bg-surface-container-lowest p-space-lg sm:p-space-xl rounded-xl shadow-xs border border-surface-container flex flex-col justify-between gap-space-lg relative overflow-hidden">
          <div className="space-y-space-md">
            {/* Top Identity & Status */}
            <div className="flex items-start justify-between gap-space-sm pb-space-sm border-b border-surface-container">
              <div className="flex items-start gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-center text-2xl shadow-xs shrink-0">
                  🗄️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                      Supabase PostgreSQL
                    </h2>
                    <span className="font-label-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-emerald-400 font-semibold border border-emerald-500/20">
                      ASYNC-POOL
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 max-w-md">
                    Enterprise Supabase database pool for customer, order, and audit persistence with strict zero-trust field policies and approval tickets.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {(() => {
                  const isConnected = (supabaseItem?.live_status || supabaseItem?.status) === "CONNECTED";
                  const isError = (supabaseItem?.live_status || supabaseItem?.status) === "ERROR";
                  return (
                    <span
                      className={`font-label-mono text-[11px] font-bold px-2.5 py-1 rounded flex items-center gap-1.5 ${
                        isConnected
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : isError
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isConnected ? "bg-emerald-400 animate-pulse" : isError ? "bg-rose-400" : "bg-neutral-500"
                        }`}
                      ></span>
                      {supabaseItem?.live_status || supabaseItem?.status || "DISCONNECTED"}
                    </span>
                  );
                })()}

                <span className="font-label-mono text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                  TLS ENFORCED
                </span>
              </div>
            </div>

            {/* Database & Pool Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm font-label-mono text-label-mono text-xs">
              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Target Host</span>
                <span className="font-bold text-on-surface mt-0.5 truncate block" title={supabaseItem?.project_info?.host || "supabase-pooler"}>
                  {supabaseItem?.project_info?.host || "supabase-pooler"}
                </span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Port &amp; Mode</span>
                <span className="font-bold text-cyan-400 mt-0.5 block">
                  {supabaseItem?.project_info?.port === 6543 ? "6543 (Tx Pooler)" : `${supabaseItem?.project_info?.port || 5432} (Session Pool)`}
                </span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Database</span>
                <span className="font-bold text-on-surface mt-0.5 block">
                  {supabaseItem?.project_info?.database || "postgres"}
                </span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Pool Statistics</span>
                <span className="font-bold text-emerald-400 mt-0.5 block">
                  {supabaseItem?.project_info?.pool
                    ? `${supabaseItem.project_info.pool.total} Total (${supabaseItem.project_info.pool.used} Used / ${supabaseItem.project_info.pool.free} Free)`
                    : "Active Pooler"}
                </span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Bound Tools</span>
                <span className="font-bold text-on-surface mt-0.5 block">8 FastMCP Tools</span>
              </div>

              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container">
                <span className="text-[10px] text-on-surface-variant uppercase block">Access Governance</span>
                <span className="font-bold text-amber-400 mt-0.5 block">Policy &amp; Ticket Gated</span>
              </div>
            </div>

            {/* Live Telemetry / Handshake Box if probe was run */}
            {(testResults["supabase"] || supabaseItem?.last_test_result) && (
              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container font-label-mono text-label-mono text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-on-surface-variant uppercase font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Database Probe Telemetry
                  </span>
                  {testResults["supabase"]?.latency_ms !== undefined ? (
                    <span className="text-cyan-400">{String(testResults["supabase"].latency_ms)} ms latency</span>
                  ) : supabaseItem?.last_test_result?.latency_ms !== undefined ? (
                    <span className="text-cyan-400">{supabaseItem.last_test_result.latency_ms} ms latency</span>
                  ) : null}
                </div>
                <div className="text-on-surface text-[11px] p-2 bg-surface-container rounded border border-surface-container">
                  {String(
                    testResults["supabase"]?.message ||
                      supabaseItem?.last_test_result?.message ||
                      "Supabase PostgreSQL pool connection verified."
                  )}
                  {(testResults["supabase"]?.server_version || supabaseItem?.last_test_result?.server_version) && (
                    <div className="text-[10px] text-on-surface-variant mt-1">
                      Engine: {String(testResults["supabase"]?.server_version || supabaseItem?.last_test_result?.server_version)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-space-md border-t border-surface-container flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSupabaseModalOpen(true)}
                className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-ui text-label-ui font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
                id="btn-connect-supabase"
              >
                <Database className="w-4 h-4" />
                <span>Configure Supabase Pool</span>
              </button>

              <button
                onClick={() => void handleTestConnection("supabase")}
                disabled={testingId === "supabase"}
                className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-ui text-label-ui font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                id="btn-test-supabase"
              >
                <Activity className={`w-4 h-4 ${testingId === "supabase" ? "animate-spin text-cyan-400" : ""}`} />
                <span>{testingId === "supabase" ? "Testing Pool Connection..." : "Test Connection"}</span>
              </button>

              {(supabaseItem?.live_status || supabaseItem?.status) === "CONNECTED" && (
                <button
                  onClick={() => void handleDisconnect("supabase")}
                  disabled={disconnectingId === "supabase"}
                  className="px-space-sm py-2 rounded-lg bg-surface-container text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors font-label-ui text-label-ui font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Disconnect Database Pool"
                >
                  <Power className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>

            <Link
              href="/integrations/supabase"
              className="font-label-ui text-label-ui text-primary hover:underline font-semibold flex items-center gap-1 text-xs"
            >
              <span>View 8 Bound Tools &amp; Policies</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* NOTION CONNECTION MODAL */}
      {/* ===================================================================== */}
      {notionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-surface-container rounded-2xl max-w-lg w-full p-space-lg shadow-xl space-y-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="text-xl">📑</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Connect Notion Workspace
                </h3>
              </div>
              <button
                onClick={() => setNotionModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-surface-container font-label-mono text-label-mono text-xs">
              <button
                onClick={() => setNotionTab("oauth")}
                className={`flex-1 py-2 text-center border-b-2 font-bold transition-colors cursor-pointer ${
                  notionTab === "oauth"
                    ? "border-cyan-400 text-cyan-400"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                User OAuth 2.0
              </button>
              <button
                onClick={() => setNotionTab("token")}
                className={`flex-1 py-2 text-center border-b-2 font-bold transition-colors cursor-pointer ${
                  notionTab === "token"
                    ? "border-cyan-400 text-cyan-400"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Administrator Integration Token
              </button>
            </div>

            {notionModalError && (
              <div className="p-space-sm bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-300 font-label-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{notionModalError}</span>
              </div>
            )}

            {notionTab === "oauth" ? (
              <div className="space-y-space-md font-body-sm text-body-sm">
                <p className="text-on-surface-variant text-xs">
                  Authorize SentinelCore to interact with pages and databases across your Notion workspace using Notion&apos;s official OAuth 2.0 consent flow.
                </p>

                <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container space-y-1 text-xs font-label-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">OAuth Redirect URI:</span>
                    <span className="text-cyan-400 truncate max-w-[240px]">
                      /api/integrations/notion/oauth/callback
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">OAuth Status:</span>
                    <span className={notionItem?.oauth_configured ? "text-emerald-400 font-bold" : "text-amber-400"}>
                      {notionItem?.oauth_configured ? "Configured on Gateway" : "Credentials Required in .env"}
                    </span>
                  </div>
                </div>

                {!notionItem?.oauth_configured && (
                  <p className="text-[11px] text-amber-400/90 font-label-mono bg-amber-500/10 p-2.5 rounded border border-amber-500/20">
                    Note: To use user-authorized OAuth, set <code>NOTION_CLIENT_ID</code> and <code>NOTION_CLIENT_SECRET</code> in <code>.env</code>. Alternatively, switch to the <strong>Administrator Integration Token</strong> tab.
                  </p>
                )}

                <div className="pt-space-sm flex justify-end gap-space-sm">
                  <button
                    type="button"
                    onClick={() => setNotionModalOpen(false)}
                    className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-ui text-label-ui text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNotionOAuthClick}
                    disabled={notionSubmitting}
                    className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-ui text-label-ui text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{notionSubmitting ? "Redirecting..." : "Continue with Notion OAuth"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleNotionConnectSubmit} className="space-y-space-md font-body-sm text-body-sm">
                <p className="text-on-surface-variant text-xs">
                  Supply an internal Notion integration token (starts with <code>secret_</code> or <code>ntn_</code>). The token is encrypted using AES-256-GCM and never revealed to the browser or in logs.
                </p>

                <div className="space-y-1">
                  <label className="font-label-mono text-label-mono text-xs text-on-surface block font-semibold">
                    Notion Integration Token
                  </label>
                  <div className="relative">
                    <input
                      type={showNotionToken ? "text" : "password"}
                      value={notionToken}
                      onChange={(e) => setNotionToken(e.target.value)}
                      placeholder="secret_... or ntn_..."
                      className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant px-space-md py-2 rounded-lg font-label-mono text-xs border border-surface-container outline-hidden focus:border-primary pr-9"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNotionToken(!showNotionToken)}
                      className="absolute right-2.5 top-2 text-on-surface-variant hover:text-on-surface cursor-pointer"
                      title={showNotionToken ? "Hide token" : "Show token"}
                    >
                      {showNotionToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-space-sm flex justify-end gap-space-sm">
                  <button
                    type="button"
                    onClick={() => setNotionModalOpen(false)}
                    className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-ui text-label-ui text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={notionSubmitting || !notionToken.trim()}
                    className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-ui text-label-ui text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{notionSubmitting ? "Validating Token..." : "Save & Verify Token"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUPABASE CONNECTION MODAL */}
      {/* ===================================================================== */}
      {supabaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-surface-container rounded-2xl max-w-lg w-full p-space-lg shadow-xl space-y-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="text-xl">🗄️</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Configure Supabase Connection
                </h3>
              </div>
              <button
                onClick={() => setSupabaseModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-surface-container font-label-mono text-label-mono text-xs">
              <button
                onClick={() => setSupabaseTab("form")}
                className={`flex-1 py-2 text-center border-b-2 font-bold transition-colors cursor-pointer ${
                  supabaseTab === "form"
                    ? "border-cyan-400 text-cyan-400"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Connection Details
              </button>
              <button
                onClick={() => setSupabaseTab("uri")}
                className={`flex-1 py-2 text-center border-b-2 font-bold transition-colors cursor-pointer ${
                  supabaseTab === "uri"
                    ? "border-cyan-400 text-cyan-400"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                }`}
              >
                PostgreSQL URI
              </button>
            </div>

            {supabaseModalError && (
              <div className="p-space-sm bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-300 font-label-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{supabaseModalError}</span>
              </div>
            )}

            <form onSubmit={handleSupabaseConnectSubmit} className="space-y-space-md font-body-sm text-body-sm">
              {supabaseTab === "form" ? (
                <div className="space-y-3 font-label-mono text-xs">
                  <div className="space-y-1">
                    <label className="text-on-surface block font-semibold">Supabase Host / Pooler Endpoint</label>
                    <input
                      type="text"
                      value={supabaseHost}
                      onChange={(e) => setSupabaseHost(e.target.value)}
                      placeholder="aws-0-ap-northeast-2.pooler.supabase.com"
                      className="w-full bg-surface-container-low text-on-surface px-space-md py-2 rounded-lg border border-surface-container outline-hidden focus:border-primary"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-space-sm">
                    <div className="space-y-1">
                      <label className="text-on-surface block font-semibold">Port</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={supabasePort}
                          onChange={(e) => setSupabasePort(Number(e.target.value))}
                          className="w-full bg-surface-container-low text-on-surface px-space-md py-2 rounded-lg border border-surface-container outline-hidden focus:border-primary"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setSupabasePort(supabasePort === 5432 ? 6543 : 5432)}
                          className="px-2 py-2 bg-surface-container text-cyan-400 rounded text-[10px] font-bold border border-surface-container whitespace-nowrap cursor-pointer hover:bg-surface-container-high"
                          title="Toggle between 5432 (Session) and 6543 (Transaction Pooler)"
                        >
                          {supabasePort === 5432 ? "→ 6543 Tx" : "→ 5432 Ses"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-on-surface block font-semibold">Database Name</label>
                      <input
                        type="text"
                        value={supabaseDb}
                        onChange={(e) => setSupabaseDb(e.target.value)}
                        placeholder="postgres"
                        className="w-full bg-surface-container-low text-on-surface px-space-md py-2 rounded-lg border border-surface-container outline-hidden focus:border-primary"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-space-sm">
                    <div className="space-y-1">
                      <label className="text-on-surface block font-semibold">Username</label>
                      <input
                        type="text"
                        value={supabaseUser}
                        onChange={(e) => setSupabaseUser(e.target.value)}
                        placeholder="postgres or postgres.projectref"
                        className="w-full bg-surface-container-low text-on-surface px-space-md py-2 rounded-lg border border-surface-container outline-hidden focus:border-primary"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-on-surface block font-semibold">Password</label>
                      <div className="relative">
                        <input
                          type={showSupabasePassword ? "text" : "password"}
                          value={supabasePassword}
                          onChange={(e) => setSupabasePassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-surface-container-low text-on-surface px-space-md py-2 rounded-lg border border-surface-container outline-hidden focus:border-primary pr-8"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSupabasePassword(!showSupabasePassword)}
                          className="absolute right-2 top-2 text-on-surface-variant hover:text-on-surface cursor-pointer"
                        >
                          {showSupabasePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-space-xs bg-surface-container-low rounded border border-surface-container flex items-center justify-between text-[11px]">
                    <span className="text-on-surface-variant">TLS / SSL Mode:</span>
                    <span className="text-emerald-400 font-bold">require (Enforced)</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 font-label-mono text-xs">
                  <label className="text-on-surface block font-semibold">PostgreSQL Connection DSN</label>
                  <textarea
                    rows={3}
                    value={supabaseUri}
                    onChange={(e) => setSupabaseUri(e.target.value)}
                    placeholder="postgresql://postgres.xxx:password@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
                    className="w-full bg-surface-container-low text-on-surface p-space-md rounded-lg border border-surface-container outline-hidden focus:border-primary resize-none"
                    required
                  />
                  <p className="text-[11px] text-on-surface-variant">
                    Credentials are encrypted with AES-256-GCM before saving and scrubbed from error logs.
                  </p>
                </div>
              )}

              <div className="pt-space-sm flex justify-end gap-space-sm">
                <button
                  type="button"
                  onClick={() => setSupabaseModalOpen(false)}
                  className="px-space-md py-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-label-ui text-label-ui text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supabaseSubmitting}
                  className="px-space-md py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-ui text-label-ui text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{supabaseSubmitting ? "Testing Connection..." : "Test & Connect Pool"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
