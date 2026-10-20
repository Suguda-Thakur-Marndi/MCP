# Database Lifecycle Scripts (`scripts/database/`)

This directory contains database initialization, migration, status, and seeding scripts for MCP Sentinel.

## Scripts Index

| Script | Purpose | Command |
|---|---|---|
| [`init_db.py`](file:///scripts/database/init_db.py) | Safely applies schema migrations (001–012) sequentially. Supports `--check-only` and `--no-seed`. | `python scripts/database/init_db.py` |
| [`seed_database.py`](file:///scripts/database/seed_database.py) | Seeds synthetic customer, order, and audit note records for staging/test environments. | `python scripts/database/seed_database.py` |
| [`db_status.py`](file:///scripts/database/db_status.py) | Checks connection health and prints table record counts. | `python scripts/database/db_status.py` |

> [!NOTE]
> For backward compatibility, execution via `python scripts/init_db.py`, `python scripts/seed_database.py`, and `python scripts/db_status.py` is also supported.
