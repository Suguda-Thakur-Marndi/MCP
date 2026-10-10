"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  api,
  AgentRunRecord,
  AgentExecutionRecord,
  AgentStatusResponse,
} from "@/lib/api";
import { formatTime, riskBadgeClass, decisionBadgeClass } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender: "user" | "agent" | "system";
  text: string;
  timestamp: string;
  toolCalls?: Array<{ tool: string; result?: string }>;
  status?: string;
  riskScore?: number;
}

const QUICK_PROMPTS = [
  "Show pending high-risk approvals in the queue.",
  "Summarize denied tool executions from the last 24 hours.",
  "Show the most frequently triggered security policies.",
  "Query customer records with active lifecycle status.",
  "Explain why destructive DDL operations require human escrow sign-off.",
];

export default function AICommandCenterPage() {
  const [, startTransition] = useTransition();

  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgentRunRecord | null>(null);
  const [sessionFilter, setSessionFilter] = useState<string>("");
  const [promptInput, setPromptInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [justificationNote, setJustificationNote] = useState<string>("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [agentStatus, setAgentStatus] = useState<AgentStatusResponse | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<AgentExecutionRecord[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const fetchTelemetryAndRuns = useCallback(async () => {
    try {
      const [statusRes, execsRes, runsRes] = await Promise.all([
        api.agent.status().catch(() => null),
        api.agent.executions(15).catch(() => []),
        api.agent.runs({ limit: 25 }).catch(() => ({ total: 0, count: 0, runs: [] })),
      ]);

      startTransition(() => {
        if (statusRes) setAgentStatus(statusRes);
        if (Array.isArray(execsRes)) setRecentExecutions(execsRes);
        if (runsRes?.runs) {
          setRuns(runsRes.runs);
          if (!selectedRun && runsRes.runs.length > 0) {
            setSelectedRun(runsRes.runs[0]);
          }
        }
      });
    } catch (err: unknown) {
      console.warn("Failed to fetch agent telemetry:", err);
    }
  }, [selectedRun]);

  useEffect(() => {
    void fetchTelemetryAndRuns();
  }, [fetchTelemetryAndRuns]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When a run is selected from the left panel, load its prompt and details into view
  const handleSelectRun = (run: AgentRunRecord) => {
    setSelectedRun(run);
    if (run.user_prompt) {
      setMessages([
        {
          id: `msg-${run.run_id}-u`,
          sender: "user",
          text: run.user_prompt,
          timestamp: run.started_at || new Date().toISOString(),
        },
        {
          id: `msg-${run.run_id}-a`,
          sender: "agent",
          text: run.reasoning || (run.status === "COMPLETED" ? "Execution verified and completed within policy boundary." : `Operation status: ${run.status}`),
          timestamp: run.completed_at || run.started_at || new Date().toISOString(),
          status: run.status,
          riskScore: run.risk_score,
        },
      ]);
    }
  };

  // Submit prompt to real agent backend
  const handleExecutePrompt = async (promptToRun?: string) => {
    const text = (promptToRun || promptInput).trim();
    if (!text || loading) return;

    setLoading(true);
    setActionFeedback(null);

    const userMsgId = `usr-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setPromptInput("");

    try {
      const res = await api.agent.chat(text);

      const agentMsg: ChatMessage = {
        id: `agt-${Date.now()}`,
        sender: "agent",
        text: res.response || "No response received from agent.",
        timestamp: new Date().toISOString(),
        toolCalls: res.tool_calls,
        status: res.status,
      };

      setMessages((prev) => [...prev, agentMsg]);
      setActionFeedback(`Agent completed turn (Status: ${res.status}, Tools used: ${res.tool_calls_made || 0})`);

      // Refresh runs list to show new execution in left drawer
      await fetchTelemetryAndRuns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution failed or was intercepted by Sentinel gate.";
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: "system",
          text: `Gateway Interception: ${msg}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      setActionFeedback(`Interception: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle immediate authorization or denial of pending ticket associated with run
  const handleApprovalAction = async (decision: "approve" | "deny") => {
    if (!selectedRun?.approval_ticket_id) return;
    setLoading(true);
    try {
      if (decision === "approve") {
        await api.approvals.approve(
          selectedRun.approval_ticket_id,
          justificationNote || "Authorized via AI Command Center console"
        );
        setActionFeedback("Ticket approved. Execution authorized.");
      } else {
        await api.approvals.deny(
          selectedRun.approval_ticket_id,
          justificationNote || "Denied by Security Operator in AI Command Center"
        );
        setActionFeedback("Ticket denied and quarantined.");
      }
      setJustificationNote("");
      await fetchTelemetryAndRuns();
    } catch (err) {
      console.error("Approval error:", err);
      setActionFeedback("Failed to update approval status.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRuns = runs.filter(
    (r) =>
      r.run_id.toLowerCase().includes(sessionFilter.toLowerCase()) ||
      r.agent_name.toLowerCase().includes(sessionFilter.toLowerCase()) ||
      (r.user_prompt && r.user_prompt.toLowerCase().includes(sessionFilter.toLowerCase())) ||
      (r.application && r.application.toLowerCase().includes(sessionFilter.toLowerCase()))
  );

  return (
    <div className="w-full px-space-md sm:px-space-lg lg:px-space-xl py-space-lg flex flex-col gap-space-lg">
      {/* Action Feedback Banner */}
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

      {/* 3-Column Studio Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* ==================================================== */}
        {/* LEFT PANE: Real Agent Runs & Sessions (3 cols) */}
        {/* ==================================================== */}
        <div className="xl:col-span-3 flex flex-col gap-space-md bg-surface-container-lowest rounded-xl p-space-md border border-surface-container shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container font-label-mono text-label-mono">
            <span className="text-on-surface-variant uppercase tracking-wider font-semibold">
              Execution Sessions
            </span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container text-secondary font-bold">
              {runs.length} LOGGED
            </span>
          </div>

          {/* Search/Filter Bar */}
          <div className="relative">
            <input
              type="text"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              placeholder="Filter by Run ID, prompt..."
              className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant px-space-md py-space-xs pl-8 rounded-lg font-body-sm text-body-sm border border-surface-container outline-hidden focus:bg-surface-container transition-colors"
            />
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2.5 pointer-events-none">
              search
            </span>
          </div>

          {/* Session List */}
          <div className="flex flex-col gap-space-xs max-h-[480px] overflow-y-auto">
            {filteredRuns.length === 0 ? (
              <div className="p-space-lg text-center font-label-mono text-body-sm text-on-surface-variant">
                No runs recorded matching filter.
              </div>
            ) : (
              filteredRuns.map((run) => {
                const isSelected = selectedRun?.run_id === run.run_id;
                const isPending = run.status === "AWAITING_APPROVAL" || run.status === "PENDING";
                const isDenied = run.status === "DENIED" || run.status === "BLOCKED";

                return (
                  <div
                    key={run.run_id}
                    onClick={() => handleSelectRun(run)}
                    className={`p-space-sm rounded-lg transition-all cursor-pointer relative overflow-hidden group border ${
                      isSelected
                        ? "bg-surface-container-low border-primary/40 shadow-xs"
                        : "bg-surface-container-lowest border-transparent hover:bg-surface-container-low hover:border-surface-container"
                    }`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}

                    <div className="flex items-start justify-between gap-space-xs">
                      <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                        {run.user_prompt || run.agent_name || run.run_id}
                      </span>
                      {isPending && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5 animate-pulse" title="Awaiting Sign-Off"></span>
                      )}
                      {isDenied && (
                        <span className="w-2 h-2 rounded-full bg-error shrink-0 mt-1.5" title="Policy Intercepted"></span>
                      )}
                      {!isPending && !isDenied && (
                        <span className="w-2 h-2 rounded-full bg-secondary shrink-0 mt-1.5" title="Completed"></span>
                      )}
                    </div>

                    <div className="flex items-center gap-space-xs mt-space-xs font-label-mono text-[10px] text-on-surface-variant">
                      <span className="font-bold text-on-surface">{run.run_id.slice(0, 10)}</span>
                      <span>•</span>
                      <span className={`font-semibold ${isPending ? "text-primary" : isDenied ? "text-error" : "text-secondary"}`}>
                        {run.status}
                      </span>
                      <span>•</span>
                      <span>{run.started_at ? formatTime(run.started_at) : "Recent"}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Context Pins */}
          <div className="pt-space-md border-t border-surface-container flex flex-col gap-space-xs font-label-mono text-label-mono">
            <span className="text-on-surface-variant uppercase tracking-wider text-[10px] font-semibold">
              Gateway Target State
            </span>
            <div className="p-space-xs px-space-sm bg-surface-container rounded-lg flex items-center justify-between border border-surface-container">
              <span className="text-on-surface font-medium truncate">PostgreSQL Core Daemon</span>
              <span className="text-secondary font-bold text-[10px]">CONNECTED</span>
            </div>
            <div className="p-space-xs px-space-sm bg-surface-container rounded-lg flex items-center justify-between border border-surface-container">
              <span className="text-on-surface font-medium truncate">Model: {agentStatus?.model || "gemini-2.5-flash"}</span>
              <span className="text-secondary font-bold text-[10px]">READY</span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* CENTER PANE: Interactive Agent Chat & Trace (6 cols) */}
        {/* ==================================================== */}
        <div className="xl:col-span-6 flex flex-col gap-space-md bg-surface-container-lowest rounded-xl p-space-lg border border-surface-container shadow-xs min-h-[640px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              </div>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">AI Command Center</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Governed natural language interface to MCP tools &amp; enterprise operations
                </p>
              </div>
            </div>
            <span className="font-label-mono text-label-mono px-space-xs py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">
              AST GATED
            </span>
          </div>

          {/* Chat Message Stream */}
          <div className="flex-1 flex flex-col gap-space-md overflow-y-auto max-h-[440px] pr-space-xs">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">terminal</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Enter an Operational Directive</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                  Ask natural-language questions, inspect database status, query customer records, or request controlled operational tasks. Every action is evaluated by policy rules.
                </p>
                <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
                  {QUICK_PROMPTS.slice(0, 3).map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => void handleExecutePrompt(prompt)}
                      className="px-space-sm py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-mono text-[11px] border border-surface-container transition-colors cursor-pointer text-left"
                    >
                      &ldquo;{prompt}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 p-space-md rounded-xl ${
                    msg.sender === "user"
                      ? "bg-surface-container-low border border-surface-container ml-8"
                      : msg.sender === "system"
                      ? "bg-error-container text-on-error-container border border-error/20"
                      : "bg-surface-container-lowest border border-surface-container mr-8 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between font-label-mono text-[10px] text-on-surface-variant pb-1 border-b border-surface-container">
                    <span className="font-bold uppercase tracking-wider text-on-surface">
                      {msg.sender === "user" ? "Security Operator" : msg.sender === "system" ? "Security Sentinel" : "Agent Response"}
                    </span>
                    <span>{formatTime(msg.timestamp)}</span>
                  </div>

                  <div className="font-body-md text-body-md text-on-surface whitespace-pre-wrap mt-1">
                    {msg.text}
                  </div>

                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-surface-container font-label-mono text-[11px] space-y-1">
                      <span className="text-on-surface-variant uppercase text-[10px] font-semibold">
                        Tools Executed Through FastMCP:
                      </span>
                      {msg.toolCalls.map((tc, idx) => (
                        <div key={idx} className="p-1.5 rounded bg-surface-container-low flex items-center justify-between border border-surface-container">
                          <span className="font-bold text-secondary">{tc.tool}</span>
                          <span className="text-on-surface-variant text-[10px]">{tc.result || "Returned output"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-surface-container">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => void handleExecutePrompt(prompt)}
                className="whitespace-nowrap px-space-sm py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface font-label-mono text-[10px] border border-surface-container transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex items-center gap-space-sm bg-surface-container-low p-space-xs rounded-xl border border-surface-container">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleExecutePrompt();
                }
              }}
              placeholder="Type command (e.g. 'Show pending approvals', 'Query customer records')..."
              className="flex-1 bg-transparent px-space-sm py-2 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant outline-hidden"
              disabled={loading}
            />
            <button
              onClick={() => void handleExecutePrompt()}
              disabled={loading || !promptInput.trim()}
              className="px-space-md py-2 bg-primary text-on-primary rounded-lg font-label-ui text-label-ui font-semibold hover:bg-primary-container transition-colors shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? "Evaluating" : "Execute"}</span>
              <span className="material-symbols-outlined text-[16px]">
                {loading ? "sync" : "send"}
              </span>
            </button>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT PANE: Policy & Security Inspection Gate (3 cols) */}
        {/* ==================================================== */}
        <div className="xl:col-span-3 flex flex-col gap-space-md bg-surface-container-lowest rounded-xl p-space-md border border-surface-container shadow-xs">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container font-label-mono text-label-mono">
            <span className="text-on-surface-variant uppercase tracking-wider font-semibold">
              Gate Inspection
            </span>
            <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
          </div>

          {selectedRun ? (
            <div className="flex flex-col gap-space-md font-body-sm text-body-sm">
              <div>
                <span className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                  Active Execution
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                  {selectedRun.run_id}
                </h3>
              </div>

              {/* Status & Risk Pill */}
              <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container flex items-center justify-between font-label-mono text-label-mono">
                <div>
                  <div className="text-[10px] text-on-surface-variant uppercase">Risk Assessment</div>
                  <div className="font-bold text-on-surface">{selectedRun.risk_level} ({selectedRun.risk_score}/100)</div>
                </div>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  selectedRun.risk_score >= 80 ? "bg-error-container text-on-error-container" :
                  selectedRun.risk_score >= 50 ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" :
                  "bg-secondary-container text-on-secondary-container"
                }`}>
                  {selectedRun.status}
                </span>
              </div>

              {/* Policy Rule Details */}
              <div className="flex flex-col gap-1 font-label-mono text-label-mono">
                <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                  Policy Evaluation
                </span>
                <div className="p-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container text-on-surface">
                  <div className="font-bold">{selectedRun.policy_id || "sentinel-core-policy"}</div>
                  <div className="text-[10px] text-secondary font-semibold">Decision: {selectedRun.policy_decision || "ALLOW"}</div>
                </div>
              </div>

              {/* Action Buttons if ticket exists */}
              {selectedRun.approval_ticket_id ? (
                <div className="pt-space-sm border-t border-surface-container flex flex-col gap-space-sm">
                  <span className="font-label-mono text-[10px] text-primary uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    Dual-Custody Gated Operation
                  </span>
                  <input
                    type="text"
                    value={justificationNote}
                    onChange={(e) => setJustificationNote(e.target.value)}
                    placeholder="Signer notes / reason..."
                    className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant px-space-sm py-1.5 rounded font-body-sm text-body-sm border border-surface-container outline-hidden"
                  />
                  <div className="grid grid-cols-2 gap-space-xs">
                    <button
                      onClick={() => void handleApprovalAction("approve")}
                      disabled={loading}
                      className="py-1.5 bg-primary text-on-primary font-label-ui text-label-ui font-bold rounded-lg hover:bg-primary-container transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      Authorize
                    </button>
                    <button
                      onClick={() => void handleApprovalAction("deny")}
                      disabled={loading}
                      className="py-1.5 bg-surface-container-high text-on-surface font-label-ui text-label-ui font-semibold rounded-lg hover:bg-error-container hover:text-on-error-container transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[14px]">block</span>
                      Deny
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container text-[11px] font-label-mono text-on-surface-variant">
                  No pending escalation required. Tool dispatches executed through authorized sandbox.
                </div>
              )}
            </div>
          ) : (
            <div className="p-space-md text-center font-label-mono text-on-surface-variant text-body-sm">
              Select an execution session to view policy breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
