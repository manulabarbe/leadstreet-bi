"""
chat_llm.py — Claude API integration for natural language → SQL translation.

Uses pre-defined views to ensure metric correctness. Shows generated SQL
for transparency.
"""
from __future__ import annotations

import os

import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """You are a SQL analyst for LeadStreet, a HubSpot agency.
You query a DuckDB database containing their Productive.io time tracking and project data.

## IMPORTANT METRIC DEFINITIONS (confirmed by the business — use these exactly)
- **Billable Utilisation** = billable_hours / total_tracked_hours (NOT capacity-based)
- **Staff Cost** = work_cost (salary-based, excludes overhead; owners at EUR 15K/month flat)
- **Gross Margin** = Revenue - Staff Cost (excludes facility/overhead costs)
- **Revenue** = recognized revenue (T&M: hours x rate; fixed: proportional recognition)
- **Overbudget flags**: GREEN <70%, AMBER 70-100%, RED >100% (dual check: hours AND EUR)
- **ACPH** = staff_cost / total_hours by service type
- **ARPH** = entry_revenue / billable_hours by service type

## AVAILABLE SCHEMA
{schema}

## RULES
1. ALWAYS prefer the pre-defined views (v_*) over raw tables. Views encode correct metric definitions.
2. Only query raw tables (time_entries, deals) when views don't cover the question.
3. Return ONLY a SQL query. No markdown fences, no explanation.
4. Use DuckDB SQL syntax (strftime for dates, :: for casts, ILIKE for case-insensitive).
5. Money values are already in EUR. Hours are already in hours (not minutes).
6. The `month` column is a string like '2026-01'. Use it directly for monthly grouping.
7. NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or any write operation.
8. Limit results to 50 rows unless the user explicitly asks for more.
9. If you cannot answer with SQL, respond with exactly: CANNOT_SQL: <your explanation>
10. For "this year" use month LIKE '2026%'. For "last year" use month LIKE '2025%'.
11. Always ORDER BY the most relevant column (dates descending, amounts descending, etc.).
12. Round money to 2 decimals, percentages to 1 decimal.

## TEAMS
Management, Contractors PH, Contractors BE, Contractors EU - not BE, Payroll BE, Finance Admin Support

## SERVICE TYPES
PERF, DEV - HubSpot UI Logic, DEV - Website & HubSpot CMS, DEV - Apps & Custom,
CON - Data Migration & Sync, CON - Consultancy, ONB - leadstreet, ONB - HubSpot ONB,
LS - Apps & Marketplace, INTERN - Internal, Expenses
"""


def generate_sql(
    question: str,
    schema: str,
    conversation: list[dict] | None = None,
) -> tuple[str | None, str]:
    """Generate SQL from a natural language question.

    Returns (sql, explanation). If sql is None, explanation is a direct answer.
    """
    messages = []
    if conversation:
        for msg in conversation[-4:]:
            messages.append(msg)
    messages.append({"role": "user", "content": question})

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT.format(schema=schema),
        messages=messages,
    )

    text = response.content[0].text.strip()

    if text.startswith("CANNOT_SQL:"):
        return None, text[len("CANNOT_SQL:"):].strip()

    # Strip markdown fences if present
    sql = text.replace("```sql", "").replace("```", "").strip()
    return sql, ""


def format_response(
    question: str,
    sql: str,
    rows: list[dict],
    columns: list[str],
) -> str:
    """Summarize SQL results in natural language."""
    if not rows:
        return "The query returned no results."

    # For small results, let the LLM summarize concisely
    data_preview = str(rows[:20])

    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=(
            "You summarize SQL query results for a business user at a HubSpot agency. "
            "Be concise (1-3 sentences). Use EUR for money. Round percentages to 1 decimal. "
            "If the data is a table, format it as a clean markdown table. "
            "Never mention SQL or technical details — just answer the business question."
        ),
        messages=[{
            "role": "user",
            "content": (
                f"Question: {question}\n"
                f"Data ({len(rows)} rows, columns: {columns}):\n{data_preview}\n\n"
                f"Summarize the answer."
            ),
        }],
    )

    return response.content[0].text.strip()
