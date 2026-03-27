// ============================================================
// core.js — Dashboard namespace, shared utilities, state,
//           navigation, filter/render system, CSV export
// ============================================================

(function() {
  "use strict";

  // === NAMESPACE ===
  window.Dashboard = {
    DATA: window.DATA || null,  // grab DATA from global scope (set by HTML <script> tag before this file loads)
    CONFIG: window.CONFIG || null,
    utils: {},
    _sectionHandlers: {}
  };

  // === SHARED CONSTANTS ===
  var C = {
    revenue: "#3498DB", cost: "#E67E22", billable: "#2ECC71",
    nonBillable: "#95A5A6", onTrack: "#27AE60", warning: "#F39C12",
    overbudget: "#E74C3C", profitPos: "#27AE60", profitNeg: "#E74C3C",
    budget: "#9B59B6"
  };

  var PLOTLY_CFG = {responsive:true, displayModeBar:"hover", modeBarButtonsToRemove:["lasso2d","select2d","autoScale2d"], displaylogo:false};
  var PROD_BASE = "https://app.productive.io/40807-leadstreet";
  var LAYOUT_BASE = {template:"plotly_white", font:{family:"Inter, -apple-system, sans-serif",size:11,color:"#5F6B7A"}, margin:{l:60,r:40,t:10,b:40}, hoverlabel:{font:{size:12,family:"Inter, sans-serif",color:"#1A1D21"},bgcolor:"rgba(255,255,255,0.95)",bordercolor:"#E5E7EB",namelength:-1}, hovermode:"closest", paper_bgcolor:"transparent", plot_bgcolor:"transparent", xaxis:{gridcolor:"#F0F2F5",zerolinecolor:"#E4E7EC"}, yaxis:{gridcolor:"#F0F2F5",zerolinecolor:"#E4E7EC"}};

  // === SHARED STATE ===
  var CLI_PAGE_SIZE = 10;
  var cliPages = {};  // chartId → {spec, page, totalPages}
  var chartViewMode = {};  // chartId → "bar" | "trend"
  var SVC_COLORS = ["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf","#aec7e8","#ffbb78","#98df8a","#ff9896","#c5b0d5"];
  var _svcColorMap = {};
  var showYoY = false;
  var showExecYoY = false;
  var activeSection = "executive";
  var activeFinTab = "recognized";

  // === PRODUCTIVE LINK HELPERS ===
  function prodLink(name, projectId, companyId, maxLen) {
    var label = maxLen && name.length > maxLen ? name.substring(0,maxLen-3)+"..." : name;
    if (projectId && companyId) {
      return '<a href="'+PROD_BASE+'/projects/'+projectId+'/budgets/company/'+companyId+'/info" target="_blank" style="color:inherit;text-decoration:none;border-bottom:1px dotted #94A3B8" title="Open in Productive">'+label+'</a>';
    }
    return label;
  }

  function prodDealLink(name, projectId, dealId, maxLen) {
    var label = maxLen && name.length > maxLen ? name.substring(0,maxLen-3)+"..." : name;
    if (dealId) {
      return '<a href="'+PROD_BASE+'/financials/budgets/d/deal/'+dealId+'/services" target="_blank" style="color:inherit;text-decoration:none;border-bottom:1px dotted #94A3B8" title="Open in Productive">'+label+'</a>';
    }
    return label;
  }

  // Attach click-to-open-Productive handler to a Plotly chart.
  // customdata must include [... , projectId, companyId] as the LAST two fields.
  function attachProdClick(chartId) {
    var el = document.getElementById(chartId);
    if (!el) return;
    el.on("plotly_click", function(data) {
      if (!data || !data.points || !data.points[0]) return;
      var cd = data.points[0].customdata;
      if (!cd) return;
      var projId = cd[cd.length-2];
      var companyId = cd[cd.length-1];
      if (projId && companyId) {
        window.open(PROD_BASE+"/projects/"+projId+"/budgets/company/"+companyId+"/info", "_blank");
      }
    });
    el.style.cursor = "pointer";
  }

  // Attach click-to-open-Productive handler for PSO deal charts.
  // customdata must include deal_id as the LAST field.
  function attachPsoDealClick(chartId) {
    var el = document.getElementById(chartId);
    if (!el) return;
    el.on("plotly_click", function(data) {
      if (!data || !data.points || !data.points[0]) return;
      var cd = data.points[0].customdata;
      if (!cd) return;
      var dealId = cd[cd.length - 1];
      if (dealId) {
        window.open(PROD_BASE+"/financials/budgets/d/deal/"+dealId+"/services", "_blank");
      }
    });
    el.style.cursor = "pointer";
  }

  // === SERVICE COLOR HELPER ===
  function getSvcColor(svcType) {
    if (!_svcColorMap[svcType]) {
      var idx = Object.keys(_svcColorMap).length % SVC_COLORS.length;
      _svcColorMap[svcType] = SVC_COLORS[idx];
    }
    return _svcColorMap[svcType];
  }

  // === CHART VIEW TOGGLE ===
  function toggleChartView(btn) {
    var chartId = btn.getAttribute("data-chart");
    var current = chartViewMode[chartId] || "bar";
    chartViewMode[chartId] = (current === "bar") ? "trend" : "bar";
    btn.classList.toggle("active", chartViewMode[chartId] === "trend");
    btn.title = chartViewMode[chartId] === "trend" ? "Show bar chart" : "Show trend view";
    applyFilters();
  }

  // === PAGINATION ===
  function renderCliPage(chartId) {
    var p = cliPages[chartId];
    if (!p) return;

    // D3 mode: renderFn + fullData instead of Plotly spec
    if (p.renderFn) {
      var n = p.fullData.length;
      var end = n - (p.page * CLI_PAGE_SIZE);
      var start = Math.max(0, end - CLI_PAGE_SIZE);
      var sliced = p.fullData.slice(start, end);
      p.renderFn(chartId, sliced, Object.assign({}, p.opts, {animate: false}));
      var pager = document.getElementById(chartId + "-pager");
      if (pager) {
        var prevBtn = pager.querySelector(".pg-prev");
        var nextBtn = pager.querySelector(".pg-next");
        var label = pager.querySelector(".pg-label");
        if (prevBtn) prevBtn.disabled = p.page === 0;
        if (nextBtn) nextBtn.disabled = start <= 0;
        if (label) label.textContent = (n - end + 1) + "–" + (n - start) + " of " + n;
      }
      return;
    }

    // Legacy Plotly mode (deprecated — all charts now use D3)
    console.warn("renderCliPage: legacy Plotly mode for", chartId);
  }

  function setupCliPager(chartId, spec) {
    var n = (spec.fullData || (spec.data && spec.data[0] && spec.data[0].y) || []).length;
    if (spec.renderFn) {
      // D3 mode
      n = spec.fullData.length;
      cliPages[chartId] = {renderFn: spec.renderFn, fullData: spec.fullData, opts: spec.opts, page: 0, totalPages: Math.ceil(n / CLI_PAGE_SIZE)};
    } else {
      // Legacy Plotly mode
      n = spec.data[0].y.length;
      cliPages[chartId] = {spec: spec, page: 0, totalPages: Math.ceil(n / CLI_PAGE_SIZE)};
    }
    renderCliPage(chartId);
  }

  // === UTILITY FUNCTIONS ===
  function sum(arr, key) { return arr.reduce(function(s,r){ return s + (r[key]||0); }, 0); }
  function fmt(n) { return n.toLocaleString("en", {maximumFractionDigits:0}); }
  function fmtEur(n) {
    if (Math.abs(n) >= 1e6) return "€" + (n/1e6).toFixed(1) + "M";
    if (Math.abs(n) >= 1e3) return "€" + fmt(Math.round(n/1e3)) + "K";
    return "€" + fmt(n);
  }
  function pct(a,b) { return b > 0 ? (a/b*100).toFixed(1) : "0.0"; }

  function toggleAllFilters(containerId, checked) {
    document.querySelectorAll("#"+containerId+" input[type=checkbox]").forEach(function(cb){ cb.checked = checked; });
    applyFilters();
  }

  function onlyFilter(containerId, value) {
    document.querySelectorAll("#"+containerId+" input[type=checkbox]").forEach(function(cb){ cb.checked = (cb.value === value); });
    applyFilters();
  }

  function getFilters() {
    var s = document.getElementById("start-month").value;
    var e = document.getElementById("end-month").value;
    var teams = Array.from(document.querySelectorAll("#team-filters input:checked")).map(function(x){return x.value});
    var flags = Array.from(document.querySelectorAll("#flag-filters input:checked")).map(function(x){return x.value});
    return {startMonth: s, endMonth: e, teams: teams, flags: flags};
  }

  function filterByMonth(arr, monthKey, start, end) {
    return arr.filter(function(r) {
      var m = (r[monthKey]||"").substring(0,7);
      return m >= start && m <= end;
    });
  }

  // === KPI HELPERS ===
  function deltaColor(d) {
    // green if positive, orange if negative but within 15%, red if worse than -15%
    if (d >= 0) return C.profitPos;
    if (d >= -15) return "#E67E22";
    return C.profitNeg;
  }

  function setKPIs(id, cards) {
    var html = "";
    cards.forEach(function(c) {
      var deltaLabel = c.deltaLabel || "vs prior";
      var delta = (c.delta != null) ? '<div class="kpi-delta" style="color:'+deltaColor(c.delta)+'">'+(c.delta>=0?"+":"")+c.delta.toFixed(1)+'% '+deltaLabel+'</div>' : '';
      var sub = c.sub ? '<div class="kpi-sub" style="font-size:11px;color:#64748B;margin-top:2px">'+c.sub+'</div>' : '';
      var valColor = c.color || "#2C3E50";
      var bench = c.benchmark ? '<div class="kpi-benchmark">'+c.benchmark+'</div>' : '';
      html += '<div class="kpi-item"><div class="kpi-label">'+c.label+'</div><div class="kpi-value" style="color:'+valColor+'">'+c.value+'</div>'+sub+delta+bench+'</div>';
    });
    var el = document.getElementById(id);
    if (!el) { console.warn("setKPIs: container '" + id + "' not found — skipping"); return; }
    el.innerHTML = html;
  }

  // === ADDITIONAL HELPERS ===
  function fmtK(n) {
    if (Math.abs(n) >= 1e6) return "€"+(n/1e6).toFixed(1)+"M";
    if (Math.abs(n) >= 1e3) return "€"+Math.round(n/1e3)+"K";
    return "€"+Math.round(n);
  }

  function getBudgetForMonths(months) {
    // Build a lookup of budget data by month (YYYY-MM)
    var lookup = {};
    if (Dashboard.DATA.budget_monthly && Dashboard.DATA.budget_monthly.length > 0) {
      Dashboard.DATA.budget_monthly.forEach(function(bm) {
        if (bm.month) lookup[bm.month.substring(0,7)] = bm;
      });
    }
    return months.map(function(m) { return lookup[m.substring(0,7)] || null; });
  }

  // === PRESETS ===
  function setPreset(p) {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    var pad = function(n){ return n < 10 ? "0"+n : ""+n; };
    var start, end;
    if (p === "ytd") { start = y+"-01"; end = y+"-"+pad(m); }
    else if (p === "3m") {
      var d = new Date(y, m-3, 1);
      start = d.getFullYear()+"-"+pad(d.getMonth()+1);
      end = y+"-"+pad(m);
    }
    else if (p === "6m") {
      var d = new Date(y, m-6, 1);
      start = d.getFullYear()+"-"+pad(d.getMonth()+1);
      end = y+"-"+pad(m);
    }
    else if (p === "2025") { start = "2025-01"; end = "2025-12"; }
    else if (p === "2026") { start = "2026-01"; end = "2026-12"; }
    else { start = "2025-01"; end = "2026-03"; }

    document.getElementById("start-month").value = start;
    document.getElementById("end-month").value = end;
    document.querySelectorAll(".preset-btn").forEach(function(b){ b.classList.remove("active"); });
    if (typeof event !== "undefined" && event && event.target) event.target.classList.add("active");
    applyFilters();
  }

  function toggleYoY() {
    showYoY = !showYoY;
    document.getElementById("yoy-toggle").classList.toggle("active", showYoY);
    applyFilters();
  }

  function toggleExecYoY() {
    showExecYoY = !showExecYoY;
    var btn = document.getElementById("exec-yoy-toggle");
    if (btn) btn.classList.toggle("active", showExecYoY);
    applyFilters();
  }

  // === NAVIGATION ===
  function showSection(id, btn) {
    document.querySelectorAll("section").forEach(function(s){ s.style.display = "none"; });
    document.getElementById("section-" + id).style.display = "block";
    document.querySelectorAll(".nav-item").forEach(function(n){ n.classList.remove("active"); });
    btn.classList.add("active");
    activeSection = id;
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
      document.querySelector('.sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay').classList.remove('active');
    }
    setTimeout(function(){ window.dispatchEvent(new Event("resize")); }, 50);
    if (id === "analysis") applyFilters();
  }

  function showFinancialTab(tabId, btn) {
    document.querySelectorAll("#section-financial .tab-content").forEach(function(t){ t.classList.remove("active"); });
    document.getElementById("fin-tab-" + tabId).classList.add("active");
    document.querySelectorAll("#fin-tabs .tab-btn").forEach(function(b){ b.classList.remove("active"); });
    btn.classList.add("active");
    activeFinTab = tabId;
    setTimeout(function(){ window.dispatchEvent(new Event("resize")); }, 50);
  }

  // === CSV EXPORT ===
  function exportCSV(section) {
    var rows, headers;
    var f = getFilters();
    if (section === "financial") {
      var d = filterByMonth(Dashboard.DATA.financial_monthly, "month", f.startMonth, f.endMonth);
      headers = ["month","revenue","staff_cost","gross_margin","margin_pct","total_hours","billable_hours","util_pct"];
      rows = d;
    } else if (section === "financial_invoiced") {
      var d = filterByMonth(Dashboard.DATA.financial_monthly, "month", f.startMonth, f.endMonth);
      headers = ["month","invoiced","staff_cost","inv_gross_margin","inv_margin_pct","total_hours","billable_hours","util_pct"];
      rows = d;
    } else if (section === "people") {
      var d = filterByMonth(Dashboard.DATA.people_monthly, "month", f.startMonth, f.endMonth).filter(function(r){return f.teams.indexOf(r.team)>=0});
      headers = ["person_name","team","month","hours","billable_hours","staff_cost","utilisation_pct"];
      rows = d;
    } else if (section === "project") {
      rows = Dashboard.DATA.deals_summary || [];
      headers = ["deal_name","service_type","hours","billable_hours","staff_cost","revenue"];
    } else if (section === "client") {
      rows = Dashboard.DATA.clients;
      headers = ["client_name","revenue","staff_cost","gross_margin","margin_pct","total_hours","billable_hours","acph","arph","overbudget_deals"];
    } else if (section === "scorecard") {
      rows = Dashboard.DATA.person_scorecard || [];
      headers = ["person_name","team","month","total","missing_notes","zero_hours","note_pct","hours","billable_hours","util_pct"];
    } else if (section === "budget_audit") {
      rows = Dashboard.DATA.budget_audit || [];
      headers = ["name","company_name","issue","worked_hours","budgeted_hours","budget_total","revenue","cost"];
    } else if (section === "pso_health") {
      rows = Dashboard.DATA.pso_health || [];
      headers = ["name","company_name","worked_hours","budgeted_hours","burn_pct","revenue","cost","service_count","has_overspend","issues","severity"];
    } else if (section === "billability") {
      rows = (Dashboard.DATA.billability_entries||[]).filter(function(r) {
        return r.date >= f.startMonth + "-01" && r.date <= f.endMonth + "-31"
          && f.teams.indexOf(r.team) >= 0;
      });
      headers = ["person_name","team","date","hours","deal_name","client_name","service_type","note"];
    } else if (section === "lifecycle") {
      var cwa = (Dashboard.DATA.closed_with_activity || []).map(function(r){ r._type="closed_activity"; return r; });
      var stale = (Dashboard.DATA.stale_budgets || []).map(function(r){ r._type="stale"; return r; });
      var mosp = (Dashboard.DATA.missing_overspend || []).map(function(r){ r._type="missing_overspend"; return r; });
      rows = cwa.concat(stale).concat(mosp);
      headers = ["_type","name","company_name","worked_hours","budgeted_hours","burn_pct","days_inactive","closed_date","post_close_hours","post_close_entries","revenue","severity","issue"];
    } else {
      rows = Dashboard.DATA.hygiene_person;
      headers = ["person_name","team","total","missing_notes","zero_hours","note_pct"];
    }
    var csv = headers.join(",") + "\n" + rows.map(function(r){
      return headers.map(function(h){
        var v = r[h]; if (v == null) return "";
        if (typeof v === "string" && v.indexOf(",") >= 0) return '"'+v+'"';
        return v;
      }).join(",");
    }).join("\n");
    var blob = new Blob([csv], {type:"text/csv"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = section + "_export.csv";
    a.click();
  }

  // === SECTION REGISTRATION SYSTEM ===
  function registerSection(id, callback) {
    Dashboard._sectionHandlers[id] = callback;
  }

  // === APPLY FILTERS (thin dispatcher) ===
  function applyFilters() {
    var f = getFilters();
    updateFilterSummary();
    // Call ALL registered section handlers (same behavior as before)
    var ids = Object.keys(Dashboard._sectionHandlers);
    for (var i = 0; i < ids.length; i++) {
      try {
        Dashboard._sectionHandlers[ids[i]](f);
      } catch (e) {
        console.error("Section '" + ids[i] + "' render error:", e);
      }
    }
    // Restore toggle button active state
    Object.keys(chartViewMode).forEach(function(cid) {
      var btn = document.querySelector('[data-chart="'+cid+'"]');
      if (btn) btn.classList.toggle("active", chartViewMode[cid] === "trend");
    });
  }

  // === EXPOSE ON Dashboard NAMESPACE ===
  // Constants & state (read/write access for section files)
  Dashboard.C = C;
  Dashboard.PLOTLY_CFG = PLOTLY_CFG;
  Dashboard.PROD_BASE = PROD_BASE;
  Dashboard.LAYOUT_BASE = LAYOUT_BASE;
  Dashboard.CLI_PAGE_SIZE = CLI_PAGE_SIZE;
  Dashboard.cliPages = cliPages;
  Dashboard.chartViewMode = chartViewMode;
  Dashboard.SVC_COLORS = SVC_COLORS;
  Dashboard._svcColorMap = _svcColorMap;

  // State accessors (getters/setters so section files can read & modify)
  Object.defineProperty(Dashboard, 'showYoY', {
    get: function() { return showYoY; },
    set: function(v) { showYoY = v; }
  });
  Object.defineProperty(Dashboard, 'showExecYoY', {
    get: function() { return showExecYoY; },
    set: function(v) { showExecYoY = v; }
  });
  Object.defineProperty(Dashboard, 'activeSection', {
    get: function() { return activeSection; },
    set: function(v) { activeSection = v; }
  });
  Object.defineProperty(Dashboard, 'activeFinTab', {
    get: function() { return activeFinTab; },
    set: function(v) { activeFinTab = v; }
  });

  // Registration
  Dashboard.registerSection = registerSection;

  // Utility functions accessible from section files via Dashboard.utils
  Dashboard.utils.sum = sum;
  Dashboard.utils.fmt = fmt;
  Dashboard.utils.fmtEur = fmtEur;
  Dashboard.utils.pct = pct;
  Dashboard.utils.filterByMonth = filterByMonth;
  Dashboard.utils.fmtK = fmtK;
  Dashboard.utils.deltaColor = deltaColor;
  Dashboard.utils.setKPIs = setKPIs;
  Dashboard.utils.getSvcColor = getSvcColor;
  Dashboard.utils.getBudgetForMonths = getBudgetForMonths;
  Dashboard.utils.prodLink = prodLink;
  Dashboard.utils.prodDealLink = prodDealLink;
  Dashboard.utils.attachProdClick = attachProdClick;
  Dashboard.utils.attachPsoDealClick = attachPsoDealClick;
  Dashboard.utils.setupCliPager = setupCliPager;
  Dashboard.utils.renderCliPage = renderCliPage;
  Dashboard.utils.getFilters = getFilters;

  // === SIDEBAR TOGGLE (mobile) ===
  function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
  }

  // === FILTER BAR TOGGLE (mobile) ===
  function toggleFilterBar() {
    document.getElementById('global-filters').classList.toggle('open');
  }

  function updateFilterSummary() {
    var el = document.getElementById('filter-summary-text');
    if (!el) return;
    var s = document.getElementById('start-month').value;
    var e = document.getElementById('end-month').value;
    el.textContent = 'Filters: ' + s + ' → ' + e;
  }

  // Functions called from HTML onclick handlers MUST be global
  window.toggleSidebar = toggleSidebar;
  window.toggleFilterBar = toggleFilterBar;
  window.applyFilters = applyFilters;
  window.showSection = showSection;
  window.setPreset = setPreset;
  window.toggleYoY = toggleYoY;
  window.toggleExecYoY = toggleExecYoY;
  window.showFinancialTab = showFinancialTab;
  window.toggleChartView = toggleChartView;
  window.toggleAllFilters = toggleAllFilters;
  window.onlyFilter = onlyFilter;
  window.exportCSV = exportCSV;
  window.cliPages = cliPages;
  window.renderCliPage = renderCliPage;

  // Init function
  Dashboard.init = function() {
    applyFilters();
  };

})();
