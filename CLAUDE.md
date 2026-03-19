# LeadStreet BI — Agent Context

## What This Project Does
LeadStreet BI is a custom business intelligence layer built on top of Productive.io. It fetches raw data from the Productive API, transforms it into clean DataFrames, computes all metrics from scratch, and produces reports and visualizations. No Productive built-in reports or aggregates are used — we control every calculation.

## Before You Do Anything
1. **Read the relevant skill file(s) in `skills/`** before writing or modifying any code.
2. Skills contain the domain knowledge, API specs, metric definitions, and visualization rules.
3. If a task spans multiple domains (e.g., fetching data AND computing metrics), read all relevant skills.

### Skill Files (local — read these first)
| File | When to read |
|------|-------------|
| `skills/productive-api.md` | Before any API call, data fetch, or endpoint question |
| `skills/business-analyst.md` | Before computing any metric, building any report, or defining any calculation |
| `skills/data-warehouse.md` | Before storing, loading, or transforming data |
| `skills/visualization.md` | Before creating any chart, graph, or visual output |

### External Skills (installed via skillfish)
- **@business-analyst** — General BI patterns, KPI frameworks, analysis approaches
- **@skill-creator** — Meta-skill for reviewing, evaluating, and improving the custom skills in this project

## Critical Rules

### 1. Never Hardcode Credentials
Credentials are always loaded from `.env` via `python-dotenv`. Never put API keys, org IDs, or secrets in code, comments, or skill files.

```python
from dotenv import load_dotenv
import os

load_dotenv()
API_KEY = os.getenv("PRODUCTIVE_API_KEY")
ORG_ID = os.getenv("PRODUCTIVE_ORG_ID")
```

### 2. Never Use Productive's Built-in Aggregates
Productive has built-in reports, forecasts, and computed fields. **Do not use them.** Always compute from the most granular raw data available:
- Individual `time_entries` (not daily/weekly summaries)
- Individual `bookings` (not aggregated forecasts)
- Line-item `budgets` (not rollup totals)

We build every metric ourselves so we control the definition.

### 3. Always Confirm Metrics With the User
Before implementing any metric calculation, **ask the user to confirm the exact definition**. Productive fields are ambiguous. Examples:
- "Revenue" could mean invoiced amount OR billable hours × rate — which rate?
- "Utilisation" could be billable/total OR billable/capacity
- "Overbudget" could mean hours OR cost

Don't assume. Ask first. Document the confirmed definition in the code.

### 4. Fetch at Maximum Granularity
When fetching data, always request the deepest level of detail:
- All individual records, not paginated summaries
- All available relationships via `include` parameters
- All relevant attributes, not just the ones you think you need now

## Workflow: fetch → transform → analyse → visualize

```
1. FETCH     python scripts/fetch.py <endpoint> [--after DATE] [--before DATE]
             → Saves raw JSON to /data/YYYY-MM-DD_endpoint.json

2. TRANSFORM python scripts/transform.py [--endpoint <name>] [--date DATE]
             → Flattens JSON:API → clean DataFrames
             → Resolves relationships (person→name, project→client)

3. ANALYSE   python scripts/analyse.py [--report <type>]
             → Computes metrics from raw data
             → Report types: financial, people, project, client, hygiene

4. VISUALIZE Charts are generated within analyse.py or interactively
             → Output saved to /output/
```

## Report Categories
1. **Financial** — Revenue, margin by month, YTD, YoY comparison, EOY forecast
2. **People** — Billable utilisation %, avg cost/hr, total hours per person
3. **Project** — Overbudget flags, ACPH per service type, budget burn rate
4. **Client** — Profitability by client, overbudget per client
5. **Hygiene** — Time entries without notes (% per month, trend)

## File Organization
```
/data/       Raw JSON snapshots from API (gitignored)
/output/     Reports, charts, exports (gitignored)
/scripts/    Python pipeline code
/skills/     Domain knowledge for the agent
```

## Iterative Improvement
Use `@skill-creator` to review and improve the skills in this project. The workflow is:
1. Use the BI system, notice gaps or ambiguities
2. Run skill-creator to evaluate and improve the relevant skill file
3. Test the improved skill by running the pipeline again
4. Repeat
