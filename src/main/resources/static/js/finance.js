const txList = Array.isArray(TRANSACTIONS) ? [...TRANSACTIONS] : [];
let editingId = null;
let currentTxType = "EXPENSE";
let summaryState = normalizeSummary(SUMMARY);
let selectedCalendarDay = null;
let calendarDetailView = "daily";
let selectedModalIcon = "utensils";
const DEFAULT_TX_TYPE = document.querySelector(".finance-type-btn.active")?.dataset.value || document.querySelector(".finance-type-btn")?.dataset.value || "EXPENSE";
const ICON_LIST = [
  "utensils", "coffee", "beer", "bus", "car", "fuel", "home", "smartphone",
  "heart-pulse", "stethoscope", "book-open", "graduation-cap", "film", "gamepad-2",
  "music", "shirt", "scissors", "gift", "shield", "piggy-bank", "trending-up",
  "wallet", "briefcase", "landmark", "hand-coins", "rotate-ccw", "file-text",
  "clipboard-list", "shopping-cart", "plane", "hotel", "laptop", "package",
  "dog", "baby", "dumbbell", "trophy", "brush", "lightbulb", "phone", "cake",
  "credit-card", "store", "wrench", "pen-line", "heart", "star", "receipt", "banknote",
];

const categoryList = Array.isArray(CATEGORIES) ? [...CATEGORIES] : [];
sortCategoryList();
const budgetList = Array.isArray(BUDGETS) ? [...BUDGETS] : [];

const els = {
  summaryIncome: document.getElementById("summary-income"),
  summaryExpense: document.getElementById("summary-expense"),
  summaryDaily: document.getElementById("summary-daily"),
  summaryFixedExpense: document.getElementById("summary-fixed-expense"),
  summaryVariableExpense: document.getElementById("summary-variable-expense"),
  summaryBalance: document.getElementById("summary-balance"),
  insight: document.getElementById("finance-insight"),
  trendChart: document.getElementById("trend-chart"),
  donutChart: document.getElementById("donut-chart"),
  donutLegend: document.getElementById("donut-legend"),
  chartList: document.getElementById("category-chart-list"),
  chartEmpty: document.getElementById("category-chart-empty"),
  budgetList: document.getElementById("budget-list"),
  budgetEmpty: document.getElementById("budget-empty"),
  budgetCategory: document.getElementById("budget-category"),
  budgetAmount: document.getElementById("budget-amount"),
  budgetSaveBtn: document.getElementById("budget-save-btn"),
  calendarGrid: document.getElementById("calendar-grid"),
  calendarDayDetail: document.getElementById("calendar-day-detail"),
  yearlyChart: document.getElementById("yearly-chart"),
  yearlyTable: document.getElementById("yearly-table"),
  historyList: document.getElementById("transaction-history-list"),
  historyEmpty: document.getElementById("transaction-history-empty"),
  historyCount: document.querySelector(".history-count"),
  searchInput: document.getElementById("finance-search"),
  filterCategory: document.getElementById("filter-category"),
  filterPayment: document.getElementById("filter-payment"),
  sortSelect: document.getElementById("sort-transactions"),
  form: document.getElementById("finance-form"),
  editId: document.getElementById("finance-edit-id"),
  category: document.getElementById("finance-category"),
  customCategoryGroup: document.getElementById("custom-category-group"),
  customCategory: document.getElementById("finance-custom-category"),
  amount: document.getElementById("finance-amount"),
  amountDisplay: document.getElementById("finance-amount-display"),
  date: document.getElementById("finance-date"),
  fixedRow: document.getElementById("finance-fixed-row"),
  isFixed: document.getElementById("finance-is-fixed"),
  recurringRow: document.getElementById("finance-recurring-row"),
  isRecurring: document.getElementById("finance-is-recurring"),
  paymentMethod: document.getElementById("finance-payment-method"),
  description: document.getElementById("finance-description"),
  save: document.getElementById("finance-save"),
  cancel: document.getElementById("finance-cancel"),
  formTitle: document.querySelector(".transaction-form-card .panel-form-title"),
  typeButtons: Array.from(document.querySelectorAll(".finance-type-btn")),
  dashboardTabs: Array.from(document.querySelectorAll(".dashboard-tab")),
  dashboardPanels: Array.from(document.querySelectorAll(".dashboard-panel")),
  darkModeToggle: document.getElementById("dark-mode-toggle"),
  categorySettingsBtn: document.getElementById("category-settings-btn"),
  categoryModal: document.getElementById("category-modal"),
  modalClose: document.getElementById("modal-close"),
  modalExpenseList: document.getElementById("modal-expense-list"),
  modalIncomeList: document.getElementById("modal-income-list"),
  modalAddType: document.getElementById("modal-add-type"),
  modalAddName: document.getElementById("modal-add-name"),
  modalIconBtn: document.getElementById("modal-emoji-btn"),
  modalIconPicker: document.getElementById("modal-icon-picker"),
  modalAddBtn: document.getElementById("modal-add-btn"),
};

document.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  currentTxType = detectInitialType();
  populateCategoryOptions(currentTxType, null);
  syncFixedFieldVisibility();
  syncCustomCategoryVisibility();
  setSelectedModalIcon(getDefaultModalIcon(els.modalAddType?.value || "EXPENSE"));
  renderAmountDisplay();
  populateFilterCategories();
  populateBudgetCategoryOptions();
  setDashboardTab("chart");
  renderAll();
  bindEvents();
});

function renderAll() {
  renderSummary();
  renderTrendChart();
  renderDonutChart();
  renderCategoryChart();
  renderBudgetBars();
  renderCalendar();
  renderCalendarDayDetail();
  renderYearlyReport();
  renderInsight();
  renderHistory();
  applyLucideIcons();
}

function renderSummary() {
  if (els.summaryIncome) els.summaryIncome.textContent = formatAmount(summaryState.totalIncome);
  if (els.summaryExpense) els.summaryExpense.textContent = formatAmount(summaryState.totalExpense);
  if (els.summaryDaily) els.summaryDaily.textContent = `${TEXT.summaryDailyAvg} ${formatAmount(summaryState.dailyAverage)}`;
  if (els.summaryFixedExpense) els.summaryFixedExpense.textContent = formatAmount(summaryState.fixedExpense);
  if (els.summaryVariableExpense) els.summaryVariableExpense.textContent = formatAmount(summaryState.variableExpense);
  if (els.summaryBalance) els.summaryBalance.textContent = formatAmount(summaryState.balance);
}

function renderTrendChart() {
  if (!els.trendChart) return;

  const trend = Array.isArray(summaryState.trend) ? summaryState.trend : [];
  if (trend.length === 0) {
    els.trendChart.innerHTML = `<div class="trend-empty">${escHtml(TEXT.historyEmpty)}</div>`;
    return;
  }

  const max = Math.max(
    1,
    ...trend.flatMap((item) => [toNumber(item.income), toNumber(item.expense)])
  );

  const monthsHtml = trend.map((item) => {
    const incomeHeight = max > 0 ? (toNumber(item.income) / max) * 120 : 0;
    const expenseHeight = max > 0 ? (toNumber(item.expense) / max) * 120 : 0;
    return `
      <div class="trend-month">
        <div class="trend-bars">
          <div class="trend-bar income" style="height:${incomeHeight}px" title="${escHtml(TEXT.summaryIncome)} ${formatAmount(item.income)}"></div>
          <div class="trend-bar expense" style="height:${expenseHeight}px" title="${escHtml(TEXT.summaryExpense)} ${formatAmount(item.expense)}"></div>
        </div>
        <div class="trend-label">${item.month}월</div>
      </div>`;
  }).join("");

  els.trendChart.innerHTML = `
    <div class="trend-chart-inner">${monthsHtml}</div>
    <div class="trend-legend">
      <span class="legend-item"><span class="legend-dot income"></span>${escHtml(TEXT.summaryIncome)}</span>
      <span class="legend-item"><span class="legend-dot expense"></span>${escHtml(TEXT.summaryExpense)}</span>
    </div>`;
}

function renderDonutChart() {
  const container = els.donutChart;
  const legend = els.donutLegend;
  if (!container) return;

  const items = (summaryState.expenseByCategory || []).filter((item) => toNumber(item.amount) > 0);
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state" style="min-height:60px">지출 데이터가 없습니다</div>';
    if (legend) {
      legend.innerHTML = "";
    }
    return;
  }

  const total = items.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const colors = [
    "#3b6fd4", "#2d9d5e", "#e67e22", "#9b59b6", "#d94848",
    "#1abc9c", "#e84393", "#f39c12", "#6b7994", "#00b894",
    "#fd79a8", "#636e72",
  ];

  const r = 70;
  const circumference = 2 * Math.PI * r;
  const gapSize = items.length > 1 ? 3 : 0;
  const totalGap = gapSize * items.length;
  const availableLength = circumference - totalGap;

  let accumulatedOffset = 0;
  const segments = items.map((item, idx) => {
    const percent = toNumber(item.amount) / total;
    const segmentLength = availableLength * percent;
    const dasharray = `${segmentLength} ${circumference - segmentLength}`;
    const dashoffset = -(accumulatedOffset + (gapSize * idx));
    accumulatedOffset += segmentLength;
    return {
      item,
      color: colors[idx % colors.length],
      dasharray,
      dashoffset,
      percent,
    };
  });

  const centerAmount = formatAmount(total);
  container.innerHTML = `
    <svg viewBox="0 0 200 200" class="donut-svg" aria-label="카테고리별 지출 도넛 차트">
      <circle cx="100" cy="100" r="${r}" fill="none" stroke="var(--fin-divider, #f0f1f3)" stroke-width="22"></circle>
      ${segments.map((seg, idx) => `
        <circle class="donut-segment" data-index="${idx}"
          cx="100" cy="100" r="${r}"
          fill="none"
          stroke="${seg.color}"
          stroke-width="22"
          stroke-dasharray="${seg.dasharray}"
          stroke-dashoffset="${seg.dashoffset}"
          stroke-linecap="butt"
          transform="rotate(-90 100 100)"
          style="transition: stroke-width 0.2s, opacity 0.2s; cursor:pointer;"
        ></circle>
      `).join("")}
      <text x="100" y="92" text-anchor="middle"
        style="font-size:0.55rem; fill:var(--fin-text-secondary, #8b919a); font-weight:500;">
        총 지출
      </text>
      <text x="100" y="110" text-anchor="middle"
        style="font-size:0.75rem; fill:var(--fin-text-primary, #1b1d21); font-weight:700;">
        ${escHtml(centerAmount)}
      </text>
    </svg>
    <div id="donut-tooltip" class="donut-tooltip" style="display:none;"></div>
  `;

  if (legend) {
    legend.innerHTML = segments.map((seg, idx) => {
      const pct = (seg.percent * 100).toFixed(1);
      return `
        <div class="donut-legend-item" data-index="${idx}">
          <span class="donut-dot" style="background:${seg.color}"></span>
          <span class="donut-legend-name">${renderIcon(seg.item.icon, 14)} ${escHtml(seg.item.categoryName || "")}</span>
          <span class="donut-legend-amount">${formatAmount(seg.item.amount)}</span>
          <span class="donut-legend-pct">${pct}%</span>
        </div>`;
    }).join("");
  }

  const svgTexts = container.querySelectorAll(".donut-svg text");
  const resetDonutState = () => {
    container.querySelectorAll(".donut-segment").forEach((seg) => {
      seg.style.opacity = "1";
      seg.setAttribute("stroke-width", "22");
    });
    legend?.querySelectorAll(".donut-legend-item").forEach((item) => {
      item.style.opacity = "1";
    });
    if (svgTexts.length >= 2) {
      svgTexts[0].textContent = "총 지출";
      svgTexts[1].textContent = centerAmount;
    }
  };

  container.querySelectorAll(".donut-segment").forEach((segment) => {
    segment.addEventListener("mouseenter", (event) => {
      const idx = Number(event.currentTarget.dataset.index);
      const seg = segments[idx];
      if (!seg) return;

      event.currentTarget.setAttribute("stroke-width", "26");
      container.querySelectorAll(".donut-segment").forEach((other, otherIdx) => {
        if (otherIdx !== idx) {
          other.style.opacity = "0.35";
        }
      });
      legend?.querySelectorAll(".donut-legend-item").forEach((item, itemIdx) => {
        item.style.opacity = itemIdx === idx ? "1" : "0.35";
      });
      if (svgTexts.length >= 2) {
        svgTexts[0].textContent = seg.item.categoryName || "";
        svgTexts[1].textContent = formatAmount(seg.item.amount);
      }
    });

    segment.addEventListener("mouseleave", resetDonutState);
  });

  legend?.querySelectorAll(".donut-legend-item").forEach((item) => {
    item.addEventListener("mouseenter", () => {
      const idx = Number(item.dataset.index);
      const seg = segments[idx];
      if (!seg) return;

      container.querySelectorAll(".donut-segment").forEach((segment, segIdx) => {
        segment.style.opacity = segIdx === idx ? "1" : "0.35";
        segment.setAttribute("stroke-width", segIdx === idx ? "26" : "22");
      });
      legend.querySelectorAll(".donut-legend-item").forEach((other, otherIdx) => {
        other.style.opacity = otherIdx === idx ? "1" : "0.35";
      });
      if (svgTexts.length >= 2) {
        svgTexts[0].textContent = seg.item.categoryName || "";
        svgTexts[1].textContent = formatAmount(seg.item.amount);
      }
    });

    item.addEventListener("mouseleave", resetDonutState);
  });
}

function renderCategoryChart() {
  if (!els.chartList) return;

  const expenseItems = Array.isArray(summaryState.expenseByCategory) ? summaryState.expenseByCategory : [];
  const incomeItems = Array.isArray(summaryState.incomeByCategory) ? summaryState.incomeByCategory : [];
  const totalIncome = toNumber(summaryState.totalIncome);
  const totalExpense = toNumber(summaryState.totalExpense);
  const balance = toNumber(summaryState.balance);
  const max = Math.max(totalIncome, totalExpense, 1);
  const incomePercent = (totalIncome / max) * 100;
  const expensePercent = (totalExpense / max) * 100;

  const compareHtml = `
    <div class="income-expense-compare">
      <div class="compare-row">
        <span class="compare-label">${escHtml(TEXT.summaryIncome)}</span>
        <div class="compare-bar-track">
          <div class="compare-bar-fill income" style="width:${incomePercent}%;"></div>
        </div>
        <span class="compare-value">${formatAmount(totalIncome)}</span>
      </div>
      <div class="compare-row">
        <span class="compare-label">${escHtml(TEXT.summaryExpense)}</span>
        <div class="compare-bar-track">
          <div class="compare-bar-fill expense" style="width:${expensePercent}%;"></div>
        </div>
        <span class="compare-value">${formatAmount(totalExpense)}</span>
      </div>
      <div class="compare-balance">${escHtml(TEXT.summaryBalance)}: ${formatSignedAmount(balance)}</div>
    </div>`;

  const expenseHtml = renderCategorySection(expenseItems, TEXT.summaryExpense, "expense");
  const incomeHtml = renderCategorySection(incomeItems, TEXT.summaryIncome, "income");
  const hasData = totalIncome > 0 || totalExpense > 0 || expenseItems.length > 0 || incomeItems.length > 0;

  els.chartList.innerHTML = `${compareHtml}${expenseHtml}${incomeHtml}`;
  toggleEmptyState(els.chartList, els.chartEmpty, !hasData, TEXT.historyEmpty);
}

function renderYearlyReport() {
  const yearly = Array.isArray(summaryState.yearlyReport) ? summaryState.yearlyReport : [];
  if (els.yearlyChart) {
    if (yearly.length === 0) {
      els.yearlyChart.innerHTML = `<div class="trend-empty">${escHtml(TEXT.historyEmpty)}</div>`;
    } else {
      const max = Math.max(1, ...yearly.flatMap((item) => [toNumber(item.income), toNumber(item.expense)]));
      const chartHtml = yearly.map((item) => {
        const incomeHeight = max > 0 ? (toNumber(item.income) / max) * 140 : 0;
        const expenseHeight = max > 0 ? (toNumber(item.expense) / max) * 140 : 0;
        return `
          <div class="yearly-month">
            <div class="yearly-bars">
              <div class="yearly-bar income" style="height:${incomeHeight}px" title="${escHtml(TEXT.summaryIncome)} ${formatAmount(item.income)}"></div>
              <div class="yearly-bar expense" style="height:${expenseHeight}px" title="${escHtml(TEXT.summaryExpense)} ${formatAmount(item.expense)}"></div>
            </div>
            <div class="yearly-label">${item.month}월</div>
          </div>`;
      }).join("");

      els.yearlyChart.innerHTML = `
        <div class="yearly-chart-inner">${chartHtml}</div>
        <div class="trend-legend">
          <span class="legend-item"><span class="legend-dot income"></span>${escHtml(TEXT.summaryIncome)}</span>
          <span class="legend-item"><span class="legend-dot expense"></span>${escHtml(TEXT.summaryExpense)}</span>
        </div>`;
    }
  }

  if (!els.yearlyTable) return;

  if (yearly.length === 0) {
    els.yearlyTable.innerHTML = `<div class="empty-state">${escHtml(TEXT.historyEmpty)}</div>`;
    return;
  }

  const totalIncome = yearly.reduce((sum, item) => sum + toNumber(item.income), 0);
  const totalExpense = yearly.reduce((sum, item) => sum + toNumber(item.expense), 0);
  const totalBalance = totalIncome - totalExpense;
  const rowsHtml = yearly.map((item) => {
    const balance = toNumber(item.income) - toNumber(item.expense);
    return `
      <tr>
        <td>${item.month}월</td>
        <td class="income">+${formatAmount(item.income)}</td>
        <td class="expense">-${formatAmount(item.expense)}</td>
        <td class="balance">${formatSignedAmount(balance)}</td>
      </tr>`;
  }).join("");

  els.yearlyTable.innerHTML = `
    <table class="yearly-detail-table">
      <thead>
        <tr>
          <th>월</th>
          <th>${escHtml(TEXT.summaryIncome)}</th>
          <th>${escHtml(TEXT.summaryExpense)}</th>
          <th>${escHtml(TEXT.summaryBalance)}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td>${escHtml(TEXT.yearlyTotal)}</td>
          <td class="income">+${formatAmount(totalIncome)}</td>
          <td class="expense">-${formatAmount(totalExpense)}</td>
          <td class="balance">${formatSignedAmount(totalBalance)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function renderCategorySection(items, title, type) {
  const rowsHtml = items.length > 0
    ? items.map((item) => {
      const categoryName = item.categoryName || TEXT.formCategory;
      const icon = item.icon || "•";
      const percentage = clampPercentage(item.percentage);
      const changeBadge = renderChangeBadge(item.changePercent);
      return `
        <div class="category-chart-item chart-bar">
          <div class="category-chart-top">
            <div class="category-meta">
              <span class="category-icon">${renderIcon(icon, 18)}</span>
              <span class="category-name">${escHtml(categoryName)}${changeBadge}</span>
            </div>
            <div class="category-values">
              <strong>${formatAmount(item.amount)}</strong>
              <span>${formatPercent(percentage)}</span>
            </div>
          </div>
          <div class="category-bar-track chart-bar-track">
            <div class="category-bar-fill chart-bar-fill ${type}" style="width:${percentage}%;"></div>
          </div>
        </div>`;
    }).join("")
    : `<div class="empty-state category-section-empty">${escHtml(TEXT.historyEmpty)}</div>`;

  return `
    <section class="category-section-block analysis-section">
      <h3 class="analysis-subtitle">${escHtml(title)}</h3>
      ${rowsHtml}
    </section>`;
}

function renderChangeBadge(changePercent) {
  if (changePercent == null) return "";
  const value = Number(changePercent);
  if (!Number.isFinite(value) || value === 0) return "";

  if (value > 0) {
    return ` <span class="change-badge up">▲${Math.round(value)}%</span>`;
  }
  return ` <span class="change-badge down">▼${Math.round(Math.abs(value))}%</span>`;
}

function renderBudgetBars() {
  if (!els.budgetList) return;

  els.budgetList.innerHTML = budgetList.map((budget) => {
    const amount = toNumber(budget.amount);
    const spent = calculateBudgetSpent(budget);
    const rawUsage = amount > 0 ? (spent / amount) * 100 : 0;
    const usage = Math.min(rawUsage, 100);
    const remaining = amount - spent;
    const over = rawUsage > 100;
    const barStyle = over
      ? "width:100%; background:linear-gradient(90deg, #d94848 0%, #ee7b7b 100%); box-shadow:0 4px 10px rgba(217,72,72,0.22);"
      : `width:${usage}%;`;
    const name = budget.categoryName || TEXT.budgetTitle;
    return `
      <div class="budget-item analysis-section">
        <div class="budget-item-top">
          <div>
            <p class="budget-name">${escHtml(name)}</p>
            <p class="budget-amount">${formatAmount(amount)}</p>
          </div>
          <span class="budget-percent${over ? " is-over" : ""}">${formatPercent(rawUsage)}</span>
        </div>
        <div class="budget-bar-track budget-bar">
          <div class="budget-bar-fill" style="${barStyle}"></div>
        </div>
        <div class="budget-meta-row">
          <span>${escHtml(TEXT.budgetSpent)}: ${formatAmount(spent)}</span>
          <span>${escHtml(TEXT.budgetRemaining)}: ${formatSignedAmount(remaining)}</span>
        </div>
      </div>`;
  }).join("");

  toggleEmptyState(els.budgetList, els.budgetEmpty, budgetList.length === 0, TEXT.budgetEmpty);
}

function renderCalendar() {
  const calendarGrid = els.calendarGrid;
  if (!calendarGrid) return;

  const headers = ["일", "월", "화", "수", "목", "금", "토"];
  const firstDay = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 1);
  const firstWeekday = firstDay.getDay();
  const totalDays = new Date(CURRENT_YEAR, CURRENT_MONTH, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === CURRENT_YEAR && today.getMonth() === CURRENT_MONTH - 1;

  const html = [];
  headers.forEach((label) => {
    html.push(`<div class="calendar-header">${label}</div>`);
  });

  for (let i = 0; i < firstWeekday; i += 1) {
    html.push('<div class="calendar-cell empty"></div>');
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const weekday = (firstWeekday + day - 1) % 7;
    const dayTransactions = getTransactionsByDay(day);
    const incomeSum = dayTransactions
      .filter((tx) => tx.txType === "INCOME")
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
    const expenseSum = dayTransactions
      .filter((tx) => tx.txType === "EXPENSE")
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
    const dayTotal = incomeSum - expenseSum;
    const cellClasses = ["calendar-cell"];
    const dayClasses = ["calendar-day"];

    if (isCurrentMonth && today.getDate() === day) {
      cellClasses.push("today");
    }
    if (selectedCalendarDay === day) {
      cellClasses.push("selected");
    }
    if (weekday === 0) dayClasses.push("sunday");
    if (weekday === 6) dayClasses.push("saturday");

    html.push(`
      <div class="${cellClasses.join(" ")}" data-day="${day}">
        <div class="${dayClasses.join(" ")}">${day}</div>
        <div class="calendar-events">
          ${dayTransactions.slice(0, 3).map((tx) => {
            const typeLabel = tx.txType === "INCOME" ? "수입" : "지출";
            const memo = tx.description || tx.categoryName || TEXT.formCategory;
            const colorClass = tx.txType === "INCOME" ? "cal-income" : "cal-expense";
            return `
            <div class="cal-event ${colorClass}">
              <span class="cal-type">(${typeLabel})</span>${escHtml(memo)}
            </div>`;
          }).join("")}
        </div>
        ${dayTotal !== 0 ? `<div class="calendar-total ${dayTotal > 0 ? "positive" : "negative"}">${escHtml(formatCompact(Math.abs(dayTotal)))}</div>` : ""}
      </div>`);
  }

  calendarGrid.innerHTML = html.join("");
}

function handleCalendarClick(event) {
  const cell = event.target.closest(".calendar-cell:not(.empty)");
  if (!cell) return;

  const day = Number(cell.dataset.day);
  if (!Number.isFinite(day)) return;

  if (selectedCalendarDay === day) {
    selectedCalendarDay = null;
    renderCalendar();
    renderCalendarDayDetail();
    return;
  }

  showDayDetail(day);
}
function showDayDetail(day) {
  selectedCalendarDay = day;
  calendarDetailView = "daily";
  renderCalendar();
  renderCalendarDayDetail();
}

function showWeekDetail(day) {
  selectedCalendarDay = day;
  calendarDetailView = "weekly";
  renderCalendar();
  renderCalendarDayDetail();
}

function handleCalendarDetailToggle(event) {
  const button = event.target.closest(".detail-toggle-btn");
  if (!button || selectedCalendarDay == null) return;

  if (button.dataset.view === "weekly") {
    showWeekDetail(selectedCalendarDay);
    return;
  }

  showDayDetail(selectedCalendarDay);
}

function renderCalendarDayDetail() {
  if (!els.calendarDayDetail) return;
  if (selectedCalendarDay == null) {
    els.calendarDayDetail.style.display = "none";
    els.calendarDayDetail.innerHTML = "";
    return;
  }

  if (calendarDetailView === "weekly") {
    renderCalendarWeekDetail(selectedCalendarDay);
    return;
  }

  renderCalendarDailyDetail(selectedCalendarDay);
}

function renderCalendarDailyDetail(day) {
  const items = getTransactionsByDay(day);
  const incomeSum = sumTransactions(items, "INCOME");
  const expenseSum = sumTransactions(items, "EXPENSE");
  const balance = incomeSum - expenseSum;

  const listHtml = items.length > 0
    ? items.map((tx) => `
        <div class="day-detail-item">
          <div class="day-detail-left">
            <span class="day-detail-icon">${renderIcon(tx.categoryIcon, 16)}</span>
            <div>
              <span class="day-detail-name">${escHtml(tx.categoryName || TEXT.formCategory)}</span>
              ${tx.description ? `<span class="day-detail-memo">${escHtml(tx.description)}</span>` : ""}
            </div>
          </div>
          <span class="day-detail-amount ${tx.txType === "INCOME" ? "income" : "expense"}">${formatTxAmount(tx.amount, tx.txType)}</span>
        </div>`).join("")
    : `<div class="day-detail-empty">${escHtml(TEXT.calendarNoTransaction)}</div>`;

  els.calendarDayDetail.innerHTML = `
    <div class="day-detail-header">
      <h4>${CURRENT_MONTH}월 ${day}일</h4>
      <div class="day-detail-toggle">
        <button class="detail-toggle-btn active" data-view="daily">${escHtml(TEXT.calendarDaily)}</button>
        <button class="detail-toggle-btn" data-view="weekly">${escHtml(TEXT.calendarWeekly)}</button>
      </div>
      <div class="day-detail-summary">
        <span class="day-income">${escHtml(TEXT.summaryIncome)} +${formatAmount(incomeSum)}</span>
        <span class="day-expense">${escHtml(TEXT.summaryExpense)} -${formatAmount(expenseSum)}</span>
        <span class="day-balance">합계 ${formatSignedAmount(balance)}</span>
      </div>
    </div>
    <div class="day-detail-list">${listHtml}</div>`;
  els.calendarDayDetail.style.display = "block";
  applyLucideIcons();
}

function renderCalendarWeekDetail(day) {
  const weekDates = getWeekDates(day);
  let weekIncome = 0;
  let weekExpense = 0;

  const columnsHtml = weekDates.map((date) => {
    const items = getTransactionsByDate(date);
    const incomeSum = sumTransactions(items, "INCOME");
    const expenseSum = sumTransactions(items, "EXPENSE");
    const balance = incomeSum - expenseSum;
    weekIncome += incomeSum;
    weekExpense += expenseSum;

    const itemsHtml = items.length > 0
      ? items.map((tx) => `<div class="week-day-item ${tx.txType === "INCOME" ? "income" : "expense"}">${escHtml(tx.description || tx.categoryName || TEXT.formCategory)}</div>`).join("")
      : `<div class="week-day-item">-</div>`;

    return `
      <div class="week-day-col">
        <div class="week-day-header">${escHtml(getWeekdayLabel(date))} ${date.getDate()}일</div>
        ${itemsHtml}
        <div class="week-day-total">합계: ${formatSignedAmount(balance)}</div>
      </div>`;
  }).join("");

  const weekBalance = weekIncome - weekExpense;
  els.calendarDayDetail.innerHTML = `
    <div class="day-detail-header">
      <h4>${CURRENT_MONTH}월 ${day}일</h4>
      <div class="day-detail-toggle">
        <button class="detail-toggle-btn" data-view="daily">${escHtml(TEXT.calendarDaily)}</button>
        <button class="detail-toggle-btn active" data-view="weekly">${escHtml(TEXT.calendarWeekly)}</button>
      </div>
      <div class="day-detail-summary">
        <span class="day-income">${escHtml(TEXT.summaryIncome)} +${formatAmount(weekIncome)}</span>
        <span class="day-expense">${escHtml(TEXT.summaryExpense)} -${formatAmount(weekExpense)}</span>
        <span class="day-balance">합계 ${formatSignedAmount(weekBalance)}</span>
      </div>
    </div>
    <div class="week-detail-grid">${columnsHtml}</div>
    <div class="week-summary">
      <span class="day-income">${escHtml(TEXT.summaryIncome)} +${formatAmount(weekIncome)}</span>
      <span class="day-expense">${escHtml(TEXT.summaryExpense)} -${formatAmount(weekExpense)}</span>
      <span class="day-balance">${escHtml(TEXT.calendarWeekTotal)} ${formatSignedAmount(weekBalance)}</span>
    </div>`;
  els.calendarDayDetail.style.display = "block";
}

function getTransactionsByDay(day) {
  return getTransactionsByDate(new Date(CURRENT_YEAR, CURRENT_MONTH - 1, day));
}

function getTransactionsByDate(date) {
  return txList
    .filter((tx) => matchesDate(tx, date))
    .sort((a, b) => compareTransactions(b, a));
}

function matchesDate(tx, date) {
  if (!tx?.txDate) return false;
  const parts = String(tx.txDate).split("-");
  if (parts.length !== 3) return false;
  return Number(parts[0]) === date.getFullYear()
    && Number(parts[1]) === date.getMonth() + 1
    && Number(parts[2]) === date.getDate();
}

function sumTransactions(items, txType) {
  return items
    .filter((tx) => tx.txType === txType)
    .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
}

function getWeekDates(day) {
  const base = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, day);
  const dayOfWeek = base.getDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(base);
  start.setDate(base.getDate() - offset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getWeekdayLabel(date) {
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

function renderInsight() {
  if (!els.insight) return;

  const items = Array.isArray(summaryState.expenseByCategory) ? summaryState.expenseByCategory : [];
  if (items.length === 0) {
    els.insight.style.display = "none";
    els.insight.textContent = "";
    return;
  }

  const topCategory = items.reduce((max, item) => {
    if (!max) return item;
    return toNumber(item.amount) > toNumber(max.amount) ? item : max;
  }, null);

  if (!topCategory || toNumber(topCategory.amount) <= 0) {
    els.insight.style.display = "none";
    els.insight.textContent = "";
    return;
  }

  const name = topCategory.categoryName || TEXT.formCategory;
  els.insight.style.display = "block";
  els.insight.innerHTML = `${escHtml(TEXT.insightTopCategory)} <span class="insight-icon">${renderIcon(topCategory.icon, 16)}</span> ${escHtml(name)} (${formatAmount(topCategory.amount)}) 입니다`;
  applyLucideIcons();
}
function renderHistory() {
  if (!els.historyList) return;

  const sortValue = els.sortSelect?.value || "date-desc";
  const sorted = getFilteredTransactions();
  switch (sortValue) {
    case "date-desc":
      sorted.sort((a, b) => compareTransactions(b, a));
      break;
    case "date-asc":
      sorted.sort((a, b) => compareTransactions(a, b));
      break;
    case "amount-desc":
      sorted.sort((a, b) => toNumber(b.amount) - toNumber(a.amount));
      break;
    case "amount-asc":
      sorted.sort((a, b) => toNumber(a.amount) - toNumber(b.amount));
      break;
    case "category":
      sorted.sort((a, b) => (a.categoryName || "").localeCompare(b.categoryName || ""));
      break;
    default:
      sorted.sort((a, b) => compareTransactions(b, a));
      break;
  }
  els.historyList.innerHTML = sorted.map((tx) => {
    const icon = tx.categoryIcon || null;
    const categoryName = tx.categoryName || TEXT.formCategory;
    const note = tx.description || "";
    const amountClass = tx.txType === "INCOME" ? "income" : "expense";
    const isFixed = tx.txType === "EXPENSE" && tx.isFixed === "Y";
    const isRecurring = tx.txType === "EXPENSE" && tx.isRecurring === "Y";
    return `
      <article class="transaction-item" data-id="${tx.id}">
        <div class="transaction-main">
          <div class="transaction-icon">${renderIcon(icon, 20)}</div>
          <div class="transaction-body">
            <div class="transaction-top-row">
              <div class="transaction-title-row">
                <strong class="transaction-category">${escHtml(categoryName)}</strong>
                ${isFixed ? `<span class="badge-fixed">${escHtml(TEXT.fixedExpense)}</span>` : ""}
                ${isRecurring ? `<span class="badge-recurring">${escHtml(TEXT.recurringLabel)}</span>` : ""}
              </div>
              <span class="transaction-amount ${amountClass}">${formatTxAmount(tx.amount, tx.txType)}</span>
            </div>
            <div class="transaction-meta">
              <span>${escHtml(tx.txDate || "")}</span>
              <span>${escHtml(formatPaymentMethod(tx.paymentMethod))}</span>
              ${note ? `<span>${escHtml(note)}</span>` : ""}
            </div>
            <div class="transaction-actions-row">
              <button type="button" class="action-btn copy" data-action="copy" data-id="${tx.id}">${escHtml(TEXT.copyLabel)}</button>
              <button type="button" class="action-btn edit" data-action="edit" data-id="${tx.id}">${escHtml(TEXT.editLabel)}</button>
              <button type="button" class="action-btn delete" data-action="delete" data-id="${tx.id}">${escHtml(TEXT.deleteLabel)}</button>
            </div>
          </div>
        </div>
      </article>`;
  }).join("");

  if (els.historyCount) els.historyCount.textContent = String(sorted.length);
  toggleEmptyState(els.historyList, els.historyEmpty, sorted.length === 0, TEXT.historyEmpty);
  applyLucideIcons();
}

function bindEvents() {
  els.typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentTxType = button.dataset.value || "EXPENSE";
      syncTypeButtons();
      populateCategoryOptions(currentTxType, null);
      syncFixedFieldVisibility();
      syncCustomCategoryVisibility();
    });
  });

  els.category?.addEventListener("change", () => {
    syncCustomCategoryVisibility();
  });
  els.amount?.addEventListener("input", () => {
    renderAmountDisplay();
  });
  els.isFixed?.addEventListener("change", () => {
    syncRecurringFieldVisibility();
  });

  els.save?.addEventListener("click", handleSubmit);
  els.cancel?.addEventListener("click", () => resetForm());
  els.searchInput?.addEventListener("input", () => renderHistory());
  els.filterCategory?.addEventListener("change", () => renderHistory());
  els.filterPayment?.addEventListener("change", () => renderHistory());
  els.sortSelect?.addEventListener("change", () => renderHistory());
  els.darkModeToggle?.addEventListener("click", toggleDarkMode);
  els.budgetSaveBtn?.addEventListener("click", saveBudget);
  els.budgetList?.addEventListener("click", handleBudgetListClick);
  els.categorySettingsBtn?.addEventListener("click", openCategoryModal);
  els.modalClose?.addEventListener("click", closeCategoryModal);
  els.modalAddBtn?.addEventListener("click", addCategoryFromModal);
  els.modalAddType?.addEventListener("change", () => {
    setSelectedModalIcon(getDefaultModalIcon(els.modalAddType?.value || "EXPENSE"));
    renderIconPicker();
  });
  els.modalIconBtn?.addEventListener("click", () => {
    els.modalIconPicker?.classList.toggle("is-open");
    applyLucideIcons();
  });
  els.modalIconPicker?.addEventListener("click", handleIconPickerClick);
  els.categoryModal?.addEventListener("click", (event) => {
    if (event.target === els.categoryModal) {
      closeCategoryModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.categoryModal?.style.display !== "none") {
      closeCategoryModal();
    }
  });
  els.modalExpenseList?.addEventListener("click", handleCategoryModalAction);
  els.modalIncomeList?.addEventListener("click", handleCategoryModalAction);
  els.calendarGrid?.addEventListener("click", handleCalendarClick);
  els.calendarDayDetail?.addEventListener("click", handleCalendarDetailToggle);

  els.dashboardTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab || "chart";
      setDashboardTab(tab);
      if (tab === "calendar") {
        renderCalendar();
      }
      if (tab === "yearly") {
        renderYearlyReport();
      }
    });
  });

  els.historyList?.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) return;

    const id = Number(target.dataset.id);
    if (!Number.isFinite(id)) return;

    if (target.dataset.action === "copy") copyTransaction(id);
    if (target.dataset.action === "edit") startEdit(id);
    if (target.dataset.action === "delete") deleteTransaction(id);
  });
}


async function handleSubmit() {
  const formData = collectFormData();
  if (!formData) return;

  const isEditing = editingId !== null;
  const button = els.save;
  if (button) {
    button.disabled = true;
    button.textContent = isEditing ? TEXT.formEditing : TEXT.formSaving;
  }

  try {
    const categoryId = await resolveCategoryId(formData);
    const payload = {
      txType: formData.txType,
      categoryId,
      amount: formData.amount,
      txDate: formData.txDate,
      description: formData.description,
      paymentMethod: formData.paymentMethod,
      isFixed: formData.isFixed,
      isRecurring: formData.isRecurring,
    };

    const response = await fetch(isEditing ? `/finance/transactions/${editingId}` : "/finance/transactions", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", [CSRF_HEADER]: CSRF_TOKEN },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("submit failed");

    const saved = await response.json();
    upsertTransaction(saved);
    await refreshSummary();
    renderAll();
    resetForm();
    showToast(isEditing ? TEXT.toastUpdated : TEXT.toastSaved, "success");
  } catch (error) {
    console.error("handleSubmit error:", error);
    showToast(isEditing ? TEXT.toastUpdateFailed : TEXT.toastSaveFailed);
    if (button) button.textContent = isEditing ? TEXT.formEdit : TEXT.formSave;
  } finally {
    if (button) button.disabled = false;
  }
}

async function resolveCategoryId(formData) {
  if (!formData.customCategoryName) {
    return formData.categoryId;
  }

  const existing = categoryList.find((category) => category.catType === formData.txType && category.catName === formData.customCategoryName);
  if (existing) {
    return existing.id;
  }

  const params = new URLSearchParams({
    catType: formData.txType,
    catName: formData.customCategoryName,
  });

  const response = await fetch("/finance/categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      [CSRF_HEADER]: CSRF_TOKEN,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error("category create failed");
  }

  const created = await response.json();
  categoryList.push(created);
  populateCategoryOptions(currentTxType, created.id);
  populateFilterCategories();
  syncCustomCategoryVisibility();
  return created.id;
}

async function deleteTransaction(id) {
  if (!confirm(TEXT.confirmDelete)) return;

  try {
    const response = await fetch(`/finance/transactions/${id}`, {
      method: "DELETE",
      headers: { [CSRF_HEADER]: CSRF_TOKEN },
    });

    if (!response.ok) throw new Error("delete failed");

    const index = txList.findIndex((item) => item.id === id);
    if (index !== -1) txList.splice(index, 1);
    if (editingId === id) resetForm();

    await refreshSummary();
    renderAll();
    showToast(TEXT.toastDeleted, "success");
  } catch (error) {
    console.error("deleteTransaction error:", error);
    showToast(TEXT.toastDeleteFailed);
  }
}

function startEdit(id) {
  const tx = txList.find((item) => item.id === id);
  if (!tx) return;

  editingId = id;
  currentTxType = tx.txType || "EXPENSE";
  syncTypeButtons();
  populateCategoryOptions(currentTxType, tx.categoryId);
  syncCustomCategoryVisibility();

  if (els.editId) els.editId.value = String(id);
  if (els.amount) els.amount.value = tx.amount ?? "";
  renderAmountDisplay();
  if (els.date) els.date.value = tx.txDate || "";
  if (els.isFixed) els.isFixed.checked = tx.isFixed === "Y";
  syncFixedFieldVisibility();
  if (els.isRecurring) els.isRecurring.checked = tx.isRecurring === "Y";
  syncRecurringFieldVisibility();
  if (els.paymentMethod) els.paymentMethod.value = tx.paymentMethod || "CASH";
  if (els.description) els.description.value = tx.description || "";
  if (els.formTitle) els.formTitle.textContent = TEXT.formEditTitle;
  if (els.save) els.save.textContent = TEXT.formEdit;
  if (els.cancel) els.cancel.style.display = "";
}

function copyTransaction(id) {
  const tx = txList.find((item) => item.id === id);
  if (!tx) return;

  editingId = null;
  if (els.editId) els.editId.value = "";

  currentTxType = tx.txType || "EXPENSE";
  syncTypeButtons();
  populateCategoryOptions(currentTxType, tx.categoryId);
  syncCustomCategoryVisibility();
  hideCustomCategoryGroup();

  if (els.amount) els.amount.value = tx.amount ?? "";
  renderAmountDisplay();
  setTodayDate();
  if (els.isFixed) els.isFixed.checked = tx.isFixed === "Y";
  syncFixedFieldVisibility();
  if (els.isRecurring) els.isRecurring.checked = tx.isRecurring === "Y";
  syncRecurringFieldVisibility();
  if (els.paymentMethod) els.paymentMethod.value = tx.paymentMethod || "CASH";
  if (els.description) els.description.value = tx.description || "";
  if (els.formTitle) els.formTitle.textContent = TEXT.formTitle;
  if (els.save) {
    els.save.textContent = TEXT.formSave;
    els.save.disabled = false;
  }
  if (els.cancel) els.cancel.style.display = "none";
}
function resetForm() {
  editingId = null;
  if (els.editId) els.editId.value = "";
  els.form?.reset();
  currentTxType = detectInitialType();
  syncTypeButtons();
  populateCategoryOptions(currentTxType, null);
  syncFixedFieldVisibility();
  hideCustomCategoryGroup();
  setDefaultDate();
  if (els.paymentMethod) els.paymentMethod.value = "CASH";
  if (els.isFixed) els.isFixed.checked = false;
  if (els.isRecurring) els.isRecurring.checked = false;
  renderAmountDisplay();
  syncRecurringFieldVisibility();
  if (els.formTitle) els.formTitle.textContent = TEXT.formTitle;
  if (els.save) {
    els.save.textContent = TEXT.formSave;
    els.save.disabled = false;
  }
  if (els.cancel) els.cancel.style.display = "none";
}

function populateBudgetCategoryOptions() {
  if (!els.budgetCategory) return;

  const selectedValue = els.budgetCategory.value || "";
  const categories = getCategoriesByType("EXPENSE");
  els.budgetCategory.innerHTML = [
    `<option value="">${escHtml(TEXT.budgetTotalBudget)}</option>`,
    ...categories.map((category) => `<option value="${category.id}">${escHtml(category.catName)}</option>`),
  ].join("");
  els.budgetCategory.value = categories.some((category) => String(category.id) === selectedValue) ? selectedValue : "";
}

async function saveBudget() {
  const categoryId = els.budgetCategory?.value || null;
  const amount = Number(els.budgetAmount?.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert(TEXT.budgetAmountPlaceholder);
    return;
  }

  const payload = {
    categoryId: categoryId ? Number(categoryId) : null,
    budgetYear: CURRENT_YEAR,
    budgetMonth: CURRENT_MONTH,
    amount,
  };

  try {
    const response = await fetch("/finance/budgets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER]: CSRF_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("budget save failed");

    const saved = await response.json();
    upsertBudget(saved);
    renderBudgetBars();
    resetBudgetForm();
  } catch (error) {
    console.error("saveBudget error:", error);
    showToast(TEXT.toastSaveFailed);
  }
}

function handleBudgetListClick(event) {
  const deleteButton = event.target.closest("button[data-action='delete-budget']");
  if (deleteButton) {
    event.stopPropagation();
    const id = Number(deleteButton.dataset.id);
    if (Number.isFinite(id)) {
      deleteBudget(id);
    }
    return;
  }

  const item = event.target.closest(".budget-item[data-id]");
  if (!item) return;
  fillBudgetForm(item.dataset.categoryId || "", item.dataset.amount || "");
}

async function deleteBudget(id) {
  if (!confirm(TEXT.budgetDeleteConfirm)) return;

  try {
    const response = await fetch(`/finance/budgets/${id}`, {
      method: "DELETE",
      headers: { [CSRF_HEADER]: CSRF_TOKEN },
    });
    if (!response.ok) throw new Error("budget delete failed");

    const index = budgetList.findIndex((budget) => budget.id === id);
    if (index !== -1) {
      budgetList.splice(index, 1);
    }
    renderBudgetBars();
    resetBudgetForm();
  } catch (error) {
    console.error("deleteBudget error:", error);
    showToast(TEXT.toastDeleteFailed);
  }
}

function upsertBudget(savedBudget) {
  const index = budgetList.findIndex((budget) => String(budget.categoryId ?? "") === String(savedBudget.categoryId ?? ""));
  if (index === -1) {
    budgetList.push(savedBudget);
    return;
  }
  budgetList[index] = savedBudget;
}

function fillBudgetForm(categoryId, amount) {
  if (els.budgetCategory) {
    els.budgetCategory.value = categoryId || "";
  }
  if (els.budgetAmount) {
    els.budgetAmount.value = amount || "";
  }
}

function resetBudgetForm() {
  if (els.budgetCategory) {
    els.budgetCategory.value = "";
  }
  if (els.budgetAmount) {
    els.budgetAmount.value = "";
  }
}
function openCategoryModal() {
  setSelectedModalIcon(getDefaultModalIcon(els.modalAddType?.value || "EXPENSE"));
  renderCategoryModal();
  if (els.categoryModal) {
    els.categoryModal.style.display = "flex";
  }
  applyLucideIcons();
}

function closeCategoryModal() {
  if (els.categoryModal) {
    els.categoryModal.style.display = "none";
  }
  if (els.modalAddName) {
    els.modalAddName.value = "";
  }
  if (els.modalIconPicker) {
    els.modalIconPicker.classList.remove("is-open");
  }
  setSelectedModalIcon(getDefaultModalIcon(els.modalAddType?.value || "EXPENSE"));
  populateCategoryOptions(currentTxType, els.category?.value || null);
  populateFilterCategories();
  syncCustomCategoryVisibility();
  renderHistory();
}

function renderCategoryModal() {
  renderCategoryModalList("EXPENSE", els.modalExpenseList);
  renderCategoryModalList("INCOME", els.modalIncomeList);
  renderIconPicker();
  updateModalIconButton();
  applyLucideIcons();
}

function renderCategoryModalList(catType, container) {
  if (!container) return;

  const categories = getCategoriesByType(catType);
  container.innerHTML = categories.map((category, index) => {
    const disableDelete = category.isDefault === "Y" ? "disabled" : "";
    const disableUp = index === 0 ? "disabled" : "";
    const disableDown = index === categories.length - 1 ? "disabled" : "";
    return `
      <div class="modal-category-item" data-id="${category.id}">
        <span class="cat-icon">${renderIcon(category.icon, 18)}</span>
        <span class="cat-name">${escHtml(category.catName)}</span>
        <div class="cat-order-actions">
          <button type="button" class="cat-move" data-action="move-up" data-type="${catType}" data-id="${category.id}" ${disableUp}>${renderSystemIcon("chevron-up", 14)}</button>
          <button type="button" class="cat-move" data-action="move-down" data-type="${catType}" data-id="${category.id}" ${disableDown}>${renderSystemIcon("chevron-down", 14)}</button>
        </div>
        <button type="button" class="cat-delete" data-action="delete-category" data-type="${catType}" data-id="${category.id}" ${disableDelete}>${renderSystemIcon("x", 14)}</button>
      </div>`;
  }).join("");
}

async function handleCategoryModalAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const catType = button.dataset.type || "EXPENSE";
  if (!Number.isFinite(id)) return;

  if (button.dataset.action === "move-up") {
    await moveCategory(catType, id, -1);
    return;
  }
  if (button.dataset.action === "move-down") {
    await moveCategory(catType, id, 1);
    return;
  }
  if (button.dataset.action === "delete-category") {
    await deleteCategoryFromModal(id);
  }
}

function handleIconPickerClick(event) {
  const button = event.target.closest("button[data-icon]");
  if (!button) return;
  const icon = button.dataset.icon || getDefaultModalIcon(els.modalAddType?.value || "EXPENSE");
  setSelectedModalIcon(icon);
  els.modalIconPicker?.classList.remove("is-open");
  renderIconPicker();
}

async function addCategoryFromModal() {
  const catType = els.modalAddType?.value || "EXPENSE";
  const catName = (els.modalAddName?.value || "").trim();
  if (!catName) {
    showToast(TEXT.formCategory);
    return;
  }

  const params = new URLSearchParams({ catType, catName, icon: selectedModalIcon });
  try {
    const response = await fetch("/finance/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        [CSRF_HEADER]: CSRF_TOKEN,
      },
      body: params.toString(),
    });
    if (!response.ok) throw new Error("category add failed");

    const created = await response.json();
    categoryList.push(created);
    sortCategoryList();
    renderCategoryModal();
    populateCategoryOptions(currentTxType, els.category?.value || null);
    populateFilterCategories();
    if (els.modalAddName) {
      els.modalAddName.value = "";
      els.modalAddName.focus();
    }
    setSelectedModalIcon(getDefaultModalIcon(catType));
    renderIconPicker();
  } catch (error) {
    console.error("addCategoryFromModal error:", error);
    showToast(TEXT.toastSaveFailed);
  }
}

async function deleteCategoryFromModal(id) {
  if (!confirm(TEXT.categoryDeleteConfirm)) return;

  try {
    const response = await fetch(`/finance/categories/${id}`, {
      method: "DELETE",
      headers: { [CSRF_HEADER]: CSRF_TOKEN },
    });
    if (!response.ok) throw new Error("category delete failed");

    const index = categoryList.findIndex((category) => category.id === id);
    if (index !== -1) {
      categoryList.splice(index, 1);
    }
    sortCategoryList();
    renderCategoryModal();
    populateCategoryOptions(currentTxType, els.category?.value || null);
    populateFilterCategories();
    syncCustomCategoryVisibility();
  } catch (error) {
    console.error("deleteCategoryFromModal error:", error);
    showToast(TEXT.toastDeleteFailed);
  }
}

async function moveCategory(catType, id, direction) {
  const categories = getCategoriesByType(catType);
  const index = categories.findIndex((category) => category.id === id);
  const nextIndex = index + direction;
  if (index === -1 || nextIndex < 0 || nextIndex >= categories.length) {
    return;
  }

  const moved = categories[index];
  categories[index] = categories[nextIndex];
  categories[nextIndex] = moved;
  categories.forEach((category, order) => {
    const target = categoryList.find((item) => item.id === category.id);
    if (target) {
      target.sortOrder = order + 1;
    }
  });
  sortCategoryList();
  renderCategoryModal();

  try {
    await persistCategoryOrder(catType);
    populateCategoryOptions(currentTxType, els.category?.value || null);
    populateFilterCategories();
  } catch (error) {
    console.error("moveCategory error:", error);
    showToast(TEXT.toastUpdateFailed);
  }
}

async function persistCategoryOrder(catType) {
  const response = await fetch("/finance/categories/order", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      [CSRF_HEADER]: CSRF_TOKEN,
    },
    body: JSON.stringify({
      catType,
      categoryIds: getCategoriesByType(catType).map((category) => category.id),
    }),
  });

  if (!response.ok) {
    throw new Error("category order failed");
  }
}

function getCategoriesByType(catType) {
  return [...categoryList]
    .filter((category) => category.catType === catType)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

function getDefaultModalIcon(catType) {
  return catType === "INCOME" ? "wallet" : "utensils";
}

function setSelectedModalIcon(iconName) {
  selectedModalIcon = iconName || getDefaultModalIcon(els.modalAddType?.value || "EXPENSE");
  updateModalIconButton();
}

function updateModalIconButton() {
  if (!els.modalIconBtn) return;
  els.modalIconBtn.innerHTML = renderIcon(selectedModalIcon, 18);
  applyLucideIcons();
}

function renderIconPicker() {
  if (!els.modalIconPicker) return;
  els.modalIconPicker.innerHTML = ICON_LIST.map((name) => `
    <button type="button" class="icon-option${name === selectedModalIcon ? " active" : ""}" data-icon="${name}" aria-label="${name}">
      ${renderIcon(name, 18)}
    </button>`).join("");
  applyLucideIcons();
}

function sortCategoryList() {
  categoryList.sort((a, b) => {
    if ((a.catType || "") !== (b.catType || "")) {
      return String(a.catType || "").localeCompare(String(b.catType || ""));
    }
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
}

function populateFilterCategories() {
  if (!els.filterCategory) return;

  const selectedValue = els.filterCategory.value || "";
  const categories = [...categoryList].sort((a, b) => {
    if ((a.catType || "") !== (b.catType || "")) {
      return String(a.catType || "").localeCompare(String(b.catType || ""));
    }
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });

  els.filterCategory.innerHTML = [
    `<option value="">${escHtml(TEXT.filterAllCategory)}</option>`,
    ...categories.map((category) => `<option value="${category.id}">${escHtml(category.catName)}</option>`),
  ].join("");
  els.filterCategory.value = categories.some((category) => String(category.id) === selectedValue) ? selectedValue : "";
}

function getFilteredTransactions() {
  const keyword = (els.searchInput?.value || "").trim().toLocaleLowerCase();
  const categoryId = els.filterCategory?.value || "";
  const paymentMethod = els.filterPayment?.value || "";

  return txList.filter((tx) => {
    const description = String(tx.description || "").toLocaleLowerCase();
    const matchesKeyword = !keyword || description.includes(keyword);
    const matchesCategory = !categoryId || String(tx.categoryId) === categoryId;
    const matchesPayment = !paymentMethod || String(tx.paymentMethod || "") === paymentMethod;
    return matchesKeyword && matchesCategory && matchesPayment;
  });
}
function populateCategoryOptions(txType, selectedId) {
  if (!els.category) return;

  const categories = getCategoriesByType(txType);
  els.category.innerHTML = `
    <option value="" disabled ${selectedId == null ? "selected" : ""}>${escHtml(TEXT.formCategory)}</option>
    ${categories.map((category) => `<option value="${category.id}" ${String(category.id) === String(selectedId) ? "selected" : ""}>${escHtml(category.catName)}</option>`).join("")}`;
}

async function refreshSummary() {
  try {
    const params = new URLSearchParams({ year: String(CURRENT_YEAR), month: String(CURRENT_MONTH) });
    const response = await fetch(`/finance/summary?${params.toString()}`, {
      headers: { [CSRF_HEADER]: CSRF_TOKEN },
    });

    if (!response.ok) throw new Error("summary fetch failed");

    const data = await response.json();
    summaryState = normalizeSummary(data);
  } catch (error) {
    console.error("refreshSummary error:", error);
    showToast(TEXT.toastSaveFailed);
  }
}

function collectFormData() {
  const categoryId = Number(els.category?.value);
  const amount = Number(els.amount?.value);
  const txDate = (els.date?.value || "").trim();
  const description = (els.description?.value || "").trim();
  const paymentMethod = els.paymentMethod?.value || "CASH";
  const isFixed = currentTxType === "EXPENSE" && els.isFixed?.checked ? "Y" : "N";
  const isRecurring = currentTxType === "EXPENSE" && isFixed === "Y" && els.isRecurring?.checked ? "Y" : "N";
  const customCategoryName = isCustomCategorySelected() ? (els.customCategory?.value || "").trim() : "";

  if (!Number.isFinite(categoryId)) {
    showToast(TEXT.formCategory);
    return null;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast(TEXT.formAmountPlaceholder);
    return null;
  }
  if (!txDate) {
    showToast(TEXT.formDate);
    return null;
  }

  return { txType: currentTxType, categoryId, amount, txDate, description, paymentMethod, isFixed, isRecurring, customCategoryName };
}

function upsertTransaction(tx) {
  const index = txList.findIndex((item) => item.id === tx.id);
  if (index === -1) {
    txList.unshift(tx);
    return;
  }
  txList[index] = tx;
}

function calculateBudgetSpent(budget) {
  if (budget.categoryId == null) {
    return txList.filter((tx) => tx.txType === "EXPENSE").reduce((sum, tx) => sum + toNumber(tx.amount), 0);
  }

  return txList
    .filter((tx) => tx.txType === "EXPENSE" && String(tx.categoryId) === String(budget.categoryId))
    .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
}

function normalizeSummary(summary) {
  const normalized = summary && typeof summary === "object" ? { ...summary } : {};
  normalized.totalIncome = toNumber(normalized.totalIncome);
  normalized.totalExpense = toNumber(normalized.totalExpense);
  normalized.fixedExpense = toNumber(normalized.fixedExpense);
  normalized.variableExpense = toNumber(normalized.variableExpense);
  normalized.dailyAverage = toNumber(normalized.dailyAverage);
  normalized.balance = toNumber(normalized.balance ?? normalized.totalIncome - normalized.totalExpense);
  normalized.trend = Array.isArray(normalized.trend)
    ? normalized.trend.map((item) => ({ ...item, income: toNumber(item.income), expense: toNumber(item.expense) }))
    : [];
  normalized.yearlyReport = Array.isArray(normalized.yearlyReport)
    ? normalized.yearlyReport.map((item) => ({ ...item, income: toNumber(item.income), expense: toNumber(item.expense) }))
    : [];
  normalized.incomeByCategory = Array.isArray(normalized.incomeByCategory)
    ? normalized.incomeByCategory.map((item) => ({ ...item, amount: toNumber(item.amount), percentage: Number(item.percentage || 0), changePercent: item.changePercent == null ? null : Number(item.changePercent) }))
    : [];
  normalized.expenseByCategory = Array.isArray(normalized.expenseByCategory)
    ? normalized.expenseByCategory.map((item) => ({ ...item, amount: toNumber(item.amount), percentage: Number(item.percentage || 0), changePercent: item.changePercent == null ? null : Number(item.changePercent) }))
    : [];
  return normalized;
}

function compareTransactions(a, b) {
  const dateA = `${a.txDate || ""} ${a.createdAt || ""}`;
  const dateB = `${b.txDate || ""} ${b.createdAt || ""}`;
  return dateA.localeCompare(dateB);
}

function detectInitialType() {
  return DEFAULT_TX_TYPE;
}

function setDashboardTab(tab) {
  els.dashboardTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });

  els.dashboardPanels.forEach((panel) => {
    const isActive = panel.dataset.panel === tab;
    panel.classList.toggle("active", isActive);
    panel.style.display = isActive ? "block" : "none";
  });
}

function syncTypeButtons() {
  els.typeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.value === currentTxType);
  });
}

function syncFixedFieldVisibility() {
  if (!els.fixedRow) return;
  const visible = currentTxType === "EXPENSE";
  els.fixedRow.style.display = visible ? "block" : "none";
  if (!visible && els.isFixed) els.isFixed.checked = false;
  syncRecurringFieldVisibility();
}

function syncRecurringFieldVisibility() {
  if (!els.recurringRow) return;
  const visible = currentTxType === "EXPENSE" && Boolean(els.isFixed?.checked);
  els.recurringRow.style.display = visible ? "block" : "none";
  if (!visible && els.isRecurring) {
    els.isRecurring.checked = false;
  }
}

function syncCustomCategoryVisibility() {
  if (isCustomCategorySelected()) {
    showCustomCategoryGroup();
    return;
  }
  hideCustomCategoryGroup();
}

function isCustomCategorySelected() {
  const selectedText = els.category?.options?.[els.category.selectedIndex]?.text || "";
  return selectedText.includes("기타");
}

function showCustomCategoryGroup() {
  if (els.customCategoryGroup) {
    els.customCategoryGroup.style.display = "block";
  }
}

function hideCustomCategoryGroup() {
  if (els.customCategoryGroup) {
    els.customCategoryGroup.style.display = "none";
  }
  if (els.customCategory) {
    els.customCategory.value = "";
  }
}

function setDefaultDate() {
  if (!els.date) return;
  els.date.value = getCurrentViewDefaultDate();
}

function renderAmountDisplay() {
  if (!els.amountDisplay) return;
  const rawValue = els.amount?.value;
  if (rawValue == null || rawValue === "") {
    els.amountDisplay.textContent = "";
    return;
  }

  const amount = Number(rawValue);
  if (!Number.isFinite(amount) || amount < 0) {
    els.amountDisplay.textContent = "";
    return;
  }

  const formatted = amount.toLocaleString("ko-KR", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 0,
    maximumFractionDigits: 2,
  });
  els.amountDisplay.textContent = `${formatted}${TEXT.unit}`;
}

function setTodayDate() {
  if (!els.date) return;
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  els.date.value = `${year}-${month}-${day}`;
}

function getCurrentViewDefaultDate() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  if (CURRENT_YEAR === currentYear && CURRENT_MONTH === currentMonth) {
    const day = String(today.getDate()).padStart(2, "0");
    return `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, "0")}-${day}`;
  }
  return `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, "0")}-01`;
}

function renderIcon(iconName, size = 16) {
  if (!iconName) {
    return `<i data-lucide="circle" style="width:${size}px;height:${size}px;"></i>`;
  }

  if (/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/u.test(iconName)) {
    return `<span style="font-size:${size}px;">${escHtml(iconName)}</span>`;
  }

  return `<i data-lucide="${escHtml(iconName)}" style="width:${size}px;height:${size}px;"></i>`;
}

function renderSystemIcon(iconName, size = 16) {
  return `<i data-lucide="${escHtml(iconName)}" style="width:${size}px;height:${size}px;"></i>`;
}

function applyLucideIcons() {
  if (typeof lucide !== "undefined" && typeof lucide.createIcons === "function") {
    lucide.createIcons();
  }
}

function applySavedTheme() {
  try {
    const savedTheme = localStorage.getItem("finance-theme");
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setDarkModeToggleIcon(true);
      return;
    }
  } catch (error) {
    console.warn("theme restore failed:", error);
  }

  document.documentElement.setAttribute("data-theme", "light");
  setDarkModeToggleIcon(false);
}

function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  const nextTheme = isDark ? "light" : "dark";
  html.setAttribute("data-theme", nextTheme);

  try {
    localStorage.setItem("finance-theme", nextTheme);
  } catch (error) {
    console.warn("theme save failed:", error);
  }

  setDarkModeToggleIcon(!isDark);
}

function setDarkModeToggleIcon(isDark) {
  if (!els.darkModeToggle) return;
  els.darkModeToggle.innerHTML = renderSystemIcon(isDark ? "sun" : "moon", 16);
  applyLucideIcons();
}

function formatAmount(amount) {
  return `₩${toNumber(amount).toLocaleString("ko-KR")}`;
}

function formatCompact(n) {
  const value = toNumber(n);
  if (value >= 10000) return `${Math.floor(value / 10000)}만`;
  if (value >= 1000) return `${Math.floor(value / 1000)}천`;
  return value.toLocaleString("ko-KR");
}

function formatSignedAmount(amount) {
  const value = toNumber(amount);
  if (value > 0) return `+${formatAmount(value)}`;
  if (value < 0) return `-${formatAmount(Math.abs(value))}`;
  return formatAmount(0);
}

function formatTxAmount(amount, txType) {
  const prefix = txType === "INCOME" ? "+" : "-";
  return `${prefix}${formatAmount(amount)}`;
}

function formatPercent(value) {
  return `${clampPercentage(value).toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

function formatPaymentMethod(method) {
  if (method === "CASH") return TEXT.paymentCash;
  if (method === "CARD") return TEXT.paymentCard;
  if (method === "TRANSFER") return TEXT.paymentTransfer;
  if (method === "OTHER") return TEXT.paymentOther;
  return method || "";
}

function toggleEmptyState(container, emptyElement, isEmpty, text) {
  if (container) container.style.display = isEmpty ? "none" : "flex";
  if (emptyElement) {
    emptyElement.textContent = text;
    emptyElement.style.display = isEmpty ? "flex" : "none";
  }
}

function clampPercentage(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(Number(value), 999));
}

function toNumber(value) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function escHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, type = "error") {
  const existing = document.getElementById("toast-msg");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast-msg";
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "28px",
    left: "50%",
    transform: "translateX(-50%)",
    background: type === "success" ? "#2d9d5e" : "#d94848",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "0.875rem",
    fontWeight: "600",
    zIndex: "9999",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    transition: "opacity 0.3s",
  });
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}
