import { Chart, registerables } from 'chart.js';
import budgetData from './data/budget.json';

Chart.register(...registerables);

// ============================================================
// Chart.js global defaults
// ============================================================
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(51, 65, 85, 0.3)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
Chart.defaults.plugins.tooltip.titleColor = '#e2e8f0';
Chart.defaults.plugins.tooltip.bodyColor = '#94a3b8';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(51, 65, 85, 0.5)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.tooltip.boxPadding = 4;
Chart.defaults.animation.duration = 800;
Chart.defaults.animation.easing = 'easeOutQuart';

// ============================================================
// Helpers
// ============================================================
const fmt = (n) => {
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
};

const fmtFull = (n) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const pct = (n, d) => (d === 0 ? 0 : ((n / d) * 100));

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#ef4444', '#22d3ee',
];

// ============================================================
// Event type classification helpers
// ============================================================
const isApproved = (eventType) => eventType === 'Budget' || eventType === 'SOW';
const isUnapproved = (eventType) => eventType === 'Unapproved Budget' || eventType === 'Unapproved SOW';
const isBudgetType = (eventType) => eventType === 'Budget' || eventType === 'Unapproved Budget';
const isSOWType = (eventType) => eventType === 'SOW' || eventType === 'Unapproved SOW';

// Distinct source funds from data
const ALL_FUNDS = [...new Set(budgetData.line_items.map(i => i.source_fund))].sort();

// Reusable: populate a <select> with fund options
function populateFundFilter(selectEl) {
  ALL_FUNDS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    selectEl.appendChild(opt);
  });
}

// Chart instances for destroy/recreate pattern
let acChart = null;
let unallocChart = null;
let vendorChart = null;
let sunburstChart = null;

// ============================================================
// 1. KPI Cards
// ============================================================
function renderKPIs() {
  // Approved-only totals (exclude Unapproved Budget / Unapproved SOW)
  const approvedBudgetRows = budgetData.line_items.filter(i => i.event_type === 'Budget');
  const approvedSOWRows = budgetData.line_items.filter(i => i.event_type === 'SOW');
  const unapprovedBudgetRows = budgetData.line_items.filter(i => i.event_type === 'Unapproved Budget');
  const unapprovedSOWRows = budgetData.line_items.filter(i => i.event_type === 'Unapproved SOW');

  const approvedFY = approvedBudgetRows.reduce((s, i) => s + i.budget_fy26, 0);
  const committedSOWs = approvedSOWRows.reduce((s, i) => s + i.committed_fy26, 0);
  const forecastFY = [...approvedBudgetRows, ...approvedSOWRows].reduce((s, i) => s + i.forecast_fy, 0);
  const actualFY = budgetData.totals.actual_fy; // actuals include everything actually spent
  const remaining = forecastFY - actualFY;
  const pctSpent = pct(actualFY, forecastFY);

  const unallocated = approvedFY - committedSOWs;
  const pctUnallocated = pct(unallocated, approvedFY);

  const pendingBudget = unapprovedBudgetRows.reduce((s, i) => s + i.budget_fy26, 0);
  const pendingSOWs = unapprovedSOWRows.reduce((s, i) => s + i.committed_fy26, 0);

  const monthsElapsed = 1; // January only has actuals
  const burnRate = actualFY / monthsElapsed;
  const projectedAnnual = burnRate * 12;

  const kpis = [
    {
      label: 'Approved Budget',
      value: fmt(approvedFY),
      sub: `Approved plan baseline for FY2026`,
      accent: 'blue',
      progress: 100,
    },
    {
      label: 'Forecast (Committed)',
      value: fmt(forecastFY),
      sub: `Based on approved SOWs and remainders`,
      accent: 'violet',
      progress: pct(forecastFY, approvedFY),
    },
    {
      label: 'Unallocated',
      value: fmt(unallocated),
      sub: `${pctUnallocated.toFixed(1)}% of approved not yet in SOWs`,
      accent: unallocated > 0 ? 'cyan' : 'rose',
      progress: pctUnallocated,
    },
    {
      label: 'Pending Approval',
      value: fmt(pendingBudget),
      sub: `${unapprovedBudgetRows.length + unapprovedSOWRows.length} items awaiting approval`,
      accent: 'orange',
      progress: pct(pendingBudget, approvedFY),
    },
    {
      label: 'YTD Actuals',
      value: fmt(actualFY),
      sub: `${pctSpent.toFixed(1)}% of forecast spent`,
      accent: 'emerald',
      progress: pctSpent,
    },
    {
      label: 'Forecast Remaining',
      value: fmt(remaining),
      sub: `${(100 - pctSpent).toFixed(1)}% of forecast yet to spend`,
      accent: 'amber',
      progress: 100 - pctSpent,
    },
    {
      label: 'Projected Annual',
      value: fmt(projectedAnnual),
      sub: projectedAnnual > approvedFY
        ? `${fmt(projectedAnnual - approvedFY)} over approved budget`
        : `${fmt(approvedFY - projectedAnnual)} under approved budget`,
      accent: projectedAnnual > approvedFY ? 'rose' : 'emerald',
      progress: (projectedAnnual / approvedFY) * 100,
    },
  ];

  const container = document.getElementById('kpi-cards');
  container.innerHTML = kpis
    .map(
      (k) => `
    <div class="kpi-card" data-accent="${k.accent}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
      ${k.progress !== undefined ? `
      <div class="kpi-progress">
        <div class="kpi-progress-bar accent-${k.accent}" style="width: 0%;" data-target="${Math.min(k.progress, 100)}"></div>
      </div>` : ''}
    </div>
  `
    )
    .join('');

  // Animate progress bars after a short delay
  requestAnimationFrame(() => {
    setTimeout(() => {
      container.querySelectorAll('.kpi-progress-bar').forEach((bar) => {
        bar.style.width = bar.dataset.target + '%';
      });
    }, 300);
  });
}

// ============================================================
// 2. Category Bar Chart
// ============================================================
function renderCategoryChart() {
  const cats = budgetData.by_category;
  const labels = Object.keys(cats).filter((k) => cats[k] > 0);
  const values = labels.map((l) => cats[l]);

  new Chart(document.getElementById('chart-category'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: PALETTE.slice(0, labels.length).map((c) => c + '99'),
          borderColor: PALETTE.slice(0, labels.length),
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.7,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + fmtFull(ctx.raw),
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: {
            callback: (v) => fmt(v),
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { size: 11 },
          },
        },
      },
    },
  });
}

// ============================================================
// 3. Source Fund Doughnut
// ============================================================
function renderFundChart() {
  const funds = budgetData.by_source_fund;
  const labels = Object.keys(funds);
  const values = labels.map((l) => funds[l]);

  new Chart(document.getElementById('chart-fund'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: PALETTE.slice(0, labels.length),
          borderColor: 'rgba(2, 6, 23, 0.8)',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 8,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 10 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pctVal = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${fmtFull(ctx.raw)} (${pctVal}%)`;
            },
          },
        },
      },
    },
  });
}

// ============================================================
// 4. Expense Type Doughnut
// ============================================================
function renderExpenseChart() {
  const types = budgetData.by_expense_type;
  const labels = Object.keys(types);
  const values = labels.map((l) => types[l]);

  new Chart(document.getElementById('chart-expense'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#3b82f6', '#f59e0b'],
          borderColor: 'rgba(2, 6, 23, 0.8)',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 8,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 10 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pctVal = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${fmtFull(ctx.raw)} (${pctVal}%)`;
            },
          },
        },
      },
    },
  });
}

// ============================================================
// 5. Monthly Timeline (Budget vs Forecast vs Actuals)
// ============================================================
function renderTimelineChart() {
  const months = budgetData.months;
  const budgetMonthly = budgetData.totals.budget_monthly;
  const forecastMonthly = budgetData.totals.forecast_monthly;
  const actualMonthly = budgetData.totals.actual_monthly;

  new Chart(document.getElementById('chart-timeline'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Budget',
          data: budgetMonthly,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#020617',
          pointBorderWidth: 2,
        },
        {
          label: 'Forecast',
          data: forecastMonthly,
          borderColor: '#8b5cf6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#020617',
          pointBorderWidth: 2,
        },
        {
          label: 'Actuals',
          data: actualMonthly,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#020617',
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${fmtFull(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(51, 65, 85, 0.15)' },
        },
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: {
            callback: (v) => fmt(v),
          },
        },
      },
    },
  });
}

// ============================================================
// 6. Variance Bar Chart (Budget vs Actual)
// ============================================================
function renderVarianceChart() {
  const months = budgetData.months;
  const budgetMonthly = budgetData.totals.budget_monthly;
  const actualMonthly = budgetData.totals.actual_monthly;
  const variance = budgetMonthly.map((b, i) => b - actualMonthly[i]);

  new Chart(document.getElementById('chart-variance'), {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Variance (Budget - Actual)',
          data: variance,
          backgroundColor: variance.map((v) =>
            v >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)'
          ),
          borderColor: variance.map((v) =>
            v >= 0 ? '#10b981' : '#f43f5e'
          ),
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              const sign = val >= 0 ? 'Under' : 'Over';
              return ` ${sign} budget by ${fmtFull(Math.abs(val))}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: { callback: (v) => fmt(v) },
        },
      },
    },
  });
}

// ============================================================
// 6b. Forecast vs Actual Variance Chart
// ============================================================
function renderForecastVarianceChart() {
  const months = budgetData.months;
  const forecastMonthly = budgetData.totals.forecast_monthly;
  const actualMonthly = budgetData.totals.actual_monthly;
  const variance = forecastMonthly.map((f, i) => f - actualMonthly[i]);

  new Chart(document.getElementById('chart-forecast-variance'), {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Variance (Forecast - Actual)',
          data: variance,
          backgroundColor: variance.map((v) =>
            v >= 0 ? 'rgba(139, 92, 246, 0.6)' : 'rgba(244, 63, 94, 0.6)'
          ),
          borderColor: variance.map((v) =>
            v >= 0 ? '#8b5cf6' : '#f43f5e'
          ),
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              const sign = val >= 0 ? 'Under' : 'Over';
              return ` ${sign} forecast by ${fmtFull(Math.abs(val))}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: { callback: (v) => fmt(v) },
        },
      },
    },
  });
}

// ============================================================
// 6c. Approved vs Committed by Category (approved only)
// ============================================================
function renderApprovedCommittedChart(fundFilter = '') {
  if (acChart) { acChart.destroy(); acChart = null; }

  const catMap = {};
  budgetData.line_items.forEach((item) => {
    if (isUnapproved(item.event_type)) return;
    if (fundFilter && item.source_fund !== fundFilter) return;
    const cat = item.category || 'Other';
    if (!catMap[cat]) catMap[cat] = { approved: 0, sowCommitted: 0 };
    if (item.event_type === 'Budget') {
      catMap[cat].approved += item.budget_fy26;
    } else if (item.event_type === 'SOW') {
      catMap[cat].sowCommitted += item.committed_fy26;
    }
  });

  const entries = Object.entries(catMap)
    .filter(([, v]) => v.approved > 0)
    .sort((a, b) => b[1].approved - a[1].approved);

  const labels = entries.map(([k]) => k);
  const approvedData = entries.map(([, v]) => v.approved);
  const committedData = entries.map(([, v]) => v.sowCommitted);
  const unallocatedData = entries.map(([, v]) => Math.max(0, v.approved - v.sowCommitted));

  acChart = new Chart(document.getElementById('chart-approved-committed'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Approved',
          data: approvedData,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.8,
          categoryPercentage: 0.7,
        },
        {
          label: 'Committed (SOWs)',
          data: committedData,
          backgroundColor: 'rgba(139, 92, 246, 0.7)',
          borderColor: '#8b5cf6',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.8,
          categoryPercentage: 0.7,
        },
        {
          label: 'Unallocated',
          data: unallocatedData,
          backgroundColor: 'rgba(245, 158, 11, 0.5)',
          borderColor: '#f59e0b',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.8,
          categoryPercentage: 0.7,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${fmtFull(ctx.raw)}`,
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              const approved = approvedData[idx];
              const committed = committedData[idx];
              const gap = approved - committed;
              if (gap < 0) {
                return `  Over-committed by ${fmtFull(Math.abs(gap))}`;
              }
              return '';
            },
          },
        },
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: { callback: (v) => fmt(v) },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

// ============================================================
// 7. Line Items Table
// ============================================================
let sortState = { key: 'committed_fy26', dir: 'desc' };
let filterState = { search: '', fund: '', type: '', event: '' };

function getFilteredItems() {
  let items = [...budgetData.line_items];

  // Filters
  if (filterState.search) {
    const q = filterState.search.toLowerCase();
    items = items.filter(
      (i) =>
        (i.category || '').toLowerCase().includes(q) ||
        (i.vendor || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.sow || '').toLowerCase().includes(q)
    );
  }
  if (filterState.fund) items = items.filter((i) => i.source_fund === filterState.fund);
  if (filterState.type) items = items.filter((i) => i.expense_type === filterState.type);
  if (filterState.event) items = items.filter((i) => i.event_type === filterState.event);

  // Sort
  items.sort((a, b) => {
    let va = a[sortState.key] ?? '';
    let vb = b[sortState.key] ?? '';
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortState.dir === 'asc' ? va - vb : vb - va;
    }
    va = String(va).toLowerCase();
    vb = String(vb).toLowerCase();
    return sortState.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  return items;
}

function eventBadgeClass(eventType) {
  if (eventType === 'Budget') return 'badge-info';
  if (eventType === 'SOW') return 'badge-medium';
  if (eventType === 'Unapproved Budget') return 'badge-unapproved';
  if (eventType === 'Unapproved SOW') return 'badge-unapproved';
  return 'badge-low';
}

function renderTable() {
  const items = getFilteredItems();
  const tbody = document.getElementById('table-body');
  const tfoot = document.getElementById('table-foot');
  const stats = document.getElementById('table-stats');

  // Compute filtered totals
  const totApproved = items.reduce((s, i) => s + i.budget_fy26, 0);
  const totCommitted = items.reduce((s, i) => s + i.committed_fy26, 0);
  const totForecast = items.reduce((s, i) => s + i.forecast_fy, 0);
  const totActual = items.reduce((s, i) => s + i.actual_fy, 0);
  const totVariance = totForecast - totActual;
  const totPct = totForecast === 0 ? 0 : (totActual / totForecast) * 100;

  tbody.innerHTML = items
    .map((item) => {
      const variance = item.forecast_fy - item.actual_fy;
      const pctSpent = item.forecast_fy === 0 ? 0 : (item.actual_fy / item.forecast_fy) * 100;
      const isBudgetRow = isBudgetType(item.event_type);
      const unapproved = isUnapproved(item.event_type);
      const varClass = variance >= 0 ? 'val-positive' : 'val-negative';
      const pctClass = pctSpent > 100 ? 'val-negative' : pctSpent > 0 ? 'val-positive' : 'val-zero';
      const approvedDisplay = item.budget_fy26 > 0 ? fmtFull(item.budget_fy26) : '';
      const committedClass = item.committed_fy26 < 0 ? 'val-negative' : '';
      const rowClass = unapproved ? 'unapproved-row' : (isBudgetRow ? 'budget-row' : '');

      return `<tr class="table-row ${rowClass}">
        <td class="table-td">${item.category || ''}</td>
        <td class="table-td"><span class="badge ${eventBadgeClass(item.event_type)}">${item.event_type}</span></td>
        <td class="table-td">${item.source_fund || ''}</td>
        <td class="table-td"><span class="badge badge-${item.expense_type === 'Capex' ? 'high' : 'low'}">${item.expense_type}</span></td>
        <td class="table-td text-slate-400">${item.vendor}</td>
        <td class="table-td text-slate-400" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${item.description}">${item.description}</td>
        <td class="table-td text-right font-medium text-blue-400">${approvedDisplay}</td>
        <td class="table-td text-right font-medium ${committedClass}">${fmtFull(item.committed_fy26)}</td>
        <td class="table-td text-right">${fmtFull(item.forecast_fy)}</td>
        <td class="table-td text-right ${item.actual_fy > 0 ? 'val-positive font-medium' : 'val-zero'}">${fmtFull(item.actual_fy)}</td>
        <td class="table-td text-right ${varClass}">${fmtFull(variance)}</td>
        <td class="table-td text-right ${pctClass}">${pctSpent.toFixed(1)}%</td>
      </tr>`;
    })
    .join('');

  tfoot.innerHTML = `<tr>
    <td colspan="6" class="text-right font-bold">Filtered Total</td>
    <td class="text-right">${fmtFull(totApproved)}</td>
    <td class="text-right">${fmtFull(totCommitted)}</td>
    <td class="text-right">${fmtFull(totForecast)}</td>
    <td class="text-right">${fmtFull(totActual)}</td>
    <td class="text-right">${fmtFull(totVariance)}</td>
    <td class="text-right">${totPct.toFixed(1)}%</td>
  </tr>`;

  stats.textContent = `Showing ${items.length} of ${budgetData.line_items.length} line items`;

  // Update sort indicators
  document.querySelectorAll('.table-th.sortable').forEach((th) => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.sort === sortState.key) {
      th.classList.add(sortState.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

function initTableControls() {
  // Populate filter dropdowns
  const funds = [...new Set(budgetData.line_items.map((i) => i.source_fund))].sort();
  const types = [...new Set(budgetData.line_items.map((i) => i.expense_type))].sort();
  const events = [...new Set(budgetData.line_items.map((i) => i.event_type))].sort();

  const fundSelect = document.getElementById('filter-fund');
  funds.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    fundSelect.appendChild(opt);
  });

  const typeSelect = document.getElementById('filter-type');
  types.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  const eventSelect = document.getElementById('filter-event');
  events.forEach((e) => {
    const opt = document.createElement('option');
    opt.value = e;
    opt.textContent = e;
    eventSelect.appendChild(opt);
  });

  // Search
  document.getElementById('table-search').addEventListener('input', (e) => {
    filterState.search = e.target.value;
    renderTable();
  });

  // Filters
  fundSelect.addEventListener('change', (e) => {
    filterState.fund = e.target.value;
    renderTable();
  });
  typeSelect.addEventListener('change', (e) => {
    filterState.type = e.target.value;
    renderTable();
  });
  eventSelect.addEventListener('change', (e) => {
    filterState.event = e.target.value;
    renderTable();
  });

  // Sort
  document.querySelectorAll('.table-th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortState.key === key) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = key;
        sortState.dir = 'desc';
      }
      renderTable();
    });
  });
}

// ============================================================
// 8. Audit Cards
// ============================================================
function renderAudit() {
  const container = document.getElementById('audit-cards');
  container.innerHTML = budgetData.audit_findings
    .map(
      (f) => `
    <div class="audit-card severity-${f.severity}">
      <div class="flex items-center gap-2 mb-2">
        <span class="badge badge-${f.severity}">${f.severity.toUpperCase()}</span>
        <span class="audit-title">${f.title}</span>
      </div>
      <p class="audit-detail">${f.detail}</p>
    </div>
  `
    )
    .join('');
}

// ============================================================
// 9. Recommendation Cards
// ============================================================
function renderRecommendations() {
  const container = document.getElementById('rec-cards');
  container.innerHTML = budgetData.recommendations
    .map(
      (r) => `
    <div class="rec-card">
      <div class="flex items-center gap-3">
        <span class="rec-number priority-${r.priority}">${r.id}</span>
        <span class="rec-title">${r.title}</span>
      </div>
      <p class="rec-detail">${r.detail}</p>
      <div class="rec-impact"><strong>Impact:</strong> ${r.impact}</div>
    </div>
  `
    )
    .join('');
}

// ============================================================
// 10. Navigation
// ============================================================
function initNav() {
  // Mobile menu toggle
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  btn.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });

  // Close mobile menu on link click
  menu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => menu.classList.add('hidden'));
  });

  // Active nav link on scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    },
    { rootMargin: '-30% 0px -60% 0px' }
  );

  sections.forEach((s) => observer.observe(s));
}

// ============================================================
// 11. Scroll Reveal Animation
// ============================================================
function initScrollReveal() {
  const sections = document.querySelectorAll('.animate-fade-in-up');

  // Initially hide sections below fold
  sections.forEach((section) => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.transition = 'opacity 0.7s ease-out, transform 0.7s ease-out';
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: '0px 0px -50px 0px' }
  );

  sections.forEach((s) => observer.observe(s));
}

// ============================================================
// 12. Navbar scroll shadow
// ============================================================
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        if (window.scrollY > 20) {
          navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.3)';
          navbar.style.borderColor = 'rgba(51, 65, 85, 0.4)';
        } else {
          navbar.style.boxShadow = 'none';
          navbar.style.borderColor = 'rgba(30, 41, 59, 0.5)';
        }
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ============================================================
// 13. Budget Planning Tools -- shared data
// ============================================================
function getCategoryUnallocated(fundFilter = '') {
  const catMap = {};
  budgetData.line_items.forEach((item) => {
    if (isUnapproved(item.event_type)) return;
    if (fundFilter && item.source_fund !== fundFilter) return;
    const cat = item.category || 'Other';
    if (!catMap[cat]) catMap[cat] = { budget: 0, sowCommitted: 0, sows: [] };
    if (item.event_type === 'Budget') {
      catMap[cat].budget += item.budget_fy26;
    } else if (item.event_type === 'SOW') {
      catMap[cat].sowCommitted += item.committed_fy26;
      catMap[cat].sows.push(item);
    }
  });
  return catMap;
}

function getSOWAverages() {
  const cl = budgetData.line_items.filter(i => i.event_type === 'SOW' && i.category.includes('Contingent Labor'));
  const ps = budgetData.line_items.filter(i => i.event_type === 'SOW' && i.category.includes('Professional Services'));
  return {
    cl: cl.length > 0 ? cl.reduce((s, i) => s + i.committed_fy26, 0) / cl.length : 250000,
    ps: ps.length > 0 ? ps.reduce((s, i) => s + i.committed_fy26, 0) / ps.length : 350000,
  };
}

// ============================================================
// 13a. Tool 1: Unallocated Funds Breakdown
// ============================================================
function renderUnallocatedBreakdown(fundFilter = '') {
  if (unallocChart) { unallocChart.destroy(); unallocChart = null; }

  const catMap = getCategoryUnallocated(fundFilter);
  const entries = Object.entries(catMap)
    .filter(([, v]) => v.budget > 0)
    .sort((a, b) => (b[1].budget - b[1].sowCommitted) - (a[1].budget - a[1].sowCommitted));

  const labels = entries.map(([k]) => k);
  const committedData = entries.map(([, v]) => v.sowCommitted);
  const unallocData = entries.map(([, v]) => Math.max(0, v.budget - v.sowCommitted));
  const overData = entries.map(([, v]) => Math.max(0, v.sowCommitted - v.budget));

  unallocChart = new Chart(document.getElementById('chart-unallocated'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Committed SOWs',
          data: committedData,
          backgroundColor: 'rgba(139, 92, 246, 0.7)',
          borderColor: '#8b5cf6',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Unallocated',
          data: unallocData,
          backgroundColor: 'rgba(6, 182, 212, 0.6)',
          borderColor: '#06b6d4',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Over-committed',
          data: overData,
          backgroundColor: 'rgba(244, 63, 94, 0.6)',
          borderColor: '#f43f5e',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 10, boxHeight: 10, padding: 12, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmtFull(ctx.raw)}` } },
      },
      scales: {
        x: { stacked: true, grid: { color: 'rgba(51, 65, 85, 0.2)' }, ticks: { callback: (v) => fmt(v) } },
        y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
      },
    },
  });

  // Summary table
  const totalBudget = entries.reduce((s, [, v]) => s + v.budget, 0);
  const totalSow = entries.reduce((s, [, v]) => s + v.sowCommitted, 0);
  const totalUnalloc = totalBudget - totalSow;

  document.getElementById('unallocated-table').innerHTML = `
    <div class="overflow-x-auto rounded-xl border border-slate-800/50">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-800/40 text-slate-400 text-left">
          <th class="table-th">Category</th>
          <th class="table-th text-right">Budget</th>
          <th class="table-th text-right">Committed</th>
          <th class="table-th text-right">Unallocated</th>
          <th class="table-th text-right">% Available</th>
        </tr></thead>
        <tbody>
          ${entries.map(([cat, v]) => {
            const unalloc = v.budget - v.sowCommitted;
            const pctAvail = v.budget > 0 ? (unalloc / v.budget * 100) : 0;
            const cls = unalloc < 0 ? 'val-negative' : unalloc > 0 ? 'val-positive' : 'val-zero';
            return `<tr class="table-row">
              <td class="table-td font-medium">${cat}</td>
              <td class="table-td text-right">${fmtFull(v.budget)}</td>
              <td class="table-td text-right">${fmtFull(v.sowCommitted)}</td>
              <td class="table-td text-right font-semibold ${cls}">${fmtFull(unalloc)}</td>
              <td class="table-td text-right ${cls}">${pctAvail.toFixed(0)}%</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr>
          <td class="table-td font-bold text-right">Total</td>
          <td class="table-td text-right font-bold">${fmtFull(totalBudget)}</td>
          <td class="table-td text-right font-bold">${fmtFull(totalSow)}</td>
          <td class="table-td text-right font-bold ${totalUnalloc >= 0 ? 'val-positive' : 'val-negative'}">${fmtFull(totalUnalloc)}</td>
          <td class="table-td text-right font-bold">${totalBudget > 0 ? (totalUnalloc / totalBudget * 100).toFixed(0) : 0}%</td>
        </tr></tfoot>
      </table>
    </div>`;
}

// ============================================================
// 13b. Tool 2: Hiring Capacity Calculator
// ============================================================
function initHiringCalculator() {
  const catMap = getCategoryUnallocated();
  const avgs = getSOWAverages();
  const catSelect = document.getElementById('calc-category');
  const rateSlider = document.getElementById('calc-rate');
  const rateDisplay = document.getElementById('calc-rate-display');
  const durationSlider = document.getElementById('calc-duration');
  const durationDisplay = document.getElementById('calc-duration-display');
  const output = document.getElementById('calc-output');
  const toggleBtns = document.querySelectorAll('#calc-role-toggle .calc-toggle-btn');

  // Populate category dropdown
  Object.entries(catMap)
    .filter(([, v]) => v.budget - v.sowCommitted > 0)
    .sort((a, b) => (b[1].budget - b[1].sowCommitted) - (a[1].budget - a[1].sowCommitted))
    .forEach(([cat, v]) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${cat} (${fmt(v.budget - v.sowCommitted)} available)`;
      catSelect.appendChild(opt);
    });

  let currentRole = 'cl';

  function update() {
    const catVal = catSelect.value;
    let pool;
    if (catVal === '__all__') {
      pool = Object.values(catMap).reduce((s, v) => s + Math.max(0, v.budget - v.sowCommitted), 0);
    } else {
      const c = catMap[catVal];
      pool = c ? Math.max(0, c.budget - c.sowCommitted) : 0;
    }

    const annualRate = parseInt(rateSlider.value);
    const months = parseInt(durationSlider.value);
    const proRatedCost = annualRate * (months / 12);
    const headcount = Math.floor(pool / proRatedCost);
    const totalCost = headcount * proRatedCost;
    const remaining = pool - totalCost;
    const usedPct = pool > 0 ? (totalCost / pool * 100) : 0;

    rateDisplay.textContent = fmtFull(annualRate);
    durationDisplay.textContent = `${months} month${months > 1 ? 's' : ''}`;

    output.innerHTML = `
      <div class="calc-result-grid">
        <div class="calc-result-card">
          <div class="calc-result-value">${headcount}</div>
          <div class="calc-result-label">${currentRole === 'cl' ? 'Contractors' : 'Engagements'} at ${fmtFull(annualRate)}/yr for ${months}mo</div>
        </div>
        <div class="calc-result-card">
          <div class="calc-result-value">${fmtFull(totalCost)}</div>
          <div class="calc-result-label">Total cost</div>
        </div>
        <div class="calc-result-card">
          <div class="calc-result-value ${remaining > 0 ? 'val-positive' : ''}">${fmtFull(remaining)}</div>
          <div class="calc-result-label">Remaining after hires</div>
        </div>
      </div>
      <div class="calc-bar-container mt-3">
        <div class="calc-bar-track">
          <div class="calc-bar-fill" style="width: ${Math.min(usedPct, 100)}%"></div>
        </div>
        <div class="flex justify-between text-xs text-slate-500 mt-1">
          <span>${fmtFull(totalCost)} used</span>
          <span>${fmtFull(pool)} available</span>
        </div>
      </div>`;
  }

  // Toggle role type
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRole = btn.dataset.role;
      rateSlider.value = currentRole === 'cl' ? Math.round(avgs.cl) : Math.round(avgs.ps);
      update();
    });
  });

  rateSlider.addEventListener('input', update);
  durationSlider.addEventListener('input', update);
  catSelect.addEventListener('change', update);

  // Initial render
  rateSlider.value = Math.round(avgs.cl);
  update();
}

// ============================================================
// 13c. Tool 3: SOW Cut Simulator
// ============================================================
function initSOWCutSimulator() {
  const catMap = getCategoryUnallocated();
  const avgs = getSOWAverages();
  const sowSelect = document.getElementById('cut-sow');
  const actionBtns = document.querySelectorAll('#cut-action-toggle .calc-toggle-btn');
  const amountRow = document.getElementById('cut-amount-row');
  const amountSlider = document.getElementById('cut-amount');
  const amountDisplay = document.getElementById('cut-amount-display');
  const output = document.getElementById('cut-output');

  // Populate SOW dropdown
  const approvedSOWs = budgetData.line_items.filter(i => i.event_type === 'SOW');
  approvedSOWs
    .sort((a, b) => b.committed_fy26 - a.committed_fy26)
    .forEach((sow, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${sow.category} - ${sow.vendor || sow.description} (${fmtFull(sow.committed_fy26)})`;
      sowSelect.appendChild(opt);
    });

  let action = 'full';

  function update() {
    const sowIdx = sowSelect.value;
    if (sowIdx === '') {
      output.innerHTML = '<p class="text-slate-600 text-sm">Select a SOW to simulate cutting it</p>';
      return;
    }

    const sow = approvedSOWs[parseInt(sowIdx)];
    const freed = action === 'full' ? sow.committed_fy26 : Math.min(parseInt(amountSlider.value), sow.committed_fy26);
    const catData = catMap[sow.category];
    const currentUnalloc = catData ? catData.budget - catData.sowCommitted : 0;
    const newUnalloc = currentUnalloc + freed;
    const totalUnalloc = Object.values(catMap).reduce((s, v) => s + Math.max(0, v.budget - v.sowCommitted), 0) + freed;

    // What could freed funds buy?
    const clCount = Math.floor(freed / (avgs.cl * 11 / 12));
    const psCount = Math.floor(freed / (avgs.ps * 11 / 12));

    amountDisplay.textContent = fmtFull(freed);

    output.innerHTML = `
      <div class="calc-result-grid">
        <div class="calc-result-card">
          <div class="calc-result-value val-positive">+${fmtFull(freed)}</div>
          <div class="calc-result-label">Freed funds</div>
        </div>
        <div class="calc-result-card">
          <div class="calc-result-value">${fmtFull(newUnalloc)}</div>
          <div class="calc-result-label">${sow.category} unallocated</div>
        </div>
        <div class="calc-result-card">
          <div class="calc-result-value">${fmtFull(totalUnalloc)}</div>
          <div class="calc-result-label">Total unallocated</div>
        </div>
      </div>
      <div class="calc-equivalents mt-3">
        <span class="text-xs text-slate-500">Freed funds could hire:</span>
        <span class="badge badge-medium ml-2">${clCount} contractor${clCount !== 1 ? 's' : ''}</span>
        <span class="text-xs text-slate-600 mx-1">or</span>
        <span class="badge badge-low">${psCount} PS engagement${psCount !== 1 ? 's' : ''}</span>
        <span class="text-xs text-slate-600 ml-1">(11mo, avg rates)</span>
      </div>`;
  }

  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      actionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      action = btn.dataset.action;
      amountRow.style.display = action === 'reduce' ? '' : 'none';
      update();
    });
  });

  sowSelect.addEventListener('change', () => {
    const sowIdx = sowSelect.value;
    if (sowIdx !== '') {
      const sow = approvedSOWs[parseInt(sowIdx)];
      amountSlider.max = sow.committed_fy26;
      amountSlider.value = Math.round(sow.committed_fy26 / 2);
    }
    update();
  });

  amountSlider.addEventListener('input', update);
  update();
}

// ============================================================
// 13d. Tool 4: Scenario Planner
// ============================================================
function initScenarioPlanner() {
  const catMap = getCategoryUnallocated();
  const categories = Object.keys(catMap).sort();
  const tbody = document.getElementById('scenario-body');
  const tfoot = document.getElementById('scenario-foot');
  const summary = document.getElementById('scenario-summary');
  let rows = [];
  let nextId = 1;

  function catOptions() {
    return categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function renderScenario() {
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-td text-center text-slate-600">Click "Add Row" to start planning</td></tr>';
      tfoot.innerHTML = '';
      summary.innerHTML = '';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr class="table-row" data-id="${r.id}">
        <td class="table-td">
          <select class="table-filter scenario-action" style="width:100%">
            <option value="hire" ${r.action === 'hire' ? 'selected' : ''}>Hire</option>
            <option value="cut" ${r.action === 'cut' ? 'selected' : ''}>Cut</option>
            <option value="reallocate" ${r.action === 'reallocate' ? 'selected' : ''}>Reallocate</option>
          </select>
        </td>
        <td class="table-td">
          <select class="table-filter scenario-cat" style="width:100%">
            ${catOptions().replace(`value="${r.category}"`, `value="${r.category}" selected`)}
          </select>
        </td>
        <td class="table-td"><input type="text" class="scenario-input scenario-desc" value="${r.description}" placeholder="Description..."></td>
        <td class="table-td"><input type="number" class="scenario-input scenario-amt text-right" value="${r.amount}" min="0" step="5000"></td>
        <td class="table-td text-right font-semibold ${r.action === 'cut' ? 'val-positive' : 'val-negative'}">
          ${r.action === 'cut' ? '+' : '-'}${fmtFull(r.amount)}
        </td>
        <td class="table-td text-center"><button class="scenario-remove" data-id="${r.id}">&#x2715;</button></td>
      </tr>
    `).join('');

    // Compute net impact per category
    const impacts = {};
    rows.forEach(r => {
      if (!impacts[r.category]) impacts[r.category] = 0;
      impacts[r.category] += r.action === 'cut' ? r.amount : -r.amount;
    });

    const netTotal = Object.values(impacts).reduce((s, v) => s + v, 0);
    tfoot.innerHTML = `<tr>
      <td colspan="4" class="table-td text-right font-bold">Net Impact on Unallocated</td>
      <td class="table-td text-right font-bold ${netTotal >= 0 ? 'val-positive' : 'val-negative'}">${netTotal >= 0 ? '+' : ''}${fmtFull(netTotal)}</td>
      <td></td>
    </tr>`;

    // Per-category summary
    const impactEntries = Object.entries(impacts).filter(([,v]) => v !== 0);
    if (impactEntries.length > 0) {
      summary.innerHTML = `<div class="flex flex-wrap gap-2 mt-2">
        ${impactEntries.map(([cat, val]) => {
          const orig = catMap[cat] ? catMap[cat].budget - catMap[cat].sowCommitted : 0;
          const newVal = orig + val;
          return `<span class="badge ${val >= 0 ? 'badge-low' : 'badge-critical'}">${cat}: ${fmtFull(orig)} → ${fmtFull(newVal)}</span>`;
        }).join('')}
      </div>`;
    } else {
      summary.innerHTML = '';
    }

    // Bind events on new elements
    tbody.querySelectorAll('.scenario-action').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = parseInt(e.target.closest('tr').dataset.id);
        const row = rows.find(r => r.id === id);
        if (row) { row.action = e.target.value; renderScenario(); }
      });
    });
    tbody.querySelectorAll('.scenario-cat').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = parseInt(e.target.closest('tr').dataset.id);
        const row = rows.find(r => r.id === id);
        if (row) { row.category = e.target.value; renderScenario(); }
      });
    });
    tbody.querySelectorAll('.scenario-desc').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const id = parseInt(e.target.closest('tr').dataset.id);
        const row = rows.find(r => r.id === id);
        if (row) row.description = e.target.value;
      });
    });
    tbody.querySelectorAll('.scenario-amt').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const id = parseInt(e.target.closest('tr').dataset.id);
        const row = rows.find(r => r.id === id);
        if (row) { row.amount = Math.max(0, parseInt(e.target.value) || 0); renderScenario(); }
      });
    });
    tbody.querySelectorAll('.scenario-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.id);
        rows = rows.filter(r => r.id !== id);
        renderScenario();
      });
    });
  }

  document.getElementById('scenario-add').addEventListener('click', () => {
    rows.push({ id: nextId++, action: 'hire', category: categories[0], description: '', amount: 250000 });
    renderScenario();
  });

  document.getElementById('scenario-reset').addEventListener('click', () => {
    rows = [];
    nextId = 1;
    renderScenario();
  });

  renderScenario();
}

// ============================================================
// 13e. Tool 5: Budget Runway Gauge
// ============================================================
function renderRunwayGauges() {
  const catMap = getCategoryUnallocated();
  const container = document.getElementById('runway-gauges');

  const entries = Object.entries(catMap)
    .filter(([, v]) => v.budget > 0)
    .sort((a, b) => {
      const aUnalloc = a[1].budget - a[1].sowCommitted;
      const bUnalloc = b[1].budget - b[1].sowCommitted;
      return bUnalloc - aUnalloc;
    });

  container.innerHTML = entries.map(([cat, v]) => {
    const unalloc = v.budget - v.sowCommitted;
    const avgMonthlySOW = v.sows.length > 0
      ? (v.sows.reduce((s, i) => s + i.committed_fy26, 0) / v.sows.length) / 12
      : 0;
    let months, label;
    if (unalloc <= 0) {
      months = 0;
      label = 'Over-committed';
    } else if (avgMonthlySOW === 0) {
      months = 12;
      label = 'Entire budget available (no SOWs)';
    } else {
      months = Math.min(unalloc / avgMonthlySOW, 24);
      label = `${months.toFixed(1)} months of additional capacity`;
    }

    const barPct = Math.min((months / 12) * 100, 100);
    const barColor = months <= 0 ? 'bg-rose' : months < 3 ? 'bg-amber' : months < 6 ? 'bg-cyan' : 'bg-emerald';

    return `
      <div class="runway-item">
        <div class="flex justify-between items-baseline mb-1">
          <span class="text-sm font-medium">${cat}</span>
          <span class="text-xs text-slate-500">${unalloc > 0 ? fmt(unalloc) + ' unallocated' : 'Over-committed'}</span>
        </div>
        <div class="runway-track">
          <div class="runway-fill ${barColor}" style="width: ${barPct}%"></div>
        </div>
        <div class="text-xs text-slate-500 mt-0.5">${label}</div>
      </div>`;
  }).join('');
}

// ============================================================
// 13f. Tool 6: Allocation Sunburst (nested doughnut, interactive)
// ============================================================
let sunburstDrilledCategory = null; // null = all, string = drilled into one

function renderSunburstChart(fundFilter = '', drilledCategory = null) {
  if (sunburstChart) { sunburstChart.destroy(); sunburstChart = null; }
  sunburstDrilledCategory = drilledCategory;

  const catMap = getCategoryUnallocated(fundFilter);
  const breadcrumb = document.getElementById('sunburst-breadcrumb');

  // All categories sorted
  const allCats = Object.entries(catMap)
    .filter(([, v]) => v.budget > 0)
    .sort((a, b) => b[1].budget - a[1].budget);

  // Build a stable color mapping (category name -> palette index)
  const catColorMap = {};
  allCats.forEach(([k], i) => { catColorMap[k] = PALETTE[i % PALETTE.length]; });

  if (drilledCategory && catMap[drilledCategory]) {
    // --- DRILLED-IN VIEW: single category expanded ---
    const v = catMap[drilledCategory];
    const baseColor = catColorMap[drilledCategory];

    const innerLabels = [drilledCategory];
    const innerData = [v.budget];
    const innerColors = [baseColor];

    const outerLabels = [];
    const outerData = [];
    const outerColors = [];

    v.sows.forEach((sow, i) => {
      outerLabels.push(sow.vendor || sow.description);
      outerData.push(sow.committed_fy26);
      // Vary shade per SOW
      const opacity = Math.max(0.4, 1 - i * 0.08);
      outerColors.push(baseColor + Math.round(opacity * 255).toString(16).padStart(2, '0'));
    });
    const unalloc = Math.max(0, v.budget - v.sowCommitted);
    if (unalloc > 0) {
      outerLabels.push('Unallocated');
      outerData.push(unalloc);
      outerColors.push(baseColor + '33');
    }

    breadcrumb.innerHTML = `<span class="breadcrumb-link" id="sunburst-back">All Categories</span> <span class="breadcrumb-sep">/</span> <span class="breadcrumb-current">${drilledCategory}</span>`;
    document.getElementById('sunburst-back').addEventListener('click', () => {
      const fund = document.getElementById('filter-sunburst-fund').value;
      renderSunburstChart(fund, null);
    });

    sunburstChart = new Chart(document.getElementById('chart-sunburst'), {
      type: 'doughnut',
      data: {
        labels: [...innerLabels, ...outerLabels],
        datasets: [
          { label: 'Category', data: innerData, backgroundColor: innerColors, borderColor: 'rgba(2, 6, 23, 0.8)', borderWidth: 2, weight: 1 },
          { label: 'SOWs & Unallocated', data: outerData, backgroundColor: outerColors, borderColor: 'rgba(2, 6, 23, 0.6)', borderWidth: 1, weight: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '25%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.datasetIndex === 0 ? v.budget : outerData.reduce((a, b) => a + b, 0);
                const pctVal = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0.0';
                return ` ${ctx.label}: ${fmtFull(ctx.raw)} (${pctVal}% of ${ctx.datasetIndex === 0 ? 'total' : drilledCategory})`;
              },
            },
          },
        },
      },
    });
  } else {
    // --- ALL-CATEGORIES VIEW ---
    breadcrumb.innerHTML = '<span class="breadcrumb-current">All Categories</span> <span class="text-xs text-slate-600">(click a slice to drill in)</span>';

    const cats = allCats;
    const innerLabels = cats.map(([k]) => k);
    const innerData = cats.map(([, v]) => v.budget);
    const innerColors = cats.map(([k]) => catColorMap[k]);

    const outerLabels = [];
    const outerData = [];
    const outerColors = [];
    // Track which category each outer slice belongs to
    const outerCategoryIndex = [];

    cats.forEach(([cat, v], catIdx) => {
      const baseColor = catColorMap[cat];
      v.sows.forEach(sow => {
        outerLabels.push(sow.vendor || sow.description);
        outerData.push(sow.committed_fy26);
        outerColors.push(baseColor + 'BB');
        outerCategoryIndex.push(catIdx);
      });
      const ua = Math.max(0, v.budget - v.sowCommitted);
      if (ua > 0) {
        outerLabels.push(`${cat} - Unallocated`);
        outerData.push(ua);
        outerColors.push(baseColor + '44');
        outerCategoryIndex.push(catIdx);
      }
    });

    const totalBudget = innerData.reduce((a, b) => a + b, 0);

    sunburstChart = new Chart(document.getElementById('chart-sunburst'), {
      type: 'doughnut',
      data: {
        labels: [...innerLabels, ...outerLabels],
        datasets: [
          { label: 'Category', data: innerData, backgroundColor: innerColors, borderColor: 'rgba(2, 6, 23, 0.8)', borderWidth: 2, weight: 1 },
          { label: 'SOWs & Unallocated', data: outerData, backgroundColor: outerColors, borderColor: 'rgba(2, 6, 23, 0.6)', borderWidth: 1, weight: 2 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '25%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.datasetIndex === 0) {
                  const pctVal = totalBudget > 0 ? ((ctx.raw / totalBudget) * 100).toFixed(1) : '0.0';
                  return ` ${ctx.label}: ${fmtFull(ctx.raw)} (${pctVal}% of total)`;
                } else {
                  const catIdx = outerCategoryIndex[ctx.dataIndex];
                  const parentBudget = innerData[catIdx];
                  const pctVal = parentBudget > 0 ? ((ctx.raw / parentBudget) * 100).toFixed(1) : '0.0';
                  return ` ${ctx.label}: ${fmtFull(ctx.raw)} (${pctVal}% of ${innerLabels[catIdx]})`;
                }
              },
            },
          },
        },
        onClick: (event, elements) => {
          if (elements.length === 0) return;
          const el = elements[0];
          let catName;
          if (el.datasetIndex === 0) {
            catName = innerLabels[el.index];
          } else {
            const catIdx = outerCategoryIndex[el.index];
            catName = innerLabels[catIdx];
          }
          if (catName) {
            const fund = document.getElementById('filter-sunburst-fund').value;
            renderSunburstChart(fund, catName);
          }
        },
      },
    });
  }
}

// ============================================================
// 13g. Vendor Spend Analysis Chart
// ============================================================
function renderVendorChart(fundFilter = '', vendorFilter = '') {
  if (vendorChart) { vendorChart.destroy(); vendorChart = null; }

  // Only SOW rows with a non-empty vendor
  let items = budgetData.line_items.filter(i => i.event_type === 'SOW' && i.vendor && i.vendor.trim() !== '');
  if (fundFilter) items = items.filter(i => i.source_fund === fundFilter);

  if (vendorFilter) {
    // Show selected vendor's spend by category
    const vendorItems = items.filter(i => i.vendor === vendorFilter);
    const catMap = {};
    vendorItems.forEach(i => {
      const cat = i.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + i.committed_fy26;
    });
    const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);

    vendorChart = new Chart(document.getElementById('chart-vendor'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: vendorFilter,
          data: values,
          backgroundColor: PALETTE.slice(0, labels.length).map(c => c + '99'),
          borderColor: PALETTE.slice(0, labels.length),
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.7,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmtFull(ctx.raw)}` } },
        },
        scales: {
          x: { grid: { color: 'rgba(51, 65, 85, 0.2)' }, ticks: { callback: (v) => fmt(v) } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  } else {
    // Show all vendors aggregated
    const vendorMap = {};
    items.forEach(i => {
      vendorMap[i.vendor] = (vendorMap[i.vendor] || 0) + i.committed_fy26;
    });
    const entries = Object.entries(vendorMap).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);

    vendorChart = new Chart(document.getElementById('chart-vendor'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Committed',
          data: values,
          backgroundColor: PALETTE.slice(0, labels.length).map(c => c + '99'),
          borderColor: PALETTE.slice(0, labels.length),
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.7,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { callbacks: { label: (ctx) => ` ${fmtFull(ctx.raw)}` } },
        },
        scales: {
          x: { grid: { color: 'rgba(51, 65, 85, 0.2)' }, ticks: { callback: (v) => fmt(v) } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  }
}

// ============================================================
// 14. Refresh from Excel
// ============================================================
function initRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  const icon = document.getElementById('refresh-icon');
  const status = document.getElementById('refresh-status');

  if (!btn) return;

  btn.addEventListener('click', async () => {
    // Prevent double-clicks
    if (btn.disabled) return;
    btn.disabled = true;

    // Spinning animation
    icon.style.animation = 'spin 0.8s linear infinite';
    status.textContent = 'Extracting...';
    status.classList.remove('hidden');

    try {
      const res = await fetch('/__extract', { method: 'POST' });
      const data = await res.json();

      if (data.ok) {
        status.textContent = 'Done! Reloading...';
        // Short delay so the user sees the success message
        setTimeout(() => location.reload(), 600);
      } else {
        status.textContent = 'Error — check console';
        console.error('Extract failed:', data.error);
        icon.style.animation = '';
        btn.disabled = false;
        setTimeout(() => status.classList.add('hidden'), 3000);
      }
    } catch (err) {
      status.textContent = 'Network error';
      console.error('Extract request failed:', err);
      icon.style.animation = '';
      btn.disabled = false;
      setTimeout(() => status.classList.add('hidden'), 3000);
    }
  });
}

// ============================================================
// Initialize
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderKPIs();
  renderCategoryChart();
  renderFundChart();
  renderExpenseChart();

  // --- Approved vs Committed (with fund filter) ---
  const acFundSelect = document.getElementById('filter-ac-fund');
  populateFundFilter(acFundSelect);
  renderApprovedCommittedChart();
  acFundSelect.addEventListener('change', (e) => renderApprovedCommittedChart(e.target.value));

  // --- Vendor Spend Analysis (with fund + vendor filters) ---
  const vendorFundSelect = document.getElementById('filter-vendor-fund');
  const vendorVendorSelect = document.getElementById('filter-vendor-vendor');
  populateFundFilter(vendorFundSelect);
  // Populate vendor dropdown
  const allVendors = [...new Set(
    budgetData.line_items
      .filter(i => i.event_type === 'SOW' && i.vendor && i.vendor.trim() !== '')
      .map(i => i.vendor)
  )].sort();
  allVendors.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    vendorVendorSelect.appendChild(opt);
  });
  renderVendorChart();
  vendorFundSelect.addEventListener('change', () => renderVendorChart(vendorFundSelect.value, vendorVendorSelect.value));
  vendorVendorSelect.addEventListener('change', () => renderVendorChart(vendorFundSelect.value, vendorVendorSelect.value));

  // --- Budget Planning Tools ---
  const unallocFundSelect = document.getElementById('filter-unalloc-fund');
  populateFundFilter(unallocFundSelect);
  renderUnallocatedBreakdown();
  unallocFundSelect.addEventListener('change', (e) => renderUnallocatedBreakdown(e.target.value));

  initHiringCalculator();
  initSOWCutSimulator();
  initScenarioPlanner();
  renderRunwayGauges();

  // --- Interactive Sunburst (with fund filter) ---
  const sunburstFundSelect = document.getElementById('filter-sunburst-fund');
  populateFundFilter(sunburstFundSelect);
  renderSunburstChart();
  sunburstFundSelect.addEventListener('change', (e) => renderSunburstChart(e.target.value, null));

  // Timeline & Variance
  renderTimelineChart();
  renderVarianceChart();
  renderForecastVarianceChart();
  initTableControls();
  renderTable();
  renderAudit();
  renderRecommendations();
  initNav();
  initScrollReveal();
  initNavbarScroll();
  initRefreshButton();
});
