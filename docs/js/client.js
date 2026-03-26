// ============================================================
// client.js — Client section charts & rendering
// ============================================================

(function(D) {
  var u = D.utils;
  var C = D.C;
  var DATA = D.DATA;
  var d3c = D.d3;
  D.contingentAdjusted = D.contingentAdjusted || false;

  function getBudgetRate() {
    var rate = 112;
    if (DATA.budget_target_rate) {
      var years = Object.keys(DATA.budget_target_rate);
      if (years.length > 0) rate = DATA.budget_target_rate[years[years.length - 1]] || 112;
    }
    return rate;
  }

  // --- Generic client horizontal bar renderer for D3 pager ---
  function renderClientEffRate(containerId, data, opts) {
    var budgetRate = getBudgetRate();
    var totalRev = data.reduce(function(s,d){return s+d.allocated_revenue},0);
    var totalHrs = data.reduce(function(s,d){return s+d.total_hours},0);
    var avgEff = totalHrs > 0 ? totalRev/totalHrs : 0;

    d3c.horizontalBar(containerId, data, Object.assign({
      yField: "client_name",
      xField: "effRate",
      colorFn: function(d) { return d3c.thresholdColor(d.effRate, budgetRate); },
      labelFn: function(d) { return "€" + d.effRate.toFixed(0); },
      labelColorFn: function(d) { return d3c.thresholdColorDark(d.effRate, budgetRate); },
      tooltipFn: function(d) {
        var acph = d.total_hours > 0 ? d.staff_cost / d.total_hours : 0;
        var margin = d.allocated_revenue > 0 ? (d.allocated_revenue - d.staff_cost) / d.allocated_revenue * 100 : 0;
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.client_name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Effective Rate</span><span style='font-weight:600;color:#1A1D21'>€" + d.effRate.toFixed(0) + "/hr</span>" +
          "<span>Avg Cost/Hr</span><span style='font-weight:500'>€" + acph.toFixed(0) + "/hr</span>" +
          "<span>Revenue</span><span style='font-weight:500'>€" + d3c.fmtNum(d.allocated_revenue) + "</span>" +
          "<span>Staff Cost</span><span style='font-weight:500'>€" + d3c.fmtNum(d.staff_cost) + "</span>" +
          "<span>Delivery Margin</span><span style='font-weight:500;" + (margin < 0 ? "color:#ef4444" : margin < 40 ? "color:#f59e0b" : "color:#10b981") + "'>" + margin.toFixed(1) + "%</span>" +
          "<span>Total hrs</span><span style='font-weight:500'>" + d3c.fmtNum(d.total_hours) + " (billable: " + d3c.fmtNum(d.billable_hours) + ")</span>" +
          "</div>";
      },
      target: budgetRate,
      targetLabel: "target €" + budgetRate,
      targetColor: C.budget,
      showDiamonds: true,
      avg: avgEff > 0 ? avgEff : null,
      avgLabel: "avg €" + Math.round(avgEff),
      xLabel: "Effective Rate (€/hr)",
      xFormat: function(d) { return "€" + d; },
      margin: {top: 24, right: 70, bottom: 36, left: 180},
      maxLabelLen: 28
    }, opts || {}));
  }

  function renderClientRate(containerId, data, opts) {
    var budgetRate = getBudgetRate();
    var totRev = data.reduce(function(s,d){return s+d.allocated_revenue},0);
    var totBill = data.reduce(function(s,d){return s+d.billable_hours},0);
    var avgRate = totBill > 0 ? totRev/totBill : 0;

    d3c.horizontalBar(containerId, data, Object.assign({
      yField: "client_name",
      xField: "arph",
      colorFn: function(d) { return d3c.thresholdColor(d.arph, budgetRate, {good:"#10b981",warn:"#f59e0b",bad:"#ef4444"}); },
      labelFn: function(d) { return "€" + d.arph.toFixed(0); },
      labelColorFn: function(d) { return d3c.thresholdColorDark(d.arph, budgetRate); },
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.client_name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Avg Rate</span><span style='font-weight:600;color:#1A1D21'>€" + d.arph.toFixed(0) + "/hr</span>" +
          "<span>Revenue</span><span style='font-weight:500'>€" + d3c.fmtNum(d.allocated_revenue) + "</span>" +
          "<span>Billable hrs</span><span style='font-weight:500'>" + d3c.fmtNum(d.billable_hours) + "</span>" +
          "</div>";
      },
      target: budgetRate,
      targetLabel: "target €" + budgetRate,
      targetColor: C.budget,
      showDiamonds: true,
      avg: avgRate > 0 ? avgRate : null,
      avgLabel: "avg €" + Math.round(avgRate),
      xLabel: "Avg Rate (€/hr)",
      xFormat: function(d) { return "€" + d; },
      margin: {top: 24, right: 70, bottom: 36, left: 180},
      maxLabelLen: 28
    }, opts || {}));
  }

  function renderClientCost(containerId, data, opts) {
    var totCost = data.reduce(function(s,d){return s+d.staff_cost},0);
    var totHrs = data.reduce(function(s,d){return s+d.total_hours},0);
    var avgACPH = totHrs > 0 ? totCost/totHrs : 0;

    d3c.horizontalBar(containerId, data, Object.assign({
      yField: "client_name",
      xField: "acph",
      colorFn: function(d) {
        // Lower cost is better, so invert threshold
        return d.acph <= avgACPH ? "#10b981" : d.acph <= avgACPH * 1.3 ? "#f59e0b" : "#ef4444";
      },
      labelFn: function(d) { return "€" + d.acph.toFixed(0); },
      labelColorFn: function(d) {
        return d.acph <= avgACPH ? "#059669" : d.acph <= avgACPH * 1.3 ? "#d97706" : "#dc2626";
      },
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.client_name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Cost/Hr</span><span style='font-weight:600;color:#1A1D21'>€" + d.acph.toFixed(0) + "</span>" +
          "<span>Staff Cost</span><span style='font-weight:500'>€" + d3c.fmtNum(d.staff_cost) + "</span>" +
          "<span>Hours</span><span style='font-weight:500'>" + d3c.fmtNum(d.total_hours) + "</span>" +
          "</div>";
      },
      avg: avgACPH > 0 ? avgACPH : null,
      avgLabel: "avg €" + Math.round(avgACPH),
      xLabel: "Cost/Hr (€)",
      xFormat: function(d) { return "€" + d; },
      margin: {top: 24, right: 70, bottom: 36, left: 180},
      maxLabelLen: 28
    }, opts || {}));
  }

  function renderClientROI(containerId, data, opts) {
    var totRev = data.reduce(function(s,d){return s+d.allocated_revenue},0);
    var totCost = data.reduce(function(s,d){return s+d.staff_cost},0);
    var avgMargin = totRev > 0 ? (totRev - totCost) / totRev * 100 : 0;

    d3c.horizontalBar(containerId, data, Object.assign({
      yField: "client_name",
      xField: "deliveryMargin",
      colorFn: function(d) { return d3c.thresholdColor(d.deliveryMargin, 60); },
      labelFn: function(d) { return d.deliveryMargin.toFixed(1) + "%"; },
      labelColorFn: function(d) { return d3c.thresholdColorDark(d.deliveryMargin, 60); },
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.client_name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Delivery Margin</span><span style='font-weight:600;color:#1A1D21'>" + d.deliveryMargin.toFixed(1) + "%</span>" +
          "<span>Revenue</span><span style='font-weight:500'>€" + d3c.fmtNum(d.allocated_revenue) + "</span>" +
          "<span>Cost</span><span style='font-weight:500'>€" + d3c.fmtNum(d.staff_cost) + "</span>" +
          "</div>";
      },
      avg: avgMargin,
      avgLabel: "avg " + avgMargin.toFixed(1) + "%",
      xLabel: "Delivery Margin %",
      xFormat: function(d) { return d + "%"; },
      margin: {top: 24, right: 70, bottom: 36, left: 180},
      maxLabelLen: 28
    }, opts || {}));
  }

  function renderClientMarginAbs(containerId, data, opts) {
    var totProfit = data.reduce(function(s,d){return s+d.absMargin},0);

    d3c.horizontalBar(containerId, data, Object.assign({
      yField: "client_name",
      xField: "absMargin",
      colorFn: function(d) { return d.absMargin >= 0 ? "#10b981" : "#ef4444"; },
      labelFn: function(d) { return "€" + d3c.fmtNum(d.absMargin); },
      labelColorFn: function(d) { return d.absMargin >= 0 ? "#059669" : "#dc2626"; },
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.client_name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Profit</span><span style='font-weight:600;color:" + (d.absMargin >= 0 ? "#059669" : "#dc2626") + "'>€" + d3c.fmtNum(d.absMargin) + "</span>" +
          "<span>Margin %</span><span style='font-weight:500'>" + d.deliveryMargin.toFixed(1) + "%</span>" +
          "<span>Revenue</span><span style='font-weight:500'>€" + d3c.fmtNum(d.allocated_revenue) + "</span>" +
          "<span>Staff Cost</span><span style='font-weight:500'>€" + d3c.fmtNum(d.staff_cost) + "</span>" +
          "<span>Hours</span><span style='font-weight:500'>" + d3c.fmtNum(d.total_hours) + "</span>" +
          "</div>";
      },
      avg: totProfit / (data.length || 1),
      avgLabel: "avg €" + d3c.fmtNum(totProfit / (data.length || 1)),
      xLabel: "Delivery Margin (€)",
      xFormat: function(d) { return "€" + d3c.fmtNum(d); },
      margin: {top: 24, right: 80, bottom: 36, left: 180},
      maxLabelLen: 28
    }, opts || {}));
  }

  function renderClientHours(containerId, data, opts) {
    d3c.stackedHorizontalBar(containerId, data, Object.assign({
      yField: "client_name",
      series: [
        {field: "billPct", label: "Billable", color: C.billable},
        {field: "nonBillPct", label: "Non-Billable", color: C.nonBillable}
      ],
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.client_name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Billable</span><span style='font-weight:600;color:#1A1D21'>" + d.billPct.toFixed(1) + "% (" + d3c.fmtNum(d.billable_hours) + "h)</span>" +
          "<span>Non-Billable</span><span style='font-weight:500'>" + d.nonBillPct.toFixed(1) + "% (" + d3c.fmtNum(d.total_hours - d.billable_hours) + "h)</span>" +
          "</div>";
      },
      xLabel: "% of Hours",
      xFormat: function(d) { return d + "%"; },
      margin: {top: 24, right: 50, bottom: 36, left: 180},
      maxLabelLen: 28
    }, opts || {}));
  }

  // === SECTION HANDLER ===
  D.registerSection("client", function(f) {
    var targetRate = (DATA.budget_target_rate && DATA.budget_target_rate[2026]) || 112;
    var opsTargetUtil = 57;
    if (DATA.budget_people) {
      var totalW = 0, weightedUtil = 0;
      DATA.budget_people.filter(function(p){return p.year===2026 && p.productive_name}).forEach(function(p) {
        var w = p.rate_target || targetRate;
        totalW += w;
        weightedUtil += (p.billability_target||0)*100*w;
      });
      if (totalW > 0) opsTargetUtil = weightedUtil / totalW;
    }
    var tEffTarget = opsTargetUtil / 100 * targetRate;

    // Client data from filtered monthly
    var cliMonthly = u.filterByMonth(DATA.client_monthly || [], "month", f.startMonth, f.endMonth);
    var cliMap = {};
    cliMonthly.forEach(function(r) {
      var key = r.client_name;
      if (!cliMap[key]) cliMap[key] = {client_name:key, total_hours:0, billable_hours:0, staff_cost:0, allocated_revenue:0, company_id:r.company_id||null, project_id:r.project_id||null};
      cliMap[key].total_hours += r.hours || 0;
      cliMap[key].billable_hours += r.billable_hours || 0;
      cliMap[key].staff_cost += r.staff_cost || 0;
      cliMap[key].allocated_revenue += r.revenue || 0;
    });
    var cliData = Object.values(cliMap).filter(function(c){ var n=(c.client_name||"").toLowerCase(); return c.client_name && n !== "leadstreet" && n !== "hubspot"; });
    // Build contingent lookup from DATA.clients
    var contingentMap = {};
    (DATA.clients || []).forEach(function(c) {
      contingentMap[c.client_name] = {
        has_contingent: !!c.has_contingent,
        contingent_excess: c.contingent_excess || 0,
        contingent_remaining: c.contingent_remaining || 0,
        adjusted_revenue: c.adjusted_revenue || 0,
        adjusted_margin: c.adjusted_margin || 0,
        adjusted_gross_margin: c.adjusted_gross_margin || 0
      };
    });
    cliData.forEach(function(c) {
      c.acph = c.total_hours > 0 ? c.staff_cost/c.total_hours : 0;
      c.arph = c.billable_hours > 0 ? c.allocated_revenue/c.billable_hours : 0;
      c.util = c.total_hours > 0 ? c.billable_hours/c.total_hours*100 : 0;
      c.roi = c.staff_cost > 0 ? c.allocated_revenue/c.staff_cost : 0;
      var cm = contingentMap[c.client_name];
      c.has_contingent = cm ? cm.has_contingent : false;
      c.contingent_excess = cm ? cm.contingent_excess : 0;
      c.contingent_remaining = cm ? cm.contingent_remaining : 0;
      c.adjusted_revenue = cm ? cm.adjusted_revenue : c.allocated_revenue;
      c.adjusted_margin = cm ? cm.adjusted_margin : 0;
      c.adjusted_gross_margin = cm ? cm.adjusted_gross_margin : 0;
    });

    // If contingent adjustment is active, subtract unearned remaining from revenue
    if (D.contingentAdjusted) {
      cliData.forEach(function(c) {
        if (c.has_contingent && c.contingent_excess > 0) {
          c.allocated_revenue = Math.max(0, c.allocated_revenue - c.contingent_excess);
        }
      });
      cliData.forEach(function(c) {
        c.arph = c.billable_hours > 0 ? c.allocated_revenue / c.billable_hours : 0;
        c.roi = c.staff_cost > 0 ? c.allocated_revenue / c.staff_cost : 0;
      });
    }

    // KPIs
    var totalCliHrs = cliData.reduce(function(s,d){return s+d.total_hours},0);
    var totalCliBill = cliData.reduce(function(s,d){return s+d.billable_hours},0);
    var totalCliRev = cliData.reduce(function(s,d){return s+d.allocated_revenue},0);
    var totalCliCost = cliData.reduce(function(s,d){return s+d.staff_cost},0);
    var avgCliMargin = totalCliRev > 0 ? (totalCliRev - totalCliCost) / totalCliRev * 100 : 0;
    var cliLosing = cliData.filter(function(c){ var m = c.allocated_revenue > 0 ? (c.allocated_revenue - c.staff_cost) / c.allocated_revenue * 100 : (c.staff_cost > 0 ? -100 : 0); return m < 0; }).length;
    var cliBelowTarget = cliData.filter(function(c){ var m = c.allocated_revenue > 0 ? (c.allocated_revenue - c.staff_cost) / c.allocated_revenue * 100 : (c.staff_cost > 0 ? -100 : 0); return m >= 0 && m < 40; }).length;
    u.setKPIs("kpi-client", [
      {label:"Active Clients", value:String(cliData.length)},
      {label:"Losing Money", value:String(cliLosing)+" clients", color:cliLosing>0?C.overbudget:C.onTrack},
      {label:"Below Target", value:String(cliBelowTarget)+" clients", color:cliBelowTarget>0?C.warning:C.onTrack},
      {label:"Delivery Margin", value:avgCliMargin.toFixed(1)+"%", color:avgCliMargin>=40?C.onTrack:C.overbudget}
    ]);

    // --- Paginated horizontal bars (all clients, no limit) ---
    var cliTop = cliData.slice().sort(function(a,b){ return b.total_hours - a.total_hours; });

    // Prepare data for each chart
    var effRateData = cliTop.slice().filter(function(d){ return d.allocated_revenue > 0 && d.total_hours > 0; }).map(function(d) {
      var copy = Object.assign({}, d);
      copy.effRate = copy.allocated_revenue / copy.total_hours;
      return copy;
    }).sort(function(a,b){ return a.effRate - b.effRate; });

    var rateData = cliTop.slice().filter(function(d){ return d.billable_hours > 0; }).sort(function(a,b){ return a.arph - b.arph; });

    var costData = cliTop.slice().filter(function(d){ return d.total_hours > 0; }).sort(function(a,b){ return b.acph - a.acph; });

    var roiDataBase = cliTop.slice().filter(function(d){ return d.staff_cost > 0; }).map(function(d) {
      var copy = Object.assign({}, d);
      copy.deliveryMargin = copy.allocated_revenue > 0 ? (copy.allocated_revenue - copy.staff_cost) / copy.allocated_revenue * 100 : (copy.staff_cost > 0 ? -100 : 0);
      copy.absMargin = copy.allocated_revenue - copy.staff_cost;
      return copy;
    });
    var roiData = roiDataBase.slice().sort(function(a,b){ return a.deliveryMargin - b.deliveryMargin; });
    var absMarginData = roiDataBase.slice().sort(function(a,b){ return a.absMargin - b.absMargin; });

    var hoursData = cliTop.slice().filter(function(d){ return d.client_name.toLowerCase().indexOf("leadstreet") === -1 && d.client_name.toLowerCase().indexOf("hubspot") === -1 && d.total_hours > 0; }).map(function(d) {
      var copy = Object.assign({}, d);
      copy.billPct = copy.billable_hours / copy.total_hours * 100;
      copy.nonBillPct = 100 - copy.billPct;
      return copy;
    }).sort(function(a,b){ return a.nonBillPct - b.nonBillPct; });

    // Global averages across ALL clients (not just displayed page)
    var globalEffRev = effRateData.reduce(function(s,d){return s+d.allocated_revenue},0);
    var globalEffHrs = effRateData.reduce(function(s,d){return s+d.total_hours},0);
    var globalEffAvg = globalEffHrs > 0 ? globalEffRev/globalEffHrs : 0;
    var globalRateRev = rateData.reduce(function(s,d){return s+d.allocated_revenue},0);
    var globalRateBill = rateData.reduce(function(s,d){return s+d.billable_hours},0);
    var globalRateAvg = globalRateBill > 0 ? globalRateRev/globalRateBill : 0;
    var globalCostTotal = costData.reduce(function(s,d){return s+d.staff_cost},0);
    var globalCostHrs = costData.reduce(function(s,d){return s+d.total_hours},0);
    var globalCostAvg = globalCostHrs > 0 ? globalCostTotal/globalCostHrs : 0;
    var globalRoiRev = roiData.reduce(function(s,d){return s+d.allocated_revenue},0);
    var globalRoiCost = roiData.reduce(function(s,d){return s+d.staff_cost},0);
    var globalRoiAvg = globalRoiRev > 0 ? (globalRoiRev - globalRoiCost) / globalRoiRev * 100 : 0;
    var globalAbsProfit = absMarginData.reduce(function(s,d){return s+d.absMargin},0);
    var globalAbsAvg = absMarginData.length > 0 ? globalAbsProfit / absMarginData.length : 0;

    // Click handler to open client in Productive
    var prodClick = function(d) {
      if (d.project_id && d.company_id) {
        window.open(D.PROD_BASE + "/projects/" + d.project_id + "/budgets/company/" + d.company_id + "/", "_blank");
      }
    };

    // Setup D3 pagers
    u.setupCliPager("chart-cli-margin-abs", {renderFn: renderClientMarginAbs, fullData: absMarginData, opts: {avg: globalAbsAvg, avgLabel: "avg €" + d3c.fmtNum(globalAbsAvg), onClick: prodClick}});
    u.setupCliPager("chart-cli-roi", {renderFn: renderClientROI, fullData: roiData, opts: {avg: globalRoiAvg, avgLabel: "avg " + globalRoiAvg.toFixed(1) + "%", onClick: prodClick}});
    u.setupCliPager("chart-cli-util", {renderFn: renderClientEffRate, fullData: effRateData, opts: {avg: globalEffAvg, avgLabel: "avg €" + Math.round(globalEffAvg), onClick: prodClick}});
    u.setupCliPager("chart-cli-arph", {renderFn: renderClientRate, fullData: rateData, opts: {avg: globalRateAvg, avgLabel: "avg €" + Math.round(globalRateAvg), onClick: prodClick}});
    u.setupCliPager("chart-cli-acph", {renderFn: renderClientCost, fullData: costData, opts: {avg: globalCostAvg, avgLabel: "avg €" + Math.round(globalCostAvg), onClick: prodClick}});
    u.setupCliPager("chart-cli-hours", {renderFn: renderClientHours, fullData: hoursData, opts: {onClick: prodClick}});

    // Margin scatterplot: top 20 clients by revenue — absolute € vs %
    var scatterData = roiDataBase.filter(function(d){ return d.allocated_revenue > 0; }).sort(function(a,b){ return b.allocated_revenue - a.allocated_revenue; }).slice(0, 20).map(function(d) {
      return {
        client_name: d.client_name,
        x: d.absMargin,
        y: d.deliveryMargin,
        revenue: d.allocated_revenue,
        staff_cost: d.staff_cost,
        total_hours: d.total_hours,
        project_id: d.project_id,
        company_id: d.company_id,
        has_contingent: d.has_contingent || false,
        contingent_remaining: d.contingent_remaining || 0
      };
    });

    // Show/hide explainer and info
    var contingentCount = cliData.filter(function(d){ return d.has_contingent; }).length;
    var explainerEl = document.getElementById("contingent-explainer");
    var infoEl = document.getElementById("contingent-info");
    if (explainerEl) explainerEl.style.display = contingentCount > 0 ? "block" : "none";
    if (infoEl && contingentCount > 0) infoEl.textContent = contingentCount + " contingent client" + (contingentCount > 1 ? "s" : "") + " detected" + (D.contingentAdjusted ? " \u2014 showing adjusted values" : "");

    d3c.scatter("chart-cli-margin-scatter", scatterData, {
      xField: "x", yField: "y",
      sizeField: "revenue",
      colorFn: function(d) { return d.y >= 40 ? "#10b981" : d.y >= 0 ? "#f59e0b" : "#ef4444"; },
      textField: "client_name",
      strokeDashFn: function(d) { return d.has_contingent ? "5,3" : "none"; },
      tooltipFn: function(d) {
        var html = "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.client_name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Profit</span><span style='font-weight:600;color:" + (d.x >= 0 ? "#059669" : "#dc2626") + "'>€" + d3c.fmtNum(d.x) + "</span>" +
          "<span>Margin %</span><span style='font-weight:600'>" + d.y.toFixed(1) + "%</span>" +
          "<span>Revenue</span><span style='font-weight:500'>€" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Staff Cost</span><span style='font-weight:500'>€" + d3c.fmtNum(d.staff_cost) + "</span>" +
          "<span>Hours</span><span style='font-weight:500'>" + d3c.fmtNum(d.total_hours) + "</span>" +
          "</div>";
        if (d.has_contingent) {
          var remLabel = d.contingent_remaining >= 0
            ? "€" + d3c.fmtNum(d.contingent_remaining) + " unearned (remaining)"
            : "€" + d3c.fmtNum(Math.abs(d.contingent_remaining)) + " over-consumed";
          html += "<div style='margin-top:6px;padding-top:6px;border-top:1px solid #FDE68A;color:#92400E;font-size:11px'>" +
            "<strong>Contingent: " + remLabel + "</strong>" +
            (D.contingentAdjusted ? "<br><span style='color:#6B7280'>Showing adjusted values</span>" : "") +
            "</div>";
        }
        return html;
      },
      onClick: function(d) {
        if (d.project_id && d.company_id) {
          window.open(D.PROD_BASE + "/projects/" + d.project_id + "/budgets/company/" + d.company_id + "/", "_blank");
        }
      },
      xLabel: "Absolute Margin (€)",
      yLabel: "Delivery Margin (%)",
      xFormat: function(d) { return "€" + d3c.fmtNum(d); },
      yFormat: function(d) { return d + "%"; },
      refLines: [
        {axis: "y", value: 40, color: "#10b981", dash: true, label: "40% target"},
        {axis: "x", value: 0, color: "#94A3B8", dash: false, label: ""}
      ],
      minSize: 6, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 80},
      height: 450
    });

    // Wire contingent toggle to re-render entire section
    var toggleEl = document.getElementById("contingent-toggle");
    if (toggleEl) {
      toggleEl.checked = D.contingentAdjusted;
      toggleEl.onchange = function() {
        D.contingentAdjusted = this.checked;
        applyFilters();
      };
    }

    // --- Client Revenue Leaks ---
    (function() {
      var cliLeaks = cliData.map(function(c) {
        var effRate = c.total_hours > 0 ? c.allocated_revenue / c.total_hours : 0;
        var costPerHr = c.acph || 0;
        return {name: c.client_name, hours: c.total_hours, billable: c.billable_hours, revenue: c.allocated_revenue || 0, cost: c.staff_cost, effRate: effRate, costPerHr: costPerHr, margin: effRate - costPerHr, losing: effRate < costPerHr && c.allocated_revenue > 0, companyId: c.company_id||null, projectId: c.project_id||null};
      }).filter(function(c) { var n=(c.name||"").toLowerCase(); return c.hours > 15 && c.name && n !== "leadstreet" && n !== "hubspot"; }).sort(function(a,b) { return a.effRate - b.effRate; });
      var losers = cliLeaks.filter(function(c) { return c.losing; });
      var belowTarget = cliLeaks.filter(function(c) { return !c.losing && c.effRate > 0 && c.effRate < tEffTarget; });
      var html = '<div class="chart-card-header">Client Revenue Leaks</div>';
      html += '<div class="chart-desc">Clients where effective rate (revenue ÷ total hours) is below staff cost or target. Sorted worst first.</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px">';
      html += '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px 20px">';
      html += '<div style="font-weight:600;color:#991B1B;margin-bottom:10px;font-size:13px">Losing Money (eff rate &lt; staff cost)</div>';
      html += '<table style="width:100%;font-size:11px;border-collapse:collapse">';
      if (losers.length > 0) {
        losers.forEach(function(c) {
          html += '<tr style="border-bottom:1px solid #FEE2E2"><td style="padding:3px 0">' + u.prodLink(c.name, c.projectId, c.companyId, 30) + '</td>';
          html += '<td style="text-align:right;padding:3px 4px">' + Math.round(c.hours) + 'h</td>';
          html += '<td style="text-align:right;padding:3px 0;color:#DC2626;font-weight:600">€' + Math.round(c.effRate) + ' vs €' + Math.round(c.costPerHr) + ' cost</td></tr>';
        });
      } else {
        html += '<tr><td style="padding:3px 0;color:#6B7280">None — all clients cover staff cost</td></tr>';
      }
      html += '</table></div>';
      html += '<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px 20px">';
      html += '<div style="font-weight:600;color:#92400E;margin-bottom:10px;font-size:13px">Below €' + Math.round(tEffTarget) + ' Target</div>';
      html += '<table style="width:100%;font-size:11px;border-collapse:collapse">';
      if (belowTarget.length > 0) {
        belowTarget.slice(0,10).forEach(function(c) {
          html += '<tr style="border-bottom:1px solid #FEF3C7"><td style="padding:3px 0">' + u.prodLink(c.name, c.projectId, c.companyId, 30) + '</td>';
          html += '<td style="text-align:right;padding:3px 4px">' + Math.round(c.hours) + 'h</td>';
          html += '<td style="text-align:right;padding:3px 0;color:#92400E">€' + Math.round(c.effRate) + '/h (€' + Math.round(c.margin) + ' margin)</td></tr>';
        });
        if (belowTarget.length > 10) html += '<tr><td colspan="3" style="padding:3px 0;color:#6B7280">... and ' + (belowTarget.length-10) + ' more</td></tr>';
      } else {
        html += '<tr><td style="padding:3px 0;color:#6B7280">All clients above target</td></tr>';
      }
      html += '</table></div>';
      html += '</div>';
      document.getElementById("cli-revenue-leaks").innerHTML = html;
    })();
  });
})(window.Dashboard);
