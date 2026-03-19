# Data Warehouse — Storage, Refresh & Transformation

## Storage Strategy

### Raw JSON Snapshots

All API responses are saved as dated JSON files in `/data/`:

```
data/
  2026-03-19_time_entries.json
  2026-03-19_bookings.json
  2026-03-19_projects.json
  2026-03-19_people.json
  2026-03-19_services.json
  2026-03-19_companies.json
  2026-03-19_budgets.json
```

**Naming convention:** `YYYY-MM-DD_endpoint.json`
- Date = the date the snapshot was taken (not the data's date range)
- Endpoint = the Productive API endpoint name

### What Gets Stored

Each JSON file contains the **complete** paginated response:

```json
{
  "data": [ ... all records across all pages ... ],
  "included": [ ... all sideloaded relationships ... ],
  "fetched_at": "2026-03-19T14:30:00Z",
  "endpoint": "time_entries",
  "filters": {"after": "2026-01-01", "before": "2026-03-19"},
  "total_count": 1523,
  "page_count": 8
}
```

The `fetched_at`, `endpoint`, `filters`, `total_count`, and `page_count` fields are metadata added by `fetch.py` for provenance tracking.

## Refresh Strategy

### Reference Data (low frequency)
Fetch **weekly or on-demand** — these change rarely:
- `people`
- `services`
- `companies`
- `projects`

### Transactional Data (high frequency)
Fetch **daily or before each analysis run**:
- `time_entries` — filtered by date range
- `bookings` — filtered by date range
- `budgets` — for current budget status

### Incremental Fetching
For time_entries and bookings, use date filters to fetch only new data:

```bash
# Fetch only this month's entries
python scripts/fetch.py time_entries --after 2026-03-01

# Fetch entire year for full analysis
python scripts/fetch.py time_entries --after 2026-01-01
```

Previous snapshots are kept (not overwritten) so you can compare data over time.

## Loading into Pandas

### JSON:API Flattening

Productive's JSON:API responses have a nested structure that needs flattening:

```python
import pandas as pd
import json

def load_snapshot(filepath):
    """Load a JSON snapshot and return flattened DataFrame."""
    with open(filepath) as f:
        snapshot = json.load(f)

    records = []
    included_lookup = _build_included_lookup(snapshot.get("included", []))

    for item in snapshot["data"]:
        record = {"id": item["id"], "type": item["type"]}
        # Flatten attributes
        record.update(item.get("attributes", {}))
        # Resolve relationships
        for rel_name, rel_data in item.get("relationships", {}).items():
            ref = rel_data.get("data")
            if ref and isinstance(ref, dict):
                record[f"{rel_name}_id"] = ref["id"]
                record[f"{rel_name}_type"] = ref["type"]
                # Attach resolved name if available
                resolved = included_lookup.get((ref["type"], ref["id"]))
                if resolved:
                    record[f"{rel_name}_name"] = _get_display_name(resolved)
        records.append(record)

    return pd.DataFrame(records)


def _build_included_lookup(included):
    """Build a dict keyed by (type, id) for fast relationship resolution."""
    return {(item["type"], item["id"]): item for item in included}


def _get_display_name(item):
    """Extract a human-readable name from an included resource."""
    attrs = item.get("attributes", {})
    if "first_name" in attrs:
        return f"{attrs['first_name']} {attrs.get('last_name', '')}".strip()
    return attrs.get("name", item["id"])
```

### Data Type Cleanup

After loading, apply these transformations:

```python
def clean_time_entries(df):
    """Clean time_entries DataFrame."""
    df["date"] = pd.to_datetime(df["date"])
    df["hours"] = df["time"] / 60.0  # minutes → hours
    df["month"] = df["date"].dt.to_period("M")
    df["year"] = df["date"].dt.year
    df["has_note"] = df["note"].notna() & (df["note"].str.strip() != "")
    return df
```

### Relationship Resolution

To get client names on time entries (time_entry → project → company):

```python
def resolve_clients(time_entries_df, projects_df):
    """Add client_name to time entries via project→company relationship."""
    project_client = projects_df[["id", "company_name"]].rename(
        columns={"id": "project_id", "company_name": "client_name"}
    )
    return time_entries_df.merge(project_client, on="project_id", how="left")
```

## Data Quality Checks

Before analysis, validate:

1. **No duplicate IDs** — `assert df["id"].is_unique`
2. **Date ranges make sense** — no entries outside the requested filter range
3. **Relationships resolved** — check for NaN in `_name` columns, log warnings
4. **Time values positive** — `assert (df["time"] >= 0).all()`
5. **Billable flag present** — `assert df["billable"].notna().all()`
