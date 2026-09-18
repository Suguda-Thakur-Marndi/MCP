"""
Server-side SQL Query Builder and Filter Enforcement for MCP-Sentinel.
Adheres to:
- Security Rule #4: Never execute arbitrary SQL supplied by an LLM.
- Complete SQL Injection Prevention via trusted server-side templates and strict parameter binding.
"""

from typing import Any

from mcp_sentinel.security.audit_logger import (
    INPUT_VALIDATION_FAILED,
    SQL_INJECTION_ATTEMPT,
    log_security_event,
)
from mcp_sentinel.security.exceptions import SecurityValidationError, SecurityViolationError

# Explicitly allowed filterable fields (Whitelisted server-side only)
ALLOWED_FILTER_FIELDS: set[str] = {
    "status",
    "country",
    "customer_id",
    "tier",
}

# Explicitly allowed sorting columns mapped to database column identifiers
ALLOWED_SORT_FIELDS: dict[str, str] = {
    "created_at": "created_at",
    "name": "name",
    "id": "id",
    "tier": "tier",
    "status": "status",
}

# Explicitly allowed sort directions
ALLOWED_SORT_DIRECTIONS: set[str] = {"ASC", "DESC"}

# Allowed projection columns for customer queries (Zero SELECT * allowed)
APPROVED_PROJECTION_COLUMNS: list[str] = [
    "id",
    "name",
    "email",
    "tier",
    "status",
    "country",
    "created_at",
]


class SecureQueryBuilder:
    """
    Constructs parameterized SQL queries using strict server-side allow-lists.
    Guarantees no user or LLM input is ever concatenated or formatted into the SQL statement.
    """

    @staticmethod
    def build_customer_query(
        filters: dict[str, Any] | None = None,
        limit: int = 50,
        offset: int = 0,
        sort_by: str | None = None,
        sort_order: str | None = None,
        max_limit: int = 100,
    ) -> tuple[str, list[Any]]:
        """
        Builds a safe parameterized SELECT query.

        Returns:
            Tuple[str, List[Any]]: (parameterized_sql, bound_parameters)
        """
        # Validate LIMIT and OFFSET bounds
        if not isinstance(limit, int) or limit < 1:
            log_security_event(
                event_type=INPUT_VALIDATION_FAILED,
                action="validate_limit",
                decision="REJECT",
                tool_name="query_customer_records",
                success=False,
                error_code="INVALID_LIMIT",
            )
            raise SecurityValidationError(f"Query limit must be a positive integer, got: {limit}")

        if limit > max_limit:
            log_security_event(
                event_type=INPUT_VALIDATION_FAILED,
                action="validate_limit_bound",
                decision="REJECT",
                tool_name="query_customer_records",
                success=False,
                error_code="LIMIT_EXCEEDED",
            )
            raise SecurityValidationError(
                f"Query limit cannot exceed maximum allowed of {max_limit}, got: {limit}"
            )

        if not isinstance(offset, int) or offset < 0:
            raise SecurityValidationError(
                f"Query offset must be a non-negative integer, got: {offset}"
            )

        # Check for banned legacy raw SQL parameters
        if filters and ("query_filter" in filters or "raw_sql" in filters or "where" in filters):
            log_security_event(
                event_type=SQL_INJECTION_ATTEMPT,
                action="detect_raw_sql_field",
                decision="BLOCK",
                tool_name="query_customer_records",
                risk_classification="CRITICAL",
                success=False,
                error_code="RAW_SQL_PROHIBITED",
                details={"rejected_keys": list(filters.keys())},
            )
            raise SecurityViolationError(
                "Raw SQL strings or arbitrary filter parameters are strictly prohibited."
            )

        where_clauses: list[str] = []
        params: list[Any] = []
        param_idx = 1

        if filters:
            for field, value in filters.items():
                if field not in ALLOWED_FILTER_FIELDS:
                    log_security_event(
                        event_type=INPUT_VALIDATION_FAILED,
                        action="validate_filter_field",
                        decision="REJECT",
                        tool_name="query_customer_records",
                        success=False,
                        error_code="UNSUPPORTED_FILTER_FIELD",
                        details={"field": field},
                    )
                    raise SecurityValidationError(
                        f"Unsupported filter field '{field}'. Allowed fields: {sorted(ALLOWED_FILTER_FIELDS)}"
                    )

                if value is None:
                    continue

                if field == "customer_id":
                    if not isinstance(value, int) or value <= 0:
                        raise SecurityValidationError(
                            "customer_id filter must be a positive integer."
                        )
                    where_clauses.append(f"id = ${param_idx}")
                    params.append(value)
                    param_idx += 1
                elif field == "status":
                    if not isinstance(value, str) or not value.strip():
                        raise SecurityValidationError("status filter must be a non-empty string.")
                    where_clauses.append(f"status = ${param_idx}")
                    params.append(value.strip().lower())
                    param_idx += 1
                elif field == "country":
                    if not isinstance(value, str) or len(value.strip()) != 2:
                        raise SecurityValidationError(
                            "country filter must be a 2-letter ISO country code."
                        )
                    where_clauses.append(f"country = ${param_idx}")
                    params.append(value.strip().upper())
                    param_idx += 1
                elif field == "tier":
                    if not isinstance(value, str) or not value.strip():
                        raise SecurityValidationError("tier filter must be a non-empty string.")
                    where_clauses.append(f"tier = ${param_idx}")
                    params.append(value.strip().lower())
                    param_idx += 1

        # Build column list from explicit allow-list
        columns_str = ", ".join(APPROVED_PROJECTION_COLUMNS)
        sql = f"SELECT {columns_str} FROM customers"

        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)

        # Validate and apply ORDER BY from strict mapping
        sort_column = "created_at"
        if sort_by:
            clean_sort = sort_by.strip().lower()
            if clean_sort not in ALLOWED_SORT_FIELDS:
                raise SecurityValidationError(
                    f"Invalid sort field '{sort_by}'. Allowed: {sorted(ALLOWED_SORT_FIELDS.keys())}"
                )
            sort_column = ALLOWED_SORT_FIELDS[clean_sort]

        direction = "DESC"
        if sort_order:
            clean_dir = sort_order.strip().upper()
            if clean_dir not in ALLOWED_SORT_DIRECTIONS:
                raise SecurityValidationError(
                    f"Invalid sort direction '{sort_order}'. Allowed: {sorted(ALLOWED_SORT_DIRECTIONS)}"
                )
            direction = clean_dir

        sql += f" ORDER BY {sort_column} {direction}"

        # Parameterize LIMIT and OFFSET
        sql += f" LIMIT ${param_idx}"
        params.append(limit)
        param_idx += 1

        sql += f" OFFSET ${param_idx}"
        params.append(offset)

        return sql, params
