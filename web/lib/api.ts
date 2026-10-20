/**
 * SentinelCore Frontend API Client
 * All calls proxy to the FastAPI backend at NEXT_PUBLIC_API_URL.
 * Zero mock data — every function issues a real HTTP request.
 */

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    // Server-side (Node.js runtime inside Docker): talk to backend container directly
    return process.env.API_BASE_URL || process.env.BACKEND_URL || "http://api:8000";
  }
  // Browser-side:
  // If NEXT_PUBLIC_API_URL is set to a real external domain (not localhost/127.0.0.1), use it.
  // Otherwise, use same-origin relative path "" so requests route through Caddy or Next.js rewrites.
  const pub = process.env.NEXT_PUBLIC_API_URL;
  if (pub && !pub.includes("localhost") && !pub.includes("127.0.0.1")) {
    return pub.replace(/\/+$/, "");
  }
  return "";
}

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
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  const role = localStorage.getItem("sentinel_role");
  const email = localStorage.getItem("sentinel_email");

  // Only send test headers if explicitly set in localStorage
  if (role && email) {
    return {
      "X-Test-User-Role": role,
      "X-Test-User-Email": email,
    };
  }
  return {};
}

// --------------------------------------------------------------------------
// Core fetch wrapper
// --------------------------------------------------------------------------
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getBaseUrl();
  const url = `${base}${normalizedPath}`;
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
      const errorMsg =
        (typeof body.message === "string" && body.message) ||
        (typeof body.detail === "string" && body.detail) ||
        (Array.isArray(body.detail) &&
          body.detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join("; ")) ||
        res.statusText ||
        "Request failed";
      throw new ApiError(res.status, errorMsg, body);
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
  errorType?: string;
  requestId?: string;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    if (typeof body === "object" && body !== null) {
      const b = body as Record<string, unknown>;
      if (typeof b.error_type === "string") this.errorType = b.error_type;
      if (typeof b.request_id === "string") this.requestId = b.request_id;
    }
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

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isTimeout(): boolean {
    return this.status === 408 || this.status === 504;
  }

  get isServerError(): boolean {
    return this.status >= 500;
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
  tool_id?: string;
  integration_id?: string;
  tool_name: string;
  name: string;
  description: string;
  risk_level: string;
  base_risk: string;
  is_destructive: boolean;
  destructive: boolean;
  requires_approval: boolean;
  approval_required?: boolean;
  read_only: boolean;
  enabled?: boolean;
  state?: string;
  operation_type?: string;
  resource_type?: string;
  data_sensitivity?: string;
  parameters?: Record<string, unknown> | null;
  schema?: Record<string, unknown> | null;
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
  credential_status?: "CONFIGURED" | "MISSING" | string;
  is_configured?: boolean;
  is_authenticated?: boolean;
  masked_token?: string | null;
  write_enabled?: boolean;
  oauth_configured?: boolean;
  workspace_info?: {
    workspace_name?: string;
    bot_name?: string;
    bot_id?: string;
    workspace_id?: string;
    workspace_icon?: string;
    api_version?: string;
  } | null;
  project_info?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    tls_enforced?: boolean;
    protocol?: string;
    pool?: {
      total: number;
      used: number;
      free: number;
    };
  } | null;
  last_test_result?: {
    success: boolean;
    latency_ms?: number;
    message?: string;
    server_version?: string;
    details?: Record<string, unknown>;
  } | null;
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
      return list.map((t, idx) => {
        const toolId = String(t.tool_id || t.id || "");
        const integrationId = t.integration_id ? String(t.integration_id) : undefined;
        const name = String(t.tool_name || t.name || (toolId ? toolId : `tool_${idx}`));
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
          tool_id: toolId || (integrationId ? `${integrationId}.${name}` : `${name}_${idx}`),
          integration_id: integrationId,
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
      const base = getBaseUrl();
      return `${base}/api/auth/google/authorize${q}`;
    },
    loginWithToken: async (
      idToken: string
    ): Promise<{ access_token: string; token_type: string; user: CurrentUser }> => {
      return apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ id_token: idToken }),
      });
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
    connect: (
      id: string,
      body: {
        access_token?: string;
        api_key?: string;
        token_type?: string;
        connection_string?: string;
        host?: string;
        port?: number;
        database?: string;
        username?: string;
        password?: string;
        ssl_mode?: string;
      }
    ): Promise<Record<string, unknown>> =>
      apiFetch(`/api/integrations/${id}/connect`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    notionOAuthAuthorizeUrl: async (): Promise<string> => {
      const res = await apiFetch<{ authorization_url: string }>("/api/integrations/notion/oauth/authorize");
      return res.authorization_url;
    },
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
