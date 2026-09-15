/**
 * MCP-Sentinel Frontend API Client
 * All calls proxy to the FastAPI backend at NEXT_PUBLIC_API_URL.
 * Zero mock data — every function issues a real HTTP request.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const url = `${API_BASE}${path}`;
  const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(
    (options.method || "GET").toUpperCase()
  );

  const res = await fetch(url, {
    ...options,
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

  return res.json() as Promise<T>;
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
  ticket_id: string;
  request_id: string;
  agent_id: string;
  requester_id: string;
  approver_id: string | null;
  tool_name: string;
  target_id: string;
  action: string;
  parameters: Record<string, unknown>;
  parameter_hash: string;
  environment: string;
  policy_id: string;
  risk_level: string;
  risk_score: number;
  status: string;
  reason: string;
  decision_notes: string | null;
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
}

export interface AuditStats {
  total: number;
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
}

export interface SecurityEvalScenario {
  scenario_id: string | number;
  name: string;
  category: string;
  passed: boolean;
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

export interface HealthStatus {
  status: string;
  db?: string;
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
  const results: SecurityEvalScenario[] = rawResults.map((r: Record<string, unknown>) => ({
    scenario_id: String(r.scenario_id ?? ""),
    name: String(r.name ?? "Scenario"),
    category: String(r.category ?? "SECURITY"),
    passed: Boolean(r.passed),
    expected: String(r.expected ?? r.expected_decision ?? "ALLOW"),
    actual: String(r.actual ?? r.actual_decision ?? (r.passed ? "ALLOW" : "BLOCK")),
    expected_decision: r.expected_decision ? String(r.expected_decision) : undefined,
    actual_decision: r.actual_decision ? String(r.actual_decision) : undefined,
    duration_ms: Number(r.duration_ms ?? r.latency_ms ?? 0),
    latency_ms: Number(r.latency_ms ?? r.duration_ms ?? 0),
    db_integrity_verified: Boolean(r.db_integrity_verified),
    notes: r.notes ? String(r.notes) : undefined,
    error: r.error ? String(r.error) : null,
  }));

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

// --------------------------------------------------------------------------
// API Functions
// --------------------------------------------------------------------------
export const api = {
  // Health
  health: (): Promise<HealthStatus> => apiFetch("/health"),

  // Dashboard
  dashboard: {
    stats: (): Promise<DashboardStats> => apiFetch("/api/dashboard/stats"),
  },

  // Approvals
  approvals: {
    list: (params?: { status?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status && params.status !== "ALL") q.set("status", params.status);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      return apiFetch<ApprovalRecord[]>(`/api/approvals${qs ? "?" + qs : ""}`);
    },
    pending: (): Promise<ApprovalRecord[]> => apiFetch("/api/approvals/pending"),
    get: (ticketId: string): Promise<ApprovalRecord> =>
      apiFetch(`/api/approvals/${ticketId}`),
    approve: (ticketId: string, notes?: string): Promise<ApprovalRecord> =>
      apiFetch(`/api/approvals/${ticketId}/approve`, {
        method: "POST",
        body: JSON.stringify({ decision_notes: notes }),
      }),
    deny: (ticketId: string, notes?: string): Promise<ApprovalRecord> =>
      apiFetch(`/api/approvals/${ticketId}/deny`, {
        method: "POST",
        body: JSON.stringify({ decision_notes: notes }),
      }),
    cancel: (ticketId: string, notes?: string): Promise<ApprovalRecord> =>
      apiFetch(`/api/approvals/${ticketId}/cancel`, {
        method: "POST",
        body: notes ? JSON.stringify({ decision_notes: notes }) : undefined,
      }),
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
        const riskLevel = String(t.risk_level || t.base_risk || (isDestructive ? "CRITICAL" : "LOW"));
        return {
          tool_name: name,
          name: name,
          description: String(t.description || TOOL_DESCRIPTIONS[name] || `FastMCP tool: ${name}`),
          risk_level: riskLevel,
          base_risk: String(t.base_risk || riskLevel),
          is_destructive: isDestructive,
          destructive: isDestructive,
          requires_approval: Boolean(
            t.requires_approval ?? (isDestructive || riskLevel === "CRITICAL" || riskLevel === "HIGH")
          ),
          read_only: readOnly,
          operation_type: t.operation_type ? String(t.operation_type) : undefined,
          resource_type: t.resource_type ? String(t.resource_type) : undefined,
          data_sensitivity: t.data_sensitivity ? String(t.data_sensitivity) : undefined,
        };
      });
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
};
