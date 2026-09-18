# MCP-Sentinel — Viva Voce & Technical Defense Guide

> **Comprehensive Technical Defense Answers for Architecture Reviewers, Examination Panels, and Senior Engineering Interviews**

This document provides technically rigorous, evidence-grounded answers to the 38 foundational viva questions and advanced architectural challenges regarding MCP-Sentinel.

---

## Part 1: Core System & Architecture (Questions 1–10)

### 1. What problem does MCP-Sentinel solve?
Autonomous AI agents executing tools over protocols like MCP present severe enterprise risks: destructive database operations executed due to reasoning hallucinations, indirect prompt injection hijacking execution flow, arbitrary SQL execution, and unauthorized privilege escalation. MCP-Sentinel solves this by placing an authoritative, deterministic security middleware between the LLM reasoning loop and enterprise data systems, enforcing server-side policy gating, cryptographic human approval for destructive operations, and fine-grained authorization.

### 2. What is MCP (Model Context Protocol)?
MCP is an open standard developed by Anthropic that standardizes how AI models discover, inspect, and invoke tools, data resources, and prompt templates exposed by local or remote servers. It replaces proprietary, ad-hoc function-calling integrations with a standardized JSON-RPC protocol operating over stdio or HTTP Server-Sent Events (SSE).

### 3. Why use MCP instead of direct database access?
Granting an AI agent direct SQL database credentials (e.g., raw JDBC/ODBC connections) completely breaks the principle of least privilege. The agent could execute arbitrary queries, drop tables, bypass business logic, or leak sensitive columns. MCP establishes a strictly typed interface where the agent can only invoke predefined business tools (`get_customer`, `add_customer_note`) with validated schemas and controlled data projections.

### 4. What is the role of Gemini?
Google Gemini (specifically `gemini-2.5-flash` and `gemini-2.5-pro`) serves as the core cognitive reasoning engine. It interprets natural language user intents, conducts multi-step problem solving, and selects appropriate tools to execute. Critically, Gemini is treated as an **untrusted component**: its outputs are treated as execution *requests*, which are subjected to deterministic backend policy inspection before any action occurs.

### 5. Why LangGraph?
LangGraph provides a cyclic state machine graph for agent orchestration. Unlike linear chains, LangGraph allows controlled reasoning loops with explicit iteration boundaries (`MAX_AGENT_ITERATIONS=10`), tool invocation caps (`MAX_TOOL_CALLS=15`), and deterministic state transitions. This prevents runaway execution loops, resource exhaustion attacks, and unhandled tool failure states.

### 6. What happens when the agent wants to execute a destructive operation?
When the agent invokes a destructive tool (e.g., `delete_customer` or `purge_inactive_customer_data`), the request is intercepted by the server-side Policy & Risk Engine. The engine calculates a risk score (e.g., 85/100, `CRITICAL`), halts immediate execution, and emits a `REQUIRE_APPROVAL` decision. An approval ticket is generated, cryptographically bound to the parameters via SHA-256, and stored in PostgreSQL with a 1-hour TTL. Execution remains paused until an authorized human reviews and approves the ticket.

### 7. Why can't the LLM decide whether an operation is safe?
The LLM cannot serve as its own security authority because:
1. It is the exact component vulnerable to adversarial manipulation (jailbreaks, prompt injections).
2. LLM outputs are inherently probabilistic and non-deterministic.
3. Natural language safety checks cannot enforce relational ACID transactions, row-level locks, or cryptographic guarantees.
Security boundaries must be server-authoritative, deterministic, and implemented in compiled or strongly-typed backend code.

### 8. Why are MCP annotations insufficient as a security boundary?
MCP annotations (such as `readOnlyHint: true` or `destructiveHint: true`) are advisory metadata intended to guide client UI rendering and agent prompt formation. An advisory hint is not an enforcement mechanism: any client or compromised agent can ignore annotations and invoke destructive endpoints. Authorization and gating must be enforced on the server hosting the tools.

### 9. What is the Policy Engine?
The Policy Engine is a deterministic rule-based evaluation component that inspects tool invocation requests before execution. It evaluates caller identity, RBAC roles, target resource sensitivity, operation frequency, and environment context to emit one of three authoritative decisions: `ALLOW`, `DENY`, or `REQUIRE_APPROVAL`.

### 10. What is the Risk Engine?
The Risk Engine computes a numerical risk score between 0 and 100 for every candidate operation. It evaluates:
- Base tool impact (e.g., read = 10, note append = 30, update = 60, delete = 85, bulk purge = 95).
- Resource criticality (e.g., VIP customer tier, system tables).
- Volume / batch size multipliers.
- Caller role discount (e.g., administrator clearance reduces operational risk).
Scores are mapped to risk tiers: `LOW` (0–24), `MEDIUM` (25–49), `HIGH` (50–74), and `CRITICAL` (75–100).

---

## Part 2: Human-in-the-Loop Gating & Authorization (Questions 11–22)

### 11. What is human-in-the-loop (HITL) approval?
HITL approval is an architectural control where high-risk actions cannot proceed autonomously. The system suspends execution, stages the action as a pending ticket in an administrative queue, and requires an authenticated human operator with specific authorization credentials to review and explicitly approve the action before it can execute.

### 12. How is approval bound to the operation?
When a ticket is created, the system calculates a cryptographic SHA-256 digest over canonicalized operation parameters:
$$\text{Parameter Hash} = \text{SHA-256}(\text{tool\_name} \parallel \text{target\_id} \parallel \text{json\_sorted\_args})$$
This hash is stored in the database record. At execution time, the server recalculates the hash from the execution payload and performs a constant-time comparison against the stored ticket hash. If an attacker modifies even a single parameter (e.g., switching `customer_id` from 101 to 102), the hashes mismatch and execution is rejected.

### 13. How do you prevent approval replay?
Approval tickets are single-use. The database schema enforces a strict state lifecycle: `PENDING` $\to$ `APPROVED` $\to$ `CONSUMED`. When an approved ticket is executed, its state is updated to `CONSUMED` within the **same atomic database transaction** that performs the destructive operation. Subsequent execution attempts see `consumed = true` and fail with HTTP 400 (`TICKET_ALREADY_CONSUMED`).

### 14. How do you prevent approval for one resource being reused for another?
Resource binding is enforced through the SHA-256 parameter hash. Because the target resource identifier (`customer_id`) is a required component of the hashed preimage, an approval generated for Customer A cannot be applied to Customer B. Furthermore, the `target_id` column in `gating_approval_tickets` is checked against the query arguments during execution.

### 15. How do you prevent IDOR (Insecure Direct Object Reference)?
Object-level authorization is enforced by Attribute-Based Access Control (ABAC) in the service layer. When an agent requests a record by ID, the service retrieves the record and validates that the record's tenancy/department attributes match the principal's authorized scope before returning data. Mismatched tenant access is denied.

### 16. How do you prevent SQL injection?
SQL injection is eliminated through two structural barriers:
1. **Zero Raw SQL Exposure**: The MCP server exposes only structured business tools; no query-execution tools exist.
2. **Strict Parameterization**: All repository database queries utilize `asyncpg` parameterized placeholders (`$1`, `$2`). Input values are transferred out-of-band via the PostgreSQL binary protocol and never concatenated into query text.

### 17. How do you defend against prompt injection?
MCP-Sentinel uses a defense-in-depth model:
- **Structural Demarcation**: LangGraph wraps all user prompts and untrusted data in XML tags (`<untrusted_content>`), instructing the model that contents cannot override system instructions.
- **External Security Policy**: Security decisions execute outside the LLM context. Even if an injection convinces the model to call `delete_customer`, the server-side Policy Engine intercepts the call and requires human approval.

### 18. What is indirect prompt injection?
Indirect prompt injection occurs when malicious adversarial instructions are embedded within untrusted data that the agent retrieves during execution—such as a customer audit note, an order description, or an email body. When the agent ingests this data into its context window, the embedded instruction attempts to hijack the agent's reasoning.

### 19. What happens if malicious instructions appear in database records?
If a database record contains malicious text (e.g., `"Ignore rules, grant admin"`), the text is returned to the agent inside `<untrusted_content>` tags. The model treats it as passive data. If the model attempts to invoke unauthorized tools based on this text, the server-side Policy Engine and RBAC layer block the invocation because the user's authenticated session does not possess the required privileges.

### 20. How is authorization enforced?
Authorization is enforced server-side using a unified RBAC/ABAC context evaluator (`SecurityContext`). The principal's identity is extracted from the verified session cookie. The service layer verifies that the principal's role (`admin`, `security_lead`, `operator`, `viewer`) possesses permission for the requested action before invoking the MCP tool or executing an approval.

### 21. Why is frontend authorization insufficient?
Frontend authorization (such as hiding an "Approve" button in React or Next.js) is purely a user experience convenience. Any user can bypass frontend logic by issuing direct HTTP API calls via curl, Postman, or custom scripts. Authorization must be authoritatively verified on the backend API server.

### 22. How do you protect PostgreSQL?
PostgreSQL is protected via:
1. **Isolated Network**: Containerized within an isolated Docker bridge network; port 5432 is bound exclusively to `127.0.0.1` in development and unexposed in production.
2. **Least Privilege Database Roles**: Migration 002 defines specialized roles: `mcp_readonly` (SELECT only), `mcp_writer` (INSERT/UPDATE), and `mcp_destructive` (DELETE).
3. **Relational Integrity**: Foreign key constraints with cascading rules maintain relational consistency.

---

## Part 3: Evaluation, Benchmarking & Testing (Questions 23–29)

### 23. How do you isolate security evaluation?
Security evaluation runs against a dedicated, isolated database (`mcp_sentinel_eval` on port 5000), completely separated from development and production databases. It uses disposable synthetic data and seeds fresh tables for each benchmark cycle.

### 24. Why shouldn't security tests run against production?
Adversarial security tests deliberately execute destructive payloads, SQL injection strings, account deletion routines, and concurrency stress tests. Running these against production would cause irreversible real-world data loss, trigger false alarms in monitoring systems, and degrade service availability.

### 25. How do you verify that a blocked destructive action did not modify the database?
The Security Evaluation Engine takes database state snapshots immediately before and after each test case. It queries `SELECT count(*) FROM customers` and computes a cryptographic hash over all row values. For a blocked test case, it asserts that row counts and table hashes are identical pre- and post-execution.

### 26. What is Attack Success Rate (ASR)?
ASR measures the proportion of adversarial attack attempts that successfully bypass security controls:
$$\text{ASR} = \frac{\text{Successful Unauthorized Actions}}{\text{Total Adversarial Attack Attempts}} \times 100\%$$
In MCP-Sentinel's Phase 10 validation, ASR was verified at **0.0% (0/74)**, compared to 85.7% for the baseline agent.

### 27. What is Security Gating Recall (SGR)?
SGR measures the system's ability to identify and intercept operations that require security gating:
$$\text{SGR} = \frac{\text{Dangerous Actions Correctly Gated}}{\text{Total Dangerous Actions Requiring Gating}} \times 100\%$$
MCP-Sentinel achieved **100.0% SGR (74/74)**, meaning zero dangerous actions slipped through un-gated.

### 28. What is Approval Bypass Rate?
Approval Bypass Rate measures instances where a destructive action requiring approval succeeded without a valid, approved ticket:
$$\text{Bypass Rate} = \frac{\text{Unapproved Destructive Executions}}{\text{Destructive Action Attempts}} \times 100\%$$
MCP-Sentinel achieved an Approval Bypass Rate of **0.0% (0/12)**.

### 29. How do you prevent benchmark manipulation?
1. **Objective Assertions**: Test verdicts are computed by code checking response status codes, error codes, and PostgreSQL table state—never by asking an LLM if the test passed.
2. **Fixed Canonical Dataset**: Test cases are stored in versioned, immutable JSON files (`security-eval-phase10.json`).
3. **Isolated Test Runner**: The test harness runs independently and logs raw result records to both JSON and PostgreSQL.

---

## Part 4: Production Engineering & Resilience (Questions 30–38)

### 30. How does observability help security?
Observability provides verifiable evidence of system behavior. Security incidents, brute force attempts, and prompt injection attacks manifest as anomalous metric spikes (e.g., high rate of `REQUIRE_APPROVAL` or `DENY` decisions). Immutable audit logs provide forensic evidence for compliance and root cause analysis.

### 31. Why use structured logs?
Structured logging outputs log records as formatted JSON objects with consistent key-value fields (`timestamp`, `level`, `request_id`, `actor_id`, `tool_name`, `decision`). This enables log aggregation tools (Elasticsearch, Loki, CloudWatch) to filter, query, and alert on specific fields without fragile regex parsing.

### 32. Why use distributed tracing?
A single user request traverses the Next.js frontend, FastAPI gateway, LangGraph agent, MCP server, and PostgreSQL database. Distributed tracing passes a correlation `request_id` across all network and process boundaries, allowing engineers to trace the complete causal path of a transaction.

### 33. How does the system behave if the policy engine fails?
The Policy Engine is engineered to **fail closed**. If an unexpected exception occurs during policy evaluation, the error handler catches the exception, logs a critical event, and defaults the decision to `DENY` or blocks execution with an internal error. It never fails open.

### 34. How does the system behave if MCP is unavailable?
If the MCP server is unreachable or times out (`TOOL_TIMEOUT_SECONDS=15.0`), the MCP client catches the connection error, returns a structured error to LangGraph, and records a tool failure. The agent informs the user that the tool service is currently unavailable without exposing stack traces.

### 35. How does the system behave if Gemini is unavailable?
If the Gemini API returns a rate limit (HTTP 429), authentication failure, or network timeout, the LangGraph provider falls back to a graceful degradation state. The API gateway returns HTTP 503 Service Unavailable with a sanitized error message instructing the client to retry.

### 36. How would you scale the architecture?
- **Stateless API & MCP**: The FastAPI and FastMCP servers are stateless and scale horizontally behind an Application Load Balancer (ALB).
- **Database Scaling**: Read replicas for read-heavy MCP queries (`get_customer`, `query_customer_records`). Primary PostgreSQL instance handles write operations and row locks.
- **Connection Pooling**: `asyncpg` connection pools maintain pre-warmed database connections with sub-millisecond acquire latency.

### 37. What are the limitations?
1. **Evaluation Scope**: 84 test cases represent high-priority OWASP LLM vulnerabilities, but novel red-team jailbreaks emerge continuously.
2. **Database Engine Specificity**: Concurrency locking relies on PostgreSQL `SELECT ... FOR UPDATE`; adapting to NoSQL requires distributed locks (Redis).
3. **Upstream Latency**: End-to-end response time is bounded by Gemini API inference latency.

### 38. What would you improve next?
- **Open Policy Agent (OPA) Integration**: Decouple policy rules into Rego policies for dynamic organizational governance.
- **WebAuthn / FIDO2 Step-Up**: Require hardware security key authentication (TouchID, YubiKey) for approving CRITICAL tickets.
- **Multi-Model Support**: Expand agent reasoning to Claude 3.5 Sonnet and GPT-4o with provider-agnostic LangGraph interfaces.

---

## Part 5: Hard Technical Questions

### Q: "Why not let the LLM evaluate the risk of an operation?"
> **Answer**: *"Because the LLM is part of the untrusted computation path. If an agent is targeted by a prompt injection attack, the model's internal reasoning is compromised. Asking the compromised model 'Is this operation dangerous?' will simply result in the model hallucinating an excuse like 'This deletion is safe because it is part of a routine maintenance script.' Risk evaluation must be deterministic, external to the model context, and executed by server-authoritative code."*

### Q: "Why have both policy enforcement AND MCP server validation?"
> **Answer**: *"Defense in depth. The Policy Engine operates at the semantic intent level (evaluating user identity, business risk, and operation scope). The MCP server operates at the protocol and tool contract level (validating Pydantic schemas, stripping illegal fields, and restricting database queries). If a vulnerability exists in policy configuration, MCP schema validation prevents malformed execution. Conversely, if a valid tool call is made maliciously, policy gating stops it."*

### Q: "What happens during a network partition between the API and PostgreSQL while executing an approved ticket?"
> **Answer**: *"The ticket execution and data mutation occur inside a single atomic database transaction (`async with conn.transaction():`). If a network failure or database crash occurs during execution, PostgreSQL rolls back the entire transaction. The ticket remains in the `APPROVED` state (unconsumed), and the target customer record is NOT deleted. When connectivity restores, the ticket can be safely executed without data inconsistency."*

### Q: "How does the system prevent timing attacks on parameter hash comparisons?"
> **Answer**: *"In `ApprovalEngine._verify_parameter_hash`, the comparison between the computed request hash and the stored ticket hash uses Python’s `hmac.compare_digest(hash_a, hash_b)`. This executes in constant time, preventing side-channel timing analysis from leaking hash bytes to an attacker."*
