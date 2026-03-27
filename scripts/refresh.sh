#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/Users/manulabarbe/Productive Dashboard/leadstreet-bi"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/refresh_$(date +%Y-%m-%d_%H%M).log"
PYTHON=/usr/bin/python3

cd "$REPO_DIR"
mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1
echo "=== LeadStreet BI refresh started at $(date) ==="

# 1. Fetch all Productive endpoints
echo "--- Fetching Productive data ---"
$PYTHON scripts/fetch.py time_entries --after 2025-01-01
$PYTHON scripts/fetch.py bookings --after 2025-01-01
$PYTHON scripts/fetch.py projects
$PYTHON scripts/fetch.py deals
$PYTHON scripts/fetch.py people
$PYTHON scripts/fetch.py services
$PYTHON scripts/fetch.py companies
$PYTHON scripts/fetch.py teams
$PYTHON scripts/fetch.py financial_item_reports
$PYTHON scripts/fetch.py financial_item_reports_by_budget
$PYTHON scripts/fetch.py financial_item_reports_by_service_type

# 2. Transform + Analyse + Build dashboard
echo "--- Transform ---"
$PYTHON scripts/transform.py

echo "--- Analyse ---"
$PYTHON scripts/analyse.py --report all

echo "--- Build dashboard ---"
$PYTHON scripts/build_dashboard.py

# 3. Git commit + push (only if dashboard changed)
if ! git diff --quiet docs/index.html 2>/dev/null; then
    echo "--- Pushing to GitHub Pages ---"
    git add docs/index.html
    git commit -m "chore: daily dashboard refresh $(date +%Y-%m-%d)"
    git push origin main
    echo "Dashboard pushed to GitHub Pages."
else
    echo "No dashboard changes detected — skipping git push."
fi

# 4. Clean up old logs (keep last 30)
ls -1t "$LOG_DIR"/refresh_*.log | tail -n +31 | xargs rm -f 2>/dev/null || true

echo "=== Refresh completed at $(date) ==="
