"""
transform.py — Transform raw JSON:API snapshots into clean pandas DataFrames.

Flattens nested JSON:API responses, resolves relationships (person → name,
project → client via service → deal → company chain), enriches with team
membership, and applies owner cost overrides.

Usage:
    python scripts/transform.py                          # transform all endpoints
    python scripts/transform.py --endpoint time_entries   # transform specific endpoint
    python scripts/transform.py --date 2026-03-19         # transform specific date
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent.parent / "data"

# --- Owner cost override ---
# Johan Vandecasteele, Johan Vantomme, Michel Antonise cost EUR 15K/month flat
OWNER_MONTHLY_COST = 14166.67


# ============================================================
# Core JSON:API helpers
# ============================================================

def find_latest_snapshot(endpoint: str, date: str | None = None) -> Path | None:
    """Find the most recent snapshot file for an endpoint."""
    if date:
        target = DATA_DIR / f"{date}_{endpoint}.json"
        return target if target.exists() else None
    matches = sorted(DATA_DIR.glob(f"*_{endpoint}.json"), reverse=True)
    return matches[0] if matches else None


def load_snapshot(filepath: Path) -> dict:
    with open(filepath) as f:
        return json.load(f)


def build_included_lookup(included: list) -> dict:
    """Build a dict keyed by (type, id) for fast relationship resolution."""
    return {(item["type"], item["id"]): item for item in included}


def get_display_name(item: dict) -> str:
    attrs = item.get("attributes", {})
    if "first_name" in attrs:
        return f"{attrs['first_name']} {attrs.get('last_name', '')}".strip()
    return attrs.get("name", item.get("id", "unknown"))


def flatten_records(snapshot: dict) -> pd.DataFrame:
    """Flatten JSON:API data into a clean DataFrame."""
    lookup = build_included_lookup(snapshot.get("included", []))
    records = []

    for item in snapshot.get("data", []):
        record = {"id": item["id"], "type": item["type"]}

        for key, value in item.get("attributes", {}).items():
            record[key] = value

        for rel_name, rel_data in item.get("relationships", {}).items():
            ref = rel_data.get("data")
            if ref and isinstance(ref, dict):
                record[f"{rel_name}_id"] = ref["id"]
                resolved = lookup.get((ref["type"], ref["id"]))
                if resolved:
                    record[f"{rel_name}_name"] = get_display_name(resolved)
                    if ref["type"] == "projects" and resolved.get("relationships"):
                        company_ref = (
                            resolved.get("relationships", {})
                            .get("company", {})
                            .get("data")
                        )
                        if company_ref:
                            company = lookup.get((company_ref["type"], company_ref["id"]))
                            if company:
                                record["client_name"] = get_display_name(company)
                                record["client_id"] = company_ref["id"]

        records.append(record)

    return pd.DataFrame(records)


# ============================================================
# Enrichment mappings (loaded from snapshots)
# ============================================================

def load_service_mapping(date: str | None = None) -> dict:
    """Build service_id → {deal_name, deal_id, client_name, client_id, service_type_name, billing_type_id}."""
    filepath = find_latest_snapshot("services", date)
    if not filepath:
        return {}

    snapshot = load_snapshot(filepath)
    lookup = build_included_lookup(snapshot.get("included", []))
    mapping = {}

    for s in snapshot.get("data", []):
        info = {"service_name": s["attributes"].get("name", "")}

        # Billing type + price
        info["billing_type_id"] = s["attributes"].get("billing_type_id")
        info["billable"] = s["attributes"].get("billable", False)
        info["service_price"] = s["attributes"].get("price", 0) or 0  # cents per hour (T&M) or total (fixed)
        info["service_revenue"] = s["attributes"].get("revenue", 0) or 0  # total recognized revenue in cents
        info["service_billable_time"] = s["attributes"].get("billable_time", 0) or 0  # total billable minutes

        # Service type
        st_ref = s.get("relationships", {}).get("service_type", {}).get("data")
        if st_ref:
            st = lookup.get((st_ref["type"], st_ref["id"]))
            info["service_type_name"] = get_display_name(st) if st else None
        else:
            info["service_type_name"] = None

        # Deal → Company chain
        deal_ref = s.get("relationships", {}).get("deal", {}).get("data")
        if deal_ref:
            deal = lookup.get((deal_ref["type"], deal_ref["id"]))
            if deal:
                info["deal_name"] = get_display_name(deal)
                info["deal_id"] = deal_ref["id"]
                co_ref = deal.get("relationships", {}).get("company", {}).get("data")
                if co_ref:
                    co = lookup.get((co_ref["type"], co_ref["id"]))
                    if co:
                        info["client_name"] = get_display_name(co)
                        info["client_id"] = co_ref["id"]

        mapping[s["id"]] = info

    return mapping


def load_team_mapping(date: str | None = None) -> dict:
    """Build person_id → team_name from teams snapshot."""
    filepath = find_latest_snapshot("teams", date)
    if not filepath:
        return {}

    snapshot = load_snapshot(filepath)
    mapping = {}

    for team in snapshot.get("data", []):
        team_name = team["attributes"].get("name", "Unknown")
        members_ref = team.get("relationships", {}).get("members", {}).get("data", [])
        if members_ref:
            for member in members_ref:
                mapping[member["id"]] = team_name

    return mapping


def identify_owner_ids(team_mapping: dict) -> set:
    """Find owner person IDs from the Management team.
    Owners: Johan Vandecasteele, Johan Vantomme, Michel Antonise."""
    # We identify them by team=Management and checking names from people snapshot
    filepath = find_latest_snapshot("people")
    if not filepath:
        return set()

    snapshot = load_snapshot(filepath)
    owner_names = {"Johan Vandecasteele", "Johan Vantomme", "Michel Antonise"}
    owner_ids = set()

    for p in snapshot.get("data", []):
        a = p["attributes"]
        name = f"{a.get('first_name', '')} {a.get('last_name', '')}".strip()
        if name in owner_names:
            owner_ids.add(p["id"])

    return owner_ids


# ============================================================
# Endpoint-specific cleaners
# ============================================================

def clean_time_entries(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    # Core time fields
    df["date"] = pd.to_datetime(df["date"])
    df["time"] = pd.to_numeric(df["time"], errors="coerce").fillna(0)
    df["billable_time"] = pd.to_numeric(df["billable_time"], errors="coerce").fillna(0)
    df["hours"] = df["time"] / 60.0
    df["billable_hours"] = df["billable_time"] / 60.0
    df["is_billable"] = df["billable_time"] > 0
    df["month"] = df["date"].dt.to_period("M")
    df["year"] = df["date"].dt.year

    # Notes hygiene
    df["has_note"] = df["note"].notna() & (df["note"].astype(str).str.strip() != "")

    # Cost fields (cents → EUR)
    for col in ["cost", "work_cost", "overhead_cost"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce") / 100.0

    # --- Enrich from service mapping ---
    svc_map = load_service_mapping()
    if svc_map:
        df["deal_name"] = df["service_id"].map(lambda sid: svc_map.get(sid, {}).get("deal_name"))
        df["deal_id"] = df["service_id"].map(lambda sid: svc_map.get(sid, {}).get("deal_id"))
        df["client_name"] = df["service_id"].map(lambda sid: svc_map.get(sid, {}).get("client_name"))
        df["client_id"] = df["service_id"].map(lambda sid: svc_map.get(sid, {}).get("client_id"))
        df["service_type"] = df["service_id"].map(lambda sid: svc_map.get(sid, {}).get("service_type_name"))
        df["billing_type_id"] = df["service_id"].map(lambda sid: svc_map.get(sid, {}).get("billing_type_id"))
        df["service_price"] = df["service_id"].map(
            lambda sid: svc_map.get(sid, {}).get("service_price", 0)
        ).fillna(0)
        # Revenue per entry: T&M only (for ARPH/service-level metrics).
        # Company-wide recognized revenue comes from financial_item_reports API.
        # T&M (billing_type_id=2): billable_time × price / 60 / 100
        # Fixed (billing_type_id=1): 0 (recognized revenue from API, not computable per-entry)
        # Non-billable (billing_type_id=3): 0
        is_tm = df["billing_type_id"] == 2
        df["entry_revenue"] = 0.0
        df.loc[is_tm, "entry_revenue"] = (
            df.loc[is_tm, "billable_time"] * df.loc[is_tm, "service_price"] / 60 / 100
        )
        print("  Enriched with deal/client/service_type/revenue from service mapping")

    # --- Enrich from team mapping ---
    team_map = load_team_mapping()
    if team_map:
        df["team"] = df["person_id"].map(team_map).fillna("Unassigned")
        print("  Enriched with team membership")

    # --- Owner cost override ---
    owner_ids = identify_owner_ids(team_map)
    if owner_ids:
        # For each owner, replace work_cost with proportional EUR 15K/month
        owner_mask = df["person_id"].isin(owner_ids)
        if owner_mask.any():
            owner_df = df.loc[owner_mask].copy()
            # Calculate total hours per owner per month
            monthly_hours = owner_df.groupby(["person_id", "month"])["hours"].transform("sum")
            # Override: entry_cost = (entry_hours / month_total_hours) * 15000
            # Avoid division by zero
            safe_monthly = monthly_hours.replace(0, 1)
            df.loc[owner_mask, "work_cost"] = (owner_df["hours"] / safe_monthly) * OWNER_MONTHLY_COST
            df.loc[owner_mask, "cost"] = df.loc[owner_mask, "work_cost"]
            owner_count = owner_mask.sum()
            print(f"  Applied owner cost override (EUR {OWNER_MONTHLY_COST:,.0f}/month) to {owner_count} entries")

    return df


def clean_bookings(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    df["started_on"] = pd.to_datetime(df["started_on"])
    df["ended_on"] = pd.to_datetime(df["ended_on"])
    df["time"] = pd.to_numeric(df["time"], errors="coerce").fillna(0)
    df["total_time"] = pd.to_numeric(df["total_time"], errors="coerce").fillna(0)
    df["booking_hours"] = df["time"] / 60.0
    df["total_hours"] = df["total_time"] / 60.0
    return df


def clean_deals(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    money_cols = [
        "budget_total", "revenue", "cost", "profit", "invoiced",
        "pending_invoicing", "services_revenue", "budget_used",
        "projected_revenue", "expense",
    ]
    for col in money_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce") / 100.0
    if "budgeted_time" in df.columns:
        df["budgeted_hours"] = pd.to_numeric(df["budgeted_time"], errors="coerce") / 60.0
    if "worked_time" in df.columns:
        df["worked_hours"] = pd.to_numeric(df["worked_time"], errors="coerce") / 60.0
    return df


CLEANERS = {
    "time_entries": clean_time_entries,
    "bookings": clean_bookings,
    "deals": clean_deals,
}


# ============================================================
# Transform pipeline
# ============================================================

def transform_endpoint(endpoint: str, date: str | None = None) -> pd.DataFrame | None:
    filepath = find_latest_snapshot(endpoint, date)
    if not filepath:
        print(f"  No snapshot found for {endpoint}")
        return None

    print(f"  Loading {filepath.name}...")
    snapshot = load_snapshot(filepath)

    df = flatten_records(snapshot)
    print(f"  Flattened {len(df)} records")

    cleaner = CLEANERS.get(endpoint)
    if cleaner:
        df = cleaner(df)
        print(f"  Applied {endpoint} cleaning")

    return df


def validate_dataframe(df: pd.DataFrame, endpoint: str) -> list[str]:
    warnings = []
    if df.empty:
        warnings.append(f"{endpoint}: DataFrame is empty")
        return warnings

    if "id" in df.columns and not df["id"].is_unique:
        dupes = df["id"].duplicated().sum()
        warnings.append(f"{endpoint}: {dupes} duplicate IDs found")

    if "time" in df.columns and (df["time"] < 0).any():
        negs = (df["time"] < 0).sum()
        warnings.append(f"{endpoint}: {negs} negative time values")

    return warnings


ALL_ENDPOINTS = [
    "time_entries", "bookings", "projects", "people",
    "services", "companies", "deals",
]


def main():
    parser = argparse.ArgumentParser(description="Transform Productive API snapshots")
    parser.add_argument("--endpoint", choices=ALL_ENDPOINTS, help="Specific endpoint to transform")
    parser.add_argument("--date", help="Specific snapshot date (YYYY-MM-DD)")
    args = parser.parse_args()

    endpoints = [args.endpoint] if args.endpoint else ALL_ENDPOINTS
    results = {}
    all_warnings = []

    print("Transforming snapshots...")
    for ep in endpoints:
        df = transform_endpoint(ep, args.date)
        if df is not None:
            results[ep] = df
            warnings = validate_dataframe(df, ep)
            all_warnings.extend(warnings)

    print(f"\nTransformed {len(results)} endpoints:")
    for ep, df in results.items():
        print(f"  {ep}: {len(df)} records, {len(df.columns)} columns")

    if all_warnings:
        print(f"\nWarnings ({len(all_warnings)}):")
        for w in all_warnings:
            print(f"  ! {w}")

    return results


if __name__ == "__main__":
    main()
