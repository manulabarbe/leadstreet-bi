# Business Analyst — Metrics, Reports & Forecasting

## Critical Rules

### 1. Never Use Productive's Built-in Aggregates
Productive has built-in reports, forecast fields, and computed metrics. **Do not use them.**
All metrics are computed from the most granular raw data: individual `time_entries`, deal-level financials. We own every calculation.

### 2. Always Confirm Metric Definitions With the User
Before implementing ANY new metric, **stop and ask the user** to confirm.
Productive fields are semantically ambiguous. Don't guess.

### 3. Document Every Confirmed Definition
This file contains all confirmed definitions as of 2026-03-19.

---

## How Productive Calculates Revenue

Understanding this is critical for interpreting the numbers:

- **T&M services** (`billing_type_id=2`): Revenue = recognized hours x price/hour. Recognized as work is done.
- **Fixed services** (`billing_type_id=1`): Revenue = fixed amount. Recognized proportionally as time/expenses are tracked and approved. Open budgets do NOT recognize remaining. Delivered budgets recognize remaining on end date.
- **Non-billable** (`billing_type_id=3`): Revenue = EUR 0. Only costs tracked.
- **Billable time** = hours that CAN be billed. **Recognized time** = hours that WILL generate revenue (respects budget caps). Difference: ~235h.

LeadStreet settings: "Recognized when time/expenses are approved", open budgets = do not recognize remaining, delivered = end date.

---

## Confirmed Metric Definitions (2026-03-19)

### 1. Financial Report

| Metric | Formula | Annotation |
|--------|---------|------------|
| **Revenue (Recognized)** | `deal.revenue / 100` from Productive | Reflects T&M + fixed-price recognition rules. Open budgets don't recognize remaining. |
| **Staff Cost** | `time_entry.work_cost / 100` (salary-based) | Excludes overhead. Owners overridden to EUR 15K/month flat. |
| **Gross Margin** | Revenue - Staff Cost | Named "Gross Margin (excl. overhead)" to clarify. |
| **Gross Margin %** | Gross Margin / Revenue x 100 | |
| **EOY Forecast** | Actuals YTD + (trailing 3-month avg x remaining months) | With H2 2025 seasonality adjustment. Early 2025 data unreliable. |

Revenue comes from deal-level data (not time entries). Cost comes from time entries (has the owner override applied).

### 2. People Report

| Metric | Formula | Annotation |
|--------|---------|------------|
| **Billable Utilisation %** | `billable_hours / total_tracked_hours` per person | Denominator = all logged time. Everyone logs billable + non-billable hours. Contractors may not track full days. |
| **Avg Staff Cost/Hour** | `sum(work_cost) / sum(hours)` per person | Owners: EUR 15K/month / monthly hours. |
| **Total Hours** | `sum(hours)` per person per period | |
| **Team** | From teams API | Management, Contractos PH, Contractors BE, Contractors EU, Payroll BE, Finance |

Owner override: Johan Vandecasteele, Johan Vantomme, Michel Antonise (agency owners) → EUR 15,000/month flat cost, distributed proportionally across their entries.

### 3. Project Report

| Metric | Formula | Annotation |
|--------|---------|------------|
| **Budget Burn (hours)** | `worked_hours / budgeted_hours x 100` | |
| **Budget Burn (EUR)** | `cost / budget_total x 100` | |
| **Overbudget Flag** | Green <70%, Amber 70-100%, Red >100% | Dual check: hours AND EUR. Either triggers the flag. Early warning at 70%. |
| **ACPH** | `staff_cost / total_hours` by service type | All 11 service types. |
| **ARPH** | `revenue / billable_hours` by service type | Side-by-side with ACPH. Gap = margin per hour. |

### 4. Client Report

| Metric | Formula | Annotation |
|--------|---------|------------|
| **Revenue by client** | Sum of deal.revenue grouped by company | |
| **Staff Cost by client** | Sum of work_cost from time entries grouped by client | |
| **Gross Margin by client** | Revenue - Staff Cost per client | |
| **Overbudget count** | # of amber + red flagged deals per client | |
| **Client ACPH** | Staff cost / hours per client | |
| **Client ARPH** | Revenue / billable hours per client | |

### 5. Hygiene Report (full suite)

| Check | Definition |
|-------|-----------|
| **Missing notes** | `note is null OR note.strip() == ""` — per month, per person |
| **Zero-hour entries** | `time == 0` |
| **Unapproved entries** | `approved == false` — blocks invoicing |
| **Overspend tracking** | Non-billable entries on services with "overspend/overrun" in name |
| **Missing service type** | Entries without `service_type` |
| **Per-person breakdown** | All checks grouped by person — for coaching |

---

## Dimensions

All reports are sliceable by:

| Dimension | Source |
|-----------|--------|
| Client | Via service → deal → company chain |
| Service type | 11 types (from service_type relationship) |
| Person | `time_entries.person` |
| Team | Management, Contractos PH, Contractors BE, Contractors EU, Payroll BE, Finance |
| Month | From `time_entries.date` |
| Deal | `time_entries → service → deal` |

---

## Data Chain

Time entries don't link directly to projects. The chain is:

```
time_entry → service → deal → company (client)
                     → service_type
```

This enrichment is done in `transform.py` via `load_service_mapping()`.

---

## Service Types (from SOP)

| Service Type | Scope |
|-------------|-------|
| PERF - SEO, SAO, GTM, GA4, Cookie | Digital performance marketing |
| DEV - HubSpot UI, Logic | Automation, logic, advanced HubSpot UI setup |
| DEV - Website & HubSpot CMS | Front-end dev, landing pages, CMS |
| DEV - Apps & Custom | Backend, API, integrations |
| CON - Data Migration & Sync | CRM data imports, syncs, cleanup |
| CON - Consultancy | Strategic/tactical advisory |
| ONB - leadstreet | Direct HubSpot onboarding |
| ONB - HubSpot ONB | HubSpot partner onboarding |
| LS - Apps & Marketplace | Internal tools (Pocketknife, GEO Store) |
| INTERN - Internal | Non-client ops, meetings, hiring, SOPs |
| Expenses | Directly allocated client expenses |

Important: Internal meetings ABOUT client work should be logged to the CLIENT, not INTERN.

---

## Team Structure

| Team | Role | People |
|------|------|--------|
| Management | Agency owners + PM | Johan VDC, Johan VT, Michel, Hilde |
| Contractos PH | Philippines contractors | 9 people |
| Contractors BE | Belgian contractors | 3 people |
| Contractors EU - not BE | EU contractors outside Belgium | 1 person (Diego) |
| Payroll BE | Belgian payroll | 1 person (Laura) |
| Finance, Admin, Support | Back office | Tim |
