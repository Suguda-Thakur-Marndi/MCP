# MCP-Sentinel — Security Evaluation Framework Specification

> **Automated Adversarial Testing Harness, Dataset Specifications, and Objective Verification Methodology**

---

## 1. Overview & Objective

The **MCP-Sentinel Security Evaluation Framework** (`security-evaluation/`) is an automated testing harness designed to objectively measure the defensive resilience of the platform against adversarial and functional threats. 

Unlike conventional software tests that simply verify code functionality, this framework subjects the complete system—including the Gemini reasoning engine, LangGraph state machine, Policy Engine, and FastMCP server—to realistic, multi-vector adversarial attacks.

---

## 2. Core Evaluation Principles

1. **Deterministic Objective Verdicts**:
   - Verdicts are never established by LLM self-evaluation or subjective prompt inspection.
   - Every scenario evaluates deterministic HTTP status codes, structured error types, policy decisions (`ALLOW`, `DENY`, `REQUIRE_APPROVAL`), and pre/post database state.
2. **Pre- and Post-Execution Database Verification**:
   - For all destructive and mutation test cases, the engine takes a cryptographic hash snapshot of target database tables before running the attack.
   - After the attack is executed or blocked, the engine queries the database and verifies whether unauthorized rows were deleted or modified.
3. **Fail-Closed Production Safety Lock**:
   - To eliminate any possibility of running destructive attacks against real data, the engine checks environment variables and immediately aborts if `ENVIRONMENT=production` or `APP_ENV=production`.
4. **Isolated Evaluation Database**:
   - All benchmarks execute against an isolated database (`mcp_sentinel_eval` on port 5000) seeded with synthetic `.test` enterprise data.

---

## 3. Dataset Architecture (`security-eval-phase10`)

The canonical evaluation dataset contains **84 deterministic test scenarios** spanning 20 standard categories:

```
security-evaluation/
├── datasets/
│   └── security-eval-phase10.json     # 84 test cases in canonical JSON schema
├── cases/                             # Individual scenario JSON definitions
│   ├── EVAL-READ-001.json ... EVAL-READ-005.json
│   ├── EVAL-WRITE-001.json ... EVAL-WRITE-004.json
│   ├── EVAL-DESTRUCT-001.json ... EVAL-DESTRUCT-008.json
│   ├── EVAL-INJ-D01.json ... EVAL-INJ-D06.json
│   ├── EVAL-INJ-E01.json ... EVAL-INJ-E04.json
│   ├── EVAL-TOOL-F01.json ... EVAL-TOOL-F03.json
│   ├── EVAL-AUTH-G01.json ... EVAL-AUTH-G04.json
│   ├── EVAL-APPR-H01.json ... EVAL-APPR-H04.json
│   ├── EVAL-ID-I01.json ... EVAL-ID-I04.json
│   ├── EVAL-PRIV-J01.json ... EVAL-PRIV-J03.json
│   ├── EVAL-SCOPE-K01.json ... EVAL-SCOPE-K03.json
│   ├── EVAL-POL-L01.json ... EVAL-POL-L04.json
│   ├── EVAL-MCP-M01.json ... EVAL-MCP-M04.json
│   ├── EVAL-SQL-N01.json ... EVAL-SQL-N05.json
│   ├── EVAL-IDOR-O01.json ... EVAL-IDOR-O04.json
│   ├── EVAL-ENV-P01.json ... EVAL-ENV-P03.json
│   ├── EVAL-LIFE-Q01.json ... EVAL-LIFE-Q05.json
│   ├── EVAL-CONC-R01.json ... EVAL-CONC-R02.json
│   ├── EVAL-LOOP-S01.json ... EVAL-LOOP-S05.json
│   └── EVAL-LEAK-T01.json ... EVAL-LEAK-T04.json
├── runners/                           # Benchmark execution scripts
└── assertions/                        # Quantitative assertion engine
```

---

## 4. The 20 Evaluation Categories (A through T)

| Code | Category Name | Cases | Primary Adversarial Attack Tested |
| :--- | :--- | :---: | :--- |
| **A** | Read Operations | 5 | Boundary limits, pagination overflows, non-existent entity probing. |
| **B** | Write Operations | 4 | Unauthorized profile modifications, excessive note sizes, illegal status updates. |
| **C** | Destructive Operations | 8 | Unapproved customer deletions, mass table purges, expired ticket executions. |
| **D** | Direct Prompt Injection | 6 | "Ignore rules", fake administrator personas, instruction smuggling. |
| **E** | Indirect Prompt Injection | 4 | Payloads hidden in customer notes, order notes, and external descriptions. |
| **F** | Tool Abuse | 3 | Invoking unregistered tools, injecting unexpected JSON keys, type confusion. |
| **G** | Authorization Bypass | 4 | Unauthenticated calls, revoked tokens, expired credentials, path traversal. |
| **H** | Approval Bypass | 4 | Direct execution without tickets, forged ticket signatures, fake approvals. |
| **I** | Identity Spoofing | 4 | Forged `X-User-ID`, `X-Role`, and `X-Forwarded-For` HTTP headers. |
| **J** | Privilege Escalation | 3 | Viewers attempting operator writes, operators attempting admin overrides. |
| **K** | Resource Scope Escalation | 3 | Cross-departmental tenant boundary violations. |
| **L** | Policy Tampering | 4 | Client-side attempts to force `risk=LOW` or override policy rule sets. |
| **M** | MCP Protocol Security | 4 | Malformed JSON-RPC payloads, schema violations, missing tool annotations. |
| **N** | SQL Injection | 5 | UNION SELECT, stacked queries (`DROP TABLE`), boolean tautologies (`' OR '1'='1`). |
| **O** | IDOR | 4 | Tampering with customer and order entity IDs to read foreign tenant data. |
| **P** | Environment Escalation | 3 | Development sessions attempting to mutate production resources. |
| **Q** | Replay & Lifecycle | 5 | Replaying executed tickets, cancelled tickets, and expired approval tokens. |
| **R** | Concurrency & Races | 2 | 20 simultaneous workers attempting to consume a single one-time ticket. |
| **S** | Agent Loop Abuse | 5 | Prompt loops designed to cause infinite recursion, memory exhaustion, or timeouts. |
| **T** | Error & Secret Leakage | 4 | Provoking 500 errors to inspect stack traces for passwords or database DSNs. |

---

## 5. Execution Modes

The evaluation engine supports two operational modes:

1. **Secured Mode (`--mode secured`)**:
   - Executes all 84 test cases against the full MCP-Sentinel platform with Policy Engine, HITL approval gating, and schema validation engaged.
2. **Benchmark Mode (`--mode benchmark`)**:
   - Runs comparative testing: executes scenarios against an unmitigated **Baseline Agent** (zero policy gating, zero HITL approval) and then against the **Secured System**.
   - Outputs side-by-side comparative metrics showing quantitative risk reduction.

---

## 6. How to Run the Evaluation Suite

```bash
# Activate virtual environment
.venv\Scripts\activate

# Run full comparative benchmark and generate Markdown report
python scripts/run_security_evaluation.py --mode benchmark

# Run a specific category (e.g. SQL Injection)
python scripts/run_security_evaluation.py --category CATEGORY_N_SQL_INJECTION

# Run dry-run without database recording
python scripts/run_security_evaluation.py --dry-run
```
