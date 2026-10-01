/**
 * MCP Sentinel — Universal AI Agent Security Gateway
 * Authoritative Integration, Tool, Agent Run, and Risk Data System
 * Follows Architectural Intelligence visual & security specifications.
 */

export interface Integration {
  id: string;
  name: string;
  category: "Design" | "Source Control" | "Communication" | "Cloud Storage" | "Knowledgebase" | "Project Management" | "Custom Protocol";
  logo: string;
  status: "CONNECTED" | "DEGRADED" | "DISCONNECTED";
  authType: "OAuth 2.0" | "OAuth App" | "Bot Token" | "Service Account" | "Internal Token" | "mTLS / Secret";
  connectionEndpoint: string;
  toolsCount: number;
  lastActivity: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  permissions: string[];
  description: string;
  activePolicies: string[];
  tools: IntegrationTool[];
}

export interface IntegrationTool {
  id: string;
  name: string;
  description: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore: number;
  requiresApproval: boolean;
  isDestructive: boolean;
  allowedResources: string[];
  policy: string;
  parametersSchema: Record<string, unknown>;
  recentExecutionsCount: number;
}

export interface McpServer {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "stream-http";
  status: "ONLINE" | "CONNECTING" | "DEGRADED" | "OFFLINE";
  endpoint: string;
  toolsCount: number;
  authMethod: "None (Local stdio)" | "Bearer Token" | "Mutual TLS" | "OAuth 2.0";
  lastConnection: string;
  riskProfile: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  environment: "Production" | "Staging" | "Development";
  latencyMs: number;
  serverVersion: string;
  protocolVersion: string;
}

export interface AgentRun {
  id: string;
  agentName: string;
  agentId: string;
  model: string;
  environment: "Production" | "Staging" | "Development";
  application: string;
  toolName: string;
  executionState: "COMPLETED" | "RUNNING" | "BLOCKED" | "PENDING_APPROVAL" | "FAILED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore: number;
  approvalState: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  startedAt: string;
  durationMs: number;
  userPrompt: string;
  reasoning: string;
  toolDiscovery: string[];
  payload: Record<string, unknown>;
  policyEvaluated: string;
  executionResult?: Record<string, unknown>;
  auditEventId: string;
}

export interface PolicyDefinition {
  id: string;
  name: string;
  version: string;
  status: "ACTIVE" | "ENFORCING" | "DRAFT" | "DISABLED";
  scope: string;
  description: string;
  riskThreshold: number;
  lastUpdated: string;
  ruleCount: number;
  logic: {
    ifConditions: { field: string; operator: "EQUALS" | "CONTAINS" | "GREATER_THAN" | "IN"; value: string }[];
    thenDecisions: { action: "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK"; risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; execution: string };
  };
  rawYaml: string;
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
  status: "NOMINAL" | "ELEVATED" | "CRITICAL";
}

export interface SystemComponent {
  name: string;
  role: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  latencyMs: number;
  version: string;
  lastCheck: string;
  errors: number;
  uptimePercent: number;
}

// --------------------------------------------------------------------------
// Authoritative Integrations Registry
// --------------------------------------------------------------------------
export const INTEGRATIONS: Integration[] = [
  {
    id: "canva",
    name: "Canva",
    category: "Design",
    logo: "🎨",
    status: "CONNECTED",
    authType: "OAuth 2.0",
    connectionEndpoint: "https://api.canva.com/v1/mcp",
    toolsCount: 4,
    lastActivity: "2 mins ago",
    riskLevel: "MEDIUM",
    permissions: ["design:create", "design:read", "assets:write"],
    description: "Cloud-based visual communications platform. Allows autonomous creative asset drafting, template assembly, and brand kit compliance checks.",
    activePolicies: ["Marketing Asset Production Policy", "Production Data Protection"],
    tools: [
      {
        id: "canva.create_design",
        name: "create_design",
        description: "Creates a new brand design asset with specified dimensions, layers, and typography tokens.",
        riskLevel: "MEDIUM",
        riskScore: 42,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["team_folder/marketing/*", "campaigns/2026/*"],
        policy: "Marketing Asset Production Policy",
        parametersSchema: {
          type: "object",
          required: ["title", "width", "height"],
          properties: {
            title: { type: "string", description: "Title of the design asset" },
            width: { type: "number", default: 1920 },
            height: { type: "number", default: 1080 },
            template_id: { type: "string", optional: true }
          }
        },
        recentExecutionsCount: 342
      },
      {
        id: "canva.search_designs",
        name: "search_designs",
        description: "Searches organizational design assets by keyword, tag, or owner identity.",
        riskLevel: "LOW",
        riskScore: 12,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["*"],
        policy: "Read-Only Asset Discovery Policy",
        parametersSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            limit: { type: "number", default: 20 }
          }
        },
        recentExecutionsCount: 1209
      },
      {
        id: "canva.get_design",
        name: "get_design",
        description: "Fetches full metadata, layer hierarchy, and vector components for a design document.",
        riskLevel: "LOW",
        riskScore: 15,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["*"],
        policy: "Read-Only Asset Discovery Policy",
        parametersSchema: {
          type: "object",
          required: ["design_id"],
          properties: {
            design_id: { type: "string" }
          }
        },
        recentExecutionsCount: 890
      },
      {
        id: "canva.update_design",
        name: "update_design",
        description: "Modifies layer contents, text frames, or color schemes of an existing design asset.",
        riskLevel: "MEDIUM",
        riskScore: 48,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["team_folder/marketing/*"],
        policy: "Marketing Asset Production Policy",
        parametersSchema: {
          type: "object",
          required: ["design_id", "patch"],
          properties: {
            design_id: { type: "string" },
            patch: { type: "object" }
          }
        },
        recentExecutionsCount: 184
      }
    ]
  },
  {
    id: "github",
    name: "GitHub",
    category: "Source Control",
    logo: "🐙",
    status: "CONNECTED",
    authType: "OAuth App",
    connectionEndpoint: "https://api.github.com/mcp",
    toolsCount: 5,
    lastActivity: "Just now",
    riskLevel: "CRITICAL",
    permissions: ["repo:read", "repo:write", "admin:org", "pull_requests:write"],
    description: "Enterprise source code management, pull request review, branch protection, and CI/CD coordination.",
    activePolicies: ["Repository Protection Policy", "Production Data Protection"],
    tools: [
      {
        id: "github.create_pull_request",
        name: "create_pull_request",
        description: "Opens a pull request against a branch with automated security diff evaluation.",
        riskLevel: "MEDIUM",
        riskScore: 38,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["org/*:feature/*", "org/*:fix/*"],
        policy: "Code Contribution Governance",
        parametersSchema: {
          type: "object",
          required: ["repo", "title", "head", "base"],
          properties: {
            repo: { type: "string" },
            title: { type: "string" },
            head: { type: "string" },
            base: { type: "string" }
          }
        },
        recentExecutionsCount: 521
      },
      {
        id: "github.delete_repository",
        name: "delete_repository",
        description: "Permanently deletes an organization repository, purging code, issues, and git history.",
        riskLevel: "CRITICAL",
        riskScore: 98,
        requiresApproval: true,
        isDestructive: true,
        allowedResources: ["DENIED_BY_DEFAULT"],
        policy: "Repository Protection Policy",
        parametersSchema: {
          type: "object",
          required: ["owner", "repo", "confirm_deletion"],
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            confirm_deletion: { type: "boolean" }
          }
        },
        recentExecutionsCount: 4
      },
      {
        id: "github.modify_branch_protection",
        name: "modify_branch_protection",
        description: "Updates branch protection rules, required reviewers count, or enforce_admins settings.",
        riskLevel: "CRITICAL",
        riskScore: 92,
        requiresApproval: true,
        isDestructive: true,
        allowedResources: ["org/*:main", "org/*:prod"],
        policy: "Repository Protection Policy",
        parametersSchema: {
          type: "object",
          required: ["repo", "branch"],
          properties: {
            repo: { type: "string" },
            branch: { type: "string" }
          }
        },
        recentExecutionsCount: 12
      },
      {
        id: "github.merge_pull_request",
        name: "merge_pull_request",
        description: "Merges an approved pull request into target deployment branch.",
        riskLevel: "HIGH",
        riskScore: 74,
        requiresApproval: true,
        isDestructive: false,
        allowedResources: ["org/*:main"],
        policy: "Release Authorization Policy",
        parametersSchema: {
          type: "object",
          required: ["repo", "pull_number"],
          properties: {
            repo: { type: "string" },
            pull_number: { type: "number" }
          }
        },
        recentExecutionsCount: 312
      }
    ]
  },
  {
    id: "slack",
    name: "Slack",
    category: "Communication",
    logo: "💬",
    status: "CONNECTED",
    authType: "Bot Token",
    connectionEndpoint: "https://slack.com/api/mcp",
    toolsCount: 4,
    lastActivity: "1 min ago",
    riskLevel: "MEDIUM",
    permissions: ["chat:write", "channels:manage", "channels:read", "users:read"],
    description: "Enterprise messaging and incident war-room orchestration across authorized communication channels.",
    activePolicies: ["External Communication Policy"],
    tools: [
      {
        id: "slack.send_message",
        name: "send_message",
        description: "Dispatches a formatted message or block kit notification to an authorized channel or thread.",
        riskLevel: "LOW",
        riskScore: 25,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["#incident-*", "#security-alerts", "#marketing-general"],
        policy: "External Communication Policy",
        parametersSchema: {
          type: "object",
          required: ["channel", "text"],
          properties: {
            channel: { type: "string" },
            text: { type: "string" }
          }
        },
        recentExecutionsCount: 4510
      },
      {
        id: "slack.create_channel",
        name: "create_channel",
        description: "Creates a new public or private communication channel with defined topic and members.",
        riskLevel: "MEDIUM",
        riskScore: 40,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["channels:public", "channels:private"],
        policy: "External Communication Policy",
        parametersSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            is_private: { type: "boolean" }
          }
        },
        recentExecutionsCount: 96
      },
      {
        id: "slack.archive_channel",
        name: "archive_channel",
        description: "Archives an inactive channel, making it read-only and removing from general list.",
        riskLevel: "HIGH",
        riskScore: 68,
        requiresApproval: true,
        isDestructive: true,
        allowedResources: ["channels:*"],
        policy: "External Communication Policy",
        parametersSchema: {
          type: "object",
          required: ["channel_id"],
          properties: {
            channel_id: { type: "string" }
          }
        },
        recentExecutionsCount: 14
      }
    ]
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Cloud Storage",
    logo: "📁",
    status: "CONNECTED",
    authType: "OAuth 2.0",
    connectionEndpoint: "https://www.googleapis.com/drive/v3/mcp",
    toolsCount: 5,
    lastActivity: "4 mins ago",
    riskLevel: "HIGH",
    permissions: ["drive.readonly", "drive.file", "drive.metadata"],
    description: "Enterprise file store and collaborative document repository for corporate records and media.",
    activePolicies: ["Production Data Protection", "Personal Data Policy"],
    tools: [
      {
        id: "drive.search_files",
        name: "search_files",
        description: "Executes structured query search across corporate file hierarchies and shared drives.",
        riskLevel: "LOW",
        riskScore: 18,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["shared_drives/*"],
        policy: "Data Access & Classification Policy",
        parametersSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            page_size: { type: "number", default: 25 }
          }
        },
        recentExecutionsCount: 2190
      },
      {
        id: "drive.delete_file",
        name: "delete_file",
        description: "Permanently purges a file or folder from Google Drive, bypassing trash.",
        riskLevel: "CRITICAL",
        riskScore: 94,
        requiresApproval: true,
        isDestructive: true,
        allowedResources: ["shared_drives/*"],
        policy: "Production Data Protection",
        parametersSchema: {
          type: "object",
          required: ["file_id"],
          properties: {
            file_id: { type: "string" },
            supports_all_drives: { type: "boolean" }
          }
        },
        recentExecutionsCount: 19
      },
      {
        id: "drive.share_file",
        name: "share_file",
        description: "Modifies access control list (ACL) of a file or folder to external email domains.",
        riskLevel: "HIGH",
        riskScore: 82,
        requiresApproval: true,
        isDestructive: false,
        allowedResources: ["shared_drives/*"],
        policy: "Personal Data Policy",
        parametersSchema: {
          type: "object",
          required: ["file_id", "email_address", "role"],
          properties: {
            file_id: { type: "string" },
            email_address: { type: "string" },
            role: { type: "string", enum: ["reader", "commenter", "writer"] }
          }
        },
        recentExecutionsCount: 145
      }
    ]
  },
  {
    id: "notion",
    name: "Notion",
    category: "Knowledgebase",
    logo: "📑",
    status: "CONNECTED",
    authType: "Internal Token",
    connectionEndpoint: "https://api.notion.com/v1/mcp",
    toolsCount: 4,
    lastActivity: "8 mins ago",
    riskLevel: "MEDIUM",
    permissions: ["pages:read", "pages:write", "databases:read", "databases:write"],
    description: "Collaborative wiki, product specifications, operational runbooks, and roadmaps.",
    activePolicies: ["Internal Knowledgebase Policy"],
    tools: [
      {
        id: "notion.query_database",
        name: "query_database",
        description: "Runs compound filter and sorting queries against internal structured databases.",
        riskLevel: "LOW",
        riskScore: 16,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["workspace/*"],
        policy: "Internal Knowledgebase Policy",
        parametersSchema: {
          type: "object",
          required: ["database_id"],
          properties: {
            database_id: { type: "string" },
            filter: { type: "object" }
          }
        },
        recentExecutionsCount: 3120
      },
      {
        id: "notion.update_page",
        name: "update_page",
        description: "Appends blocks or updates properties on an existing engineering documentation page.",
        riskLevel: "MEDIUM",
        riskScore: 35,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["workspace/engineering/*", "workspace/product/*"],
        policy: "Internal Knowledgebase Policy",
        parametersSchema: {
          type: "object",
          required: ["page_id", "properties"],
          properties: {
            page_id: { type: "string" },
            properties: { type: "object" }
          }
        },
        recentExecutionsCount: 940
      }
    ]
  },
  {
    id: "jira",
    name: "Jira",
    category: "Project Management",
    logo: "📐",
    status: "CONNECTED",
    authType: "OAuth 2.0",
    connectionEndpoint: "https://api.atlassian.com/ex/jira/mcp",
    toolsCount: 4,
    lastActivity: "3 mins ago",
    riskLevel: "HIGH",
    permissions: ["jira:read", "jira:write", "jira:admin"],
    description: "Issue tracking, agile sprints, bug triage, and cross-team deployment verification tickets.",
    activePolicies: ["Issue Tracking & Release Governance"],
    tools: [
      {
        id: "jira.transition_issue",
        name: "transition_issue",
        description: "Advances ticket state (e.g. In Progress → Done, QA → Deployed to Prod).",
        riskLevel: "HIGH",
        riskScore: 72,
        requiresApproval: true,
        isDestructive: false,
        allowedResources: ["project:SEC", "project:INFRA", "project:APP"],
        policy: "Issue Tracking & Release Governance",
        parametersSchema: {
          type: "object",
          required: ["issue_id", "transition_id"],
          properties: {
            issue_id: { type: "string" },
            transition_id: { type: "string" }
          }
        },
        recentExecutionsCount: 820
      },
      {
        id: "jira.delete_project",
        name: "delete_project",
        description: "Completely removes a Jira project and all associated issues, components, and histories.",
        riskLevel: "CRITICAL",
        riskScore: 99,
        requiresApproval: true,
        isDestructive: true,
        allowedResources: ["DENIED_BY_DEFAULT"],
        policy: "Production Data Protection",
        parametersSchema: {
          type: "object",
          required: ["project_key", "confirm"],
          properties: {
            project_key: { type: "string" },
            confirm: { type: "boolean" }
          }
        },
        recentExecutionsCount: 0
      }
    ]
  },
  {
    id: "custom-mcp",
    name: "Custom MCP Gateways",
    category: "Custom Protocol",
    logo: "⚡",
    status: "CONNECTED",
    authType: "mTLS / Secret",
    connectionEndpoint: "http://127.0.0.1:8000/api/mcp",
    toolsCount: 8,
    lastActivity: "Active live",
    riskLevel: "HIGH",
    permissions: ["crm:read", "crm:write", "orders:manage", "audit:write"],
    description: "Direct Model Context Protocol gateways connected to internal PostgreSQL, CRM, and order settlement servers.",
    activePolicies: ["Production Data Protection", "Personal Data Policy"],
    tools: [
      {
        id: "mcp.get_customer",
        name: "get_customer",
        description: "Retrieves customer record by ID with authorized field projection.",
        riskLevel: "LOW",
        riskScore: 10,
        requiresApproval: false,
        isDestructive: false,
        allowedResources: ["customers/*"],
        policy: "Production Data Protection",
        parametersSchema: {
          type: "object",
          required: ["customer_id"],
          properties: { customer_id: { type: "integer" } }
        },
        recentExecutionsCount: 1420
      },
      {
        id: "mcp.delete_customer",
        name: "delete_customer",
        description: "Deletes customer and purges associated records. Strict human-approval gated.",
        riskLevel: "CRITICAL",
        riskScore: 95,
        requiresApproval: true,
        isDestructive: true,
        allowedResources: ["customers/*"],
        policy: "Production Data Protection",
        parametersSchema: {
          type: "object",
          required: ["customer_id"],
          properties: { customer_id: { type: "integer" } }
        },
        recentExecutionsCount: 8
      },
      {
        id: "mcp.update_customer_status",
        name: "update_customer_status",
        description: "Updates customer account lifecycle status (ACTIVE, SUSPENDED, PENDING).",
        riskLevel: "HIGH",
        riskScore: 78,
        requiresApproval: true,
        isDestructive: false,
        allowedResources: ["customers/*"],
        policy: "Production Data Protection",
        parametersSchema: {
          type: "object",
          required: ["customer_id", "status"],
          properties: { customer_id: { type: "integer" }, status: { type: "string" } }
        },
        recentExecutionsCount: 42
      }
    ]
  }
];

// --------------------------------------------------------------------------
// Authoritative MCP Servers Registry
// --------------------------------------------------------------------------
export const MCP_SERVERS: McpServer[] = [
  {
    id: "srv_canva_bridge",
    name: "canva-mcp-bridge",
    transport: "sse",
    status: "ONLINE",
    endpoint: "https://mcp.canva.internal/sse",
    toolsCount: 4,
    authMethod: "OAuth 2.0",
    lastConnection: "30s ago",
    riskProfile: "MEDIUM",
    environment: "Production",
    latencyMs: 38,
    serverVersion: "1.4.2",
    protocolVersion: "2024-11-05"
  },
  {
    id: "srv_github_core",
    name: "github-enterprise-sentinel",
    transport: "stream-http",
    status: "ONLINE",
    endpoint: "https://github-mcp.sentinel.corp/stream",
    toolsCount: 5,
    authMethod: "Bearer Token",
    lastConnection: "12s ago",
    riskProfile: "CRITICAL",
    environment: "Production",
    latencyMs: 64,
    serverVersion: "2.1.0",
    protocolVersion: "2024-11-05"
  },
  {
    id: "srv_slack_daemon",
    name: "slack-gateway-daemon",
    transport: "stdio",
    status: "ONLINE",
    endpoint: "subprocess: slack-mcp-linux-amd64",
    toolsCount: 4,
    authMethod: "None (Local stdio)",
    lastConnection: "5s ago",
    riskProfile: "LOW",
    environment: "Production",
    latencyMs: 4,
    serverVersion: "1.0.8",
    protocolVersion: "2024-11-05"
  },
  {
    id: "srv_gdrive_sync",
    name: "google-drive-vault-mcp",
    transport: "sse",
    status: "ONLINE",
    endpoint: "https://gsuite-mcp.sentinel.corp/sse",
    toolsCount: 5,
    authMethod: "OAuth 2.0",
    lastConnection: "1m ago",
    riskProfile: "HIGH",
    environment: "Production",
    latencyMs: 72,
    serverVersion: "1.2.3",
    protocolVersion: "2024-11-05"
  },
  {
    id: "srv_notion_agent",
    name: "notion-workspace-mcp",
    transport: "stream-http",
    status: "ONLINE",
    endpoint: "https://notion-bridge.sentinel.internal/mcp",
    toolsCount: 4,
    authMethod: "Bearer Token",
    lastConnection: "45s ago",
    riskProfile: "MEDIUM",
    environment: "Production",
    latencyMs: 85,
    serverVersion: "1.1.9",
    protocolVersion: "2024-11-05"
  },
  {
    id: "srv_jira_governance",
    name: "atlassian-jira-sentinel",
    transport: "sse",
    status: "ONLINE",
    endpoint: "https://jira-mcp.sentinel.corp/v1",
    toolsCount: 4,
    authMethod: "Mutual TLS",
    lastConnection: "15s ago",
    riskProfile: "HIGH",
    environment: "Production",
    latencyMs: 51,
    serverVersion: "2.0.1",
    protocolVersion: "2024-11-05"
  },
  {
    id: "srv_pg_sentinel",
    name: "fastmcp-postgresql-core",
    transport: "stdio",
    status: "ONLINE",
    endpoint: "subprocess: python -m mcp_sentinel.mcp_server.server",
    toolsCount: 8,
    authMethod: "None (Local stdio)",
    lastConnection: "2s ago",
    riskProfile: "CRITICAL",
    environment: "Production",
    latencyMs: 1,
    serverVersion: "1.0.0-rc.1",
    protocolVersion: "2024-11-05"
  }
];

// --------------------------------------------------------------------------
// Authoritative Agent Runs Observatory Data
// --------------------------------------------------------------------------
export const AGENT_RUNS: AgentRun[] = [
  {
    id: "run-90214",
    agentName: "DevOps Sentinel Agent",
    agentId: "agent-devops-01",
    model: "gemini-2.5-pro",
    environment: "Production",
    application: "GitHub",
    toolName: "delete_repository",
    executionState: "BLOCKED",
    riskLevel: "CRITICAL",
    riskScore: 98,
    approvalState: "REJECTED",
    startedAt: "2026-10-01T05:41:02Z",
    durationMs: 1120,
    userPrompt: "Clean up unused demo repositories including 'sentinel-prod-backend-v1' immediately.",
    reasoning: "User requested removal of repository. Tool discovery identified github.delete_repository. Target repository matches production regex. Dispatched candidate to SecurityGate.",
    toolDiscovery: ["github.list_repos", "github.delete_repository", "github.get_repo"],
    payload: {
      owner: "mcp-sentinel-corp",
      repo: "sentinel-prod-backend-v1",
      confirm_deletion: true
    },
    policyEvaluated: "Production Repository Protection (pol_repo_guard)",
    auditEventId: "aud_98410294"
  },
  {
    id: "run-90213",
    agentName: "Marketing Lead Agent",
    agentId: "agent-mktg-04",
    model: "gemini-2.5-flash",
    environment: "Production",
    application: "Canva",
    toolName: "create_design",
    executionState: "COMPLETED",
    riskLevel: "MEDIUM",
    riskScore: 42,
    approvalState: "APPROVED",
    startedAt: "2026-10-01T05:42:19Z",
    durationMs: 4210,
    userPrompt: "Generate a Q4 launch banner conforming to brand palette with 1920x1080 dimensions.",
    reasoning: "Prompt requested new design asset. Checked brand tokens. Invariant evaluation confirms operation is non-destructive. Parameter hash sealed. Dispatched via Canva MCP bridge.",
    toolDiscovery: ["canva.search_designs", "canva.create_design"],
    payload: {
      title: "Q4 Enterprise Launch Banner",
      width: 1920,
      height: 1080,
      template_id: "tmpl_brand_hero_v4"
    },
    policyEvaluated: "Marketing Asset Production Policy (pol_mktg_01)",
    executionResult: {
      design_id: "des_canva_9941a8",
      url: "https://canva.com/design/des_canva_9941a8",
      status: "ready"
    },
    auditEventId: "aud_98410295"
  },
  {
    id: "run-90212",
    agentName: "Customer Support Autonomous Agent",
    agentId: "agent-crm-02",
    model: "gemini-2.5-flash",
    environment: "Production",
    application: "Custom MCP",
    toolName: "delete_customer",
    executionState: "PENDING_APPROVAL",
    riskLevel: "HIGH",
    riskScore: 88,
    approvalState: "PENDING",
    startedAt: "2026-10-01T05:43:08Z",
    durationMs: 840,
    userPrompt: "Process GDPR erasure request for customer ID 10842 and purge database records.",
    reasoning: "Identified delete_customer. The tool is flagged is_destructive=true. Policy requires human confirmation before execution. Execution suspended at SecurityGate awaiting cryptographic approval ticket.",
    toolDiscovery: ["mcp.get_customer", "mcp.delete_customer"],
    payload: {
      customer_id: 10842,
      erasure_reason: "GDPR Article 17 Right to Erasure"
    },
    policyEvaluated: "Production Data Protection (pol_prod_data)",
    auditEventId: "aud_98410296"
  },
  {
    id: "run-90211",
    agentName: "SecOps Monitoring Bot",
    agentId: "agent-secops-09",
    model: "gemini-2.5-flash",
    environment: "Production",
    application: "Slack",
    toolName: "send_message",
    executionState: "COMPLETED",
    riskLevel: "LOW",
    riskScore: 22,
    approvalState: "NOT_REQUIRED",
    startedAt: "2026-10-01T05:44:11Z",
    durationMs: 1840,
    userPrompt: "Post daily security evaluation summary to #security-alerts channel.",
    reasoning: "Destination is authorized internal channel #security-alerts. Read-only message broadcast evaluated. Approved automatically by rule precedence.",
    toolDiscovery: ["slack.send_message"],
    payload: {
      channel: "#security-alerts",
      text: "Daily Sentinel Evaluation: 84/84 Passed (100% Invariant Compliance). Zero leaks."
    },
    policyEvaluated: "External Communication Policy (pol_ext_comm)",
    executionResult: { message_id: "msg_slack_109284", delivered: true },
    auditEventId: "aud_98410297"
  },
  {
    id: "run-90210",
    agentName: "Data Analyst Agent",
    agentId: "agent-analytics-03",
    model: "gemini-2.5-pro",
    environment: "Production",
    application: "Google Drive",
    toolName: "share_file",
    executionState: "BLOCKED",
    riskLevel: "CRITICAL",
    riskScore: 92,
    approvalState: "REJECTED",
    startedAt: "2026-10-01T05:40:00Z",
    durationMs: 950,
    userPrompt: "Share the Q3 Financial Ledger spreadsheet with vendor@external-consultancy.io with full edit permissions.",
    reasoning: "Target domain 'external-consultancy.io' is not in corporate allowlist. File contains classified financial columns. Invariant policy blocked action immediately.",
    toolDiscovery: ["drive.search_files", "drive.share_file"],
    payload: {
      file_id: "1x8K9-fin-ledger-2026-q3",
      email_address: "vendor@external-consultancy.io",
      role: "writer"
    },
    policyEvaluated: "Personal Data Policy / Exfiltration Guard (pol_pii)",
    auditEventId: "aud_98410298"
  }
];

// --------------------------------------------------------------------------
// Authoritative Policies Registry
// --------------------------------------------------------------------------
export const POLICIES: PolicyDefinition[] = [
  {
    id: "pol_prod_data",
    name: "Production Data Protection",
    version: "2.4.0",
    status: "ENFORCING",
    scope: "Global Database & Cloud Files",
    description: "Blocks any irreversible data destruction, bulk table truncate, or sensitive record deletion without two-person cryptographic sign-off.",
    riskThreshold: 80,
    lastUpdated: "2 hours ago",
    ruleCount: 8,
    logic: {
      ifConditions: [
        { field: "tool.is_destructive", operator: "EQUALS", value: "true" },
        { field: "environment", operator: "EQUALS", value: "production" }
      ],
      thenDecisions: {
        action: "REQUIRE_APPROVAL",
        risk: "CRITICAL",
        execution: "BLOCKED_UNTIL_APPROVED"
      }
    },
    rawYaml: `policy_id: pol_prod_data\nversion: 2.4.0\nprecedence:\n  - DENY\n  - DUAL_APPROVAL\n  - ALLOW\nrules:\n  - id: rule_protect_destroy\n    match:\n      is_destructive: true\n      environment: production\n    decision: BLOCKED_UNTIL_APPROVED\n    required_approvers: 2\n    parameter_hash: SHA256\n    token_ttl_seconds: 3600`
  },
  {
    id: "pol_repo_guard",
    name: "Repository Protection Policy",
    version: "1.9.2",
    status: "ENFORCING",
    scope: "GitHub Enterprise",
    description: "Strictly forbids autonomous repository deletion, branch protection overrides, and force-push executions across production git branches.",
    riskThreshold: 85,
    lastUpdated: "Yesterday",
    ruleCount: 5,
    logic: {
      ifConditions: [
        { field: "tool.name", operator: "EQUALS", value: "github.delete_repository" },
        { field: "environment", operator: "IN", value: "production,staging" }
      ],
      thenDecisions: {
        action: "BLOCK",
        risk: "CRITICAL",
        execution: "REJECTED_IMMEDIATELY"
      }
    },
    rawYaml: `policy_id: pol_repo_guard\nversion: 1.9.2\nrules:\n  - id: rule_block_repo_drop\n    match:\n      tool: github.delete_repository\n    decision: DENY\n    reason: "Autonomous deletion of version control repositories is permanently disallowed by governance mandate."`
  },
  {
    id: "pol_ext_comm",
    name: "External Communication Policy",
    version: "1.3.1",
    status: "ACTIVE",
    scope: "Slack & Messaging Gateways",
    description: "Governs public broadcast limits, prevents unverified mass mentions (@channel / @here), and enforces sensitive keyword scrubbing.",
    riskThreshold: 60,
    lastUpdated: "3 days ago",
    ruleCount: 4,
    logic: {
      ifConditions: [
        { field: "recipient_count", operator: "GREATER_THAN", value: "50" },
        { field: "has_pii", operator: "EQUALS", value: "true" }
      ],
      thenDecisions: {
        action: "REQUIRE_APPROVAL",
        risk: "HIGH",
        execution: "HOLD_IN_QUEUE"
      }
    },
    rawYaml: `policy_id: pol_ext_comm\nversion: 1.3.1\nrules:\n  - id: rule_sanitize_broadcast\n    match:\n      tool: slack.send_message\n      channel_type: public\n    decision: EVALUATE_CONTENT`
  },
  {
    id: "pol_financial",
    name: "Financial Action Policy",
    version: "3.0.0",
    status: "ENFORCING",
    scope: "Jira, Billing & Stripe MCP",
    description: "Requires explicit finance lead authorization for any invoice dispute, balance write-off, or budget reallocation exceeding $500.",
    riskThreshold: 75,
    lastUpdated: "Oct 1, 2026",
    ruleCount: 6,
    logic: {
      ifConditions: [
        { field: "amount_usd", operator: "GREATER_THAN", value: "500" },
        { field: "category", operator: "EQUALS", value: "billing" }
      ],
      thenDecisions: {
        action: "REQUIRE_APPROVAL",
        risk: "CRITICAL",
        execution: "BLOCKED_UNTIL_APPROVED"
      }
    },
    rawYaml: `policy_id: pol_financial\nversion: 3.0.0\nrules:\n  - id: rule_high_value_transfers\n    match:\n      action: refund_or_transfer\n      threshold_usd: 500\n    decision: DUAL_APPROVAL_REQUIRED`
  },
  {
    id: "pol_pii",
    name: "Personal Data Policy",
    version: "2.1.0",
    status: "ENFORCING",
    scope: "Google Drive & Customer Database",
    description: "Prevents exposure of customer names, email addresses, and payment tokens to unauthenticated models or external domains.",
    riskThreshold: 70,
    lastUpdated: "5 days ago",
    ruleCount: 7,
    logic: {
      ifConditions: [
        { field: "data_classification", operator: "EQUALS", value: "RESTRICTED" },
        { field: "target_domain", operator: "EQUALS", value: "external" }
      ],
      thenDecisions: {
        action: "BLOCK",
        risk: "CRITICAL",
        execution: "BLOCKED_IMMEDIATELY"
      }
    },
    rawYaml: `policy_id: pol_pii\nversion: 2.1.0\nrules:\n  - id: rule_block_external_exfiltration\n    match:\n      contains_pii: true\n      destination: outside_corp_domain\n    decision: DENY`
  }
];

// --------------------------------------------------------------------------
// Authoritative System Health Topology
// --------------------------------------------------------------------------
export const SYSTEM_TOPOLOGY: SystemComponent[] = [
  {
    name: "Frontend Console",
    role: "Next.js 16.3.5 Turbopack (Port 3000)",
    status: "ONLINE",
    latencyMs: 3,
    version: "1.0.0-rc.1",
    lastCheck: "1s ago",
    errors: 0,
    uptimePercent: 99.99
  },
  {
    name: "Backend Security Core",
    role: "FastAPI REST API & SecurityGate (Port 8000)",
    status: "ONLINE",
    latencyMs: 12,
    version: "1.0.0-rc.1",
    lastCheck: "2s ago",
    errors: 0,
    uptimePercent: 99.98
  },
  {
    name: "Immutable Database",
    role: "PostgreSQL 18.1 Pool (Port 5000 / mcp_sentinel_db)",
    status: "ONLINE",
    latencyMs: 2,
    version: "18.1.0",
    lastCheck: "2s ago",
    errors: 0,
    uptimePercent: 100.0
  },
  {
    name: "MCP Gateway Protocol",
    role: "FastMCP Server & Tool Registry Dispatcher",
    status: "ONLINE",
    latencyMs: 4,
    version: "2024-11-05 Spec",
    lastCheck: "3s ago",
    errors: 0,
    uptimePercent: 99.99
  },
  {
    name: "Gemini Reasoning Engine",
    role: "Google Gemini 2.5 Flash / Pro (REST API)",
    status: "ONLINE",
    latencyMs: 184,
    version: "gemini-2.5-flash",
    lastCheck: "5s ago",
    errors: 0,
    uptimePercent: 99.95
  },
  {
    name: "Connected MCP Servers",
    role: "7 Active MCP Server Bridges (Canva, GitHub, Slack, Drive, Notion, Jira, Postgres)",
    status: "ONLINE",
    latencyMs: 42,
    version: "MCP 1.4+",
    lastCheck: "8s ago",
    errors: 0,
    uptimePercent: 99.92
  },
  {
    name: "External Software Integrations",
    role: "6 Enterprise SaaS OAuth Connectors",
    status: "ONLINE",
    latencyMs: 65,
    version: "OAuth 2.0 / REST",
    lastCheck: "12s ago",
    errors: 0,
    uptimePercent: 99.90
  }
];

// --------------------------------------------------------------------------
// Authoritative 6-Factor Risk Breakdown
// --------------------------------------------------------------------------
export const RISK_FACTORS: RiskFactor[] = [
  {
    name: "Action Destructiveness",
    weight: 0.25,
    score: 18,
    description: "Evaluates whether tool performs delete, truncate, overwrite, or irreversible state changes.",
    status: "NOMINAL"
  },
  {
    name: "Data Sensitivity & PII",
    weight: 0.20,
    score: 24,
    description: "Detects customer secrets, personal identifiers, payment records, and restricted IP.",
    status: "NOMINAL"
  },
  {
    name: "Environmental Blast Radius",
    weight: 0.20,
    score: 30,
    description: "Assesses execution boundary between production, staging, development, and external domains.",
    status: "NOMINAL"
  },
  {
    name: "Operational Reversibility",
    weight: 0.15,
    score: 22,
    description: "Calculates time-to-rollback and availability of cryptographic point-in-time recovery.",
    status: "NOMINAL"
  },
  {
    name: "External API Boundary Exposure",
    weight: 0.10,
    score: 15,
    description: "Monitors third-party SaaS transmission, public internet endpoints, and egress leaks.",
    status: "NOMINAL"
  },
  {
    name: "Caller Privilege & Identity",
    weight: 0.10,
    score: 10,
    description: "Validates authenticated agent token scope, user RBAC role, and dual-custody authorization.",
    status: "NOMINAL"
  }
];
