"""
transform.py — Transform raw JSON:API snapshots into clean pandas DataFrames.

Flattens nested JSON:API responses, resolves relationships (person → name,
project → client), and outputs analysis-ready DataFrames.

Usage:
    python scripts/transform.py                          # transform latest snapshot for all endpoints
    python scripts/transform.py --endpoint time_entries   # transform specific endpoint
    python scripts/transform.py --date 2026-03-19         # transform specific date's snapshots
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent.parent / "data"


def find_latest_snapshot(endpoint: str, date: str | None = None) -> Path | None:
    """Find the most recent snapshot file for an endpoint."""
    if date:
        target = DATA_DIR / f"{date}_{endpoint}.json"
        return target if target.exists() else None

    matches = sorted(DATA_DIR.glob(f"*_{endpoint}.json"), reverse=True)
    return matches[0] if matches else None


def load_snapshot(filepath: Path) -> dict:
    """Load a JSON snapshot file."""
    with open(filepath) as f:
        return json.load(f)


def build_included_lookup(included: list) -> dict:
    """Build a dict keyed by (type, id) for fast relationship resolution."""
    return {(item["type"], item["id"]): item for item in included}


def get_display_name(item: dict) -> str:
    """Extract a human-readable name from an included resource."""
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

        # Flatten attributes
        for key, value in item.get("attributes", {}).items():
            record[key] = value

        # Resolve relationships
        for rel_name, rel_data in item.get("relationships", {}).items():
            ref = rel_data.get("data")
            if ref and isinstance(ref, dict):
                record[f"{rel_name}_id"] = ref["id"]
                resolved = lookup.get((ref["type"], ref["id"]))
                if resolved:
                    record[f"{rel_name}_name"] = get_display_name(resolved)
                    # For projects, also resolve nested company
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


def clean_time_entries(df: pd.DataFrame) -> pd.DataFrame:
    """Apply time_entries-specific cleaning."""
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"])
    df["hours"] = df["time"] / 60.0
    df["month"] = df["date"].dt.to_period("M")
    df["year"] = df["date"].dt.year
    df["has_note"] = df["note"].notna() & (df["note"].astype(str).str.strip() != "")
    df["billable"] = df["billable"].fillna(False).astype(bool)
    return df


def clean_bookings(df: pd.DataFrame) -> pd.DataFrame:
    """Apply bookings-specific cleaning."""
    if df.empty:
        return df
    df["started_on"] = pd.to_datetime(df["started_on"])
    df["ended_on"] = pd.to_datetime(df["ended_on"])
    df["hours"] = df["time"] / 60.0
    df["billable"] = df["billable"].fillna(False).astype(bool)
    return df


def clean_budgets(df: pd.DataFrame) -> pd.DataFrame:
    """Apply budgets-specific cleaning. Convert cents to currency."""
    if df.empty:
        return df
    for col in ["budget_total", "revenue", "cost"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce") / 100.0
    return df


CLEANERS = {
    "time_entries": clean_time_entries,
    "bookings": clean_bookings,
    "budgets": clean_budgets,
}


def transform_endpoint(endpoint: str, date: str | None = None) -> pd.DataFrame | None:
    """Transform a single endpoint's snapshot into a clean DataFrame."""
    filepath = find_latest_snapshot(endpoint, date)
    if not filepath:
        print(f"  No snapshot found for {endpoint}")
        return None

    print(f"  Loading {filepath.name}...")
    snapshot = load_snapshot(filepath)

    df = flatten_records(snapshot)
    print(f"  Flattened {len(df)} records")

    # Apply endpoint-specific cleaning
    cleaner = CLEANERS.get(endpoint)
    if cleaner:
        df = cleaner(df)
        print(f"  Applied {endpoint} cleaning")

    return df


def validate_dataframe(df: pd.DataFrame, endpoint: str) -> list[str]:
    """Run basic data quality checks. Returns list of warnings."""
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

    if "billable" in df.columns and df["billable"].isna().any():
        nulls = df["billable"].isna().sum()
        warnings.append(f"{endpoint}: {nulls} null billable flags")

    return warnings


ALL_ENDPOINTS = [
    "time_entries", "bookings", "projects", "people",
    "services", "companies", "budgets",
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

    # Print summary
    print(f"\nTransformed {len(results)} endpoints:")
    for ep, df in results.items():
        print(f"  {ep}: {len(df)} records, {len(df.columns)} columns")

    if all_warnings:
        print(f"\nWarnings ({len(all_warnings)}):")
        for w in all_warnings:
            print(f"  ⚠ {w}")

    return results


if __name__ == "__main__":
    main()
