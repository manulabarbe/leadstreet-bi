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

## Workflow: fetch → transform → analyse → dashboard

**Use `python3` (not `python`) — this machine has Python 3.9 via CommandLineTools.**

```
1. FETCH       python3 scripts/fetch.py <endpoint> [--after DATE] [--before DATE]
               → Saves raw JSON to /data/YYYY-MM-DD_endpoint.json

2. TRANSFORM   python3 scripts/transform.py [--endpoint <name>] [--date DATE]
               → Flattens JSON:API → clean DataFrames
               → Resolves relationships (person→name, project→client)

3. ANALYSE     python3 scripts/analyse.py [--report <type>]
               → Computes metrics from raw data
               → Report types: financial, people, project, client, hygiene

4. DASHBOARD   python3 scripts/build_dashboard.py
               → Generates docs/index.html (HTML + embedded DATA JSON)
               → CSS/JS files in docs/ are static — edit directly
```

### Scripts Overview
| Script | Size | What it does |
|--------|------|-------------|
| `scripts/fetch.py` | 8KB | Paginated API fetcher for 8 Productive endpoints |
| `scripts/transform.py` | 14KB | JSON:API → DataFrames, resolves relationships, owner cost overrides |
| `scripts/analyse.py` | 98KB | Core metrics engine, `get_dashboard_data()` aggregates all data |
| `scripts/build_dashboard.py` | ~12KB | Generates `docs/index.html` with embedded DATA JSON |
| `scripts/load_budget.py` | — | Budget analysis utilities |
| `scripts/chat_*.py` | — | Separate chat feature (not part of dashboard) |

## Report Categories
1. **Financial** — Revenue, margin by month, YTD, YoY comparison, EOY forecast
2. **People** — Billable utilisation %, avg cost/hr, total hours per person
3. **Project** — Overbudget flags, ACPH per service type, budget burn rate
4. **Client** — Profitability by client, overbudget per client
5. **Hygiene** — Time entries without notes (% per month, trend)

## File Organization
```
/data/            Raw JSON snapshots from API (gitignored)
/output/          Reports, charts, exports (gitignored)
/scripts/         Python pipeline code
/skills/          Domain knowledge for the agent
/docs/            Dashboard (GitHub Pages)
/docs/index.html  Generated by build_dashboard.py (HTML skeleton + embedded DATA JSON)
/docs/css/        Static CSS (edit directly, not generated)
/docs/js/         Static JS modules (edit directly, not generated)
```

## Dashboard Architecture

The dashboard is a **modular static site** deployed to GitHub Pages. Python generates only `index.html` (HTML + embedded data). All CSS and JS are separate static files you edit directly.

### Build Command
```
python3 scripts/build_dashboard.py
```
This generates `docs/index.html` with embedded DATA JSON. All other files in `docs/css/` and `docs/js/` are static.

### JS Module Structure
Each section has its own file that registers a render callback with `Dashboard.registerSection()`:

| File | Section | What it renders |
|------|---------|----------------|
| `js/core.js` | — | Shared namespace, utilities, filters, navigation, `applyFilters()` dispatcher |
| `js/forecast.js` | — | Forecast engine (used by executive + financial) |
| `js/executive.js` | Executive | Budget vs actuals, waterfall, operational metrics, narrative |
| `js/financial.js` | Financial | Revenue/margin trends, YoY, invoiced tab, variance |
| `js/people.js` | People | Utilisation, rates, heatmaps, team summaries |
| `js/service.js` | Service Type | Service metrics, effective rate, overbudget deals |
| `js/client.js` | Client | Client metrics, monthly trends, revenue leaks |
| `js/hygiene.js` | Hygiene | Scorecard, budget audit, PSO, lifecycle, billability |
| `js/analysis.js` | Analysis | Scatter/bubble plots (efficiency frontier, strategic quad, etc.) |

### How to Add a New Chart
1. Add the HTML container in `build_dashboard.py` (in the section's HTML)
2. Add the chart builder function in the section's JS file
3. Call it from the section's registered render callback
4. Rebuild: `python3 scripts/build_dashboard.py`

### How to Add a New Section
1. Add nav button in `build_dashboard.py` (`nav_sections` list)
2. Add `<section id="section-xxx">` HTML in `build_dashboard.py`
3. Create `docs/js/xxx.js` following the IIFE pattern
4. Add `<script src="js/xxx.js"></script>` in `build_dashboard.py`
5. Register via `D.registerSection("xxx", function(f) { ... })`

### Section File Pattern
```javascript
(function(D) {
  var u = D.utils;
  var C = D.C;          // Color constants: revenue, cost, billable, onTrack, warning, overbudget, ...
  var d3c = D.d3;       // D3 chart library (horizontalBar, verticalBar, lineTrend, etc.)
  var DATA = D.DATA;    // All 29+ datasets from get_dashboard_data()

  function buildMyChart(data) { /* ... */ }

  // If any function is called from HTML onclick, expose it:
  // window.myFunction = myFunction;

  D.registerSection("sectionId", function(f) {
    // f = {startMonth, endMonth, teams, flags} from getFilters()
    buildMyChart(filteredData);
  });
})(window.Dashboard);
```

### Available `D.utils` Functions
| Function | Purpose |
|----------|---------|
| `u.sum(arr, key)` | Sum a field across array of objects |
| `u.fmt(n)` | Format number with commas (no decimals) |
| `u.fmtEur(n)` | Format as EUR: €45K, €1.2M |
| `u.fmtK(n)` | Compact EUR format |
| `u.pct(a, b)` | Percentage string: (a/b*100).toFixed(1) |
| `u.filterByMonth(arr, key, start, end)` | Filter array by YYYY-MM range |
| `u.setKPIs(id, cards)` | Render KPI strip into DOM element |
| `u.deltaColor(d)` | Green/orange/red color for variance % |
| `u.getSvcColor(svcType)` | Consistent color per service type |
| `u.getBudgetForMonths(months)` | Lookup budget data by month |
| `u.prodLink(name, projId, compId)` | HTML link to Productive deal |
| `u.prodDealLink(name, projId, dealId)` | HTML link to Productive budget |
| `u.attachProdClick(chartId)` | Make chart bars clickable → Productive |
| `u.attachPsoDealClick(chartId)` | Make PSO chart bars clickable |
| `u.setupCliPager(chartId, spec)` | Paginated horizontal bar chart |
| `u.renderCliPage(chartId)` | Render current page of paginated chart |
| `u.getFilters()` | Get current filter state from DOM |

### Shared State on `D`
| Property | Type | Purpose |
|----------|------|---------|
| `D.showYoY` | bool | YoY toggle (read/write) |
| `D.showExecYoY` | bool | Executive YoY toggle (read/write) |
| `D.activeSection` | string | Currently visible section ID |
| `D.activeFinTab` | string | Financial sub-tab: "recognized" or "invoiced" |
| `D.chartViewMode` | object | Chart ID → "bar" or "trend" |
| `D.forecast` | object | Forecast engine: `.compute()`, `.renderSection()`, `.renderDisplay()`, `.renderChart()` |

## Danger Zones

### 1. Executive Section — DO NOT MODIFY unless explicitly asked
The executive section has been broken twice by unrelated changes. It has complex interdependencies (budget scenarios, forecast sliders, narrative generation). Only touch `executive.js` when the user specifically asks for executive changes.

### 2. Owner Cost Override
In `transform.py`, 3 owners (Johan VDC, Johan VT, Michel) have a flat EUR 15K/month cost override. This affects ALL downstream calculations (margin, ROI, cost/hr). If you change this, verify every section.

### 3. Service Mapping Chain
`time_entry → service → deal → company` — this is how client names are resolved. If Productive changes service structures, the enrichment in `transform.py` breaks silently.

### 4. DATA Key Changes
If you rename a key in `analyse.py`'s `get_dashboard_data()`, you must grep ALL `docs/js/*.js` files for that key. Multiple section files may reference the same DATA keys.

### 5. Metric Definitions
Always check `skills/business-analyst.md` before changing any metric calculation. All definitions are confirmed there. Never assume.

## Pre-flight Checklist
- Before editing a section JS file → read it + read `core.js` for shared utils
- Before changing DATA keys in `analyse.py` → `grep -r "key_name" docs/js/`
- Before visual redesign → backup with `.bak` extension
- **After removing ANY HTML container** → grep all `docs/js/*.js` for that ID and remove dead JS references
- After any change → rebuild (`python3 scripts/build_dashboard.py`) and check for orphan warnings + visually verify

## Iterative Improvement
Use `@skill-creator` to review and improve the skills in this project. The workflow is:
1. Use the BI system, notice gaps or ambiguities
2. Run skill-creator to evaluate and improve the relevant skill file
3. Test the improved skill by running the pipeline again
4. Repeat
