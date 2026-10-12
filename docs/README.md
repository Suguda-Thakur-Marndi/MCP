# MCP-Sentinel Documentation Hub

> Central index for MCP-Sentinel cloud deployment blueprints, operational runbooks, design systems, and historical release verification archives.

---

## Documentation Structure

```text
docs/
├── README.md                  # This documentation index
├── AWS_DEPLOYMENT.md          # Production cloud guide (AWS ECS Fargate, RDS PostgreSQL, ALB)
├── DEMO_GUIDE.md              # Interactive walkthrough demonstration scripts
├── OPERATIONS_RUNBOOK.md      # SRE operational runbook, alert responses, and incident triage
├── archive/                   # Consolidated historical milestone and release validation reports
│   ├── PHASE_15_ARCHITECTURE_REFACTORING_REPORT.md
│   ├── PHASE_16_ARCHITECTURE_ALIGNMENT_REPORT.md
│   ├── PHASE_17_RELEASE_VALIDATION_REPORT.md
│   ├── PHASE_18_STAGING_VERIFICATION_REPORT.md
│   ├── PHASE_19_OBSERVABILITY_RECOVERY_REPORT.md
│   ├── PHASE_20_PRODUCTION_ROLLOUT_REPORT.md
│   └── PRODUCTION_READINESS_REPORT.md
└── design-reference/
    └── stitch/                # Google Stitch design tokens and specifications (DESIGN.md)
```

---

## Canonical Architecture & Governance Documents

| Document | Purpose |
| :--- | :--- |
| [README.md](../README.md) | Authoritative platform overview, quickstart instructions, and tool inventory |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Canonical security architecture, 9-stage pipeline, and approval state machine |
| [THREAT_MODEL.md](../THREAT_MODEL.md) | STRIDE analysis, trust boundaries, and OWASP Top 10 for LLMs mitigations |
| [SECURITY.md](../SECURITY.md) | Security vulnerability disclosure policy and controls checklist |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Local development and Docker Compose multi-service container guide |
| [CHANGELOG.md](../CHANGELOG.md) | Version release notes and development milestones |
| [SECURITY_EVALUATION_REPORT.md](../SECURITY_EVALUATION_REPORT.md) | 84-scenario benchmark results and attack surface audit |

---

## Archived Verification Reports

Historical phase verification reports and audit artifacts are preserved in [`docs/archive/`](archive/).
