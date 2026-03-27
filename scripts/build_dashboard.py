"""
build_dashboard.py — Generate an interactive HTML dashboard with client-side filtering.

Embeds pre-aggregated data as JSON. Charts are built client-side using Plotly.js
and rebuilt on the fly when the user changes date range, team, or other filters.

CSS and JS are in separate static files under docs/css/ and docs/js/.
Only index.html is generated (HTML skeleton + embedded DATA JSON).

Output: docs/index.html (for GitHub Pages deployment)

Usage:
    python scripts/build_dashboard.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from transform import transform_endpoint
from analyse import get_dashboard_data, COLORS

DOCS_DIR = Path(__file__).parent.parent / "docs"


def build_dashboard():
    """Build the interactive dashboard HTML."""
    print("Loading data...")
    te = transform_endpoint("time_entries")
    deals = transform_endpoint("deals")

    if te is None or deals is None:
        print("ERROR: Missing data snapshots. Run fetch.py first.")
        sys.exit(1)

    print(f"Loaded: {len(te):,} time entries, {len(deals):,} deals")
    print("Computing dashboard data...")

    data = get_dashboard_data(te, deals)
    data_json = json.dumps(data)
    today = datetime.now().strftime("%Y-%m-%d")

    # Get month range for date pickers
    months = sorted(r["month"] for r in data["financial_monthly"])
    min_month = "2025-01"  # reporting starts Jan 2025
    max_month = months[-1][:7] if months else "2026-12"

    # Get unique teams for filter
    teams = sorted(set(r["team"] for r in data["people_monthly"] if r.get("team")))

    nav_sections = [
        ("executive", "Executive"),
        ("financial", "Financial"),
        ("people", "People"),
        ("project", "Service Type"),
        ("client", "Client"),
        ("hygiene", "Hygiene"),
        ("analysis", "Analysis"),
    ]
    nav_items = []
    for sid, label in nav_sections:
        active = " active" if sid == "executive" else ""
        nav_items.append(
            f'<button class="nav-item{active}" '
            f"onclick=\"showSection('{sid}', this)\">"
            f"{label}"
            f"</button>"
        )
    nav_html = "\n            ".join(nav_items)

    team_checkboxes = "\n".join(
        f'<label class="filter-check"><input type="checkbox" value="{t}" checked onchange="applyFilters()"> {t}'
        f'<span class="only-btn" onclick="event.preventDefault();onlyFilter(\'team-filters\',\'{t}\')">only</span></label>'
        for t in teams
    )

    flag_toggles = "\n".join(
        f'<label class="filter-check"><input type="checkbox" value="{f}" checked onchange="applyFilters()"> '
        f'<span style="color:{c}">{f}</span>'
        f'<span class="only-btn" onclick="event.preventDefault();onlyFilter(\'flag-filters\',\'{f}\')">only</span></label>'
        for f, c in [("GREEN", COLORS["on_track"]), ("AMBER", COLORS["warning"]), ("RED", COLORS["overbudget"])]
    )

    cb = int(datetime.now().timestamp())  # cache-busting version

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LeadStreet BI Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/dashboard.css?v={cb}">
<script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-header"><h1>LeadStreet BI</h1><div class="sub">Business Intelligence</div><button class="sidebar-close" onclick="toggleSidebar()">&times;</button></div>
  <nav>{nav_html}</nav>
  <div class="sidebar-footer">Last updated {today}</div>
</div>
<div class="sidebar-overlay" onclick="toggleSidebar()"></div>
<div class="main">

  <button class="sidebar-toggle" onclick="toggleSidebar()">&#9776;</button>

  <!-- Global filter bar -->
  <div class="filter-bar" id="global-filters">
    <div class="filter-bar-summary" onclick="toggleFilterBar()"><span id="filter-summary-text">Filters</span><span class="filter-bar-chevron">&#9660;</span></div>
    <div class="filter-bar-content">
      <label>From</label><input type="month" id="start-month" value="{min_month}" min="{min_month}" max="{max_month}" onchange="applyFilters()">
      <label>To</label><input type="month" id="end-month" value="{max_month}" min="{min_month}" max="{max_month}" onchange="applyFilters()">
      <button class="preset-btn" onclick="setPreset('ytd')">YTD</button>
      <button class="preset-btn" onclick="setPreset('3m')">3M</button>
      <button class="preset-btn" onclick="setPreset('6m')">6M</button>
      <button class="preset-btn" onclick="setPreset('2025')">2025</button>
      <button class="preset-btn" onclick="setPreset('2026')">2026</button>
      <button class="preset-btn active" onclick="setPreset('all')">All</button>
      <button class="yoy-toggle" id="yoy-toggle" onclick="toggleYoY()">YoY</button>
    </div>
  </div>

  <!-- EXECUTIVE -->
  <section id="section-executive">
    <h2 style="display:flex;align-items:center;gap:12px">Executive Summary &mdash; 2026 <span style="font-size:11px;color:#94A3B8;font-weight:normal;margin-left:8px">YTD excl. current month</span></h2>

    <!-- P&L KPIs -->
    <div id="exec-pnl-kpis" style="margin-bottom:14px"></div>

    <!-- Playground toggle + Forecast Sliders -->
    <div style="margin-top:4px">
      <button id="exec-playground-toggle" class="playground-toggle" onclick="togglePlayground()">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon id="playground-arrow" points="0,0 10,5 0,10"/></svg>
        Playground
      </button>
      <div id="exec-playground-panel" class="forecast-sliders" style="display:none;margin-top:4px">
        <div class="slider-group">
          <label>Utilisation %</label>
          <input type="range" id="exec-slider-util" min="30" max="90" step="1" oninput="updateExecSliders()">
          <div class="slider-val" id="exec-slider-util-val"></div>
        </div>
        <div class="slider-group">
          <label>Avg Billable Rate (&euro;/hr)</label>
          <input type="range" id="exec-slider-rate" min="50" max="200" step="1" oninput="updateExecSliders()">
          <div class="slider-val" id="exec-slider-rate-val"></div>
        </div>
        <div class="slider-group">
          <label>Monthly Team Hours</label>
          <input type="range" id="exec-slider-hours" min="500" max="2500" step="10" oninput="updateExecSliders()">
          <div class="slider-val" id="exec-slider-hours-val"></div>
        </div>
        <button class="slider-reset" onclick="resetExecSliders()">Reset to actuals</button>
      </div>
    </div>
    <div id="exec-slider-narrative" class="forecast-narrative" style="display:none"></div>

    <!-- P&L Chart -->
    <div class="chart-grid">
      <div class="chart-card chart-full">
        <div class="chart-card-header">Revenue &amp; EBITDA: Actual + Forecast vs Budget</div>
        <div id="exec-pnl-chart" style="height:400px"></div>
      </div>
    </div>

    <!-- Operational Alerts -->
    <h3 style="margin:24px 0 8px 0;color:#1A1D21;font-size:16px">Operational Alerts</h3>
    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-card-header" style="color:#DC2626">Clients Losing Money</div>
        <div id="exec-losers-table"></div>
      </div>
      <div class="chart-card">
        <div class="chart-card-header" style="color:#D97706">Clients at 85-95% Budget</div>
        <div id="exec-budget-table"></div>
      </div>
    </div>

    <!-- AI Executive Recap -->
    <div class="exec-ai-section" id="exec-ai-recap">
      <button id="exec-recap-btn" class="exec-recap-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7l-1 4H10l-1-4c-2-1.5-4-4-4-7a7 7 0 0 1 7-7z"/><line x1="10" y1="22" x2="14" y2="22"/></svg>
        Generate Executive Recap
      </button>
      <div id="exec-recap-content" class="exec-recap-content" style="display:none"></div>
    </div>
  </section>

  <!-- FINANCIAL -->
  <section id="section-financial" style="display:none">
    <h2>Financial</h2>
    <div class="tab-bar" id="fin-tabs">
      <button class="tab-btn active" onclick="showFinancialTab('recognized', this)">Recognized Revenue</button>
      <button class="tab-btn" onclick="showFinancialTab('budget', this)">Accounting Revenue</button>
    </div>
    <div class="tab-content active" id="fin-tab-recognized">
      <div class="section-info">Recognized revenue reflects income attributed to each period based on work performed (T&amp;M) or budget progress (fixed-price). Revenue is recorded when earned, not when invoiced.</div>
      <div class="section-context">Productive data only. Excludes HubSpot commission, employer cost loading, and operating expenses.</div>
      <div class="kpi-strip" id="kpi-financial-rec"></div>
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Monthly Revenue vs Budget</div><div style="font-size:11px;color:#5F6B7A;margin-bottom:6px">Revenue and staff cost bars compared to budget revenue target (dashed line). Current month excluded (incomplete data).</div><div id="chart-fin-revenue" style="height:380px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Delivery Margin vs Budget</div><div style="font-size:11px;color:#5F6B7A;margin-bottom:6px">Delivery margin: (recognized revenue &minus; staff cost) / revenue. Excludes HubSpot commission. Compared to budget margin target. Current month excluded.</div><div id="chart-fin-margin" style="height:340px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Margin Drivers</div><div style="font-size:11px;color:#5F6B7A;margin-bottom:6px">What's driving margin each month. Red = hurting margin, green = helping. Values shown relative to period average.</div><div id="chart-fin-margin-drivers" style="height:190px"></div></div>
        <div class="chart-card chart-full" id="margin-bridge-wrapper" style="display:none"><div class="chart-card-header">Margin Bridge &mdash; <span id="margin-bridge-title"></span></div><div style="font-size:11px;color:#5F6B7A;margin-bottom:6px">Click any bar in the Delivery Margin chart to see what changed vs the previous month.</div><div id="chart-fin-margin-bridge" style="height:300px"></div><div id="margin-bridge-details"></div></div>
        <div class="chart-card chart-full" id="yoy-wrapper" style="display:none"><div class="chart-card-header">Year-over-Year</div><div id="chart-fin-yoy" style="height:340px"></div></div>
      </div>

      <div class="export-row"><button class="csv-btn" onclick="exportCSV('financial')">Export Recognized CSV</button></div>
    </div>
    <div class="tab-content" id="fin-tab-budget">
      <div class="section-info">Accounting P&amp;L from Bright Analytics (actuals) with budget targets and year-end forecast. <strong>This tab ignores the date filter.</strong></div>
      <div class="kpi-strip" id="kpi-financial-budget"></div>
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Cumulative Revenue &amp; EBITDA: Actual + Forecast vs Budget</div><div id="chart-fin-budget-cumulative" style="height:380px"></div></div>
      </div>
      <div id="pnl-table-container" style="margin-top:16px"></div>
    </div>
  </section>

  <!-- PEOPLE -->
  <section id="section-people" style="display:none">
    <h2>People</h2>
    <div class="filter-bar"><label>Teams</label><button class="preset-btn" onclick="toggleAllFilters('team-filters',true)">All</button><div class="section-filters" id="team-filters">{team_checkboxes}</div></div>
    <div class="kpi-strip" id="kpi-people"></div>
    <div class="chart-grid">
      <div class="chart-card chart-full"><div class="chart-card-header" style="display:inline">People Landscape</div><div style="display:inline-flex;gap:6px;margin-left:12px;vertical-align:middle;font-size:11px;color:var(--text-muted)"><span style="display:inline-flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:50%;background:#4CAF50;display:inline-block"></span>&ge;60%</span><span style="display:inline-flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:50%;background:#FF9800;display:inline-block"></span>40&ndash;60%</span><span style="display:inline-flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:50%;background:#F44336;display:inline-block"></span>&lt;40%</span><span style="margin-left:6px;display:inline-flex;align-items:center;gap:3px"><span style="width:6px;height:6px;border-radius:50%;border:1px solid #94a3b8;display:inline-block"></span><span style="width:14px;height:14px;border-radius:50%;border:1px solid #94a3b8;display:inline-block"></span> = revenue</span></div><div class="chart-desc">X = total hours worked, Y = utilisation %. Bubble size = revenue generated. <strong>Top-right = your workhorses</strong> (high volume &amp; high efficiency). Bottom-right = high capacity but underutilised.</div><div id="chart-ppl-hours" style="height:500px"></div></div>
      <div class="chart-card"><div class="chart-card-header">Utilisation by Month</div><div class="chart-desc">Team billable % per month vs target.</div><div id="chart-ppl-util-monthly" style="height:300px"></div></div>
      <div class="chart-card"><div class="chart-card-header">Effective Rate by Month</div><div class="chart-desc">Revenue &divide; total hours per month vs target.</div><div id="chart-ppl-effrate-monthly" style="height:300px"></div></div>
      <div class="chart-card"><div class="chart-card-header">Avg Rate by Month</div><div class="chart-desc">Revenue &divide; billable hours per month vs target.</div><div id="chart-ppl-rate-monthly" style="height:300px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header" style="display:inline">Profitability Landscape</div><div style="display:inline-flex;gap:6px;margin-left:12px;vertical-align:middle;font-size:11px;color:var(--text-muted)"><span style="display:inline-flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:50%;background:#4CAF50;display:inline-block"></span>&ge;30%</span><span style="display:inline-flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:50%;background:#FF9800;display:inline-block"></span>0&ndash;30%</span><span style="display:inline-flex;align-items:center;gap:3px"><span style="width:10px;height:10px;border-radius:50%;background:#F44336;display:inline-block"></span>&lt;0%</span><span style="margin-left:6px;display:inline-flex;align-items:center;gap:3px"><span style="width:6px;height:6px;border-radius:50%;border:1px solid #94a3b8;display:inline-block"></span><span style="width:14px;height:14px;border-radius:50%;border:1px solid #94a3b8;display:inline-block"></span> = hours</span></div><div class="chart-desc">X = revenue generated, Y = delivery margin %. Bubble size = total hours worked. <strong>Top-right = high revenue &amp; high margin.</strong> Bottom-right = big revenue but leaking margin.</div><div id="chart-ppl-profit" style="height:500px"></div></div>
      <div class="chart-card chart-full" style="padding:10px 16px 4px;display:flex;align-items:center;gap:16px"><div style="display:flex;align-items:center;gap:4px"><button class="yoy-toggle" id="hm-view-individual" onclick="setPeopleHeatmapView('individual')">Individual</button><button class="yoy-toggle active" id="hm-view-team" onclick="setPeopleHeatmapView('team')">Team</button></div><div id="heatmap-team-filter-wrapper"><label style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-right:8px">Filter team</label><select id="heatmap-team-select" onchange="renderAllPeopleHeatmaps()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit;color:var(--text-primary);background:var(--surface)"><option value="">All Teams</option></select></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header" data-hm-title="Utilisation">Utilisation by Person &mdash; Monthly</div><div class="chart-desc">Billable &divide; total hours per month. Green &ge;80%, amber 40&ndash;80%, red &lt;40%. Click a person to open in Productive.</div><div id="chart-ppl-util-heatmap" style="height:450px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header" data-hm-title="Effective Rate">Effective Rate by Person &mdash; Monthly</div><div class="chart-desc">Revenue &divide; total hours per month. Click a person to open in Productive.</div><div id="chart-ppl-effrate-heatmap" style="height:450px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header" data-hm-title="Avg Cost/Hr">Avg Cost/Hr by Person &mdash; Monthly</div><div class="chart-desc">Staff cost &divide; total hours. Lower = cheaper. Red = expensive.</div><div id="chart-ppl-cost-heatmap" style="height:450px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header" data-hm-title="Avg Rate">Avg Rate by Person &mdash; Monthly</div><div class="chart-desc">Revenue &divide; billable hours per month.</div><div id="chart-ppl-avgrate-heatmap" style="height:450px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header" data-hm-title="Delivery Margin %">Delivery Margin % by Person &mdash; Monthly</div><div class="chart-desc">(Revenue &minus; staff cost) &divide; revenue per month.</div><div id="chart-ppl-margin-heatmap" style="height:450px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header" data-hm-title="Delivery Margin &euro;">Delivery Margin &euro; by Person &mdash; Monthly</div><div class="chart-desc">Revenue &minus; staff cost per month (absolute).</div><div id="chart-ppl-margin-eur-heatmap" style="height:450px"></div></div>
    </div>
    <div class="export-row"><button class="csv-btn" onclick="exportCSV('people')">Export People CSV</button></div>
  </section>

  <!-- PROJECT -->
  <section id="section-project" style="display:none">
    <h2>Service Type</h2>
    <div style="margin:-8px 0 12px 0"><label style="font-size:12px;color:var(--text-secondary);cursor:pointer;display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="toggle-ls-apps" onchange="toggleLsApps(this.checked)" style="accent-color:var(--accent)"> Include LS - Apps &amp; Marketplace (R&amp;D)</label></div>
    <div class="kpi-strip" id="kpi-project"></div>
    <div class="chart-grid">
      <div class="chart-card chart-full"><div class="chart-card-header">Service Type Landscape</div><div class="chart-desc">Revenue vs delivery margin %. Bubble size = total hours. Top-right = high-value, high-margin services.</div><div id="chart-svc-scatter" style="height:450px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header" style="display:inline">Service Type Evolution</div><div style="display:inline-flex;gap:4px;margin-left:12px;vertical-align:middle"><button class="metric-toggle active" data-heatmetric="revenue" onclick="switchSvcHeatMetric(this)">Revenue</button><button class="metric-toggle" data-heatmetric="margin" onclick="switchSvcHeatMetric(this)">Margin &euro;</button><button class="metric-toggle" data-heatmetric="marginpct" onclick="switchSvcHeatMetric(this)">Margin %</button></div><div class="chart-desc">Monthly performance by service type. Darker = higher value.</div><div id="chart-svc-heatmap" style="min-height:300px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Delivery Margin by Service Type (&euro;)</div><div class="chart-desc">Absolute profit per service type: revenue minus staff cost.</div><div id="chart-svc-margin-abs" style="height:350px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Delivery Margin by Service Type (%)</div><button class="chart-toggle" data-chart="chart-svc-roi" data-metric="roi" onclick="toggleChartView(this)" title="Toggle trend view"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,10 4,6 7,8 10,3 13,5"/></svg></button><div class="chart-desc">(Revenue &minus; staff cost) &divide; revenue per service type.</div><div id="chart-svc-roi" style="height:350px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Effective Rate by Service Type</div><button class="chart-toggle" data-chart="chart-svc-effrate" data-metric="effrate" onclick="toggleChartView(this)" title="Toggle trend view"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,10 4,6 7,8 10,3 13,5"/></svg></button><div class="chart-desc">Revenue &divide; total hours worked. What you actually earn per hour of effort. &#9670; = budget target rate.</div><div id="chart-svc-effrate" style="height:350px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Avg Rate by Service Type</div><button class="chart-toggle" data-chart="chart-svc-arph" data-metric="arph" onclick="toggleChartView(this)" title="Toggle trend view"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,10 4,6 7,8 10,3 13,5"/></svg></button><div class="chart-desc">Revenue &divide; billable hours only. The rate you charge, ignoring unbilled effort. &#9670; = budget target rate.</div><div id="chart-svc-arph" style="height:350px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Avg Cost/Hr by Service Type</div><button class="chart-toggle" data-chart="chart-svc-acph" data-metric="acph" onclick="toggleChartView(this)" title="Toggle trend view"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,10 4,6 7,8 10,3 13,5"/></svg></button><div class="chart-desc">Staff cost per hour per service type.</div><div id="chart-svc-acph" style="height:350px"></div></div>
    </div>
    <div class="export-row"><button class="csv-btn" onclick="exportCSV('project')">Export Project CSV</button></div>
  </section>

  <!-- CLIENT -->
  <section id="section-client" style="display:none">
    <h2>Client</h2>
    <div class="kpi-strip" id="kpi-client"></div>
    <div id="contingent-explainer" style="margin:8px 0 4px;display:none">
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;font-size:11px;color:#92400E;line-height:1.6">
        <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
          <div><strong>Contingent revenue detected.</strong> Some clients have pre-invoiced hour banks inflating their margins. <span id="contingent-info" style="color:#B45309"></span></div>
          <button onclick="var d=document.getElementById('contingent-detail');d.style.display=d.style.display==='none'?'block':'none';this.textContent=d.style.display==='none'?'Learn more \u25BC':'Hide \u25B2'" style="background:none;border:1px solid #D97706;color:#B45309;border-radius:4px;padding:2px 10px;font-size:10px;cursor:pointer;white-space:nowrap;margin-left:12px">Learn more &#9660;</button>
        </div>
        <div id="contingent-detail" style="display:none;padding:0 14px 14px;border-top:1px solid #FDE68A">
          <h4 style="margin:12px 0 6px;font-size:12px;color:#92400E">What are contingenten?</h4>
          <p style="margin:0 0 8px">Contingenten are <strong>pre-invoiced hour banks</strong> (also called retainers or prepaid blocks). The client pays upfront for a block of hours, and LeadStreet delivers work against that balance over time. Examples: Cegeka Groep, Atradius, Modular, nexuzhealth, Lease-Broker, etc.</p>

          <h4 style="margin:12px 0 6px;font-size:12px;color:#92400E">Why do they cause a problem?</h4>
          <p style="margin:0 0 8px">In Productive, these deals are set up as <strong>fixed-price budgets</strong> (billing type 1). Productive recognises the <strong>full budget as revenue</strong> as soon as the deal is created &mdash; even if zero hours have been worked. This means a client with a &euro;30,000 contingent and only 128 of 300 hours delivered shows &euro;30K revenue, when in reality only ~&euro;12.8K has been earned (128h &times; &euro;100/hr).</p>
          <p style="margin:0 0 8px">This inflates <strong>delivery margin, effective rate, ARPH,</strong> and <strong>absolute profit</strong> for those clients. It makes contingent clients look artificially profitable.</p>
          <p style="margin:0 0 8px">The opposite also happens: clients that <strong>over-consumed</strong> their contingent (e.g. Cafca, Liantis) show negative remaining &mdash; meaning more hours were delivered than paid for.</p>

          <h4 style="margin:12px 0 6px;font-size:12px;color:#92400E">How do we identify contingent clients?</h4>
          <p style="margin:0 0 8px">The <strong>source of truth</strong> is the contingenten Excel file (<code>260326 2026-2025-2024-2023-2022-2021-contingenten.xlsx</code>, 2026 tab). This file is maintained manually and tracks:</p>
          <ul style="margin:0 0 8px;padding-left:20px">
            <li><strong>Contingent</strong> &mdash; the total pre-invoiced amount per client</li>
            <li><strong>Consumed</strong> &mdash; how much has been &ldquo;used up&rdquo; via fake internal invoices</li>
            <li><strong>Remaining</strong> &mdash; the unearned balance (contingent minus consumed)</li>
          </ul>
          <p style="margin:0 0 8px">The dashboard reads this Excel automatically when rebuilding. Each Excel entry is mapped to a Productive company name via a keyword mapping in <code>analyse.py</code> (<code>_CONTINGENT_ENTRY_MAP</code>). When the Excel changes (new clients, updated balances), rebuild the dashboard to sync.</p>

          <h4 style="margin:12px 0 6px;font-size:12px;color:#92400E">What does the &ldquo;Adjust&rdquo; toggle do?</h4>
          <p style="margin:0 0 8px">When enabled, it <strong>subtracts the unearned remaining balance</strong> (from the Excel) from each contingent client&rsquo;s revenue. This affects <strong>every chart</strong> in the Client tab: KPI cards, bar charts, scatter plot, and revenue leaks.</p>
          <ul style="margin:0 0 8px;padding-left:20px">
            <li><strong>Revenue</strong> drops &mdash; we remove the unearned portion</li>
            <li><strong>Costs stay the same</strong> &mdash; staff costs come from real time entries (actual hours worked), so they are already correct</li>
            <li><strong>Margin drops</strong> &mdash; because we removed pure &ldquo;phantom&rdquo; revenue that had no matching cost</li>
            <li>Clients with <strong>negative remaining</strong> (over-consumed) are not adjusted &mdash; their revenue stays as-is</li>
          </ul>
          <p style="margin:0 0 8px">Mathematically: <code>adjusted revenue = revenue &minus; Excel remaining</code> (clipped at &euro;0).</p>

          <h4 style="margin:12px 0 6px;font-size:12px;color:#92400E">Visual indicators</h4>
          <ul style="margin:0 0 8px;padding-left:20px">
            <li><strong>Dashed border</strong> on scatter bubbles = contingent client</li>
            <li><strong>Tooltip</strong> shows the remaining balance from the Excel (or &ldquo;over-consumed&rdquo; if negative)</li>
          </ul>

          <h4 style="margin:12px 0 6px;font-size:12px;color:#92400E">Maintenance</h4>
          <p style="margin:0 0 4px">When the contingenten Excel is updated:</p>
          <ol style="margin:0 0 8px;padding-left:20px">
            <li>Save the updated Excel to the OneDrive folder (same location, or update the filename in <code>analyse.py</code>)</li>
            <li>If new clients were added, update the <code>_CONTINGENT_ENTRY_MAP</code> in <code>analyse.py</code> with the keyword &rarr; Productive company name mapping</li>
            <li>Rebuild: <code>python3 scripts/build_dashboard.py</code></li>
          </ol>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin:6px 0 12px"><label style="font-size:12px;color:#5F6B7A;cursor:pointer;display:flex;align-items:center;gap:5px"><input type="checkbox" id="contingent-toggle"> <strong>Adjust for unearned contingent revenue</strong></label></div>
    <div class="chart-grid">
      <div class="chart-card chart-full"><div class="chart-card-header">Margin Landscape</div><div class="chart-desc">Absolute profit vs margin %. Top-right = high-value, high-margin clients. Bubble size = revenue. Red = negative margin, amber = 0&ndash;40%, green = &gt;40%.</div><div id="chart-cli-margin-scatter" style="height:450px"></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Delivery Margin by Client (&euro;)</div><div class="chart-desc">Absolute profit per client: revenue &minus; staff cost.</div><div id="chart-cli-margin-abs" style="height:350px"></div><div class="chart-pager" id="chart-cli-margin-abs-pager"><button class="pg-prev" onclick="cliPages['chart-cli-margin-abs'].page--;renderCliPage('chart-cli-margin-abs')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-cli-margin-abs'].page++;renderCliPage('chart-cli-margin-abs')">&rsaquo;</button></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Delivery Margin by Client (%)</div><div class="chart-desc">(Revenue &minus; staff cost) &divide; revenue per client.</div><div id="chart-cli-roi" style="height:350px"></div><div class="chart-pager" id="chart-cli-roi-pager"><button class="pg-prev" onclick="cliPages['chart-cli-roi'].page--;renderCliPage('chart-cli-roi')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-cli-roi'].page++;renderCliPage('chart-cli-roi')">&rsaquo;</button></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Effective Hourly Rate by Client</div><div class="chart-desc">Revenue &divide; total hours worked. What you actually earn per hour of effort. &#9670; = budget target rate.</div><div id="chart-cli-util" style="height:350px"></div><div class="chart-pager" id="chart-cli-util-pager"><button class="pg-prev" onclick="cliPages['chart-cli-util'].page--;renderCliPage('chart-cli-util')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-cli-util'].page++;renderCliPage('chart-cli-util')">&rsaquo;</button></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Average Hourly Rate by Client</div><div class="chart-desc">Revenue &divide; billable hours only. The rate you charge, ignoring unbilled effort. &#9670; = budget target rate.</div><div id="chart-cli-arph" style="height:350px"></div><div class="chart-pager" id="chart-cli-arph-pager"><button class="pg-prev" onclick="cliPages['chart-cli-arph'].page--;renderCliPage('chart-cli-arph')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-cli-arph'].page++;renderCliPage('chart-cli-arph')">&rsaquo;</button></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Avg Cost/Hr by Client</div><div class="chart-desc">Staff cost per hour per client.</div><div id="chart-cli-acph" style="height:350px"></div><div class="chart-pager" id="chart-cli-acph-pager"><button class="pg-prev" onclick="cliPages['chart-cli-acph'].page--;renderCliPage('chart-cli-acph')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-cli-acph'].page++;renderCliPage('chart-cli-acph')">&rsaquo;</button></div></div>
      <div class="chart-card chart-full"><div class="chart-card-header">Hours by Client</div><div class="chart-desc">Billable vs non-billable % per client.</div><div id="chart-cli-hours" style="height:350px"></div><div class="chart-pager" id="chart-cli-hours-pager"><button class="pg-prev" onclick="cliPages['chart-cli-hours'].page--;renderCliPage('chart-cli-hours')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-cli-hours'].page++;renderCliPage('chart-cli-hours')">&rsaquo;</button></div></div>
      <div class="chart-card chart-full" id="cli-revenue-leaks"></div>
    </div>
    <div class="export-row"><button class="csv-btn" onclick="exportCSV('client')">Export Client CSV</button></div>
  </section>

  <!-- HYGIENE -->
  <section id="section-hygiene" style="display:none">
    <h2>Data Health</h2>
    <div class="kpi-strip" id="kpi-hygiene"></div>

    <div class="tab-bar" id="hygiene-tabs">
      <button class="tab-btn active" onclick="showHygieneTab('budgets',this)">Budget Audit</button>
      <button class="tab-btn" onclick="showHygieneTab('pso',this)">PSO Health</button>
      <button class="tab-btn" onclick="showHygieneTab('billability',this)">(Non)-Billability Checker</button>
      <button class="tab-btn" onclick="showHygieneTab('scorecard',this)">Note Compliance</button>
    </div>

    <!-- Scorecard sub-tab -->
    <div class="tab-content" id="hyg-tab-scorecard">
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Note Compliance Trend</div><div id="chart-hyg-trend" style="height:280px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Person Scorecard &mdash; Note Compliance by Month</div><div class="chart-desc">Green &ge;80%, amber 50&ndash;80%, red &lt;50%.</div><div id="chart-scorecard-heatmap" style="height:450px"></div></div>
      </div>
    </div>

    <!-- Budget Audit sub-tab -->
    <div class="tab-content active" id="hyg-tab-budgets">
      <div class="section-info">Deals with missing or placeholder budgets, ranked by hours worked. These create false overbudget flags and prevent meaningful budget tracking.</div>
      <div class="kpi-strip" id="kpi-budget-audit"></div>
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Consider Adding an Overspend Service</div><div class="chart-desc">Scoped T&amp;M budgets (excl. retainers) without a non-billable overspend service. Click to fix in Productive.</div><div id="chart-missing-overspend" style="height:400px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Consider Assigning a Service Type</div><div class="chart-desc">Entries without a service type, breaking service-level analysis. Click to fix in Productive.</div><div id="chart-missing-stype" style="height:300px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Consider Switching These T&amp;M Services to Hours</div><div class="chart-desc">Time &amp; Materials services using &ldquo;pieces&rdquo; instead of &ldquo;hours&rdquo; for quantity. Click to fix in Productive.</div><div id="chart-wrong-unit"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Consider Setting These Overspend Lines to Non-Billable</div><div class="chart-desc">Overspend or out-of-scope service lines that should be Non-billable but are set to T&amp;M or Fixed. Click to fix in Productive.</div><div id="chart-wrong-billing"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Consider Closing These Budgets</div><div class="chart-desc">Open budgets with no recent activity. Shows last activity date. Click to open in Productive.</div><div id="chart-stale-budgets" style="height:350px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Consider Setting a Budget for These Deals</div><div class="chart-desc">Deals with 0h/0&euro; budget but significant worked hours. Click to fix in Productive.</div><div id="chart-budget-audit" style="height:400px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Consider Updating These Placeholder Budgets</div><div class="chart-desc">Deals with tiny budgets (&le;2h) that are clearly placeholders. Click to fix in Productive.</div><div id="chart-budget-placeholder" style="height:400px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Consider Reviewing Time on These Closed Budgets</div><div class="chart-desc">Time logged after the budget was closed. Click to open in Productive.</div><div id="chart-closed-activity" style="height:350px"></div></div>
      </div>
    </div>

    <!-- PSO Health sub-tab -->
    <div class="tab-content" id="hyg-tab-pso">
      <div class="section-info">HubSpot Partner Services Onboarding (PSO) deals: structural compliance, overbudget, and cap monitoring. PSO deals should have exactly 2 services (Open hours + Overspent non-billable).</div>
      <div class="kpi-strip" id="kpi-pso"></div>
      <h3 style="margin:16px 0 8px;font-size:15px;color:#1A1D21">Active PSOs</h3>
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Active PSO Budget Burn</div><div class="chart-desc">Open PSO deals: hours consumed vs budgeted. Red &gt;100%, amber 70&ndash;100%. Click a bar to open in Productive.</div><div id="chart-pso-burn-active" style="height:400px"></div><div class="chart-pager" id="chart-pso-burn-active-pager"><button class="pg-prev" onclick="cliPages['chart-pso-burn-active'].page--;renderCliPage('chart-pso-burn-active')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-pso-burn-active'].page++;renderCliPage('chart-pso-burn-active')">&rsaquo;</button></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Active PSO Issues</div><div class="chart-desc">Structural issues on open PSOs: missing overspend, wrong service count, billable overspend, cap hit. Click a bar to open in Productive.</div><div id="chart-pso-issues-active" style="height:400px"></div><div class="chart-pager" id="chart-pso-issues-active-pager"><button class="pg-prev" onclick="cliPages['chart-pso-issues-active'].page--;renderCliPage('chart-pso-issues-active')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-pso-issues-active'].page++;renderCliPage('chart-pso-issues-active')">&rsaquo;</button></div></div>
      </div>
      <h3 style="margin:24px 0 8px;font-size:15px;color:#1A1D21">Closed PSOs</h3>
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Closed PSO Budget Burn</div><div class="chart-desc">Completed PSO deals: final hours consumed vs budgeted. Historical performance record.</div><div id="chart-pso-burn-closed" style="height:400px"></div><div class="chart-pager" id="chart-pso-burn-closed-pager"><button class="pg-prev" onclick="cliPages['chart-pso-burn-closed'].page--;renderCliPage('chart-pso-burn-closed')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-pso-burn-closed'].page++;renderCliPage('chart-pso-burn-closed')">&rsaquo;</button></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Closed PSO Issues</div><div class="chart-desc">Structural issues on closed PSOs. Historical record &mdash; no longer actionable.</div><div id="chart-pso-issues-closed" style="height:400px"></div><div class="chart-pager" id="chart-pso-issues-closed-pager"><button class="pg-prev" onclick="cliPages['chart-pso-issues-closed'].page--;renderCliPage('chart-pso-issues-closed')">&lsaquo;</button><span class="pg-label"></span><button class="pg-next" onclick="cliPages['chart-pso-issues-closed'].page++;renderCliPage('chart-pso-issues-closed')">&rsaquo;</button></div></div>
      </div>
    </div>

    <!-- (Non)-Billability Checker sub-tab -->
    <div class="tab-content" id="hyg-tab-billability">
      <div class="section-info">Non-billable time entries per colleague. Click a person to see their entries. Use this to spot misclassified time that should be billable.</div>
      <div id="billability-person-list"></div>
      <div id="billability-detail-panel" style="display:none;margin-top:12px">
        <div id="billability-detail-header" style="font-weight:600;font-size:14px;margin-bottom:6px"></div>
        <div id="billability-detail-table"></div>
        <div id="billability-pagination" style="margin-top:8px;font-size:12px"></div>
      </div>
    </div>

    <div class="export-row">
      <button class="csv-btn" onclick="exportCSV('hygiene')">Export Note Compliance CSV</button>
      <button class="csv-btn" onclick="exportCSV('budget_audit')">Export Budget Audit CSV</button>
      <button class="csv-btn" onclick="exportCSV('pso_health')">Export PSO CSV</button>
      <button class="csv-btn" onclick="exportCSV('billability')">Export Billability CSV</button>
    </div>
  </section>

  <!-- ANALYSIS -->
  <section id="section-analysis" style="display:none">
    <h2>Analysis</h2>
    <p style="color:#6B7280;font-size:13px;margin:-8px 0 16px 0">Interactive scatter &amp; bubble plots to surface outliers and insights. Hover for details, use the date filter to change the period.</p>
    <div class="tab-bar" id="analysis-tabs">
      <button class="tab-btn active" onclick="showAnalysisTab('people',this)">People</button>
      <button class="tab-btn" onclick="showAnalysisTab('client',this)">Client</button>
      <button class="tab-btn" onclick="showAnalysisTab('stype',this)">Service Type</button>
      <button class="tab-btn" onclick="showAnalysisTab('cross',this)">Cross-Dimensional</button>
    </div>
    <div class="tab-content active" id="analysis-tab-people" style="display:block">
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Efficiency Frontier &mdash; Utilisation vs Effective Rate</div><div class="chart-desc">Who is both busy AND valuable? Top-right = stars. The frontier line connects best performers. Bubble size = total hours.</div><div id="chart-analysis-efficiency-frontier" style="height:450px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Cost-Revenue Parity</div><div class="chart-desc">Does each person generate more than they cost? Dots above the diagonal are profitable; below = underwater. Bubble size = hours worked.</div><div id="chart-analysis-cost-revenue" style="height:450px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Busyness vs Discipline</div><div class="chart-desc">Are the busiest people also the sloppiest with notes? Top-right = dream team (busy + disciplined). Bubble size = revenue.</div><div id="chart-analysis-busy-discipline" style="height:400px"></div></div>
      </div>
    </div>
    <div class="tab-content" id="analysis-tab-client">
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Strategic Quadrant &mdash; Revenue vs Margin</div><div class="chart-desc">BCG-style 2&times;2. Stars (top-right), Hidden Gems (top-left), Attention Needed (bottom-right), Drains (bottom-left). Bubble size = hours invested.</div><div id="chart-analysis-strategic-quad" style="height:500px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Time Sink Detector &mdash; Hours vs Revenue</div><div class="chart-desc">The diagonal shows the average effective rate. Clients below the line give you less &euro; per hour than average &mdash; they are time sinks.</div><div id="chart-analysis-time-sink" style="height:450px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Revenue Concentration (Pareto Curve)</div><div class="chart-desc">How concentrated is your revenue? The further the curve bows from the diagonal, the more you depend on a few big clients.</div><div id="chart-analysis-pareto" style="height:400px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Revenue vs Deal Health</div><div class="chart-desc">Big clients with lots of overbudget deals = systemic risk. Bubble size = total deals. Red = &gt;50% overbudget, amber = &gt;25%.</div><div id="chart-analysis-rev-health" style="height:450px"></div></div>
      </div>
    </div>
    <div class="tab-content" id="analysis-tab-stype">
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Pricing Power Map &mdash; Volume vs Margin per Hour</div><div class="chart-desc">Top-right = golden services (high volume AND high margin). Bottom-right = lots of work but thin margins &mdash; reprice or automate.</div><div id="chart-analysis-pricing-power" style="height:450px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Cost-Revenue Spread &mdash; ACPH vs Effective Rate</div><div class="chart-desc">Services below the 45&deg; diagonal lose money on every hour. Distance above = profit per hour.</div><div id="chart-analysis-cost-rev-spread" style="height:450px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Overspend by Service Type</div><div class="chart-desc">Which service types regularly blow their budgets? Top-right = high volume AND frequent overspend. Bubble size = total overspend (&euro;). Excludes contingent and open-ended (&lt;2h budgeted) deals.</div><div id="chart-analysis-stype-overspend" style="height:450px"></div></div>
      </div>
    </div>
    <div class="tab-content" id="analysis-tab-cross">
      <div class="chart-grid">
        <div class="chart-card chart-full"><div class="chart-card-header">Scope Creep Radar &mdash; Budgeted vs Actual Hours</div><div class="chart-desc">Every dot above the diagonal = scope creep. The further above, the worse. Color = budget flag (green/amber/red). Bubble size = revenue at stake. Filtered to deals with time logged in the selected period; hours &amp; budget values are all-time.</div><div id="chart-analysis-scope-creep" style="height:500px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Person Effective Rate Heatmap &mdash; by Month</div><div class="chart-desc">Green = high effective rate, red = low. Spot who is improving or declining over time.</div><div id="chart-analysis-heatmap" style="height:500px"></div></div>
        <div class="chart-card chart-full"><div class="chart-card-header">Trajectory Plot &mdash; Utilisation vs Effective Rate Over Time</div><div class="chart-desc">Select a person to see their monthly density hotspot. Warm zones = where they spend most time. Dots = months (blue=early, orange=recent).</div><div style="margin:8px 0"><select id="trajectory-person-select" onchange="updateTrajectoryChart()" style="padding:6px 12px;border:1px solid #E5E7EB;border-radius:6px;font-size:13px;color:#374151;background:#fff;min-width:220px"></select></div><div id="chart-analysis-trajectory" style="height:500px"></div></div>
      </div>
    </div>
  </section>

</div>

<!-- DATA (generated by Python) -->
<script>
var DATA = {data_json};
</script>

<!-- Core + Modules -->
<script src="js/core.js"></script>
<script src="js/d3-charts.js?v={cb}"></script>
<script src="js/forecast.js?v={cb}"></script>
<script src="js/executive.js?v={cb}"></script>
<script src="js/pnl-data.js?v={cb}"></script>
<script src="js/financial.js?v={cb}"></script>
<script src="js/people.js?v={cb}"></script>
<script src="js/service.js?v={cb}"></script>
<script src="js/client.js?v={cb}"></script>
<script src="js/hygiene.js?v={cb}"></script>
<script src="js/analysis.js?v={cb}"></script>
<script>Dashboard.init();</script>
</body>
</html>'''

    # Write output
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DOCS_DIR / "index.html"
    out_path.write_text(html, encoding="utf-8")
    size_kb = out_path.stat().st_size / 1024
    print(f"\nDashboard saved to {out_path} ({size_kb:.0f} KB)")
    print(f"Open with: open {out_path}")

    # --- Post-build: detect orphaned JS references to missing DOM IDs ---
    _validate_dom_references(html, DOCS_DIR)


def _validate_dom_references(html: str, docs_dir):
    """Scan JS files for DOM ID references that don't exist in the generated HTML."""
    import re

    # Extract all id="..." from HTML
    html_ids = set(re.findall(r'id="([^"]+)"', html))

    # Patterns that reference DOM IDs in JS
    js_patterns = [
        re.compile(r'getElementById\(["\']([^"\']+)["\']\)'),
        re.compile(r'setKPIs\(["\']([^"\']+)["\']\s*,'),
        re.compile(r'd3c\.\w+\(["\']([^"\']+)["\']\s*,'),
        re.compile(r'setupCliPager\(["\']([^"\']+)["\']\s*,'),
        re.compile(r'Plotly\.react\(["\']([^"\']+)["\']\s*,'),
    ]

    orphans = []
    js_dir = docs_dir / "js"
    for js_file in sorted(js_dir.glob("*.js")):
        if js_file.name.endswith(".bak"):
            continue
        content = js_file.read_text(encoding="utf-8")
        for pattern in js_patterns:
            for match in pattern.finditer(content):
                ref_id = match.group(1)
                # Skip dynamic IDs (containing variables/concatenation)
                if "+" in ref_id or "{" in ref_id:
                    continue
                # Skip IDs that are likely generated at runtime (bill-grp-*, etc.)
                if ref_id.startswith("bill-grp") or ref_id.startswith("slider-"):
                    continue
                if ref_id not in html_ids:
                    orphans.append((js_file.name, ref_id))

    if orphans:
        print(f"\n⚠  Orphaned DOM references ({len(orphans)} found):")
        for fname, ref_id in orphans:
            print(f"   {fname} → #{ref_id} (not in HTML)")
        print("   These JS references point to DOM elements that don't exist.")
        print("   Remove the dead JS code or add the missing HTML container.\n")
    else:
        print("✓  No orphaned DOM references found.")


if __name__ == "__main__":
    build_dashboard()
