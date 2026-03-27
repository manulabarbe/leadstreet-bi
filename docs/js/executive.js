/* === executive.js — Executive section: P&L overview, what-if sliders, alerts, AI recap === */
(function(D) {
  var u = D.utils;
  var C = D.C;
  var d3c = D.d3;
  var DATA = D.DATA;

  // === BUDGET SCENARIO (preserved for compatibility) ===
  var activeBudgetScenario = "current";
  function updateScenarioLabel() {}
  function setBudgetScenario(scenario) { activeBudgetScenario = scenario; D.applyFilters(); }
  function getActiveBudgetMonthly() {
    if (activeBudgetScenario === "hires" && DATA.budget_with_new_hires && DATA.budget_with_new_hires.monthly) return DATA.budget_with_new_hires.monthly;
    return DATA.budget_monthly || [];
  }

  // === P&L HELPERS ===
  var PNL_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function countActualMonths() {
    var A = window.PNL_ACTUALS;
    if (!A || !A.turnover) return 0;
    for (var i = 0; i < 12; i++) { if (A.turnover[i] === null) return i; }
    return 12;
  }

  function getScaleFactor(key) {
    var A = window.PNL_ACTUALS, B = window.PNL_BUDGET, n = countActualMonths();
    if (!A[key] || !B[key] || n === 0) return 1;
    var act = 0, bud = 0;
    for (var i = 0; i < n; i++) { act += A[key][i] || 0; bud += B[key][i] || 0; }
    return bud !== 0 ? act / bud : 1;
  }

  function getForecast(key) {
    var A = window.PNL_ACTUALS, B = window.PNL_BUDGET, n = countActualMonths(), scale = getScaleFactor(key), arr = [];
    for (var i = 0; i < 12; i++) {
      if (i < n && A[key] && A[key][i] !== null) arr.push(A[key][i]);
      else if (B[key]) arr.push(B[key][i] * scale);
      else arr.push(0);
    }
    return arr;
  }

  function sumArr(arr, s, e) { var t = 0; for (var i = s; i < e; i++) t += (arr[i] || 0); return t; }

  // === INFO ICON ===
  var INFO_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  function infoIcon(text) {
    return '<span class="card-info-wrap"><span class="card-info-icon">' + INFO_SVG + '</span><span class="card-info-tip">' + text + '</span></span>';
  }

  // === SLIDER STATE ===
  var sliderDefaults = { util: 57, rate: 112, hours: 1500 };
  var sliderActive = false;

  function initSliders(completedMonths, trendHrsMap, trendRevMap) {
    var totalHrs = 0, billHrs = 0, totalRev = 0;
    completedMonths.forEach(function(m) {
      totalHrs += trendHrsMap[m].total;
      billHrs += trendHrsMap[m].billable;
      totalRev += trendRevMap[m] || 0;
    });
    var nMonths = completedMonths.length || 1;
    sliderDefaults.util = totalHrs > 0 ? Math.round(billHrs / totalHrs * 100) : 57;
    sliderDefaults.rate = billHrs > 0 ? Math.round(totalRev / billHrs) : 112;
    sliderDefaults.hours = Math.round(totalHrs / nMonths);

    var sUtil = document.getElementById("exec-slider-util");
    var sRate = document.getElementById("exec-slider-rate");
    var sHours = document.getElementById("exec-slider-hours");
    if (sUtil) sUtil.value = sliderDefaults.util;
    if (sRate) sRate.value = sliderDefaults.rate;
    if (sHours) sHours.value = sliderDefaults.hours;
    updateSliderLabels();
  }

  function updateSliderLabels() {
    var sUtil = document.getElementById("exec-slider-util");
    var sRate = document.getElementById("exec-slider-rate");
    var sHours = document.getElementById("exec-slider-hours");
    if (sUtil) document.getElementById("exec-slider-util-val").textContent = sUtil.value + "%";
    if (sRate) document.getElementById("exec-slider-rate-val").textContent = "\u20AC" + sRate.value + "/hr";
    if (sHours) document.getElementById("exec-slider-hours-val").textContent = sHours.value + " hrs/month";
  }

  function getSliderServiceRevOverride() {
    var sUtil = document.getElementById("exec-slider-util");
    var sRate = document.getElementById("exec-slider-rate");
    var sHours = document.getElementById("exec-slider-hours");
    if (!sUtil) return null;
    var util = parseFloat(sUtil.value);
    var rate = parseFloat(sRate.value);
    var hours = parseFloat(sHours.value);
    return hours * (util / 100) * rate;
  }

  function updateExecSliders() {
    sliderActive = true;
    updateSliderLabels();
    buildExecPnlKPIs(getSliderServiceRevOverride());
    buildExecPnlChart(getSliderServiceRevOverride());
    updateSliderNarrative();
  }

  function resetExecSliders() {
    sliderActive = false;
    var sUtil = document.getElementById("exec-slider-util");
    var sRate = document.getElementById("exec-slider-rate");
    var sHours = document.getElementById("exec-slider-hours");
    if (sUtil) sUtil.value = sliderDefaults.util;
    if (sRate) sRate.value = sliderDefaults.rate;
    if (sHours) sHours.value = sliderDefaults.hours;
    updateSliderLabels();
    buildExecPnlKPIs(null);
    buildExecPnlChart(null);
    var narEl = document.getElementById("exec-slider-narrative");
    if (narEl) narEl.style.display = "none";
  }

  function updateSliderNarrative() {
    var narEl = document.getElementById("exec-slider-narrative");
    if (!narEl) return;
    var sUtil = parseFloat(document.getElementById("exec-slider-util").value);
    var sRate = parseFloat(document.getElementById("exec-slider-rate").value);
    var sHours = parseFloat(document.getElementById("exec-slider-hours").value);
    var monthlyRev = sHours * (sUtil / 100) * sRate;
    var n = countActualMonths();
    var remaining = 12 - n;
    var B = window.PNL_BUDGET;
    // Commission + costs stay at scale-factor
    var commFc = getForecast("other_rev");
    var costFc = getForecast("people_cost");
    var opexFc = getForecast("total_opex");
    var directFc = getForecast("direct_costs");
    var fyRev = sumArr(window.PNL_ACTUALS.turnover, 0, n);
    var fyCost = 0, fyComm = 0;
    for (var i = 0; i < n; i++) {
      fyComm += window.PNL_ACTUALS.other_rev[i] || 0;
    }
    for (var j = n; j < 12; j++) {
      fyRev += monthlyRev + commFc[j];
      fyComm += commFc[j];
    }
    fyRev += sumArr(window.PNL_ACTUALS.service_rev, 0, n);
    // Actually: YTD turnover + forecast months (svcRev + commission)
    var ytdTurnover = sumArr(window.PNL_ACTUALS.turnover, 0, n);
    var fcTurnover = 0;
    for (var k = n; k < 12; k++) fcTurnover += monthlyRev + commFc[k];
    var fyTurnover = ytdTurnover + fcTurnover;
    var fyBudget = sumArr(B.turnover, 0, 12);
    var gap = fyTurnover - fyBudget;
    var gapColor = gap >= 0 ? "#27AE60" : "#E74C3C";
    var gapSign = gap >= 0 ? "+" : "";

    narEl.style.display = "block";
    narEl.innerHTML = '<strong>Slider scenario:</strong> ' +
      Math.round(sHours) + ' hrs/month \u00D7 ' + Math.round(sUtil) + '% util \u00D7 \u20AC' + Math.round(sRate) + '/hr = ' +
      '<strong>\u20AC' + u.fmt(Math.round(monthlyRev)) + '/month</strong> service revenue \u00D7 ' + remaining + ' remaining months. ' +
      'FY Revenue forecast: <strong>\u20AC' + u.fmt(Math.round(fyTurnover)) + '</strong> vs budget \u20AC' + u.fmt(Math.round(fyBudget)) +
      ' (<span style="color:' + gapColor + ';font-weight:600">' + gapSign + '\u20AC' + u.fmt(Math.round(Math.abs(gap))) + '</span>).';
  }

  // === BUILD P&L KPIs ===
  function buildExecPnlKPIs(overrideSvcRev) {
    var A = window.PNL_ACTUALS, B = window.PNL_BUDGET;
    if (!A || !B) return;
    var n = countActualMonths();

    // --- Operational Revenue (service only, excl. commission) ---
    var opsRevActual = sumArr(A.service_rev, 0, n);
    var opsRevBudgetYTD = sumArr(B.service_rev, 0, n);
    var opsRevVarPct = opsRevBudgetYTD > 0 ? (opsRevActual - opsRevBudgetYTD) / opsRevBudgetYTD * 100 : null;

    // --- Delivery Margin = service_rev - people_cost - direct_costs (matches budget Excel) ---
    var deliveryCostActual = Math.abs(sumArr(A.people_cost, 0, n)) + Math.abs(sumArr(A.direct_costs, 0, n));
    var deliveryMarginPct = opsRevActual > 0 ? (opsRevActual - deliveryCostActual) / opsRevActual * 100 : 0;
    var deliveryCostBudget = Math.abs(sumArr(B.people_cost, 0, n)) + Math.abs(sumArr(B.direct_costs, 0, n));
    var deliveryMarginBudget = opsRevBudgetYTD > 0 ? (opsRevBudgetYTD - deliveryCostBudget) / opsRevBudgetYTD * 100 : 0;
    var deliveryMarginDelta = deliveryMarginPct - deliveryMarginBudget;

    // --- HubSpot Commission: actual vs forecast ---
    var commActual = sumArr(A.other_rev, 0, n);
    var commBudgetYTD = B.commission ? sumArr(B.commission, 0, n) : sumArr(B.other_rev, 0, n);
    var commVarPct = commBudgetYTD > 0 ? (commActual - commBudgetYTD) / commBudgetYTD * 100 : null;

    // --- Total Revenue (service + commission) ---
    var revActual = sumArr(A.turnover, 0, n);
    var revBudgetYTD = sumArr(B.turnover, 0, n);
    var revVarPct = revBudgetYTD > 0 ? (revActual - revBudgetYTD) / revBudgetYTD * 100 : null;

    // --- EBITDA ---
    var ebitdaActual = sumArr(A.reported_ebitda, 0, n);
    var ebitdaBudgetYTD = sumArr(B.reported_ebitda, 0, n);
    var ebitdaVarPct = ebitdaBudgetYTD > 0 ? (ebitdaActual - ebitdaBudgetYTD) / ebitdaBudgetYTD * 100 : null;

    // FY forecasts — use slider override if provided
    var fyRevForecast, fyEbitdaForecast, fyOpsRevForecast, fyDeliveryCostForecast;
    var commFc = getForecast("other_rev");
    var costFc = getForecast("people_cost");
    var opexFc = getForecast("total_opex");
    var directFc = getForecast("direct_costs");
    if (overrideSvcRev != null) {
      fyRevForecast = sumArr(A.turnover, 0, n);
      fyEbitdaForecast = sumArr(A.reported_ebitda, 0, n);
      fyOpsRevForecast = sumArr(A.service_rev, 0, n);
      fyDeliveryCostForecast = Math.abs(sumArr(A.people_cost, 0, n)) + Math.abs(sumArr(A.direct_costs, 0, n));
      for (var i = n; i < 12; i++) {
        var turnover_i = overrideSvcRev + commFc[i];
        fyRevForecast += turnover_i;
        fyEbitdaForecast += turnover_i + costFc[i] + opexFc[i]; // costs are negative
        fyOpsRevForecast += overrideSvcRev;
        fyDeliveryCostForecast += Math.abs(costFc[i]) + Math.abs(directFc[i]);
      }
    } else {
      fyRevForecast = sumArr(getForecast("turnover"), 0, 12);
      fyEbitdaForecast = sumArr(getForecast("reported_ebitda"), 0, 12);
      fyOpsRevForecast = sumArr(getForecast("service_rev"), 0, 12);
      fyDeliveryCostForecast = Math.abs(sumArr(getForecast("people_cost"), 0, 12)) + Math.abs(sumArr(getForecast("direct_costs"), 0, 12));
    }
    var fyRevBudget = sumArr(B.turnover, 0, 12);
    var fyRevVarPct = fyRevBudget > 0 ? (fyRevForecast - fyRevBudget) / fyRevBudget * 100 : null;
    var fyEbitdaBudget = sumArr(B.reported_ebitda, 0, 12);
    var fyEbitdaVarPct = fyEbitdaBudget > 0 ? (fyEbitdaForecast - fyEbitdaBudget) / fyEbitdaBudget * 100 : null;

    // FY Ops Revenue + Delivery Margin forecasts
    var fyOpsRevBudget = sumArr(B.service_rev, 0, 12);
    var fyOpsRevVarPct = fyOpsRevBudget > 0 ? (fyOpsRevForecast - fyOpsRevBudget) / fyOpsRevBudget * 100 : null;
    var fyDeliveryMarginPct = fyOpsRevForecast > 0 ? (fyOpsRevForecast - fyDeliveryCostForecast) / fyOpsRevForecast * 100 : 0;
    var fyDeliveryCostBudget = Math.abs(sumArr(B.people_cost, 0, 12)) + Math.abs(sumArr(B.direct_costs, 0, 12));
    var fyDeliveryMarginBudget = fyOpsRevBudget > 0 ? (fyOpsRevBudget - fyDeliveryCostBudget) / fyOpsRevBudget * 100 : 0;
    var fyDeliveryMarginDelta = fyDeliveryMarginPct - fyDeliveryMarginBudget;

    var scenarioTag = overrideSvcRev != null ? " (Scenario)" : "";

    // --- Absolute margins ---
    var deliveryMarginAbs = opsRevActual - deliveryCostActual;
    var deliveryMarginAbsBudget = opsRevBudgetYTD - deliveryCostBudget;
    var fyDeliveryMarginAbs = fyOpsRevForecast - fyDeliveryCostForecast;
    var fyDeliveryMarginAbsBudget = fyOpsRevBudget - fyDeliveryCostBudget;

    // --- Profit Margin % (EBITDA as % of total revenue) ---
    var profitMarginPct = revActual > 0 ? ebitdaActual / revActual * 100 : 0;
    var profitMarginBudget = revBudgetYTD > 0 ? ebitdaBudgetYTD / revBudgetYTD * 100 : 0;
    var profitMarginDelta = profitMarginPct - profitMarginBudget;

    // --- FY Profit Margin % ---
    var fyProfitMarginPct = fyRevForecast > 0 ? fyEbitdaForecast / fyRevForecast * 100 : 0;
    var fyProfitMarginBudget = fyRevBudget > 0 ? fyEbitdaBudget / fyRevBudget * 100 : 0;

    // --- HubSpot Commission ---
    var commGap = commActual - commBudgetYTD;
    var commGapColor = u.deltaColor(commVarPct != null ? commVarPct : 0);
    var commGapSign = commGap >= 0 ? "+" : "";

    // Build KPI strip — 6 simple cards (3 per row) + commission text line
    var el = document.getElementById("exec-pnl-kpis");
    if (!el) return;

    el.innerHTML =
      // --- Row 1: Total ---
      '<div class="kpi-strip-label">Total (incl. commission)</div>' +
      '<div class="kpi-strip-row">' +
        kpiCard("Revenue", infoIcon("Total accounting turnover: service revenue + HubSpot commission."),
          u.fmtEur(revActual), u.fmtEur(revBudgetYTD), revActual - revBudgetYTD, revVarPct) +
        kpiCard("Profit Margin", infoIcon("EBITDA: earnings before interest, taxes, depreciation and amortization."),
          u.fmtEur(ebitdaActual), u.fmtEur(ebitdaBudgetYTD), ebitdaActual - ebitdaBudgetYTD, ebitdaVarPct) +
        kpiCard("Profit Margin %", infoIcon("EBITDA as % of total revenue."),
          profitMarginPct.toFixed(1) + "%", profitMarginBudget.toFixed(1) + "%", null, null, profitMarginDelta) +
      '</div>' +
      // --- Row 2: Delivery ---
      '<div class="kpi-strip-label">Delivery (service revenue only)</div>' +
      '<div class="kpi-strip-row">' +
        kpiCard("Ops Revenue", infoIcon("Service revenue only, excl. HubSpot commission."),
          u.fmtEur(opsRevActual), u.fmtEur(opsRevBudgetYTD), opsRevActual - opsRevBudgetYTD, opsRevVarPct) +
        kpiCard("Delivery Margin", infoIcon("Service rev \u2212 people cost \u2212 direct costs. Matches budget Excel."),
          u.fmtEur(deliveryMarginAbs), u.fmtEur(deliveryMarginAbsBudget), deliveryMarginAbs - deliveryMarginAbsBudget, null,
          null, (deliveryMarginAbs - deliveryMarginAbsBudget) / Math.abs(deliveryMarginAbsBudget) * 100) +
        kpiCard("Delivery Margin %", infoIcon("(Service rev \u2212 people cost \u2212 direct costs) / service rev. Matches budget Excel."),
          deliveryMarginPct.toFixed(1) + "%", deliveryMarginBudget.toFixed(1) + "%", null, null, deliveryMarginDelta) +
      '</div>' +
      // --- HubSpot Commission text line ---
      '<div class="kpi-commission-line">HubSpot Commission: <strong>' + u.fmtEur(commActual) + '</strong> ' +
        '<span class="comm-sub">Budget: ' + u.fmtEur(commBudgetYTD) + '</span> ' +
        '<span style="color:' + commGapColor + ';font-weight:600">' + commGapSign + u.fmtEur(commGap) + '</span>' +
      '</div>';
  }

  // Simple KPI card: value, budget, absolute gap, % delta (or pp delta for margin %)
  function kpiCard(label, icon, value, budget, absGap, pctDelta, ppDelta, pctDelta2) {
    // Gap line
    var gapHtml = "";
    if (absGap !== null && absGap !== undefined) {
      var gs = absGap >= 0 ? "+" : "";
      var gc = u.deltaColor(absGap >= 0 ? 1 : (Math.abs(absGap) > 50000 ? -20 : -5));
      gapHtml = '<span class="kpi-gap-val" style="color:' + gc + '">' + gs + u.fmtEur(absGap) + '</span>';
    }
    // % delta
    var deltaHtml = "";
    if (pctDelta !== null && pctDelta !== undefined) {
      var dc = u.deltaColor(pctDelta);
      var ds = pctDelta >= 0 ? "+" : "";
      deltaHtml = ' <span style="color:' + dc + '">' + ds + pctDelta.toFixed(1) + '%</span>';
    }
    // pp delta (for margin % cards)
    if (ppDelta !== null && ppDelta !== undefined) {
      var dc2 = u.deltaColor(ppDelta);
      var ds2 = ppDelta >= 0 ? "+" : "";
      gapHtml = '<span class="kpi-gap-val" style="color:' + dc2 + '">' + ds2 + ppDelta.toFixed(1) + 'pp</span>';
    }
    // secondary % (e.g. delivery margin abs gap as %)
    if (pctDelta2 !== null && pctDelta2 !== undefined) {
      var dc3 = u.deltaColor(pctDelta2);
      var ds3 = pctDelta2 >= 0 ? "+" : "";
      deltaHtml = ' <span style="color:' + dc3 + '">' + ds3 + pctDelta2.toFixed(1) + '%</span>';
    }

    return '<div class="kpi-item">' +
      '<div class="kpi-label">' + label + ' ' + icon + '</div>' +
      '<div class="kpi-value">' + value + '</div>' +
      '<div class="kpi-sub">Budget: ' + budget + '</div>' +
      '<div class="kpi-gap">' + gapHtml + deltaHtml + ' <span class="kpi-gap-label">vs budget</span></div>' +
    '</div>';
  }

  // === BUILD P&L CHART ===
  function buildExecPnlChart(overrideSvcRev) {
    var A = window.PNL_ACTUALS, B = window.PNL_BUDGET;
    if (!A || !B) return;
    var n = countActualMonths();

    var serviceRev = getForecast("service_rev");
    var commFc     = getForecast("other_rev");
    var peopleCost = getForecast("people_cost").map(function(v){ return Math.abs(v); });
    var opex       = getForecast("total_opex").map(function(v){ return Math.abs(v); });
    var ebitdaBudgetArr = B.reported_ebitda;

    // If slider override: replace service_rev for forecast months and recompute EBITDA forecast
    var ebitdaForecastArr = getForecast("reported_ebitda");
    if (overrideSvcRev != null) {
      serviceRev = serviceRev.slice(); // clone
      ebitdaForecastArr = ebitdaForecastArr.slice();
      for (var oi = n; oi < 12; oi++) {
        serviceRev[oi] = overrideSvcRev;
        var turnover_oi = overrideSvcRev + commFc[oi];
        // EBITDA = turnover - |people_cost| - |opex|
        ebitdaForecastArr[oi] = turnover_oi - peopleCost[oi] - opex[oi];
      }
    }

    var turnover = [];
    for (var t = 0; t < 12; t++) turnover.push(serviceRev[t] + commFc[t]);
    var otherRev = commFc;

    var data = [];
    for (var i = 0; i < 12; i++) {
      data.push({
        month: PNL_MONTHS[i], idx: i,
        svcRev: serviceRev[i], commission: otherRev[i],
        pplCost: peopleCost[i], opex: opex[i],
        eBudget: ebitdaBudgetArr[i], eForecast: ebitdaForecastArr[i],
        budgetRev: B.turnover[i],
        budgetCost: Math.abs(B.people_cost[i]) + Math.abs(B.total_opex[i]),
        isActual: i < n
      });
    }

    var margin = {top: 36, right: 70, bottom: 40, left: 70};
    var totalH = 400;
    var ctx = d3c.createSvg("exec-pnl-chart", margin, totalH);
    if (!ctx) return;
    var g = ctx.g, W = ctx.innerW, H = ctx.innerH;

    var x0 = d3.scaleBand().domain(PNL_MONTHS).range([0, W]).padding(0.2);
    var halfBand = x0.bandwidth() / 2;
    var barW = halfBand - 1;

    var maxBar = d3.max(data, function(d) {
      return Math.max(d.svcRev + d.commission, d.pplCost + d.opex, d.budgetRev, d.budgetCost);
    });
    var yBar = d3.scaleLinear().domain([0, maxBar * 1.15]).nice().range([H, 0]);

    var allE = ebitdaBudgetArr.concat(ebitdaForecastArr);
    var eMin = d3.min(allE), eMax = d3.max(allE), eR = (eMax - eMin) || 1;
    var yE = d3.scaleLinear().domain([eMin - eR * 0.4, eMax + eR * 0.4]).nice().range([H, 0]);

    yBar.ticks(5).forEach(function(tick) {
      g.append("line").attr("x1", 0).attr("x2", W).attr("y1", yBar(tick)).attr("y2", yBar(tick)).attr("stroke", "#F0F2F5");
    });

    g.append("g").call(d3.axisLeft(yBar).ticks(5).tickFormat(function(d) { return "\u20ac" + d3c.fmtNum(d); })).selectAll("text").attr("fill", "#5F6B7A").attr("font-size", "10px");
    g.append("text").attr("transform", "rotate(-90)").attr("y", -55).attr("x", -H/2).attr("text-anchor", "middle").attr("fill", "#5F6B7A").attr("font-size", "10px").text("Revenue / Cost");

    g.append("g").attr("transform", "translate(" + W + ",0)").call(d3.axisRight(yE).ticks(5).tickFormat(function(d) { return "\u20ac" + d3c.fmtNum(d); })).selectAll("text").attr("fill", "#5F6B7A").attr("font-size", "10px");
    g.append("text").attr("transform", "rotate(90)").attr("y", -(W + 55)).attr("x", H/2).attr("text-anchor", "middle").attr("fill", "#5F6B7A").attr("font-size", "10px").text("EBITDA");

    g.append("g").attr("transform", "translate(0," + H + ")").call(d3.axisBottom(x0)).selectAll("text").attr("fill", "#5F6B7A").attr("font-size", "10px");

    var tip = d3c.createTooltip("exec-pnl-chart");

    data.forEach(function(d) {
      var xBase = x0(d.month);
      var isScenario = !d.isActual && overrideSvcRev != null;
      var alpha = d.isActual ? 0.9 : (isScenario ? 0.6 : 0.38);

      if (d.isActual) {
        g.append("rect").attr("x", xBase).attr("y", yBar(d.budgetRev)).attr("width", barW).attr("height", yBar(0) - yBar(d.budgetRev))
          .attr("fill", "none").attr("stroke", "rgba(52,152,219,0.45)").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,2").attr("rx", 2);
        g.append("rect").attr("x", xBase + halfBand + 1).attr("y", yBar(d.budgetCost)).attr("width", barW).attr("height", yBar(0) - yBar(d.budgetCost))
          .attr("fill", "none").attr("stroke", "rgba(231,76,60,0.45)").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,2").attr("rx", 2);
      }

      var svcH = yBar(0) - yBar(d.svcRev);
      var comH = yBar(0) - yBar(d.commission);
      g.append("rect").attr("x", xBase).attr("y", yBar(d.svcRev + d.commission)).attr("width", barW).attr("height", svcH + comH)
        .attr("fill", "rgba(52,152,219," + alpha + ")").attr("rx", 2);
      if (d.commission > 0) {
        g.append("rect").attr("x", xBase).attr("y", yBar(d.svcRev + d.commission)).attr("width", barW).attr("height", comH)
          .attr("fill", "rgba(155,89,182," + alpha + ")").attr("rx", 2);
      }

      g.append("rect").attr("x", xBase + halfBand + 1).attr("y", yBar(d.pplCost + d.opex)).attr("width", barW).attr("height", yBar(0) - yBar(d.pplCost + d.opex))
        .attr("fill", "rgba(231,76,60," + alpha + ")").attr("rx", 2);
      if (d.opex > 0) {
        g.append("rect").attr("x", xBase + halfBand + 1).attr("y", yBar(d.pplCost + d.opex)).attr("width", barW).attr("height", yBar(0) - yBar(d.opex))
          .attr("fill", "rgba(230,126,34," + alpha + ")").attr("rx", 2);
      }

      g.append("rect").attr("x", xBase).attr("y", 0).attr("width", x0.bandwidth()).attr("height", H)
        .attr("fill", "transparent").attr("cursor", "pointer")
        .on("mouseenter", function(ev) {
          var totalRev = d.svcRev + d.commission;
          var totalCost = d.pplCost + d.opex;
          var label = d.isActual ? " (Actual)" : (isScenario ? " (Scenario)" : " (Forecast)");
          var html = "<div style='font-weight:600;margin-bottom:4px'>" + d.month + label + "</div>" +
            "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:11px'>" +
            "<span style='color:#3498DB'>\u25A0 Service Rev</span><span>\u20ac" + d3c.fmtNum(Math.round(d.svcRev)) + "</span>" +
            "<span style='color:#9B59B6'>\u25A0 Commission</span><span>\u20ac" + d3c.fmtNum(Math.round(d.commission)) + "</span>" +
            "<span style='font-weight:600'>Total Revenue</span><span style='font-weight:600'>\u20ac" + d3c.fmtNum(Math.round(totalRev)) + "</span>" +
            "<span style='color:#94A3B8'>Revenue Budget</span><span style='color:#94A3B8'>\u20ac" + d3c.fmtNum(Math.round(d.budgetRev)) + "</span>" +
            "<span style='color:#E74C3C'>\u25A0 People Cost</span><span>\u20ac" + d3c.fmtNum(Math.round(d.pplCost)) + "</span>" +
            "<span style='color:#E67E22'>\u25A0 OpEx</span><span>\u20ac" + d3c.fmtNum(Math.round(d.opex)) + "</span>" +
            "<span style='font-weight:600'>Total Cost</span><span style='font-weight:600'>\u20ac" + d3c.fmtNum(Math.round(totalCost)) + "</span>" +
            "<span style='color:#E67E22'>\u2666 EBITDA Budget</span><span>\u20ac" + d3c.fmtNum(Math.round(d.eBudget)) + "</span>" +
            "<span style='color:#27AE60'>\u25CF EBITDA</span><span>\u20ac" + d3c.fmtNum(Math.round(d.eForecast)) + "</span></div>";
          tip.html(html).style("opacity", 1);
          d3c.positionTooltip(tip, ev, "exec-pnl-chart");
        })
        .on("mousemove", function(ev) { d3c.positionTooltip(tip, ev, "exec-pnl-chart"); })
        .on("mouseleave", function() { tip.style("opacity", 0); });
    });

    // EBITDA Budget line
    var lineBudget = d3.line().x(function(d) { return x0(d.month) + x0.bandwidth() / 2; }).y(function(d) { return yE(d.eBudget); });
    g.append("path").datum(data).attr("d", lineBudget).attr("fill", "none").attr("stroke", "#E67E22").attr("stroke-width", 3).attr("stroke-dasharray", "8,4");
    g.selectAll(".eb-dot").data(data).enter().append("circle")
      .attr("cx", function(d) { return x0(d.month) + x0.bandwidth() / 2; }).attr("cy", function(d) { return yE(d.eBudget); })
      .attr("r", 5).attr("fill", "#E67E22").attr("stroke", "white").attr("stroke-width", 2);

    // EBITDA Forecast line
    var lineFc = d3.line().x(function(d) { return x0(d.month) + x0.bandwidth() / 2; }).y(function(d) { return yE(d.eForecast); });
    g.append("path").datum(data).attr("d", lineFc).attr("fill", "none").attr("stroke", "#27AE60").attr("stroke-width", 3);
    g.selectAll(".ef-dot").data(data).enter().append("circle")
      .attr("cx", function(d) { return x0(d.month) + x0.bandwidth() / 2; }).attr("cy", function(d) { return yE(d.eForecast); })
      .attr("r", 5).attr("fill", "#27AE60").attr("stroke", "white").attr("stroke-width", 2);

    // Divider
    if (n < 12) {
      var divX = x0(PNL_MONTHS[n]) - x0.step() * x0.padding() / 2;
      g.append("line").attr("x1", divX).attr("x2", divX).attr("y1", 0).attr("y2", H)
        .attr("stroke", "#94A3B8").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,3");
      var divLabel = overrideSvcRev != null ? "Actual | Scenario \u2192" : "Actual | Forecast \u2192";
      g.append("text").attr("x", divX).attr("y", -8).attr("text-anchor", "middle")
        .attr("fill", "#94A3B8").attr("font-size", "9px").text(divLabel);
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
        gg.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", "none").attr("stroke", item.color).attr("stroke-width", 1.5).attr("stroke-dasharray", "3,1.5");
      } else if (item.type === "dashedLine") {
        gg.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 5).attr("y2", 5).attr("stroke", item.color).attr("stroke-width", 2.5).attr("stroke-dasharray", "4,2");
      } else if (item.type === "line") {
        gg.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 5).attr("y2", 5).attr("stroke", item.color).attr("stroke-width", 2.5);
      } else {
        gg.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", item.color);
      }
      gg.append("text").attr("x", 16).attr("y", 9).attr("fill", "#5F6B7A").attr("font-size", "10px").text(item.label);
      lx += item.label.length * 6.2 + 28;
    });
  }

  // === OPERATIONAL ALERTS ===
  function buildOperationalAlerts() {
    var cliAll = DATA.clients || [];
    var losers = cliAll.filter(function(c) {
      var n = (c.client_name || "").toLowerCase();
      if (n === "leadstreet" || n === "hubspot" || !c.client_name) return false;
      if ((c.total_hours || 0) <= 15) return false;
      return c.revenue > 0 ? (c.revenue - c.staff_cost) / c.revenue * 100 < 0 : c.staff_cost > 0;
    }).map(function(c) {
      var margin = c.revenue - c.staff_cost;
      var marginPct = c.revenue > 0 ? margin / c.revenue * 100 : -100;
      return { name: c.client_name, revenue: c.revenue, cost: c.staff_cost, margin: margin, marginPct: marginPct, companyId: c.company_id, projectId: c.project_id };
    }).sort(function(a, b) { return a.margin - b.margin; });

    var losersEl = document.getElementById("exec-losers-table");
    if (losersEl) {
      if (losers.length === 0) {
        losersEl.innerHTML = '<div class="exec-alert-empty">No clients with negative margin this year</div>';
      } else {
        var html = '<table class="exec-alert-table"><thead><tr><th>Client</th><th>Revenue</th><th>Cost</th><th>Margin</th><th>%</th></tr></thead><tbody>';
        losers.forEach(function(c) {
          html += '<tr><td>' + u.prodLink(c.name, c.projectId, c.companyId, 28) + '</td>';
          html += '<td>\u20AC' + u.fmt(Math.round(c.revenue)) + '</td><td>\u20AC' + u.fmt(Math.round(c.cost)) + '</td>';
          html += '<td style="color:#DC2626;font-weight:600">\u20AC' + u.fmt(Math.round(c.margin)) + '</td>';
          html += '<td style="color:#DC2626">' + c.marginPct.toFixed(0) + '%</td></tr>';
        });
        html += '</tbody></table>';
        losersEl.innerHTML = html;
      }
    }

    var nearBudget = (DATA.overbudget || []).filter(function(d) {
      if (d.delivered_on) return false;  // only open budgets
      var pct = d.hours_burn_pct || 0;
      if (pct < 85 || pct >= 95) return false;
      if ((d.budgeted_hours || 0) <= 2 || (d.worked_hours || 0) <= 0) return false;
      if ((d.name || "").toLowerCase().indexOf("pso") >= 0) return false;
      return true;
    }).sort(function(a, b) { return (b.hours_burn_pct || 0) - (a.hours_burn_pct || 0); });

    var budgetEl = document.getElementById("exec-budget-table");
    if (budgetEl) {
      if (nearBudget.length === 0) {
        budgetEl.innerHTML = '<div class="exec-alert-empty">No deals between 85-95% budget</div>';
      } else {
        var html2 = '<table class="exec-alert-table"><thead><tr><th>Client / Deal</th><th>Budget %</th><th>Hours</th></tr></thead><tbody>';
        nearBudget.slice(0, 15).forEach(function(d) {
          var pct = Math.round(d.hours_burn_pct || 0);
          var dealName = (d.name || "").length > 40 ? d.name.substring(0, 37) + "..." : (d.name || "");
          var link = dealName;
          if (d.project_id && d.id) link = u.prodDealLink(dealName, d.project_id, d.id, 40);
          else if (d.project_id && d.company_id) link = u.prodLink(dealName, d.project_id, d.company_id, 40);
          html2 += '<tr><td>' + link + '</td><td style="color:#D97706;font-weight:600">' + pct + '%</td>';
          html2 += '<td>' + Math.round(d.worked_hours || 0) + ' / ' + Math.round(d.budgeted_hours || 0) + 'h</td></tr>';
        });
        if (nearBudget.length > 15) html2 += '<tr><td colspan="3" style="color:var(--text-muted);padding:6px 8px">... and ' + (nearBudget.length - 15) + ' more</td></tr>';
        html2 += '</tbody></table>';
        budgetEl.innerHTML = html2;
      }
    }
  }

  // === AI EXECUTIVE RECAP ===
  var recapInitialized = false;

  function gatherRecapContext() {
    var A = window.PNL_ACTUALS, B = window.PNL_BUDGET;
    var nc = A ? countActualMonths() : 0;
    if (!A || !B || nc === 0) return null;

    // P&L: actuals vs budget for closed months
    var pnl = {
      months_closed: nc,
      revenue_actual: sumArr(A.turnover, 0, nc),
      revenue_budget: sumArr(B.turnover, 0, nc),
      service_rev_actual: sumArr(A.service_rev, 0, nc),
      service_rev_budget: sumArr(B.service_rev, 0, nc),
      commission_actual: sumArr(A.other_rev, 0, nc),
      commission_budget: sumArr(B.other_rev, 0, nc),
      commission_budget_by_month: B.commission ? B.commission.slice(0, 6) : B.other_rev.slice(0, 6),
      gross_profit_actual: sumArr(A.gross_profit, 0, nc),
      gross_profit_budget: sumArr(B.gross_profit, 0, nc),
      gross_margin_actual_pct: +(sumArr(A.gross_profit, 0, nc) / sumArr(A.turnover, 0, nc) * 100).toFixed(1),
      gross_margin_budget_pct: +(sumArr(B.gross_profit, 0, nc) / sumArr(B.turnover, 0, nc) * 100).toFixed(1),
      ebitda_actual: sumArr(A.reported_ebitda, 0, nc),
      ebitda_budget: sumArr(B.reported_ebitda, 0, nc),
      people_cost_actual: sumArr(A.people_cost, 0, nc),
      people_cost_budget: sumArr(B.people_cost, 0, nc),
      freelancer_cost_actual: sumArr(A.freelancers, 0, nc),
      freelancer_cost_budget: sumArr(B.freelancers, 0, nc)
    };

    // Monthly breakdown for trend
    pnl.monthly = [];
    for (var i = 0; i < nc; i++) {
      pnl.monthly.push({
        month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
        revenue: A.turnover[i], rev_budget: B.turnover[i],
        service_rev: A.service_rev[i], service_rev_budget: B.service_rev[i],
        commission: A.other_rev[i], comm_budget: B.other_rev[i],
        gross_margin_pct: A.gross_profit_pct[i], margin_budget_pct: B.gross_profit_pct[i],
        ebitda: A.reported_ebitda[i], ebitda_budget: B.reported_ebitda[i]
      });
    }

    // Full-year budget totals for context
    pnl.fy_budget = {
      revenue: sumArr(B.turnover, 0, 12),
      service_rev: sumArr(B.service_rev, 0, 12),
      commission: sumArr(B.other_rev, 0, 12),
      gross_profit: sumArr(B.gross_profit, 0, 12),
      ebitda: sumArr(B.reported_ebitda, 0, 12)
    };

    // Delivery metrics from Productive
    var now = new Date();
    var currentMonthStr = now.getFullYear() + "-" + (now.getMonth() + 1 < 10 ? "0" : "") + (now.getMonth() + 1);
    var fm = (DATA.financial_monthly || []).filter(function(r) {
      var m = r.month ? r.month.substring(0, 7) : null;
      return m && m >= "2026-01" && m < currentMonthStr;
    });
    var delivery = {
      months: fm.map(function(r) {
        return {
          month: r.month, revenue: Math.round(r.revenue || 0),
          staff_cost: Math.round(r.staff_cost || 0),
          margin_pct: +(r.margin_pct || 0).toFixed(1),
          util_pct: +(r.util_pct || 0).toFixed(1),
          total_hours: Math.round(r.total_hours || 0),
          billable_hours: Math.round(r.billable_hours || 0)
        };
      })
    };
    if (fm.length > 0) {
      var totRev = u.sum(fm, "revenue"), totCost = u.sum(fm, "staff_cost");
      var totHrs = u.sum(fm, "total_hours"), totBill = u.sum(fm, "billable_hours");
      delivery.ytd = {
        revenue: Math.round(totRev), staff_cost: Math.round(totCost),
        delivery_margin_pct: totRev ? +((totRev - totCost) / totRev * 100).toFixed(1) : 0,
        utilisation_pct: totHrs ? +(totBill / totHrs * 100).toFixed(1) : 0,
        effective_rate: totHrs ? +(totRev / totHrs).toFixed(0) : 0,
        avg_billable_rate: totBill ? +(totRev / totBill).toFixed(0) : 0
      };
    }

    // Top people by utilisation (bottom 5 and top 5)
    var pm = (DATA.people_monthly || []).filter(function(r) {
      var m = r.month ? r.month.substring(0, 7) : null;
      return m && m >= "2026-01" && m < currentMonthStr && (r.hours || 0) > 20;
    });
    var personMap = {};
    pm.forEach(function(r) {
      if (!personMap[r.person_name]) personMap[r.person_name] = { hours: 0, billable: 0, cost: 0, revenue: 0 };
      var p = personMap[r.person_name];
      p.hours += r.hours || 0; p.billable += r.billable_hours || 0;
      p.cost += r.staff_cost || 0; p.revenue += r.entry_revenue || 0;
    });
    var people = Object.keys(personMap).map(function(name) {
      var p = personMap[name];
      return {
        name: name,
        util_pct: p.hours ? +(p.billable / p.hours * 100).toFixed(1) : 0,
        effective_rate: p.hours ? +(p.revenue / p.hours).toFixed(0) : 0,
        total_hours: Math.round(p.hours)
      };
    }).sort(function(a, b) { return a.util_pct - b.util_pct; });

    // Service type metrics
    var stm = (DATA.service_type_monthly || []).filter(function(r) {
      var m = r.month ? r.month.substring(0, 7) : null;
      return m && m >= "2026-01" && m < currentMonthStr;
    });
    var svcMap = {};
    stm.forEach(function(r) {
      var k = r.service_type || "Unknown";
      if (!svcMap[k]) svcMap[k] = { hours: 0, billable: 0, cost: 0, revenue: 0 };
      var s = svcMap[k];
      s.hours += r.total_hours || 0; s.billable += r.billable_hours || 0;
      s.cost += r.staff_cost || 0; s.revenue += r.allocated_revenue || r.revenue || 0;
    });
    var services = Object.keys(svcMap).map(function(k) {
      var s = svcMap[k];
      return {
        type: k, hours: Math.round(s.hours), billable_hours: Math.round(s.billable),
        effective_rate: s.hours ? +(s.revenue / s.hours).toFixed(0) : 0,
        acph: s.hours ? +(s.cost / s.hours).toFixed(0) : 0,
        margin_per_hour: s.hours ? +((s.revenue - s.cost) / s.hours).toFixed(0) : 0
      };
    }).sort(function(a, b) { return b.hours - a.hours; });

    // Overbudget deals
    var ob = DATA.overbudget || [];
    var redDeals = ob.filter(function(d) { return d.flag === "RED"; });
    var amberDeals = ob.filter(function(d) { return d.flag === "AMBER"; });
    var overbudget = {
      red_count: redDeals.length, amber_count: amberDeals.length,
      total_overspend: Math.round(u.sum(redDeals, "overspend_cost")),
      worst_3: redDeals.sort(function(a, b) { return (b.overspend_cost || 0) - (a.overspend_cost || 0); }).slice(0, 3).map(function(d) {
        return { name: d.name, client: d.company_name, overspend: Math.round(d.overspend_cost || 0), burn_pct: Math.round(d.hours_burn_pct || 0) };
      })
    };

    // Top clients by revenue
    var clients = (DATA.clients || []).slice().sort(function(a, b) { return (b.revenue || 0) - (a.revenue || 0); }).slice(0, 10).map(function(c) {
      return {
        name: c.client_name, revenue: Math.round(c.revenue || 0),
        hours: Math.round(c.total_hours || 0),
        overbudget_deals: c.overbudget_deals || 0
      };
    });

    return {
      pnl: pnl,
      delivery: delivery,
      people_bottom5: people.slice(0, 5),
      people_top5: people.slice(-5).reverse(),
      services: services,
      overbudget: overbudget,
      top_clients: clients
    };
  }

  function buildAIRecap() {
    if (recapInitialized) return;
    recapInitialized = true;
    var btn = document.getElementById("exec-recap-btn");
    var content = document.getElementById("exec-recap-content");
    if (!btn || !content) return;
    btn.addEventListener("click", function() {
      btn.disabled = true; btn.textContent = "Generating...";
      content.style.display = "block";
      content.innerHTML = '<span style="color:var(--text-muted)">Analyzing your metrics...</span>';

      var ctx = gatherRecapContext();
      if (!ctx) {
        content.innerHTML = '<span class="exec-recap-error">No closed months available yet.</span>';
        btn.textContent = "Generate Executive Recap"; btn.disabled = false;
        return;
      }

      var prompt = "You are the world's smartest agency CEO — you've scaled multiple HubSpot partner agencies and you think in terms of delivery margin, effective rates, and capacity utilisation. You are reviewing YTD performance for LeadStreet, a HubSpot diamond partner agency (team of ~15 freelancers + 3 owner-managers).\n\n"
        + "CONTEXT:\n"
        + "- LeadStreet's 2026 strategy: increase delivery margin by improving utilisation and effective rates\n"
        + "- HubSpot commission (~€35K/month in Q1) is expected to DROP significantly through the year (budget shows decline from €35K to €28K/month by Q4) — this is a known headwind\n"
        + "- All amounts are in EUR. Costs are negative in the data.\n"
        + "- 'Effective rate' = revenue / total hours (not just billable). This is the metric that matters — it captures scope creep.\n"
        + "- Owner-managers have a flat €14.2K/month cost override each\n\n"
        + "WRITE A BRIEFING THAT COVERS:\n"
        + "1. **P&L vs Budget** — Are we ahead or behind? By how much? What's driving the gap?\n"
        + "2. **Commission risk** — How is HubSpot commission tracking vs budget? Flag if the expected decline is on track or accelerating.\n"
        + "3. **Delivery margin** — How is the delivery-only margin (service revenue minus staff cost)? Is the strategy of improving delivery margin working?\n"
        + "4. **People** — Who are the utilisation outliers (high and low)? Any concerns?\n"
        + "5. **Service types** — Which service types have the best/worst effective rates and margins?\n"
        + "6. **Scope creep risk** — How many RED/AMBER overbudget deals? How bad is the overspend?\n"
        + "7. **One clear action** — The single most important thing to do this week.\n\n"
        + "FORMAT: Use short paragraphs with bold headers. Be specific — use actual numbers, names, percentages. No fluff. Think like a CEO who reads P&Ls for breakfast.\n\n"
        + "DATA:\n" + JSON.stringify(ctx, null, 2);

      var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
      var endpoint = isLocal ? "/api/chat" : "https://leadstreet-recap.labarbemanu.workers.dev";
      var payload = isLocal ? { question: prompt, conversation: [] } : { prompt: prompt };
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function(r) { if (!r.ok) throw new Error("err"); return r.json(); })
      .then(function(data) {
        // Convert markdown bold to HTML
        var html = (data.answer || "No response.").replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
        content.innerHTML = html;
        btn.textContent = "Regenerate Recap"; btn.disabled = false;
      })
      .catch(function() { content.innerHTML = '<span class="exec-recap-error">Recap service unavailable. Please try again later.</span>'; btn.textContent = "Generate Executive Recap"; btn.disabled = false; });
    });
  }

  // === PLAYGROUND TOGGLE ===
  function togglePlayground() {
    var panel = document.getElementById("exec-playground-panel");
    var btn = document.getElementById("exec-playground-toggle");
    if (!panel) return;
    var isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "flex";
    if (btn) btn.classList.toggle("open", !isOpen);
  }

  // Expose globals
  window.setBudgetScenario = setBudgetScenario;
  window.updateExecSliders = updateExecSliders;
  window.resetExecSliders = resetExecSliders;
  window.togglePlayground = togglePlayground;

  // === REGISTER SECTION ===
  D.registerSection("executive", function(f) {
    if ((DATA.budget_current || []).length === 0) return;

    // Compute Productive data for slider defaults
    var now = new Date();
    var currentMonthStr = now.getFullYear() + "-" + (now.getMonth() + 1 < 10 ? "0" : "") + (now.getMonth() + 1);
    var trendHrsMap = {}, trendRevMap = {};
    DATA.people_monthly.forEach(function(r) {
      var m = r.month ? r.month.substring(0, 7) : null;
      if (!m || m < "2026-01") return;
      if (!trendHrsMap[m]) trendHrsMap[m] = { total: 0, billable: 0 };
      trendHrsMap[m].total += r.hours || 0;
      trendHrsMap[m].billable += r.billable_hours || 0;
    });
    DATA.financial_monthly.forEach(function(r) {
      var m = r.month ? r.month.substring(0, 7) : null;
      if (m) trendRevMap[m] = r.revenue || 0;
    });
    var completedMonths = Object.keys(trendHrsMap).filter(function(m) { return m < currentMonthStr; }).sort();

    // Build P&L views
    buildExecPnlKPIs(null);
    buildExecPnlChart(null);

    // Init sliders with YTD actuals
    initSliders(completedMonths, trendHrsMap, trendRevMap);

    // Alerts
    buildOperationalAlerts();

    // AI recap
    buildAIRecap();
  });
})(window.Dashboard);
