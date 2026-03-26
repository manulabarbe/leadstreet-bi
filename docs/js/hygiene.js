(function(D) {
  var u = D.utils;
  var C = D.C;
  var DATA = D.DATA;
  var d3c = D.d3;
  var PROD_BASE = D.PROD_BASE;

  // === BILLABILITY STATE ===
  var _billEntries = [];
  var _billGroups = [];

  // === CHART BUILDERS (D3) ===

  function renderHygieneTrend(containerId, data) {
    d3c.lineTrend(containerId, data, {
      xField: "month",
      series: [{field: "pct_with_note", label: "% With Note", color: C.revenue, width: 2}],
      tooltipFn: function(d) {
        return "<div style='font-weight:600;margin-bottom:4px'>" + d.month + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>% With Note</span><span style='font-weight:600;color:#1A1D21'>" + (d.pct_with_note||0).toFixed(1) + "%</span>" +
          "<span>Entries</span><span style='font-weight:500'>" + (d.total||0) + "</span>" +
          "</div>";
      },
      yLabel: "% With Note",
      target: 80,
      targetLabel: "80% target",
      height: 300,
      margin: {top: 16, right: 50, bottom: 44, left: 60}
    });
  }

  function renderHygienePerson(containerId, data) {
    var d = data.slice().sort(function(a,b){return a.note_pct - b.note_pct});
    d3c.horizontalBar(containerId, d, {
      yField: "person_name",
      xField: "note_pct",
      colorFn: function(r){ return r.note_pct>=80?C.onTrack:r.note_pct>=50?C.warning:C.overbudget; },
      labelFn: function(r){ return r.note_pct.toFixed(1)+"%"; },
      labelColorFn: function(r){ return r.note_pct>=80?"#059669":r.note_pct>=50?"#d97706":"#dc2626"; },
      tooltipFn: function(r){
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.person_name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Note %</span><span style='font-weight:600;color:#1A1D21'>" + r.note_pct.toFixed(1) + "%</span>" +
          "<span>Missing Notes</span><span style='font-weight:500'>" + r.missing_notes + "</span>" +
          "<span>Team</span><span style='font-weight:500'>" + (r.team||"") + "</span>" +
          "</div>";
      },
      target: 80,
      targetLabel: "80% target",
      targetColor: C.onTrack,
      xLabel: "% With Note",
      xFormat: function(v){ return v+"%"; },
      margin: {top: 24, right: 70, bottom: 36, left: 150},
      maxLabelLen: 22,
      barHeight: 26
    });
  }

  // === HYGIENE SUB-TABS ===
  function showHygieneTab(tab, btn) {
    document.querySelectorAll("#hygiene-tabs .tab-btn").forEach(function(b){ b.classList.remove("active"); });
    btn.classList.add("active");
    document.querySelectorAll("#section-hygiene .tab-content").forEach(function(c){ c.classList.remove("active"); c.style.display="none"; });
    var el = document.getElementById("hyg-tab-"+tab);
    if (el) { el.classList.add("active"); el.style.display="block"; }
  }

  function renderScorecardHeatmap(containerId, data) {
    // data = person_scorecard array
    var people = []; var pSet = {};
    data.forEach(function(r){ if (!pSet[r.person_name]) { pSet[r.person_name]=1; people.push(r.person_name); } });
    var months = []; var mSet = {};
    data.forEach(function(r){ if (!mSet[r.month]) { mSet[r.month]=1; months.push(r.month); } });
    months.sort();
    // Sort people by avg note_pct ascending (worst first at bottom)
    var avgByPerson = {};
    data.forEach(function(r){
      if (!avgByPerson[r.person_name]) avgByPerson[r.person_name] = {sum:0,cnt:0};
      avgByPerson[r.person_name].sum += r.note_pct||0;
      avgByPerson[r.person_name].cnt++;
    });
    people.sort(function(a,b){ return (avgByPerson[a].sum/avgByPerson[a].cnt) - (avgByPerson[b].sum/avgByPerson[b].cnt); });

    // Build 2D array
    var z = []; var text = [];
    people.forEach(function(p){
      var row = []; var trow = [];
      months.forEach(function(m){
        var found = data.find(function(r){ return r.person_name===p && r.month===m; });
        row.push(found ? found.note_pct : null);
        trow.push(found ? found.note_pct.toFixed(0)+"%" : "");
      });
      z.push(row); text.push(trow);
    });

    d3c.heatmap(containerId, null, {
      xLabels: months,
      yLabels: people,
      zMatrix: z,
      textMatrix: text,
      colorScale: [[0,C.overbudget],[0.5,C.warning],[0.8,C.onTrack],[1,C.onTrack]],
      zMin: 0,
      zMax: 100,
      tooltipFn: function(cell){
        return "<div style='font-weight:600;margin-bottom:4px'>" + cell.yLabel + "</div>" +
          "<span>" + cell.xLabel + ": </span><span style='font-weight:600'>" + (cell.z != null ? cell.z.toFixed(1) + "% notes" : "N/A") + "</span>";
      },
      margin: {top: 30, right: 20, bottom: 40, left: 150},
      cellH: 28
    });
  }

  function renderBudgetAudit(containerId, data, issueType) {
    var d = data.filter(function(r){ return r.issue === issueType; });
    if (d.length === 0) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
      return;
    }
    d = d.slice(0, 20);
    d.sort(function(a,b){ return a.worked_hours - b.worked_hours; });

    d3c.horizontalBar(containerId, d, {
      yField: "name",
      xField: "worked_hours",
      colorFn: function(r){ return r.worked_hours > 50 ? C.overbudget : r.worked_hours > 10 ? C.warning : C.nonBillable; },
      labelFn: function(r){ return d3c.fmtNum(Math.round(r.worked_hours))+"h"; },
      labelColorFn: function(r){ return r.worked_hours > 50 ? "#dc2626" : r.worked_hours > 10 ? "#d97706" : "#64748b"; },
      tooltipFn: function(r){
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Client</span><span style='font-weight:500'>" + (r.company_name||"") + "</span>" +
          "<span>Worked</span><span style='font-weight:600;color:#1A1D21'>" + d3c.fmtNum(Math.round(r.worked_hours)) + "h</span>" +
          "<span>Budget</span><span style='font-weight:500'>" + d3c.fmtNum(Math.round(r.budgeted_hours)) + "h</span>" +
          "<span>Revenue</span><span style='font-weight:500'>" + d3c.fmtEur(r.revenue) + "</span>" +
          "<span>Cost</span><span style='font-weight:500'>" + d3c.fmtEur(r.cost) + "</span>" +
          (r.project_id && r.company_id ? "<div style='margin-top:4px;font-style:italic;color:#94A3B8'>Click to open in Productive</div>" : "") +
          "</div>";
      },
      onClick: function(r){
        if (r.project_id && r.company_id) {
          window.open(PROD_BASE+"/projects/"+r.project_id+"/budgets/company/"+r.company_id+"/info", "_blank");
        }
      },
      xLabel: "Worked Hours (no budget set)",
      margin: {top: 24, right: 70, bottom: 36, left: 300},
      maxLabelLen: 45,
      barHeight: 24
    });
  }

  function renderIssueList(containerId, data, xLabel) {
    if (data.length === 0) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
      return;
    }
    var d = data.slice(0, 15);
    var key = d[0].deal_name !== undefined ? "deal_name" : "name";
    d.sort(function(a,b){ return a.hours - b.hours; });

    d3c.horizontalBar(containerId, d, {
      yField: key,
      xField: "hours",
      colorFn: function(){ return C.warning; },
      labelFn: function(r){ return r.hours.toFixed(1)+"h"; },
      labelColorFn: function(){ return "#d97706"; },
      tooltipFn: function(r){
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + (r[key]||"?") + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Hours</span><span style='font-weight:600;color:#1A1D21'>" + r.hours.toFixed(1) + "h</span>" +
          "<span>Entries</span><span style='font-weight:500'>" + r.entries + "</span>" +
          "</div>";
      },
      xLabel: xLabel,
      margin: {top: 24, right: 70, bottom: 36, left: 300},
      maxLabelLen: 60,
      barHeight: 25
    });
  }

  // === PSO HEALTH ===
  function renderPSOBurn(containerId, data, opts) {
    // Data is pre-filtered and pre-sorted by the pager caller
    // Cap burn_pct at 200% for chart display (real value in tooltip)
    var d = data.map(function(r) {
      var copy = Object.assign({}, r);
      copy._realBurn = r.burn_pct;
      copy.burn_pct = Math.min(r.burn_pct, 200);
      return copy;
    });

    d3c.horizontalBar(containerId, d, Object.assign({
      yField: "name",
      xField: "burn_pct",
      colorFn: function(r){ return r.burn_pct > 100 ? C.overbudget : r.burn_pct > 70 ? C.warning : C.onTrack; },
      labelFn: function(r){ var bp = r._realBurn||r.burn_pct; return (bp>=999?"No budget":bp.toFixed(0)+"%"); },
      labelColorFn: function(r){ return r.burn_pct > 100 ? "#dc2626" : r.burn_pct > 70 ? "#d97706" : "#059669"; },
      tooltipFn: function(r){
        var bp = r._realBurn||r.burn_pct;
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Client</span><span style='font-weight:500'>" + (r.company_name||"") + "</span>" +
          "<span>Burn</span><span style='font-weight:600;color:#1A1D21'>" + (bp>=999?"No budget set":bp.toFixed(0)+"%") + "</span>" +
          "<span>Worked</span><span style='font-weight:500'>" + r.worked_hours.toFixed(1) + "h / " + r.budgeted_hours.toFixed(1) + "h budget</span>" +
          "<span>Revenue</span><span style='font-weight:500'>" + d3c.fmtEur(r.revenue) + "</span>" +
          "<span>Cost</span><span style='font-weight:500'>" + d3c.fmtEur(r.cost) + "</span>" +
          (r.deal_id ? "<div style='margin-top:4px;font-style:italic;color:#94A3B8'>Click to open in Productive</div>" : "") +
          "</div>";
      },
      onClick: function(r){
        if (r.deal_id) {
          window.open(PROD_BASE+"/financials/budgets/d/deal/"+r.deal_id+"/services", "_blank");
        }
      },
      target: 100,
      targetLabel: "100% budget",
      targetColor: C.overbudget,
      xLabel: "Budget Burn %",
      xFormat: function(v){ return v+"%"; },
      margin: {top: 24, right: 70, bottom: 36, left: 220},
      maxLabelLen: 35,
      barHeight: 24
    }, opts || {}));
  }

  function renderPSOIssues(containerId, data, opts) {
    // Data is pre-filtered (issue_count > 0) and pre-sorted by the pager caller
    if (data.length === 0) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
      return;
    }

    d3c.horizontalBar(containerId, data, Object.assign({
      yField: "name",
      xField: "issue_count",
      colorFn: function(r){ return r.severity==="critical" ? C.overbudget : C.warning; },
      labelFn: function(r){ return r.issues; },
      labelColorFn: function(r){ return r.severity==="critical" ? "#dc2626" : "#d97706"; },
      tooltipFn: function(r){
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Client</span><span style='font-weight:500'>" + (r.company_name||"") + "</span>" +
          "<span>Issues</span><span style='font-weight:600;color:#1A1D21'>" + r.issues + "</span>" +
          "<span>Worked</span><span style='font-weight:500'>" + r.worked_hours.toFixed(1) + "h</span>" +
          (r.deal_id ? "<div style='margin-top:4px;font-style:italic;color:#94A3B8'>Click to open in Productive</div>" : "") +
          "</div>";
      },
      onClick: function(r){
        if (r.deal_id) {
          window.open(PROD_BASE+"/financials/budgets/d/deal/"+r.deal_id+"/services", "_blank");
        }
      },
      xLabel: "Issue Count",
      margin: {top: 24, right: 70, bottom: 36, left: 220},
      maxLabelLen: 35,
      barHeight: 24
    }, opts || {}));
  }

  // === BUDGET LIFECYCLE ===
  function renderClosedActivity(containerId, data) {
    if (data.length === 0) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
      return;
    }
    var d = data.slice(0, 15);
    d.sort(function(a,b){ return a.post_close_hours - b.post_close_hours; });

    d3c.horizontalBar(containerId, d, {
      yField: "name",
      xField: "post_close_hours",
      colorFn: function(){ return C.overbudget; },
      labelFn: function(r){ return r.post_close_hours.toFixed(1)+"h"; },
      labelColorFn: function(){ return "#dc2626"; },
      tooltipFn: function(r){
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Client</span><span style='font-weight:500'>" + (r.company_name||"") + "</span>" +
          "<span>Closed</span><span style='font-weight:500'>" + r.closed_date + "</span>" +
          "<span>Last entry</span><span style='font-weight:500'>" + r.last_entry + "</span>" +
          "<span>Post-close</span><span style='font-weight:600;color:#1A1D21'>" + r.post_close_hours.toFixed(1) + "h (" + r.post_close_entries + " entries)</span>" +
          "<span>Revenue at risk</span><span style='font-weight:500'>" + d3c.fmtEur(r.post_close_revenue) + "</span>" +
          (r.deal_id ? "<div style='margin-top:4px;font-style:italic;color:#94A3B8'>Click to open in Productive</div>" : "") +
          "</div>";
      },
      onClick: function(r){
        if (r.deal_id) {
          window.open(PROD_BASE+"/financials/budgets/d/deal/"+r.deal_id+"/services", "_blank");
        }
      },
      xLabel: "Hours Logged After Close",
      margin: {top: 24, right: 70, bottom: 36, left: 300},
      maxLabelLen: 45,
      barHeight: 30
    });
  }

  function renderStaleBudgets(containerId, data) {
    if (data.length === 0) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
      return;
    }
    // Show critical + warning first, limit to 20
    var d = data.filter(function(r){ return r.severity==="critical"||r.severity==="warning"; });
    if (d.length === 0) d = data.slice(0, 15);
    if (d.length > 20) d = d.slice(0, 20);
    d.sort(function(a,b){ return a.days_inactive - b.days_inactive; });

    d3c.horizontalBar(containerId, d, {
      yField: "name",
      xField: "days_inactive",
      colorFn: function(r){ return r.severity==="critical" ? C.overbudget : r.severity==="warning" ? C.warning : C.nonBillable; },
      labelFn: function(r){ return r.days_inactive+"d"; },
      labelColorFn: function(r){ return r.severity==="critical" ? "#dc2626" : r.severity==="warning" ? "#d97706" : "#64748b"; },
      tooltipFn: function(r){
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Client</span><span style='font-weight:500'>" + (r.company_name||"") + "</span>" +
          "<span>Days inactive</span><span style='font-weight:600;color:#1A1D21'>" + r.days_inactive + "</span>" +
          "<span>Burn</span><span style='font-weight:500'>" + r.burn_pct.toFixed(0) + "%</span>" +
          "<span>Worked</span><span style='font-weight:500'>" + r.worked_hours.toFixed(1) + "h / " + r.budgeted_hours.toFixed(1) + "h budget</span>" +
          "<span>Revenue</span><span style='font-weight:500'>" + d3c.fmtEur(r.revenue) + "</span>" +
          "<span>Projected</span><span style='font-weight:500'>" + d3c.fmtEur(r.projected_revenue) + "</span>" +
          "<span>Last activity</span><span style='font-weight:500'>" + (r.last_activity_at || "N/A") + "</span>" +
          (r.deal_id ? "<div style='margin-top:4px;font-style:italic;color:#94A3B8'>Click to open in Productive</div>" : "") +
          "</div>";
      },
      onClick: function(r){
        if (r.deal_id) {
          window.open(PROD_BASE+"/financials/budgets/d/deal/"+r.deal_id+"/services", "_blank");
        }
      },
      xLabel: "Days Since Last Activity",
      margin: {top: 24, right: 70, bottom: 36, left: 300},
      maxLabelLen: 45,
      barHeight: 24
    });
  }

  function renderMissingOverspend(containerId, data) {
    if (data.length === 0) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
      return;
    }
    var d = data.slice(0, 20);
    d.sort(function(a,b){ return a.service_count - b.service_count; });

    d3c.horizontalBar(containerId, d, {
      yField: "name",
      xField: "service_count",
      colorFn: function(r){ return r.issue==="overspend_billable" ? C.overbudget : C.warning; },
      labelFn: function(r){ return String(r.service_count); },
      labelColorFn: function(r){ return r.issue==="overspend_billable" ? "#dc2626" : "#d97706"; },
      tooltipFn: function(r){
        return "<div style='font-weight:600;margin-bottom:4px;font-size:13px'>" + r.name + "</div>" +
          "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>" +
          "<span>Client</span><span style='font-weight:500'>" + (r.company_name||"") + "</span>" +
          "<span>Services</span><span style='font-weight:600;color:#1A1D21'>" + r.service_count + "</span>" +
          "<span>Worked</span><span style='font-weight:500'>" + r.worked_hours.toFixed(1) + "h</span>" +
          "<span>Revenue</span><span style='font-weight:500'>" + d3c.fmtEur(r.revenue) + "</span>" +
          "<span>Issue</span><span style='font-weight:500'>" + r.issue + "</span>" +
          (r.deal_id ? "<div style='margin-top:4px;font-style:italic;color:#94A3B8'>Click to open in Productive</div>" : "") +
          "</div>";
      },
      onClick: function(r){
        if (r.deal_id) {
          window.open(PROD_BASE+"/financials/budgets/d/deal/"+r.deal_id+"/services", "_blank");
        }
      },
      xLabel: "Service Count (complexity)",
      margin: {top: 24, right: 70, bottom: 36, left: 300},
      maxLabelLen: 45,
      barHeight: 24
    });
  }

  // === BILLABILITY TAB ===
  function buildBillabilityPersonList(entries, scData) {
    _billEntries = entries;
    // Total hours per person from scorecard
    var totals = {};
    (scData||[]).forEach(function(r) {
      if (!totals[r.person_name]) totals[r.person_name] = {total:0, billable:0};
      totals[r.person_name].total += r.hours||0;
      totals[r.person_name].billable += r.billable_hours||0;
    });

    // Target billability from budget_people (use 2026 first, fallback to 2025)
    var targets = {};
    (DATA.budget_people||[]).forEach(function(r) {
      var name = r.productive_name;
      if (!name) return;
      if (!targets[name] || r.year > targets[name].year) {
        targets[name] = {target: (r.billability_target||0) * 100, year: r.year};
      }
    });

    var byPerson = {};
    entries.forEach(function(r) {
      if (!byPerson[r.person_name]) byPerson[r.person_name] = {name:r.person_name, team:r.team||"", nbHours:0, count:0};
      byPerson[r.person_name].nbHours += r.hours||0;
      byPerson[r.person_name].count++;
    });
    var people = Object.values(byPerson);
    people.forEach(function(p) {
      var t = totals[p.name];
      p.totalHours = t ? t.total : p.nbHours;
      p.billableHours = t ? t.billable : 0;
      p.billPct = p.totalHours > 0 ? (p.billableHours / p.totalHours * 100) : 0;
      p.nbPct = p.totalHours > 0 ? (p.nbHours / p.totalHours * 100) : 0;
      var tgt = targets[p.name];
      p.targetBill = tgt ? tgt.target : null;
      p.delta = p.targetBill !== null ? (p.billPct - p.targetBill) : null;
    });
    // Sort by delta (worst first = most below target)
    people.sort(function(a,b) {
      // People with a target come first, sorted by delta ascending (most below target first)
      if (a.delta !== null && b.delta !== null) return a.delta - b.delta;
      if (a.delta !== null) return -1;
      if (b.delta !== null) return 1;
      return b.nbPct - a.nbPct;
    });
    var html = '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr style="border-bottom:2px solid #E5E7EB;text-align:left">';
    html += '<th style="padding:8px 6px">Person</th><th>Team</th>';
    html += '<th style="text-align:right;padding-right:12px">Total Hours</th>';
    html += '<th style="text-align:right;padding-right:12px">Billable %</th>';
    html += '<th style="text-align:right;padding-right:12px">Target %</th>';
    html += '<th style="text-align:right;padding-right:12px">Delta</th>';
    html += '<th style="text-align:right;padding-right:12px">NB Hours</th>';
    html += '<th style="text-align:right;padding-right:12px">Entries</th></tr></thead><tbody>';
    people.forEach(function(p) {
      var deltaColor = p.delta === null ? "#94A3B8" : p.delta >= 0 ? C.onTrack : p.delta >= -10 ? C.warning : C.overbudget;
      var deltaStr = p.delta !== null ? (p.delta >= 0 ? "+" : "") + p.delta.toFixed(0) + "pp" : "—";
      var tgtStr = p.targetBill !== null ? p.targetBill.toFixed(0) + "%" : "—";
      html += '<tr style="cursor:pointer;border-bottom:1px solid #F0F2F5" onclick="showBillabilityDetail(\'' + p.name.replace(/'/g, "\\'") + '\')">';
      html += '<td style="padding:8px 6px;font-weight:500">' + p.name + ' <span style="font-size:10px;color:#94A3B8">&#9654;</span></td>';
      html += '<td style="color:#6B7280">' + p.team + '</td>';
      html += '<td style="text-align:right;padding-right:12px">' + p.totalHours.toFixed(0) + 'h</td>';
      html += '<td style="text-align:right;padding-right:12px;font-weight:600">' + p.billPct.toFixed(0) + '%</td>';
      html += '<td style="text-align:right;padding-right:12px;color:#6B7280">' + tgtStr + '</td>';
      html += '<td style="text-align:right;padding-right:12px;font-weight:700;color:' + deltaColor + '">' + deltaStr + '</td>';
      html += '<td style="text-align:right;padding-right:12px">' + p.nbHours.toFixed(1) + 'h</td>';
      html += '<td style="text-align:right;padding-right:12px;color:#6B7280">' + p.count + '</td>';
      html += '</tr>';
    });
    if (people.length === 0) html += '<tr><td colspan="8" style="padding:12px;color:#94A3B8">No non-billable entries in selected period.</td></tr>';
    html += '</tbody></table>';
    document.getElementById("billability-person-list").innerHTML = html;
    document.getElementById("billability-detail-panel").style.display = "none";
  }

  function showBillabilityDetail(personName) {
    var personEntries = _billEntries.filter(function(r) { return r.person_name === personName; });
    var totalNB = personEntries.reduce(function(s,r){return s+(r.hours||0)},0);

    // Level 1: Group by category (client + service_type)
    var categories = {};
    personEntries.forEach(function(r) {
      var catKey = (r.client_name||"(no client)") + " /// " + (r.service_type||"(no type)");
      if (!categories[catKey]) categories[catKey] = {
        client: r.client_name||"(no client)",
        stype: r.service_type||"(no type)",
        hours: 0, count: 0, entries: []
      };
      categories[catKey].hours += r.hours||0;
      categories[catKey].count++;
      categories[catKey].entries.push(r);
    });
    var catList = Object.values(categories);
    catList.sort(function(a,b) { return b.hours - a.hours; });

    // Level 2: Within each category, sub-group by deal
    var allDeals = []; // flat list for pageBillGroup
    catList.forEach(function(cat) {
      var dealGroups = {};
      cat.entries.forEach(function(r) {
        var dk = r.deal_name||"(no deal)";
        if (!dealGroups[dk]) dealGroups[dk] = {deal:dk, hours:0, count:0, entries:[]};
        dealGroups[dk].hours += r.hours||0;
        dealGroups[dk].count++;
        dealGroups[dk].entries.push(r);
      });
      cat.deals = Object.values(dealGroups);
      cat.deals.sort(function(a,b) { return b.hours - a.hours; });
      cat.deals.forEach(function(d) {
        d.entries.sort(function(a,b){ return b.date<a.date?-1:b.date>a.date?1:0; });
        d._flatIdx = allDeals.length;
        allDeals.push(d);
      });
    });
    _billGroups = allDeals;

    var totalDeals = allDeals.length;
    document.getElementById("billability-detail-header").innerHTML =
      '<span style="cursor:pointer;color:#3B82F6;margin-right:8px" onclick="document.getElementById(\'billability-detail-panel\').style.display=\'none\'">&larr; Back</span>' +
      personName + ' &mdash; ' + totalNB.toFixed(1) + 'h non-billable across ' + totalDeals + ' deal' + (totalDeals!==1?'s':'');

    var html = '<div style="display:flex;flex-direction:column;gap:4px">';
    catList.forEach(function(cat, ci) {
      var catId = "bill-cat-" + ci;
      var catPct = totalNB > 0 ? (cat.hours/totalNB*100) : 0;
      // Category header (level 1)
      html += '<div style="display:flex;align-items:center;padding:10px 12px;background:#EFF6FF;border-radius:8px;cursor:pointer;border:1px solid #BFDBFE" onclick="toggleBillGroup(\'' + catId + '\')">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + cat.client + ' &middot; ' + cat.stype + '</div>';
      html += '<div style="font-size:11px;color:#6B7280">' + cat.deals.length + ' deal' + (cat.deals.length!==1?'s':'') + '</div>';
      html += '</div>';
      html += '<div style="text-align:right;margin-left:16px;white-space:nowrap">';
      html += '<span style="font-weight:700;font-size:15px">' + cat.hours.toFixed(1) + 'h</span>';
      html += '<span style="font-size:11px;color:#6B7280;margin-left:6px">(' + catPct.toFixed(0) + '%)</span>';
      html += '<span style="font-size:11px;color:#94A3B8;margin-left:8px">' + cat.count + ' entries &#9660;</span>';
      html += '</div></div>';

      // Expandable: deals within this category (hidden by default)
      html += '<div id="' + catId + '" style="display:none;padding:0 0 4px 12px">';
      cat.deals.forEach(function(d) {
        var di = d._flatIdx;
        var dealId = "bill-grp-" + di;
        var dealPct = totalNB > 0 ? (d.hours/totalNB*100) : 0;
        // Deal header (level 2)
        html += '<div style="display:flex;align-items:center;padding:6px 10px;background:#F8FAFC;border-radius:6px;cursor:pointer;border:1px solid #E5E7EB;margin-top:2px" onclick="toggleBillGroup(\'' + dealId + '\')">';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.deal + '</div>';
        html += '</div>';
        html += '<div style="text-align:right;margin-left:16px;white-space:nowrap">';
        html += '<span style="font-weight:700;font-size:13px">' + d.hours.toFixed(1) + 'h</span>';
        html += '<span style="font-size:11px;color:#6B7280;margin-left:6px">(' + dealPct.toFixed(0) + '%)</span>';
        html += '<span style="font-size:11px;color:#94A3B8;margin-left:8px">' + d.count + ' entries &#9660;</span>';
        html += '</div></div>';
        // Expandable: entries within this deal (hidden by default)
        html += '<div id="' + dealId + '" style="display:none;padding:0 0 4px 16px">';
        html += buildGroupEntriesTable(d.entries, di, 1);
        html += '</div>';
      });
      html += '</div>';
    });
    if (catList.length === 0) html += '<div style="padding:12px;color:#94A3B8">No non-billable entries.</div>';
    html += '</div>';
    document.getElementById("billability-detail-table").innerHTML = html;
    document.getElementById("billability-detail-panel").style.display = "block";
    document.getElementById("billability-pagination").innerHTML = "";
  }

  function toggleBillGroup(gid) {
    var el = document.getElementById(gid);
    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
  }

  function buildGroupEntriesTable(entries, gi, page) {
    var ps = 15;
    var start = (page - 1) * ps;
    var end = Math.min(start + ps, entries.length);
    var tp = Math.ceil(entries.length / ps);
    var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:4px">';
    html += '<thead><tr style="border-bottom:1px solid #E5E7EB;color:#6B7280">';
    html += '<th style="padding:4px 6px;text-align:left;font-weight:500">Date</th>';
    html += '<th style="text-align:right;font-weight:500;padding-right:8px">Hours</th>';
    html += '<th style="text-align:left;font-weight:500;max-width:450px">Note</th></tr></thead><tbody>';
    entries.slice(start, end).forEach(function(r) {
      var noteShort = (r.note||"").length > 120 ? (r.note||"").substring(0,120) + "..." : (r.note||"");
      var noteFull = (r.note||"").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      html += '<tr style="border-bottom:1px solid #F8F9FA">';
      html += '<td style="padding:4px 6px;white-space:nowrap">' + r.date + '</td>';
      html += '<td style="text-align:right;padding-right:8px">' + (r.hours||0).toFixed(2) + 'h</td>';
      html += '<td style="max-width:450px;color:#374151;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + noteFull + '">' + (noteShort || '<span style="color:#CBD5E1">no note</span>') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (tp > 1) {
      html += '<div style="margin-top:4px;font-size:11px;color:#6B7280">Page ' + page + '/' + tp;
      if (page > 1) html += ' <button style="padding:1px 6px;font-size:10px;cursor:pointer" onclick="pageBillGroup(' + gi + ',' + (page-1) + ')">Prev</button>';
      if (page < tp) html += ' <button style="padding:1px 6px;font-size:10px;cursor:pointer" onclick="pageBillGroup(' + gi + ',' + (page+1) + ')">Next</button>';
      html += '</div>';
    }
    return html;
  }

  function pageBillGroup(gi, page) {
    var g = _billGroups[gi];
    if (!g) return;
    document.getElementById("bill-grp-" + gi).innerHTML = buildGroupEntriesTable(g.entries, gi, page);
  }

  // Functions called from HTML onclick
  window.showHygieneTab = showHygieneTab;
  window.showBillabilityDetail = showBillabilityDetail;
  window.toggleBillGroup = toggleBillGroup;
  window.pageBillGroup = pageBillGroup;

  D.registerSection("hygiene", function(f) {
    // Hygiene — Data Health
    var hygMonthly = u.filterByMonth(DATA.hygiene_monthly, "month", f.startMonth, f.endMonth);
    var hygTotal = u.sum(hygMonthly,"total");
    var hygWithNote = u.sum(hygMonthly,"with_note");
    var notePct = hygTotal > 0 ? hygWithNote/hygTotal*100 : 0;
    var dhs = DATA.data_health_summary || {};
    var budgetIssues = (dhs.budget_no_limit||0) + (dhs.budget_placeholder||0);
    var psoOverbudgetCount = dhs.pso_overbudget||0;
    u.setKPIs("kpi-hygiene", [
      {label:"Note Compliance", value:notePct.toFixed(1)+"%", color:notePct>=80?C.onTrack:notePct>=50?C.warning:C.overbudget},
      {label:"Budget Issues", value:u.fmt(budgetIssues)+" deals", color:budgetIssues>0?C.warning:""},
      {label:"PSO Overbudget", value:u.fmt(psoOverbudgetCount), color:psoOverbudgetCount>0?C.overbudget:C.onTrack}
    ]);

    // Scorecard tab — trend line + heatmap
    renderHygieneTrend("chart-hyg-trend", hygMonthly);
    var scData = u.filterByMonth(DATA.person_scorecard||[], "month", f.startMonth, f.endMonth);
    if (scData.length > 0) {
      renderScorecardHeatmap("chart-scorecard-heatmap", scData);
    }

    // Budget audit tab
    var ba = DATA.budget_audit || [];
    var mosp = DATA.missing_overspend || [];
    var mst = DATA.missing_stype || [];
    var cwa = DATA.closed_with_activity || [];
    var stale = DATA.stale_budgets || [];
    var staleCrit = stale.filter(function(r){ return r.severity==="critical"; });
    u.setKPIs("kpi-budget-audit", [
      {label:"No Budget Set", value:u.fmt(ba.filter(function(r){return r.issue==="no_budget"}).length), color:C.warning},
      {label:"Placeholder (≤2h)", value:u.fmt(ba.filter(function(r){return r.issue==="placeholder"}).length), color:C.overbudget},
      {label:"Missing Overspend", value:u.fmt(mosp.length)+" deals", color:mosp.length>0?C.warning:C.onTrack},
      {label:"Stale Budgets", value:u.fmt(stale.length)+(staleCrit.length>0?" ("+staleCrit.length+" critical)":""), color:staleCrit.length>0?C.overbudget:stale.length>0?C.warning:C.onTrack},
      {label:"Closed w/ Activity", value:u.fmt(cwa.length), color:cwa.length>0?C.overbudget:C.onTrack}
    ]);
    renderBudgetAudit("chart-budget-audit", ba, "no_budget");
    renderBudgetAudit("chart-budget-placeholder", ba, "placeholder");
    renderMissingOverspend("chart-missing-overspend", mosp);
    renderIssueList("chart-missing-stype", mst, "Hours (missing service type)");
    renderClosedActivity("chart-closed-activity", cwa);
    renderStaleBudgets("chart-stale-budgets", stale);

    // PSO Health tab — split active vs closed
    var pso = DATA.pso_health || [];
    var psoActive = pso.filter(function(r){ return !r.closed_at; });
    var psoClosed = pso.filter(function(r){ return !!r.closed_at; });
    var psoOverbudget = pso.filter(function(r){ return r.burn_pct > 100; });
    var activeOverbudget = psoActive.filter(function(r){ return r.burn_pct > 100; });
    var totalPsoRev = pso.reduce(function(s,r){return s+(r.revenue||0)},0);
    var totalPsoCost = pso.reduce(function(s,r){return s+(r.cost||0)},0);
    var hoursROI = totalPsoCost > 0 ? (totalPsoRev / totalPsoCost) : 0;
    var diegoCost = u.filterByMonth(DATA.people_monthly || [], "month", f.startMonth, f.endMonth)
      .filter(function(r){ return r.person_name === "Diego Aguiar"; })
      .reduce(function(s,r){ return s + (r.staff_cost||0); }, 0);
    var programROI = diegoCost > 0 ? (totalPsoRev / diegoCost) : 0;
    var totalWorked = pso.reduce(function(s,r){return s+(r.worked_hours||0)},0);
    var totalBudgeted = pso.reduce(function(s,r){return s+(r.budgeted_hours||0)},0);
    var scopeCreepHours = psoOverbudget.reduce(function(s,r){return s+Math.max(0,r.worked_hours-r.budgeted_hours)},0);
    var avgCostHr = totalWorked > 0 ? totalPsoCost / totalWorked : 0;
    var opportunityCost = Math.round(scopeCreepHours * avgCostHr);
    u.setKPIs("kpi-pso", [
      {label:"Active PSOs", value:u.fmt(psoActive.length), sub:u.fmt(activeOverbudget.length)+" overbudget", color:activeOverbudget.length>0?C.overbudget:""},
      {label:"Closed PSOs", value:u.fmt(psoClosed.length), sub:u.fmt(psoClosed.filter(function(r){return r.burn_pct>100}).length)+" were overbudget"},
      {label:"Hours ROI", value:hoursROI.toFixed(1)+"x", sub:"\u20AC"+u.fmt(Math.round(totalPsoRev))+" rev / \u20AC"+u.fmt(Math.round(totalPsoCost))+" hours cost", color:hoursROI>=1.5?C.onTrack:hoursROI>=1?C.warning:C.overbudget},
      {label:"Scope Creep", value:u.fmt(Math.round(scopeCreepHours))+"h", sub:u.fmt(Math.round(totalWorked))+"h worked / "+u.fmt(Math.round(totalBudgeted))+"h budgeted", color:scopeCreepHours>0?C.overbudget:""},
      {label:"Lost Opportunity", value:"\u20AC"+u.fmt(opportunityCost), sub:"Cost of "+u.fmt(Math.round(scopeCreepHours))+"h over budget @ \u20AC"+Math.round(avgCostHr)+"/h", color:opportunityCost>0?C.overbudget:C.onTrack}
    ]);

    // Helper to setup a pso chart pair (burn + issues)
    function setupPsoCharts(prefix, dataset) {
      var burnData = dataset.filter(function(r){ return r.worked_hours > 0; });
      burnData.sort(function(a,b){ return a.burn_pct - b.burn_pct; });
      if (burnData.length > 0) {
        u.setupCliPager("chart-pso-burn-"+prefix, {renderFn: renderPSOBurn, fullData: burnData, opts: {}});
      } else {
        document.getElementById("chart-pso-burn-"+prefix).innerHTML = "<div style='padding:24px;color:#94A3B8;text-align:center'>No PSO deals</div>";
      }
      var issueData = dataset.filter(function(r){ return r.issue_count > 0; });
      issueData.sort(function(a,b){ return a.issue_count - b.issue_count || a.burn_pct - b.burn_pct; });
      if (issueData.length > 0) {
        u.setupCliPager("chart-pso-issues-"+prefix, {renderFn: renderPSOIssues, fullData: issueData, opts: {}});
      } else {
        document.getElementById("chart-pso-issues-"+prefix).innerHTML = "<div style='padding:24px;color:#94A3B8;text-align:center'>No structural issues</div>";
      }
    }
    setupPsoCharts("active", psoActive);
    setupPsoCharts("closed", psoClosed);

    // (Non)-Billability Checker tab
    var billEntries = (DATA.billability_entries||[]).filter(function(r) {
      return r.date >= f.startMonth + "-01" && r.date <= f.endMonth + "-31"
        && f.teams.indexOf(r.team) >= 0;
    });
    var billScData = scData.filter(function(r) { return f.teams.indexOf(r.team) >= 0; });
    buildBillabilityPersonList(billEntries, billScData);
  });
})(window.Dashboard);
