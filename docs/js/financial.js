(function(D) {
  var u = D.utils;
  var C = D.C;
  var DATA = D.DATA;
  var d3c = D.d3;

  // === CHART BUILDERS ===

  function buildFinancialRevenue(containerId, data) {
    var many = data.length > 6;

    // Prepare budget overlay
    var months = data.map(function(r){ return r.month; });
    var budgetData = u.getBudgetForMonths(months);

    // Build flat data for verticalBar
    var chartData = data.map(function(r, i) {
      var row = {
        month: r.month,
        rev: r.revenue,
        cost: r.staff_cost,
        _gm: r.gross_margin || (r.revenue - r.staff_cost)
      };
      var b = budgetData[i];
      row.budget = b ? (b.budget_revenue || 0) : null;
      return row;
    });

    d3c.verticalBar(containerId, chartData, {
      xField: "month",
      series: [
        {field: "rev", label: "Revenue", color: C.revenue},
        {field: "cost", label: "Staff Cost", color: C.cost}
      ],
      barMode: "group",
      lines: [{field: "budget", label: "Budget Revenue", color: C.budget, dash: "6,3"}],
      textOnBars: many ? null : {field: "rev", format: function(v) { return "€" + Math.round(v).toLocaleString(); }},
      tooltipFn: function(d) {
        var gm = d._gm;
        var gmColor = gm >= 0 ? C.profitPos : C.profitNeg;
        var lines = [
          "<div style='font-weight:600;margin-bottom:4px'>" + d.month + "</div>",
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>",
          "<span>Revenue</span><span style='font-weight:600;color:#1A1D21'>€" + Math.round(d.rev).toLocaleString() + "</span>",
          "<span>Staff Cost</span><span style='font-weight:500'>€" + Math.round(d.cost).toLocaleString() + "</span>",
          "<span>Delivery Margin</span><span style='font-weight:600;color:" + gmColor + "'>€" + Math.round(gm).toLocaleString() + "</span>"
        ];
        if (d.budget != null) {
          lines.push("<span>Budget</span><span style='font-weight:500'>€" + Math.round(d.budget).toLocaleString() + "</span>");
        }
        lines.push("</div>");
        return lines.join("");
      },
      yFormat: function(d) { return "€" + d3c.fmtNum(d); },
      yLabel: "EUR",
      margin: {top: 16, right: 50, bottom: many ? 50 : 80, left: 70},
      height: 380
    });
  }

  function buildFinancialMargin(containerId, data) {
    var many = data.length > 6;
    var months = data.map(function(r){ return r.month; });
    var budgetData = u.getBudgetForMonths(months);

    var chartData = data.map(function(r, i) {
      var row = {
        month: r.month,
        margin_pct: r.margin_pct
      };
      var b = budgetData[i];
      row.budget_margin = (b && b.budget_margin_pct != null) ? b.budget_margin_pct : null;
      return row;
    });

    d3c.verticalBar(containerId, chartData, {
      xField: "month",
      series: [{field: "margin_pct", label: "Delivery Margin %", color: C.profitPos}],
      colorFn: function(d) {
        return d.margin_pct >= 0 ? C.profitPos : C.profitNeg;
      },
      lines: [{field: "budget_margin", label: "Budget Margin %", color: C.budget, dash: "6,3"}],
      textOnBars: {
        field: "margin_pct",
        format: function(v) { return (v || 0).toFixed(1) + "%"; },
        colorFn: function(d) { return d.margin_pct >= 0 ? "#059669" : "#dc2626"; }
      },
      tooltipFn: function(d) {
        var lines = [
          "<div style='font-weight:600;margin-bottom:4px'>" + d.month + "</div>",
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>",
          "<span>Margin</span><span style='font-weight:600;color:" + (d.margin_pct >= 0 ? "#059669" : "#dc2626") + "'>" + d.margin_pct.toFixed(1) + "%</span>"
        ];
        if (d.budget_margin != null) {
          lines.push("<span>Budget</span><span style='font-weight:500'>" + d.budget_margin.toFixed(1) + "%</span>");
        }
        lines.push("</div>");
        return lines.join("");
      },
      yFormat: function(d) { return d.toFixed(0) + "%"; },
      yLabel: "Delivery Margin %",
      margin: {top: 16, right: 40, bottom: 50, left: 60},
      height: 350
    });
  }

  function buildFinancialYoY(containerId, data, prevData) {
    var monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function monthNum(m) { return parseInt(m.substring(5,7)); }
    var currYear = data.length > 0 ? data[0].month.substring(0,4) : "2026";
    var prevYear = prevData.length > 0 ? prevData[0].month.substring(0,4) : "2025";

    // Build flat data keyed by month number
    var monthMap = {};
    for (var i = 1; i <= 12; i++) monthMap[i] = {month: monthNames[i-1]};

    data.forEach(function(r) {
      var mn = monthNum(r.month);
      monthMap[mn].curr_rev = r.revenue;
      monthMap[mn].curr_cost = r.staff_cost;
    });
    prevData.forEach(function(r) {
      var mn = monthNum(r.month);
      monthMap[mn].prev_rev = r.revenue;
      monthMap[mn].prev_cost = r.staff_cost;
    });

    var chartData = [];
    for (var j = 1; j <= 12; j++) {
      var row = monthMap[j];
      // Only include months that have data in either year
      if (row.curr_rev != null || row.prev_rev != null || row.curr_cost != null || row.prev_cost != null) {
        chartData.push(row);
      }
    }

    d3c.lineTrend(containerId, chartData, {
      xField: "month",
      series: [
        {field: "prev_cost", label: prevYear + " Cost", color: C.cost, dash: "6,3", width: 2},
        {field: "curr_cost", label: currYear + " Cost", color: C.cost, width: 2},
        {field: "prev_rev", label: prevYear + " Revenue", color: C.revenue, dash: "6,3", width: 2},
        {field: "curr_rev", label: currYear + " Revenue", color: C.revenue, width: 2}
      ],
      tooltipFn: function(d) {
        var lines = ["<div style='font-weight:600;margin-bottom:4px'>" + d.month + "</div>"];
        lines.push("<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>");
        if (d.curr_rev != null) lines.push("<span>" + currYear + " Rev</span><span style='font-weight:600;color:#1A1D21'>€" + Math.round(d.curr_rev).toLocaleString() + "</span>");
        if (d.prev_rev != null) lines.push("<span>" + prevYear + " Rev</span><span style='font-weight:500'>€" + Math.round(d.prev_rev).toLocaleString() + "</span>");
        if (d.curr_cost != null) lines.push("<span>" + currYear + " Cost</span><span style='font-weight:600;color:#1A1D21'>€" + Math.round(d.curr_cost).toLocaleString() + "</span>");
        if (d.prev_cost != null) lines.push("<span>" + prevYear + " Cost</span><span style='font-weight:500'>€" + Math.round(d.prev_cost).toLocaleString() + "</span>");
        lines.push("</div>");
        return lines.join("");
      },
      yFormat: function(d) { return "€" + d3c.fmtNum(d); },
      yLabel: "EUR",
      margin: {top: 16, right: 40, bottom: 40, left: 70},
      height: 380
    });
  }

  function buildInvoicedRevenue(containerId, data) {
    var many = data.length > 6;
    var months = data.map(function(r){ return r.month; });
    var budgetData = u.getBudgetForMonths(months);

    var chartData = data.map(function(r, i) {
      var row = {
        month: r.month,
        invoiced: r.invoiced || 0,
        cost: r.staff_cost || 0,
        recognized: r.revenue || 0,
        _inv_margin_pct: r.inv_margin_pct || 0,
        _gm: (r.invoiced || 0) - (r.staff_cost || 0)
      };
      var b = budgetData[i];
      row.budget = b ? (b.budget_revenue || 0) : null;
      return row;
    });

    d3c.verticalBar(containerId, chartData, {
      xField: "month",
      series: [
        {field: "invoiced", label: "Invoiced", color: "#8E44AD"},
        {field: "cost", label: "Staff Cost", color: C.cost}
      ],
      barMode: "group",
      lines: [
        {field: "recognized", label: "Recognized (ref)", color: C.revenue, dash: "3,3"},
        {field: "budget", label: "Budget Revenue", color: C.budget, dash: "6,3"}
      ],
      textOnBars: many ? null : {
        field: "invoiced",
        format: function(v) { return "€" + Math.round(v).toLocaleString(); }
      },
      tooltipFn: function(d) {
        var gmColor = d._gm >= 0 ? C.profitPos : C.profitNeg;
        var lines = [
          "<div style='font-weight:600;margin-bottom:4px'>" + d.month + "</div>",
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>",
          "<span>Invoiced</span><span style='font-weight:600;color:#1A1D21'>€" + Math.round(d.invoiced).toLocaleString() + "</span>",
          "<span>Staff Cost</span><span style='font-weight:500'>€" + Math.round(d.cost).toLocaleString() + "</span>",
          "<span>Margin</span><span style='font-weight:600;color:" + gmColor + "'>" + d._inv_margin_pct.toFixed(1) + "%</span>",
          "<span>Recognized</span><span style='font-weight:500'>€" + Math.round(d.recognized).toLocaleString() + "</span>"
        ];
        if (d.budget != null) {
          lines.push("<span>Budget</span><span style='font-weight:500'>€" + Math.round(d.budget).toLocaleString() + "</span>");
        }
        lines.push("</div>");
        return lines.join("");
      },
      yFormat: function(d) { return "€" + d3c.fmtNum(d); },
      yLabel: "EUR",
      margin: {top: 16, right: 50, bottom: many ? 50 : 80, left: 70},
      height: 380
    });
  }

  // === VARIANCE ANALYSIS ===

  function buildVarianceWaterfall(containerId) {
    var vsm = DATA.variance_service_mix || [];
    var vsu = DATA.variance_utilisation || [];
    if (vsm.length === 0 && vsu.length === 0) return false;

    // Compute aggregate impacts
    var rateImpact = 0;
    vsm.forEach(function(v) { rateImpact += v.revenue_impact || 0; });
    var utilImpact = 0;
    vsu.forEach(function(v) { utilImpact += v.revenue_impact || 0; });

    // Budget baseline: sum budget_monthly revenue for filtered period
    var budgetRev = 0;
    if (DATA.budget_monthly) {
      DATA.budget_monthly.forEach(function(bm) { budgetRev += bm.revenue || 0; });
    }
    var actualRev = budgetRev + rateImpact + utilImpact;

    var wfData = [
      {label: "Budget", value: budgetRev, measure: "absolute"},
      {label: "Rate Mix", value: rateImpact, measure: "relative"},
      {label: "Utilisation", value: utilImpact, measure: "relative"},
      {label: "Actual", value: actualRev, measure: "total"}
    ];

    d3c.waterfall(containerId, wfData, {
      colors: {
        increase: C.profitPos,
        decrease: C.profitNeg,
        total: actualRev >= budgetRev ? C.profitPos : C.revenue
      },
      yFormat: function(d) { return "€" + d3c.fmtNum(d); },
      yLabel: "Revenue (€)",
      tooltipFn: function(d) {
        var prefix = d.measure === "relative" ? (d.value >= 0 ? "+" : "") : "";
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.label + "</div>" +
          "<div style='color:#5F6B7A'>" + prefix + "€" + Math.round(d.value).toLocaleString() + "</div>";
      },
      margin: {top: 20, right: 20, bottom: 40, left: 70},
      height: 320
    });
    return true;
  }

  function buildVariancePeople(containerId) {
    var vsu = DATA.variance_utilisation || [];
    if (vsu.length === 0) return false;
    // Sort by revenue impact (most negative first)
    var sorted = vsu.slice().sort(function(a,b) { return a.revenue_impact - b.revenue_impact; });
    // Show top 15
    sorted = sorted.slice(0, 15);
    // Reverse for horizontal bar (worst at top = last in data array)
    sorted.reverse();

    var barData = sorted.map(function(v) {
      return {
        label: v.person,
        value: v.revenue_impact,
        _val: v.revenue_impact,
        _raw: v
      };
    });

    d3c.horizontalBar(containerId, barData, {
      yField: "label",
      xField: "value",
      colorFn: function(d) { return d._val >= 0 ? C.profitPos : C.profitNeg; },
      labelFn: function(d) { return "€" + Math.round(d.value).toLocaleString(); },
      labelColorFn: function(d) { return d._val >= 0 ? "#059669" : "#dc2626"; },
      tooltipFn: function(d) {
        var r = d._raw;
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.person + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Actual Util</span><span style='font-weight:600;color:#1A1D21'>" + r.actual_util + "%</span>" +
          "<span>Target Util</span><span style='font-weight:500'>" + r.target_util + "%</span>" +
          "<span>Gap</span><span style='font-weight:500'>" + r.gap_pct + "pp</span>" +
          "<span>Revenue Impact</span><span style='font-weight:600;color:" + (r.revenue_impact >= 0 ? "#059669" : "#dc2626") + "'>€" + Math.round(r.revenue_impact).toLocaleString() + "</span>" +
          "</div>";
      },
      xLabel: "Revenue Impact (€)",
      xFormat: function(d) { return "€" + d3c.fmtNum(d); },
      margin: {top: 20, right: 60, bottom: 40, left: 120}
    });
    return true;
  }

  // === BUDGET SCENARIO ===
  var activeBudgetScenario = "current";

  function updateScenarioLabel(scenario) {
    var btnCurrent = document.getElementById("btn-scenario-current");
    var btnHires = document.getElementById("btn-scenario-hires");
    if (btnCurrent && btnHires) {
      btnCurrent.className = scenario === "current" ? "tab-btn active" : "tab-btn";
      btnHires.className = scenario === "hires" ? "tab-btn active" : "tab-btn";
    }
    var label = document.getElementById("scenario-label");
    if (label) {
      if (scenario === "hires" && DATA.budget_with_new_hires) {
        var nh = DATA.budget_with_new_hires;
        label.textContent = "Revenue: €" + Math.round(nh.revenue || 0).toLocaleString() + " | People cost: €" + Math.round(nh.people_cost || 0).toLocaleString();
      } else if (DATA.budget_current) {
        var bc = DATA.budget_current;
        label.textContent = "Revenue: €" + Math.round(bc.revenue || 0).toLocaleString() + " | People cost: €" + Math.round(bc.people_cost || 0).toLocaleString();
      } else {
        label.textContent = "";
      }
    }
  }

  function setBudgetScenario(scenario) {
    activeBudgetScenario = scenario;
    updateScenarioLabel(scenario);
    applyFilters();
  }

  // === SECTION HANDLER ===

  D.registerSection("financial", function(f) {
    // Financial
    var finData = u.filterByMonth(DATA.financial_monthly, "month", f.startMonth, f.endMonth);

    // Exclude current (last) month — data is never complete
    var finDataComplete = finData.length > 1 ? finData.slice(0, -1) : finData;

    var totalRev = u.sum(finDataComplete, "revenue");
    var totalCost = u.sum(finDataComplete, "staff_cost");
    var grossMargin = totalRev - totalCost;
    var marginPct = totalRev > 0 ? grossMargin/totalRev*100 : 0;

    // Budget totals for the same completed months
    var completeMonths = finDataComplete.map(function(r){return r.month.substring(0,7)});
    var budgetForComplete = u.getBudgetForMonths(completeMonths);
    var budgetRev = 0, budgetCost = 0, budgetMargin = 0;
    budgetForComplete.forEach(function(b) {
      if (b) {
        budgetRev += (b.budget_revenue || 0);
        budgetCost += (b.budget_people_cost || 0);
        budgetMargin += (b.budget_margin || 0);
      }
    });
    var budgetMarginPct = budgetRev > 0 ? budgetMargin/budgetRev*100 : 0;

    var revVsBudget = budgetRev > 0 ? (totalRev - budgetRev)/budgetRev*100 : null;
    var marginVsBudget = budgetMarginPct > 0 ? (marginPct - budgetMarginPct) : null;

    var marginGapVar = budgetMargin !== 0 ? (grossMargin - budgetMargin) / Math.abs(budgetMargin) * 100 : null;
    var finKPIs = [
      {label:"Revenue", value:u.fmtEur(totalRev), sub:budgetRev > 0 ? "Budget: "+u.fmtEur(budgetRev) : null, delta:revVsBudget, deltaLabel:"vs budget"},
      {label:"Staff Cost", value:u.fmtEur(totalCost), sub:budgetCost > 0 ? "Budget: "+u.fmtEur(budgetCost) : null},
      {label:"Delivery Margin (€)", value:u.fmtEur(grossMargin), sub:budgetMargin > 0 ? "Budget: "+u.fmtEur(budgetMargin) : null, delta:marginGapVar, deltaLabel:"vs budget"},
      {label:"Delivery Margin %", value:marginPct.toFixed(1)+"%", sub:budgetMarginPct > 0 ? "Budget: "+budgetMarginPct.toFixed(1)+"%" : null, delta:marginVsBudget, deltaLabel:"pp vs budget"}
    ];

    // YoY chart
    if (D.showYoY) {
      var currYear = f.endMonth.substring(0,4);
      var prevYear = String(parseInt(currYear) - 1);
      var currYearData = u.filterByMonth(DATA.financial_monthly, "month", currYear+"-01", currYear+"-12");
      var prevYearData = u.filterByMonth(DATA.financial_monthly, "month", prevYear+"-01", prevYear+"-12");
      buildFinancialYoY("chart-fin-yoy", currYearData, prevYearData);
      document.getElementById("yoy-wrapper").style.display = "block";
    } else {
      document.getElementById("yoy-wrapper").style.display = "none";
    }

    // Recognized tab charts
    u.setKPIs("kpi-financial-rec", finKPIs);
    buildFinancialRevenue("chart-fin-revenue", finDataComplete);
    buildFinancialMargin("chart-fin-margin", finDataComplete);


    // (Invoiced tab removed)

    // Budget scenario toggle — show only when 2026 data is in range
    var scenarioSection = document.getElementById("budget-scenario-section");
    if (scenarioSection) {
      var has2026 = f.endMonth >= "2026-01" && (DATA.budget_current || DATA.budget_with_new_hires);
      scenarioSection.style.display = has2026 ? "block" : "none";
      if (has2026) updateScenarioLabel(activeBudgetScenario);
    }

    // Variance analysis charts
    var varianceSection = document.getElementById("variance-section");
    if (varianceSection) {
      var hasVariance = (DATA.variance_service_mix && DATA.variance_service_mix.length > 0) || (DATA.variance_utilisation && DATA.variance_utilisation.length > 0);
      varianceSection.style.display = hasVariance ? "block" : "none";
      if (hasVariance) {
        buildVarianceWaterfall("chart-variance-waterfall");
        buildVariancePeople("chart-variance-people");
      }
    }
  });

  // === BUDGET vs FORECAST (Accounting P&L) ===

  var ACTUALS = JSON.parse(JSON.stringify(window.PNL_ACTUALS));
  var BUDGET  = window.PNL_BUDGET;
  var PNL_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var LS_KEY = "leadstreet_pnl_actuals";

  function loadSavedActuals() {
    try {
      var saved = localStorage.getItem(LS_KEY);
      if (!saved) return;
      var obj = JSON.parse(saved);
      Object.keys(obj).forEach(function(key) {
        if (!ACTUALS[key]) ACTUALS[key] = [null,null,null,null,null,null,null,null,null,null,null,null];
        obj[key].forEach(function(v, i) {
          if (v !== null && v !== undefined) ACTUALS[key][i] = v;
        });
      });
    } catch(e) {}
  }
  loadSavedActuals();

  function saveActuals() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(ACTUALS)); } catch(e) {}
  }

  function countActualMonths() {
    var n = 0;
    for (var i = 0; i < 12; i++) {
      if (ACTUALS.turnover[i] !== null) n = i + 1; else break;
    }
    return n;
  }
  var ACTUAL_MONTHS_COUNT = countActualMonths();
  var FORECAST_MONTHS = 12 - ACTUAL_MONTHS_COUNT;

  // Forecast = budget × (YTD actual / YTD budget) — preserves seasonality
  function getScaleFactor(key) {
    if (!ACTUALS[key] || !BUDGET[key] || ACTUAL_MONTHS_COUNT === 0) return 1;
    var actSum = 0, budSum = 0;
    for (var i = 0; i < ACTUAL_MONTHS_COUNT; i++) {
      if (ACTUALS[key][i] !== null) actSum += ACTUALS[key][i];
      budSum += BUDGET[key][i];
    }
    return budSum !== 0 ? actSum / budSum : 1;
  }

  function getForecast(key) {
    var arr = [];
    var scale = getScaleFactor(key);
    for (var i = 0; i < 12; i++) {
      if (i < ACTUAL_MONTHS_COUNT && ACTUALS[key] && ACTUALS[key][i] !== null) {
        arr.push(ACTUALS[key][i]);
      } else if (BUDGET[key]) {
        arr.push(BUDGET[key][i] * scale);
      } else {
        arr.push(0);
      }
    }
    return arr;
  }

  function sumArr(arr, start, end) {
    var s = 0;
    for (var i = start; i < end; i++) s += (arr[i] || 0);
    return s;
  }

  // P&L row definitions
  var PNL_ROWS = [
    {label: "Turnover", key: "turnover", cls: "pnl-header"},
    {label: "People/service-based revenue", key: "service_rev", cls: "pnl-sub"},
    {label: "Other revenue", key: "other_rev", cls: "pnl-sub"},
    {label: "", cls: "pnl-spacer"},
    {label: "People cost", key: "people_cost", cls: "pnl-header"},
    {label: "Mgmt & Contractor fees", key: "contractor_fees", cls: "pnl-sub"},
    {label: "Management", key: "management", cls: "pnl-subsub"},
    {label: "Freelancers", key: "freelancers", cls: "pnl-subsub"},
    {label: "Payroll", key: "payroll", cls: "pnl-sub"},
    {label: "Wages", key: "wages", cls: "pnl-subsub"},
    {label: "Other payroll expenses", key: "other_payroll", cls: "pnl-subsub"},
    {label: "", cls: "pnl-spacer"},
    {label: "Direct costs", key: "direct_costs", cls: ""},
    {label: "", cls: "pnl-spacer"},
    {label: "Delivery Margin", cls: "pnl-total", compute: function(A, B, i) { return (A.service_rev[i] || 0) + (A.people_cost[i] || 0) + (A.direct_costs[i] || 0); }, computeBudget: function(B, i) { return (B.service_rev[i] || 0) + (B.people_cost[i] || 0) + (B.direct_costs[i] || 0); }},
    {label: "Delivery Margin %", cls: "pnl-pct", isPct: true, compute: function(A, B, i) { var s = A.service_rev[i] || 0; var c = Math.abs(A.people_cost[i] || 0) + Math.abs(A.direct_costs[i] || 0); return s > 0 ? (s - c) / s * 100 : 0; }, computeBudget: function(B, i) { var s = B.service_rev[i] || 0; var c = Math.abs(B.people_cost[i] || 0) + Math.abs(B.direct_costs[i] || 0); return s > 0 ? (s - c) / s * 100 : 0; }},
    {label: "", cls: "pnl-spacer"},
    {label: "Gross Profit", key: "gross_profit", cls: "pnl-total"},
    {label: "Gross Profit %", key: "gross_profit_pct", cls: "pnl-pct", isPct: true},
    {label: "", cls: "pnl-spacer"},
    {label: "Operating Expenses", key: "total_opex", cls: ""},
    {label: "", cls: "pnl-spacer"},
    {label: "Reported EBITDA", key: "reported_ebitda", cls: "pnl-total"},
    {label: "Reported EBITDA %", key: "reported_ebitda_pct", cls: "pnl-pct", isPct: true},
    {label: "", cls: "pnl-spacer"},
    {label: "Non-Recurring & Extra-ordinary", key: "non_recurring", cls: ""},
    {label: "Statutory EBITDA", key: "statutory_ebitda", cls: "pnl-total"},
    {label: "Statutory EBITDA %", key: "statutory_ebitda_pct", cls: "pnl-pct", isPct: true},
    {label: "", cls: "pnl-spacer"},
    {label: "Depreciation & amortization", key: "depreciation", cls: ""},
    {label: "EBIT", key: "ebit", cls: "pnl-total"},
    {label: "EBIT %", key: "ebit_pct", cls: "pnl-pct", isPct: true},
    {label: "", cls: "pnl-spacer"},
    {label: "Financial Result", key: "financial_result", cls: ""},
    {label: "EBT", key: "ebt", cls: "pnl-total"},
    {label: "Net Result %", key: "net_result_pct", cls: "pnl-pct", isPct: true}
  ];

  var COST_KEYS = ["people_cost","contractor_fees","management","freelancers","payroll","wages","other_payroll","direct_costs","total_opex","depreciation","non_recurring","financial_result","ga_expense","sm_expense","te_expense"];

  function fmtCell(val, isPct) {
    if (val === null || val === undefined) return "";
    if (isPct) return val.toFixed(1) + "%";
    var neg = val < 0;
    var abs = Math.abs(Math.round(val));
    var s = abs.toLocaleString("en-US");
    return neg ? "-" + s : s;
  }

  function isHigherGood(key) { return COST_KEYS.indexOf(key) === -1; }

  function varClass(actual, budget, higherIsGood) {
    if (actual === null || budget === null || budget === 0) return "";
    var diff = actual - budget;
    if (!higherIsGood) diff = -diff;
    // Only color if >2% deviation — on-budget stays black
    var pct = Math.abs(actual - budget) / Math.abs(budget);
    if (pct < 0.02) return "";
    return diff >= 0 ? "pnl-positive" : "pnl-negative";
  }

  // === CHART: Dual stacked bars (revenue | cost) + EBITDA on right y-axis ===
  // Custom D3 — d3c.verticalBar doesn't support dual stacks or dual y-axes

  function buildBudgetBarChart() {
    var turnover   = getForecast("turnover");
    var serviceRev = getForecast("service_rev");
    var otherRev   = [];
    for (var t = 0; t < 12; t++) otherRev.push(Math.max(0, turnover[t] - serviceRev[t]));
    var peopleCost = getForecast("people_cost").map(function(v){ return Math.abs(v); });
    var opex       = getForecast("total_opex").map(function(v){ return Math.abs(v); });
    var ebitdaBudget   = BUDGET.reported_ebitda;
    var ebitdaForecast = getForecast("reported_ebitda");

    var data = [];
    for (var i = 0; i < 12; i++) {
      var budRev = BUDGET.turnover[i];
      var budCost = Math.abs(BUDGET.people_cost[i]) + Math.abs(BUDGET.total_opex[i]);
      data.push({
        month: PNL_MONTHS[i], idx: i,
        svcRev: serviceRev[i], commission: otherRev[i],
        pplCost: peopleCost[i], opex: opex[i],
        eBudget: ebitdaBudget[i], eForecast: ebitdaForecast[i],
        budgetRev: budRev, budgetCost: budCost,
        isActual: i < ACTUAL_MONTHS_COUNT
      });
    }

    var margin = {top: 36, right: 70, bottom: 40, left: 70};
    var totalH = 400;
    var ctx = d3c.createSvg("chart-fin-budget-cumulative", margin, totalH);
    if (!ctx) return;
    var g = ctx.g, W = ctx.innerW, H = ctx.innerH;

    // Scales
    var x0 = d3.scaleBand().domain(PNL_MONTHS).range([0, W]).padding(0.2);
    var halfBand = x0.bandwidth() / 2;
    var barW = halfBand - 1;

    var maxBar = d3.max(data, function(d) {
      return Math.max(d.svcRev + d.commission, d.pplCost + d.opex, d.budgetRev, d.budgetCost);
    });
    var yBar = d3.scaleLinear().domain([0, maxBar * 1.15]).nice().range([H, 0]);

    var allE = ebitdaBudget.concat(ebitdaForecast);
    var eMin = d3.min(allE), eMax = d3.max(allE), eR = eMax - eMin;
    var yE = d3.scaleLinear().domain([eMin - eR * 0.4, eMax + eR * 0.4]).nice().range([H, 0]);

    // Grid
    yBar.ticks(5).forEach(function(tick) {
      g.append("line").attr("x1", 0).attr("x2", W)
        .attr("y1", yBar(tick)).attr("y2", yBar(tick))
        .attr("stroke", "#F0F2F5");
    });

    // Left axis (bars)
    var axL = d3.axisLeft(yBar).ticks(5).tickFormat(function(d) { return "\u20ac" + d3c.fmtNum(d); });
    g.append("g").call(axL).selectAll("text").attr("fill", "#5F6B7A").attr("font-size", "10px");
    g.append("text").attr("transform", "rotate(-90)").attr("y", -55).attr("x", -H/2)
      .attr("text-anchor", "middle").attr("fill", "#5F6B7A").attr("font-size", "10px").text("Revenue / Cost");

    // Right axis (EBITDA)
    var axR = d3.axisRight(yE).ticks(5).tickFormat(function(d) { return "\u20ac" + d3c.fmtNum(d); });
    g.append("g").attr("transform", "translate(" + W + ",0)").call(axR)
      .selectAll("text").attr("fill", "#5F6B7A").attr("font-size", "10px");
    g.append("text").attr("transform", "rotate(90)").attr("y", -(W + 55)).attr("x", H/2)
      .attr("text-anchor", "middle").attr("fill", "#5F6B7A").attr("font-size", "10px").text("EBITDA");

    // X axis
    var axB = d3.axisBottom(x0);
    g.append("g").attr("transform", "translate(0," + H + ")").call(axB)
      .selectAll("text").attr("fill", "#5F6B7A").attr("font-size", "10px");

    // Tooltip
    var tip = d3c.createTooltip("chart-fin-budget-cumulative");

    // Draw bars per month
    data.forEach(function(d) {
      var xBase = x0(d.month);
      var alpha = d.isActual ? 0.9 : 0.38;

      // Ghost bars (budget targets) — only for actual months
      if (d.isActual) {
        var ghostRevH = yBar(0) - yBar(d.budgetRev);
        g.append("rect").attr("x", xBase).attr("y", yBar(d.budgetRev))
          .attr("width", barW).attr("height", ghostRevH)
          .attr("fill", "none").attr("stroke", "rgba(52,152,219,0.45)")
          .attr("stroke-width", 1.5).attr("stroke-dasharray", "4,2").attr("rx", 2);

        var ghostCostH = yBar(0) - yBar(d.budgetCost);
        g.append("rect").attr("x", xBase + halfBand + 1).attr("y", yBar(d.budgetCost))
          .attr("width", barW).attr("height", ghostCostH)
          .attr("fill", "none").attr("stroke", "rgba(231,76,60,0.45)")
          .attr("stroke-width", 1.5).attr("stroke-dasharray", "4,2").attr("rx", 2);
      }

      // Left stack: Service Rev (bottom) + Commission (top)
      var svcH = yBar(0) - yBar(d.svcRev);
      var comH = yBar(0) - yBar(d.commission);
      g.append("rect").attr("x", xBase).attr("y", yBar(d.svcRev + d.commission))
        .attr("width", barW).attr("height", svcH + comH)
        .attr("fill", "rgba(52,152,219," + alpha + ")").attr("rx", 2);
      if (d.commission > 0) {
        g.append("rect").attr("x", xBase).attr("y", yBar(d.svcRev + d.commission))
          .attr("width", barW).attr("height", comH)
          .attr("fill", "rgba(155,89,182," + alpha + ")").attr("rx", 2);
      }

      // Right stack: People Cost (bottom) + OpEx (top)
      var pcH = yBar(0) - yBar(d.pplCost);
      var oxH = yBar(0) - yBar(d.opex);
      g.append("rect").attr("x", xBase + halfBand + 1).attr("y", yBar(d.pplCost + d.opex))
        .attr("width", barW).attr("height", pcH + oxH)
        .attr("fill", "rgba(231,76,60," + alpha + ")").attr("rx", 2);
      if (d.opex > 0) {
        g.append("rect").attr("x", xBase + halfBand + 1).attr("y", yBar(d.pplCost + d.opex))
          .attr("width", barW).attr("height", oxH)
          .attr("fill", "rgba(230,126,34," + alpha + ")").attr("rx", 2);
      }

      // Invisible hover rect for tooltip
      g.append("rect").attr("x", xBase).attr("y", 0)
        .attr("width", x0.bandwidth()).attr("height", H)
        .attr("fill", "transparent").attr("cursor", "pointer")
        .on("mouseenter", function(ev) {
          var totalRev = d.svcRev + d.commission;
          var totalCost = d.pplCost + d.opex;
          var html = "<div style='font-weight:600;margin-bottom:4px'>" + d.month + (d.isActual ? " (Actual)" : " (Forecast)") + "</div>" +
            "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:11px'>" +
            "<span style='color:#3498DB'>\u25A0 Service Rev</span><span>\u20ac" + d3c.fmtNum(d.svcRev) + "</span>" +
            "<span style='color:#9B59B6'>\u25A0 Commission</span><span>\u20ac" + d3c.fmtNum(d.commission) + "</span>" +
            "<span style='font-weight:600'>Total Revenue</span><span style='font-weight:600'>\u20ac" + d3c.fmtNum(totalRev) + "</span>" +
            "<span style='color:#94A3B8'>Revenue Budget</span><span style='color:#94A3B8'>\u20ac" + d3c.fmtNum(d.budgetRev) + "</span>" +
            "<span style='color:#E74C3C'>\u25A0 People Cost</span><span>\u20ac" + d3c.fmtNum(d.pplCost) + "</span>" +
            "<span style='color:#E67E22'>\u25A0 OpEx</span><span>\u20ac" + d3c.fmtNum(d.opex) + "</span>" +
            "<span style='font-weight:600'>Total Cost</span><span style='font-weight:600'>\u20ac" + d3c.fmtNum(totalCost) + "</span>" +
            "<span style='color:#94A3B8'>Cost Budget</span><span style='color:#94A3B8'>\u20ac" + d3c.fmtNum(d.budgetCost) + "</span>" +
            "<span style='color:#E67E22'>\u2666 EBITDA Budget</span><span>\u20ac" + d3c.fmtNum(d.eBudget) + "</span>" +
            "<span style='color:#27AE60'>\u25CF EBITDA Forecast</span><span>\u20ac" + d3c.fmtNum(d.eForecast) + "</span>" +
            "</div>";
          tip.html(html).style("opacity", 1);
          d3c.positionTooltip(tip, ev, "chart-fin-budget-cumulative");
        })
        .on("mousemove", function(ev) { d3c.positionTooltip(tip, ev, "chart-fin-budget-cumulative"); })
        .on("mouseleave", function() { tip.style("opacity", 0); });
    });

    // EBITDA Budget line (on yE right axis)
    var lineBudget = d3.line().x(function(d) { return x0(d.month) + x0.bandwidth() / 2; }).y(function(d) { return yE(d.eBudget); });
    g.append("path").datum(data).attr("d", lineBudget)
      .attr("fill", "none").attr("stroke", "#E67E22").attr("stroke-width", 3).attr("stroke-dasharray", "8,4");
    g.selectAll(".eb-dot").data(data).enter().append("circle")
      .attr("cx", function(d) { return x0(d.month) + x0.bandwidth() / 2; })
      .attr("cy", function(d) { return yE(d.eBudget); })
      .attr("r", 5).attr("fill", "#E67E22").attr("stroke", "white").attr("stroke-width", 2);

    // EBITDA Forecast line (on yE right axis)
    var lineForecast = d3.line().x(function(d) { return x0(d.month) + x0.bandwidth() / 2; }).y(function(d) { return yE(d.eForecast); });
    g.append("path").datum(data).attr("d", lineForecast)
      .attr("fill", "none").attr("stroke", "#27AE60").attr("stroke-width", 3);
    g.selectAll(".ef-dot").data(data).enter().append("circle")
      .attr("cx", function(d) { return x0(d.month) + x0.bandwidth() / 2; })
      .attr("cy", function(d) { return yE(d.eForecast); })
      .attr("r", 5).attr("fill", "#27AE60").attr("stroke", "white").attr("stroke-width", 2);

    // Actual|Forecast divider
    if (ACTUAL_MONTHS_COUNT < 12) {
      var divX = x0(PNL_MONTHS[ACTUAL_MONTHS_COUNT]) - x0.step() * x0.padding() / 2;
      g.append("line").attr("x1", divX).attr("x2", divX).attr("y1", 0).attr("y2", H)
        .attr("stroke", "#94A3B8").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,3");
      g.append("text").attr("x", divX).attr("y", -8).attr("text-anchor", "middle")
        .attr("fill", "#94A3B8").attr("font-size", "9px").text("Actual | Forecast \u2192");
    }

    // Legend
    var legend = [
      {color: "rgba(52,152,219,0.9)", label: "Service Revenue", type: "rect"},
      {color: "rgba(155,89,182,0.9)", label: "Commission", type: "rect"},
      {color: "rgba(52,152,219,0.45)", label: "Rev Budget", type: "ghost"},
      {color: "rgba(231,76,60,0.85)", label: "People Cost", type: "rect"},
      {color: "rgba(230,126,34,0.8)", label: "OpEx", type: "rect"},
      {color: "rgba(231,76,60,0.45)", label: "Cost Budget", type: "ghost"},
      {color: "#E67E22", label: "EBITDA Budget", type: "dashedLine"},
      {color: "#27AE60", label: "EBITDA Forecast", type: "line"}
    ];
    var lg = ctx.svg.append("g").attr("transform", "translate(" + margin.left + ",6)");
    var lx = 0;
    legend.forEach(function(item) {
      var gg = lg.append("g").attr("transform", "translate(" + lx + ",0)");
      if (item.type === "ghost") {
        gg.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2)
          .attr("fill", "none").attr("stroke", item.color).attr("stroke-width", 1.5).attr("stroke-dasharray", "3,1.5");
      } else if (item.type === "dashedLine") {
        gg.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 5).attr("y2", 5)
          .attr("stroke", item.color).attr("stroke-width", 2.5).attr("stroke-dasharray", "4,2");
      } else if (item.type === "line") {
        gg.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 5).attr("y2", 5)
          .attr("stroke", item.color).attr("stroke-width", 2.5);
      } else {
        gg.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", item.color);
      }
      var off = item.type === "dashedLine" || item.type === "line" ? 18 : 14;
      gg.append("text").attr("x", off).attr("y", 9).attr("font-size", "10px").attr("fill", "#5F6B7A").text(item.label);
      lx += off + item.label.length * 5.5 + 14;
    });
  }

  // === INLINE-EDITABLE P&L TABLE ===

  function onCellClick(td, key, monthIdx, isPct) {
    if (td.querySelector("input")) return; // already editing
    var currentVal = ACTUALS[key] ? ACTUALS[key][monthIdx] : null;
    var displayVal = currentVal !== null ? (isPct ? currentVal : Math.round(currentVal)) : "";
    var origHTML = td.innerHTML;

    var input = document.createElement("input");
    input.type = "text";
    input.value = displayVal;
    input.className = "pnl-edit-input";
    input.style.cssText = "width:80px;padding:2px 4px;font-size:12px;font-family:inherit;text-align:right;border:2px solid #3498DB;border-radius:4px;outline:none;background:#EBF5FB";
    td.innerHTML = "";
    td.appendChild(input);
    input.focus();
    input.select();

    function commit() {
      var raw = input.value.replace(/[^0-9.\-]/g, "").trim();
      if (raw === "") {
        // Clear the value
        if (ACTUALS[key]) ACTUALS[key][monthIdx] = null;
      } else {
        var num = parseFloat(raw);
        if (!isNaN(num)) {
          if (!ACTUALS[key]) ACTUALS[key] = [null,null,null,null,null,null,null,null,null,null,null,null];
          ACTUALS[key][monthIdx] = isPct ? num : Math.round(num);
        }
      }
      saveActuals();
      ACTUAL_MONTHS_COUNT = countActualMonths();
      FORECAST_MONTHS = 12 - ACTUAL_MONTHS_COUNT;
      refreshBudgetTab();
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { input.blur(); }
      if (e.key === "Escape") { td.innerHTML = origHTML; }
    });
  }

  function buildPnlTable() {
    var container = document.getElementById("pnl-table-container");
    if (!container) return;

    var table = document.createElement("table");
    table.className = "pnl-table";

    // Header
    var thead = document.createElement("thead");
    var hrow = document.createElement("tr");
    hrow.innerHTML = "<th></th>";
    for (var m = 0; m < 12; m++) {
      var isAct = m < ACTUAL_MONTHS_COUNT;
      var th = document.createElement("th");
      th.className = isAct ? "pnl-actual-hdr" : "pnl-forecast-hdr";
      th.textContent = PNL_MONTHS[m] + (isAct ? " (A)" : " (F)");
      hrow.appendChild(th);
    }
    ["YTD Actual","YTD Budget","Var %","FY Forecast","FY Budget","Var %"].forEach(function(label, idx) {
      var th = document.createElement("th");
      th.className = "pnl-summary-hdr" + (idx === 0 || idx === 3 ? " pnl-separator" : "");
      th.textContent = label;
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    // Body
    var tbody = document.createElement("tbody");

    PNL_ROWS.forEach(function(row) {
      if (row.cls === "pnl-spacer") {
        var sp = document.createElement("tr");
        sp.className = "pnl-spacer";
        sp.innerHTML = '<td colspan="19"></td>';
        tbody.appendChild(sp);
        return;
      }

      // Support computed rows (no key, derive values from compute functions)
      var forecast, budgetRow, actualRow;
      if (row.compute) {
        // Build full forecast arrays once
        var fcData = {};
        ["service_rev","people_cost","direct_costs","turnover","other_rev"].forEach(function(k) { fcData[k] = getForecast(k); });
        forecast = []; budgetRow = []; actualRow = [];
        for (var ci = 0; ci < 12; ci++) {
          forecast[ci] = ci < ACTUAL_MONTHS_COUNT ? row.compute(ACTUALS, BUDGET, ci) : row.compute(fcData, BUDGET, ci);
          budgetRow[ci] = row.computeBudget(BUDGET, ci);
          actualRow[ci] = ci < ACTUAL_MONTHS_COUNT ? row.compute(ACTUALS, BUDGET, ci) : null;
        }
      } else {
        forecast = row.key ? getForecast(row.key) : null;
        budgetRow = row.key && BUDGET[row.key] ? BUDGET[row.key] : null;
        actualRow = row.key && ACTUALS[row.key] ? ACTUALS[row.key] : null;
      }
      var isPct = row.isPct;
      var hig = row.key ? isHigherGood(row.key) : true;

      var tr = document.createElement("tr");
      tr.className = row.cls || "";

      var labelTd = document.createElement("td");
      labelTd.textContent = row.label;
      tr.appendChild(labelTd);

      // Monthly cells — clickable for editing
      for (var m = 0; m < 12; m++) {
        (function(monthIdx) {
          var val = forecast ? forecast[monthIdx] : null;
          var budVal = budgetRow ? budgetRow[monthIdx] : null;
          var isActual = monthIdx < ACTUAL_MONTHS_COUNT;
          var td = document.createElement("td");
          var cls = [];
          if (!isActual) cls.push("pnl-forecast");
          if (isActual && val !== null && budVal !== null) {
            var vc = varClass(val, budVal, hig);
            if (vc) cls.push(vc);
          }
          td.className = cls.join(" ");
          td.textContent = fmtCell(val, isPct);
          if (row.key) {
            td.style.cursor = "pointer";
            td.title = "Click to edit";
            td.addEventListener("click", function() { onCellClick(td, row.key, monthIdx, isPct); });
          }
          tr.appendChild(td);
        })(m);
      }

      // YTD columns
      var ytdActual = null, ytdBudget = null;
      if (actualRow && !isPct) {
        ytdActual = sumArr(actualRow, 0, ACTUAL_MONTHS_COUNT);
      } else if (isPct && actualRow) {
        var cnt = 0, tot = 0;
        for (var a = 0; a < ACTUAL_MONTHS_COUNT; a++) {
          if (actualRow[a] !== null) { tot += actualRow[a]; cnt++; }
        }
        ytdActual = cnt > 0 ? tot / cnt : null;
      }
      if (budgetRow && !isPct) {
        ytdBudget = sumArr(budgetRow, 0, ACTUAL_MONTHS_COUNT);
      } else if (isPct && budgetRow) {
        var cnt2 = 0, tot2 = 0;
        for (var b = 0; b < ACTUAL_MONTHS_COUNT; b++) { tot2 += budgetRow[b]; cnt2++; }
        ytdBudget = cnt2 > 0 ? tot2 / cnt2 : null;
      }

      var ytdVarPct = null;
      if (ytdActual !== null && ytdBudget !== null && ytdBudget !== 0 && !isPct) {
        ytdVarPct = (ytdActual - ytdBudget) / Math.abs(ytdBudget) * 100;
      } else if (isPct && ytdActual !== null && ytdBudget !== null) {
        ytdVarPct = ytdActual - ytdBudget;
      }
      var ytdVarCls = "";
      if (ytdVarPct !== null) {
        ytdVarCls = (hig ? ytdVarPct : -ytdVarPct) >= 0 ? "pnl-positive" : "pnl-negative";
      }

      var td1 = document.createElement("td");
      td1.className = "pnl-separator" + (ytdActual !== null ? " " + varClass(ytdActual, ytdBudget, hig) : "");
      td1.textContent = fmtCell(ytdActual, isPct);
      tr.appendChild(td1);

      var td2 = document.createElement("td");
      td2.textContent = fmtCell(ytdBudget, isPct);
      tr.appendChild(td2);

      var td3 = document.createElement("td");
      td3.className = ytdVarCls;
      td3.textContent = ytdVarPct !== null ? (ytdVarPct >= 0 ? "+" : "") + ytdVarPct.toFixed(1) + (isPct ? "pp" : "%") : "";
      tr.appendChild(td3);

      // FY columns
      var fyForecast = null, fyBudget = null;
      if (forecast && !isPct) {
        fyForecast = sumArr(forecast, 0, 12);
      } else if (isPct && forecast) {
        var cnt3 = 0, tot3 = 0;
        for (var c = 0; c < 12; c++) { if (forecast[c] !== null) { tot3 += forecast[c]; cnt3++; } }
        fyForecast = cnt3 > 0 ? tot3 / cnt3 : null;
      }
      if (budgetRow && !isPct) {
        fyBudget = sumArr(budgetRow, 0, 12);
      } else if (isPct && budgetRow) {
        var cnt4 = 0, tot4 = 0;
        for (var d = 0; d < 12; d++) { tot4 += budgetRow[d]; cnt4++; }
        fyBudget = cnt4 > 0 ? tot4 / cnt4 : null;
      }

      var fyVarPct = null;
      if (fyForecast !== null && fyBudget !== null && fyBudget !== 0 && !isPct) {
        fyVarPct = (fyForecast - fyBudget) / Math.abs(fyBudget) * 100;
      } else if (isPct && fyForecast !== null && fyBudget !== null) {
        fyVarPct = fyForecast - fyBudget;
      }
      var fyVarCls = "";
      if (fyVarPct !== null) {
        fyVarCls = (hig ? fyVarPct : -fyVarPct) >= 0 ? "pnl-positive" : "pnl-negative";
      }

      var td4 = document.createElement("td");
      td4.className = "pnl-separator" + (fyForecast !== null ? " " + varClass(fyForecast, fyBudget, hig) : "");
      td4.textContent = fmtCell(fyForecast, isPct);
      tr.appendChild(td4);

      var td5 = document.createElement("td");
      td5.textContent = fmtCell(fyBudget, isPct);
      tr.appendChild(td5);

      var td6 = document.createElement("td");
      td6.className = fyVarCls;
      td6.textContent = fyVarPct !== null ? (fyVarPct >= 0 ? "+" : "") + fyVarPct.toFixed(1) + (isPct ? "pp" : "%") : "";
      tr.appendChild(td6);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "pnl-table-wrap";
    wrap.appendChild(table);
    container.appendChild(wrap);

    // Forecast note + reset button
    var note = document.createElement("div");
    note.style.cssText = "margin-top:12px;padding:10px 14px;background:#FEF9E7;border:1px solid #F9E79F;border-radius:6px;font-size:11px;color:#7D6608;display:flex;justify-content:space-between;align-items:center";
    note.innerHTML = '<div><strong>Forecast method:</strong> Months (F) = budget \u00D7 (YTD actual \u00F7 YTD budget). Preserves budget seasonality (e.g. summer dips) but scales each line by how you\u2019re actually tracking. If YTD is \u22125% vs budget, every future month is forecasted at \u22125% of budget too. <strong>Click any cell to edit.</strong> Data saves to your browser.</div>';
    var resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset to defaults";
    resetBtn.style.cssText = "padding:4px 10px;border:1px solid #F9E79F;border-radius:4px;background:#FEF9E7;color:#7D6608;font-size:11px;cursor:pointer;white-space:nowrap;margin-left:12px";
    resetBtn.onclick = function() {
      if (confirm("Reset all manually entered data back to defaults from pnl-data.js?")) {
        localStorage.removeItem(LS_KEY);
        // Reload actuals from base
        var base = JSON.parse(JSON.stringify(window.PNL_ACTUALS));
        Object.keys(base).forEach(function(k) { ACTUALS[k] = base[k]; });
        ACTUAL_MONTHS_COUNT = countActualMonths();
        FORECAST_MONTHS = 12 - ACTUAL_MONTHS_COUNT;
        refreshBudgetTab();
      }
    };
    note.appendChild(resetBtn);
    container.appendChild(note);
  }

  // === KPIs ===

  function buildBudgetKPIs() {
    var revActual = sumArr(ACTUALS.turnover, 0, ACTUAL_MONTHS_COUNT);
    var revBudgetYTD = sumArr(BUDGET.turnover, 0, ACTUAL_MONTHS_COUNT);
    var revVarPct = revBudgetYTD > 0 ? (revActual - revBudgetYTD) / revBudgetYTD * 100 : null;

    var ebitdaActual = sumArr(ACTUALS.reported_ebitda, 0, ACTUAL_MONTHS_COUNT);
    var ebitdaBudgetYTD = sumArr(BUDGET.reported_ebitda, 0, ACTUAL_MONTHS_COUNT);
    var ebitdaVarPct = ebitdaBudgetYTD > 0 ? (ebitdaActual - ebitdaBudgetYTD) / ebitdaBudgetYTD * 100 : null;

    var gpActual = sumArr(ACTUALS.gross_profit, 0, ACTUAL_MONTHS_COUNT);
    var gpBudgetYTD = sumArr(BUDGET.gross_profit, 0, ACTUAL_MONTHS_COUNT);
    var gpVarPct = gpBudgetYTD > 0 ? (gpActual - gpBudgetYTD) / gpBudgetYTD * 100 : null;

    var fyRevForecast = sumArr(getForecast("turnover"), 0, 12);
    var fyRevBudget = sumArr(BUDGET.turnover, 0, 12);
    var fyRevVarPct = fyRevBudget > 0 ? (fyRevForecast - fyRevBudget) / fyRevBudget * 100 : null;

    var fyEbitdaForecast = sumArr(getForecast("reported_ebitda"), 0, 12);
    var fyEbitdaBudget = sumArr(BUDGET.reported_ebitda, 0, 12);
    var fyEbitdaVarPct = fyEbitdaBudget > 0 ? (fyEbitdaForecast - fyEbitdaBudget) / fyEbitdaBudget * 100 : null;

    u.setKPIs("kpi-financial-budget", [
      {label: "YTD Revenue", value: u.fmtEur(revActual), sub: "Budget: " + u.fmtEur(revBudgetYTD), delta: revVarPct, deltaLabel: "vs budget"},
      {label: "YTD Gross Profit", value: u.fmtEur(gpActual), sub: "Budget: " + u.fmtEur(gpBudgetYTD), delta: gpVarPct, deltaLabel: "vs budget"},
      {label: "YTD EBITDA", value: u.fmtEur(ebitdaActual), sub: "Budget: " + u.fmtEur(ebitdaBudgetYTD), delta: ebitdaVarPct, deltaLabel: "vs budget"},
      {label: "FY Revenue Forecast", value: u.fmtEur(fyRevForecast), sub: "Budget: " + u.fmtEur(fyRevBudget), delta: fyRevVarPct, deltaLabel: "vs budget"},
      {label: "FY EBITDA Forecast", value: u.fmtEur(fyEbitdaForecast), sub: "Budget: " + u.fmtEur(fyEbitdaBudget), delta: fyEbitdaVarPct, deltaLabel: "vs budget"}
    ]);
  }

  // Full refresh after editing a cell
  function refreshBudgetTab() {
    buildBudgetKPIs();
    buildBudgetBarChart();
    buildPnlTable();
    setTimeout(function(){ window.dispatchEvent(new Event("resize")); }, 50);
  }

  // Render on first tab view
  var budgetTabRendered = false;
  function renderBudgetTab() {
    if (budgetTabRendered) return;
    budgetTabRendered = true;
    refreshBudgetTab();
  }

  var origShowFinTab = window.showFinancialTab;
  window.showFinancialTab = function(tabId, btn) {
    origShowFinTab(tabId, btn);
    if (tabId === "budget") {
      // Delay render so container has dimensions after display:block
      setTimeout(function() {
        renderBudgetTab();
        window.dispatchEvent(new Event("resize"));
      }, 50);
    }
  };

  // Expose setBudgetScenario globally for HTML onclick handlers
  window.setBudgetScenario = setBudgetScenario;

})(window.Dashboard);
