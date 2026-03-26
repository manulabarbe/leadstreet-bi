(function(D) {
  var u = D.utils;
  var C = D.C;
  var d3c = D.d3;

  var _fcState = {};

  function computeForecast(data, valueKey) {
    // Exclude current (incomplete) month -- only use fully completed months
    var now = new Date();
    var currentMonthStr = now.getFullYear() + "-" + (now.getMonth() + 1 < 10 ? "0" : "") + (now.getMonth() + 1);
    var completeData = data.filter(function(r) { return r.month < currentMonthStr; });

    // Need at least 3 complete months
    if (completeData.length < 3) return null;

    var last3 = completeData.slice(-3);
    var avgValue = u.sum(last3, valueKey) / 3;
    var avgCost = u.sum(last3, "staff_cost") / 3;
    var avgHours = u.sum(last3, "total_hours") / 3;
    var avgBillableHours = u.sum(last3, "billable_hours") / 3;
    var avgUtilisation = avgHours > 0 ? (avgBillableHours / avgHours * 100) : 0;
    var avgBillableRate = avgBillableHours > 0 ? (u.sum(last3, valueKey) / u.sum(last3, "billable_hours")) : 0;
    var avgCostRate = avgHours > 0 ? (u.sum(last3, "staff_cost") / u.sum(last3, "total_hours")) : 0;

    // Standard deviation for scenarios
    var vals3 = last3.map(function(r) { return r[valueKey] || 0; });
    var mean3 = avgValue;
    var variance = vals3.reduce(function(s, v) { return s + (v - mean3) * (v - mean3); }, 0) / vals3.length;
    var stdDev = Math.sqrt(variance);

    // Trend: compare last 3 complete vs prior 3 complete
    var trend = { direction: "stable", changePct: 0 };
    if (completeData.length >= 6) {
      var prior3 = completeData.slice(-6, -3);
      var priorAvg = u.sum(prior3, valueKey) / 3;
      if (priorAvg > 0) {
        var change = (avgValue - priorAvg) / priorAvg * 100;
        trend.changePct = Math.round(change * 10) / 10;
        trend.direction = change > 3 ? "improving" : (change < -3 ? "declining" : "stable");
      }
    }

    // Determine forecast: from current month onward
    var yr = completeData[completeData.length - 1].month.substring(0, 4);
    var lastCompleteM = parseInt(completeData[completeData.length - 1].month.substring(5, 7));
    var monthsToForecast = 12 - lastCompleteM;

    // Build actuals -- only complete months in the current year
    var currentYearComplete = completeData.filter(function(r) { return r.month.substring(0, 4) === yr; });
    var actuals = currentYearComplete.map(function(r) {
      return { month: r.month, value: r[valueKey] || 0, cost: r.staff_cost || 0, forecast: false };
    });

    // Build forecasts -- from month after last complete month through December
    var forecasts = [];
    for (var m = lastCompleteM + 1; m <= 12; m++) {
      forecasts.push({
        month: yr + "-" + (m < 10 ? "0" : "") + m,
        value: avgValue,
        cost: avgCost,
        forecast: true
      });
    }

    // EOY totals
    var ytdValue = actuals.reduce(function(s, r) { return s + r.value; }, 0);
    var ytdCost = actuals.reduce(function(s, r) { return s + r.cost; }, 0);
    var eoyValue = ytdValue + avgValue * monthsToForecast;
    var eoyCost = ytdCost + avgCost * monthsToForecast;
    var eoyMarginEur = eoyValue - eoyCost;
    var eoyMarginPct = eoyValue > 0 ? (eoyMarginEur / eoyValue * 100) : 0;

    // Scenario ranges
    var optimisticValue = ytdValue + (avgValue + stdDev) * monthsToForecast;
    var pessimisticValue = ytdValue + Math.max(0, avgValue - stdDev) * monthsToForecast;

    // Trailing month labels
    var trailingMonths = last3.map(function(r) { return r.month; });

    return {
      actuals: actuals,
      forecasts: forecasts,
      eoyValue: eoyValue,
      eoyCost: eoyCost,
      eoyMarginEur: eoyMarginEur,
      eoyMarginPct: eoyMarginPct,
      ytdValue: ytdValue,
      ytdCost: ytdCost,
      avgValue: avgValue,
      avgCost: avgCost,
      avgHours: avgHours,
      avgUtilisation: avgUtilisation,
      avgBillableRate: avgBillableRate,
      avgCostRate: avgCostRate,
      stdDev: stdDev,
      optimisticValue: optimisticValue,
      pessimisticValue: pessimisticValue,
      trend: trend,
      trailingMonths: trailingMonths,
      monthsToForecast: monthsToForecast,
      year: yr,
      valueKey: valueKey
    };
  }

  function renderForecastSection(tabId, fc, valueLabel) {
    var section = document.getElementById("forecast-section-" + tabId);
    if (!fc || fc.monthsToForecast <= 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "block";

    // Store state for sliders
    _fcState[tabId] = { fc: fc, valueLabel: valueLabel, sliderOverride: false };

    // Year label
    document.getElementById("fc-year-" + tabId).textContent = fc.year;

    // Initialize sliders to trailing averages
    document.getElementById("slider-util-" + tabId).value = Math.round(fc.avgUtilisation);
    document.getElementById("slider-rate-" + tabId).value = Math.round(fc.avgBillableRate);
    document.getElementById("slider-hours-" + tabId).value = Math.round(fc.avgHours);

    // Render with default (trailing avg) values
    renderForecastDisplay(tabId, fc.eoyValue, fc.eoyCost, fc.eoyMarginEur, fc.eoyMarginPct,
      fc.avgUtilisation, fc.avgBillableRate, fc.avgHours, false);
  }

  function renderForecastDisplay(tabId, eoyVal, eoyCost, eoyMarginEur, eoyMarginPct, util, rate, hours, isSliderMode) {
    var state = _fcState[tabId];
    var fc = state.fc;
    var valueLabel = state.valueLabel;
    var marginColor = eoyMarginPct >= 0 ? C.profitPos : C.profitNeg;

    // KPIs
    var kpiHtml = '<div class="fc-kpi"><div class="fc-kpi-label">EOY ' + valueLabel + '</div><div class="fc-kpi-value" style="color:' + C.revenue + '">' + u.fmtEur(eoyVal) + '</div><div class="fc-kpi-sub">YTD ' + u.fmtEur(fc.ytdValue) + ' + ' + fc.monthsToForecast + ' months forecast</div></div>';
    kpiHtml += '<div class="fc-kpi"><div class="fc-kpi-label">EOY Staff Cost</div><div class="fc-kpi-value" style="color:' + C.cost + '">' + u.fmtEur(eoyCost) + '</div><div class="fc-kpi-sub">' + u.fmtEur(fc.avgCost) + '/month avg</div></div>';
    kpiHtml += '<div class="fc-kpi"><div class="fc-kpi-label">EOY Gross Margin</div><div class="fc-kpi-value" style="color:' + marginColor + '">' + u.fmtEur(eoyMarginEur) + '</div><div class="fc-kpi-sub">' + valueLabel + ' minus staff cost</div></div>';
    kpiHtml += '<div class="fc-kpi"><div class="fc-kpi-label">Margin %</div><div class="fc-kpi-value" style="color:' + marginColor + '">' + eoyMarginPct.toFixed(1) + '%</div><div class="fc-kpi-sub">' + (eoyMarginPct >= 5 ? 'Healthy' : eoyMarginPct >= 0 ? 'Tight' : 'Negative') + '</div></div>';

    // Budget comparison KPI if available
    var budgetRevForYear = 0;
    if (D.DATA.budget_monthly && D.DATA.budget_monthly.length > 0) {
      D.DATA.budget_monthly.forEach(function(bm) {
        if (bm.month && bm.month.substring(0,4) === fc.year) budgetRevForYear += (bm.budget_revenue || 0);
      });
      if (budgetRevForYear > 0) {
        var budgetDelta = eoyVal - budgetRevForYear;
        var budgetDeltaPct = (budgetDelta / budgetRevForYear * 100).toFixed(1);
        var bdColor = budgetDelta >= 0 ? C.profitPos : C.profitNeg;
        kpiHtml += '<div class="fc-kpi"><div class="fc-kpi-label">vs Budget</div><div class="fc-kpi-value" style="color:' + bdColor + '">' + (budgetDelta >= 0 ? '+' : '') + budgetDeltaPct + '%</div><div class="fc-kpi-sub">Budget: ' + u.fmtEur(budgetRevForYear) + '</div></div>';
      }
    }

    document.getElementById("forecast-kpis-" + tabId).innerHTML = kpiHtml;

    // Slider value labels
    document.getElementById("slider-util-val-" + tabId).textContent = Math.round(util) + "%";
    document.getElementById("slider-rate-val-" + tabId).textContent = "\u20AC" + Math.round(rate) + "/hr";
    document.getElementById("slider-hours-val-" + tabId).textContent = Math.round(hours) + " hrs/month";

    // Scenarios
    var scenHtml = '<div class="scenario-label" style="color:#E74C3C">Pessimistic<br>' + u.fmtEur(fc.pessimisticValue) + '</div>';
    scenHtml += '<div class="scenario-bar"><div class="scenario-bar-fill" style="width:100%"></div>';
    var range = fc.optimisticValue - fc.pessimisticValue;
    var basePos = range > 0 ? ((eoyVal - fc.pessimisticValue) / range * 100) : 50;
    scenHtml += '<div class="scenario-bar-marker" style="left:' + Math.max(0, Math.min(97, basePos)) + '%"></div></div>';
    scenHtml += '<div class="scenario-label" style="color:#27AE60">Optimistic<br>' + u.fmtEur(fc.optimisticValue) + '</div>';
    document.getElementById("forecast-scenarios-" + tabId).innerHTML = scenHtml;

    // Narrative
    var trendBadge = '<span class="trend-badge ' + fc.trend.direction + '">' +
      (fc.trend.direction === "improving" ? "+" : "") + fc.trend.changePct + '% ' + fc.trend.direction + '</span>';

    var monthlyRevFromDrivers = hours * (util / 100) * rate;
    var utilImpactPerPct = hours * (1 / 100) * rate * fc.monthsToForecast;

    var narr = 'At ' + (isSliderMode ? 'the selected' : 'current') + ' pace, LeadStreet is projected to reach <strong>' + u.fmtEur(eoyVal) + '</strong> in ' + valueLabel.toLowerCase() + ' by end of ' + fc.year + ', with a gross margin of <strong>' + eoyMarginPct.toFixed(1) + '%</strong> (' + u.fmtEur(eoyMarginEur) + ').';
    narr += ' The 3-month trend is ' + trendBadge + '.';
    narr += ' At current utilisation of ' + Math.round(util) + '%, each percentage point improvement adds ~<strong>' + u.fmtEur(utilImpactPerPct) + '</strong> to EOY ' + valueLabel.toLowerCase() + '.';
    if (isSliderMode) {
      narr += '<br><em>Slider mode: monthly ' + valueLabel.toLowerCase() + ' = ' + Math.round(hours) + ' hrs &times; ' + Math.round(util) + '% util &times; \u20AC' + Math.round(rate) + '/hr = <strong>' + u.fmtEur(monthlyRevFromDrivers) + '/month</strong></em>';
    }
    document.getElementById("forecast-narrative-" + tabId).innerHTML = narr;

    // Methodology
    var method = '';
    if (!isSliderMode) {
      method += '<strong>How this forecast works</strong><br><br>';
      method += 'We look at the last 3 <strong>fully completed</strong> months (' + fc.trailingMonths.join(", ") + ') and calculate averages. The current month is excluded because not all time entries, invoices, and revenue recognition are finalised until a month closes.';
      method += '<ul style="margin:6px 0 6px 18px">';
      method += '<li>Average monthly ' + valueLabel.toLowerCase() + ': <strong>' + u.fmtEur(fc.avgValue) + '</strong>/month</li>';
      method += '<li>Average monthly staff cost: <strong>' + u.fmtEur(fc.avgCost) + '</strong>/month</li>';
      method += '<li>Average monthly hours: <strong>' + Math.round(fc.avgHours) + '</strong> hours/month</li>';
      method += '<li>Average utilisation: <strong>' + fc.avgUtilisation.toFixed(1) + '%</strong> (billable hours / total hours)</li>';
      method += '<li>Average billable rate: <strong>\u20AC' + Math.round(fc.avgBillableRate) + '</strong>/hour (' + valueLabel.toLowerCase() + ' / billable hours)</li>';
      method += '</ul>';
      method += '<div class="formula">EOY ' + valueLabel + ' = Actual YTD (' + u.fmtEur(fc.ytdValue) + ') + ' + fc.monthsToForecast + ' months \u00D7 ' + u.fmtEur(fc.avgValue) + '/month = <strong>' + u.fmtEur(fc.eoyValue) + '</strong></div>';
      method += 'This is a straight-line projection. It assumes the next ' + fc.monthsToForecast + ' months will perform the same as the last 3. It does <strong>not</strong> account for seasonality, new hires, lost clients, or pipeline changes.';
      method += '<br><br><strong>Scenario ranges</strong><br>The optimistic/pessimistic range uses \u00B11 standard deviation (\u20AC' + u.fmtEur(fc.stdDev) + '/month) of the last 3 months. The wider the range, the less predictable recent performance has been.';
    } else {
      method += '<strong>Driver-based mode (sliders active)</strong><br><br>';
      method += 'Instead of the trailing average, you are manually setting the drivers:';
      method += '<ul style="margin:6px 0 6px 18px">';
      method += '<li><strong>Monthly hours</strong>: ' + Math.round(hours) + ' (total hours worked by the team)</li>';
      method += '<li><strong>Utilisation</strong>: ' + Math.round(util) + '% (what % of hours are billable)</li>';
      method += '<li><strong>Billable rate</strong>: \u20AC' + Math.round(rate) + '/hr (' + valueLabel.toLowerCase() + ' per billable hour)</li>';
      method += '</ul>';
      method += '<div class="formula">Monthly ' + valueLabel + ' = Hours \u00D7 Utilisation% \u00D7 Rate<br>';
      method += Math.round(hours) + ' \u00D7 ' + Math.round(util) + '% \u00D7 \u20AC' + Math.round(rate) + ' = <strong>' + u.fmtEur(monthlyRevFromDrivers) + '/month</strong></div>';
      method += 'Staff cost stays at the trailing 3-month average (' + u.fmtEur(fc.avgCost) + '/month) since it does not change with billability.';
      method += '<div class="formula">EOY ' + valueLabel + ' = Actual YTD (' + u.fmtEur(fc.ytdValue) + ') + ' + fc.monthsToForecast + ' months \u00D7 ' + u.fmtEur(monthlyRevFromDrivers) + '/month = <strong>' + u.fmtEur(eoyVal) + '</strong></div>';
    }
    document.getElementById("forecast-method-" + tabId).innerHTML = method;

    // Chart
    renderForecastChart(tabId, eoyVal, isSliderMode ? (hours * util / 100 * rate) : fc.avgValue, fc.avgCost, isSliderMode);
  }

  function renderForecastChart(tabId, eoyVal, monthlyFcValue, monthlyFcCost, isSliderMode) {
    var state = _fcState[tabId];
    var fc = state.fc;
    var chartId = tabId === "rec" ? "chart-fin-forecast" : (tabId === "exec" ? "chart-exec-forecast" : "chart-fin-forecast-inv");

    var allMonths = fc.actuals.concat(fc.forecasts.map(function(f) {
      return { month: f.month, value: isSliderMode ? monthlyFcValue : f.value, cost: isSliderMode ? monthlyFcCost : f.cost, forecast: true };
    }));

    // Build flat data for D3 verticalBar: each row has actual_rev, fc_rev, actual_cost, fc_cost, cumulative
    var running = 0;
    var barData = allMonths.map(function(r) {
      running += r.value;
      return {
        month: r.month,
        actual_rev: !r.forecast ? r.value : 0,
        fc_rev: r.forecast ? r.value : 0,
        actual_cost: !r.forecast ? r.cost : 0,
        fc_cost: r.forecast ? r.cost : 0,
        cumulative: running,
        _forecast: r.forecast,
        _value: r.value,
        _cost: r.cost
      };
    });

    // Budget data lookup
    var budgetByMonth = {};
    var budgetCumByMonth = {};
    if (D.DATA.budget_monthly && D.DATA.budget_monthly.length > 0) {
      var budgetRunning = 0;
      allMonths.forEach(function(r) {
        var bm = D.DATA.budget_monthly.filter(function(b) { return b.month && b.month.substring(0,7) === r.month.substring(0,7); });
        if (bm.length > 0) {
          budgetByMonth[r.month] = { rev: bm[0].budget_revenue || 0, cost: bm[0].budget_people_cost || 0 };
          budgetRunning += (bm[0].budget_revenue || 0);
          budgetCumByMonth[r.month] = budgetRunning;
        }
      });
    }

    // Enrich barData with budget fields
    barData.forEach(function(d) {
      var bm = budgetByMonth[d.month];
      d.budget_rev = bm ? bm.rev : null;
      d.budget_cost = bm ? bm.cost : null;
      d.budget_cum = budgetCumByMonth[d.month] || null;
    });

    var revColor = tabId === "inv" ? "#8E44AD" : C.revenue;
    var maxCum = Math.max.apply(null, barData.map(function(d) { return d.cumulative; }));
    var eoyAnnotationText = "EOY: " + u.fmtEur(barData[barData.length - 1].cumulative);

    // Build series for grouped bars (actuals + forecast for revenue and cost)
    var series = [
      { field: "actual_rev", label: state.valueLabel, color: revColor, opacity: 0.8 },
      { field: "fc_rev", label: state.valueLabel + " (Forecast)", color: revColor, opacity: 0.35 },
      { field: "actual_cost", label: "Staff Cost", color: C.cost, opacity: 0.8 },
      { field: "fc_cost", label: "Cost (Forecast)", color: C.cost, opacity: 0.35 }
    ];

    // Build line overlays
    var lines = [
      { field: "cumulative", label: "Cumulative " + state.valueLabel, color: "#2C3E50", dash: "4,3" }
    ];
    if (Object.keys(budgetByMonth).length > 0) {
      lines.push({ field: "budget_rev", label: "Budget Revenue", color: C.budget, dash: "6,3" });
      lines.push({ field: "budget_cum", label: "Budget (Cumulative)", color: C.budget, dash: "4,3" });
    }

    d3c.verticalBar(chartId, barData, {
      xField: "month",
      series: series,
      barMode: "group",
      lines: lines,
      tooltipFn: function(d) {
        var html = "<div style='font-weight:600;margin-bottom:4px'>" + d.month + "</div>";
        html += "<div style='display:grid;grid-template-columns:auto auto;gap:2px 12px;color:#5F6B7A'>";
        if (d._forecast) {
          html += "<span>" + state.valueLabel + " (fc)</span><span style='font-weight:600'>" + d3c.fmtEur(d._value) + "</span>";
          html += "<span>Cost (fc)</span><span style='font-weight:600'>" + d3c.fmtEur(d._cost) + "</span>";
        } else {
          html += "<span>" + state.valueLabel + "</span><span style='font-weight:600'>" + d3c.fmtEur(d._value) + "</span>";
          html += "<span>Staff Cost</span><span style='font-weight:600'>" + d3c.fmtEur(d._cost) + "</span>";
        }
        html += "<span>Cumulative</span><span style='font-weight:600'>" + d3c.fmtEur(d.cumulative) + "</span>";
        if (d.budget_rev != null) {
          html += "<span>Budget Rev</span><span>" + d3c.fmtEur(d.budget_rev) + "</span>";
        }
        if (d.budget_cum != null) {
          html += "<span>Budget Cum</span><span>" + d3c.fmtEur(d.budget_cum) + "</span>";
        }
        html += "</div>";
        return html;
      },
      yFormat: function(d) { return "\u20AC" + d3c.fmtNum(d); },
      yLabel: "EUR/month",
      margin: { top: 16, right: 60, bottom: 44, left: 70 },
      height: 380
    });
  }

  function updateForecastFromSliders(tabId) {
    var state = _fcState[tabId];
    if (!state) return;
    var fc = state.fc;

    var util = parseFloat(document.getElementById("slider-util-" + tabId).value);
    var rate = parseFloat(document.getElementById("slider-rate-" + tabId).value);
    var hours = parseFloat(document.getElementById("slider-hours-" + tabId).value);

    var monthlyRev = hours * (util / 100) * rate;
    var monthlyCost = fc.avgCost;
    var eoyVal = fc.ytdValue + monthlyRev * fc.monthsToForecast;
    var eoyCost = fc.ytdCost + monthlyCost * fc.monthsToForecast;
    var eoyMarginEur = eoyVal - eoyCost;
    var eoyMarginPct = eoyVal > 0 ? (eoyMarginEur / eoyVal * 100) : 0;

    state.sliderOverride = true;
    renderForecastDisplay(tabId, eoyVal, eoyCost, eoyMarginEur, eoyMarginPct, util, rate, hours, true);
  }

  function resetForecastSliders(tabId) {
    var state = _fcState[tabId];
    if (!state) return;
    var fc = state.fc;

    document.getElementById("slider-util-" + tabId).value = Math.round(fc.avgUtilisation);
    document.getElementById("slider-rate-" + tabId).value = Math.round(fc.avgBillableRate);
    document.getElementById("slider-hours-" + tabId).value = Math.round(fc.avgHours);

    state.sliderOverride = false;
    renderForecastDisplay(tabId, fc.eoyValue, fc.eoyCost, fc.eoyMarginEur, fc.eoyMarginPct,
      fc.avgUtilisation, fc.avgBillableRate, fc.avgHours, false);
  }

  function toggleForecastInfo(tabId) {
    var el = document.getElementById("forecast-method-" + tabId);
    var btn = document.getElementById("fc-info-btn-" + tabId);
    if (el.style.display === "none") {
      el.style.display = "block";
      btn.textContent = "Hide methodology";
    } else {
      el.style.display = "none";
      btn.textContent = "How is this calculated?";
    }
  }

  // Functions called from HTML onclick must be global
  window.updateForecastFromSliders = updateForecastFromSliders;
  window.resetForecastSliders = resetForecastSliders;
  window.toggleForecastInfo = toggleForecastInfo;

  // Expose to Dashboard for use by section files
  D.forecast = {
    compute: computeForecast,
    renderSection: renderForecastSection,
    renderDisplay: renderForecastDisplay,
    renderChart: renderForecastChart,
    getState: function() { return _fcState; }
  };
})(window.Dashboard);
