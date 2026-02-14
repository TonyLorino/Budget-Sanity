/**
 * Client-side budget extraction from Excel using SheetJS.
 * This mirrors extract_budget.py — same column mapping, same JSON structure.
 */
import * as XLSX from 'xlsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * Convert a cell value to a float, defaulting to 0.
 * @param {*} val
 * @returns {number}
 */
function safeFloat(val) {
  if (val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Read a cell value from the worksheet by 1-indexed row and column.
 * SheetJS uses 0-indexed addresses internally, so we convert.
 * @param {XLSX.WorkSheet} ws
 * @param {number} row - 1-indexed row
 * @param {number} col - 1-indexed column
 * @returns {*}
 */
function cellVal(ws, row, col) {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  const cell = ws[addr];
  return cell ? cell.v : null;
}

/**
 * Read a cell's formula string (if any).
 * @param {XLSX.WorkSheet} ws
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
function cellFormula(ws, row, col) {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  const cell = ws[addr];
  return cell && cell.f ? cell.f : '';
}

/**
 * Detect the maximum row in a worksheet.
 * @param {XLSX.WorkSheet} ws
 * @returns {number}
 */
function maxRow(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  return range.e.r + 1; // convert to 1-indexed
}

/**
 * Extract budget data from a SheetJS workbook.
 * Returns the identical JSON structure as extract_budget.py.
 * @param {XLSX.WorkBook} workbook
 * @returns {object}
 */
export function extractBudget(workbook) {
  const sheetName = '2026 Budget';
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
  }

  const wsMaxRow = maxRow(ws);

  // ---- Metadata ----
  const metadata = {
    title: 'CDO 2026 Budget',
    file: 'Uploaded via dashboard',
    sheet: sheetName,
    table_name: 'CDOBudget',
    total_columns: 97,
    total_line_items: 0,
    extracted_at: new Date().toISOString().slice(0, 10),
  };

  // ---- Column mapping (1-indexed) ----
  // A=1 Category, B=2 Event Type, C=3 Source Fund, D=4 Expense Type,
  // E=5 Vendor, F=6 Description, G=7 ITBO Line, H=8 SOW, I=9 ITBO, J=10 PO
  // K=11 Budget FY26, L=12 Committed FY26
  // M-X (13-24) Budget monthly Jan-Dec
  // Y-AB (25-28) Budget quarterly Q1-Q4
  // AC=29 Budget FY
  // AD-AO (30-41) Forecast monthly Jan-Dec
  // AP-AS (42-45) Forecast quarterly Q1-Q4
  // AT=46 Forecast FY
  // AU-BF (47-58) Actual monthly Jan-Dec
  // BG-BJ (59-62) Actual quarterly Q1-Q4
  // BK=63 Actual FY
  // BL-BW (64-75) BvF monthly Jan-Dec
  // CB=80 BvF FY
  // CC-CN (81-92) BvA monthly Jan-Dec
  // CS=97 BvA FY

  // ---- Detect totals row dynamically ----
  let totalsRow = null;
  for (let r = 3; r <= wsMaxRow; r++) {
    const val = String(cellVal(ws, r, 1) || '').trim().toLowerCase();
    if (val === 'total') {
      totalsRow = r;
      break;
    }
  }
  if (totalsRow === null) totalsRow = wsMaxRow;

  // ---- Extract line items ----
  const lineItems = [];
  for (let rowIdx = 3; rowIdx < totalsRow; rowIdx++) {
    const category = cellVal(ws, rowIdx, 1);
    const eventType = cellVal(ws, rowIdx, 2);
    if (!eventType) continue;

    const item = {
      row: rowIdx,
      category: String(category || ''),
      event_type: String(eventType || ''),
      source_fund: String(cellVal(ws, rowIdx, 3) || ''),
      expense_type: String(cellVal(ws, rowIdx, 4) || ''),
      vendor: String(cellVal(ws, rowIdx, 5) || ''),
      description: String(cellVal(ws, rowIdx, 6) || ''),
      itbo_line: String(cellVal(ws, rowIdx, 7) || ''),
      sow: String(cellVal(ws, rowIdx, 8) || ''),
      itbo: String(cellVal(ws, rowIdx, 9) || ''),
      po: String(cellVal(ws, rowIdx, 10) || ''),
    };

    item.budget_fy26 = safeFloat(cellVal(ws, rowIdx, 11));
    item.committed_fy26 = safeFloat(cellVal(ws, rowIdx, 12));

    // Budget monthly: 13-24
    item.budget_monthly = Array.from({ length: 12 }, (_, m) => safeFloat(cellVal(ws, rowIdx, 13 + m)));
    // Budget quarterly: 25-28
    item.budget_quarterly = Array.from({ length: 4 }, (_, q) => safeFloat(cellVal(ws, rowIdx, 25 + q)));
    // Budget FY: 29
    item.budget_fy = safeFloat(cellVal(ws, rowIdx, 29));

    // Forecast monthly: 30-41
    item.forecast_monthly = Array.from({ length: 12 }, (_, m) => safeFloat(cellVal(ws, rowIdx, 30 + m)));
    // Forecast quarterly: 42-45
    item.forecast_quarterly = Array.from({ length: 4 }, (_, q) => safeFloat(cellVal(ws, rowIdx, 42 + q)));
    // Forecast FY: 46
    item.forecast_fy = safeFloat(cellVal(ws, rowIdx, 46));

    // Actual monthly: 47-58
    item.actual_monthly = Array.from({ length: 12 }, (_, m) => safeFloat(cellVal(ws, rowIdx, 47 + m)));
    // Actual quarterly: 59-62
    item.actual_quarterly = Array.from({ length: 4 }, (_, q) => safeFloat(cellVal(ws, rowIdx, 59 + q)));
    // Actual FY: 63
    item.actual_fy = safeFloat(cellVal(ws, rowIdx, 63));

    // BvF monthly: 64-75
    item.bvf_monthly = Array.from({ length: 12 }, (_, m) => safeFloat(cellVal(ws, rowIdx, 64 + m)));
    // BvF FY: 80
    item.bvf_fy = safeFloat(cellVal(ws, rowIdx, 80));

    // BvA monthly: 81-92
    item.bva_monthly = Array.from({ length: 12 }, (_, m) => safeFloat(cellVal(ws, rowIdx, 81 + m)));
    // BvA FY: 97
    item.bva_fy = safeFloat(cellVal(ws, rowIdx, 97));

    // Committed formula
    item.committed_formula = cellFormula(ws, rowIdx, 12);

    lineItems.push(item);
  }

  metadata.total_line_items = lineItems.length;

  // ---- Totals row ----
  const tr = totalsRow;
  const totals = {
    budget_fy26: safeFloat(cellVal(ws, tr, 11)),
    committed_fy26: safeFloat(cellVal(ws, tr, 12)),
    budget_monthly: Array.from({ length: 12 }, (_, m) => safeFloat(cellVal(ws, tr, 13 + m))),
    budget_quarterly: Array.from({ length: 4 }, (_, q) => safeFloat(cellVal(ws, tr, 25 + q))),
    budget_fy: safeFloat(cellVal(ws, tr, 29)),
    forecast_monthly: Array.from({ length: 12 }, (_, m) => safeFloat(cellVal(ws, tr, 30 + m))),
    forecast_quarterly: Array.from({ length: 4 }, (_, q) => safeFloat(cellVal(ws, tr, 42 + q))),
    forecast_fy: safeFloat(cellVal(ws, tr, 46)),
    actual_monthly: Array.from({ length: 12 }, (_, m) => safeFloat(cellVal(ws, tr, 47 + m))),
    actual_quarterly: Array.from({ length: 4 }, (_, q) => safeFloat(cellVal(ws, tr, 59 + q))),
    actual_fy: safeFloat(cellVal(ws, tr, 63)),
    bvf_fy: safeFloat(cellVal(ws, tr, 80)),
    bva_fy: safeFloat(cellVal(ws, tr, 97)),
  };

  // ---- Aggregations ----
  const bySourceFund = {};
  const byExpenseType = {};
  const byCategory = {};
  const actualsDetail = [];

  for (const item of lineItems) {
    const fund = item.source_fund || 'Unspecified';
    bySourceFund[fund] = (bySourceFund[fund] || 0) + item.committed_fy26;

    const etype = item.expense_type || 'Unspecified';
    byExpenseType[etype] = (byExpenseType[etype] || 0) + item.committed_fy26;

    const cat = item.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + item.committed_fy26;

    if (item.actual_fy > 0) {
      actualsDetail.push({
        category: item.category,
        vendor: item.vendor,
        description: item.description,
        actual_fy: item.actual_fy,
      });
    }
  }

  // ---- Static audit findings ----
  const auditFindings = [
    {
      id: 1,
      severity: 'high',
      title: 'Over-Committed Budget Categories',
      detail: 'Contingent Labor D1: Approved $1.589M but SOWs total $1.646M (Committed remainder = -$56,562). EDA Budget Capex: Approved $313K but SOWs total $873K (Committed remainder = -$559,722). More is committed than the approved allocation.',
    },
    {
      id: 2,
      severity: 'medium',
      title: 'Flat Forecast Distribution',
      detail: 'Forecast monthly values use Committed / 12 (or / 11 for late starts). Categories like Travel, Training, and Marketing have lumpy real-world spending patterns. Consider seasonalizing these forecasts to improve monthly accuracy.',
    },
    {
      id: 3,
      severity: 'medium',
      title: 'Forecast Not Yet Rolling Forward',
      detail: 'As actuals are booked, Forecast should update to reflect remaining spend: (Committed - YTD Actuals) / remaining months. Currently Forecast still uses the original Committed / 12 even for months with actuals.',
    },
    {
      id: 4,
      severity: 'low',
      title: 'Floating-Point Rounding Artifacts',
      detail: 'Some totals show sub-penny rounding differences due to division-based formulas. Wrapping key formulas in ROUND() would eliminate this.',
    },
    {
      id: 5,
      severity: 'info',
      title: 'Budget = Approved Plan (Fixed Baseline)',
      detail: 'Budget monthly columns correctly reference Approved FY26 / 12 on Budget rows and are blank on SOW rows. This establishes the approved plan as an immutable baseline for variance analysis.',
    },
    {
      id: 6,
      severity: 'info',
      title: 'Forecast = Committed Best Estimate',
      detail: 'Forecast monthly columns reference Committed FY26 / 12 on both Budget remainder rows and SOW rows. Budget vs Forecast variance now shows the gap between the approved plan and current committed spend expectations.',
    },
    {
      id: 7,
      severity: 'info',
      title: 'Unapproved Items Separated',
      detail: "EDA Projects rows use 'Unapproved Budget' and 'Unapproved SOW' event types. These are excluded from approved budget rollups and shown separately in the dashboard as pending approval.",
    },
  ];

  // ---- Static recommendations ----
  const recommendations = [
    {
      id: 1,
      priority: 'high',
      title: 'Fix Over-Committed Categories',
      detail: 'Contingent Labor D1 and EDA Budget Capex have negative Committed remainders. Either increase the Approved allocation or reduce SOW commitments to bring them back in balance.',
      impact: 'Prevents unplanned budget overruns',
    },
    {
      id: 2,
      priority: 'high',
      title: 'Roll Forecast Forward with Actuals',
      detail: 'As monthly actuals are booked, update Forecast for remaining months to (Committed - YTD Actuals) / remaining months. This makes Forecast a living best estimate rather than a static plan.',
      impact: 'Accurate real-time financial visibility',
    },
    {
      id: 3,
      priority: 'medium',
      title: 'Seasonalize Forecast Allocations',
      detail: 'Replace flat Committed/12 with realistic monthly profiles for lumpy categories: Travel (conference months), Training (Q1/Q3), project ramp-ups (phased milestones).',
      impact: 'More accurate monthly Forecast vs Actual comparisons',
    },
    {
      id: 4,
      priority: 'medium',
      title: 'Add Percentage Variance Columns',
      detail: 'Add (Budget - Actual) / Budget percentage columns alongside the existing dollar variance. Percentages contextualize the magnitude of variances across different-sized line items.',
      impact: 'Better executive-level variance analysis',
    },
    {
      id: 5,
      priority: 'medium',
      title: 'Add Conditional Formatting in Excel',
      detail: 'Apply green/yellow/red color coding in the spreadsheet: red for negative Committed remainders, traffic-light colors for Budget vs Actual thresholds (>10% under = green, 0-10% = yellow, over = red).',
      impact: 'At-a-glance health indicators for budget status',
    },
    {
      id: 6,
      priority: 'low',
      title: 'Add Forecast vs Actual Variance Section',
      detail: 'Add a third variance section (Forecast - Actual) to measure forecasting accuracy. This completes the analysis triangle: Budget vs Actual, Budget vs Forecast, Forecast vs Actual.',
      impact: 'Measures and improves forecasting accuracy over time',
    },
    {
      id: 7,
      priority: 'low',
      title: 'Add Year-over-Year Comparison',
      detail: 'Pull 2025 Budget actuals into a YoY delta view. The 2025 Budget tab already exists with historical data.',
      impact: 'Trend analysis and planning improvement',
    },
  ];

  return {
    metadata,
    months: MONTHS,
    quarters: QUARTERS,
    line_items: lineItems,
    totals,
    by_source_fund: bySourceFund,
    by_expense_type: byExpenseType,
    by_category: byCategory,
    actuals_detail: actualsDetail,
    audit_findings: auditFindings,
    recommendations,
  };
}
