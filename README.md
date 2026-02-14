# Budget Sanity

An interactive budget dashboard for the Corporate Data Office (CDO) FY2026 budget. It reads a source Excel workbook, extracts the data, and presents it as a modern single-page web app with charts, KPIs, variance analysis, and interactive planning tools.

The app can run locally (Python extraction from Excel) or be deployed to **Vercel + Supabase** for shared access — leadership opens the URL and sees the latest budget data without needing the file.

## What's Inside

- **KPI Cards** — Approved Budget, Forecast, Unallocated, Pending Approval, YTD Actuals, Forecast Remaining, Projected Annual (with hover tooltips explaining each calculation)
- **Budget Breakdown** — Category, Source Fund, Expense Type, and Vendor charts with filters
- **Approved vs Committed** — Side-by-side comparison per category with fund filter
- **Budget Planning Tools** — Unallocated funds breakdown, Hiring Capacity Calculator, SOW Cut Simulator, Scenario Planner, Budget Runway gauges, and an interactive Allocation Sunburst chart
- **Spend Heatmap** — Category × Month matrix with Forecast/Actuals/Variance toggle
- **Monthly Timeline** — Budget vs Forecast vs Actuals line chart with variance bars
- **Line Items Table** — Searchable, sortable, filterable table of every budget row
- **Formula Audit** — Automated findings from the spreadsheet's structure and formulas
- **Recommendations** — Actionable improvements for budget management

## Architecture

```
Local Dev:  Excel → extract_budget.py → budget.json → Vite dev server
Hosted:     Admin uploads .xlsx → client-side parse → Vercel API → Supabase
            Leadership visits URL → dashboard loads from Supabase (no login)
```

## Tech Stack

| Layer | Tool |
|-------|------|
| Build | [Vite](https://vite.dev/) |
| Charts | [Chart.js](https://www.chartjs.org/) |
| Styling | Custom CSS (dark theme, responsive) |
| Data extraction (local) | Python 3 + [openpyxl](https://openpyxl.readthedocs.io/) |
| Data extraction (hosted) | [SheetJS](https://sheetjs.com/) (client-side) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL + JSONB) |
| Hosting | [Vercel](https://vercel.com/) |

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+ (for local extraction only)

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

# 4. Place your Excel budget file
#    Update EXCEL_PATH in extract_budget.py if your filename differs

# 5. Run the data extraction
npm run extract

# 6. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Refreshing Data (Local)

After updating the Excel file:

- **From the terminal:** `npm run extract`, then refresh the browser
- **From the dashboard:** Click the refresh icon in the top-right navbar — this triggers extraction and reloads automatically

**Important:** Before refreshing, open the Excel file in Excel, press **Cmd+Shift+F9** to force recalculation, and save. This ensures formula results (actuals, totals) are up to date.

## Deploying to Vercel + Supabase

### 1. Supabase Setup

Create a Supabase project and run this in the SQL Editor:

```sql
CREATE TABLE budget_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uploaded_at timestamptz DEFAULT now(),
  data jsonb NOT NULL
);

ALTER TABLE budget_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON budget_snapshots FOR SELECT
  USING (true);
```

### 2. Environment Variables

In the **Vercel dashboard** (Settings → Environment Variables), set:

| Variable | Scope | Description |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | All | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | All | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (never exposed to browser) |
| `UPLOAD_SECRET` | Server only | Passphrase for upload authentication |

For **local dev with Supabase**, copy `.env.local` and fill in the values.

### 3. Connect and Deploy

1. Push the repo to GitHub
2. Import the repo in Vercel
3. Vercel auto-detects the Vite build (`npx vite build`, output `dist/`)
4. Every push triggers an automatic deploy

### 4. Uploading Budget Data

1. Navigate to your Vercel URL with `?admin=YOUR_SECRET` appended
2. The upload panel appears in the top-right
3. Drop your `.xlsx` file — it's parsed in the browser
4. Review the preview (line items, totals)
5. Click "Confirm Upload" — data is stored in Supabase
6. Leadership can now view the dashboard at the plain URL

## Building for Production

```bash
npm run build
```

The output goes to `dist/`. Preview locally with:

```bash
npm run preview
```

## Project Structure

```
Budget-Sanity/
├── api/
│   └── upload.js              # Vercel serverless function (auth + Supabase write)
├── extract_budget.py          # Python script: Excel → JSON (local dev)
├── index.html                 # Main HTML shell
├── package.json
├── vercel.json                # Vercel deployment config
├── vite.config.js             # Vite config + extract plugin
├── public/                    # Static assets served at /
└── src/
    ├── main.js                # Dashboard logic (KPIs, charts, tables, planning tools)
    ├── extract.js             # Client-side Excel → JSON (mirrors extract_budget.py)
    ├── style.css              # Custom dark-theme stylesheet
    └── data/
        └── budget.json        # Generated data file (local dev fallback)
```
