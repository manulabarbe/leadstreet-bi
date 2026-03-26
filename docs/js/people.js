// ============================================================
// people.js — People section charts & rendering (D3 version)
// ============================================================

(function(D) {
  var u = D.utils;
  var C = D.C;
  var d3c = D.d3;
  var PROD_BASE = D.PROD_BASE;
  var DATA = D.DATA;

  // --- Module state ---
  var heatmapViewMode = "individual"; // "individual" or "team"

  // --- Helper: get budget rate ---
  function getBudgetRate() {
    var rate = 112;
    if (DATA.budget_target_rate) {
      var years = Object.keys(DATA.budget_target_rate);
      if (years.length > 0) rate = DATA.budget_target_rate[years[years.length - 1]] || 112;
    }
    return rate;
  }

  // --- People Landscape: Total Hours vs Utilisation scatter ---
  function buildPeopleLandscape(data) {
    var byPerson = {};
    data.forEach(function(r) {
      if (!byPerson[r.person_name]) byPerson[r.person_name] = {name:r.person_name,hours:0,billable:0,revenue:0,cost:0};
      byPerson[r.person_name].hours += r.hours||0;
      byPerson[r.person_name].billable += r.billable_hours||0;
      byPerson[r.person_name].revenue += r.revenue||0;
      byPerson[r.person_name].cost += r.staff_cost||0;
    });

    var scData = Object.values(byPerson).filter(function(p) {
      return p.hours > 0;
    }).map(function(p) {
      var util = p.hours > 0 ? p.billable / p.hours * 100 : 0;
      var effRate = p.hours > 0 ? p.revenue / p.hours : 0;
      return {
        x: p.hours,
        y: util,
        revenue: p.revenue,
        name: p.name,
        hours: p.hours,
        billable: p.billable,
        cost: p.cost,
        effRate: effRate
      };
    });

    if (scData.length === 0) return;

    // Compute budget target for reference line
    var utilTarget = 57;
    if (DATA.budget_people) {
      var tw=0,wu=0;
      DATA.budget_people.filter(function(p){return p.year===2026&&p.productive_name;}).forEach(function(p){
        var w=p.rate_target||112; tw+=w; wu+=(p.billability_target||0)*100*w;
      });
      if (tw>0) utilTarget=wu/tw;
    }

    var sortedHours = scData.map(function(d) { return d.x; }).sort(function(a,b) { return a-b; });
    var medianHours = sortedHours[Math.floor(sortedHours.length / 2)] || 0;

    d3c.scatter("chart-ppl-hours", scData, {
      xField: "x", yField: "y",
      sizeField: "revenue",
      colorFn: function(d) {
        return d.y >= 60 ? C.onTrack : d.y >= 40 ? C.warning : C.overbudget;
      },
      textField: "name",
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + d.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Utilisation</span><span style='font-weight:600;color:#1A1D21'>" + d.y.toFixed(1) + "%</span>" +
          "<span>Total Hours</span><span style='font-weight:500'>" + d3c.fmtNum(d.hours) + "h</span>" +
          "<span>Billable</span><span style='font-weight:500'>" + d3c.fmtNum(d.billable) + "h</span>" +
          "<span>Revenue</span><span style='font-weight:500'>\u20AC" + d3c.fmtNum(Math.round(d.revenue)) + "</span>" +
          "<span>Eff Rate</span><span style='font-weight:500'>\u20AC" + d.effRate.toFixed(0) + "/hr</span>" +
          "</div>";
      },
      xLabel: "Total Hours",
      yLabel: "Utilisation (%)",
      xFormat: function(d) { return d3c.fmtNum(d) + "h"; },
      yFormat: function(d) { return d + "%"; },
      refLines: [
        {axis: "x", value: medianHours, color: "#CBD5E1", dash: "4,3", label: "Median hrs"},
        {axis: "y", value: utilTarget, color: "#CBD5E1", dash: "4,3", label: "Target " + utilTarget.toFixed(0) + "%"}
      ],
      quadrants: [
        {x: 0.02, y: 0.98, text: "Low Hours, Low Util", anchor: "start"},
        {x: 0.98, y: 0.98, text: "High Hours, Low Util", anchor: "end"},
        {x: 0.02, y: 0.02, text: "Low Hours, High Util", anchor: "start"},
        {x: 0.98, y: 0.02, text: "Workhorses", anchor: "end"}
      ],
      minSize: 8, maxSize: 28,
      margin: {top: 20, right: 40, bottom: 50, left: 60},
      height: 450
    });
  }

  // ============================================================
  // HEATMAP SYSTEM
  // ============================================================

  // --- Shared heatmap metric option objects ---
  var utilOpts = {
    metric: function(d){ return d.hours > 0 ? d.billable/d.hours*100 : 0; },
    label: "Util %", suffix: "%", zmin: 0, zmax: 100,
    fmt: function(v){ return v.toFixed(0)+"%"; },
    colorscale: [[0,C.overbudget],[0.4,C.overbudget],[0.6,C.warning],[0.8,C.onTrack],[1,C.onTrack]]
  };

  var effRateOpts = {
    metric: function(d){ return d.hours > 0 ? d.revenue/d.hours : 0; },
    label: "Eff Rate \u20AC", suffix: "", zmin: 0, zmax: 150,
    fmt: function(v){ return "\u20AC"+v.toFixed(0); },
    colorscale: [[0,C.overbudget],[0.4,C.overbudget],[0.6,C.warning],[0.75,C.onTrack],[1,C.onTrack]]
  };

  var costOpts = {
    metric: function(d){ return d.hours > 0 ? d.cost/d.hours : 0; },
    label: "Cost \u20AC/hr", suffix: "", zmin: 0, zmax: 80,
    fmt: function(v){ return "\u20AC"+v.toFixed(0); },
    // Inverted: low cost = green, high cost = red
    colorscale: [[0,C.onTrack],[0.4,C.onTrack],[0.6,C.warning],[0.8,C.overbudget],[1,C.overbudget]]
  };

  var avgRateOpts = {
    metric: function(d){ return d.billable > 0 ? d.revenue/d.billable : 0; },
    label: "Avg Rate \u20AC", suffix: "", zmin: 0, zmax: 200,
    fmt: function(v){ return "\u20AC"+v.toFixed(0); },
    colorscale: [[0,C.overbudget],[0.4,C.overbudget],[0.6,C.warning],[0.75,C.onTrack],[1,C.onTrack]]
  };

  var marginPctOpts = {
    metric: function(d){ return d.revenue > 0 ? (d.revenue - d.cost)/d.revenue*100 : (d.cost > 0 ? -100 : 0); },
    label: "Margin %", suffix: "%", zmin: -50, zmax: 100,
    fmt: function(v){ return v.toFixed(0)+"%"; },
    colorscale: [[0,C.overbudget],[0.33,C.overbudget],[0.5,C.warning],[0.7,C.onTrack],[1,C.onTrack]]
  };

  var marginEurOpts = {
    metric: function(d){ return d.revenue - d.cost; },
    label: "Margin \u20AC", suffix: "", zmin: -5000, zmax: 15000,
    fmt: function(v){ return (v >= 0 ? "\u20AC" : "-\u20AC") + d3c.fmtNum(Math.abs(Math.round(v))); },
    colorscale: [[0,C.overbudget],[0.25,C.overbudget],[0.4,C.warning],[0.6,C.onTrack],[1,C.onTrack]]
  };

  // --- People Heatmap (person × month) ---
  function buildPeopleHeatmap(data, opts, teamFilter) {
    var personTeamMap = {};
    data.forEach(function(r){ if (r.person_name && r.team) personTeamMap[r.person_name] = r.team; });

    var people = []; var pSet = {};
    data.forEach(function(r){
      if (!pSet[r.person_name]) {
        if (!teamFilter || r.team === teamFilter) {
          pSet[r.person_name]=1; people.push(r.person_name);
        }
      }
    });
    var months = []; var mSet = {};
    data.forEach(function(r){
      var m = r.month ? r.month.substring(0,7) : null;
      if (m && !mSet[m]) { mSet[m]=1; months.push(m); }
    });
    months.sort();

    // Build person_name -> person_id lookup
    var personIdMap = {};
    data.forEach(function(r){ if (r.person_id && !personIdMap[r.person_name]) personIdMap[r.person_name] = r.person_id; });

    // Group data by person+month AND totals per month (for avg row)
    var lookup = {};
    var monthTotals = {};
    data.forEach(function(r){
      var m = r.month ? r.month.substring(0,7) : null;
      var key = r.person_name + "|" + m;
      if (!lookup[key]) lookup[key] = {hours:0,billable:0,cost:0,revenue:0};
      lookup[key].hours += r.hours||0;
      lookup[key].billable += r.billable_hours||0;
      lookup[key].cost += r.staff_cost||0;
      lookup[key].revenue += r.revenue||0;
      if (pSet[r.person_name]) {
        if (!monthTotals[m]) monthTotals[m] = {hours:0,billable:0,cost:0,revenue:0};
        monthTotals[m].hours += r.hours||0;
        monthTotals[m].billable += r.billable_hours||0;
        monthTotals[m].cost += r.staff_cost||0;
        monthTotals[m].revenue += r.revenue||0;
      }
    });

    // Compute avg per person for sorting
    var avgByPerson = {};
    people.forEach(function(p){ avgByPerson[p] = {sum:0,cnt:0}; });
    people.forEach(function(p){
      months.forEach(function(m){
        var d = lookup[p+"|"+m];
        if (d && d.hours > 0) {
          var v = opts.metric(d);
          avgByPerson[p].sum += v;
          avgByPerson[p].cnt++;
        }
      });
    });

    // Sort: if all teams, group by team then sort within team
    if (!teamFilter) {
      var teamOrder = {};
      var teamList = [];
      people.forEach(function(p) {
        var t = personTeamMap[p] || "Unassigned";
        if (!teamOrder[t]) { teamOrder[t] = []; teamList.push(t); }
        teamOrder[t].push(p);
      });
      teamList.sort();
      teamList.forEach(function(t) {
        teamOrder[t].sort(function(a,b) {
          var aa = avgByPerson[a].cnt > 0 ? avgByPerson[a].sum/avgByPerson[a].cnt : -999;
          var bb = avgByPerson[b].cnt > 0 ? avgByPerson[b].sum/avgByPerson[b].cnt : -999;
          return aa - bb;
        });
      });
      var sortedPeople = [];
      teamList.forEach(function(t) {
        teamOrder[t].forEach(function(p) { sortedPeople.push(p); });
      });
      people = sortedPeople;
    } else {
      people.sort(function(a,b){
        var aa = avgByPerson[a].cnt > 0 ? avgByPerson[a].sum/avgByPerson[a].cnt : -999;
        var bb = avgByPerson[b].cnt > 0 ? avgByPerson[b].sum/avgByPerson[b].cnt : -999;
        return aa - bb;
      });
    }

    // Build month labels for x-axis (short format)
    var abbr = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var monthLabels = months.map(function(m) {
      var p = m.split("-");
      return abbr[parseInt(p[1],10)-1] + " '" + p[0].substring(2);
    });

    // Build AVG row
    var avgRow = []; var avgTextRow = [];
    months.forEach(function(m){
      var d = monthTotals[m];
      if (d && d.hours > 0) {
        var v = opts.metric(d);
        avgRow.push(v);
        avgTextRow.push(opts.fmt ? opts.fmt(v) : v.toFixed(0) + (opts.suffix||""));
      } else {
        avgRow.push(null);
        avgTextRow.push("");
      }
    });

    // Build y-labels and matrices
    var zMatrix = []; var textMatrix = []; var yLabels = [];
    people.forEach(function(p){
      var label = (!teamFilter) ? p + "  [" + (personTeamMap[p]||"").replace(/Contract(ors?|os)\s*/i,"").substring(0,6) + "]" : p;
      yLabels.push(label);
      var row = []; var trow = [];
      months.forEach(function(m){
        var d = lookup[p+"|"+m];
        if (d && d.hours > 0) {
          var v = opts.metric(d);
          row.push(v);
          trow.push(opts.fmt ? opts.fmt(v) : v.toFixed(0) + (opts.suffix||""));
        } else {
          row.push(null);
          trow.push("");
        }
      });
      zMatrix.push(row); textMatrix.push(trow);
    });

    // Append avg row at top of chart (last in array)
    var avgLabel = teamFilter ? "\u25B8 " + teamFilter.substring(0,20) + " AVG" : "\u25B8 ALL TEAMS AVG";
    zMatrix.push(avgRow); textMatrix.push(avgTextRow);
    yLabels.push(avgLabel);

    // Store personIds for click handler
    var personIds = {};
    people.forEach(function(p){ if (personIdMap[p]) personIds[p] = personIdMap[p]; });

    return {
      monthLabels: monthLabels,
      yLabels: yLabels,
      zMatrix: zMatrix,
      textMatrix: textMatrix,
      personIds: personIds,
      colorscale: opts.colorscale,
      zmin: opts.zmin,
      zmax: opts.zmax,
      label: opts.label,
      suffix: opts.suffix,
      isTeamView: false
    };
  }

  // --- Team Heatmap (team × month) ---
  function buildTeamHeatmap(data, opts) {
    var teams = []; var tSet = {};
    data.forEach(function(r){
      if (r.team && !tSet[r.team]) { tSet[r.team]=1; teams.push(r.team); }
    });
    teams.sort();

    var months = []; var mSet = {};
    data.forEach(function(r){
      var m = r.month ? r.month.substring(0,7) : null;
      if (m && !mSet[m]) { mSet[m]=1; months.push(m); }
    });
    months.sort();

    // Group data by team+month AND totals per month
    var lookup = {};
    var monthTotals = {};
    data.forEach(function(r){
      var m = r.month ? r.month.substring(0,7) : null;
      var key = r.team + "|" + m;
      if (!lookup[key]) lookup[key] = {hours:0,billable:0,cost:0,revenue:0};
      lookup[key].hours += r.hours||0;
      lookup[key].billable += r.billable_hours||0;
      lookup[key].cost += r.staff_cost||0;
      lookup[key].revenue += r.revenue||0;
      if (!monthTotals[m]) monthTotals[m] = {hours:0,billable:0,cost:0,revenue:0};
      monthTotals[m].hours += r.hours||0;
      monthTotals[m].billable += r.billable_hours||0;
      monthTotals[m].cost += r.staff_cost||0;
      monthTotals[m].revenue += r.revenue||0;
    });

    // Sort teams by avg metric value
    var avgByTeam = {};
    teams.forEach(function(t){
      avgByTeam[t] = {sum:0,cnt:0};
      months.forEach(function(m){
        var d = lookup[t+"|"+m];
        if (d && d.hours > 0) {
          avgByTeam[t].sum += opts.metric(d);
          avgByTeam[t].cnt++;
        }
      });
    });
    teams.sort(function(a,b){
      var aa = avgByTeam[a].cnt > 0 ? avgByTeam[a].sum/avgByTeam[a].cnt : -999;
      var bb = avgByTeam[b].cnt > 0 ? avgByTeam[b].sum/avgByTeam[b].cnt : -999;
      return aa - bb;
    });

    // Month labels
    var abbr = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var monthLabels = months.map(function(m) {
      var p = m.split("-");
      return abbr[parseInt(p[1],10)-1] + " '" + p[0].substring(2);
    });

    // Build AVG row
    var avgRow = []; var avgTextRow = [];
    months.forEach(function(m){
      var d = monthTotals[m];
      if (d && d.hours > 0) {
        var v = opts.metric(d);
        avgRow.push(v);
        avgTextRow.push(opts.fmt ? opts.fmt(v) : v.toFixed(0) + (opts.suffix||""));
      } else {
        avgRow.push(null);
        avgTextRow.push("");
      }
    });

    // Build matrices
    var zMatrix = []; var textMatrix = []; var yLabels = [];
    teams.forEach(function(t){
      yLabels.push(t);
      var row = []; var trow = [];
      months.forEach(function(m){
        var d = lookup[t+"|"+m];
        if (d && d.hours > 0) {
          var v = opts.metric(d);
          row.push(v);
          trow.push(opts.fmt ? opts.fmt(v) : v.toFixed(0) + (opts.suffix||""));
        } else {
          row.push(null);
          trow.push("");
        }
      });
      zMatrix.push(row); textMatrix.push(trow);
    });

    // Append avg row
    zMatrix.push(avgRow); textMatrix.push(avgTextRow);
    yLabels.push("\u25B8 ALL TEAMS AVG");

    return {
      monthLabels: monthLabels,
      yLabels: yLabels,
      zMatrix: zMatrix,
      textMatrix: textMatrix,
      personIds: {},
      colorscale: opts.colorscale,
      zmin: opts.zmin,
      zmax: opts.zmax,
      label: opts.label,
      suffix: opts.suffix,
      isTeamView: true
    };
  }

  // --- Render a single D3 heatmap with clickable y-axis labels ---
  function renderHeatmap(chartId, spec) {
    if (!spec || !spec.yLabels || spec.yLabels.length === 0) return;

    d3c.heatmap(chartId, null, {
      xLabels: spec.monthLabels,
      yLabels: spec.yLabels,
      zMatrix: spec.zMatrix,
      textMatrix: spec.textMatrix,
      colorScale: spec.colorscale,
      zMin: spec.zmin != null ? spec.zmin : 0,
      zMax: spec.zmax != null ? spec.zmax : 100,
      tooltipFn: function(cell) {
        var lines = [
          "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + cell.yLabel + "</div>",
          "<div style='color:#5F6B7A'>" + cell.xLabel + ": <span style='font-weight:600;color:#1A1D21'>" + cell.text + "</span></div>"
        ];
        if (!spec.isTeamView && cell.z != null) {
          lines.push("<div style='margin-top:4px;font-size:10px;color:#94A3B8;font-style:italic'>Click name to open in Productive</div>");
        }
        return lines.join("");
      },
      onYClick: spec.isTeamView ? null : function(yLabel) {
        if (yLabel.indexOf("AVG") >= 0) return;
        // Strip team suffix like "  [Ops]"
        var cleanName = yLabel.replace(/\s+\[.*\]$/, "");
        var pid = spec.personIds[cleanName];
        if (pid) {
          window.open(PROD_BASE + "/employees/person/" + pid + "/time?filter=LTE%3D", "_blank");
        }
      },
      cellH: spec.isTeamView ? 40 : 28,
      margin: {top: 30, right: 20, bottom: 40, left: 180}
    });
  }

  // --- Re-render all 6 people heatmaps ---
  function renderAllPeopleHeatmaps() {
    var f = u.getFilters();
    var data = u.filterByMonth(DATA.people_monthly || [], "month", f.startMonth, f.endMonth);
    data = data.filter(function(r){ return f.teams.indexOf(r.team) >= 0; });
    if (!data || data.length === 0) return;

    var isTeam = heatmapViewMode === "team";
    var sel = document.getElementById("heatmap-team-select");
    var tf = (!isTeam && sel) ? sel.value : "";

    if (isTeam) {
      renderHeatmap("chart-ppl-util-heatmap",        buildTeamHeatmap(data, utilOpts));
      renderHeatmap("chart-ppl-effrate-heatmap",      buildTeamHeatmap(data, effRateOpts));
      renderHeatmap("chart-ppl-cost-heatmap",         buildTeamHeatmap(data, costOpts));
      renderHeatmap("chart-ppl-avgrate-heatmap",      buildTeamHeatmap(data, avgRateOpts));
      renderHeatmap("chart-ppl-margin-heatmap",       buildTeamHeatmap(data, marginPctOpts));
      renderHeatmap("chart-ppl-margin-eur-heatmap",   buildTeamHeatmap(data, marginEurOpts));
    } else {
      renderHeatmap("chart-ppl-util-heatmap",        buildPeopleHeatmap(data, utilOpts, tf));
      renderHeatmap("chart-ppl-effrate-heatmap",      buildPeopleHeatmap(data, effRateOpts, tf));
      renderHeatmap("chart-ppl-cost-heatmap",         buildPeopleHeatmap(data, costOpts, tf));
      renderHeatmap("chart-ppl-avgrate-heatmap",      buildPeopleHeatmap(data, avgRateOpts, tf));
      renderHeatmap("chart-ppl-margin-heatmap",       buildPeopleHeatmap(data, marginPctOpts, tf));
      renderHeatmap("chart-ppl-margin-eur-heatmap",   buildPeopleHeatmap(data, marginEurOpts, tf));
    }
  }

  // --- Individual/Team toggle ---
  function setPeopleHeatmapView(mode) {
    heatmapViewMode = mode;
    var indBtn = document.getElementById("hm-view-individual");
    var teamBtn = document.getElementById("hm-view-team");
    if (indBtn) indBtn.classList.toggle("active", mode === "individual");
    if (teamBtn) teamBtn.classList.toggle("active", mode === "team");

    // Hide/show team dropdown (irrelevant in team view)
    var wrapper = document.getElementById("heatmap-team-filter-wrapper");
    if (wrapper) wrapper.style.display = mode === "team" ? "none" : "";

    // Reset team filter when switching to team view
    if (mode === "team") {
      var sel = document.getElementById("heatmap-team-select");
      if (sel) sel.value = "";
    }

    // Update heatmap card headers
    var headers = document.querySelectorAll("[data-hm-title]");
    headers.forEach(function(el) {
      var base = el.getAttribute("data-hm-title");
      el.innerHTML = base + " by " + (mode === "team" ? "Team" : "Person") + " &mdash; Monthly";
    });

    renderAllPeopleHeatmaps();
  }

  // Expose for HTML onclick
  window.setPeopleHeatmapView = setPeopleHeatmapView;
  window.renderAllPeopleHeatmaps = renderAllPeopleHeatmaps;

  // === SECTION HANDLER ===
  D.registerSection("people", function(f) {
    var pplData = u.filterByMonth(DATA.people_monthly, "month", f.startMonth, f.endMonth);
    pplData = pplData.filter(function(r){ return f.teams.indexOf(r.team) >= 0; });
    var pplHours = u.sum(pplData,"hours");
    var pplBillable = u.sum(pplData,"billable_hours");
    var uniquePeople = new Set(pplData.map(function(r){return r.person_name}));

    // Compute budget target avg billability
    var utilLabel = u.pct(pplBillable,pplHours) + "%";
    if (DATA.budget_people && DATA.budget_people.length > 0) {
      var totalTarget = 0;
      var targetCount = 0;
      DATA.budget_people.forEach(function(bp) {
        if (bp.billability_target != null) {
          totalTarget += bp.billability_target * 100;
          targetCount++;
        }
      });
      if (targetCount > 0) {
        utilLabel = u.pct(pplBillable,pplHours) + "% vs " + (totalTarget/targetCount).toFixed(0) + "% target";
      }
    }

    u.setKPIs("kpi-people", [
      {label:"Utilisation", value:utilLabel},
      {label:"Headcount", value:String(uniquePeople.size)},
      {label:"Billable Hours", value:u.fmt(Math.round(pplBillable))+"h"},
      {label:"Total Hours", value:u.fmt(Math.round(pplHours))+"h"}
    ]);

    // --- People Monthly Trend Charts ---
    (function() {
      var monthMap = {};
      pplData.forEach(function(r) {
        var m = r.month ? r.month.substring(0,7) : null;
        if (!m) return;
        if (!monthMap[m]) monthMap[m] = {hours:0, billable:0, cost:0, rev:0};
        monthMap[m].hours += r.hours || 0;
        monthMap[m].billable += r.billable_hours || 0;
        monthMap[m].cost += r.staff_cost || 0;
        monthMap[m].rev += r.revenue || 0;
      });
      var months = Object.keys(monthMap).sort();
      var monthLabels = months.map(function(m) { var p=m.split("-"); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(p[1])-1]+" '"+p[0].substring(2); });

      var utilVals = months.map(function(m) { return monthMap[m].hours > 0 ? monthMap[m].billable/monthMap[m].hours*100 : null; });
      var effRateVals = months.map(function(m) { return monthMap[m].hours > 0 ? monthMap[m].rev/monthMap[m].hours : null; });
      var arphVals = months.map(function(m) { return monthMap[m].billable > 0 ? monthMap[m].rev/monthMap[m].billable : null; });
      var marginVals = months.map(function(m) { return monthMap[m].rev > 0 ? (monthMap[m].rev-monthMap[m].cost)/monthMap[m].rev*100 : null; });
      var marginEurVals = months.map(function(m) { return monthMap[m].rev - monthMap[m].cost; });

      var utilTarget = 57;
      if (DATA.budget_people) {
        var tw=0,wu=0; DATA.budget_people.filter(function(p){return p.year===2026&&p.productive_name;}).forEach(function(p){ var w=p.rate_target||112; tw+=w; wu+=(p.billability_target||0)*100*w; });
        if (tw>0) utilTarget=wu/tw;
      }
      var rateTarget = 112;
      if (DATA.budget_target_rate) { var yrs=Object.keys(DATA.budget_target_rate); if(yrs.length>0) rateTarget=DATA.budget_target_rate[yrs[yrs.length-1]]||112; }
      var effTarget = utilTarget/100*rateTarget;

      function monthlyBar(chartId, vals, target, barOpts) {
        var barData = monthLabels.map(function(label, i) {
          return {month: label, value: vals[i]};
        }).filter(function(d) { return d.value != null; });

        if (barData.length === 0) return;

        d3c.verticalBar(chartId, barData, {
          xField: "month",
          series: [{field: "value", label: barOpts.yTitle, color: C.revenue}],
          colorFn: function(d) {
            if (target == null) return C.revenue;
            return d.value >= target ? C.onTrack : d.value >= target * 0.85 ? C.warning : C.overbudget;
          },
          target: target,
          targetLabel: target != null ? "Target: " + barOpts.fmt(target) : null,
          tooltipFn: function(d) {
            return "<div style='font-weight:600;margin-bottom:4px'>" + d.month + "</div>" +
              "<div style='color:#5F6B7A'>" + barOpts.yTitle + ": <span style='font-weight:600;color:#1A1D21'>" + barOpts.fmt(d.value) + "</span></div>";
          },
          textOnBars: {field: "value", format: function(v) { return barOpts.fmt(v); }},
          yLabel: barOpts.yTitle,
          height: 280
        });
      }

      monthlyBar("chart-ppl-util-monthly", utilVals, utilTarget, {yTitle:"Utilisation %", fmt:function(v){return v.toFixed(1)+"%";}});
      monthlyBar("chart-ppl-effrate-monthly", effRateVals, effTarget, {yTitle:"Effective Rate (\u20AC/hr)", fmt:function(v){return "\u20AC"+Math.round(v);}});
      monthlyBar("chart-ppl-rate-monthly", arphVals, rateTarget, {yTitle:"Avg Rate (\u20AC/hr)", fmt:function(v){return "\u20AC"+Math.round(v);}});
      monthlyBar("chart-ppl-margin-monthly", marginVals, null, {yTitle:"Delivery Margin %", fmt:function(v){return v.toFixed(1)+"%";}});
      monthlyBar("chart-ppl-margin-eur-monthly", marginEurVals, null, {yTitle:"Delivery Margin (\u20AC)", fmt:function(v){return "\u20AC"+d3c.fmtNum(Math.round(v));}});
    })();

    // Populate heatmap team dropdown
    var hmTeamSelect = document.getElementById("heatmap-team-select");
    if (hmTeamSelect) {
      var hmTeams = {};
      pplData.forEach(function(r){ if (r.team) hmTeams[r.team] = 1; });
      var existingOpts = hmTeamSelect.querySelectorAll("option:not([value=''])");
      existingOpts.forEach(function(o){ o.remove(); });
      Object.keys(hmTeams).sort().forEach(function(t) {
        var opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        hmTeamSelect.appendChild(opt);
      });
    }

    renderAllPeopleHeatmaps();
    buildPeopleLandscape(pplData);
  });

})(window.Dashboard);
