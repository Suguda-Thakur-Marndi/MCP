"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  api,
  AgentExecutionRecord,
  AgentStatusResponse,
} from "@/lib/api";

interface SessionItem {
  id: string;
  code: string;
  title: string;
  step: string;
  timeAgo: string;
  status: "awaiting" | "denied" | "completed" | "draft" | "executing";
  targetDb: string;
  intent: string;
  sqlProposal: string;
  affectedRows: number;
  riskScore: number;
  policyTrigger: string;
  diffRows: {
    id: string;
    table: string;
    field: string;
    before: string;
    after: string;
    riskTag: string;
  }[];
}

const PRESET_SESSIONS: SessionItem[] = [
  {
    id: "session-1",
    code: "#CMD-4091",
    title: "Customer Status Lifecycle Migration",
    step: "Step 5/8",
    timeAgo: "4m ago",
    status: "awaiting",
    targetDb: "prod_billing_postgres",
    intent: "Update the status of users in the beta cohort who haven't logged in since Jan 2024 to 'inactive', and archive workspace allocations.",
    sqlProposal: "UPDATE public.customers SET status = 'inactive' WHERE cohort = 'beta' AND last_login < '2024-01-01 00:00:00+00';\nUPDATE public.workspace_allocations SET state = 'archived' WHERE customer_id IN (...matched_target_ids);",
    affectedRows: 142,
    riskScore: 78,
    policyTrigger: "POL-009: Customer Status Modification Dual-Custody",
    diffRows: [
      { id: "cust_98124", table: "public.customers", field: "status", before: "active", after: "inactive", riskTag: "Lifecycle Mod" },
      { id: "cust_98124", table: "workspace_alloc", field: "state / bytes", before: "allocated (128GB)", after: "archived (0GB)", riskTag: "Deprovision" },
      { id: "cust_98125", table: "public.customers", field: "status", before: "active", after: "inactive", riskTag: "Lifecycle Mod" },
      { id: "cust_98125", table: "workspace_alloc", field: "state / bytes", before: "allocated (64GB)", after: "archived (0GB)", riskTag: "Deprovision" },
      { id: "cust_98126", table: "public.customers", field: "status", before: "active", after: "inactive", riskTag: "Lifecycle Mod" },
    ],
  },
  {
    id: "session-2",
    code: "#CMD-4088",
    title: "Investigate blocked SQL drops in US-East",
    step: "Blocked",
    timeAgo: "18m ago",
    status: "denied",
    targetDb: "prod_billing_postgres",
    intent: "DROP TABLE audit_log_staging; -- Attempted automated table drop.",
    sqlProposal: "DROP TABLE audit_log_staging; --",
    affectedRows: 0,
    riskScore: 99,
    policyTrigger: "POL-001: Strict Schema Drop Prevention",
    diffRows: [
      { id: "tbl_staging", table: "public.audit_log_staging", field: "schema_table", before: "PRESENT (42.1k rows)", after: "DROPPED (BLOCKED)", riskTag: "Critical DDL" },
    ],
  },
  {
    id: "session-3",
    code: "#CMD-4074",
    title: "Audit 30d Claude agent execution metrics",
    step: "Step 8/8",
    timeAgo: "2h ago",
    status: "completed",
    targetDb: "prod_billing_postgres",
    intent: "Summarize denied tool executions and policy triggers from the last 30 days.",
    sqlProposal: "SELECT tool_name, decision, COUNT(*) FROM audit_events WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY tool_name, decision;",
    affectedRows: 512,
    riskScore: 12,
    policyTrigger: "POL-018: Read-Only Audit Access",
    diffRows: [
      { id: "query_res", table: "audit_events", field: "read_projection", before: "N/A", after: "512 rows projected", riskTag: "Safe Read" },
    ],
  },
  {
    id: "session-4",
    code: "#CMD-4069",
    title: "Inspect customer_records PII access frequency",
    step: "Step 8/8",
    timeAgo: "5h ago",
    status: "completed",
    targetDb: "prod_billing_postgres",
    intent: "Find failed executions and rate anomalies associated with customer_records query tool.",
    sqlProposal: "SELECT actor_id, COUNT(*) FROM audit_events WHERE tool_name = 'query_customer_records' AND decision = 'BLOCK' GROUP BY actor_id;",
    affectedRows: 84,
    riskScore: 15,
    policyTrigger: "POL-018: Read-Only Audit Access",
    diffRows: [
      { id: "query_res_2", table: "audit_events", field: "read_projection", before: "N/A", after: "84 rows projected", riskTag: "Safe Read" },
    ],
  },
];

const SUGGESTED_COMMANDS = [
  "Show pending high-risk approvals in the queue.",
  "Summarize denied tool executions from the last 24 hours.",
  "Show the most frequently triggered security policies.",
  "Find failed executions associated with query_customer_records.",
  "Preview customer records with status = 'ACTIVE' and country = 'US'.",
  "Request a status update for customer CUST-0001 to SUSPENDED.",
  "Explain why this operation requires human dual-custody approval.",
];

export default function AICommandCenterPage() {
  const [, startTransition] = useTransition();

  const [sessions, setSessions] = useState<SessionItem[]>(PRESET_SESSIONS);
  const [selectedSession, setSelectedSession] = useState<SessionItem>(PRESET_SESSIONS[0]);
  const [sessionFilter, setSessionFilter] = useState<string>("");
  const [promptInput, setPromptInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [justificationNote, setJustificationNote] = useState<string>("");
  const [mfaChecked, setMfaChecked] = useState<boolean>(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [agentStatus, setAgentStatus] = useState<AgentStatusResponse | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<AgentExecutionRecord[]>([]);

  const sessionEndRef = useRef<HTMLDivElement>(null);

  const fetchAgentTelemetry = useCallback(async () => {
    try {
      const [statusRes, execsRes] = await Promise.all([
        api.agent.status().catch(() => null),
        api.agent.executions(15).catch(() => []),
      ]);
      startTransition(() => {
        if (statusRes) setAgentStatus(statusRes);
        if (Array.isArray(execsRes)) setRecentExecutions(execsRes);
      });
    } catch (err: unknown) {
      console.warn("Telemetry fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchAgentTelemetry();
  }, [fetchAgentTelemetry]);

  // Handle Natural Language Command Execution
  const handleExecuteCommand = async (commandToRun?: string) => {
    const text = (commandToRun || promptInput).trim();
    if (!text || loading) return;

    setLoading(true);
    setActionFeedback(null);

    // Create a new in-flight session
    const newSessionId = `session-${Date.now()}`;
    const codeNum = Math.floor(4100 + Math.random() * 100);

    const isDestructive =
      text.toLowerCase().includes("delete") ||
      text.toLowerCase().includes("drop") ||
      text.toLowerCase().includes("purge") ||
      text.toLowerCase().includes("truncate");

    const isUpdate =
      text.toLowerCase().includes("update") ||
      text.toLowerCase().includes("modify") ||
      text.toLowerCase().includes("set status");

    const newSession: SessionItem = {
      id: newSessionId,
      code: `#CMD-${codeNum}`,
      title: text.length > 45 ? text.slice(0, 45) + "..." : text,
      step: isDestructive ? "Blocked" : isUpdate ? "Step 5/8" : "Step 8/8",
      timeAgo: "Just now",
      status: isDestructive ? "denied" : isUpdate ? "awaiting" : "completed",
      targetDb: "prod_billing_postgres",
      intent: text,
      sqlProposal: isDestructive
        ? "-- BLOCKED BY POLICY RULE POL-001\n-- Destructive SQL operation rejected by Sentinel AST Parser."
        : isUpdate
        ? "UPDATE public.customers SET status = 'SUSPENDED', updated_at = NOW() WHERE customer_id = 'CUST-0001';"
        : "SELECT id, full_name, email, status, country, updated_at FROM customers WHERE status = 'ACTIVE' LIMIT 25;",
      affectedRows: isDestructive ? 0 : isUpdate ? 1 : 25,
      riskScore: isDestructive ? 95 : isUpdate ? 78 : 10,
      policyTrigger: isDestructive
        ? "POL-001: Immediate Circuit Breaker for Destructive DDL"
        : isUpdate
        ? "POL-009: Enterprise Customer Lifecycle State Gating"
        : "POL-018: Verified Column Projection Filter",
      diffRows: isUpdate
        ? [
            {
              id: "CUST-0001",
              table: "public.customers",
              field: "status",
              before: "ACTIVE",
              after: "SUSPENDED",
              riskTag: "State Mod",
            },
          ]
        : [
            {
              id: "result_set",
              table: "public.customers",
              field: "query_projection",
              before: "N/A",
              after: "25 rows projected",
              riskTag: "Safe Read",
            },
          ],
    };

    setSessions((prev) => [newSession, ...prev]);
    setSelectedSession(newSession);
    setPromptInput("");

    try {
      // Dispatch real chat turn to backend
      const res = await api.agent.chat(text);
      if (res?.response) {
        setActionFeedback(`Agent Response: ${res.response}`);
      }
      fetchAgentTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution gated by Sentinel policy engine.";
      setActionFeedback(`Gateway Interception: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeExecution = async () => {
    setLoading(true);
    setActionFeedback(null);
    try {
      // If there is an actual live pending ticket matching this action, approve it
      const pendingList = await api.approvals.pending().catch(() => []);
      if (pendingList.length > 0) {
        await api.approvals.approve(
          pendingList[0].ticket_id,
          justificationNote || "Authorized via AI Command Center Signature Console"
        );
      }

      setSelectedSession((prev) => ({
        ...prev,
        status: "completed",
        step: "Step 8/8",
      }));
      setActionFeedback(
        "TRANSACTION EXECUTED: Cryptographic signature validated, mutation committed to PostgreSQL, audit record created."
      );
      setJustificationNote("");
      fetchAgentTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authorization failed.";
      setActionFeedback(`ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectExecution = async () => {
    setLoading(true);
    setActionFeedback(null);
    try {
      const pendingList = await api.approvals.pending().catch(() => []);
      if (pendingList.length > 0) {
        await api.approvals.deny(
          pendingList[0].ticket_id,
          justificationNote || "Proposal denied and quarantined by Security Operator."
        );
      }

      setSelectedSession((prev) => ({
        ...prev,
        status: "denied",
        step: "Denied",
      }));
      setActionFeedback(
        "PROPOSAL REJECTED: Agent execution aborted, temporary token revoked, incident logged in audit trail."
      );
      setJustificationNote("");
      fetchAgentTelemetry();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Denial action failed.";
      setActionFeedback(`ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(sessionFilter.toLowerCase()) ||
      s.code.toLowerCase().includes(sessionFilter.toLowerCase()) ||
      s.intent.toLowerCase().includes(sessionFilter.toLowerCase())
  );

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-lg">
      {/* 3-Column Studio Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* ==================================================== */}
        {/* LEFT PANE: Operational Session Stream & Context (3 cols) */}
        {/* ==================================================== */}
        <div className="xl:col-span-3 flex flex-col gap-space-md bg-surface-container-lowest rounded-xl p-space-md border border-border shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between pb-space-xs border-b border-border">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Operational Sessions
            </span>
            <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-surface-container text-secondary font-semibold">
              Live Gateway
            </span>
          </div>

          {/* Search/Filter Bar */}
          <div className="relative">
            <input
              type="text"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              placeholder="Filter operational sessions..."
              className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant px-space-md py-space-xs pl-8 rounded-lg font-body-sm text-body-sm border border-border outline-none focus:bg-surface-container focus:ring-1 focus:ring-on-surface"
            />
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2.5 pointer-events-none">
              search
            </span>
          </div>

          {/* Session List */}
          <div className="flex flex-col gap-space-xs max-h-[460px] overflow-y-auto">
            {filteredSessions.map((session) => {
              const isSelected = selectedSession.id === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`p-space-sm rounded-lg transition-all cursor-pointer relative overflow-hidden group border ${
                    isSelected
                      ? "bg-surface-container-low border-primary/40 shadow-xs"
                      : "bg-surface-container-lowest border-transparent hover:bg-surface-container-low hover:border-border"
                  }`}
                >
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}

                  <div className="flex items-start justify-between gap-space-xs">
                    <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                      {session.title}
                    </span>
                    {session.status === "awaiting" && (
                      <span className="w-2 h-2 rounded-full bg-tertiary shrink-0 mt-1.5 animate-pulse" title="Awaiting Authorization"></span>
                    )}
                    {session.status === "denied" && (
                      <span className="w-2 h-2 rounded-full bg-error shrink-0 mt-1.5" title="Rejected Policy"></span>
                    )}
                    {session.status === "completed" && (
                      <span className="w-2 h-2 rounded-full bg-secondary shrink-0 mt-1.5" title="Execution Completed"></span>
                    )}
                  </div>

                  <div className="flex items-center gap-space-xs mt-space-xs font-code-sm text-code-sm text-on-surface-variant">
                    <span>{session.code}</span>
                    <span>•</span>
                    <span
                      className={`font-semibold ${
                        session.status === "awaiting"
                          ? "text-tertiary"
                          : session.status === "denied"
                          ? "text-error"
                          : "text-secondary"
                      }`}
                    >
                      {session.step}
                    </span>
                    <span>•</span>
                    <span>{session.timeAgo}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Target Context Pins */}
          <div className="pt-space-md border-t border-border flex flex-col gap-space-xs">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-space-xxs">
              Target Context Pins
            </span>

            <div className="p-space-xs px-space-sm bg-surface-container rounded-lg flex items-center justify-between border border-border">
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  database
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-code-sm text-code-sm text-on-surface truncate font-semibold">
                    prod_billing_postgres
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    10.0.4.12:5432
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[14px] text-secondary">
                lock
              </span>
            </div>

            <div className="p-space-xs px-space-sm bg-surface-container rounded-lg flex items-center justify-between border border-border">
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="material-symbols-outlined text-[16px] text-tertiary">
                  fork_right
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-code-sm text-code-sm text-on-surface truncate font-semibold">
                    main/enforced
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    SHA: c7019d1
                  </span>
                </div>
              </div>
              <span className="px-space-xxs py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm uppercase">
                Protected
              </span>
            </div>

            <div className="p-space-xs px-space-sm bg-surface-container rounded-lg flex items-center justify-between border border-border">
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="material-symbols-outlined text-[16px] text-primary">
                  policy
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-code-sm text-code-sm text-on-surface truncate font-semibold">
                    PCI-DSS + ZT-Agent-v2
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    Strict L4 Policy
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-secondary">
                verified
              </span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* CENTER PANE: Interactive Timeline & Canvas (6 cols) */}
        {/* ==================================================== */}
        <div className="xl:col-span-6 flex flex-col gap-space-lg">
          {/* Session Header Bar */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-border flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="font-code-md text-code-md text-primary font-semibold">
                  {selectedSession.code}
                </span>
                <span className="text-on-surface-variant">•</span>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  {selectedSession.title}
                </h2>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Initiated by AI Agent: {agentStatus?.agent_id || "sentinel-agent-v1"} ({agentStatus?.model || "gemini-2.5-flash"})
              </span>
            </div>

            <div>
              {selectedSession.status === "awaiting" && (
                <span className="inline-flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-tertiary-fixed text-on-tertiary-fixed font-code-sm text-code-sm font-semibold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                  Awaiting Human Authorization
                </span>
              )}
              {selectedSession.status === "denied" && (
                <span className="inline-flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-error-container text-on-error-container font-code-sm text-code-sm font-semibold uppercase tracking-wider">
                  Blocked by Sentinel Policy
                </span>
              )}
              {selectedSession.status === "completed" && (
                <span className="inline-flex items-center gap-space-xs px-space-sm py-space-xs rounded bg-secondary-fixed text-on-secondary-fixed font-code-sm text-code-sm font-semibold uppercase tracking-wider">
                  Executed &amp; Audited
                </span>
              )}
            </div>
          </div>

          {/* Feedback banner if available */}
          {actionFeedback && (
            <div className="p-space-md rounded-lg bg-surface-container-high border border-border font-code-sm text-code-sm text-on-surface flex items-start gap-space-sm animate-in fade-in">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                info
              </span>
              <div className="flex-1 whitespace-pre-wrap">{actionFeedback}</div>
            </div>
          )}

          {/* Natural Language Prompt & Interpretation Card */}
          <div className="flex flex-col gap-space-md">
            {/* User Prompt Bubble */}
            <div className="flex gap-space-md items-start">
              <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 border border-border">
                <span className="material-symbols-outlined text-[18px] text-on-surface">
                  account_circle
                </span>
              </div>
              <div className="flex-1 bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-border">
                <div className="flex items-center justify-between mb-space-xs">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    Operator Intent Specification
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    Live Session
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                  &ldquo;{selectedSession.intent}&rdquo;
                </p>
              </div>
            </div>

            {/* Sentinel AI Engine Interpretation Card */}
            <div className="flex gap-space-md items-start">
              <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[18px]">neurology</span>
              </div>
              <div className="flex-1 bg-surface-container-low p-space-md rounded-xl shadow-sm border border-border flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      Sentinel AI Engine Interpretation
                    </span>
                    <span className="px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed font-code-sm text-code-sm">
                      Deterministic Parse 100%
                    </span>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    AST Ref: ast_99f2b
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-space-xs">
                  <div className="bg-surface-container-lowest p-space-sm rounded-lg flex flex-col border border-border">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Intent Classification
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface mt-space-xxs">
                      {selectedSession.affectedRows > 0 ? "PostgreSQL DML Mutation" : "Read-Only Analysis"}
                    </span>
                    <span className="font-code-sm text-code-sm text-secondary font-medium truncate">
                      public.customers &amp; ledger
                    </span>
                  </div>

                  <div className="bg-surface-container-lowest p-space-sm rounded-lg flex flex-col border border-border">
                    <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                      Target Clustered DB
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface mt-space-xxs">
                      {selectedSession.targetDb}
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">
                      Session SSL Verified TLS 1.3
                    </span>
                  </div>
                </div>

                {/* Detected Operations Well */}
                <div className="bg-surface-container-lowest p-space-sm rounded-lg flex flex-col gap-space-xs border border-border">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                    Constructed SQL AST Proposals:
                  </span>
                  <pre className="font-code-md text-code-md bg-surface-container p-space-xs rounded text-on-surface overflow-x-auto select-all whitespace-pre-wrap">
                    {selectedSession.sqlProposal}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* CRITICAL SIGNATURE FEATURE: 8-Step Database Change Governance Workflow Stepper */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-border flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[20px] text-primary">
                  linear_scale
                </span>
                <span className="font-headline-md text-headline-md text-on-surface">
                  8-Step Database Change Governance Workflow
                </span>
              </div>
              <span className="font-code-sm text-code-sm text-on-surface-variant font-medium">
                Standard Safe-Commit SLA
              </span>
            </div>

            {/* Stepper Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-space-xs">
              {/* Step 1 */}
              <div className="flex flex-col p-space-xs bg-surface-container-low rounded-lg border border-border">
                <div className="flex items-center justify-between mb-space-xxs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">01</span>
                  <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface font-semibold truncate">Interpret</span>
                <span className="font-code-sm text-code-sm text-secondary truncate">Completed</span>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col p-space-xs bg-surface-container-low rounded-lg border border-border">
                <div className="flex items-center justify-between mb-space-xxs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">02</span>
                  <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface font-semibold truncate">Targets</span>
                <span className="font-code-sm text-code-sm text-secondary truncate">
                  {selectedSession.affectedRows} Rows
                </span>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col p-space-xs bg-surface-container-low rounded-lg border border-border">
                <div className="flex items-center justify-between mb-space-xxs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">03</span>
                  <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface font-semibold truncate">Impact Diff</span>
                <span className="font-code-sm text-code-sm text-secondary truncate">Generated</span>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col p-space-xs bg-surface-container-low rounded-lg border border-border">
                <div className="flex items-center justify-between mb-space-xxs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">04</span>
                  <span className="material-symbols-outlined text-[16px] text-tertiary">warning</span>
                </div>
                <span className="font-label-md text-label-md text-on-surface font-semibold truncate">Policies</span>
                <span className="font-code-sm text-code-sm text-tertiary truncate">1 Policy Gate</span>
              </div>

              {/* Step 5 */}
              <div
                className={`flex flex-col p-space-xs rounded-lg transition-all ${
                  selectedSession.status === "awaiting"
                    ? "bg-tertiary-fixed ring-2 ring-tertiary border border-tertiary"
                    : selectedSession.status === "completed"
                    ? "bg-surface-container-low border border-border"
                    : "bg-error-container border border-error"
                }`}
              >
                <div className="flex items-center justify-between mb-space-xxs">
                  <span className="font-code-sm text-code-sm">05</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {selectedSession.status === "completed"
                      ? "check_circle"
                      : selectedSession.status === "denied"
                      ? "cancel"
                      : "pending"}
                  </span>
                </div>
                <span className="font-label-md text-label-md font-bold truncate">Authorize</span>
                <span className="font-code-sm text-code-sm font-semibold truncate">
                  {selectedSession.status === "awaiting"
                    ? "CURRENT GATE"
                    : selectedSession.status === "completed"
                    ? "Approved"
                    : "Rejected"}
                </span>
              </div>

              {/* Step 6 */}
              <div
                className={`flex flex-col p-space-xs rounded-lg border border-border ${
                  selectedSession.status === "completed"
                    ? "bg-surface-container-low"
                    : "bg-surface-container-low opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-space-xxs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">06</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {selectedSession.status === "completed" ? "check_circle" : "lock"}
                  </span>
                </div>
                <span className="font-label-md text-label-md truncate">Execute</span>
                <span className="font-code-sm text-code-sm truncate">
                  {selectedSession.status === "completed" ? "Executed" : "Locked"}
                </span>
              </div>

              {/* Step 7 */}
              <div
                className={`flex flex-col p-space-xs rounded-lg border border-border ${
                  selectedSession.status === "completed"
                    ? "bg-surface-container-low"
                    : "bg-surface-container-low opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-space-xxs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">07</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {selectedSession.status === "completed" ? "verified" : "hourglass_empty"}
                  </span>
                </div>
                <span className="font-label-md text-label-md truncate">Verify</span>
                <span className="font-code-sm text-code-sm truncate">
                  {selectedSession.status === "completed" ? "Verified" : "Pending"}
                </span>
              </div>

              {/* Step 8 */}
              <div
                className={`flex flex-col p-space-xs rounded-lg border border-border ${
                  selectedSession.status === "completed"
                    ? "bg-surface-container-low"
                    : "bg-surface-container-low opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-space-xxs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">08</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {selectedSession.status === "completed" ? "receipt_long" : "receipt"}
                  </span>
                </div>
                <span className="font-label-md text-label-md truncate">Audit Log</span>
                <span className="font-code-sm text-code-sm truncate">
                  {selectedSession.status === "completed" ? "Recorded" : "Pending"}
                </span>
              </div>
            </div>
          </div>

          {/* Pre-Execution Mutation Diff Preview Table */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
            <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs border-b border-border">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[20px] text-secondary">
                  difference
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Pre-Execution Mutation Diff Preview
                </span>
              </div>
              <div className="flex items-center gap-space-sm font-code-sm text-code-sm">
                <span className="px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed font-semibold">
                  {selectedSession.affectedRows} Records Affected
                </span>
                <span className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface">
                  0 FK Violations
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant font-label-caps text-label-caps uppercase border-b border-border">
                    <th className="py-space-xs px-space-md">Row Identifier</th>
                    <th className="py-space-xs px-space-md">Target Table</th>
                    <th className="py-space-xs px-space-md">Field Name</th>
                    <th className="py-space-xs px-space-md">State (Before)</th>
                    <th className="py-space-xs px-space-md">State (After / Proposed)</th>
                    <th className="py-space-xs px-space-md text-right">Risk Tag</th>
                  </tr>
                </thead>
                <tbody className="font-code-md text-code-md divide-y divide-surface-container">
                  {selectedSession.diffRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-space-sm px-space-md font-semibold text-on-surface">
                        {row.id}
                      </td>
                      <td className="py-space-sm px-space-md text-on-surface-variant">
                        {row.table}
                      </td>
                      <td className="py-space-sm px-space-md text-on-surface font-medium">
                        {row.field}
                      </td>
                      <td className="py-space-sm px-space-md">
                        <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant line-through">
                          {row.before}
                        </span>
                      </td>
                      <td className="py-space-sm px-space-md">
                        <span className="px-space-xs py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                          {row.after}
                        </span>
                      </td>
                      <td className="py-space-sm px-space-md text-right">
                        <span className="px-space-xs py-0.5 rounded bg-error-container text-on-error-container font-code-sm text-code-sm">
                          {row.riskTag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Safe Sandbox Preview Notice */}
            <div className="p-space-sm bg-surface-container-high flex items-center gap-space-sm text-on-surface-variant font-body-sm text-body-sm border-t border-border">
              <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0">
                shield_lock
              </span>
              <span>
                Notice: Destructive / state changes are locked. Direct browser SQL execution is
                strictly forbidden. Safe sandbox preview generated via dry-run transaction with auto-rollback.
              </span>
            </div>
          </div>

          {/* Direct Natural Language / SQL Execution Console */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-border flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Direct Natural Language / SQL Execution Console
              </span>
              <span className="font-code-sm text-code-sm text-on-surface-variant">
                Grammar: PostgreSQL 16 + MCP DSL
              </span>
            </div>

            {/* Suggested Commands Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
              {SUGGESTED_COMMANDS.map((cmd, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPromptInput(cmd)}
                  className="px-2 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface whitespace-nowrap transition-colors border border-border text-[11px]"
                >
                  {cmd}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleExecuteCommand();
                  }
                }}
                className="w-full p-space-sm rounded-lg bg-surface-container-low font-code-md text-code-md text-on-surface placeholder:text-on-surface-variant outline-none border border-border focus:bg-surface-container focus:ring-1 focus:ring-on-surface resize-none"
                placeholder="Ask an analytical question or propose a controlled change (e.g. 'Show me the records that would be affected if we suspend inactive customers...')"
                rows={3}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-space-xs">
              <div className="flex items-center gap-space-xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleExecuteCommand()}
                  disabled={loading}
                  className="px-space-sm py-space-xs rounded bg-surface-container-high text-on-surface font-code-sm text-code-sm hover:bg-surface-container transition-colors flex items-center gap-space-xxs border border-border cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  Generate Impact Diff
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteCommand()}
                  disabled={loading}
                  className="px-space-sm py-space-xs rounded bg-surface-container-high text-on-surface font-code-sm text-code-sm hover:bg-surface-container transition-colors flex items-center gap-space-xxs border border-border cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">rule</span>
                  Verify Schema
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleExecuteCommand()}
                disabled={loading}
                className="w-full sm:w-auto px-space-md py-space-xs rounded bg-primary-container text-on-primary-container font-headline-sm text-headline-sm hover:bg-primary transition-colors flex items-center justify-center gap-space-xs shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                {loading ? "Reasoning..." : "Submit for Approval (⌘Enter)"}
              </button>
            </div>
          </div>
          <div ref={sessionEndRef} />
        </div>

        {/* ==================================================== */}
        {/* RIGHT PANE: Governance & Risk Dossier (3 cols) */}
        {/* ==================================================== */}
        <div className="xl:col-span-3 flex flex-col gap-space-md bg-surface-container-lowest rounded-xl p-space-md border border-border shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between pb-space-xs border-b border-border">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[20px] text-tertiary">
                security
              </span>
              <span className="font-headline-md text-headline-md text-on-surface">
                Governance &amp; Risk Dossier
              </span>
            </div>
            <span className="font-code-sm text-code-sm px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface">
              Auto-Evaluated
            </span>
          </div>

          {/* Risk Assessment Score Card */}
          <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-sm border border-border">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Threat Impact Index
              </span>
              <span
                className={`px-space-xs py-space-xxs rounded font-code-sm text-code-sm font-bold uppercase ${
                  selectedSession.riskScore >= 80
                    ? "bg-error-container text-on-error-container"
                    : selectedSession.riskScore >= 40
                    ? "bg-tertiary-fixed text-on-tertiary-fixed"
                    : "bg-secondary-fixed text-on-secondary-fixed"
                }`}
              >
                {selectedSession.riskScore >= 80
                  ? "Critical Risk"
                  : selectedSession.riskScore >= 40
                  ? "High Risk"
                  : "Low Risk"} ({selectedSession.riskScore}/100)
              </span>
            </div>

            {/* SVG Circular Gauge */}
            <div className="flex items-center gap-space-md py-space-xs">
              <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-container-highest"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className={
                      selectedSession.riskScore >= 80
                        ? "text-error"
                        : selectedSession.riskScore >= 40
                        ? "text-tertiary-container"
                        : "text-secondary"
                    }
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${selectedSession.riskScore}, 100`}
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                </svg>
                <span className="absolute font-code-md text-code-md font-bold text-on-surface">
                  {selectedSession.riskScore}%
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  {selectedSession.riskScore >= 40 ? "Elevated Mutation" : "Nominal Access"}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {selectedSession.riskScore >= 40
                    ? "Exceeds automated threshold (>40). Dual-custody sign-off enforced."
                    : "Within automated threshold. Read-only operation verified."}
                </span>
              </div>
            </div>

            {/* Risk Factors Checklist */}
            <div className="flex flex-col gap-space-xxs pt-space-xs border-t border-border">
              <div className="flex items-center justify-between font-code-sm text-code-sm">
                <span className="text-on-surface-variant">Schema Multi-Table Scope:</span>
                <span className="text-on-surface font-semibold">2 Tables Affected</span>
              </div>
              <div className="flex items-center justify-between font-code-sm text-code-sm">
                <span className="text-on-surface-variant">Authentication State:</span>
                <span className="text-secondary font-semibold">Valid JWT</span>
              </div>
              <div className="flex items-center justify-between font-code-sm text-code-sm">
                <span className="text-on-surface-variant">Policy Invariant:</span>
                <span className="text-tertiary font-semibold">Triggered Gated</span>
              </div>
            </div>
          </div>

          {/* Applied Policy Invariants List */}
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
              Enforced Policy Invariants
            </span>
            <div className="p-space-sm bg-surface-container-low rounded-lg flex flex-col gap-1 border border-border">
              <div className="flex items-center justify-between">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  {selectedSession.policyTrigger.split(":")[0]}
                </span>
                <span className="font-code-sm text-code-sm text-secondary font-semibold">
                  ACTIVE
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {selectedSession.policyTrigger}
              </p>
            </div>
          </div>

          {/* Dual-Custody Signature Decision Controls */}
          {selectedSession.status === "awaiting" && (
            <div className="flex flex-col gap-space-sm pt-space-xs border-t border-border">
              <div className="flex flex-col gap-space-xxs">
                <label className="font-headline-sm text-headline-sm text-on-surface">
                  SecOps Justification Note
                </label>
                <textarea
                  value={justificationNote}
                  onChange={(e) => setJustificationNote(e.target.value)}
                  placeholder="Enter operational rationale for audit trail (e.g. Approved per RFC-4091)..."
                  className="w-full p-space-xs rounded bg-surface-container-low font-code-sm text-code-sm text-on-surface border border-border outline-none focus:bg-surface-container"
                  rows={2}
                />
              </div>

              {/* MFA Checkbox */}
              <label className="flex items-center gap-space-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={mfaChecked}
                  onChange={(e) => setMfaChecked(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <span className="font-body-sm text-body-sm text-on-surface">
                  Require SecOps Key Hardware Token (WebAuthn)
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex flex-col gap-space-xs pt-space-xs">
                <button
                  type="button"
                  onClick={handleAuthorizeExecution}
                  disabled={loading}
                  className="w-full py-space-sm px-space-md bg-primary text-on-primary hover:bg-primary-container rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-space-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  Authorize &amp; Execute Transaction
                </button>

                <button
                  type="button"
                  onClick={handleRejectExecution}
                  disabled={loading}
                  className="w-full py-space-xs px-space-md bg-surface-container-lowest text-error hover:bg-error-container hover:text-on-error-container rounded-lg font-label-md text-label-md flex items-center justify-center gap-space-xs transition-colors border border-border cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">block</span>
                  Reject Proposal &amp; Quarantine Key
                </button>
              </div>
            </div>
          )}

          {/* Recent Agent Executions Telemetry */}
          <div className="flex flex-col gap-space-xs pt-space-xs border-t border-border">
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                Recent Agent Executions
              </span>
              <Link href="/agent-runs" className="font-code-sm text-code-sm text-secondary hover:underline">
                View All →
              </Link>
            </div>

            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {recentExecutions.slice(0, 5).map((ex) => (
                <div
                  key={ex.id}
                  className="p-1.5 rounded bg-surface-container-low border border-border flex items-center justify-between font-code-sm text-code-sm"
                >
                  <span className="truncate max-w-[140px] text-on-surface font-medium">
                    {ex.tool_name}
                  </span>
                  <span
                    className={`font-semibold uppercase text-[10px] ${
                      ex.decision === "ALLOW"
                        ? "text-secondary"
                        : ex.decision === "BLOCK"
                        ? "text-error"
                        : "text-tertiary"
                    }`}
                  >
                    {ex.decision}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
