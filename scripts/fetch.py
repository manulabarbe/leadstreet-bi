"""
fetch.py — Paginated data fetcher for the Productive.io API.

Fetches all records for an endpoint, handles pagination and rate limiting,
saves the complete response as a dated JSON snapshot in /data/.

Usage:
    python scripts/fetch.py time_entries --after 2026-01-01 --before 2026-03-31
    python scripts/fetch.py bookings --after 2026-01-01
    python scripts/fetch.py projects
    python scripts/fetch.py people
    python scripts/fetch.py services
    python scripts/fetch.py companies
    python scripts/fetch.py budgets
    python scripts/fetch.py financial_item_reports
    python scripts/fetch.py financial_item_reports_by_budget
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# Load credentials
load_dotenv()
API_KEY = os.getenv("PRODUCTIVE_API_KEY")
ORG_ID = os.getenv("PRODUCTIVE_ORG_ID")

if not API_KEY or not ORG_ID:
    print("ERROR: PRODUCTIVE_API_KEY and PRODUCTIVE_ORG_ID must be set in .env")
    sys.exit(1)

BASE_URL = "https://api.productive.io/api/v2/"
HEADERS = {
    "X-Auth-Token": API_KEY,
    "X-Organization-Id": ORG_ID,
    "Content-Type": "application/vnd.api+json",
}
PAGE_SIZE = 200
RATE_LIMIT_DELAY = 0.1  # seconds between requests

# Default includes to sideload relationships
ENDPOINT_INCLUDES = {
    "time_entries": "person,service",
    "bookings": "person,service,project,project.company",
    "projects": "company",
    "deals": "company,project",
    "people": "",
    "services": "deal,deal.company,service_type",
    "companies": "",
    "teams": "members",
}

DATA_DIR = Path(__file__).parent.parent / "data"

# Endpoints that use the reports API (different URL pattern and params)
REPORT_ENDPOINTS = {"financial_item_reports", "financial_item_reports_by_budget", "financial_item_reports_by_service_type"}

# Some report endpoints are aliases that hit the same API path with different params
REPORT_API_PATH = {
    "financial_item_reports_by_budget": "financial_item_reports",
    "financial_item_reports_by_service_type": "financial_item_reports",
}
REPORT_GROUP_OVERRIDE = {
    "financial_item_reports_by_budget": "date:month,budget",
    "financial_item_reports_by_service_type": "date:month,service_type",
}
REPORT_INCLUDE_OVERRIDE = {
    "financial_item_reports_by_service_type": "service_type",
}


def fetch_report(endpoint: str) -> dict:
    """Fetch a reports endpoint (e.g. financial_item_reports) with group=date:month."""
    all_data = []
    all_included = []
    page = 1

    api_path = REPORT_API_PATH.get(endpoint, endpoint)
    group = REPORT_GROUP_OVERRIDE.get(endpoint, "date:month")
    include = REPORT_INCLUDE_OVERRIDE.get(endpoint, "")

    params = {
        "group": group,
        "page[size]": PAGE_SIZE,
    }
    if include:
        params["include"] = include

    while True:
        params["page[number]"] = page
        print(f"  Fetching {endpoint} page {page}...", end="", flush=True)

        try:
            resp = requests.get(
                f"{BASE_URL}reports/{api_path}",
                headers=HEADERS,
                params=params,
                timeout=30,
            )
        except requests.RequestException as e:
            print(f" ERROR: {e}")
            sys.exit(1)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 10))
            print(f" rate-limited, waiting {retry_after}s...")
            time.sleep(retry_after)
            continue

        if resp.status_code != 200:
            print(f" ERROR: HTTP {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            sys.exit(1)

        body = resp.json()
        data = body.get("data", [])
        meta = body.get("meta", {})

        all_data.extend(data)
        all_included.extend(body.get("included", []))
        page_count = meta.get("total_pages", meta.get("page_count", 1))
        print(f" got {len(data)} records (page {page}/{page_count})")

        if page >= page_count:
            break

        page += 1
        time.sleep(RATE_LIMIT_DELAY)

    # Deduplicate included entities
    seen = set()
    unique_included = []
    for inc in all_included:
        key = (inc.get("type"), inc.get("id"))
        if key not in seen:
            seen.add(key)
            unique_included.append(inc)

    return {
        "data": all_data,
        "included": unique_included,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "filters": {"group": group},
        "total_count": len(all_data),
        "page_count": page_count if all_data else 1,
    }


def fetch_all(endpoint: str, filters: dict | None = None) -> dict:
    """Fetch all records from an endpoint, paginating automatically."""
    all_data = []
    all_included = []
    page = 1
    total_count = None
    page_count = None

    params = {}
    if filters:
        for key, value in filters.items():
            params[f"filter[{key}]"] = value

    includes = ENDPOINT_INCLUDES.get(endpoint, "")
    if includes:
        params["include"] = includes

    params["page[size]"] = PAGE_SIZE

    while True:
        params["page[number]"] = page

        print(f"  Fetching {endpoint} page {page}...", end="", flush=True)

        try:
            resp = requests.get(
                f"{BASE_URL}{endpoint}",
                headers=HEADERS,
                params=params,
                timeout=30,
            )
        except requests.RequestException as e:
            print(f" ERROR: {e}")
            sys.exit(1)

        # Handle rate limiting
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 10))
            print(f" rate-limited, waiting {retry_after}s...")
            time.sleep(retry_after)
            continue

        if resp.status_code != 200:
            print(f" ERROR: HTTP {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            sys.exit(1)

        body = resp.json()
        data = body.get("data", [])
        included = body.get("included", [])
        meta = body.get("meta", {})

        all_data.extend(data)
        all_included.extend(included)

        total_count = meta.get("total_count", len(data))
        page_count = meta.get("total_pages", meta.get("page_count", 1))

        print(f" got {len(data)} records (page {page}/{page_count})")

        if page >= page_count:
            break

        page += 1
        time.sleep(RATE_LIMIT_DELAY)

    # Deduplicate included resources
    seen = set()
    unique_included = []
    for item in all_included:
        key = (item["type"], item["id"])
        if key not in seen:
            seen.add(key)
            unique_included.append(item)

    return {
        "data": all_data,
        "included": unique_included,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "filters": filters or {},
        "total_count": total_count,
        "page_count": page_count,
    }


def save_snapshot(endpoint: str, result: dict) -> Path:
    """Save the fetched result as a dated JSON snapshot."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    filepath = DATA_DIR / f"{date_str}_{endpoint}.json"

    with open(filepath, "w") as f:
        json.dump(result, f, indent=2, default=str)

    return filepath


def main():
    all_endpoints = list(ENDPOINT_INCLUDES.keys()) + list(REPORT_ENDPOINTS)
    parser = argparse.ArgumentParser(description="Fetch data from Productive.io API")
    parser.add_argument(
        "endpoint",
        choices=all_endpoints,
        help="API endpoint to fetch",
    )
    parser.add_argument("--after", help="Filter: entries on or after date (YYYY-MM-DD)")
    parser.add_argument("--before", help="Filter: entries on or before date (YYYY-MM-DD)")
    parser.add_argument("--person-id", help="Filter: person ID")
    parser.add_argument("--project-id", help="Filter: project ID")
    parser.add_argument("--company-id", help="Filter: company/client ID")

    args = parser.parse_args()

    print(f"Fetching {args.endpoint} from Productive API...")

    if args.endpoint in REPORT_ENDPOINTS:
        result = fetch_report(args.endpoint)
    else:
        filters = {}
        if args.after:
            filters["after"] = args.after
        if args.before:
            filters["before"] = args.before
        if args.person_id:
            filters["person_id"] = args.person_id
        if args.project_id:
            filters["project_id"] = args.project_id
        if args.company_id:
            filters["company_id"] = args.company_id
        if filters:
            print(f"  Filters: {filters}")
        result = fetch_all(args.endpoint, filters)

    filepath = save_snapshot(args.endpoint, result)

    print(f"\nDone! {len(result['data'])} records saved to {filepath}")


if __name__ == "__main__":
    main()
