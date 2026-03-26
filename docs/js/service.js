// ============================================================
// service.js — Service Type (Project) section charts & rendering
// ============================================================

(function(D) {
  var u = D.utils;
  var C = D.C;
  var DATA = D.DATA;
  var d3c = D.d3;
  var PROD_BASE = D.PROD_BASE;

  // --- Helper: get budget target rate ---
  function getBudgetRate() {
    var rate = 112;
    if (DATA.budget_target_rate) {
      var years = Object.keys(DATA.budget_target_rate);
      if (years.length > 0) rate = DATA.budget_target_rate[years[years.length - 1]] || 112;
    }
    return rate;
  }

  // --- Helper: service metric color ---
  function metricColorFn(metric, budgetRate) {
    return function(d) {
      if (metric === "roi") return d._val >= 60 ? "#10b981" : d._val >= 40 ? "#f59e0b" : "#ef4444";
      if (metric === "util") return d._val >= 60 ? "#10b981" : d._val >= 40 ? "#f59e0b" : "#ef4444";
      if (metric === "effrate") return d._val >= budgetRate ? "#10b981" : d._val >= budgetRate * 0.8 ? "#f59e0b" : "#ef4444";
      if (metric === "arph") return d._val >= budgetRate ? "#10b981" : d._val >= budgetRate * 0.8 ? "#f59e0b" : "#ef4444";
      if (metric === "acph") {
        // Lower cost is better
        var avg = d._avg || 50;
        return d._val <= avg * 0.8 ? "#10b981" : d._val <= avg * 1.2 ? "#f59e0b" : "#ef4444";
      }
      return "#64748b";
    };
  }

  // --- Helper: tooltip builder for service metrics ---
  function svcTooltipFn(metric) {
    return function(d) {
      var lines = [
        "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.label + "</div>",
        "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>"
      ];
      if (metric === "effrate") {
        lines.push("<span>Effective Rate</span><span style='font-weight:600;color:#1A1D21'>€" + d._val.toFixed(0) + "/hr</span>");
        var arph = d._raw.billable_hours > 0 ? d._raw.allocated_revenue / d._raw.billable_hours : 0;
        lines.push("<span>ARPH</span><span style='font-weight:500'>€" + arph.toFixed(0) + "/hr</span>");
      } else if (metric === "arph") {
        lines.push("<span>Avg Rate</span><span style='font-weight:600;color:#1A1D21'>€" + d._val.toFixed(0) + "/hr</span>");
      } else if (metric === "acph") {
        lines.push("<span>Cost/Hr</span><span style='font-weight:600;color:#1A1D21'>€" + d._val.toFixed(0) + "/hr</span>");
      } else if (metric === "roi") {
        lines.push("<span>Delivery Margin</span><span style='font-weight:600;color:#1A1D21'>" + d._val.toFixed(1) + "%</span>");
      }
      lines.push("<span>Revenue</span><span style='font-weight:500'>€" + (d._raw.allocated_revenue || 0).toLocaleString("en", {maximumFractionDigits: 0}) + "</span>");
      lines.push("<span>Total hrs</span><span style='font-weight:500'>" + d._raw.total_hours.toLocaleString("en", {maximumFractionDigits: 0}) + "</span>");
      lines.push("<span>Billable hrs</span><span style='font-weight:500'>" + d._raw.billable_hours.toLocaleString("en", {maximumFractionDigits: 0}) + "</span>");
      lines.push("</div>");
      return lines.join("");
    };
  }

  // --- Render service metric bar chart (ARPH, ACPH, ROI, Effective Rate) ---
  function renderServiceMetric(containerId, svcData, metric, title) {
    var budgetRate = getBudgetRate();

    var sorted = svcData.slice().map(function(d) {
      var copy = Object.assign({}, d);
      if (copy.util == null) copy.util = 0;
      if (copy.arph == null) copy.arph = 0;
      if (copy.acph == null) copy.acph = 0;
      copy.roi = (copy.allocated_revenue || 0) > 0 ? ((copy.allocated_revenue - copy.staff_cost) / copy.allocated_revenue * 100) : (copy.staff_cost > 0 ? -100 : 0);
      if (metric === "effrate") copy.effRate = copy.total_hours > 0 ? copy.allocated_revenue / copy.total_hours : 0;
      return copy;
    });

    if (metric === "effrate") {
      sorted = sorted.filter(function(d) { return d.allocated_revenue > 0 && d.total_hours > 0; });
    }
    sorted.sort(function(a, b) {
      var aVal = metric === "effrate" ? a.effRate : a[metric];
      var bVal = metric === "effrate" ? b.effRate : b[metric];
      return aVal - bVal;
    });

    // Compute weighted average
    var totHrs = sorted.reduce(function(s, d) { return s + (d.total_hours || 0); }, 0);
    var totBill = sorted.reduce(function(s, d) { return s + (d.billable_hours || 0); }, 0);
    var totCost = sorted.reduce(function(s, d) { return s + (d.staff_cost || 0); }, 0);
    var totRev = sorted.reduce(function(s, d) { return s + (d.allocated_revenue || 0); }, 0);
    var avg = 0, avgLabel = "";
    if (metric === "effrate") { avg = totHrs > 0 ? totRev / totHrs : 0; avgLabel = "avg €" + Math.round(avg); }
    else if (metric === "util") { avg = totHrs > 0 ? totBill / totHrs * 100 : 0; avgLabel = "avg " + avg.toFixed(0) + "%"; }
    else if (metric === "arph") { avg = totBill > 0 ? totRev / totBill : 0; avgLabel = "avg €" + Math.round(avg); }
    else if (metric === "acph") { avg = totHrs > 0 ? totCost / totHrs : 0; avgLabel = "avg €" + Math.round(avg); }
    else if (metric === "roi") { avg = totRev > 0 ? (totRev - totCost) / totRev * 100 : 0; avgLabel = "avg " + avg.toFixed(1) + "%"; }

    // Transform to library format
    var barData = sorted.map(function(d) {
      var val = metric === "effrate" ? d.effRate : d[metric];
      return {
        label: d.service_type,
        value: val || 0,
        _val: val || 0,
        _avg: avg,
        _raw: d
      };
    });

    var showTarget = (metric === "arph" || metric === "effrate");
    var showDiamonds = showTarget;
    var targetVal = showTarget ? budgetRate : null;
    var targetLbl = showTarget ? "target €" + budgetRate : "";

    var isPercent = (metric === "roi" || metric === "util");

    d3c.horizontalBar(containerId, barData, {
      yField: "label",
      xField: "value",
      colorFn: metricColorFn(metric, budgetRate),
      labelFn: function(d) {
        return isPercent ? d.value.toFixed(1) + "%" : "€" + d.value.toFixed(0);
      },
      labelColorFn: function(d) {
        if (metric === "acph") {
          var avg2 = d._avg || 50;
          return d._val <= avg2 * 0.8 ? "#059669" : d._val <= avg2 * 1.2 ? "#d97706" : "#dc2626";
        }
        return d3c.thresholdColorDark(d._val, metric === "arph" || metric === "effrate" ? budgetRate : 60);
      },
      tooltipFn: svcTooltipFn(metric),
      target: targetVal,
      targetLabel: targetLbl,
      targetColor: C.budget,
      showDiamonds: showDiamonds,
      avg: avg > 0 ? avg : null,
      avgLabel: avgLabel,
      xLabel: title,
      xFormat: function(d) { return isPercent ? d + "%" : "€" + d; },
      margin: {top: 24, right: 70, bottom: 36, left: 150}
    });
  }

  // --- Render service trend chart (D3 line) ---
  function renderServiceTrend(containerId, monthlyData, metric, title) {
    var map = {};
    var monthSet = {};
    monthlyData.forEach(function(r) {
      var st = r.service_type || "(no type)";
      var m = (r.month || "").substring(0, 7);
      if (!m) return;
      monthSet[m] = true;
      if (!map[st]) map[st] = {};
      if (!map[st][m]) map[st][m] = {hours: 0, billable_hours: 0, staff_cost: 0, revenue: 0};
      map[st][m].hours += r.hours || 0;
      map[st][m].billable_hours += r.billable_hours || 0;
      map[st][m].staff_cost += r.staff_cost || 0;
      map[st][m].revenue += r.revenue || 0;
    });
    var months = Object.keys(monthSet).sort();
    var svcTypes = Object.keys(map).sort();

    function calcMetric(d) {
      if (metric === "effrate") return d.hours > 1 ? d.revenue / d.hours : null;
      if (metric === "arph") return d.billable_hours > 1 ? d.revenue / d.billable_hours : null;
      if (metric === "acph") return d.hours > 1 ? d.staff_cost / d.hours : null;
      if (metric === "roi") return d.revenue > 1 ? (d.revenue - d.staff_cost) / d.revenue * 100 : null;
      return null;
    }

    var abbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    // Build flat data array: each row is a month with all service type values
    var flatData = months.map(function(m) {
      var parts = m.split("-");
      var row = {month: abbr[parseInt(parts[1], 10) - 1] + " '" + parts[0].substring(2)};
      svcTypes.forEach(function(st) {
        row[st] = map[st][m] ? calcMetric(map[st][m]) : null;
      });
      // Weighted average
      var totH = 0, totB = 0, totC = 0, totR = 0;
      svcTypes.forEach(function(st) {
        if (map[st][m]) {
          totH += map[st][m].hours;
          totB += map[st][m].billable_hours;
          totC += map[st][m].staff_cost;
          totR += map[st][m].revenue;
        }
      });
      row._avg = calcMetric({hours: totH, billable_hours: totB, staff_cost: totC, revenue: totR});
      return row;
    });

    // Build series config
    var series = [];
    svcTypes.forEach(function(st) {
      var hasData = flatData.some(function(r) { return r[st] != null; });
      if (!hasData) return;
      series.push({field: st, label: st, color: u.getSvcColor(st), width: 2});
    });
    series.push({field: "_avg", label: "Weighted Avg", color: "#94A3B8", width: 2.5, dash: "6,3"});

    var budgetRate = getBudgetRate();
    var showTarget = (metric === "effrate" || metric === "arph");

    var isPercent = (metric === "roi");

    d3c.lineTrend(containerId, flatData, {
      xField: "month",
      series: series,
      target: showTarget ? budgetRate : null,
      targetLabel: showTarget ? "Target €" + budgetRate : null,
      yFormat: function(d) { return isPercent ? d.toFixed(0) + "%" : "€" + Math.round(d); },
      tooltipFn: function(d) {
        var lines = ["<div style='font-weight:600;margin-bottom:4px'>" + d.month + "</div>"];
        series.forEach(function(sr) {
          var v = d[sr.field];
          if (v == null) return;
          var formatted = isPercent ? v.toFixed(1) + "%" : "€" + Math.round(v);
          lines.push("<div style='display:flex;gap:6px;align-items:center'><span style='display:inline-block;width:8px;height:8px;border-radius:50%;background:" + sr.color + "'></span><span style='color:#5F6B7A'>" + sr.label + "</span> <span style='font-weight:600'>" + formatted + "</span></div>");
        });
        return lines.join("");
      },
      margin: {top: 16, right: 40, bottom: 70, left: 60},
      height: 400
    });
  }

  // --- Render service type scatterplot: Revenue vs Delivery Margin % ---
  function renderServiceScatter(containerId, svcData) {
    var scData = svcData.filter(function(d) {
      return d.allocated_revenue > 0;
    }).map(function(d) {
      var marginPct = d.allocated_revenue > 0
        ? (d.allocated_revenue - d.staff_cost) / d.allocated_revenue * 100
        : 0;
      return {
        x: d.allocated_revenue,
        y: marginPct,
        hours: d.total_hours,
        name: d.service_type,
        revenue: d.allocated_revenue,
        staff_cost: d.staff_cost,
        total_hours: d.total_hours,
        billable_hours: d.billable_hours
      };
    });

    if (scData.length === 0) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "<div style='padding:40px;color:#94A3B8;text-align:center;font-size:12px'>No data</div>";
      return;
    }

    var sortedRev = scData.map(function(d) { return d.x; }).sort(function(a, b) { return a - b; });
    var sortedMargin = scData.map(function(d) { return d.y; }).sort(function(a, b) { return a - b; });
    var medianRev = sortedRev[Math.floor(sortedRev.length / 2)] || 0;
    var medianMargin = sortedMargin[Math.floor(sortedMargin.length / 2)] || 0;

    d3c.scatter(containerId, scData, {
      xField: "x", yField: "y",
      sizeField: "hours",
      colorFn: function(d) {
        return d.y >= 40 ? "#10b981" : d.y >= 0 ? "#f59e0b" : "#ef4444";
      },
      textField: "name",
      tooltipFn: function(d) {
        var absMargin = d.revenue - d.staff_cost;
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Revenue</span><span style='font-weight:600;color:#1A1D21'>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Delivery Margin</span><span style='font-weight:600;color:#1A1D21'>" + d.y.toFixed(1) + "%</span>" +
          "<span>Margin (\u20AC)</span><span style='font-weight:500'>\u20AC" + d3c.fmtNum(Math.round(absMargin)) + "</span>" +
          "<span>Staff Cost</span><span style='font-weight:500'>\u20AC" + d3c.fmtNum(Math.round(d.staff_cost)) + "</span>" +
          "<span>Total hrs</span><span style='font-weight:500'>" + d3c.fmtNum(d.total_hours) + "</span>" +
          "<span>Billable hrs</span><span style='font-weight:500'>" + d3c.fmtNum(d.billable_hours) + "</span>" +
          "</div>";
      },
      xLabel: "Revenue (\u20AC)",
      yLabel: "Delivery Margin (%)",
      xFormat: function(d) { return "\u20AC" + d3c.fmtNum(d); },
      yFormat: function(d) { return d + "%"; },
      refLines: [
        {axis: "x", value: medianRev, color: "#CBD5E1", dash: "4,3", label: "Median"},
        {axis: "y", value: medianMargin, color: "#CBD5E1", dash: "4,3", label: "Median"}
      ],
      quadrants: [
        {x: 0.02, y: 0.98, text: "Low Rev, Low Margin", anchor: "start"},
        {x: 0.98, y: 0.98, text: "High Rev, Low Margin", anchor: "end"},
        {x: 0.02, y: 0.02, text: "Niche, High Margin", anchor: "start"},
        {x: 0.98, y: 0.02, text: "Stars", anchor: "end"}
      ],
      minSize: 8, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 80},
      height: 450
    });
  }

  // --- LS Apps & Marketplace toggle (R&D, excluded by default) ---
  if (D.includeLsApps == null) D.includeLsApps = false;
  window.toggleLsApps = function(checked) {
    D.includeLsApps = checked;
    applyFilters();
  };

  // --- Heatmap: Service Type Evolution ---
  if (!D.svcHeatMetric) D.svcHeatMetric = "revenue";

  window.switchSvcHeatMetric = function(btn) {
    D.svcHeatMetric = btn.getAttribute("data-heatmetric");
    btn.parentNode.querySelectorAll(".metric-toggle").forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    applyFilters();
  };

  function renderServiceHeatmap(containerId, stmData, heatMetric) {
    // Aggregate by service_type × month
    var map = {};
    var monthSet = {};
    stmData.forEach(function(r) {
      var st = r.service_type || "(no type)";
      var m = (r.month || "").substring(0, 7);
      if (!m) return;
      monthSet[m] = true;
      if (!map[st]) map[st] = {};
      if (!map[st][m]) map[st][m] = {revenue: 0, staff_cost: 0, hours: 0};
      map[st][m].revenue += r.revenue || 0;
      map[st][m].staff_cost += r.staff_cost || 0;
      map[st][m].hours += r.hours || 0;
    });

    var months = Object.keys(monthSet).sort();
    var abbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var xLabels = months.map(function(m) {
      var parts = m.split("-");
      return abbr[parseInt(parts[1], 10) - 1] + " '" + parts[0].substring(2);
    });

    // Compute cell values
    function cellVal(cell) {
      if (!cell) return null;
      if (heatMetric === "revenue") return cell.revenue;
      if (heatMetric === "margin") return cell.revenue - cell.staff_cost;
      if (heatMetric === "marginpct") return cell.revenue > 0 ? (cell.revenue - cell.staff_cost) / cell.revenue * 100 : (cell.staff_cost > 0 ? -100 : null);
      return null;
    }

    // Sort service types by total metric value descending
    var svcTypes = Object.keys(map);
    svcTypes.sort(function(a, b) {
      var totA = 0, totB = 0;
      months.forEach(function(m) {
        var va = cellVal(map[a][m]); if (va != null) totA += va;
        var vb = cellVal(map[b][m]); if (vb != null) totB += vb;
      });
      return totB - totA;
    });

    // Build total row first
    var totalLabel = "TOTAL";
    map[totalLabel] = {};
    months.forEach(function(m) {
      var tot = {revenue: 0, staff_cost: 0, hours: 0};
      svcTypes.forEach(function(st) {
        if (map[st][m]) {
          tot.revenue += map[st][m].revenue;
          tot.staff_cost += map[st][m].staff_cost;
          tot.hours += map[st][m].hours;
        }
      });
      map[totalLabel][m] = tot;
    });

    var yLabels = [totalLabel].concat(svcTypes);
    var zMatrix = [];
    var textMatrix = [];

    function fmtCell(v) {
      if (v == null) return "";
      if (heatMetric === "marginpct") return Math.round(v) + "%";
      return "\u20AC" + d3c.fmtNum(Math.round(v));
    }

    yLabels.forEach(function(st) {
      var zRow = [];
      var tRow = [];
      months.forEach(function(m) {
        var v = cellVal(map[st][m]);
        zRow.push(v);
        tRow.push(fmtCell(v));
      });
      zMatrix.push(zRow);
      textMatrix.push(tRow);
    });

    // Render heatmap with neutral placeholder color (we recolor per-column after)
    d3c.heatmap(containerId, null, {
      xLabels: xLabels,
      yLabels: yLabels,
      zMatrix: zMatrix,
      textMatrix: textMatrix,
      colorScale: [[0, "#d1fae5"], [1, "#059669"]],
      tooltipFn: function(cell) {
        var st = cell.yLabel;
        var m = months[cell.col];
        var d = map[st] && map[st][m];
        if (!d) return "<b>" + st + "</b> — " + cell.xLabel + "<br>No data";
        var marginEur = d.revenue - d.staff_cost;
        var marginPct = d.revenue > 0 ? marginEur / d.revenue * 100 : (d.staff_cost > 0 ? -100 : 0);
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + st + "</div>" +
          "<div style='font-size:11px;color:#94A3B8;margin-bottom:4px'>" + cell.xLabel + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Revenue</span><span style='font-weight:600;color:#1A1D21'>\u20AC" + d3c.fmtNum(Math.round(d.revenue)) + "</span>" +
          "<span>Staff Cost</span><span style='font-weight:500'>\u20AC" + d3c.fmtNum(Math.round(d.staff_cost)) + "</span>" +
          "<span>Margin (\u20AC)</span><span style='font-weight:600;color:" + (marginEur >= 0 ? "#059669" : "#dc2626") + "'>\u20AC" + d3c.fmtNum(Math.round(marginEur)) + "</span>" +
          "<span>Margin (%)</span><span style='font-weight:500'>" + marginPct.toFixed(1) + "%</span>" +
          "<span>Hours</span><span style='font-weight:500'>" + d3c.fmtNum(Math.round(d.hours)) + "</span>" +
          "</div>";
      },
      cellH: 34,
      cellFontSize: 10,
      margin: {top: 30, right: 20, bottom: 50, left: 180}
    });

    // --- Per-column coloring: each month colored relative to that month's range ---
    var container = document.getElementById(containerId);
    if (!container) return;
    var svg = container.querySelector("svg");
    if (!svg) return;

    // Compute per-column min/max (skip TOTAL row = index 0 for service rows only)
    var numCols = months.length;
    var colStats = [];
    for (var ci = 0; ci < numCols; ci++) {
      var colVals = [];
      // Use service type rows (skip TOTAL at index 0) for the column scale
      for (var ri = 1; ri < yLabels.length; ri++) {
        var v = zMatrix[ri][ci];
        if (v != null) colVals.push(v);
      }
      colStats.push({
        min: d3.min(colVals) || 0,
        max: d3.max(colVals) || 1
      });
    }

    // Recolor all service-type cells per-column
    d3.select(svg).selectAll(".hm-cell").filter(function(d) { return d.row > 0; })
      .attr("fill", function(d) {
        if (d.z == null) return "#f5f5f5";
        // Override: any negative value = dark red
        if (d.z < 0) return "#991b1b";
        var cs = colStats[d.col];
        var cMin = Math.max(cs.min, 0); // Only scale positive range
        var cMax = cs.max;
        var t = cMax > cMin ? (d.z - cMin) / (cMax - cMin) : 0.5;
        t = Math.max(0, Math.min(1, t));
        return d3.interpolateRgb("#d1fae5", "#059669")(t);
      });

    // Recolor TOTAL row: blue per-column scale
    var totStats = {vals: []};
    for (var ci2 = 0; ci2 < numCols; ci2++) {
      var tv = zMatrix[0][ci2];
      if (tv != null) totStats.vals.push(tv);
    }
    var totMin = d3.min(totStats.vals) || 0;
    var totMax = d3.max(totStats.vals) || 1;

    d3.select(svg).selectAll(".hm-cell").filter(function(d) { return d.row === 0; })
      .attr("fill", function(d) {
        if (d.z == null) return "#f5f5f5";
        if (d.z < 0) return "#991b1b";
        var tMin = Math.max(totMin, 0);
        var t = totMax > tMin ? (d.z - tMin) / (totMax - tMin) : 0.5;
        t = Math.max(0, Math.min(1, t));
        return d3.interpolateRgb("#dbeafe", "#2563eb")(t);
      });

    // Bold TOTAL y-label
    d3.select(svg).selectAll(".hm-ylabel").filter(function(d, i) { return i === 0; })
      .attr("font-weight", "700").attr("font-size", "11px");

    // Fix text contrast after recoloring
    d3.select(svg).selectAll(".hm-text")
      .attr("fill", function(d) {
        var cellEl = d3.select(svg).selectAll(".hm-cell").filter(function(cd) { return cd.row === d.row && cd.col === d.col; });
        var fillColor = cellEl.attr("fill");
        var c = d3.color(fillColor);
        if (c) {
          var lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
          return lum < 0.55 ? "#fff" : "#1A1D21";
        }
        return "#1A1D21";
      });
  }

  // --- Render delivery margin absolute (EUR) bar chart ---
  function renderServiceMarginAbs(containerId, svcData) {
    var sorted = svcData.map(function(d) {
      var copy = Object.assign({}, d);
      copy.absMargin = (copy.allocated_revenue || 0) - (copy.staff_cost || 0);
      return copy;
    }).sort(function(a, b) { return a.absMargin - b.absMargin; });

    var totRev = sorted.reduce(function(s, d) { return s + (d.allocated_revenue || 0); }, 0);
    var totCost = sorted.reduce(function(s, d) { return s + (d.staff_cost || 0); }, 0);
    var avgMargin = totRev > 0 ? (totRev - totCost) / sorted.length : 0;

    var barData = sorted.map(function(d) {
      var marginPct = d.allocated_revenue > 0
        ? (d.allocated_revenue - d.staff_cost) / d.allocated_revenue * 100
        : (d.staff_cost > 0 ? -100 : 0);
      return {
        label: d.service_type,
        value: d.absMargin,
        _val: d.absMargin,
        _marginPct: marginPct,
        _raw: d
      };
    });

    d3c.horizontalBar(containerId, barData, {
      yField: "label",
      xField: "value",
      colorFn: function(d) { return d._val >= 0 ? "#10b981" : "#ef4444"; },
      labelFn: function(d) {
        var sign = d.value >= 0 ? "" : "-";
        return sign + "\u20AC" + d3c.fmtNum(Math.abs(d.value));
      },
      labelColorFn: function(d) { return d._val >= 0 ? "#059669" : "#dc2626"; },
      tooltipFn: function(d) {
        var r = d._raw;
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.service_type + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Revenue</span><span style='font-weight:600;color:#1A1D21'>\u20AC" + (r.allocated_revenue || 0).toLocaleString("en", {maximumFractionDigits: 0}) + "</span>" +
          "<span>Staff Cost</span><span style='font-weight:500'>\u20AC" + (r.staff_cost || 0).toLocaleString("en", {maximumFractionDigits: 0}) + "</span>" +
          "<span>Margin (\u20AC)</span><span style='font-weight:600;color:" + (d._val >= 0 ? "#059669" : "#dc2626") + "'>\u20AC" + d._val.toLocaleString("en", {maximumFractionDigits: 0}) + "</span>" +
          "<span>Margin (%)</span><span style='font-weight:500'>" + d._marginPct.toFixed(1) + "%</span>" +
          "<span>Total hrs</span><span style='font-weight:500'>" + r.total_hours.toLocaleString("en", {maximumFractionDigits: 0}) + "</span>" +
          "</div>";
      },
      xLabel: "Delivery Margin (\u20AC)",
      xFormat: function(d) { return "\u20AC" + d3c.fmtNum(d); },
      margin: {top: 24, right: 70, bottom: 36, left: 150}
    });
  }

  // === SECTION RENDERER ===
  D.registerSection("project", function(f) {
    var stmData = u.filterByMonth(DATA.service_type_monthly || [], "month", f.startMonth, f.endMonth);
    // Filter out internal + optionally LS Apps & Marketplace
    stmData = stmData.filter(function(r) {
      var st = (r.service_type || "").toLowerCase();
      if (st.indexOf("intern") >= 0) return false;
      if (!D.includeLsApps && st.indexOf("apps & market") >= 0) return false;
      return true;
    });
    var svcMap = {};
    stmData.forEach(function(r) {
      var key = r.service_type || "(no type)";
      if (!svcMap[key]) svcMap[key] = {service_type: key, total_hours: 0, billable_hours: 0, staff_cost: 0, allocated_revenue: 0};
      svcMap[key].total_hours += r.hours || 0;
      svcMap[key].billable_hours += r.billable_hours || 0;
      svcMap[key].staff_cost += r.staff_cost || 0;
      svcMap[key].allocated_revenue += r.revenue || 0;
    });
    var svcData = Object.values(svcMap).filter(function(s) {
      if (s.total_hours <= 10) return false;
      var st = (s.service_type || "").toLowerCase();
      if (st.indexOf("intern") >= 0) return false;
      if (!D.includeLsApps && st.indexOf("apps & market") >= 0) return false;
      return true;
    });
    svcData.forEach(function(s) {
      s.acph = s.total_hours > 0 ? s.staff_cost / s.total_hours : 0;
      s.arph = s.billable_hours > 0 ? s.allocated_revenue / s.billable_hours : 0;
      s.util = s.total_hours > 0 ? s.billable_hours / s.total_hours * 100 : 0;
      s.roi = s.staff_cost > 0 ? s.allocated_revenue / s.staff_cost : 0;
    });

    // KPIs
    var totalSvcHrs = svcData.reduce(function(s, d) { return s + d.total_hours; }, 0);
    var totalSvcBill = svcData.reduce(function(s, d) { return s + d.billable_hours; }, 0);
    var totalSvcRev = svcData.reduce(function(s, d) { return s + (d.allocated_revenue || 0); }, 0);
    var totalSvcCost = svcData.reduce(function(s, d) { return s + d.staff_cost; }, 0);
    var avgSvcARPH = totalSvcBill > 0 ? totalSvcRev / totalSvcBill : 0;
    var avgSvcACPH = totalSvcHrs > 0 ? totalSvcCost / totalSvcHrs : 0;
    var avgSvcMargin = totalSvcRev > 0 ? (totalSvcRev - totalSvcCost) / totalSvcRev * 100 : 0;
    var avgEffRate = totalSvcHrs > 0 ? totalSvcRev / totalSvcHrs : 0;
    u.setKPIs("kpi-project", [
      {label: "Effective Rate", value: "\u20AC" + avgEffRate.toFixed(0) + "/hr", color: avgEffRate < avgSvcARPH * 0.7 ? C.overbudget : C.warning},
      {label: "Avg Rate", value: "\u20AC" + avgSvcARPH.toFixed(0) + "/hr"},
      {label: "Avg Cost/Hr", value: "\u20AC" + avgSvcACPH.toFixed(0) + "/hr"},
      {label: "Delivery Margin", value: avgSvcMargin.toFixed(1) + "%", color: avgSvcMargin >= 40 ? C.onTrack : C.overbudget}
    ]);

    // 1. Scatterplot: Revenue vs Delivery Margin %
    renderServiceScatter("chart-svc-scatter", svcData);

    // 2. Service Type Evolution heatmap
    renderServiceHeatmap("chart-svc-heatmap", stmData, D.svcHeatMetric || "revenue");

    // 3. Delivery Margin absolute (EUR)
    renderServiceMarginAbs("chart-svc-margin-abs", svcData);

    // 3. Delivery Margin %
    if (D.chartViewMode["chart-svc-roi"] === "trend") {
      renderServiceTrend("chart-svc-roi", stmData, "roi", "Delivery Margin %");
    } else {
      renderServiceMetric("chart-svc-roi", svcData, "roi", "Delivery Margin %");
    }

    // 4. Effective Rate
    if (D.chartViewMode["chart-svc-effrate"] === "trend") {
      renderServiceTrend("chart-svc-effrate", stmData, "effrate", "Effective Rate (\u20AC/hr)");
    } else {
      renderServiceMetric("chart-svc-effrate", svcData, "effrate", "Effective Rate (\u20AC/hr)");
    }

    // 5. Avg Rate
    if (D.chartViewMode["chart-svc-arph"] === "trend") {
      renderServiceTrend("chart-svc-arph", stmData, "arph", "Avg Rate (\u20AC/hr)");
    } else {
      renderServiceMetric("chart-svc-arph", svcData, "arph", "Avg Rate (\u20AC/hr)");
    }

    // 6. Avg Cost/Hr
    if (D.chartViewMode["chart-svc-acph"] === "trend") {
      renderServiceTrend("chart-svc-acph", stmData, "acph", "Cost/Hr (\u20AC)");
    } else {
      renderServiceMetric("chart-svc-acph", svcData, "acph", "Cost/Hr (\u20AC)");
    }
  });

})(window.Dashboard);
