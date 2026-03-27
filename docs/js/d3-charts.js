// ============================================================
// d3-charts.js — Shared D3 chart library for LeadStreet BI
// Provides reusable renderers: horizontalBar, verticalBar,
// verticalBarLine, lineTrend, waterfall, heatmap, scatter, pareto
// ============================================================

(function(D) {
  "use strict";

  var C = D.C;
  var FONT = "Inter, -apple-system, sans-serif";
  var GRID_COLOR = "#F0F2F5";
  var AXIS_COLOR = "#E4E7EC";
  var LABEL_COLOR = "#5F6B7A";
  var MUTED_COLOR = "#94A3B8";
  var TEXT_PRIMARY = "#1A1D21";

  // === RESIZE REGISTRY ===
  var _registry = {};  // containerId -> {renderFn, lastData, lastWidth, lastOpts}

  window.addEventListener("resize", function() {
    Object.keys(_registry).forEach(function(id) {
      var entry = _registry[id];
      var container = document.getElementById(id);
      if (!container) return;
      var newWidth = container.clientWidth;
      if (newWidth > 100 && newWidth !== entry.lastWidth) {
        entry.renderFn(id, entry.lastData, entry.lastOpts);
      }
    });
  });

  function registerResize(containerId, renderFn, data, opts) {
    _registry[containerId] = {
      renderFn: renderFn,
      lastData: data,
      lastWidth: _getWidth(containerId),
      lastOpts: opts
    };
  }

  function updateResizeWidth(containerId, width) {
    if (_registry[containerId]) _registry[containerId].lastWidth = width;
  }

  // === SVG HELPERS ===
  function _getWidth(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return 800;
    var w = el.clientWidth;
    if (!w || w < 100) {
      var main = document.querySelector(".main");
      w = (main ? main.clientWidth : 900) - 60;
    }
    return w;
  }

  function createSvg(containerId, margin, height) {
    var container = document.getElementById(containerId);
    if (!container) return null;
    container.innerHTML = "";
    container.style.position = "relative";

    var width = _getWidth(containerId);
    container.style.height = Math.max(280, height) + "px";

    var svg = d3.select(container).append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("overflow", "visible");

    var defs = svg.append("defs");

    // Shared glow filter
    var glowId = "glow-" + containerId;
    var glow = defs.append("filter").attr("id", glowId)
      .attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    var merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    var innerW = width - margin.left - margin.right;
    var innerH = height - margin.top - margin.bottom;

    updateResizeWidth(containerId, width);

    return {
      container: container,
      svg: svg,
      defs: defs,
      g: g,
      width: width,
      innerW: innerW,
      innerH: innerH,
      glowId: glowId
    };
  }

  function createTooltip(container) {
    return d3.select(container).append("div")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "rgba(255,255,255,0.97)")
      .style("border", "1px solid #E5E7EB")
      .style("border-radius", "8px")
      .style("padding", "10px 14px")
      .style("font-family", FONT)
      .style("font-size", "12px")
      .style("color", TEXT_PRIMARY)
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.1)")
      .style("opacity", 0)
      .style("z-index", 10)
      .style("transition", "opacity 0.15s ease")
      .style("max-width", "320px");
  }

  function positionTooltip(tooltip, container, event) {
    var rect = container.getBoundingClientRect();
    var x = event.clientX - rect.left + 16;
    var y = event.clientY - rect.top - 10;
    // Flip tooltip left if it would overflow
    if (x + 200 > rect.width) x = event.clientX - rect.left - 220;
    tooltip.style("left", x + "px").style("top", y + "px");
  }

  function addGridLines(g, scale, innerH, direction) {
    var ticks = scale.ticks ? scale.ticks(6) : scale.domain();
    if (direction === "vertical") {
      g.append("g").attr("class", "grid").selectAll("line").data(ticks)
        .enter().append("line")
        .attr("x1", function(d){ return scale(d); })
        .attr("x2", function(d){ return scale(d); })
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", GRID_COLOR).attr("stroke-width", 1);
    } else {
      g.append("g").attr("class", "grid").selectAll("line").data(ticks)
        .enter().append("line")
        .attr("y1", function(d){ return scale(d); })
        .attr("y2", function(d){ return scale(d); })
        .attr("x1", 0).attr("x2", function(){ return arguments.length; }) // placeholder
        .attr("stroke", GRID_COLOR).attr("stroke-width", 1);
    }
  }

  function styleAxis(axisG) {
    axisG.select(".domain").attr("stroke", AXIS_COLOR);
    axisG.selectAll(".tick line").attr("stroke", AXIS_COLOR);
    axisG.selectAll(".tick text").attr("fill", LABEL_COLOR).attr("font-size", "10px").attr("font-family", FONT);
  }

  function styleXAxis(axisG) {
    styleAxis(axisG);
    axisG.classed("d3-x-axis", true);
  }

  function addRefLine(g, x, y1, y2, opts) {
    g.append("line")
      .attr("x1", x).attr("x2", x)
      .attr("y1", y1).attr("y2", y2)
      .attr("stroke", opts.color || MUTED_COLOR)
      .attr("stroke-width", opts.width || 1.5)
      .attr("stroke-dasharray", opts.dash || "4,3")
      .attr("opacity", opts.opacity || 0.7);
    if (opts.label) {
      g.append("text")
        .attr("x", x).attr("y", y1 - 4)
        .attr("text-anchor", "middle")
        .attr("fill", opts.color || MUTED_COLOR)
        .attr("font-size", "10px").attr("font-family", FONT)
        .text(opts.label);
    }
  }

  // Standard gradient for horizontal bar (left-to-right fade)
  function addBarGradient(defs, id, color, direction) {
    var isH = direction !== "vertical";
    var grad = defs.append("linearGradient").attr("id", id)
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", isH ? "100%" : "0%").attr("y2", isH ? "0%" : "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.15);
    grad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.7);
    return id;
  }

  // Pick a color based on threshold comparison
  function thresholdColor(value, target, colors) {
    if (!colors) colors = {good: "#10b981", warn: "#f59e0b", bad: "#ef4444"};
    if (value >= target) return colors.good;
    if (value >= target * 0.6) return colors.warn;
    return colors.bad;
  }

  function thresholdColorDark(value, target) {
    if (value >= target) return "#059669";
    if (value >= target * 0.6) return "#d97706";
    return "#dc2626";
  }

  // Truncate label
  function truncate(text, maxLen) {
    if (!maxLen) maxLen = 22;
    return text && text.length > maxLen ? text.substring(0, maxLen - 2) + "..." : (text || "");
  }

  // Format helpers (mirror D.utils but available locally)
  function fmtNum(n) { return n != null ? n.toLocaleString("en", {maximumFractionDigits: 0}) : "0"; }
  function fmtEur(n) { return "€" + fmtNum(n); }
  function fmtPct(n) { return (n != null ? n.toFixed(1) : "0") + "%"; }

  // ================================================================
  //  HORIZONTAL BAR CHART
  //  The workhorse chart: sorted horizontal bars with optional
  //  gradient fills, target diamonds, reference lines, click handlers
  // ================================================================
  function horizontalBar(containerId, data, opts) {
    /*
      opts: {
        yField:       string — field name for bar labels
        xField:       string — field name for bar values
        colorFn:      function(d) -> hex color string (for gradient + stroke)
        labelFn:      function(d) -> string (value label text, e.g. "€148")
        tooltipFn:    function(d) -> HTML string
        onClick:      function(d) -> void (click handler per bar)
        target:       number|null — vertical target line value
        targetLabel:  string — label for target line (e.g. "target €112")
        targetColor:  string — color for target line + diamonds
        showDiamonds: bool — show diamond markers at target value
        avg:          number|null — vertical average line value
        avgLabel:     string — label for avg line (e.g. "avg €81")
        xLabel:       string — x-axis label
        xFormat:      function(d) -> string — x-axis tick formatter
        margin:       {top, right, bottom, left}
        barHeight:    number (default 32)
        maxLabelLen:  number (default 22)
        animate:      bool (default true)
      }
    */
    if (!data || !data.length) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "<div style='padding:40px;color:#94A3B8;text-align:center;font-size:12px'>No data</div>";
      return;
    }

    opts = opts || {};
    var yField = opts.yField || "label";
    var xField = opts.xField || "value";
    var isMobile = window.innerWidth <= 768;
    var margin = opts.margin || {top: 24, right: 70, bottom: 36, left: 150};
    if (isMobile) { margin = {top: 16, right: 40, bottom: 28, left: 10}; }
    var barH = opts.barHeight || 32;
    var barGap = isMobile ? 20 : 8;
    var animate = opts.animate !== false;
    var maxLabel = isMobile ? 0 : (opts.maxLabelLen || 22);

    var height = margin.top + margin.bottom + data.length * (barH + barGap);
    var ctx = createSvg(containerId, margin, height);
    if (!ctx) return;

    var g = ctx.g;
    var innerW = ctx.innerW;
    var innerH = data.length * (barH + barGap);

    var minVal = d3.min(data, function(d){ return d[xField]; });
    var maxVal = d3.max(data, function(d){ return d[xField]; }) * 1.15;
    if (opts.target && opts.target > maxVal / 1.15) maxVal = opts.target * 1.2;
    var domainMin = minVal < 0 ? minVal * 1.15 : 0;

    var x = d3.scaleLinear().domain([domainMin, maxVal]).range([0, innerW]);
    var y = d3.scaleBand()
      .domain(data.map(function(d){ return d[yField]; }))
      .range([innerH, 0])
      .padding(0.2);

    // Grid
    addGridLines(g, x, innerH, "vertical");

    // Reference lines
    if (opts.avg != null) {
      addRefLine(g, x(opts.avg), -8, innerH, {
        color: MUTED_COLOR, dash: "4,3", label: opts.avgLabel || ("avg " + Math.round(opts.avg))
      });
    }
    if (opts.target != null && x(opts.target) <= innerW) {
      addRefLine(g, x(opts.target), -4, innerH, {
        color: opts.targetColor || C.budget, dash: "6,3", opacity: 0.5,
        label: opts.targetLabel || ("target " + Math.round(opts.target))
      });
    }

    // Gradients
    var colorFn = opts.colorFn || function(){ return "#64748b"; };
    data.forEach(function(d, i) {
      addBarGradient(ctx.defs, containerId + "-grad-" + i, colorFn(d), "horizontal");
    });

    // Tooltip
    var tooltip = createTooltip(ctx.container);
    var tooltipFn = opts.tooltipFn || function(d) {
      return "<b>" + d[yField] + "</b><br>" + (opts.xLabel || xField) + ": " + d[xField].toFixed(0);
    };

    // Zero baseline (only draw if domain includes negatives)
    var hasNeg = domainMin < 0;
    if (hasNeg) {
      g.append("line")
        .attr("x1", x(0)).attr("x2", x(0))
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", "#94A3B8").attr("stroke-width", 1);
    }

    // Bars
    var bars = g.selectAll(".d3-hbar")
      .data(data)
      .enter().append("rect")
        .attr("class", "d3-hbar")
        .attr("y", function(d){ return y(d[yField]); })
        .attr("height", y.bandwidth())
        .attr("x", function(d){ return hasNeg ? x(Math.min(0, d[xField])) : x(0); })
        .attr("width", 0)
        .attr("rx", 4).attr("ry", 4)
        .attr("fill", function(d, i){ return "url(#" + containerId + "-grad-" + i + ")"; })
        .attr("stroke", function(d){ return colorFn(d); })
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.6)
        .style("cursor", opts.onClick ? "pointer" : "default");

    // Hover + click binding function (reused after animation and for non-animated)
    function bindHoverAndClick(selection) {
      selection
        .on("mouseover", function(event, d) {
          d3.select(this).transition().duration(150)
            .attr("stroke-opacity", 1).attr("stroke-width", 2.5)
            .style("filter", "url(#" + ctx.glowId + ")");
          tooltip.html(tooltipFn(d)).style("opacity", 1);
        })
        .on("mousemove", function(event) { positionTooltip(tooltip, ctx.container, event); })
        .on("mouseout", function() {
          d3.select(this).transition().duration(200)
            .attr("stroke-opacity", 0.6).attr("stroke-width", 1.5)
            .style("filter", "none");
          tooltip.style("opacity", 0);
        });
      if (opts.onClick) {
        selection.on("click", function(event, d) { opts.onClick(d); });
      }
    }

    // Bar width helper: distance from zero baseline
    function barWidth(d) {
      return Math.max(0, Math.abs(x(d[xField]) - x(0)));
    }

    // Animate, then bind hover after animation completes
    if (animate) {
      bars.transition()
        .duration(700)
        .delay(function(d, i){ return i * 40; })
        .ease(d3.easeCubicOut)
        .attr("width", barWidth)
        .on("end", function() { bindHoverAndClick(d3.select(this)); });
    } else {
      bars.attr("width", barWidth);
      bindHoverAndClick(bars);
    }

    // Target diamonds
    if (opts.showDiamonds && opts.target != null) {
      g.selectAll(".target-diamond")
        .data(data)
        .enter().append("path")
          .attr("d", d3.symbol().type(d3.symbolDiamond).size(64))
          .attr("transform", function(d){
            return "translate(" + x(opts.target) + "," + (y(d[yField]) + y.bandwidth()/2) + ")";
          })
          .attr("fill", opts.targetColor || C.budget)
          .attr("stroke", "#fff").attr("stroke-width", 1.2)
          .attr("opacity", 0)
        .transition()
          .duration(400)
          .delay(function(d, i){ return animate ? (400 + i * 40) : 0; })
          .attr("opacity", 0.85);
    }

    // Value labels
    var labelFn = opts.labelFn || function(d){ return Math.round(d[xField]); };
    var labelColorFn = opts.labelColorFn || function(d){ return colorFn(d); };
    g.selectAll(".val-label")
      .data(data)
      .enter().append("text")
        .attr("x", function(d){
          var val = d[xField];
          if (val < 0) return x(val) - 8;
          return x(val) + 8;
        })
        .attr("y", function(d){ return y(d[yField]) + y.bandwidth()/2; })
        .attr("dy", "0.35em")
        .attr("text-anchor", function(d){ return d[xField] < 0 ? "end" : "start"; })
        .attr("fill", function(d){ return labelColorFn(d); })
        .attr("font-size", isMobile ? "10px" : "12px").attr("font-weight", "600")
        .attr("font-family", FONT)
        .attr("opacity", 0)
        .text(function(d){ return labelFn(d); })
      .transition()
        .duration(400)
        .delay(function(d, i){ return animate ? (500 + i * 40) : 0; })
        .attr("opacity", 1);

    // Y-axis labels
    if (isMobile) {
      // On mobile: label above each bar, left-aligned
      g.selectAll(".y-label")
        .data(data)
        .enter().append("text")
          .attr("x", 0)
          .attr("y", function(d){ return y(d[yField]) - 2; })
          .attr("text-anchor", "start")
          .attr("fill", LABEL_COLOR).attr("font-size", "9px").attr("font-family", FONT)
          .text(function(d){ return truncate(d[yField], 30); })
          .append("title").text(function(d){ return d[yField]; });
    } else {
      g.selectAll(".y-label")
        .data(data)
        .enter().append("text")
          .attr("x", -8)
          .attr("y", function(d){ return y(d[yField]) + y.bandwidth()/2; })
          .attr("dy", "0.35em")
          .attr("text-anchor", "end")
          .attr("fill", LABEL_COLOR).attr("font-size", "11px").attr("font-family", FONT)
          .text(function(d){ return truncate(d[yField], maxLabel); })
          .append("title").text(function(d){ return d[yField]; });
    }

    // X-axis
    var xAxis = d3.axisBottom(x).ticks(6);
    if (opts.xFormat) xAxis.tickFormat(opts.xFormat);
    g.append("g")
      .attr("transform", "translate(0," + innerH + ")")
      .call(xAxis)
      .call(styleXAxis);

    if (opts.xLabel) {
      g.append("text")
        .attr("x", innerW / 2).attr("y", innerH + 30)
        .attr("text-anchor", "middle")
        .attr("fill", MUTED_COLOR).attr("font-size", "10px").attr("font-family", FONT)
        .text(opts.xLabel);
    }

    registerResize(containerId, horizontalBar, data, opts);
  }

  // ================================================================
  //  STACKED HORIZONTAL BAR CHART
  //  Two or more series stacked horizontally per category
  // ================================================================
  function stackedHorizontalBar(containerId, data, opts) {
    /*
      opts: {
        yField:     string — category label field
        series:     [{field, label, color}] — stack layers
        tooltipFn:  function(d) -> HTML
        onClick:    function(d) -> void
        xLabel:     string
        xFormat:    function(d) -> string
        margin:     object
        barHeight:  number
      }
    */
    if (!data || !data.length) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "<div style='padding:40px;color:#94A3B8;text-align:center;font-size:12px'>No data</div>";
      return;
    }
    opts = opts || {};
    var yField = opts.yField || "label";
    var series = opts.series || [];
    var margin = opts.margin || {top: 24, right: 70, bottom: 36, left: 150};
    var barH = opts.barHeight || 32;
    var barGap = 8;

    var height = margin.top + margin.bottom + data.length * (barH + barGap);
    var ctx = createSvg(containerId, margin, height);
    if (!ctx) return;

    var g = ctx.g;
    var innerW = ctx.innerW;
    var innerH = data.length * (barH + barGap);

    var maxVal = d3.max(data, function(d) {
      return series.reduce(function(s, sr){ return s + (d[sr.field] || 0); }, 0);
    }) * 1.1;

    var x = d3.scaleLinear().domain([0, maxVal]).range([0, innerW]);
    var y = d3.scaleBand()
      .domain(data.map(function(d){ return d[yField]; }))
      .range([innerH, 0])
      .padding(0.2);

    addGridLines(g, x, innerH, "vertical");
    var tooltip = createTooltip(ctx.container);
    var tooltipFn = opts.tooltipFn || function(d){ return "<b>" + d[yField] + "</b>"; };

    // Draw stacked segments
    series.forEach(function(sr, si) {
      var cumField = "_cum_" + si;
      data.forEach(function(d) {
        d[cumField] = 0;
        for (var j = 0; j < si; j++) d[cumField] += (d[series[j].field] || 0);
      });

      g.selectAll(".stack-" + si)
        .data(data)
        .enter().append("rect")
          .attr("class", "stack-" + si)
          .attr("y", function(d){ return y(d[yField]); })
          .attr("height", y.bandwidth())
          .attr("x", function(d){ return x(d[cumField]); })
          .attr("width", 0)
          .attr("rx", si === series.length - 1 ? 4 : 0)
          .attr("fill", sr.color)
          .attr("fill-opacity", 0.65)
          .attr("stroke", sr.color)
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.4)
          .style("cursor", opts.onClick ? "pointer" : "default")
        .on("mouseover", function(event, d) {
          d3.select(this).transition().duration(150).attr("fill-opacity", 0.9);
          tooltip.html(tooltipFn(d)).style("opacity", 1);
        })
        .on("mousemove", function(event) { positionTooltip(tooltip, ctx.container, event); })
        .on("mouseout", function() {
          d3.select(this).transition().duration(200).attr("fill-opacity", 0.65);
          tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) { if (opts.onClick) opts.onClick(d); })
        .transition()
          .duration(700)
          .delay(function(d, i){ return i * 40; })
          .ease(d3.easeCubicOut)
          .attr("width", function(d){ return Math.max(0, x(d[sr.field] || 0)); });
    });

    // Y-axis labels
    g.selectAll(".y-label")
      .data(data)
      .enter().append("text")
        .attr("x", -8)
        .attr("y", function(d){ return y(d[yField]) + y.bandwidth()/2; })
        .attr("dy", "0.35em").attr("text-anchor", "end")
        .attr("fill", LABEL_COLOR).attr("font-size", "11px").attr("font-family", FONT)
        .text(function(d){ return truncate(d[yField], opts.maxLabelLen || 22); });

    // End-of-bar labels (e.g. percentage)
    if (opts.labelFn) {
      g.selectAll(".bar-end-label")
        .data(data)
        .enter().append("text")
          .attr("class", "bar-end-label")
          .attr("y", function(d){ return y(d[yField]) + y.bandwidth()/2; })
          .attr("dy", "0.35em").attr("text-anchor", "start")
          .attr("fill", LABEL_COLOR).attr("font-size", "11px").attr("font-weight", "600").attr("font-family", FONT)
          .text(function(d){ return opts.labelFn(d); })
          .attr("x", function(d){
            var total = series.reduce(function(s, sr){ return s + (d[sr.field] || 0); }, 0);
            return x(total) + 6;
          });
    }

    // X-axis
    var xAxis = d3.axisBottom(x).ticks(6);
    if (opts.xFormat) xAxis.tickFormat(opts.xFormat);
    g.append("g").attr("transform", "translate(0," + innerH + ")").call(xAxis).call(styleXAxis);

    if (opts.xLabel) {
      g.append("text").attr("x", innerW/2).attr("y", innerH + 30)
        .attr("text-anchor", "middle").attr("fill", MUTED_COLOR).attr("font-size", "10px").attr("font-family", FONT)
        .text(opts.xLabel);
    }

    // Legend
    var legend = g.append("g").attr("transform", "translate(0," + (-16) + ")");
    var lx = 0;
    series.forEach(function(sr) {
      legend.append("rect").attr("x", lx).attr("y", 0).attr("width", 10).attr("height", 10)
        .attr("rx", 2).attr("fill", sr.color).attr("fill-opacity", 0.7);
      legend.append("text").attr("x", lx + 14).attr("y", 9)
        .attr("fill", LABEL_COLOR).attr("font-size", "10px").attr("font-family", FONT)
        .text(sr.label);
      lx += sr.label.length * 6.5 + 24;
    });

    registerResize(containerId, stackedHorizontalBar, data, opts);
  }

  // ================================================================
  //  VERTICAL BAR CHART
  //  Monthly bars (single, grouped, or stacked) with optional line
  // ================================================================
  function verticalBar(containerId, data, opts) {
    /*
      opts: {
        xField:       string — category field (e.g. "month")
        series:       [{field, label, color, opacity}] — bar series
        barMode:      "group" | "stack" (default "group")
        line:         {field, label, color, dash, yAxis} — optional line overlay
        lines:        [{field, label, color, dash}] — multiple lines
        colorFn:      function(d, seriesIdx) -> color — per-bar color override
        tooltipFn:    function(d) -> HTML
        xFormat:      function(d) -> string
        yFormat:      function(d) -> string
        yLabel:       string
        xLabel:       string
        target:       number — horizontal target line
        targetLabel:  string
        annotations:  [{x, text, yShift}] — text below/above bars
        margin:       object
        height:       number
      }
    */
    if (!data || !data.length) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "<div style='padding:40px;color:#94A3B8;text-align:center;font-size:12px'>No data</div>";
      return;
    }
    opts = opts || {};
    var xField = opts.xField || "month";
    var series = opts.series || [{field: "value", label: "Value", color: C.revenue}];
    var barMode = opts.barMode || "group";
    var margin = opts.margin || {top: 16, right: 50, bottom: 44, left: 60};
    var totalHeight = opts.height || 350;

    var ctx = createSvg(containerId, margin, totalHeight);
    if (!ctx) return;

    var g = ctx.g;
    var innerW = ctx.innerW;
    var innerH = ctx.innerH;

    var categories = data.map(function(d){ return d[xField]; });

    // Compute y domain
    var yMin = 0, yMax = 0;
    if (barMode === "stack") {
      yMax = d3.max(data, function(d) {
        return series.reduce(function(s, sr){ return s + Math.max(0, d[sr.field] || 0); }, 0);
      });
      yMin = d3.min(data, function(d) {
        return series.reduce(function(s, sr){ return s + Math.min(0, d[sr.field] || 0); }, 0);
      });
    } else {
      series.forEach(function(sr) {
        var mx = d3.max(data, function(d){ return d[sr.field] || 0; });
        var mn = d3.min(data, function(d){ return d[sr.field] || 0; });
        if (mx > yMax) yMax = mx;
        if (mn < yMin) yMin = mn;
      });
    }
    // Include line values in domain
    var allLines = [];
    if (opts.line) allLines.push(opts.line);
    if (opts.lines) allLines = allLines.concat(opts.lines);
    allLines.forEach(function(ln) {
      data.forEach(function(d) {
        var v = d[ln.field];
        if (v != null) {
          if (v > yMax) yMax = v;
          if (v < yMin) yMin = v;
        }
      });
    });
    if (opts.target != null) {
      if (opts.target > yMax) yMax = opts.target;
      if (opts.target < yMin) yMin = opts.target;
    }
    yMax *= 1.1;
    if (yMin < 0) yMin *= 1.1;

    var x0 = d3.scaleBand().domain(categories).range([0, innerW]).padding(0.2);
    var x1 = barMode === "group" && series.length > 1
      ? d3.scaleBand().domain(series.map(function(s){ return s.field; })).range([0, x0.bandwidth()]).padding(0.08)
      : null;
    var yScale = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerH, 0]);

    // Grid
    var gridTicks = yScale.ticks(5);
    g.append("g").attr("class", "grid").selectAll("line").data(gridTicks)
      .enter().append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", function(d){ return yScale(d); })
      .attr("y2", function(d){ return yScale(d); })
      .attr("stroke", GRID_COLOR).attr("stroke-width", 1);

    // Target line
    if (opts.target != null) {
      g.append("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(opts.target)).attr("y2", yScale(opts.target))
        .attr("stroke", C.budget).attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6,3").attr("opacity", 0.6);
      if (opts.targetLabel) {
        g.append("text")
          .attr("x", innerW + 4).attr("y", yScale(opts.target))
          .attr("dy", "0.35em").attr("fill", C.budget)
          .attr("font-size", "9px").attr("font-family", FONT)
          .text(opts.targetLabel);
      }
    }

    var tooltip = createTooltip(ctx.container);
    var tooltipFn = opts.tooltipFn || function(d) {
      var lines = ["<b>" + d[xField] + "</b>"];
      series.forEach(function(sr) { lines.push(sr.label + ": " + fmtNum(d[sr.field] || 0)); });
      return lines.join("<br>");
    };

    // Bars — compute final positions first, then animate
    series.forEach(function(sr, si) {
      var barData = data.map(function(d, di) {
        var val = d[sr.field] || 0;
        var cum = 0;
        if (barMode === "stack" && si > 0) {
          for (var j = 0; j < si; j++) cum += Math.max(0, d[series[j].field] || 0);
        }
        var finalY, finalH;
        if (barMode === "stack") {
          finalY = yScale(cum + Math.max(0, val));
          finalH = Math.abs(yScale(cum) - yScale(cum + Math.max(0, val)));
        } else {
          finalY = val >= 0 ? yScale(val) : yScale(0);
          finalH = Math.abs(yScale(0) - yScale(val));
        }
        return {d: d, idx: di, series: sr, si: si, finalY: finalY, finalH: finalH, startY: barMode === "stack" ? yScale(cum) : yScale(0)};
      });

      // For stacked bars: no rounded corners on interior segments, no stroke between segments
      var isStack = barMode === "stack";
      var isTopSegment = isStack && si === series.length - 1;
      var isBottomSegment = isStack && si === 0;

      var rects = g.selectAll(".vbar-" + si)
        .data(barData)
        .enter().append("rect")
          .attr("class", "vbar-" + si)
          .attr("x", function(bd) {
            var base = x0(bd.d[xField]);
            return x1 ? base + x1(sr.field) : base;
          })
          .attr("width", x1 ? x1.bandwidth() : x0.bandwidth())
          .attr("y", function(bd) { return bd.startY; })
          .attr("height", 0)
          .attr("rx", isStack ? 0 : 3)
          .attr("fill", function(bd) {
            if (opts.colorFn) return opts.colorFn(bd.d, si);
            return sr.color || C.revenue;
          })
          .attr("fill-opacity", isStack ? 0.85 : (sr.opacity || 0.7))
          .attr("stroke", isStack ? "none" : (function(bd) {
            if (opts.colorFn) return opts.colorFn(bd.d, si);
            return sr.color || C.revenue;
          }))
          .attr("stroke-width", isStack ? 0 : 1)
          .attr("stroke-opacity", isStack ? 0 : 0.3);

      // Animate bars, then bind hover AFTER animation completes
      rects.transition()
          .duration(600)
          .delay(function(bd){ return bd.idx * 30; })
          .ease(d3.easeCubicOut)
          .attr("height", function(bd) { return bd.finalH; })
          .attr("y", function(bd) { return bd.finalY; })
        .on("end", function() {
          // Bind hover only after animation is done on this element
          d3.select(this)
            .on("mouseover", function(event, bd) {
              d3.select(this).transition().duration(150).attr("fill-opacity", 0.95)
                .style("filter", "url(#" + ctx.glowId + ")");
              tooltip.html(tooltipFn(bd.d)).style("opacity", 1);
            })
            .on("mousemove", function(event) { positionTooltip(tooltip, ctx.container, event); })
            .on("mouseout", function(event, bd) {
              d3.select(this).transition().duration(200).attr("fill-opacity", sr.opacity || 0.7)
                .style("filter", "none");
              tooltip.style("opacity", 0);
            })
            .on("click", function(event, bd) { if (opts.onClick) opts.onClick(bd.d); })
            .style("cursor", opts.onClick ? "pointer" : "default");
        });
    });

    // Line overlays
    allLines.forEach(function(ln) {
      var lineData = data.filter(function(d){ return d[ln.field] != null; });
      var lineFn = d3.line()
        .x(function(d){ return x0(d[xField]) + x0.bandwidth()/2; })
        .y(function(d){ return yScale(d[ln.field]); })
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", ln.color || C.budget)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", ln.dash || "none")
        .attr("d", lineFn);

      g.selectAll(".line-dot-" + ln.field)
        .data(lineData)
        .enter().append("circle")
          .attr("cx", function(d){ return x0(d[xField]) + x0.bandwidth()/2; })
          .attr("cy", function(d){ return yScale(d[ln.field]); })
          .attr("r", 3)
          .attr("fill", ln.color || C.budget)
          .attr("stroke", "#fff").attr("stroke-width", 1.5);
    });

    // Text annotations on bars
    if (opts.textOnBars) {
      var textSeries = opts.textOnBars;
      g.selectAll(".bar-text")
        .data(data)
        .enter().append("text")
          .attr("x", function(d){ return x0(d[xField]) + x0.bandwidth()/2; })
          .attr("y", function(d){
            var val = d[textSeries.field] || 0;
            return yScale(val) - 6;
          })
          .attr("text-anchor", "middle")
          .attr("fill", function(d){
            if (textSeries.colorFn) return textSeries.colorFn(d);
            return LABEL_COLOR;
          })
          .attr("font-size", "10px").attr("font-weight", "600").attr("font-family", FONT)
          .text(function(d){ return textSeries.format ? textSeries.format(d[textSeries.field]) : fmtNum(d[textSeries.field]); });
    }

    // Axes
    var xAxisGen = d3.axisBottom(x0);
    if (opts.xFormat) xAxisGen.tickFormat(opts.xFormat);
    g.append("g").attr("transform", "translate(0," + innerH + ")").call(xAxisGen).call(styleXAxis)
      .selectAll("text").attr("transform", data.length > 8 ? "rotate(-40)" : "").style("text-anchor", data.length > 8 ? "end" : "middle");

    var yAxisGen = d3.axisLeft(yScale).ticks(5);
    if (opts.yFormat) yAxisGen.tickFormat(opts.yFormat);
    g.append("g").call(yAxisGen).call(styleAxis);

    if (opts.yLabel) {
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerH/2).attr("y", -margin.left + 14)
        .attr("text-anchor", "middle")
        .attr("fill", MUTED_COLOR).attr("font-size", "10px").attr("font-family", FONT)
        .text(opts.yLabel);
    }

    // Legend (if multiple series)
    if (series.length > 1 || allLines.length > 0) {
      var legend = g.append("g").attr("transform", "translate(0," + (-8) + ")");
      var lx = 0;
      series.forEach(function(sr) {
        legend.append("rect").attr("x", lx).attr("y", 0).attr("width", 10).attr("height", 10)
          .attr("rx", 2).attr("fill", sr.color).attr("fill-opacity", 0.7);
        legend.append("text").attr("x", lx + 14).attr("y", 9)
          .attr("fill", LABEL_COLOR).attr("font-size", "10px").attr("font-family", FONT).text(sr.label);
        lx += sr.label.length * 6 + 26;
      });
      allLines.forEach(function(ln) {
        legend.append("line").attr("x1", lx).attr("x2", lx + 14)
          .attr("y1", 5).attr("y2", 5)
          .attr("stroke", ln.color || C.budget).attr("stroke-width", 2)
          .attr("stroke-dasharray", ln.dash || "none");
        legend.append("text").attr("x", lx + 18).attr("y", 9)
          .attr("fill", LABEL_COLOR).attr("font-size", "10px").attr("font-family", FONT).text(ln.label);
        lx += (ln.label || "").length * 6 + 30;
      });
    }

    registerResize(containerId, verticalBar, data, opts);
  }

  // ================================================================
  //  LINE TREND CHART
  //  Multi-series line chart with markers
  // ================================================================
  function lineTrend(containerId, data, opts) {
    /*
      opts: {
        xField:     string — x-axis field (e.g. "month")
        series:     [{field, label, color, dash, width}]
        tooltipFn:  function(d) -> HTML
        yFormat:    function(d) -> string
        xFormat:    function(d) -> string
        yLabel:     string
        target:     number — horizontal ref line
        targetLabel: string
        margin:     object
        height:     number
      }
    */
    if (!data || !data.length) {
      var el = document.getElementById(containerId);
      if (el) el.innerHTML = "<div style='padding:40px;color:#94A3B8;text-align:center;font-size:12px'>No data</div>";
      return;
    }
    opts = opts || {};
    var xField = opts.xField || "month";
    var series = opts.series || [];
    var margin = opts.margin || {top: 16, right: 50, bottom: 44, left: 60};
    var totalHeight = opts.height || 350;

    var ctx = createSvg(containerId, margin, totalHeight);
    if (!ctx) return;
    var g = ctx.g;
    var innerW = ctx.innerW;
    var innerH = ctx.innerH;

    var categories = data.map(function(d){ return d[xField]; });

    // Y domain from all series
    var yMin = Infinity, yMax = -Infinity;
    series.forEach(function(sr) {
      data.forEach(function(d) {
        var v = d[sr.field];
        if (v != null) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      });
    });
    if (opts.target != null) {
      if (opts.target < yMin) yMin = opts.target;
      if (opts.target > yMax) yMax = opts.target;
    }
    var pad = (yMax - yMin) * 0.1 || 10;
    yMin -= pad; yMax += pad;

    var x = d3.scalePoint().domain(categories).range([0, innerW]).padding(0.5);
    var yScale = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerH, 0]);

    // Grid
    yScale.ticks(5).forEach(function(t) {
      g.append("line").attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(t)).attr("y2", yScale(t))
        .attr("stroke", GRID_COLOR).attr("stroke-width", 1);
    });

    // Target line
    if (opts.target != null) {
      g.append("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(opts.target)).attr("y2", yScale(opts.target))
        .attr("stroke", C.budget).attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6,3").attr("opacity", 0.6);
    }

    var tooltip = createTooltip(ctx.container);
    var tooltipFn = opts.tooltipFn || function(d) {
      var lines = ["<b>" + d[xField] + "</b>"];
      series.forEach(function(sr) {
        var v = d[sr.field];
        lines.push(sr.label + ": " + (v != null ? v.toFixed(1) : "N/A"));
      });
      return lines.join("<br>");
    };

    // Lines + dots
    series.forEach(function(sr) {
      var lineData = data.filter(function(d){ return d[sr.field] != null; });
      var lineFn = d3.line()
        .x(function(d){ return x(d[xField]); })
        .y(function(d){ return yScale(d[sr.field]); })
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", sr.color)
        .attr("stroke-width", sr.width || 2.5)
        .attr("stroke-dasharray", sr.dash || "none")
        .attr("d", lineFn)
        .attr("opacity", 0)
        .transition().duration(800).attr("opacity", 1);

      g.selectAll(".dot-" + sr.field)
        .data(lineData)
        .enter().append("circle")
          .attr("cx", function(d){ return x(d[xField]); })
          .attr("cy", function(d){ return yScale(d[sr.field]); })
          .attr("r", 4)
          .attr("fill", sr.color)
          .attr("stroke", "#fff").attr("stroke-width", 2)
          .attr("opacity", 0)
        .on("mouseover", function(event, d) {
          d3.select(this).transition().duration(100).attr("r", 6);
          tooltip.html(tooltipFn(d)).style("opacity", 1);
        })
        .on("mousemove", function(event) { positionTooltip(tooltip, ctx.container, event); })
        .on("mouseout", function() {
          d3.select(this).transition().duration(150).attr("r", 4);
          tooltip.style("opacity", 0);
        })
        .transition().duration(400).delay(function(d, i){ return 400 + i * 30; })
          .attr("opacity", 1);
    });

    // Axes
    var xAxisGen = d3.axisBottom(x);
    if (opts.xFormat) xAxisGen.tickFormat(opts.xFormat);
    g.append("g").attr("transform", "translate(0," + innerH + ")").call(xAxisGen).call(styleXAxis)
      .selectAll("text").attr("transform", categories.length > 8 ? "rotate(-40)" : "").style("text-anchor", categories.length > 8 ? "end" : "middle");

    var yAxisGen = d3.axisLeft(yScale).ticks(5);
    if (opts.yFormat) yAxisGen.tickFormat(opts.yFormat);
    g.append("g").call(yAxisGen).call(styleAxis);

    // Legend
    if (series.length > 1) {
      var legend = g.append("g").attr("transform", "translate(0," + (-8) + ")");
      var lx = 0;
      series.forEach(function(sr) {
        legend.append("line").attr("x1", lx).attr("x2", lx + 14)
          .attr("y1", 5).attr("y2", 5)
          .attr("stroke", sr.color).attr("stroke-width", sr.width || 2.5)
          .attr("stroke-dasharray", sr.dash || "none");
        legend.append("circle").attr("cx", lx + 7).attr("cy", 5).attr("r", 3)
          .attr("fill", sr.color);
        legend.append("text").attr("x", lx + 18).attr("y", 9)
          .attr("fill", LABEL_COLOR).attr("font-size", "10px").attr("font-family", FONT).text(sr.label);
        lx += (sr.label || "").length * 6 + 30;
      });
    }

    registerResize(containerId, lineTrend, data, opts);
  }

  // ================================================================
  //  WATERFALL CHART
  // ================================================================
  function waterfall(containerId, data, opts) {
    /*
      data: [{label, value, measure: "absolute"|"relative"|"total"}]
      opts: {
        tooltipFn:  function(d, cumulative) -> HTML
        yFormat:    function(d) -> string
        yLabel:     string
        margin:     object
        height:     number
        colors:     {increase, decrease, total}
      }
    */
    if (!data || !data.length) return;
    opts = opts || {};
    var margin = opts.margin || {top: 16, right: 40, bottom: 44, left: 70};
    var totalHeight = opts.height || 350;
    var colors = opts.colors || {increase: "#10b981", decrease: "#ef4444", total: C.revenue};

    // Compute cumulative positions
    var cumulative = 0;
    var processed = data.map(function(d) {
      var start, end;
      if (d.measure === "absolute" || d.measure === "total") {
        start = 0; end = d.value; cumulative = d.value;
      } else {
        start = cumulative; end = cumulative + d.value; cumulative = end;
      }
      return {
        label: d.label, value: d.value, measure: d.measure,
        start: Math.min(start, end), end: Math.max(start, end),
        isPositive: d.value >= 0, cumulative: cumulative
      };
    });

    var ctx = createSvg(containerId, margin, totalHeight);
    if (!ctx) return;
    var g = ctx.g;
    var innerW = ctx.innerW;
    var innerH = ctx.innerH;

    var yMin = d3.min(processed, function(d){ return d.start; });
    var yMax = d3.max(processed, function(d){ return d.end; });
    var yPad = (yMax - yMin) * 0.15;

    var x = d3.scaleBand().domain(processed.map(function(d){ return d.label; }))
      .range([0, innerW]).padding(0.3);
    var yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).nice().range([innerH, 0]);

    // Grid
    yScale.ticks(5).forEach(function(t) {
      g.append("line").attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(t)).attr("y2", yScale(t))
        .attr("stroke", GRID_COLOR).attr("stroke-width", 1);
    });

    var tooltip = createTooltip(ctx.container);
    var tooltipFn = opts.tooltipFn || function(d) {
      return "<b>" + d.label + "</b><br>" + fmtEur(d.value);
    };

    // Bars
    g.selectAll(".wf-bar")
      .data(processed)
      .enter().append("rect")
        .attr("class", "wf-bar")
        .attr("x", function(d){ return x(d.label); })
        .attr("width", x.bandwidth())
        .attr("y", function(d){ return yScale(d.end); })
        .attr("height", 0)
        .attr("rx", 3)
        .attr("fill", function(d) {
          if (d.measure === "total" || d.measure === "absolute") return colors.total;
          return d.isPositive ? colors.increase : colors.decrease;
        })
        .attr("fill-opacity", 0.7)
        .attr("stroke", function(d) {
          if (d.measure === "total" || d.measure === "absolute") return colors.total;
          return d.isPositive ? colors.increase : colors.decrease;
        })
        .attr("stroke-width", 1).attr("stroke-opacity", 0.5)
      .on("mouseover", function(event, d) {
        d3.select(this).transition().duration(150).attr("fill-opacity", 0.95)
          .style("filter", "url(#" + ctx.glowId + ")");
        tooltip.html(tooltipFn(d)).style("opacity", 1);
      })
      .on("mousemove", function(event) { positionTooltip(tooltip, ctx.container, event); })
      .on("mouseout", function() {
        d3.select(this).transition().duration(200).attr("fill-opacity", 0.7).style("filter", "none");
        tooltip.style("opacity", 0);
      })
      .transition().duration(600).delay(function(d, i){ return i * 80; }).ease(d3.easeCubicOut)
        .attr("height", function(d){ return Math.abs(yScale(d.start) - yScale(d.end)); });

    // Connector lines
    processed.forEach(function(d, i) {
      if (i < processed.length - 1 && d.measure !== "total") {
        g.append("line")
          .attr("x1", x(d.label) + x.bandwidth())
          .attr("x2", x(processed[i+1].label))
          .attr("y1", yScale(d.cumulative))
          .attr("y2", yScale(d.cumulative))
          .attr("stroke", MUTED_COLOR).attr("stroke-width", 1)
          .attr("stroke-dasharray", "3,2").attr("opacity", 0.5);
      }
    });

    // Value labels
    g.selectAll(".wf-label")
      .data(processed)
      .enter().append("text")
        .attr("x", function(d){ return x(d.label) + x.bandwidth()/2; })
        .attr("y", function(d){ return yScale(d.end) - 6; })
        .attr("text-anchor", "middle")
        .attr("fill", function(d) {
          if (d.measure === "total" || d.measure === "absolute") return C.revenue;
          return d.isPositive ? "#059669" : "#dc2626";
        })
        .attr("font-size", "10px").attr("font-weight", "600").attr("font-family", FONT)
        .text(function(d){ return opts.yFormat ? opts.yFormat(d.value) : fmtEur(d.value); });

    // Axes
    g.append("g").attr("transform", "translate(0," + innerH + ")")
      .call(d3.axisBottom(x)).call(styleXAxis);
    var yAxisGen = d3.axisLeft(yScale).ticks(5);
    if (opts.yFormat) yAxisGen.tickFormat(opts.yFormat);
    g.append("g").call(yAxisGen).call(styleAxis);

    registerResize(containerId, waterfall, data, opts);
  }

  // ================================================================
  //  HEATMAP
  // ================================================================
  function heatmap(containerId, data, opts) {
    /*
      opts: {
        xLabels:     string[] — column labels
        yLabels:     string[] — row labels
        zMatrix:     number[][] — values (rows x cols)
        textMatrix:  string[][] — text to show in cells
        colorScale:  [[stop, color], ...] — e.g. [[0,"#ef4444"],[1,"#10b981"]]
        zMin:        number
        zMax:        number
        tooltipFn:   function(row, col, z, text) -> HTML
        onYClick:    function(yLabel, yIdx) -> void
        margin:      object
        cellH:       number
      }
    */
    opts = opts || {};
    var xLabels = opts.xLabels || [];
    var yLabels = opts.yLabels || [];
    var zMatrix = opts.zMatrix || [];
    var textMatrix = opts.textMatrix || [];
    if (!xLabels.length || !yLabels.length) return;

    var cellH = opts.cellH || 28;
    var margin = opts.margin || {top: 30, right: 20, bottom: 40, left: 140};
    var totalHeight = margin.top + margin.bottom + yLabels.length * cellH;

    var ctx = createSvg(containerId, margin, totalHeight);
    if (!ctx) return;
    var g = ctx.g;
    var innerW = ctx.innerW;
    var innerH = yLabels.length * cellH;

    var x = d3.scaleBand().domain(xLabels).range([0, innerW]).padding(0.05);
    var y = d3.scaleBand().domain(yLabels).range([0, innerH]).padding(0.05);

    var zMin = opts.zMin != null ? opts.zMin : d3.min(zMatrix, function(row){ return d3.min(row); });
    var zMax = opts.zMax != null ? opts.zMax : d3.max(zMatrix, function(row){ return d3.max(row); });

    // Build color interpolator from colorScale
    var colorScale = opts.colorScale || [[0, "#ef4444"], [0.5, "#f59e0b"], [1, "#10b981"]];
    var colorInterp = function(val) {
      var t = zMax !== zMin ? (val - zMin) / (zMax - zMin) : 0.5;
      t = Math.max(0, Math.min(1, t));
      // Find segment
      for (var i = 0; i < colorScale.length - 1; i++) {
        if (t <= colorScale[i+1][0]) {
          var localT = (t - colorScale[i][0]) / (colorScale[i+1][0] - colorScale[i][0]);
          return d3.interpolateRgb(colorScale[i][1], colorScale[i+1][1])(localT);
        }
      }
      return colorScale[colorScale.length - 1][1];
    };

    // Flatten data
    var cells = [];
    yLabels.forEach(function(yl, ri) {
      xLabels.forEach(function(xl, ci) {
        cells.push({
          row: ri, col: ci, yLabel: yl, xLabel: xl,
          z: (zMatrix[ri] && zMatrix[ri][ci] != null) ? zMatrix[ri][ci] : null,
          text: (textMatrix[ri] && textMatrix[ri][ci]) || ""
        });
      });
    });

    var tooltip = createTooltip(ctx.container);
    var tooltipFn = opts.tooltipFn || function(cell) {
      return "<b>" + cell.yLabel + "</b> — " + cell.xLabel + "<br>" + (cell.z != null ? cell.z.toFixed(1) : "N/A");
    };

    // Cells
    g.selectAll(".hm-cell")
      .data(cells)
      .enter().append("rect")
        .attr("class", "hm-cell")
        .attr("x", function(d){ return x(d.xLabel); })
        .attr("y", function(d){ return y(d.yLabel); })
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 2)
        .attr("fill", function(d){ return d.z != null ? colorInterp(d.z) : "#f5f5f5"; })
        .attr("fill-opacity", function(d){ return d.z != null ? 0.75 : 0.3; })
        .attr("stroke", "#fff").attr("stroke-width", 1)
      .on("mouseover", function(event, d) {
        d3.select(this).transition().duration(100).attr("fill-opacity", 1).attr("stroke-width", 2);
        tooltip.html(tooltipFn(d)).style("opacity", 1);
      })
      .on("mousemove", function(event) { positionTooltip(tooltip, ctx.container, event); })
      .on("mouseout", function() {
        d3.select(this).transition().duration(150).attr("fill-opacity", function(d){ return d.z != null ? 0.75 : 0.3; }).attr("stroke-width", 1);
        tooltip.style("opacity", 0);
      });

    // Cell text
    g.selectAll(".hm-text")
      .data(cells.filter(function(d){ return d.text; }))
      .enter().append("text")
        .attr("class", "hm-text")
        .attr("x", function(d){ return x(d.xLabel) + x.bandwidth()/2; })
        .attr("y", function(d){ return y(d.yLabel) + y.bandwidth()/2; })
        .attr("dy", "0.35em").attr("text-anchor", "middle")
        .attr("fill", function(d){
          if (d.z == null) return TEXT_PRIMARY;
          // Use actual rendered color luminance to decide text contrast
          var cellColor = d.z != null ? colorInterp(d.z) : "#f5f5f5";
          var c = d3.color(cellColor);
          if (c) {
            var lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
            return lum < 0.55 ? "#fff" : TEXT_PRIMARY;
          }
          var t = (zMax !== zMin) ? (d.z - zMin) / (zMax - zMin) : 0.5;
          return t > 0.6 ? "#fff" : TEXT_PRIMARY;
        })
        .attr("font-size", (opts.cellFontSize || 9) + "px").attr("font-weight", "500").attr("font-family", FONT)
        .text(function(d){ return d.text; });

    // X-axis
    g.append("g").attr("transform", "translate(0," + innerH + ")")
      .call(d3.axisBottom(x)).call(styleXAxis)
      .selectAll("text").attr("transform", xLabels.length > 8 ? "rotate(-40)" : "")
      .style("text-anchor", xLabels.length > 8 ? "end" : "middle");

    // Y-axis labels (custom, not d3.axisLeft, so we can add click)
    g.selectAll(".hm-ylabel")
      .data(yLabels)
      .enter().append("text")
        .attr("x", -6)
        .attr("y", function(d){ return y(d) + y.bandwidth()/2; })
        .attr("dy", "0.35em").attr("text-anchor", "end")
        .attr("fill", LABEL_COLOR).attr("font-size", "10px").attr("font-family", FONT)
        .style("cursor", opts.onYClick ? "pointer" : "default")
        .text(function(d){ return truncate(d, 20); })
        .on("click", function(event, d) {
          if (opts.onYClick) opts.onYClick(d, yLabels.indexOf(d));
        });

    registerResize(containerId, heatmap, data, opts);
  }

  // ================================================================
  //  SCATTER / BUBBLE CHART
  // ================================================================
  function scatter(containerId, data, opts) {
    /*
      opts: {
        xField:       string
        yField:       string
        sizeField:    string|null — bubble size encoding
        colorFn:      function(d) -> color
        textField:    string|null — label on each point
        tooltipFn:    function(d) -> HTML
        xLabel:       string
        yLabel:       string
        xFormat:      function(d) -> string
        yFormat:      function(d) -> string
        refLines:     [{axis:"x"|"y", value, color, dash, label}]
        quadrants:    [{x, y, text, anchor}] — quadrant labels
        diagonal:     bool — show x=y line
        margin:       object
        height:       number
        minSize:      number (default 6)
        maxSize:      number (default 24)
      }
    */
    if (!data || !data.length) return;
    opts = opts || {};
    var xField = opts.xField || "x";
    var yField = opts.yField || "y";
    var margin = opts.margin || {top: 20, right: 40, bottom: 50, left: 60};
    var totalHeight = opts.height || 400;

    var ctx = createSvg(containerId, margin, totalHeight);
    if (!ctx) return;
    var g = ctx.g;
    var innerW = ctx.innerW;
    var innerH = ctx.innerH;

    var xMin = d3.min(data, function(d){ return d[xField]; });
    var xMax = d3.max(data, function(d){ return d[xField]; });
    var yMin = d3.min(data, function(d){ return d[yField]; });
    var yMax = d3.max(data, function(d){ return d[yField]; });
    var xPad = (xMax - xMin) * 0.1 || 10;
    var yPad = (yMax - yMin) * 0.1 || 10;

    var xScale = d3.scaleLinear().domain([xMin - xPad, xMax + xPad]).nice().range([0, innerW]);
    var yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).nice().range([innerH, 0]);

    // Size scale
    var sizeScale = null;
    if (opts.sizeField) {
      var sMin = d3.min(data, function(d){ return d[opts.sizeField] || 0; });
      var sMax = d3.max(data, function(d){ return d[opts.sizeField] || 0; });
      sizeScale = d3.scaleSqrt().domain([sMin, sMax]).range([opts.minSize || 6, opts.maxSize || 24]);
    }

    // Grid
    yScale.ticks(5).forEach(function(t) {
      g.append("line").attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(t)).attr("y2", yScale(t))
        .attr("stroke", GRID_COLOR).attr("stroke-width", 1);
    });
    xScale.ticks(5).forEach(function(t) {
      g.append("line").attr("x1", xScale(t)).attr("x2", xScale(t))
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", GRID_COLOR).attr("stroke-width", 1);
    });

    // Diagonal
    if (opts.diagonal) {
      var dMin = Math.max(xScale.domain()[0], yScale.domain()[0]);
      var dMax = Math.min(xScale.domain()[1], yScale.domain()[1]);
      g.append("line")
        .attr("x1", xScale(dMin)).attr("x2", xScale(dMax))
        .attr("y1", yScale(dMin)).attr("y2", yScale(dMax))
        .attr("stroke", MUTED_COLOR).attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,3").attr("opacity", 0.5);
    }

    // Ref lines
    if (opts.refLines) {
      opts.refLines.forEach(function(rl) {
        if (rl.axis === "x") {
          g.append("line")
            .attr("x1", xScale(rl.value)).attr("x2", xScale(rl.value))
            .attr("y1", 0).attr("y2", innerH)
            .attr("stroke", rl.color || MUTED_COLOR).attr("stroke-width", 1.5)
            .attr("stroke-dasharray", rl.dash || "4,3").attr("opacity", 0.5);
        } else {
          g.append("line")
            .attr("x1", 0).attr("x2", innerW)
            .attr("y1", yScale(rl.value)).attr("y2", yScale(rl.value))
            .attr("stroke", rl.color || MUTED_COLOR).attr("stroke-width", 1.5)
            .attr("stroke-dasharray", rl.dash || "4,3").attr("opacity", 0.5);
        }
        if (rl.label) {
          g.append("text")
            .attr("x", rl.axis === "x" ? xScale(rl.value) + 4 : innerW - 4)
            .attr("y", rl.axis === "x" ? 10 : yScale(rl.value) - 4)
            .attr("text-anchor", rl.axis === "x" ? "start" : "end")
            .attr("fill", rl.color || MUTED_COLOR)
            .attr("font-size", "9px").attr("font-family", FONT)
            .text(rl.label);
        }
      });
    }

    // Quadrant labels
    if (opts.quadrants) {
      opts.quadrants.forEach(function(q) {
        g.append("text")
          .attr("x", q.x * innerW).attr("y", q.y * innerH)
          .attr("text-anchor", q.anchor || "middle")
          .attr("fill", MUTED_COLOR).attr("font-size", "10px").attr("font-weight", "600")
          .attr("font-family", FONT).attr("opacity", 0.5)
          .text(q.text);
      });
    }

    var tooltip = createTooltip(ctx.container);
    var tooltipFn = opts.tooltipFn || function(d) {
      return "<b>" + (d[opts.textField] || "") + "</b>";
    };
    var colorFn = opts.colorFn || function(){ return C.revenue; };

    // Bubbles
    g.selectAll(".bubble")
      .data(data)
      .enter().append("circle")
        .attr("class", "bubble")
        .attr("cx", function(d){ return xScale(d[xField]); })
        .attr("cy", function(d){ return yScale(d[yField]); })
        .attr("r", 0)
        .attr("fill", function(d){ return colorFn(d); })
        .attr("fill-opacity", 0.6)
        .attr("stroke", function(d){ return opts.strokeFn ? opts.strokeFn(d) : colorFn(d); })
        .attr("stroke-width", function(d){ return opts.strokeDashFn && opts.strokeDashFn(d) !== "none" ? 2.5 : 1.5; })
        .attr("stroke-opacity", 0.8)
        .attr("stroke-dasharray", function(d){ return opts.strokeDashFn ? opts.strokeDashFn(d) : "none"; })
      .on("mouseover", function(event, d) {
        d3.select(this).transition().duration(150)
          .attr("fill-opacity", 0.9).attr("stroke-width", 2.5)
          .style("filter", "url(#" + ctx.glowId + ")");
        tooltip.html(tooltipFn(d)).style("opacity", 1);
      })
      .on("mousemove", function(event) { positionTooltip(tooltip, ctx.container, event); })
      .on("mouseout", function() {
        d3.select(this).transition().duration(200)
          .attr("fill-opacity", 0.6).attr("stroke-width", 1.5)
          .style("filter", "none");
        tooltip.style("opacity", 0);
      })
      .on("click", function(event, d) { if (opts.onClick) opts.onClick(d); })
      .style("cursor", opts.onClick ? "pointer" : "default")
      .transition().duration(600).delay(function(d, i){ return i * 20; })
        .ease(d3.easeCubicOut)
        .attr("r", function(d){
          return sizeScale ? sizeScale(d[opts.sizeField] || 0) : (opts.minSize || 6);
        });

    // Text labels
    if (opts.textField) {
      g.selectAll(".bubble-label")
        .data(data)
        .enter().append("text")
          .attr("x", function(d){ return xScale(d[xField]); })
          .attr("y", function(d){
            var r = sizeScale ? sizeScale(d[opts.sizeField] || 0) : (opts.minSize || 6);
            return yScale(d[yField]) - r - 4;
          })
          .attr("text-anchor", "middle")
          .attr("fill", LABEL_COLOR).attr("font-size", "9px").attr("font-family", FONT)
          .text(function(d){
            var t = d[opts.textField] || "";
            return t.length > 18 ? t.substring(0, 16) + "..." : t;
          });
    }

    // Axes
    var xAxisGen = d3.axisBottom(xScale).ticks(6);
    if (opts.xFormat) xAxisGen.tickFormat(opts.xFormat);
    g.append("g").attr("transform", "translate(0," + innerH + ")").call(xAxisGen).call(styleXAxis);

    var yAxisGen = d3.axisLeft(yScale).ticks(6);
    if (opts.yFormat) yAxisGen.tickFormat(opts.yFormat);
    g.append("g").call(yAxisGen).call(styleAxis);

    if (opts.xLabel) {
      g.append("text").attr("x", innerW/2).attr("y", innerH + 36)
        .attr("text-anchor", "middle").attr("fill", MUTED_COLOR)
        .attr("font-size", "10px").attr("font-family", FONT).text(opts.xLabel);
    }
    if (opts.yLabel) {
      g.append("text").attr("transform", "rotate(-90)")
        .attr("x", -innerH/2).attr("y", -margin.left + 14)
        .attr("text-anchor", "middle").attr("fill", MUTED_COLOR)
        .attr("font-size", "10px").attr("font-family", FONT).text(opts.yLabel);
    }

    registerResize(containerId, scatter, data, opts);
  }

  // ================================================================
  //  PARETO CHART
  // ================================================================
  function pareto(containerId, data, opts) {
    /*
      data: sorted descending by value
      opts: {
        labelField:   string
        valueField:   string
        tooltipFn:    function(d, cumPct) -> HTML
        threshold:    number (default 0.8) — highlight line
        margin:       object
        height:       number
      }
    */
    if (!data || !data.length) return;
    opts = opts || {};
    var labelField = opts.labelField || "label";
    var valueField = opts.valueField || "value";
    var threshold = opts.threshold || 0.8;
    var margin = opts.margin || {top: 16, right: 50, bottom: 50, left: 60};
    var totalHeight = opts.height || 350;

    var total = data.reduce(function(s, d){ return s + (d[valueField] || 0); }, 0);
    var cum = 0;
    var paretoData = data.map(function(d, i) {
      cum += (d[valueField] || 0);
      return Object.assign({}, d, {cumPct: total > 0 ? cum / total : 0, idx: i});
    });

    var ctx = createSvg(containerId, margin, totalHeight);
    if (!ctx) return;
    var g = ctx.g;
    var innerW = ctx.innerW;
    var innerH = ctx.innerH;

    var x = d3.scaleLinear().domain([0, paretoData.length - 1]).range([0, innerW]);
    var yScale = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

    // Grid
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(function(t) {
      g.append("line").attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(t)).attr("y2", yScale(t))
        .attr("stroke", GRID_COLOR).attr("stroke-width", 1);
    });

    // Threshold line
    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(threshold)).attr("y2", yScale(threshold))
      .attr("stroke", C.budget).attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6,3").attr("opacity", 0.5);
    g.append("text")
      .attr("x", innerW + 4).attr("y", yScale(threshold))
      .attr("dy", "0.35em").attr("fill", C.budget)
      .attr("font-size", "9px").attr("font-family", FONT)
      .text(Math.round(threshold * 100) + "%");

    // Area fill
    var area = d3.area()
      .x(function(d){ return x(d.idx); })
      .y0(innerH)
      .y1(function(d){ return yScale(d.cumPct); })
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(paretoData)
      .attr("fill", C.revenue).attr("fill-opacity", 0.12)
      .attr("d", area);

    // Line
    var line = d3.line()
      .x(function(d){ return x(d.idx); })
      .y(function(d){ return yScale(d.cumPct); })
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(paretoData)
      .attr("fill", "none")
      .attr("stroke", C.revenue).attr("stroke-width", 2.5)
      .attr("d", line);

    var tooltip = createTooltip(ctx.container);
    var tooltipFn = opts.tooltipFn || function(d) {
      return "<b>" + d[labelField] + "</b><br>Cumulative: " + (d.cumPct * 100).toFixed(1) + "%";
    };

    // Dots
    g.selectAll(".pareto-dot")
      .data(paretoData)
      .enter().append("circle")
        .attr("cx", function(d){ return x(d.idx); })
        .attr("cy", function(d){ return yScale(d.cumPct); })
        .attr("r", 4)
        .attr("fill", C.revenue)
        .attr("stroke", "#fff").attr("stroke-width", 2)
      .on("mouseover", function(event, d) {
        d3.select(this).transition().duration(100).attr("r", 6);
        tooltip.html(tooltipFn(d)).style("opacity", 1);
      })
      .on("mousemove", function(event) { positionTooltip(tooltip, ctx.container, event); })
      .on("mouseout", function() {
        d3.select(this).transition().duration(150).attr("r", 4);
        tooltip.style("opacity", 0);
      });

    // Axes
    g.append("g").attr("transform", "translate(0," + innerH + ")")
      .call(d3.axisBottom(x).ticks(Math.min(paretoData.length, 10)).tickFormat(function(i) {
        var idx = Math.round(i);
        return paretoData[idx] ? truncate(paretoData[idx][labelField], 12) : "";
      }))
      .call(styleXAxis)
      .selectAll("text").attr("transform", "rotate(-40)").style("text-anchor", "end");

    g.append("g").call(d3.axisLeft(yScale).ticks(5).tickFormat(function(d){ return Math.round(d*100) + "%"; }))
      .call(styleAxis);

    registerResize(containerId, pareto, data, opts);
  }

  // ================================================================
  //  D3 PAGINATION (replaces Plotly-based setupCliPager/renderCliPage)
  // ================================================================
  function setupD3Pager(chartId, fullData, renderFn, opts) {
    var pageSize = D.CLI_PAGE_SIZE || 10;
    var n = fullData.length;
    D.cliPages[chartId] = {
      fullData: fullData,
      renderFn: renderFn,
      opts: opts,
      page: 0,
      totalPages: Math.ceil(n / pageSize)
    };
    renderD3Page(chartId);
  }

  function renderD3Page(chartId) {
    var p = D.cliPages[chartId];
    if (!p || !p.fullData) return;
    var pageSize = D.CLI_PAGE_SIZE || 10;
    var n = p.fullData.length;
    // Show best first: page 0 = last pageSize items (top of sorted list)
    var end = n - (p.page * pageSize);
    var start = Math.max(0, end - pageSize);
    var sliced = p.fullData.slice(start, end);

    // Call the D3 renderer with sliced data
    p.renderFn(chartId, sliced, Object.assign({}, p.opts, {animate: false}));

    // Update pager controls
    var pager = document.getElementById(chartId + "-pager");
    if (pager) {
      var prevBtn = pager.querySelector(".pg-prev");
      var nextBtn = pager.querySelector(".pg-next");
      var label = pager.querySelector(".pg-label");
      if (prevBtn) prevBtn.disabled = p.page === 0;
      if (nextBtn) nextBtn.disabled = start <= 0;
      if (label) label.textContent = (n - end + 1) + "–" + (n - start) + " of " + n;
    }
  }

  // ================================================================
  //  EXPOSE ON DASHBOARD NAMESPACE
  // ================================================================
  D.d3 = {
    // Core utilities
    createSvg: createSvg,
    createTooltip: createTooltip,
    positionTooltip: positionTooltip,
    registerResize: registerResize,
    addGridLines: addGridLines,
    addRefLine: addRefLine,
    addBarGradient: addBarGradient,
    styleAxis: styleAxis,
    thresholdColor: thresholdColor,
    thresholdColorDark: thresholdColorDark,
    truncate: truncate,
    fmtNum: fmtNum,
    fmtEur: fmtEur,
    fmtPct: fmtPct,

    // Chart renderers
    horizontalBar: horizontalBar,
    stackedHorizontalBar: stackedHorizontalBar,
    verticalBar: verticalBar,
    lineTrend: lineTrend,
    waterfall: waterfall,
    heatmap: heatmap,
    scatter: scatter,
    pareto: pareto,

    // Pagination
    setupD3Pager: setupD3Pager,
    renderD3Page: renderD3Page,

    // Constants
    FONT: FONT,
    GRID_COLOR: GRID_COLOR,
    AXIS_COLOR: AXIS_COLOR,
    LABEL_COLOR: LABEL_COLOR,
    MUTED_COLOR: MUTED_COLOR,
    TEXT_PRIMARY: TEXT_PRIMARY
  };

})(window.Dashboard);
