# Budget Sanity

An interactive budget dashboard for the Corporate Data Office (CDO) FY2026 budget. It reads a source Excel workbook, extracts the data, and presents it as a modern single-page web app with charts, KPIs, variance analysis, and interactive planning tools.

The app can run locally (Python extraction from Excel) or be deployed to **Vercel + Supabase** for shared access -- leadership opens the URL and sees the latest budget data without needing the file.

## Features

- **KPI Cards** -- Approved Budget, Forecast, Unallocated, Pending Approval, YTD Actuals, Forecast Remaining, and Spend Pace (with hover tooltips explaining each calculation)
- **Budget Breakdown** -- Category, Source Fund, Expense Type, and Vendor Spend Analysis charts with fund/vendor filters
- **Approved vs Committed** -- Side-by-side comparison per category showing committed SOWs, unallocated, and over-committed amounts
- **Budget Planning Tools** -- Unallocated funds breakdown, Hiring Capacity Calculator, SOW Cut Simulator, Scenario Planner, Budget Runway gauges, and an interactive Allocation Sunburst (drill-down) chart
- **Spend Heatmap** -- Category x Month intensity grid with Forecast, Actuals, and Variance modes
- **Monthly Timeline** -- Budget vs Forecast vs Actuals trend lines with monthly variance charts (budget-vs-actual and forecast-vs-actual)
- **Line Items Table** -- Full searchable, sortable, filterable table of every budget row with event type badges, unapproved row highlighting, and filtered totals
- **Formula Audit** -- Automated findings from the spreadsheet's structure and formulas, categorized by severity
- **Recommendations** -- Prioritized, actionable improvements for budget management with impact descriptions
- **Light/Dark Mode** -- Toggle in the nav bar with persistent preference via localStorage, fully themed across all charts and components
- **Admin Upload Panel** -- Drag-and-drop Excel upload with preview, confirmation, and passphrase authentication

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL DEVELOPMENT                                              │
│                                                                 │
│  Excel (.xlsx)                                                  │
│       │                                                         │
│       ▼                                                         │
│  extract_budget.py (Python + openpyxl)                          │
│       │                                                         │
│       ▼                                                         │
│  src/data/budget.json ──▶ Vite dev server ──▶ Browser           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PRODUCTION (Vercel + Supabase)                                 │
│                                                                 │
│  Admin visits ?admin=SECRET                                     │
│       │                                                         │
│       ▼                                                         │
│  Upload panel: drag & drop .xlsx                                │
│       │                                                         │
│       ▼                                                         │
│  Browser parses Excel (SheetJS + src/extract.js)                │
│       │                                                         │
│       ▼                                                         │
│  POST /api/upload (Bearer token auth)                           │
│       │                                                         │
│       ▼                                                         │
│  Vercel serverless function (api/upload.js)                     │
│       │                                                         │
│       ▼                                                         │
│  Supabase: INSERT into budget_snapshots (JSONB)                 │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                 │
│  User visits dashboard URL                                      │
│       │                                                         │
│       ▼                                                         │
│  Vercel serves static SPA (Vite build)                          │
│       │                                                         │
│       ▼                                                         │
│  main.js fetches latest snapshot from Supabase (anon key, RLS)  │
│       │                                                         │
│       ▼                                                         │
│  Dashboard renders: KPIs, charts, tables, planning tools        │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Extraction** -- Budget data starts as an Excel workbook with line items, monthly columns (budget, forecast, actuals), quarterly summaries, and a totals row. The extraction logic (Python locally, SheetJS in-browser for uploads) maps columns to a structured JSON format with `line_items`, `totals`, `by_category`, `by_source_fund`, `by_expense_type`, `audit_findings`, and `recommendations`.

2. **Storage** -- In production, the extracted JSON is stored as a JSONB column in Supabase's `budget_snapshots` table. Each upload creates a new row with a timestamp. The dashboard always reads the latest snapshot.

3. **Rendering** -- The SPA loads the JSON (from Supabase or local fallback), then renders all charts (Chart.js), KPIs, tables, and planning tools. Theme colors are read from CSS variables, so light/dark mode works across everything including charts.

### Security

- The upload endpoint (`/api/upload`) requires a Bearer token matching the `UPLOAD_SECRET` environment variable
- The admin panel is only shown when `?admin=SECRET` is in the URL
- Supabase Row Level Security (RLS) allows public read but no public write
- The service role key (used for writes) is only available server-side in the Vercel function
- No secrets are stored in client-side code; `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public read-only credentials

## Tech Stack

| Layer | Tool |
|-------|------|
| Build | [Vite](https://vite.dev/) |
| Charts | [Chart.js 4](https://www.chartjs.org/) |
| Styling | Custom CSS with semantic variables (light + dark themes, responsive) |
| Data extraction (local) | Python 3 + [openpyxl](https://openpyxl.readthedocs.io/) |
| Data extraction (hosted) | [SheetJS](https://sheetjs.com/) (client-side, in-browser) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL + JSONB) |
| Hosting | [Vercel](https://vercel.com/) (static SPA + serverless function) |
| Auth (upload) | Bearer token via environment variable |

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

```bash
npm run extract
```

Then refresh the browser. The Vite dev server also exposes a `POST /__extract` endpoint that the extraction plugin uses during development.

**Important:** Before extracting, open the Excel file in Excel, press **Cmd+Shift+F9** to force recalculation, and save. This ensures formula results (actuals, totals) are up to date.

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

In the **Vercel dashboard** (Settings > Environment Variables), set:

| Variable | Scope | Description |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | All | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | All | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Supabase service role key (never exposed to browser) |
| `UPLOAD_SECRET` | Server only | Passphrase for upload authentication |

For **local dev with Supabase**, create a `.env.local` file with the same variables.

### 3. Connect and Deploy

1. Push the repo to GitHub
2. Import the repo in Vercel
3. Vercel auto-detects the Vite build (`npx vite build`, output `dist/`)
4. Every push to `main` triggers an automatic deploy

### 4. Uploading Budget Data

1. Navigate to your Vercel URL with `?admin=YOUR_SECRET` appended
2. The upload panel appears in the top-right corner
3. Drop your `.xlsx` file -- it's parsed entirely in the browser using SheetJS
4. Review the preview (line item count, approved budget, committed, YTD actuals)
5. Click **Confirm Upload** -- the JSON is sent to `/api/upload`, authenticated, and inserted into Supabase
6. The page reloads with the new data. Anyone visiting the dashboard URL now sees the updated numbers

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
├── src/
│   ├── main.js                # Dashboard logic (KPIs, charts, tables, planning tools, theme toggle)
│   ├── extract.js             # Client-side Excel → JSON extraction (SheetJS, mirrors Python logic)
│   ├── style.css              # Themed stylesheet (semantic variables, light/dark, responsive)
│   └── data/
│       └── budget.json        # Generated data file (local dev fallback)
├── extract_budget.py          # Python script: Excel → JSON (local dev)
├── index.html                 # Main HTML shell (nav, sections, upload panel)
├── package.json               # Dependencies: chart.js, @supabase/supabase-js, xlsx, vite
├── vite.config.js             # Vite config + dev extraction plugin
├── vercel.json                # Vercel deployment config (build, rewrites)
└── public/                    # Static assets served at /
```

## npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start local dev server with HMR |
| `build` | `vite build` | Production build to `dist/` |
| `preview` | `vite preview` | Preview production build locally |
| `extract` | `.venv/bin/python3 extract_budget.py` | Extract budget data from Excel to JSON |
