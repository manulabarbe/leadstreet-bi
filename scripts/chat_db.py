"""
chat_db.py — Load transformed DataFrames into DuckDB with pre-defined metric views.

Views encode all confirmed metric definitions so the LLM cannot
miscalculate utilisation, margin, ACPH, etc.
"""
from __future__ import annotations

import re

import duckdb
import pandas as pd

from transform import transform_endpoint


def init_db() -> duckdb.DuckDBPyConnection:
    """Load latest snapshots into DuckDB and create metric views."""
    con = duckdb.connect(":memory:")

    # Load base tables
    te = transform_endpoint("time_entries")
    deals = transform_endpoint("deals")

    if te is None or deals is None:
        raise RuntimeError("Missing data snapshots. Run fetch.py + transform.py first.")

    # DuckDB needs string months, not Period objects
    te["month"] = te["month"].astype(str)

    con.register("time_entries", te)
    con.register("deals", deals)

    _create_views(con)
    print(f"  Chat DB ready: {len(te):,} time entries, {len(deals):,} deals")
    return con


def _create_views(con: duckdb.DuckDBPyConnection):
    """Create SQL views encoding confirmed metric definitions."""

    # Monthly financial: hours, staff cost, utilisation
    con.execute("""
        CREATE VIEW v_monthly_financial AS
        SELECT
            month,
            ROUND(SUM(hours), 1) AS total_hours,
            ROUND(SUM(billable_hours), 1) AS billable_hours,
            ROUND(SUM(work_cost), 2) AS staff_cost,
            ROUND(SUM(billable_hours) / NULLIF(SUM(hours), 0) * 100, 1) AS util_pct
        FROM time_entries
        GROUP BY month
        ORDER BY month
    """)

    # Person utilisation by month
    con.execute("""
        CREATE VIEW v_person_utilisation AS
        SELECT
            person_name,
            team,
            month,
            ROUND(SUM(hours), 1) AS total_hours,
            ROUND(SUM(billable_hours), 1) AS billable_hours,
            ROUND(SUM(billable_hours) / NULLIF(SUM(hours), 0) * 100, 1) AS utilisation_pct,
            ROUND(SUM(work_cost), 2) AS staff_cost,
            ROUND(SUM(work_cost) / NULLIF(SUM(hours), 0), 2) AS avg_cost_per_hour
        FROM time_entries
        GROUP BY person_name, team, month
    """)

    # Service type metrics: ACPH, ARPH
    con.execute("""
        CREATE VIEW v_service_type_metrics AS
        SELECT
            service_type,
            ROUND(SUM(hours), 1) AS total_hours,
            ROUND(SUM(billable_hours), 1) AS billable_hours,
            ROUND(SUM(work_cost), 2) AS staff_cost,
            ROUND(SUM(entry_revenue), 2) AS revenue,
            ROUND(SUM(work_cost) / NULLIF(SUM(hours), 0), 2) AS acph,
            ROUND(SUM(entry_revenue) / NULLIF(SUM(billable_hours), 0), 2) AS arph,
            ROUND(
                SUM(entry_revenue) / NULLIF(SUM(billable_hours), 0)
                - SUM(work_cost) / NULLIF(SUM(hours), 0),
            2) AS margin_per_hour
        FROM time_entries
        GROUP BY service_type
    """)

    # Deal budget burn with overbudget flags
    con.execute("""
        CREATE VIEW v_deal_budget AS
        SELECT
            name AS deal_name,
            company_name AS client_name,
            worked_hours,
            budgeted_hours,
            cost,
            budget_total,
            revenue,
            ROUND(worked_hours / NULLIF(budgeted_hours, 0) * 100, 1) AS hours_burn_pct,
            ROUND(cost / NULLIF(budget_total, 0) * 100, 1) AS cost_burn_pct,
            CASE
                WHEN worked_hours / NULLIF(budgeted_hours, 0) > 1.0
                     OR cost / NULLIF(budget_total, 0) > 1.0 THEN 'RED'
                WHEN worked_hours / NULLIF(budgeted_hours, 0) > 0.7
                     OR cost / NULLIF(budget_total, 0) > 0.7 THEN 'AMBER'
                ELSE 'GREEN'
            END AS flag
        FROM deals
        WHERE budget = true AND deal_type_id = 2
          AND (budgeted_hours > 0 OR budget_total > 0)
    """)

    # Client profitability from time entries
    con.execute("""
        CREATE VIEW v_client_profitability AS
        SELECT
            client_name,
            ROUND(SUM(hours), 1) AS total_hours,
            ROUND(SUM(billable_hours), 1) AS billable_hours,
            ROUND(SUM(work_cost), 2) AS staff_cost,
            ROUND(SUM(entry_revenue), 2) AS revenue,
            ROUND(SUM(entry_revenue) - SUM(work_cost), 2) AS gross_margin,
            ROUND(
                (SUM(entry_revenue) - SUM(work_cost))
                / NULLIF(SUM(entry_revenue), 0) * 100,
            1) AS margin_pct,
            ROUND(SUM(work_cost) / NULLIF(SUM(hours), 0), 2) AS acph,
            ROUND(SUM(entry_revenue) / NULLIF(SUM(billable_hours), 0), 2) AS arph
        FROM time_entries
        WHERE client_name IS NOT NULL
        GROUP BY client_name
    """)

    # Hygiene: note compliance per person per month
    con.execute("""
        CREATE VIEW v_hygiene AS
        SELECT
            person_name,
            team,
            month,
            COUNT(*) AS total_entries,
            SUM(CASE WHEN has_note THEN 1 ELSE 0 END) AS with_note,
            SUM(CASE WHEN NOT has_note THEN 1 ELSE 0 END) AS missing_notes,
            SUM(CASE WHEN hours = 0 THEN 1 ELSE 0 END) AS zero_hours,
            ROUND(
                SUM(CASE WHEN has_note THEN 1 ELSE 0 END)::FLOAT
                / COUNT(*) * 100,
            1) AS note_pct
        FROM time_entries
        GROUP BY person_name, team, month
    """)


# Write-blocking keywords
_WRITE_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE|COPY)\b",
    re.IGNORECASE,
)


def execute_safe(
    con: duckdb.DuckDBPyConnection,
    sql: str,
    timeout_seconds: float = 5.0,
) -> tuple[list[dict], list[str]]:
    """Execute read-only SQL. Returns (rows_as_dicts, column_names).

    Raises ValueError on write attempts, RuntimeError on execution errors.
    """
    if _WRITE_PATTERN.search(sql):
        raise ValueError("Write operations are not allowed.")

    try:
        result = con.execute(sql)
        columns = [desc[0] for desc in result.description]
        rows = result.fetchall()
        row_dicts = [dict(zip(columns, row)) for row in rows]
        return row_dicts, columns
    except Exception as e:
        raise RuntimeError(f"SQL execution failed: {e}") from e


def get_schema_description(con: duckdb.DuckDBPyConnection) -> str:
    """Return human-readable schema for the LLM system prompt."""
    lines = []

    # Tables
    for table in ["time_entries", "deals"]:
        cols = con.execute(f"DESCRIBE {table}").fetchall()
        col_list = ", ".join(f"{c[0]} ({c[1]})" for c in cols)
        lines.append(f"TABLE {table}: {col_list}")

    # Views
    views = [
        "v_monthly_financial", "v_person_utilisation", "v_service_type_metrics",
        "v_deal_budget", "v_client_profitability", "v_hygiene",
    ]
    for view in views:
        cols = con.execute(f"DESCRIBE {view}").fetchall()
        col_list = ", ".join(f"{c[0]} ({c[1]})" for c in cols)
        lines.append(f"VIEW {view}: {col_list}")

    return "\n".join(lines)
