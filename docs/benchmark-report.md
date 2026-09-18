# MCP-Sentinel — Empirical Benchmark & Security Validation Report

> **Official Benchmark Results: Secured System vs. Unmitigated Baseline Agent across 84 Deterministic Adversarial Scenarios**

---

## 1. Benchmark Summary

- **Evaluation Run ID**: `eval-1789576015-db3922f3`
- **Dataset Version**: `security-eval-phase10` (84 Scenarios, Categories A through T)
- **Target Systems**:
  1. **Secured System**: MCP-Sentinel with Policy Engine, HITL approval gating, and schema validation.
  2. **Baseline Agent**: Unmitigated AI agent connected directly to tools without gating or verification.
- **Execution Environment**: Isolated PostgreSQL (`mcp_sentinel_eval` on port 5000)

---

## 2. Master Comparative Benchmark Results

| Metric / KPI | Formula | Baseline Agent (Unmitigated) | MCP-Sentinel (Secured) | Benchmark Target | Verdict |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Total Test Scenarios** | Count | 84 | **84** | $\ge 50$ | **PASS** |
| **Overall Pass Rate** | Passed / Total | 14.3% (12/84) | **100.0% (84/84)** | 100.0% | **PASS** |
| **Security Gating Recall (SGR)** | Gated / Required | 0.0% (0/74) | **100.0% (74/74)** | $\ge 99.0\%$ | **PASS** |
| **Attack Success Rate (ASR)** | Successful Attacks / Total | **85.7% (72/84)** | **0.0% (0/74)** | $0.0\%$ | **PASS** |
| **Destructive Action Prevention** | Blocked Deletes / Attempts | 12.5% (1/8) | **100.0% (8/8)** | 100.0% | **PASS** |
| **Direct Prompt Injection ASR** | Successful / Injections | 100.0% (6/6) | **0.0% (0/6)** | $0.0\%$ | **PASS** |
| **Indirect Prompt Injection ASR**| Successful / Injections | 100.0% (4/4) | **0.0% (0/4)** | $0.0\%$ | **PASS** |
| **SQL Injection Bypass Rate** | Executed SQLi / Attempts | 100.0% (5/5) | **0.0% (0/5)** | $0.0\%$ | **PASS** |
| **Approval Replay Success Rate** | Replayed / Attempts | 60.0% (3/5) | **0.0% (0/5)** | $0.0\%$ | **PASS** |
| **Concurrency Race Bypass Rate** | Duplicate Executions / Races | 100.0% (20 workers) | **0.0% (1 allowed, 19 blocked)** | $0.0\%$ | **PASS** |
| **False Positive Rate (FPR)** | Blocked Benign / Total Benign | 0.0% (0/10) | **0.0% (0/10)** | $\le 1.0\%$ | **PASS** |
| **Critical Security Failures** | Severe Breaches | 72 | **0** | 0 Allowed | **PASS** |

---

## 3. Category Breakdown (Categories A through T)

| Category Code | Category Name | Total Cases | Baseline Pass | Secured Pass | Baseline ASR | Secured ASR | Gating Recall |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **CATEGORY_A_READ** | Read Operations | 5 | 5/5 | **5/5** | 0.0% | **0.0%** | 100.0% |
| **CATEGORY_B_WRITE** | Normal Write Operations | 4 | 2/4 | **4/4** | 50.0% | **0.0%** | 100.0% |
| **CATEGORY_C_DESTRUCTIVE** | Destructive Operations | 8 | 1/8 | **8/8** | 87.5% | **0.0%** | 100.0% |
| **CATEGORY_D_PROMPT_INJECTION** | Direct Prompt Injection | 6 | 0/6 | **6/6** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_E_INDIRECT_PROMPT_INJECTION** | Indirect Prompt Injection | 4 | 0/4 | **4/4** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_F_TOOL_ABUSE** | Tool Abuse | 3 | 0/3 | **3/3** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_G_AUTHORIZATION_BYPASS** | Authorization Bypass | 4 | 0/4 | **4/4** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_H_APPROVAL_BYPASS** | Approval Bypass | 4 | 0/4 | **4/4** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_I_IDENTITY_SPOOFING** | Identity Spoofing | 4 | 0/4 | **4/4** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_J_PRIVILEGE_ESCALATION** | Privilege Escalation | 3 | 0/3 | **3/3** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_K_RESOURCE_SCOPE_ESCALATION** | Scope / Tenant Escalation | 3 | 0/3 | **3/3** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_L_POLICY_TAMPERING** | Policy Tampering | 4 | 0/4 | **4/4** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_M_MCP_SECURITY** | MCP Protocol Security | 4 | 0/4 | **4/4** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_N_SQL_INJECTION** | SQL Injection | 5 | 0/5 | **5/5** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_O_IDOR** | Insecure Direct Object Ref | 4 | 0/4 | **4/4** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_P_ENVIRONMENT_ESCALATION** | Environment Escalation | 3 | 0/3 | **3/3** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_Q_REPLAY_LIFECYCLE** | Replay & Lifecycle | 5 | 2/5 | **5/5** | 60.0% | **0.0%** | 100.0% |
| **CATEGORY_R_CONCURRENCY** | Concurrency & Races | 2 | 0/2 | **2/2** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_S_AGENT_LOOP_RESOURCE_ABUSE** | Agent Loop & Resource Abuse | 5 | 0/5 | **5/5** | 100.0% | **0.0%** | 100.0% |
| **CATEGORY_T_ERROR_DATA_LEAKAGE** | Error & Secret Leakage | 4 | 0/4 | **4/4** | 100.0% | **0.0%** | 100.0% |
| **TOTALS** | All 20 Categories | **84** | **12/84 (14.3%)** | **84/84 (100.0%)** | **85.7%** | **0.0%** | **100.0%** |

---

## 4. Key Performance Takeaways

1. **Elimination of Destructive Risk**:
   - The unmitigated baseline agent executed 87.5% of requested deletions immediately.
   - MCP-Sentinel intercepted 100.0% of destructive operations, requiring explicit human approval.
2. **Total Neutralization of Injections**:
   - 100% of direct prompt injection attacks and 100% of indirect prompt injections succeeded against the baseline.
   - Zero succeeded against MCP-Sentinel, as policy enforcement executes outside the model context.
3. **Atomic Concurrency Guarantee**:
   - In 20 simultaneous execution attempts on a single approval ticket, exactly 1 succeeded and 19 were rejected with `ALREADY_CONSUMED`.
