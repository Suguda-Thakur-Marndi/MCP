# MCP-Sentinel — Project Elevator Pitches & Architecture Summary

> **Verbal Pitch Templates for Technical Interviews, Architecture Reviews, and Executive Briefings**

---

## 1. 30-Second Elevator Pitch

> *"AI agents using tools to interact with real databases represent a massive operational risk—a single prompt injection or hallucinated reasoning loop can wipe out production data.  
> **MCP-Sentinel** is an open-source security platform that places an authoritative defense layer between autonomous agents and enterprise persistence. By integrating Google Gemini and LangGraph with FastMCP, a deterministic Policy & Risk Engine, and single-use human approval gating, MCP-Sentinel ensures high-risk actions cannot execute without cryptographically verified authorization. Backed by an automated benchmark of 84 adversarial scenarios, it achieves a verified 0.0% attack success rate."*

---

## 2. 60-Second Technical Pitch

> *"Modern AI agents use Model Context Protocol (MCP) to query databases and call APIs. But client-side instructions like 'please ask before deleting' provide zero real security against prompt injections or agent errors.  
> **MCP-Sentinel** treats the AI agent as completely untrusted. Built on Python 3.12, FastAPI, LangGraph, and PostgreSQL 16, it intercepts every MCP tool call on the server side.  
> 
> Safe read queries execute autonomously with sanitized projections. But when an agent attempts a destructive action like deleting a customer, the Policy Engine calculates a risk score, blocks execution, and creates an approval ticket bound by a SHA-256 parameter hash. An authorized operator reviews and approves the ticket in an interactive Next.js 16 SOC console, and the action executes atomically with single-use replay protection.  
> 
> In our automated benchmark of 84 adversarial attack vectors, an unmitigated baseline agent suffered an 85.7% attack success rate, while MCP-Sentinel achieved 100% security gating and a 0.0% attack success rate."*

---

## 3. 2-Minute Deep-Dive Technical Pitch

> *"When organizations deploy autonomous agents, they face the 'Agent Security Paradox': the more autonomy you give an agent, the greater the catastrophic blast radius when it makes a mistake or encounters malicious prompt injection.  
> 
> Existing approaches rely on prompt engineering or MCP tool annotations like `destructiveHint=true`. But these are advisory hints that live in the untrusted client context. An attacker exploiting an indirect prompt injection in a customer note can trivially trick the LLM into ignoring instructions.  
> 
> **MCP-Sentinel** introduces an authoritative, layered defense-in-depth architecture:  
> 
> 1. **Untrusted Agent Boundary**: Gemini 2.5 Flash operates within a cyclic LangGraph state machine with hard iteration limits and XML input demarcation.  
> 2. **Authoritative Policy & Risk Engine**: Every candidate tool invocation is intercepted server-side and scored on a deterministic 0-to-100 scale based on action type, resource criticality, and volume.  
> 3. **Cryptographic Human Gating**: Operations scored above 50 or 75 generate single-use approval tickets locked with a SHA-256 parameter hash. If an attacker attempts to alter the target ID or payload between approval and execution, the hash mismatches and execution aborts.  
> 4. **Atomic Concurrency Defense**: Tickets transition from PENDING to APPROVED to CONSUMED inside an atomic database transaction using PostgreSQL row-level locks (`SELECT ... FOR UPDATE`), completely preventing race conditions and replay attacks.  
> 5. **Safe MCP Projections**: Tools expose only parameterized queries ($1, $2); zero raw SQL execution endpoints exist.  
> 6. **Quantitative Evaluation**: We validated the platform against 84 deterministic adversarial scenarios across 20 categories. The system recorded a 100% pass rate, 100% gating recall, and 0.0% attack success rate.  
> 
> In short, MCP-Sentinel makes autonomous agentic AI deployable in enterprise environments where data integrity and compliance cannot be left to probabilistic model behavior."*

---

## 4. 60-Second Architecture Walkthrough (Section 7)

> *"Here is how a request travels through MCP-Sentinel:  
> 
> 1. **User interaction** begins at our Next.js 16 Security Console, which talks to the FastAPI Gateway over HTTP-only session cookies and CSRF protection.  
> 2. **Authentication** validates the user's Google OIDC identity and maps their RBAC role (`admin`, `security_lead`, `operator`, `viewer`).  
> 3. The **AI Agent** (Gemini 2.5 on LangGraph) interprets the request inside an isolated prompt boundary and emits a structured tool invocation.  
> 4. That tool call hits our **Policy & Risk Engine**, which deterministically scores the operation from 0 to 100.  
> 5. Low-risk reads are **ALLOWED** directly to the FastMCP server, which runs parameterized SQL against PostgreSQL and returns minimized projections.  
> 6. High-risk destructive actions are flagged as **REQUIRE_APPROVAL**. A ticket is created in PostgreSQL with a SHA-256 parameter hash.  
> 7. The operator reviews the ticket in the **Dashboard** and approves it. Execution consumes the ticket atomically.  
> 8. Finally, supporting systems—**Prometheus Observability** and our **Automated Security Evaluation Engine**—ensure full audit traceability and continuous 84-scenario benchmark validation."*
