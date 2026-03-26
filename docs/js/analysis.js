/* ===================================================================
   analysis.js — Analysis section charts (D3 migration)
   Extracted from monolith; wrapped in IIFE for Dashboard module pattern
   =================================================================== */
(function(D) {
  var u = D.utils;
  var C = D.C;
  var DATA = D.DATA;
  var d3c = D.d3;

  var _analysisActiveTab = "people";
  var _analysisTeamColors = {};
  var _analysisTeamPalette = ["#3498DB","#E67E22","#2ECC71","#9B59B6","#1ABC9C","#E74C3C","#F39C12","#34495E","#D35400","#16A085"];
  var _analysisTeamIdx = 0;
  var _trajectoryData = {};

  function showAnalysisTab(tab, btn) {
    document.querySelectorAll("#analysis-tabs .tab-btn").forEach(function(b){ b.classList.remove("active"); });
    btn.classList.add("active");
    document.querySelectorAll("#section-analysis .tab-content").forEach(function(c){ c.classList.remove("active"); c.style.display="none"; });
    var el2 = document.getElementById("analysis-tab-"+tab);
    if (el2) { el2.classList.add("active"); el2.style.display="block"; }
    _analysisActiveTab = tab;
    setTimeout(function(){ window.dispatchEvent(new Event("resize")); }, 50);
    applyFilters();
  }

  function analysisTeamColor(team) {
    if (!_analysisTeamColors[team]) { _analysisTeamColors[team] = _analysisTeamPalette[_analysisTeamIdx % _analysisTeamPalette.length]; _analysisTeamIdx++; }
    return _analysisTeamColors[team];
  }

  // --- Shared tooltip builder for people scatter charts ---
  function peopleTooltipFn(d) {
    return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.name + "</div>" +
      "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
      "<span>Team</span><span style='font-weight:500'>" + (d.team || "") + "</span>" +
      "<span>Utilisation</span><span style='font-weight:600'>" + d.util.toFixed(1) + "%</span>" +
      "<span>Eff. Rate</span><span style='font-weight:600'>\u20AC" + Math.round(d.eff_rate) + "/hr</span>" +
      "<span>Hours</span><span style='font-weight:500'>" + d3c.fmtNum(d.hours) + "</span>" +
      "<span>Revenue</span><span style='font-weight:500'>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
      "<span>Staff Cost</span><span style='font-weight:500'>\u20AC" + d3c.fmtNum(d.cost) + "</span>" +
      "</div>";
  }

  function renderAnalysisCharts(f) {
    if (!document.getElementById("chart-analysis-efficiency-frontier")) return;
    if (document.getElementById("section-analysis").style.display === "none") return;

    var pm = u.filterByMonth(DATA.people_monthly || [], "month", f.startMonth, f.endMonth);
    if (f.teams && f.teams.length > 0) {
      pm = pm.filter(function(r) { return f.teams.indexOf(r.team) >= 0; });
    }
    var byPerson = {};
    pm.forEach(function(r) {
      var k = r.person_name;
      if (!byPerson[k]) byPerson[k] = {name:k, team:r.team||"", hours:0, billable:0, revenue:0, cost:0};
      byPerson[k].hours += r.hours || 0;
      byPerson[k].billable += r.billable_hours || 0;
      byPerson[k].revenue += r.revenue || 0;
      byPerson[k].cost += r.staff_cost || 0;
    });
    var people = Object.values(byPerson).filter(function(p) { return p.hours > 10; });
    people.forEach(function(p) {
      p.util = p.hours > 0 ? p.billable / p.hours * 100 : 0;
      p.eff_rate = p.hours > 0 ? p.revenue / p.hours : 0;
    });
    var hygMap = {};
    (DATA.hygiene_person || []).forEach(function(h) { hygMap[h.person_name] = h.note_pct || 0; });
    people.forEach(function(p) { p.note_pct = hygMap[p.name] !== undefined ? hygMap[p.name] : 100; });

    var stm = u.filterByMonth(DATA.service_type_monthly || [], "month", f.startMonth, f.endMonth);
    var svcMap = {};
    stm.forEach(function(r) {
      var k = r.service_type || "(no type)";
      if (!svcMap[k]) svcMap[k] = {service_type:k, hours:0, billable:0, cost:0, revenue:0};
      svcMap[k].hours += r.hours || 0;
      svcMap[k].billable += r.billable_hours || 0;
      svcMap[k].cost += r.staff_cost || 0;
      svcMap[k].revenue += r.revenue || 0;
    });
    var svcData = Object.values(svcMap).filter(function(s) { return s.hours > 10; });
    svcData.forEach(function(s) {
      s.acph = s.hours > 0 ? s.cost / s.hours : 0;
      s.eff_rate = s.hours > 0 ? s.revenue / s.hours : 0;
      s.margin_per_hour = s.eff_rate - s.acph;
    });

    // Aggregate client_monthly by date range (same pattern as client.js)
    var cliMonthly = u.filterByMonth(DATA.client_monthly || [], "month", f.startMonth, f.endMonth);
    var cliMap = {};
    cliMonthly.forEach(function(r) {
      var key = r.client_name;
      if (!cliMap[key]) cliMap[key] = {client_name: key, total_hours: 0, billable_hours: 0, staff_cost: 0, revenue: 0, company_id: r.company_id || null, project_id: r.project_id || null};
      cliMap[key].total_hours += r.hours || 0;
      cliMap[key].billable_hours += r.billable_hours || 0;
      cliMap[key].staff_cost += r.staff_cost || 0;
      cliMap[key].revenue += r.revenue || 0;
    });
    // Enrich with deal-level data from all-time clients snapshot
    var cliAllTime = {};
    (DATA.clients || []).forEach(function(c) { cliAllTime[c.client_name] = c; });
    var clients = Object.values(cliMap).filter(function(c) {
      var n = (c.client_name || "").toLowerCase();
      return c.total_hours > 0 && n !== "leadstreet" && n !== "hubspot";
    });
    clients.forEach(function(c) {
      c.gross_margin = c.revenue - c.staff_cost;
      c.margin_pct = c.revenue > 0 ? (c.gross_margin / c.revenue * 100) : 0;
      var at = cliAllTime[c.client_name] || {};
      c.overbudget_deals = at.overbudget_deals || 0;
      c.deal_count = at.deal_count || 0;
    });

    // CHART 1: Efficiency Frontier
    var maxHours = Math.max.apply(null, people.map(function(p){return p.hours})) || 1;
    var pByUtil = people.slice().sort(function(a,b){ return a.util - b.util; });
    var frontierPts = []; var runMax = -Infinity;
    pByUtil.forEach(function(p) { if (p.eff_rate >= runMax) { runMax = p.eff_rate; frontierPts.push(p); } });

    // Prepare scatter data for efficiency frontier
    var effData = people.map(function(p) {
      return { x: p.util, y: p.eff_rate, hours: p.hours, name: p.name, team: p.team, revenue: p.revenue, cost: p.cost, util: p.util, eff_rate: p.eff_rate };
    });
    d3c.scatter("chart-analysis-efficiency-frontier", effData, {
      xField: "x", yField: "y",
      sizeField: "hours",
      colorFn: function(d) { return analysisTeamColor(d.team); },
      textField: "name",
      tooltipFn: peopleTooltipFn,
      xLabel: "Utilisation %",
      yLabel: "Effective Rate (\u20AC/hr)",
      xFormat: function(d) { return d + "%"; },
      yFormat: function(d) { return "\u20AC" + Math.round(d); },
      minSize: 8, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 70},
      height: 400
    });
    // Draw frontier line overlay using raw D3 after scatter renders
    if (frontierPts.length > 1) {
      var container = document.getElementById("chart-analysis-efficiency-frontier");
      if (container) {
        var svg = d3.select(container).select("svg");
        var gEl = svg.select("g");
        if (gEl.node()) {
          // Re-derive scales from scatter chart extent
          var xPad = (d3.max(effData, function(d){return d.x;}) - d3.min(effData, function(d){return d.x;})) * 0.1 || 10;
          var yPad = (d3.max(effData, function(d){return d.y;}) - d3.min(effData, function(d){return d.y;})) * 0.1 || 10;
          var margin1 = {top: 20, right: 40, bottom: 50, left: 70};
          var w1 = container.clientWidth || 800;
          var innerW1 = w1 - margin1.left - margin1.right;
          var innerH1 = 400 - margin1.top - margin1.bottom;
          var xSc = d3.scaleLinear().domain([d3.min(effData,function(d){return d.x;}) - xPad, d3.max(effData,function(d){return d.x;}) + xPad]).nice().range([0, innerW1]);
          var ySc = d3.scaleLinear().domain([d3.min(effData,function(d){return d.y;}) - yPad, d3.max(effData,function(d){return d.y;}) + yPad]).nice().range([innerH1, 0]);
          var lineFn = d3.line()
            .x(function(p){ return xSc(p.util); })
            .y(function(p){ return ySc(p.eff_rate); })
            .curve(d3.curveMonotoneX);
          gEl.insert("path", ".bubble")
            .datum(frontierPts)
            .attr("fill", "none")
            .attr("stroke", "rgba(46,204,113,0.4)")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,3")
            .attr("d", lineFn);
        }
      }
    }

    // CHART 2: Cost-Revenue Parity
    var crData = people.map(function(p) {
      return { x: p.cost, y: p.revenue, hours: p.hours, name: p.name, team: p.team, revenue: p.revenue, cost: p.cost, util: p.util, eff_rate: p.eff_rate, margin: p.revenue - p.cost };
    });
    d3c.scatter("chart-analysis-cost-revenue", crData, {
      xField: "x", yField: "y",
      sizeField: "hours",
      colorFn: function(d) { return d.y >= d.x ? C.profitPos : C.profitNeg; },
      textField: "name",
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Staff Cost</span><span style='font-weight:600'>\u20AC" + d3c.fmtNum(d.cost) + "</span>" +
          "<span>Revenue</span><span style='font-weight:600'>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Margin</span><span style='font-weight:600;color:" + (d.margin >= 0 ? C.profitPos : C.profitNeg) + "'>\u20AC" + d3c.fmtNum(d.margin) + "</span>" +
          "<span>Hours</span><span>" + d3c.fmtNum(d.hours) + "</span>" +
          "</div>";
      },
      xLabel: "Staff Cost (\u20AC)",
      yLabel: "Revenue (\u20AC)",
      xFormat: function(d) { return "\u20AC" + d3c.fmtNum(d); },
      yFormat: function(d) { return "\u20AC" + d3c.fmtNum(d); },
      diagonal: true,
      minSize: 8, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 80},
      height: 400
    });

    // CHART 3: Busyness vs Discipline
    var maxRevP = Math.max.apply(null, people.map(function(p){return p.revenue})) || 1;
    var bdData = people.map(function(p) {
      return { x: p.hours, y: p.note_pct, hours: p.hours, revenue: p.revenue, name: p.name, team: p.team, util: p.util, eff_rate: p.eff_rate, note_pct: p.note_pct, cost: p.cost, _sizeVal: p.revenue };
    });
    d3c.scatter("chart-analysis-busy-discipline", bdData, {
      xField: "x", yField: "y",
      sizeField: "_sizeVal",
      colorFn: function(d) { return analysisTeamColor(d.team); },
      textField: "name",
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Total Hours</span><span style='font-weight:600'>" + d3c.fmtNum(d.hours) + "</span>" +
          "<span>Note Compliance</span><span style='font-weight:600'>" + d.note_pct.toFixed(1) + "%</span>" +
          "<span>Revenue</span><span>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Team</span><span>" + d.team + "</span>" +
          "</div>";
      },
      xLabel: "Total Hours",
      yLabel: "Note Compliance %",
      xFormat: function(d) { return d3c.fmtNum(d); },
      yFormat: function(d) { return d + "%"; },
      refLines: [{axis:"y", value:80, color:C.warning, dash:"6,3", label:"80% target"}],
      minSize: 8, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 60},
      height: 400
    });

    // CHART 4: Strategic Quadrant
    var cRev = clients.map(function(c){return c.revenue||0}).sort(function(a,b){return a-b});
    var cMargin = clients.map(function(c){return c.margin_pct||0}).sort(function(a,b){return a-b});
    var medianRev = cRev.length > 0 ? cRev[Math.floor(cRev.length/2)] : 0;
    var medianMargin = cMargin.length > 0 ? cMargin[Math.floor(cMargin.length/2)] : 0;
    var maxCliHours = Math.max.apply(null, clients.map(function(c){return c.total_hours||0})) || 1;

    var sqData = clients.map(function(c) {
      return {
        x: c.revenue || 0, y: c.margin_pct || 0,
        hours: c.total_hours || 0,
        name: c.client_name,
        overbudget_deals: c.overbudget_deals || 0,
        deal_count: c.deal_count || 0,
        revenue: c.revenue || 0,
        margin_pct: c.margin_pct || 0,
        total_hours: c.total_hours || 0
      };
    });
    d3c.scatter("chart-analysis-strategic-quad", sqData, {
      xField: "x", yField: "y",
      sizeField: "hours",
      colorFn: function(d) { var ob=d.overbudget_deals||0; return ob===0?C.revenue:ob<=2?C.warning:C.overbudget; },
      textField: "name",
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Revenue</span><span style='font-weight:600'>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Margin</span><span style='font-weight:600'>" + d.margin_pct.toFixed(1) + "%</span>" +
          "<span>Hours</span><span>" + d3c.fmtNum(d.total_hours) + "</span>" +
          "<span>Overbudget deals</span><span>" + d.overbudget_deals + "</span>" +
          "</div>";
      },
      xLabel: "Revenue (\u20AC)",
      yLabel: "Margin %",
      xFormat: function(d) { return "\u20AC" + d3c.fmtNum(d); },
      yFormat: function(d) { return d + "%"; },
      refLines: [
        {axis:"x", value:medianRev, color:"#CBD5E1", dash:"4,3", label:"Median"},
        {axis:"y", value:medianMargin, color:"#CBD5E1", dash:"4,3", label:"Median"}
      ],
      quadrants: [
        {x:0.02, y:0.02, text:"Hidden Gems", anchor:"start"},
        {x:0.98, y:0.02, text:"Stars", anchor:"end"},
        {x:0.02, y:0.98, text:"Drains", anchor:"start"},
        {x:0.98, y:0.98, text:"Attention Needed", anchor:"end"}
      ],
      minSize: 8, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 60},
      height: 400
    });

    // CHART 5: Time Sink Detector
    var totalHrs = clients.reduce(function(s,c){return s+(c.total_hours||0)},0);
    var totalRevCli = clients.reduce(function(s,c){return s+(c.revenue||0)},0);
    var avgEffRate = totalHrs > 0 ? totalRevCli / totalHrs : 0;

    var tsData = clients.map(function(c) {
      var r = (c.total_hours||0) > 0 ? (c.revenue||0)/(c.total_hours||1) : 0;
      return {
        x: c.total_hours || 0, y: c.revenue || 0,
        name: c.client_name,
        _effRate: r,
        _avgRate: avgEffRate,
        total_hours: c.total_hours || 0,
        revenue: c.revenue || 0
      };
    });
    d3c.scatter("chart-analysis-time-sink", tsData, {
      xField: "x", yField: "y",
      colorFn: function(d) { return d._effRate >= d._avgRate ? C.profitPos : C.profitNeg; },
      textField: "name",
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Hours</span><span style='font-weight:600'>" + d3c.fmtNum(d.total_hours) + "</span>" +
          "<span>Revenue</span><span style='font-weight:600'>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Eff. Rate</span><span>\u20AC" + Math.round(d._effRate) + "/hr</span>" +
          "<span>Avg Rate</span><span>\u20AC" + Math.round(d._avgRate) + "/hr</span>" +
          "</div>";
      },
      xLabel: "Hours Invested",
      yLabel: "Revenue (\u20AC)",
      xFormat: function(d) { return d3c.fmtNum(d); },
      yFormat: function(d) { return "\u20AC" + d3c.fmtNum(d); },
      minSize: 10, maxSize: 10,
      margin: {top: 20, right: 40, bottom: 50, left: 80},
      height: 400
    });
    // Overlay the avg-rate reference line (y = avgEffRate * x)
    (function() {
      var container = document.getElementById("chart-analysis-time-sink");
      if (!container) return;
      var svg = d3.select(container).select("svg");
      var gEl = svg.select("g");
      if (!gEl.node()) return;
      var margin5 = {top: 20, right: 40, bottom: 50, left: 80};
      var w5 = container.clientWidth || 800;
      var innerW5 = w5 - margin5.left - margin5.right;
      var innerH5 = 400 - margin5.top - margin5.bottom;
      var xPad5 = (d3.max(tsData,function(d){return d.x;}) - d3.min(tsData,function(d){return d.x;})) * 0.1 || 10;
      var yPad5 = (d3.max(tsData,function(d){return d.y;}) - d3.min(tsData,function(d){return d.y;})) * 0.1 || 10;
      var xSc5 = d3.scaleLinear().domain([d3.min(tsData,function(d){return d.x;}) - xPad5, d3.max(tsData,function(d){return d.x;}) + xPad5]).nice().range([0, innerW5]);
      var ySc5 = d3.scaleLinear().domain([d3.min(tsData,function(d){return d.y;}) - yPad5, d3.max(tsData,function(d){return d.y;}) + yPad5]).nice().range([innerH5, 0]);
      var xDom = xSc5.domain();
      var yDom = ySc5.domain();
      var lineX0 = 0;
      var lineY0 = 0;
      var lineX1 = Math.min(xDom[1], yDom[1] / avgEffRate);
      var lineY1 = lineX1 * avgEffRate;
      gEl.insert("line", ".bubble")
        .attr("x1", xSc5(lineX0)).attr("y1", ySc5(lineY0))
        .attr("x2", xSc5(lineX1)).attr("y2", ySc5(lineY1))
        .attr("stroke", "#94A3B8").attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4,3").attr("opacity", 0.5);
      gEl.append("text")
        .attr("x", xSc5(lineX1) - 4).attr("y", ySc5(lineY1) + 14)
        .attr("text-anchor", "end")
        .attr("fill", "#94A3B8").attr("font-size", "9px")
        .text("Avg \u20AC" + Math.round(avgEffRate) + "/hr");
    })();

    // CHART 6: Revenue Concentration (Pareto)
    var cSorted = clients.slice().sort(function(a,b){return (b.revenue||0)-(a.revenue||0)});
    var paretoChartData = cSorted.map(function(c) {
      return { label: c.client_name, value: c.revenue || 0 };
    });
    var sumRevP = cSorted.reduce(function(s,c){return s+(c.revenue||0)},0);
    // Find what % of clients generate 80%
    var cumRevP2 = 0;
    var idx80 = -1;
    for (var pi = 0; pi < cSorted.length; pi++) {
      cumRevP2 += (cSorted[pi].revenue || 0);
      if (sumRevP > 0 && cumRevP2 / sumRevP >= 0.8 && idx80 < 0) {
        idx80 = pi;
      }
    }
    var pct80 = idx80 >= 0 ? Math.round((idx80 + 1) / cSorted.length * 100) : "?";

    d3c.pareto("chart-analysis-pareto", paretoChartData, {
      labelField: "label",
      valueField: "value",
      threshold: 0.8,
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.label + "</div>" +
          "<div style='color:#5F6B7A'>Revenue: \u20AC" + d3c.fmtNum(d.value) + "</div>" +
          "<div style='color:#5F6B7A'>Cumulative: " + (d.cumPct * 100).toFixed(1) + "%</div>";
      },
      margin: {top: 16, right: 50, bottom: 50, left: 60},
      height: 350
    });

    // CHART 7: Revenue vs Deal Health
    var cWithDeals = clients.filter(function(c) { return (c.deal_count || 0) > 0; });
    var rhData = cWithDeals.map(function(c) {
      var dc = c.deal_count || 1;
      var obPct = (c.overbudget_deals || 0) / dc * 100;
      return {
        x: c.revenue || 0, y: obPct,
        name: c.client_name,
        _dealCount: c.deal_count || 0,
        _obDeals: c.overbudget_deals || 0,
        revenue: c.revenue || 0,
        _obPct: obPct
      };
    });
    d3c.scatter("chart-analysis-rev-health", rhData, {
      xField: "x", yField: "y",
      sizeField: "_dealCount",
      colorFn: function(d) { return d.y > 50 ? C.overbudget : d.y > 25 ? C.warning : C.onTrack; },
      textField: "name",
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Revenue</span><span style='font-weight:600'>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Overbudget</span><span style='font-weight:600'>" + d._obPct.toFixed(0) + "% of deals</span>" +
          "<span>Overbudget deals</span><span>" + d._obDeals + "</span>" +
          "<span>Total deals</span><span>" + d._dealCount + "</span>" +
          "</div>";
      },
      xLabel: "Revenue (\u20AC)",
      yLabel: "% Deals Overbudget",
      xFormat: function(d) { return "\u20AC" + d3c.fmtNum(d); },
      yFormat: function(d) { return d + "%"; },
      minSize: 8, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 60},
      height: 400
    });

    // CHART 8: Pricing Power Map
    var maxSvcRev = Math.max.apply(null, svcData.map(function(s){return s.revenue})) || 1;
    var ppData = svcData.map(function(s) {
      return {
        x: s.hours, y: s.margin_per_hour,
        name: s.service_type,
        revenue: s.revenue,
        eff_rate: s.eff_rate,
        acph: s.acph,
        hours: s.hours,
        margin_per_hour: s.margin_per_hour
      };
    });
    d3c.scatter("chart-analysis-pricing-power", ppData, {
      xField: "x", yField: "y",
      sizeField: "revenue",
      colorFn: function(d) { return d.margin_per_hour >= 0 ? C.profitPos : C.profitNeg; },
      textField: "name",
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Volume</span><span style='font-weight:600'>" + d3c.fmtNum(d.hours) + " hours</span>" +
          "<span>Margin/hr</span><span style='font-weight:600'>\u20AC" + Math.round(d.margin_per_hour) + "</span>" +
          "<span>Revenue</span><span>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Eff. Rate</span><span>\u20AC" + Math.round(d.eff_rate) + "/hr</span>" +
          "<span>ACPH</span><span>\u20AC" + Math.round(d.acph) + "/hr</span>" +
          "</div>";
      },
      xLabel: "Volume (hours)",
      yLabel: "Margin per Hour (\u20AC)",
      xFormat: function(d) { return d3c.fmtNum(d); },
      yFormat: function(d) { return "\u20AC" + Math.round(d); },
      refLines: [{axis:"y", value:0, color:"#CBD5E1", dash:"4,3", label:"Breakeven"}],
      quadrants: [
        {x:0.98, y:0.02, text:"Profitable", anchor:"end"},
        {x:0.98, y:0.98, text:"Unprofitable", anchor:"end"}
      ],
      minSize: 10, maxSize: 32,
      margin: {top: 20, right: 40, bottom: 50, left: 70},
      height: 400
    });

    // CHART 9: Cost-Revenue Spread
    var crsData = svcData.map(function(s) {
      return {
        x: s.acph, y: s.eff_rate,
        name: s.service_type,
        hours: s.hours,
        margin_per_hour: s.margin_per_hour,
        acph: s.acph,
        eff_rate: s.eff_rate
      };
    });
    d3c.scatter("chart-analysis-cost-rev-spread", crsData, {
      xField: "x", yField: "y",
      sizeField: "hours",
      colorFn: function(d) { return d.eff_rate >= d.acph ? C.profitPos : C.profitNeg; },
      textField: "name",
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>ACPH</span><span style='font-weight:600'>\u20AC" + Math.round(d.acph) + "/hr</span>" +
          "<span>Eff. Rate</span><span style='font-weight:600'>\u20AC" + Math.round(d.eff_rate) + "/hr</span>" +
          "<span>Margin/hr</span><span>\u20AC" + Math.round(d.margin_per_hour) + "</span>" +
          "<span>Hours</span><span>" + d3c.fmtNum(d.hours) + "</span>" +
          "</div>";
      },
      xLabel: "ACPH \u2014 Cost per Hour (\u20AC)",
      yLabel: "Effective Rate (\u20AC/hr)",
      xFormat: function(d) { return "\u20AC" + Math.round(d); },
      yFormat: function(d) { return "\u20AC" + Math.round(d); },
      diagonal: true,
      minSize: 10, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 70},
      height: 400
    });

    // CHART 10: Scope Creep Radar (filtered to deals with time entries in selected period)
    var dealMonthly = u.filterByMonth(DATA.deal_monthly || [], "month", f.startMonth, f.endMonth);
    var activeDeals = {};
    dealMonthly.forEach(function(r) { activeDeals[r.deal_name] = true; });
    var ob = (DATA.overbudget || []).filter(function(d) { return activeDeals[d.name] && (d.budgeted_hours||0) > 2 && (d.worked_hours||0) > 0; });
    var maxObRev = Math.max.apply(null, ob.map(function(d){return d.revenue||0})) || 1;

    var scData = ob.map(function(d) {
      return {
        x: d.budgeted_hours || 0, y: d.worked_hours || 0,
        name: (d.name || "").substring(0, 30),
        _fullName: d.name,
        _company: d.company_name || "",
        _burnPct: d.hours_burn_pct || 0,
        revenue: d.revenue || 0,
        _flag: d.flag
      };
    });
    d3c.scatter("chart-analysis-scope-creep", scData, {
      xField: "x", yField: "y",
      sizeField: "revenue",
      colorFn: function(d) { return d._flag === "RED" ? C.overbudget : d._flag === "AMBER" ? C.warning : C.onTrack; },
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d._fullName + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Client</span><span>" + d._company + "</span>" +
          "<span>Budgeted</span><span style='font-weight:600'>" + d3c.fmtNum(d.x) + "h</span>" +
          "<span>Actual</span><span style='font-weight:600'>" + d3c.fmtNum(d.y) + "h</span>" +
          "<span>Burn</span><span>" + d._burnPct.toFixed(0) + "%</span>" +
          "<span>Revenue</span><span>\u20AC" + d3c.fmtNum(d.revenue) + "</span>" +
          "<span>Flag</span><span>" + d._flag + "</span>" +
          "</div>";
      },
      xLabel: "Budgeted Hours",
      yLabel: "Actual Hours Worked",
      xFormat: function(d) { return d3c.fmtNum(d); },
      yFormat: function(d) { return d3c.fmtNum(d); },
      diagonal: true,
      quadrants: [
        {x:0.25, y:0.05, text:"Scope Creep Zone", anchor:"start"},
        {x:0.85, y:0.85, text:"Under Budget", anchor:"end"}
      ],
      minSize: 6, maxSize: 24,
      margin: {top: 20, right: 40, bottom: 50, left: 70},
      height: 400
    });

    // CHART 11: Person Effective Rate Heatmap
    var hmPeople = []; var hmPSet = {};
    pm.forEach(function(r) { if (!hmPSet[r.person_name]) { hmPSet[r.person_name]=1; hmPeople.push(r.person_name); } });
    var hmMonths = []; var hmMSet = {};
    pm.forEach(function(r) { if (!hmMSet[r.month]) { hmMSet[r.month]=1; hmMonths.push(r.month); } });
    hmMonths.sort();
    var hmAvg = {};
    hmPeople.forEach(function(p) {
      var ph=0; var pr=0;
      pm.forEach(function(r) { if (r.person_name===p) { ph += r.hours||0; pr += r.revenue||0; } });
      hmAvg[p] = ph > 0 ? pr/ph : 0;
    });
    hmPeople.sort(function(a,b){ return hmAvg[a] - hmAvg[b]; });

    var hmZ = []; var hmText = [];
    hmPeople.forEach(function(p) {
      var row = []; var trow = [];
      hmMonths.forEach(function(m) {
        var found = pm.filter(function(r){ return r.person_name===p && r.month===m; });
        if (found.length > 0) {
          var h = found.reduce(function(s,r){return s+(r.hours||0)},0);
          var rv = found.reduce(function(s,r2){return s+(r2.revenue||0)},0);
          var rate = h > 0 ? rv/h : 0;
          row.push(rate);
          trow.push("\u20AC" + Math.round(rate));
        } else {
          row.push(null);
          trow.push("");
        }
      });
      hmZ.push(row); hmText.push(trow);
    });

    d3c.heatmap("chart-analysis-heatmap", null, {
      xLabels: hmMonths,
      yLabels: hmPeople,
      zMatrix: hmZ,
      textMatrix: hmText,
      colorScale: [[0,"#E74C3C"],[0.3,"#F39C12"],[0.5,"#F7DC6F"],[0.7,"#82E0AA"],[1,"#27AE60"]],
      tooltipFn: function(cell) {
        if (cell.z == null) return "<b>" + cell.yLabel + "</b><br>" + cell.xLabel + "<br>No data";
        return "<b>" + cell.yLabel + "</b><br>" + cell.xLabel + "<br>Eff. Rate: \u20AC" + Math.round(cell.z) + "/hr";
      },
      margin: {top: 30, right: 20, bottom: 60, left: 140},
      cellH: 28
    });

    // CHART 12: Trajectory — single person with density heatmap (custom D3 rendering)
    var trajPeople = people.slice().sort(function(a,b){return b.hours-a.hours});
    _trajectoryData = {};
    trajPeople.forEach(function(p) {
      var monthly = pm.filter(function(r){ return r.person_name===p.name; })
        .map(function(r){ return {month:r.month, hours:r.hours||0, billable:r.billable_hours||0, revenue:r.revenue||0}; })
        .filter(function(r){ return r.hours > 5; })
        .sort(function(a,b){ return a.month < b.month ? -1 : 1; });
      monthly.forEach(function(m) { m.util = m.hours>0?m.billable/m.hours*100:0; m.eff_rate = m.hours>0?m.revenue/m.hours:0; });
      if (monthly.length >= 2) _trajectoryData[p.name] = {monthly:monthly, team:p.team};
    });
    var sel = document.getElementById("trajectory-person-select");
    if (sel) {
      var prevVal = sel.value;
      sel.innerHTML = "";
      var names = Object.keys(_trajectoryData);
      names.forEach(function(n) {
        var opt = document.createElement("option");
        opt.value = n; opt.textContent = n;
        sel.appendChild(opt);
      });
      if (prevVal && _trajectoryData[prevVal]) sel.value = prevVal;
      else if (names.length > 0) sel.value = names[0];
    }
    updateTrajectoryChart();
  }

  // ---------------------------------------------------------------
  //  TRAJECTORY CHART — custom D3 implementation (KDE contour + spline)
  //  This replaces the Plotly contour-based trajectory chart
  // ---------------------------------------------------------------
  function updateTrajectoryChart() {
    var sel = document.getElementById("trajectory-person-select");
    if (!sel || !sel.value) return;
    var name = sel.value;
    var td = _trajectoryData[name];
    if (!td) return;
    var monthly = td.monthly;
    var tc = analysisTeamColor(td.team);
    var mNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var monthLabels = monthly.map(function(m) {
      var parts = m.month.split("-");
      return mNames[parseInt(parts[1],10)-1] + " '" + parts[0].slice(2);
    });

    // 2D Gaussian KDE computation
    var xs = monthly.map(function(m){return m.util});
    var ys = monthly.map(function(m){return m.eff_rate});
    var weights = monthly.map(function(m,i){ return 0.3 + 0.7 * (monthly.length>1 ? i/(monthly.length-1) : 1); });
    var maxH = Math.max.apply(null, monthly.map(function(m){return m.hours})) || 1;
    weights = weights.map(function(w,i){ return w * (0.5 + 0.5 * monthly[i].hours / maxH); });
    var xMin = Math.max(0, Math.min.apply(null, xs) - 10);
    var xMax = Math.min(100, Math.max.apply(null, xs) + 10);
    var yMin = Math.max(0, Math.min.apply(null, ys) - 15);
    var yMax = Math.max.apply(null, ys) + 15;
    var gridN = 40;
    var xStep = (xMax - xMin) / gridN;
    var yStep = (yMax - yMin) / gridN;
    var bwX = Math.max((xMax-xMin) * 0.12, 3);
    var bwY = Math.max((yMax-yMin) * 0.12, 3);
    var gridX = []; var gridY = []; var gridZ = [];
    var gi, gj;
    for (gi = 0; gi <= gridN; gi++) gridX.push(xMin + gi * xStep);
    for (gj = 0; gj <= gridN; gj++) gridY.push(yMin + gj * yStep);
    for (gj = 0; gj <= gridN; gj++) {
      var row = [];
      for (gi = 0; gi <= gridN; gi++) {
        var val = 0;
        for (var k = 0; k < xs.length; k++) {
          var dx = (gridX[gi] - xs[k]) / bwX;
          var dy = (gridY[gj] - ys[k]) / bwY;
          val += weights[k] * Math.exp(-0.5 * (dx*dx + dy*dy));
        }
        row.push(val);
      }
      gridZ.push(row);
    }

    // Normalize gridZ for color mapping
    var zFlat = [];
    gridZ.forEach(function(row) { row.forEach(function(v) { zFlat.push(v); }); });
    var zMaxVal = Math.max.apply(null, zFlat) || 1;

    // Setup SVG
    var containerId = "chart-analysis-trajectory";
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    container.style.position = "relative";

    var margin = {top: 40, right: 40, bottom: 50, left: 70};
    var totalWidth = container.clientWidth || 800;
    if (totalWidth < 100) {
      var main = document.querySelector(".main");
      totalWidth = (main ? main.clientWidth : 900) - 60;
    }
    var totalHeight = 420;
    container.style.height = totalHeight + "px";

    var innerW = totalWidth - margin.left - margin.right;
    var innerH = totalHeight - margin.top - margin.bottom;

    var svg = d3.select(container).append("svg")
      .attr("width", totalWidth)
      .attr("height", totalHeight)
      .style("overflow", "visible");

    var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]);
    var yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

    // Grid lines
    var GRID_COL = "#F0F2F5";
    yScale.ticks(5).forEach(function(t) {
      g.append("line").attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(t)).attr("y2", yScale(t))
        .attr("stroke", GRID_COL).attr("stroke-width", 1);
    });
    xScale.ticks(5).forEach(function(t) {
      g.append("line").attr("x1", xScale(t)).attr("x2", xScale(t))
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", GRID_COL).attr("stroke-width", 1);
    });

    // Draw KDE heatmap as small rectangles
    var cellW = innerW / gridN;
    var cellH = innerH / gridN;
    var kdeColorScale = [
      [0, "rgba(255,255,255,0)"],
      [0.15, "rgba(52,152,219,0.05)"],
      [0.3, "rgba(52,152,219,0.12)"],
      [0.5, "rgba(46,204,113,0.2)"],
      [0.7, "rgba(241,196,15,0.3)"],
      [0.85, "rgba(230,126,34,0.4)"],
      [1, "rgba(231,76,60,0.5)"]
    ];

    function kdeColor(v) {
      var t = zMaxVal > 0 ? v / zMaxVal : 0;
      t = Math.max(0, Math.min(1, t));
      for (var i = 0; i < kdeColorScale.length - 1; i++) {
        if (t <= kdeColorScale[i+1][0]) {
          var localT = (t - kdeColorScale[i][0]) / (kdeColorScale[i+1][0] - kdeColorScale[i][0]);
          return d3.interpolateRgb(kdeColorScale[i][1], kdeColorScale[i+1][1])(localT);
        }
      }
      return kdeColorScale[kdeColorScale.length - 1][1];
    }

    // Render KDE cells
    var kdeGroup = g.append("g").attr("class", "kde-heatmap");
    for (gj = 0; gj < gridN; gj++) {
      for (gi = 0; gi < gridN; gi++) {
        var cellVal = gridZ[gj][gi];
        if (cellVal > zMaxVal * 0.05) {
          kdeGroup.append("rect")
            .attr("x", xScale(gridX[gi]))
            .attr("y", yScale(gridY[gj + 1]))
            .attr("width", cellW + 1)
            .attr("height", cellH + 1)
            .attr("fill", kdeColor(cellVal))
            .attr("stroke", "none");
        }
      }
    }

    // Spline path connecting points
    var splineFn = d3.line()
      .x(function(m) { return xScale(m.util); })
      .y(function(m) { return yScale(m.eff_rate); })
      .curve(d3.curveCardinal.tension(0.5));

    g.append("path")
      .datum(monthly)
      .attr("fill", "none")
      .attr("stroke", "rgba(100,116,139,0.25)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,3")
      .attr("d", splineFn);

    // Tooltip
    var tooltip = d3.select(container).append("div")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "rgba(255,255,255,0.97)")
      .style("border", "1px solid #E5E7EB")
      .style("border-radius", "8px")
      .style("padding", "10px 14px")
      .style("font-size", "12px")
      .style("color", "#1A1D21")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.1)")
      .style("opacity", 0)
      .style("z-index", 10)
      .style("transition", "opacity 0.15s ease")
      .style("max-width", "280px");

    // Scatter points with time-based color gradient
    g.selectAll(".traj-dot")
      .data(monthly)
      .enter().append("circle")
        .attr("cx", function(m) { return xScale(m.util); })
        .attr("cy", function(m) { return yScale(m.eff_rate); })
        .attr("r", function(m) { return 6 + (m.hours / maxH) * 10; })
        .attr("fill", function(m, i) {
          var t = monthly.length > 1 ? i / (monthly.length - 1) : 0;
          return "rgb(" + Math.round(52 + t * 179) + "," + Math.round(152 - t * 76) + "," + Math.round(219 - t * 159) + ")";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .attr("opacity", 0.85)
      .on("mouseover", function(event, m) {
        var i = monthly.indexOf(m);
        d3.select(this).transition().duration(100).attr("r", function() { return 8 + (m.hours / maxH) * 10; });
        tooltip.html(
          "<b>" + name + "</b><br>" + monthLabels[i] +
          "<br>Util: " + m.util.toFixed(1) + "%" +
          "<br>Eff. Rate: \u20AC" + Math.round(m.eff_rate) + "/hr" +
          "<br>Hours: " + d3c.fmtNum(m.hours) +
          "<br>Revenue: \u20AC" + d3c.fmtNum(m.revenue)
        ).style("opacity", 1);
      })
      .on("mousemove", function(event) {
        var rect = container.getBoundingClientRect();
        var x2 = event.clientX - rect.left + 16;
        var y2 = event.clientY - rect.top - 10;
        if (x2 + 200 > rect.width) x2 = event.clientX - rect.left - 220;
        tooltip.style("left", x2 + "px").style("top", y2 + "px");
      })
      .on("mouseout", function(event, m) {
        d3.select(this).transition().duration(150).attr("r", function() { return 6 + (m.hours / maxH) * 10; });
        tooltip.style("opacity", 0);
      });

    // Star marker on last point
    var lastPt = monthly[monthly.length - 1];
    g.append("path")
      .attr("d", d3.symbol().type(d3.symbolStar).size(120))
      .attr("transform", "translate(" + xScale(lastPt.util) + "," + yScale(lastPt.eff_rate) + ")")
      .attr("fill", "#E67E22")
      .attr("stroke", "#fff").attr("stroke-width", 1.5);

    // Month labels on first and last points
    g.append("text")
      .attr("x", xScale(monthly[0].util) - 4)
      .attr("y", yScale(monthly[0].eff_rate) + 16)
      .attr("text-anchor", "end")
      .attr("fill", "#3498DB").attr("font-size", "9px")
      .attr("font-weight", "500")
      .text(monthLabels[0]);

    g.append("text")
      .attr("x", xScale(lastPt.util) + 8)
      .attr("y", yScale(lastPt.eff_rate) - 12)
      .attr("text-anchor", "start")
      .attr("fill", "#E67E22").attr("font-size", "9px")
      .attr("font-weight", "500")
      .text(monthLabels[monthLabels.length - 1] + " \u2605");

    // Trend annotation at top
    var startRate = monthly[0].eff_rate; var endRate = lastPt.eff_rate;
    var startUtil = monthly[0].util; var endUtil = lastPt.util;
    var rateChange = endRate - startRate; var utilChange = endUtil - startUtil;
    var trendText = name + ": " + (rateChange >= 0 ? "+" : "") + Math.round(rateChange) + " \u20AC/hr, " + (utilChange >= 0 ? "+" : "") + Math.round(utilChange) + " pp util";
    var trendColor = (rateChange >= 0 && utilChange >= 0) ? C.profitPos : (rateChange < 0 && utilChange < 0) ? C.profitNeg : C.warning;

    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("fill", trendColor)
      .attr("font-size", "13px")
      .attr("font-weight", "600")
      .text(trendText);

    // Axes
    var FONT = "Inter, -apple-system, sans-serif";
    var LABEL_COLOR = "#5F6B7A";
    var MUTED_COLOR = "#94A3B8";
    var AXIS_COLOR = "#E4E7EC";

    var xAxisGen = d3.axisBottom(xScale).ticks(6).tickFormat(function(d) { return d + "%"; });
    var xAxisG = g.append("g").attr("transform", "translate(0," + innerH + ")").call(xAxisGen);
    xAxisG.select(".domain").attr("stroke", AXIS_COLOR);
    xAxisG.selectAll(".tick line").attr("stroke", AXIS_COLOR);
    xAxisG.selectAll(".tick text").attr("fill", LABEL_COLOR).attr("font-size", "10px").attr("font-family", FONT);

    var yAxisGen = d3.axisLeft(yScale).ticks(6).tickFormat(function(d) { return "\u20AC" + Math.round(d); });
    var yAxisG = g.append("g").call(yAxisGen);
    yAxisG.select(".domain").attr("stroke", AXIS_COLOR);
    yAxisG.selectAll(".tick line").attr("stroke", AXIS_COLOR);
    yAxisG.selectAll(".tick text").attr("fill", LABEL_COLOR).attr("font-size", "10px").attr("font-family", FONT);

    g.append("text").attr("x", innerW / 2).attr("y", innerH + 36)
      .attr("text-anchor", "middle").attr("fill", MUTED_COLOR)
      .attr("font-size", "10px").attr("font-family", FONT)
      .text("Utilisation %");

    g.append("text").attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -margin.left + 14)
      .attr("text-anchor", "middle").attr("fill", MUTED_COLOR)
      .attr("font-size", "10px").attr("font-family", FONT)
      .text("Effective Rate (\u20AC/hr)");
  }

  // Functions called from HTML onclick
  window.showAnalysisTab = showAnalysisTab;
  window.updateTrajectoryChart = updateTrajectoryChart;

  D.registerSection("analysis", function(f) {
    renderAnalysisCharts(f);
  });
})(window.Dashboard);
