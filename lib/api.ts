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
}

export interface CurrentUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  department?: string | null;
  organization?: string | null;
  status: string;
  permissions: string[];
}

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
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
  id: string;
  event_type: string;
  tool_name: string;
  decision: string;
  risk_score: number | null;
  policy_id: string | null;
  agent_id: string | null;
  request_id: string | null;
  created_at: string;
  event_data: Record<string, unknown> | null;
}

export interface AuditStats {
  total: number;
  by_decision: Record<string, number>;
  by_tool: Record<string, number>;
}

export interface PolicyInfo {
  id: string;
  name: string;
  version: string;
  rules: {
    rule_id: string;
    description: string;
    action: string;
    priority: number;
  }[];
}

export interface ToolInfo {
  name: string;
  description: string;
  risk_level: string;
  is_destructive: boolean;
  requires_approval: boolean;
  read_only: boolean;
}

export interface SecurityEvalResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    pass_rate: number;
    duration_seconds: number;
  };
  results: {
    scenario_id: number;
    name: string;
    category: string;
    passed: boolean;
    expected: string;
    actual: string;
    duration_ms: number;
    error: string | null;
  }[];
  generated_at: string;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: { tool: string; result: string }[];
}

export interface AgentChatResponse {
  response: string;
  iterations: number;
  tool_calls_made: number;
  final_state: string;
  messages?: AgentMessage[];
}

export interface HealthStatus {
  status: string;
  db?: string;
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
      if (params?.status) q.set("status", params.status);
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
    cancel: (ticketId: string): Promise<ApprovalRecord> =>
      apiFetch(`/api/approvals/${ticketId}/cancel`, { method: "POST" }),
  },

  // Audit
  audit: {
    events: (params?: { limit?: number; offset?: number }): Promise<{ events: AuditEvent[]; total: number }> => {
      const q = new URLSearchParams();
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      const qs = q.toString();
      return apiFetch(`/api/audit/events${qs ? "?" + qs : ""}`);
    },
    stats: (): Promise<AuditStats> => apiFetch("/api/audit/stats"),
  },

  // Policies & Tools
  policies: {
    list: (): Promise<PolicyInfo[]> => apiFetch("/api/policies"),
    tools: (): Promise<ToolInfo[]> => apiFetch("/api/tools"),
  },

  // Security Evaluation
  security: {
    runEval: (): Promise<SecurityEvalResult> =>
      apiFetch("/api/security/eval", { method: "POST" }),
  },

  // Agent
  agent: {
    chat: (message: string): Promise<AgentChatResponse> =>
      apiFetch("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    status: (): Promise<{ status: string; agent_id: string; model: string }> =>
      apiFetch("/api/agent/status"),
  },

  // Authentication & Session Management
  auth: {
    me: (): Promise<CurrentUser> => apiFetch("/api/auth/me"),
    logout: (): Promise<{ status: string }> =>
      apiFetch("/api/auth/logout", { method: "POST" }),
    loginUrl: (redirectUrl?: string): string => {
      const q = redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : "";
      return `${API_BASE}/api/auth/google/authorize${q}`;
    },
  },
};
