/**
 * MCP-Sentinel Frontend API Client
 * All calls proxy to the FastAPI backend at NEXT_PUBLIC_API_URL.
 * Zero mock data — every function issues a real HTTP request.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface HealthStatus {
  status: string;
  alive?: boolean;
  service?: string;
  environment?: string;
  server_name?: string;
  database?: string;
  db?: string;
  mcp_server?: string;
  gemini?: string;
  dependencies?: Record<string, string | { status: string; latency_ms?: number }>;
  pool?: {
    total: number;
    used: number;
    free: number;
    total_connections?: number;
    used_connections?: number;
    free_connections?: number;
  };
  error?: string;
}

// --------------------------------------------------------------------------
// Auth helper – reads JWT from localStorage
// --------------------------------------------------------------------------
function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("sentinel_token");
  const role = localStorage.getItem("sentinel_role") || "ADMIN";
  const email = localStorage.getItem("sentinel_email") || "admin@sentinel.test";

  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  // Dev/test mode: use test headers (only works when ENABLE_TEST_AUTH=true on server)
  return {
    "X-Test-User-Role": role,
    "X-Test-User-Email": email,
  };
}

// --------------------------------------------------------------------------
// Core fetch wrapper
// --------------------------------------------------------------------------
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = typeof window !== "undefined" && path.startsWith("/") ? path : `${API_BASE}${path}`;
  const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(
    (options.method || "GET").toUpperCase()
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(isMutation ? { "X-Requested-With": "XMLHttpRequest" } : {}),
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(res.status, body.message || res.statusText, body);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(408, "Request timed out after 15 seconds.", { error: "TIMEOUT" });
    }
    throw new ApiError(
      0,
      err instanceof Error ? err.message : "Network error or backend unreachable.",
      { error: "NETWORK_ERROR" }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

// --------------------------------------------------------------------------
// Authoritative Types
// --------------------------------------------------------------------------
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  display_name: string;
  role: string;
  department?: string | null;
  organization?: string | null;
  status: string;
  is_active: boolean;
  permissions: string[];
}

export interface DashboardStats {
  status: string;
  environment: string;
  metrics: {
    customers: number;
    orders: number;
    audit_events: number;
    pending_approvals: number;
    completed_approvals: number;
    blocked_actions: number;
  };
  recent_security_events: {
    id: string;
    event_type: string;
    tool_name: string;
    decision: string;
    created_at: string;
  }[];
  server: {
    name: string;
    version: string;
    agent_id: string;
    model: string;
  };
}

export interface ApprovalRecord {
  id?: string;
  ticket_id: string;
  request_id: string;
  agent_id: string;
  requester?: string;
  requester_id: string;
  approver_id: string | null;
  tool_name: string;
  target_id: string;
  target_resource?: string;
  action: string;
  parameters: Record<string, unknown>;
  parameter_hash: string;
  parameters_hash?: string;
  environment: string;
  policy_id: string;
  risk_level: string;
  risk_score: number;
  status: string;
  reason: string;
  justification?: string;
  decision_notes: string | null;
  signature?: string | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  executed_at: string | null;
}

export interface AuditEvent {
  id: string | number;
  event_type: string;
  actor_type?: string | null;
  actor_id?: string | null;
  tool_name: string;
  decision: string;
  risk_score?: number | null;
  policy_id?: string | null;
  agent_id?: string | null;
  request_id?: string | null;
  created_at: string;
  details?: Record<string, unknown> | null;
  event_data?: Record<string, unknown> | null;
  parameters?: Record<string, unknown> | null;
}

export interface AuditStats {
  total: number;
  total_events?: number;
  allowed_invocations?: number;
  blocked_operations?: number;
  gated_approvals?: number;
  by_decision: Record<string, number>;
  by_tool?: Record<string, number>;
}

export interface PolicyRule {
  rule_id: string;
  name?: string;
  description: string;
  action: string;
  target_decision?: string;
  priority: number;
  reason?: string;
  conditions?: Record<string, unknown> | null;
}

export interface PolicyResponse {
  status: string;
  policy_id: string;
  policy_version: string;
  precedence: string[];
  rule_count: number;
  rules: PolicyRule[];
}

export interface PolicyInfo {
  id: string;
  name: string;
  version: string;
  rules: PolicyRule[];
}

export interface ToolInfo {
  tool_name: string;
  name: string;
  description: string;
  risk_level: string;
  base_risk: string;
  is_destructive: boolean;
  destructive: boolean;
  requires_approval: boolean;
  read_only: boolean;
  operation_type?: string;
  resource_type?: string;
  data_sensitivity?: string;
  parameters?: Record<string, unknown> | null;
  schema?: Record<string, unknown> | null;
}

export interface AgentRunRecord {
  id?: string;
  run_id: string;
  agent_id: string;
  agent_name: string;
  model: string;
  environment: string;
  application: string;
  tool_id?: string | null;
  user_prompt?: string | null;
  reasoning?: string | null;
  payload?: Record<string, unknown> | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  risk_score: number;
  approval_state: string;
  execution_state: "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED" | "INTERCEPTED" | string;
  status?: string;
  started_at?: string;
  duration_ms: number;
  created_at: string;
  completed_at?: string | null;
  approval_ticket_id?: string | null;
  policy_id?: string | null;
  policy_decision?: string | null;
}

export interface ToolExecutionRecord {
  id: string | number;
  run_id: string;
  tool_id: string;
  tool_name?: string;
  ticket_id?: string | null;
  parameters: Record<string, unknown> | string;
  parameters_hash?: string | null;
  result?: unknown;
  error_message?: string | null;
  status: string;
  latency_ms: number;
  execution_time_ms?: number;
  executed_at: string;
}

export interface SecurityEvalScenario {
  scenario_id: string | number;
  test_id?: string;
  name: string;
  category: string;
  passed: boolean;
  status?: string;
  attack_success?: boolean;
  side_effect_detected?: boolean;
  severity?: string;
  evidence?: unknown;
  expected?: string;
  actual?: string;
  expected_decision?: string;
  actual_decision?: string;
  duration_ms?: number;
  latency_ms?: number;
  db_integrity_verified?: boolean;
  notes?: string;
  error?: string | null;
}

export interface SecurityEvalResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    pass_rate: number;
    duration_seconds: number;
    average_latency_ms?: number;
  };
  total_scenarios?: number;
  results: SecurityEvalScenario[];
  generated_at?: string;
  timestamp?: string;
}

export interface AgentExecutionRecord {
  id: string | number;
  event_type: string;
  actor_type: string;
  actor_id: string;
  tool_name: string;
  decision: string;
  request_id: string;
  action?: string;
  risk_score?: number;
  details: Record<string, unknown> | null;
  parameters?: Record<string, unknown> | null;
  created_at: string;
}

export interface AgentStatusResponse {
  status: string;
  agent_id: string;
  model: string;
  max_iterations?: number;
  max_tool_calls?: number;
  tool_timeout_seconds?: number;
  tools_registered?: number;
}

export interface AgentChatResponse {
  request_id: string;
  conversation_id: string;
  response: string;
  status: string;
  tool_calls: { tool: string; result?: string; [key: string]: unknown }[];
  iteration_count?: number;
  iterations?: number;
  tool_calls_made?: number;
  final_state?: string;
}

export interface IntegrationListItem {
  id: string;
  name: string;
  status: string;
  live_status?: string;
  category?: string;
  description?: string;
  auth_type?: string;
  protocol_type?: string;
  connection_endpoint?: string;
  icon?: string;
  tools_count?: number;
  scopes?: string[];
  risk_level?: string;
  latency_ms?: number;
  created_at?: string;
  config?: Record<string, unknown>;
  capabilities?: string[];
}

export interface ToolExecutionResponse {
  status?: string;
  approval_ticket_id?: string;
  data?: unknown;
  stages_completed?: string[];
  latency_ms?: number;
  error?: string;
  [key: string]: unknown;
}

// --------------------------------------------------------------------------
// Tool Description Fallbacks for Authoritative MCP Registry
// --------------------------------------------------------------------------
const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_customer: "Retrieves customer record by ID with authorized field projection.",
  list_customers: "Lists customer accounts with optional status filtering and pagination.",
  update_customer_status: "Updates customer account lifecycle status (ACTIVE, SUSPENDED, PENDING).",
  delete_customer: "Deletes customer and purges associated records. Strict human-approval gated.",
  add_audit_note: "Appends an immutable administrative note to customer audit log.",
  get_order: "Retrieves enterprise order by unique order number.",
  list_customer_orders: "Lists customer order history with pagination boundaries.",
  update_order_status: "Transitions an order through valid lifecycle states (PROCESSING, SHIPPED, DELIVERED).",
  query_customer_records: "Queries customer records with row-level security and field authorization.",
  get_customer_orders: "Retrieves customer purchase history, fulfillment statuses, and order lines.",
  append_customer_audit_note: "Appends verified operational audit notes to customer ledger.",
  update_customer: "Updates customer fields subject to schema validation and policy logging.",
  purge_inactive_customer_data: "Permanently purges inactive customer data. Mandatory dual-custody gated.",
};

function normalizeSecurityEval(res: unknown): SecurityEvalResult {
  const data = res && typeof res === "object" ? (res as Record<string, unknown>) : {};
  const report =
    data.report && typeof data.report === "object"
      ? (data.report as Record<string, unknown>)
      : data;

  const total = Number(report.total_scenarios ?? (report.summary as Record<string, unknown>)?.total ?? 0);
  const passed = Number(report.passed_scenarios ?? (report.summary as Record<string, unknown>)?.passed ?? 0);
  const failed = Number(report.failed_scenarios ?? (report.summary as Record<string, unknown>)?.failed ?? 0);
  const passRate = Number(report.pass_rate ?? (total > 0 ? (passed / total) * 100 : 100));
  const duration = Number(report.total_duration_seconds ?? (report.summary as Record<string, unknown>)?.duration_seconds ?? 0);
  const avgLatency = Number(report.average_latency_ms ?? 0);

  const rawResults = Array.isArray(report.results) ? report.results : [];
  const results: SecurityEvalScenario[] = rawResults.map((r: Record<string, unknown>) => {
    const isPass = r.status === "PASS" || r.passed === true || (r.attack_success === false && r.status !== "FAIL");
    const testId = String(r.test_id ?? r.scenario_id ?? "");
    return {
      scenario_id: testId,
      test_id: testId,
      name: String(r.name ?? "Scenario"),
      category: String(r.category ?? "SECURITY"),
      status: String(r.status ?? (isPass ? "PASS" : "FAIL")),
      passed: isPass,
      attack_success: Boolean(r.attack_success),
      side_effect_detected: Boolean(r.side_effect_detected),
      severity: String(r.severity ?? "MEDIUM"),
      expected: String(r.expected ?? r.expected_decision ?? "ALLOW"),
      actual: String(r.actual ?? r.actual_decision ?? (isPass ? "ALLOW" : "BLOCK")),
      expected_decision: String(r.expected_decision ?? r.expected ?? "ALLOW"),
      actual_decision: String(r.actual_decision ?? r.actual ?? "ALLOW"),
      duration_ms: Number(r.duration_ms ?? r.latency_ms ?? 0),
      latency_ms: Number(r.latency_ms ?? r.duration_ms ?? 0),
      db_integrity_verified:
        r.db_integrity_verified !== undefined
          ? Boolean(r.db_integrity_verified)
          : !Boolean(r.side_effect_detected),
      notes: r.notes ? String(r.notes) : undefined,
      evidence: r.evidence,
      error: r.error ? String(r.error) : null,
    };
  });

  return {
    summary: {
      total,
      passed,
      failed,
      pass_rate: passRate,
      duration_seconds: duration,
      average_latency_ms: avgLatency,
    },
    results,
    timestamp: String(report.timestamp ?? new Date().toISOString()),
    generated_at: String(report.timestamp ?? new Date().toISOString()),
  };
}

function normalizeApproval(r: Record<string, unknown>): ApprovalRecord {
  const ticketId = String(r.ticket_id || r.id || "");
  const requester = String(r.requester_id || r.requester || "unknown");
  const target = String(r.target_id || r.target_resource || "default");
  const reason = String(r.reason || r.justification || "");
  const pHash = String(r.parameter_hash || r.parameters_hash || "");
  return {
    ...(r as unknown as ApprovalRecord),
    id: ticketId,
    ticket_id: ticketId,
    requester,
    requester_id: requester,
    target_id: target,
    target_resource: target,
    reason,
    justification: reason,
    parameter_hash: pHash,
    parameters_hash: pHash,
    signature: (r.signature as string) || null,
  };
}

function normalizeAgentRun(r: Record<string, unknown>): AgentRunRecord {
  const runId = String(r.run_id || r.id || "");
  const execState = String(r.execution_state || r.status || "COMPLETED");
  const createdAt = String(r.created_at || r.started_at || new Date().toISOString());
  return {
    ...(r as unknown as AgentRunRecord),
    id: runId,
    run_id: runId,
    execution_state: execState,
    status: execState,
    created_at: createdAt,
    started_at: createdAt,
  };
}

// --------------------------------------------------------------------------
// API Functions
// --------------------------------------------------------------------------
export const api = {
  // Health
  health: (): Promise<HealthStatus> => apiFetch("/api/health"),
  healthReady: (): Promise<HealthStatus> => apiFetch("/api/health/ready"),

  // Dashboard
  dashboard: {
    stats: (): Promise<DashboardStats> => apiFetch("/api/dashboard/stats"),
  },

  // Approvals
  approvals: {
    list: async (params?: { status?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status && params.status !== "ALL") q.set("status", params.status);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      const res = await apiFetch<Record<string, unknown>[]>(`/api/approvals${qs ? "?" + qs : ""}`);
      return (res || []).map(normalizeApproval);
    },
    pending: async (): Promise<ApprovalRecord[]> => {
      const res = await apiFetch<Record<string, unknown>[]>("/api/approvals/pending");
      return (res || []).map(normalizeApproval);
    },
    get: async (ticketId: string): Promise<ApprovalRecord> => {
      const res = await apiFetch<Record<string, unknown>>(`/api/approvals/${ticketId}`);
      return normalizeApproval(res);
    },
    approve: async (ticketId: string, notes?: string): Promise<ApprovalRecord> => {
      const res = await apiFetch<Record<string, unknown>>(`/api/approvals/${ticketId}/approve`, {
        method: "POST",
        body: JSON.stringify({ decision_notes: notes }),
      });
      return normalizeApproval(res);
    },
    deny: async (ticketId: string, notes?: string): Promise<ApprovalRecord> => {
      const res = await apiFetch<Record<string, unknown>>(`/api/approvals/${ticketId}/deny`, {
        method: "POST",
        body: JSON.stringify({ decision_notes: notes }),
      });
      return normalizeApproval(res);
    },
    cancel: async (ticketId: string, notes?: string): Promise<ApprovalRecord> => {
      const res = await apiFetch<Record<string, unknown>>(`/api/approvals/${ticketId}/cancel`, {
        method: "POST",
        body: notes ? JSON.stringify({ decision_notes: notes }) : undefined,
      });
      return normalizeApproval(res);
    },
  },

  // Audit
  audit: {
    events: async (params?: {
      event_type?: string;
      tool_name?: string;
      decision?: string;
      actor_id?: string;
      request_id?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ events: AuditEvent[]; total: number }> => {
      const q = new URLSearchParams();
      if (params?.event_type && params.event_type !== "ALL") q.set("event_type", params.event_type);
      if (params?.tool_name && params.tool_name !== "ALL") q.set("tool_name", params.tool_name);
      if (params?.decision && params.decision !== "ALL") q.set("decision", params.decision);
      if (params?.actor_id) q.set("actor_id", params.actor_id);
      if (params?.request_id) q.set("request_id", params.request_id);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      const res = await apiFetch<{ events?: AuditEvent[]; total?: number }>(
        `/api/audit/events${qs ? "?" + qs : ""}`
      );
      const rawEvents = res.events || [];
      const events: AuditEvent[] = rawEvents.map((e) => ({
        ...e,
        event_data: e.event_data || e.details || null,
        details: e.details || e.event_data || null,
      }));
      return {
        events,
        total: res.total ?? events.length,
      };
    },
    stats: (): Promise<AuditStats> => apiFetch("/api/audit/stats"),
  },

  // Policies & Tools
  policies: {
    list: async (): Promise<PolicyResponse> => {
      const data = await apiFetch<{
        status?: string;
        policy_id?: string;
        policy_version?: string;
        precedence?: string[];
        rule_count?: number;
        rules?: Array<{
          rule_id: string;
          name?: string;
          description: string;
          action?: string;
          target_decision?: string;
          priority: number;
          reason?: string;
        }>;
      }>("/api/policies");

      const rules: PolicyRule[] = (data.rules || []).map((r) => ({
        rule_id: r.rule_id,
        name: r.name || r.rule_id,
        description: r.description,
        action: r.action || r.target_decision || "ALLOW",
        target_decision: r.target_decision || r.action || "ALLOW",
        priority: r.priority,
        reason: r.reason,
      }));

      return {
        status: data.status || "success",
        policy_id: data.policy_id || "sentinel-core-policy",
        policy_version: data.policy_version || "1.0.0",
        precedence: data.precedence || ["DENY", "REQUIRE_MFA", "REQUIRE_APPROVAL", "ALLOW"],
        rule_count: data.rule_count || rules.length,
        rules,
      };
    },
    tools: async (): Promise<ToolInfo[]> => {
      const res = await apiFetch<{ tools?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>("/api/tools");
      const list = Array.isArray(res) ? res : res.tools || [];
      return list.map((t) => {
        const name = String(t.tool_name || t.name || "unnamed_tool");
        const isDestructive = Boolean(t.destructive ?? t.is_destructive);
        const readOnly = Boolean(t.read_only);
        const baseRiskNum = typeof t.base_risk === "number" ? t.base_risk : Number(t.base_risk) || 0;
        let riskLevel: string;
        if (typeof t.risk_level === "string" && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(t.risk_level.toUpperCase())) {
          riskLevel = t.risk_level.toUpperCase();
        } else if (isDestructive || baseRiskNum >= 40) {
          riskLevel = "CRITICAL";
        } else if (baseRiskNum >= 30) {
          riskLevel = "HIGH";
        } else if (baseRiskNum >= 20) {
          riskLevel = "MEDIUM";
        } else {
          riskLevel = "LOW";
        }

        return {
          tool_name: name,
          name: name,
          description: String(t.description || TOOL_DESCRIPTIONS[name] || `FastMCP tool: ${name}`),
          risk_level: riskLevel,
          base_risk: String(baseRiskNum > 0 ? `${baseRiskNum}/100` : riskLevel),
          is_destructive: isDestructive,
          destructive: isDestructive,
          requires_approval: Boolean(
            t.requires_approval ?? (isDestructive || riskLevel === "CRITICAL" || riskLevel === "HIGH")
          ),
          read_only: readOnly,
          operation_type: t.operation_type ? String(t.operation_type) : undefined,
          resource_type: t.resource_type ? String(t.resource_type) : undefined,
          data_sensitivity: t.data_sensitivity ? String(t.data_sensitivity) : undefined,
          parameters: (t.parameters || t.schema) as Record<string, unknown> | null,
        };
      });
    },
    get: async (ruleId: string): Promise<{ rule: PolicyRule; policy_id: string; policy_version: string }> => {
      return apiFetch(`/api/policies/${ruleId}`);
    },
  },

  // Security Evaluation
  security: {
    runEval: async (): Promise<SecurityEvalResult> => {
      const res = await apiFetch<unknown>("/api/security/eval", { method: "POST" });
      return normalizeSecurityEval(res);
    },
    getLatest: async (): Promise<SecurityEvalResult> => {
      const res = await apiFetch<unknown>("/api/security/eval/latest");
      return normalizeSecurityEval(res);
    },
  },

  // Agent
  agent: {
    chat: async (message: string): Promise<AgentChatResponse> => {
      const res = await apiFetch<{
        request_id?: string;
        conversation_id?: string;
        response?: string;
        status?: string;
        tool_calls?: Array<{ tool: string; result?: string }>;
        iteration_count?: number;
      }>("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      return {
        request_id: res.request_id || "",
        conversation_id: res.conversation_id || "",
        response: res.response || "",
        status: res.status || "completed",
        tool_calls: res.tool_calls || [],
        iteration_count: res.iteration_count ?? 1,
        iterations: res.iteration_count ?? 1,
        tool_calls_made: (res.tool_calls || []).length,
        final_state: res.status || "completed",
      };
    },
    status: (): Promise<AgentStatusResponse> => apiFetch("/api/agent/status"),
    executions: async (limit = 20): Promise<AgentExecutionRecord[]> => {
      const res = await apiFetch<{ count: number; executions: AgentExecutionRecord[] }>(
        `/api/agent/executions?limit=${limit}`
      );
      return (res.executions || []).map((ex) => ({
        ...ex,
        action: typeof ex.details?.action === "string" ? (ex.details.action as string) : ex.event_type,
        risk_score: typeof ex.details?.risk_score === "number" ? (ex.details.risk_score as number) : undefined,
      }));
    },
    runs: async (params?: {
      status?: string;
      application?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ total: number; count: number; runs: AgentRunRecord[] }> => {
      const q = new URLSearchParams();
      if (params?.status && params.status !== "ALL") q.set("status", params.status);
      if (params?.application && params.application !== "ALL") q.set("application", params.application);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      const res = await apiFetch<{ total?: number; count?: number; runs?: Record<string, unknown>[] }>(
        `/api/agent/runs${qs ? "?" + qs : ""}`
      );
      const runs = (res?.runs || []).map(normalizeAgentRun);
      return {
        total: res?.total ?? runs.length,
        count: res?.count ?? runs.length,
        runs,
      };
    },
    run: async (
      runId: string
    ): Promise<{ run: AgentRunRecord; tool_executions: ToolExecutionRecord[] }> => {
      const res = await apiFetch<{ run: Record<string, unknown>; tool_executions: ToolExecutionRecord[] }>(
        `/api/agent/runs/${runId}`
      );
      return {
        run: normalizeAgentRun(res.run),
        tool_executions: res.tool_executions || [],
      };
    },
  },

  // Authentication & Session Management
  auth: {
    me: async (): Promise<CurrentUser> => {
      const u = await apiFetch<{
        id: string;
        email: string;
        name?: string;
        display_name?: string;
        role: string;
        status?: string;
        is_active?: boolean;
        department?: string | null;
        organization?: string | null;
        permissions?: string[];
      }>("/api/auth/me");

      const resolvedName = u.name || u.display_name || "Sentinel User";
      return {
        id: u.id,
        email: u.email,
        name: resolvedName,
        display_name: resolvedName,
        role: u.role || "VIEWER",
        status: u.status || "ACTIVE",
        is_active: u.is_active ?? true,
        department: u.department,
        organization: u.organization,
        permissions: u.permissions || [],
      };
    },
    logout: (): Promise<{ status: string }> =>
      apiFetch("/api/auth/logout", { method: "POST" }),
    loginUrl: (redirectUrl?: string): string => {
      const q = redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : "";
      return `${API_BASE}/api/auth/google/authorize${q}`;
    },
  },

  // Multi-Software Integrations Gateway
  integrations: {
    list: (): Promise<IntegrationListItem[]> => apiFetch("/api/integrations"),
    get: (id: string): Promise<IntegrationListItem> => apiFetch(`/api/integrations/${id}`),
    status: (id: string): Promise<IntegrationListItem> => apiFetch(`/api/integrations/${id}/status`),
    test: (id: string): Promise<Record<string, unknown>> =>
      apiFetch(`/api/integrations/${id}/test`, { method: "POST" }),
    disconnect: (id: string): Promise<Record<string, unknown>> =>
      apiFetch(`/api/integrations/${id}/disconnect`, { method: "POST" }),
    connect: (id: string, body: { access_token?: string; code?: string; token_type?: string }): Promise<Record<string, unknown>> =>
      apiFetch(`/api/integrations/${id}/connect`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getGithubOAuthUrl: (redirectUri?: string): Promise<{ authorization_url: string; state: string; client_id: string; redirect_uri: string }> =>
      apiFetch(`/api/integrations/github/connect${redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : ""}`),
    tools: (id: string): Promise<ToolInfo[]> => apiFetch(`/api/integrations/${id}/tools`),
    executeTool: (toolId: string, parameters: Record<string, unknown>, approvalTicketId?: string, reason?: string): Promise<ToolExecutionResponse> =>
      apiFetch(`/api/tools/${toolId}/execute`, {
        method: "POST",
        body: JSON.stringify({
          tool_id: toolId,
          parameters,
          approval_ticket_id: approvalTicketId,
          reason,
        }),
      }),
  },

  // MCP Servers
  mcpServers: {
    list: (): Promise<Array<Record<string, unknown>>> => apiFetch("/api/mcp-servers"),
    register: (body: {
      id: string;
      name: string;
      transport: string;
      endpoint: string;
      auth_method: string;
      environment: string;
    }): Promise<{ success: boolean; message: string; server?: unknown }> =>
      apiFetch("/api/mcp-servers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    test: (serverId: string): Promise<{ success: boolean; latency_ms?: number; message?: string }> =>
      apiFetch(`/api/mcp-servers/${serverId}/test`, { method: "POST" }),
  },
};
