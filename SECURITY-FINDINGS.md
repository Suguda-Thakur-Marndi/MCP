# MCP-Sentinel — Security Findings Log

**Document ID:** `SEC-FINDINGS-v1.0.0-rc.1`  
**Date:** September 28, 2026  
**Auditor:** Application Security & QA Engineering Team  
**Evaluation Target:** `v1.0.0-rc.1` (`release-candidate` branch)  
**Open Critical / High Vulnerabilities:** **0**  
**Remediated Findings:** **5**  
**Documented Known Limitations:** **3**  

---

## 1. Summary of Security Findings

| Finding ID | Title | Severity | Classification | Status |
| :--- | :--- | :---: | :---: | :---: |
| **SEC-001** | Accidental Truncation of Multi-Container Stack Manifest (`docker-compose.yml`) | **CRITICAL** | Deployment / Availability | **RESOLVED** |
| **SEC-002** | Accidental Deletion of Architecture Specification (`ARCHITECTURE.md`) | **HIGH** | Governance / Traceability | **RESOLVED** |
| **SEC-003** | Python Import Ordering and Linter Non-Compliance in Reset Script | **MEDIUM** | Code Quality / CI Integrity | **RESOLVED** |
| **SEC-004** | Subscript NoneType Defect in Release Validation Tooling | **HIGH** | Release Gate Integrity | **RESOLVED** |
| **SEC-005** | Custom Font Loading via HTML Link Tag in Next.js Root Layout | **LOW** | Performance / Lint Warning | **RESOLVED** |
| **SEC-006** | Fail-Closed Production Startup Configuration Requirement | **INFO** | Operational Security Control | **VERIFIED SAFE** |
| **SEC-007** | Evaluation Engine Production Safety Lock | **INFO** | Operational Security Control | **VERIFIED SAFE** |
| **SEC-008** | Google OAuth 2.0 External Credential Requirement | **INFO** | External Dependency Limitation| **DOCUMENTED** |

---

## 2. Remediated Security & Operational Defects

### [SEC-001] Accidental Truncation of `docker-compose.yml` to Zero Bytes
- **Severity**: **CRITICAL**
- **Affected Component**: Deployment Infrastructure (`docker-compose.yml`)
- **Reproduction Steps**:
  1. Inspect `docker-compose.yml` in working tree at commit `d68c6e0`.
  2. Run `docker compose config` or `docker compose up`.
- **Evidence**: `docker-compose.yml` had length 0 bytes; Docker CLI reported an empty specification error.
- **Impact**: Multi-container stack (PostgreSQL, FastAPI, Next.js) could not be launched in containerized environments.
- **Fix / Mitigation**: Restored the production-hardened multi-container definition from baseline commit `93b9ac3`. Includes PostgreSQL 16 container, network isolation (`sentinel-net`), non-root execution, explicit container resource limits (1.0 CPU, 1024MB RAM for DB; 1.5 CPU, 1536MB RAM for API), and decoupled healthchecks.
- **Retest Result**: `docker compose config` exits with code 0 and valid YAML AST.
- **Remaining Risk**: None.

---

### [SEC-002] Accidental Deletion of Architecture Specification (`ARCHITECTURE.md`)
- **Severity**: **HIGH**
- **Affected Component**: Documentation & Governance (`ARCHITECTURE.md`)
- **Reproduction Steps**:
  1. Inspect Git diff of commit `d68c6e0`.
  2. Notice 181 lines deleted; file absent from working tree.
- **Evidence**: File was missing from repository root; cross-references in `README.md` and audit documentation were broken.
- **Impact**: Compromised architectural traceability, threat model alignment, and verification of security boundaries.
- **Fix / Mitigation**: Restored `ARCHITECTURE.md` from baseline commit `93b9ac3`.
- **Retest Result**: File present, valid Markdown syntax, verified correspondence to codebase implementation.
- **Remaining Risk**: None.

---

### [SEC-003] Python Linter Non-Compliance in Reset Script (`scripts/reset_demo_environment.py`)
- **Severity**: **MEDIUM**
- **Affected Component**: Maintenance Scripting (`scripts/reset_demo_environment.py`)
- **Reproduction Steps**:
  1. Run `ruff check mcp_sentinel/ mcp_server/ scripts/ tests/`.
- **Evidence**: `ruff` reported 3 errors: `I001` (unsorted imports) and `E402` (module-level imports following `sys.path.insert`).
- **Impact**: CI/CD pipeline failure on quality gate `lint-python`.
- **Fix / Mitigation**: Formatted import blocks and added `# noqa: E402` annotations to imports dependent on repository root path insertion.
- **Retest Result**: `ruff check` passes with 0 errors across all 162 files in the repository.
- **Remaining Risk**: None.

---

### [SEC-004] Subscript NoneType Exception in Release Demo Tooling (`scripts/run_release_demos.py`)
- **Severity**: **HIGH**
- **Affected Component**: Release Validation Tooling (`scripts/run_release_demos.py`)
- **Reproduction Steps**:
  1. Run unit test suite (which seeds 8 customers with IDs 1–8).
  2. Immediately execute `python scripts/run_release_demos.py`.
- **Evidence**:
  ```
  TypeError: 'NoneType' object is not subscriptable
  File "scripts/run_release_demos.py", line 202: target_cust_id = c_row["customer_code"]
  ```
- **Impact**: Release validation script crashed during Demo 10 (destructive gating), blocking automated release certification.
- **Fix / Mitigation**: Updated query to fallback gracefully to `SELECT customer_code FROM customers ORDER BY id DESC LIMIT 1` if no customer with `id > 10` is present.
- **Retest Result**: All 6 release demos executed to completion with code 0 (`ALL 6 LIVE DEMONSTRATIONS SUCCESSFULLY COMPLETED AND VALIDATED`).
- **Remaining Risk**: None.

---

### [SEC-005] Custom Font Loading Warning [FINDING-003] (`web/app/layout.tsx`)
- **Severity**: **LOW**
- **Affected Component**: Frontend Layout (`web/app/layout.tsx`)
- **Reproduction Steps**:
  1. Run `npm run lint` in `web/`.
- **Evidence**: ESLint emitted warning `@next/next/no-page-custom-font` regarding `<link rel="stylesheet">` tags in `<head>`.
- **Impact**: Triggered ESLint warnings and bypassed Next.js build-time font optimization.
- **Fix / Mitigation**: Migrated font loading to `next/font/google` (`Inter` and `JetBrains_Mono`), binding variables `--font-sans` and `--font-mono` directly to `<html>` and `<body>`.
- **Retest Result**: `npm run lint` returned 0 warnings and 0 errors; `next build` compiled 11 static routes cleanly.
- **Remaining Risk**: None.

---

## 3. Operational Security Controls Verified Intact

### [SEC-006] Production Startup Configuration Validation
- **Severity**: **INFO**
- **Component**: Configuration Settings (`mcp_sentinel/config/settings.py`)
- **Verified Behavior**:
  When `APP_ENV=production`, `Settings.validate_production_startup()` enforces:
  1. `ENABLE_TEST_AUTH` must be `False`.
  2. `JWT_SECRET_KEY` must not be default or shorter than 32 characters.
  3. `SESSION_COOKIE_SECURE` must be `True`.
  4. `ALLOWED_CORS_ORIGINS` must not contain wildcards (`*`).
  5. `DATABASE_URL` must not point to localhost or default ports without SSL.
- **Status**: **VERIFIED SAFE & ENFORCED**

---

### [SEC-007] Security Evaluation Production Safety Lock
- **Severity**: **INFO**
- **Component**: Evaluation Engine (`mcp_sentinel/security/evaluation/engine.py`)
- **Verified Behavior**:
  `_verify_production_safety_lock` inspects `APP_ENV` and `DATABASE_URL`. If the runtime environment indicates production, the benchmark runner aborts immediately before executing any mutations or destructive scenarios.
- **Status**: **VERIFIED SAFE & ENFORCED**

---

## 4. Documented Operational Limitations

1. **Google OAuth 2.0 Credentials (External Dependency)**:
   - Live OAuth login requires setting `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a verified Google Cloud Console project. In isolated local/CI environments, the application provides authenticated test roles (`ENABLE_TEST_AUTH=true`) that simulate authentic JWT credentials.
2. **Gemini Live AI Reasoning API Key**:
   - Live agent tool reasoning requires setting `GEMINI_API_KEY`. When unconfigured, the system automatically engages `MockLLMProvider`, ensuring full cyclic LangGraph execution without compromising security boundaries.
3. **Managed PostgreSQL SSL Enforcement**:
   - Local verification was performed against a secure local PostgreSQL instance (`127.0.0.1:5000`). Production deployment requires hosting on a managed database (e.g. AWS RDS or Cloud SQL) with `sslmode=require`.
