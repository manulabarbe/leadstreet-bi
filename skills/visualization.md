# Visualization — Charts, Colors & Export

## Chart Type Selection by Report

### Financial Reports

| Metric | Chart Type | Why |
|--------|-----------|-----|
| Revenue by month | Grouped bar chart | Compare months side by side |
| Margin by month | Grouped bar chart | Paired with revenue for context |
| Year-over-year | Overlaid line chart | Two lines (this year vs last year) on same axis, months on x |
| EOY forecast | Stacked bar chart | Actual (solid) + forecast (hatched/lighter) stacked per month |

### People Reports

| Metric | Chart Type | Why |
|--------|-----------|-----|
| Billable utilisation % | Horizontal bar, ranked | Easy to compare across people, sorted high→low |
| Avg cost per hour | Horizontal bar, ranked | Same layout as utilisation for consistency |
| Total hours per person | Stacked horizontal bar | Billable (green) + non-billable (gray) segments |

### Project Reports

| Metric | Chart Type | Why |
|--------|-----------|-----|
| Overbudget flags | Table with colored indicators | 🟢🟡🔴 flags, sorted by burn rate |
| ACPH per service type | Vertical bar chart | One bar per service type |
| Budget burn rate | Horizontal bar with target line | Bar = % used, vertical line at 100% |

### Client Reports

| Metric | Chart Type | Why |
|--------|-----------|-----|
| Profitability by client | Horizontal bar, ranked | Sorted by profit margin, color-coded pos/neg |
| Overbudget per client | Table with flags | Aggregate flags from projects |

### Hygiene Reports

| Metric | Chart Type | Why |
|--------|-----------|-----|
| Missing notes % | Line chart over months | Shows trend clearly |
| Per-person breakdown | Heatmap (months × people) | Spot patterns per person over time |

## Color Conventions

### Semantic Colors

| Meaning | Color | Hex |
|---------|-------|-----|
| Billable | Green | `#2ECC71` |
| Non-billable | Gray | `#95A5A6` |
| Revenue / positive | Blue | `#3498DB` |
| Cost / negative | Orange | `#E67E22` |
| Forecast / projected | Same as base, 40% opacity | Base + alpha 0.4 |
| Overbudget (red flag) | Red | `#E74C3C` |
| Warning (amber flag) | Amber | `#F39C12` |
| On track (green flag) | Green | `#27AE60` |
| Profit positive | Green | `#27AE60` |
| Profit negative | Red | `#E74C3C` |

### Chart Styling

```python
# Standard matplotlib/seaborn style
import matplotlib.pyplot as plt
import seaborn as sns

COLORS = {
    "billable": "#2ECC71",
    "non_billable": "#95A5A6",
    "revenue": "#3498DB",
    "cost": "#E67E22",
    "overbudget": "#E74C3C",
    "warning": "#F39C12",
    "on_track": "#27AE60",
}

def apply_style():
    """Apply consistent chart styling."""
    sns.set_theme(style="whitegrid")
    plt.rcParams.update({
        "figure.figsize": (12, 6),
        "font.size": 11,
        "axes.titlesize": 14,
        "axes.labelsize": 12,
    })
```

### Forecast Visualization

For actual vs forecast in the same chart:
- **Actual data:** Solid fill, full opacity
- **Forecast data:** Hatched fill or same color at 40% opacity
- **Dividing line:** Dashed vertical line at "today" or end of actuals

```python
# Example: stacked bar with actual + forecast
for i, row in monthly_data.iterrows():
    if row["is_forecast"]:
        ax.bar(i, row["hours"], color=color, alpha=0.4, hatch="//")
    else:
        ax.bar(i, row["hours"], color=color, alpha=1.0)
```

## Export Formats

| Format | Use Case | How |
|--------|----------|-----|
| PNG | Static reports, email, presentations | `plt.savefig("output/report.png", dpi=150, bbox_inches="tight")` |
| HTML | Interactive dashboards, drill-down | `fig.write_html("output/report.html")` (plotly) |
| CSV | Raw data export for spreadsheets | `df.to_csv("output/data.csv", index=False)` |

### Output Naming Convention

```
output/
  financial_2026-03.png
  financial_2026-03.html
  people_utilisation_2026-03.png
  project_overbudget_2026-03.png
  client_profitability_2026-03.png
  hygiene_notes_2026-03.png
```

Pattern: `{report_type}_{detail}_{YYYY-MM}.{ext}`

## Interactive Charts (Plotly)

For reports that benefit from drill-down:

```python
import plotly.express as px

def interactive_utilisation(df):
    """Create interactive utilisation chart with hover details."""
    fig = px.bar(
        df.sort_values("utilisation_pct", ascending=True),
        x="utilisation_pct",
        y="person_name",
        orientation="h",
        color="utilisation_pct",
        color_continuous_scale=["#E74C3C", "#F39C12", "#27AE60"],
        range_color=[0, 100],
        title="Billable Utilisation by Person",
        labels={"utilisation_pct": "Utilisation %", "person_name": ""},
    )
    fig.write_html("output/people_utilisation.html")
    return fig
```
