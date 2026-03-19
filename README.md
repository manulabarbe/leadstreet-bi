# LeadStreet BI

Custom business intelligence on top of [Productive.io](https://productive.io). Fetches raw data, computes all metrics from scratch, and generates reports.

## Setup

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Configure credentials
cp .env.example .env
# Edit .env with your Productive API key and org ID

# 3. Install external skills (optional, for Claude Code users)
npx skillfish add sickn33/antigravity-awesome-skills business-analyst --project
npx skillfish add anthropics/skills skill-creator --project
```

## Usage

```bash
# Fetch data from Productive API
python scripts/fetch.py time_entries --after 2026-01-01
python scripts/fetch.py bookings --after 2026-01-01
python scripts/fetch.py projects
python scripts/fetch.py people
python scripts/fetch.py budgets
python scripts/fetch.py services
python scripts/fetch.py companies

# Transform raw JSON into clean DataFrames
python scripts/transform.py

# Run analysis reports
python scripts/analyse.py --report financial
python scripts/analyse.py --report people
python scripts/analyse.py --report project
python scripts/analyse.py --report client
python scripts/analyse.py --report hygiene
```

## Reports

| Report | What it shows |
|--------|--------------|
| Financial | Revenue, margin by month, YTD, YoY, EOY forecast |
| People | Billable utilisation %, avg cost/hr, total hours |
| Project | Overbudget flags, ACPH per service type |
| Client | Profitability by client, overbudget usage |
| Hygiene | Time entries missing notes (% per month) |

## Architecture

All metrics are computed from raw granular data (individual time entries, bookings, budget line items). No Productive built-in reports or aggregates are used.

See `CLAUDE.md` for agent context and `skills/` for domain knowledge.
