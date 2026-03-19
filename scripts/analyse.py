"""
analyse.py — Compute metrics and generate reports from transformed data.

All calculations use raw granular data (individual time entries, bookings,
budget line items). No Productive built-in aggregates are used.

IMPORTANT: Each metric must be confirmed with the user before implementation.
See the METRIC DEFINITION comments in each function.

Usage:
    python scripts/analyse.py --report financial
    python scripts/analyse.py --report people
    python scripts/analyse.py --report project
    python scripts/analyse.py --report client
    python scripts/analyse.py --report hygiene
    python scripts/analyse.py --report all
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

# Add parent to path so we can import transform
sys.path.insert(0, str(Path(__file__).parent))
from transform import transform_endpoint, ALL_ENDPOINTS

OUTPUT_DIR = Path(__file__).parent.parent / "output"


def load_all_data() -> dict[str, pd.DataFrame]:
    """Load and transform all available endpoints."""
    data = {}
    for ep in ALL_ENDPOINTS:
        df = transform_endpoint(ep)
        if df is not None:
            data[ep] = df
    return data


# ---------------------------------------------------------------------------
# FINANCIAL REPORT
# ---------------------------------------------------------------------------

def financial_report(data: dict[str, pd.DataFrame]) -> pd.DataFrame | None:
    """
    Financial report: revenue, margin by month, YTD, YoY, forecast.

    # METRIC DEFINITION — confirmed with user:
    # Revenue = (not yet confirmed — ASK USER)
    # Margin = (not yet confirmed — ASK USER)
    # Forecast = actuals (past months) + bookings (future months)
    """
    te = data.get("time_entries")
    if te is None:
        print("  No time_entries data available for financial report")
        return None

    print("\n=== FINANCIAL REPORT ===")
    print("NOTE: Revenue and margin formulas need user confirmation.")
    print("Currently showing hours-based summary only.\n")

    # Monthly hours summary (this works regardless of metric definitions)
    monthly = te.groupby("month").agg(
        total_hours=("hours", "sum"),
        billable_hours=("hours", lambda x: x[te.loc[x.index, "billable"]].sum()),
    ).reset_index()

    monthly["non_billable_hours"] = monthly["total_hours"] - monthly["billable_hours"]

    # YTD
    current_year = pd.Timestamp.now().year
    ytd = te[te["year"] == current_year]
    ytd_total = ytd["hours"].sum()
    ytd_billable = ytd.loc[ytd["billable"], "hours"].sum()

    print(f"YTD {current_year}:")
    print(f"  Total hours: {ytd_total:,.1f}")
    print(f"  Billable hours: {ytd_billable:,.1f}")
    print(f"  Billable %: {ytd_billable / ytd_total * 100:.1f}%" if ytd_total > 0 else "  No data")

    # YoY comparison
    prev_year = current_year - 1
    current_month = pd.Timestamp.now().month
    yoy_current = te[(te["year"] == current_year) & (te["date"].dt.month <= current_month)]
    yoy_prev = te[(te["year"] == prev_year) & (te["date"].dt.month <= current_month)]

    if not yoy_prev.empty:
        print(f"\nYoY comparison (Jan-{pd.Timestamp.now().strftime('%b')}):")
        print(f"  {current_year}: {yoy_current['hours'].sum():,.1f} hours")
        print(f"  {prev_year}: {yoy_prev['hours'].sum():,.1f} hours")

    # Forecast placeholder
    bookings = data.get("bookings")
    if bookings is not None and not bookings.empty:
        future_bookings = bookings[bookings["started_on"] > pd.Timestamp.now()]
        future_hours = future_bookings["hours"].sum()
        print(f"\nForecast (remaining bookings): {future_hours:,.1f} hours")
        print(f"EOY projection: {ytd_total + future_hours:,.1f} total hours")

    print("\nMonthly breakdown:")
    print(monthly.to_string(index=False))

    return monthly


# ---------------------------------------------------------------------------
# PEOPLE REPORT
# ---------------------------------------------------------------------------

def people_report(data: dict[str, pd.DataFrame]) -> pd.DataFrame | None:
    """
    People report: utilisation, avg cost/hr, total hours per person.

    # METRIC DEFINITION — confirmed with user:
    # Billable utilisation = (not yet confirmed — ASK USER)
    #   Option A: billable_hours / total_worked_hours × 100
    #   Option B: billable_hours / available_capacity × 100
    # Average cost per hour = (not yet confirmed — ASK USER)
    """
    te = data.get("time_entries")
    if te is None:
        print("  No time_entries data available for people report")
        return None

    print("\n=== PEOPLE REPORT ===")
    print("NOTE: Utilisation denominator needs user confirmation.\n")

    people = te.groupby("person_name").agg(
        total_hours=("hours", "sum"),
        billable_hours=("hours", lambda x: x[te.loc[x.index, "billable"]].sum()),
        entries_count=("id", "count"),
    ).reset_index()

    people["non_billable_hours"] = people["total_hours"] - people["billable_hours"]
    people["utilisation_pct"] = (
        people["billable_hours"] / people["total_hours"] * 100
    ).round(1)

    people = people.sort_values("utilisation_pct", ascending=False)

    print(people.to_string(index=False))

    return people


# ---------------------------------------------------------------------------
# PROJECT REPORT
# ---------------------------------------------------------------------------

def project_report(data: dict[str, pd.DataFrame]) -> pd.DataFrame | None:
    """
    Project report: overbudget flags, ACPH per service type.

    # METRIC DEFINITION — confirmed with user:
    # Overbudget = (not yet confirmed — ASK USER)
    #   Compare hours spent vs budget hours? Or cost vs budget cost?
    #   Flag thresholds: green ≤80%, amber ≤100%, red >100%?
    # ACPH = (not yet confirmed — ASK USER)
    """
    te = data.get("time_entries")
    budgets = data.get("budgets")

    print("\n=== PROJECT REPORT ===")

    if te is None:
        print("  No time_entries data available")
        return None

    # Hours by project
    project_hours = te.groupby(["project_name", "project_id"]).agg(
        total_hours=("hours", "sum"),
        billable_hours=("hours", lambda x: x[te.loc[x.index, "billable"]].sum()),
    ).reset_index()

    # Overbudget detection (if budgets available)
    if budgets is not None and not budgets.empty and "budget_total" in budgets.columns:
        print("NOTE: Overbudget thresholds need user confirmation.\n")
        # Merge budget info
        budget_lookup = budgets.groupby("project_id").agg(
            budget_total=("budget_total", "sum"),
        ).reset_index()

        project_hours = project_hours.merge(budget_lookup, on="project_id", how="left")

        # Flag overbudget (placeholder thresholds — confirm with user)
        def flag_status(row):
            if pd.isna(row.get("budget_total")) or row["budget_total"] == 0:
                return "N/A"
            # Using hours-based comparison as placeholder
            usage_pct = row["total_hours"] / (row["budget_total"] / 100) * 100
            if usage_pct > 100:
                return "RED"
            elif usage_pct > 80:
                return "AMBER"
            return "GREEN"

        project_hours["status"] = project_hours.apply(flag_status, axis=1)
    else:
        print("  No budget data available for overbudget detection\n")

    # ACPH per service type
    if "service_name" in te.columns:
        service_hours = te.groupby("service_name").agg(
            total_hours=("hours", "sum"),
            entries=("id", "count"),
        ).reset_index()
        print("Hours by service type:")
        print(service_hours.to_string(index=False))
        print()

    print("Hours by project:")
    print(project_hours.to_string(index=False))

    return project_hours


# ---------------------------------------------------------------------------
# CLIENT REPORT
# ---------------------------------------------------------------------------

def client_report(data: dict[str, pd.DataFrame]) -> pd.DataFrame | None:
    """
    Client report: profitability by client, overbudget per client.

    # METRIC DEFINITION — confirmed with user:
    # Profitability = (not yet confirmed — ASK USER)
    #   Revenue - cost per client. Same definitions as financial report.
    """
    te = data.get("time_entries")
    if te is None:
        print("  No time_entries data available for client report")
        return None

    print("\n=== CLIENT REPORT ===")
    print("NOTE: Profitability formula needs user confirmation.\n")

    if "client_name" not in te.columns:
        print("  No client_name resolved — need projects with company relationships")
        return None

    clients = te.groupby("client_name").agg(
        total_hours=("hours", "sum"),
        billable_hours=("hours", lambda x: x[te.loc[x.index, "billable"]].sum()),
        projects=("project_name", "nunique"),
        people=("person_name", "nunique"),
    ).reset_index()

    clients["utilisation_pct"] = (
        clients["billable_hours"] / clients["total_hours"] * 100
    ).round(1)

    clients = clients.sort_values("billable_hours", ascending=False)

    print(clients.to_string(index=False))

    return clients


# ---------------------------------------------------------------------------
# HYGIENE REPORT
# ---------------------------------------------------------------------------

def hygiene_report(data: dict[str, pd.DataFrame]) -> pd.DataFrame | None:
    """
    Hygiene report: time entries without notes, percentage per month.

    # METRIC DEFINITION:
    # Missing note = entry where note is null OR note.strip() == ""
    # Percentage = count(missing) / count(total) × 100, per month
    """
    te = data.get("time_entries")
    if te is None:
        print("  No time_entries data available for hygiene report")
        return None

    print("\n=== HYGIENE REPORT ===\n")

    monthly_total = te.groupby("month").size().rename("total_entries")
    monthly_missing = (
        te[~te["has_note"]].groupby("month").size().rename("missing_notes")
    )

    hygiene = pd.concat([monthly_total, monthly_missing], axis=1).fillna(0)
    hygiene["missing_notes"] = hygiene["missing_notes"].astype(int)
    hygiene["missing_pct"] = (
        hygiene["missing_notes"] / hygiene["total_entries"] * 100
    ).round(1)

    # Trend indicator
    if len(hygiene) >= 2:
        last_two = hygiene["missing_pct"].tail(2).values
        trend = "improving" if last_two[1] < last_two[0] else "degrading"
        print(f"Trend: {trend} (last month: {last_two[1]:.1f}%, previous: {last_two[0]:.1f}%)\n")

    print(hygiene.to_string())

    # Per-person breakdown
    person_missing = te.groupby("person_name").agg(
        total=("id", "count"),
        missing=("has_note", lambda x: (~x).sum()),
    ).reset_index()
    person_missing["missing_pct"] = (
        person_missing["missing"] / person_missing["total"] * 100
    ).round(1)
    person_missing = person_missing.sort_values("missing_pct", ascending=False)

    print("\nPer-person breakdown:")
    print(person_missing.to_string(index=False))

    return hygiene


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

REPORTS = {
    "financial": financial_report,
    "people": people_report,
    "project": project_report,
    "client": client_report,
    "hygiene": hygiene_report,
}


def main():
    parser = argparse.ArgumentParser(description="Run LeadStreet BI reports")
    parser.add_argument(
        "--report",
        choices=list(REPORTS.keys()) + ["all"],
        default="all",
        help="Which report to run",
    )
    args = parser.parse_args()

    print("Loading data...")
    data = load_all_data()

    if not data:
        print("ERROR: No data snapshots found in /data/. Run fetch.py first.")
        sys.exit(1)

    print(f"Loaded: {', '.join(f'{k} ({len(v)} records)' for k, v in data.items())}")

    if args.report == "all":
        for name, func in REPORTS.items():
            func(data)
    else:
        REPORTS[args.report](data)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\nReports complete. Export to {OUTPUT_DIR}/ when ready.")


if __name__ == "__main__":
    main()
