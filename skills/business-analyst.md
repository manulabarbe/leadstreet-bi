# Business Analyst — Metrics, Reports & Forecasting

## Critical Rules

### 1. Never Use Productive's Built-in Aggregates
Productive has built-in reports, forecast fields, and computed metrics. **Do not use them.**
All metrics are computed from the most granular raw data: individual `time_entries`, individual `bookings`, line-item `budgets`. We own every calculation.

### 2. Always Confirm Metric Definitions With the User
Before implementing ANY metric, **stop and ask the user** to confirm:
- The exact formula
- Which source fields to use
- What edge cases to handle

Productive fields are semantically ambiguous. "Revenue" could mean 5 different things. Don't guess.

### 3. Document Every Confirmed Definition
Once the user confirms a metric, add a `# METRIC DEFINITION — confirmed:` comment block in the code with the exact formula and date of confirmation.

---

## Report Categories

### 1. Financial Reports

| Metric | Description | Status |
|--------|-------------|--------|
| Revenue by month | Monthly revenue | **ASK USER: billable hours × rate? Which rate? Or invoiced amount?** |
| Margin by month | Revenue minus costs | **ASK USER: cost = salary? Total cost? Overhead factor?** |
| Year-to-date | Cumulative totals for current year | Derived from monthly figures |
| Year-over-year | Current year vs previous year, same period | Compare month-by-month |
| EOY Forecast | Projected end-of-year totals | Actuals (past) + bookings (future) |

**Forecast logic:**
```
EOY_projection = sum(actuals for past months) + sum(bookings for remaining months)
```
- Past months: use actual `time_entries` data
- Future months: use `bookings` data
- Current month: use actuals up to today + remaining bookings for the month

### 2. People Reports

| Metric | Description | Status |
|--------|-------------|--------|
| Billable utilisation % | How much of a person's time is billable | **ASK USER: denominator = total worked hours? Or available capacity?** |
| Average cost per hour | Cost efficiency per person | **ASK USER: based on salary? Or budget rates?** |
| Total worked hours | Sum of all time entries per person | `sum(time_entries.time) / 60` per person |

**Utilisation formula options (confirm with user):**
```
Option A: billable_hours / total_worked_hours × 100
Option B: billable_hours / available_capacity_hours × 100
```

### 3. Project Reports

| Metric | Description | Status |
|--------|-------------|--------|
| Overbudget flag | Whether project exceeds its budget | **ASK USER: compare hours or cost? What thresholds for amber/red?** |
| ACPH per service type | Average cost per hour by service type | **ASK USER: cost source?** |
| Budget burn rate | Speed of budget consumption | `hours_spent / budget_hours` or `cost_spent / budget_cost` |

**Overbudget flag logic (confirm thresholds with user):**
```
usage_pct = actual_hours / budget_hours × 100
🟢 Green:  usage_pct <= 80%
🟡 Amber:  80% < usage_pct <= 100%
🔴 Red:    usage_pct > 100%
```

### 4. Client Reports

| Metric | Description | Status |
|--------|-------------|--------|
| Profitability by client | Revenue minus cost per client | **ASK USER: same revenue/cost definitions as financial report** |
| Overbudget per client | Aggregated from project-level overbudget | Roll up project flags to client level |

**Client profitability** = sum of all project revenues for client - sum of all project costs for client.

### 5. Hygiene Reports

| Metric | Description | Status |
|--------|-------------|--------|
| Missing notes % | Time entries without a note, per month | `count(entries where note is null or empty) / total entries × 100` |
| Trend | Is hygiene improving or degrading? | Month-over-month comparison |

**Missing notes formula:**
```python
missing_pct = (
    df[df["note"].isna() | (df["note"].str.strip() == "")]
    .groupby("month").size()
    / df.groupby("month").size()
    * 100
)
```

---

## Dimensions

All reports should be sliceable by any combination of:

| Dimension | Source |
|-----------|--------|
| Client | `projects.company` relationship |
| Service type | `time_entries.service` relationship |
| Person | `time_entries.person` relationship |
| Month | Derived from `time_entries.date` |
| Project | `time_entries.project` relationship |

---

## Data Granularity Requirements

Always work with the most atomic records:

| Data | Granularity | Endpoint |
|------|-------------|----------|
| Hours worked | Individual time entry | `time_entries` |
| Future hours | Individual booking | `bookings` |
| Budget amounts | Budget line item | `budgets` |
| Service classification | Per service | `services` |
| Person details | Per person | `people` |
| Client grouping | Via project→company | `projects` + `companies` |

**Never aggregate at the API level.** Fetch all individual records, store them, and aggregate in pandas.

---

## Confirmed Metric Definitions

> This section is populated as the user confirms each metric definition.
> Format: metric name, formula, source fields, confirmed date.

_No metrics confirmed yet. Run the pipeline and ask the user to define each metric before computing it._
