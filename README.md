# Budget Sanity

An interactive budget dashboard for the Corporate Data Office (CDO) FY2026 budget. It reads a source Excel workbook, extracts the data into JSON, and presents it as a modern single-page web app with charts, KPIs, variance analysis, and interactive planning tools.

## What's Inside

- **KPI Cards** -- Approved Budget, Forecast, Unallocated, Pending Approval, YTD Actuals, Forecast Remaining, Projected Annual
- **Budget Breakdown** -- Category, Source Fund, and Expense Type charts
- **Approved vs Committed** -- Side-by-side comparison per category
- **Budget Planning Tools** -- Unallocated funds breakdown, Hiring Capacity Calculator, SOW Cut Simulator, Scenario Planner, Budget Runway gauges, and an Allocation Sunburst chart
- **Monthly Timeline** -- Budget vs Forecast vs Actuals line chart with variance bars
- **Line Items Table** -- Searchable, sortable, filterable table of every budget row
- **Formula Audit** -- Automated findings from the spreadsheet's structure and formulas
- **Recommendations** -- Actionable improvements for budget management

## Tech Stack

| Layer | Tool |
|-------|------|
| Build | [Vite](https://vite.dev/) |
| Charts | [Chart.js](https://www.chartjs.org/) |
| Styling | Custom CSS (dark theme, responsive) |
| Data extraction | Python 3 + [openpyxl](https://openpyxl.readthedocs.io/) |

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/Budget-Sanity.git
cd Budget-Sanity

# 2. Install Node dependencies
npm install

# 3. Create a Python virtual environment and install openpyxl
python3 -m venv .venv
.venv/bin/pip install openpyxl

# 4. Place your Excel budget file in the project root
#    The extractor expects: CDO Budget - 2026-02-08.xlsx
#    (update the EXCEL_PATH in extract_budget.py if your filename differs)

# 5. Run the data extraction
npm run extract

# 6. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Refreshing Data

After updating the Excel file, you can re-extract in two ways:

- **From the terminal:** `npm run extract`, then refresh the browser
- **From the dashboard:** Click the refresh icon (↻) in the top-right navbar -- this triggers extraction and reloads the page automatically

## Building for Production

```bash
npm run build
```

The output goes to `dist/`. Preview it locally with:

```bash
npm run preview
```

## Project Structure

```
Budget-Sanity/
├── extract_budget.py      # Python script: Excel → JSON
├── index.html             # Main HTML shell
├── package.json
├── vite.config.js         # Vite config + extract plugin
├── public/                # Static assets served at /
└── src/
    ├── main.js            # All dashboard logic (KPIs, charts, tables, planning tools)
    ├── style.css           # Custom dark-theme stylesheet
    └── data/
        └── budget.json    # Generated data file (do not edit manually)
```
