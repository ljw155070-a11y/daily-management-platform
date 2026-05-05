const txList = Array.isArray(TRANSACTIONS) ? [...TRANSACTIONS] : [];
let editingId = null;
let currentTxType = "EXPENSE";
let summaryState = normalizeSummary(SUMMARY);
const DEFAULT_TX_TYPE = document.querySelector(".finance-type-btn.active")?.dataset.value || document.querySelector(".finance-type-btn")?.dataset.value || "EXPENSE";

const categoryList = Array.isArray(CATEGORIES) ? [...CATEGORIES] : [];
const budgetList = Array.isArray(BUDGETS) ? [...BUDGETS] : [];

const els = {
  summaryIncome: document.getElementById("summary-income"),
  summaryExpense: document.getElementById("summary-expense"),
  summaryDaily: document.getElementById("summary-daily"),
  summaryFixedExpense: document.getElementById("summary-fixed-expense"),
  summaryVariableExpense: document.getElementById("summary-variable-expense"),
  summaryBalance: document.getElementById("summary-balance"),
  insight: document.getElementById("finance-insight"),
  chartList: document.getElementById("category-chart-list"),
  chartEmpty: document.getElementById("category-chart-empty"),
  budgetList: document.getElementById("budget-list"),
  budgetEmpty: document.getElementById("budget-empty"),
  calendarGrid: document.getElementById("calendar-grid"),
  historyList: document.getElementById("transaction-history-list"),
  historyEmpty: document.getElementById("transaction-history-empty"),
  historyCount: document.querySelector(".history-count"),
  searchInput: document.getElementById("finance-search"),
  filterCategory: document.getElementById("filter-category"),
  filterPayment: document.getElementById("filter-payment"),
  form: document.getElementById("finance-form"),
  editId: document.getElementById("finance-edit-id"),
  category: document.getElementById("finance-category"),
  customCategoryGroup: document.getElementById("custom-category-group"),
  customCategory: document.getElementById("finance-custom-category"),
  amount: document.getElementById("finance-amount"),
  date: document.getElementById("finance-date"),
  fixedRow: document.getElementById("finance-fixed-row"),
  isFixed: document.getElementById("finance-is-fixed"),
  paymentMethod: document.getElementById("finance-payment-method"),
  description: document.getElementById("finance-description"),
  save: document.getElementById("finance-save"),
  cancel: document.getElementById("finance-cancel"),
  formTitle: document.querySelector(".transaction-form-card .panel-form-title"),
  typeButtons: Array.from(document.querySelectorAll(".finance-type-btn")),
  dashboardTabs: Array.from(document.querySelectorAll(".dashboard-tab")),
  dashboardPanels: Array.from(document.querySelectorAll(".dashboard-panel")),
  monthButtons: Array.from(document.querySelectorAll(".month-nav-btn")),
};

document.addEventListener("DOMContentLoaded", () => {
  currentTxType = detectInitialType();
  populateCategoryOptions(currentTxType, null);
  syncFixedFieldVisibility();
  syncCustomCategoryVisibility();
  populateFilterCategories();
  setDashboardTab("chart");
  renderAll();
  bindEvents();
});

function renderAll() {
  renderSummary();
  renderCategoryChart();
  renderBudgetBars();
  renderCalendar();
  renderInsight();
  renderHistory();
}

function renderSummary() {
  if (els.summaryIncome) els.summaryIncome.textContent = formatAmount(summaryState.totalIncome);
  if (els.summaryExpense) els.summaryExpense.textContent = formatAmount(summaryState.totalExpense);
  if (els.summaryDaily) els.summaryDaily.textContent = `${TEXT.summaryDailyAvg} ${formatAmount(summaryState.dailyAverage)}`;
  if (els.summaryFixedExpense) els.summaryFixedExpense.textContent = formatAmount(summaryState.fixedExpense);
  if (els.summaryVariableExpense) els.summaryVariableExpense.textContent = formatAmount(summaryState.variableExpense);
  if (els.summaryBalance) els.summaryBalance.textContent = formatAmount(summaryState.balance);
}

function renderCategoryChart() {
  if (!els.chartList) return;

  const items = Array.isArray(summaryState.expenseByCategory) ? summaryState.expenseByCategory : [];
  els.chartList.innerHTML = items.map((item) => {
    const categoryName = item.categoryName || TEXT.formCategory;
    const icon = item.icon || "•";
    const percentage = clampPercentage(item.percentage);
    return `
      <div class="category-chart-item chart-bar">
        <div class="category-chart-top">
          <div class="category-meta">
            <span class="category-icon">${escHtml(icon)}</span>
            <span class="category-name">${escHtml(categoryName)}</span>
          </div>
          <div class="category-values">
            <strong>${formatAmount(item.amount)}</strong>
            <span>${formatPercent(percentage)}</span>
          </div>
        </div>
        <div class="category-bar-track chart-bar-track">
          <div class="category-bar-fill chart-bar-fill" style="width:${percentage}%;"></div>
        </div>
      </div>`;
  }).join("");

  toggleEmptyState(els.chartList, els.chartEmpty, items.length === 0, TEXT.historyEmpty);
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
      ? "width:100%; background:linear-gradient(90deg, #ef4444 0%, #f87171 100%); box-shadow:0 4px 10px rgba(239,68,68,0.22);"
      : `width:${usage}%;`;
    const name = budget.categoryName || TEXT.budgetTitle;
    return `
      <div class="budget-item">
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

  toggleEmptyState(els.budgetList, els.budgetEmpty, budgetList.length === 0, TEXT.budgetSet);
}

function renderCalendar() {
  const calendarGrid = document.getElementById("calendar-grid");
  if (!calendarGrid) return;

  const headers = ["일", "월", "화", "수", "목", "금", "토"];
  const firstDay = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 1);
  const firstWeekday = firstDay.getDay();
  const totalDays = new Date(CURRENT_YEAR, CURRENT_MONTH, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === CURRENT_YEAR && today.getMonth() === CURRENT_MONTH - 1;
  const dailyMap = {};

  txList.filter(t => t.txType === "EXPENSE" && t.txDate).forEach(t => {
    const parts = String(t.txDate).split("-");
    if (parts.length !== 3) return;
    const txYear = Number(parts[0]);
    const txMonth = Number(parts[1]);
    const day = Number(parts[2]);
    if (txYear !== CURRENT_YEAR || txMonth !== CURRENT_MONTH || !Number.isFinite(day)) return;
    dailyMap[day] = (dailyMap[day] || 0) + Number(t.amount || 0);
  });

  const html = [];
  headers.forEach((label) => {
    html.push(`<div class="calendar-header">${label}</div>`);
  });

  for (let i = 0; i < firstWeekday; i += 1) {
    html.push('<div class="calendar-cell empty"></div>');
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const weekday = (firstWeekday + day - 1) % 7;
    const amount = dailyMap[day] || 0;
    const cellClasses = ["calendar-cell"];
    const dayClasses = ["calendar-day"];

    if (isCurrentMonth && today.getDate() === day) {
      cellClasses.push("today");
    }
    if (weekday === 0) dayClasses.push("sunday");
    if (weekday === 6) dayClasses.push("saturday");

    const amountHtml = amount > 0
      ? `<div class="calendar-amount">${escHtml(formatAmount(amount))}</div>`
      : '<div class="calendar-no-spend"></div>';

    html.push(`
      <div class="${cellClasses.join(" ")}">
        <div class="${dayClasses.join(" ")}">${day}</div>
        ${amountHtml}
      </div>`);
  }

  calendarGrid.innerHTML = html.join("");
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

  const icon = topCategory.icon ? `${topCategory.icon} ` : "";
  const name = topCategory.categoryName || TEXT.formCategory;
  els.insight.style.display = "block";
  els.insight.textContent = `${TEXT.insightTopCategory} ${icon}${name} (${formatAmount(topCategory.amount)}) 입니다`;
}
function renderHistory() {
  if (!els.historyList) return;

  const sorted = getFilteredTransactions().sort((a, b) => compareTransactions(b, a));
  els.historyList.innerHTML = sorted.map((tx) => {
    const icon = tx.categoryIcon || "•";
    const categoryName = tx.categoryName || TEXT.formCategory;
    const note = tx.description || "";
    const amountClass = tx.txType === "INCOME" ? "income" : "expense";
    const fixedBadge = tx.txType === "EXPENSE" && tx.isFixed === "Y"
      ? `<span class="badge-fixed">${escHtml(TEXT.fixedExpense)}</span>`
      : "";
    return `
      <article class="transaction-item" data-id="${tx.id}">
        <div class="transaction-main">
          <div class="transaction-icon">${escHtml(icon)}</div>
          <div class="transaction-body">
            <div class="transaction-top-row">
              <div class="transaction-title-row">
                <strong class="transaction-category">${escHtml(categoryName)}</strong>
                ${fixedBadge}
              </div>
              <span class="transaction-amount ${amountClass}">${formatTxAmount(tx.amount, tx.txType)}</span>
            </div>
            <div class="transaction-meta">
              <span>${escHtml(tx.txDate || "")}</span>
              <span>${escHtml(formatPaymentMethod(tx.paymentMethod))}</span>
              ${note ? `<span>${escHtml(note)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="transaction-actions">
          <button type="button" class="action-btn edit" data-action="edit" data-id="${tx.id}">${escHtml(TEXT.editLabel)}</button>
          <button type="button" class="action-btn delete" data-action="delete" data-id="${tx.id}">${escHtml(TEXT.deleteLabel)}</button>
        </div>
      </article>`;
  }).join("");

  if (els.historyCount) els.historyCount.textContent = String(sorted.length);
  toggleEmptyState(els.historyList, els.historyEmpty, sorted.length === 0, TEXT.historyEmpty);
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

  els.save?.addEventListener("click", handleSubmit);
  els.cancel?.addEventListener("click", () => resetForm());
  els.searchInput?.addEventListener("input", () => renderHistory());
  els.filterCategory?.addEventListener("change", () => renderHistory());
  els.filterPayment?.addEventListener("change", () => renderHistory());


  els.dashboardTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab || "chart";
      setDashboardTab(tab);
      if (tab === "calendar") {
        renderCalendar();
      }
    });
  });

  els.historyList?.addEventListener("click", (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) return;

    const id = Number(target.dataset.id);
    if (!Number.isFinite(id)) return;

    if (target.dataset.action === "edit") startEdit(id);
    if (target.dataset.action === "delete") deleteTransaction(id);
  });

  els.monthButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const direction = Number(button.dataset.direction || 0);
      if (direction !== 0) navigateMonth(direction);
    });
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

function navigateMonth(direction) {
  const base = new Date(CURRENT_YEAR, CURRENT_MONTH - 1 + direction, 1);
  const params = new URLSearchParams({ year: String(base.getFullYear()), month: String(base.getMonth() + 1) });
  window.location.href = `/finance?${params.toString()}`;
}

function startEdit(id) {
  const tx = txList.find((item) => item.id === id);
  if (!tx) return;

  editingId = id;
  currentTxType = tx.txType || "EXPENSE";
  syncTypeButtons();
  populateCategoryOptions(currentTxType, tx.categoryId);
  syncFixedFieldVisibility();
  syncCustomCategoryVisibility();

  if (els.editId) els.editId.value = String(id);
  if (els.amount) els.amount.value = tx.amount ?? "";
  if (els.date) els.date.value = tx.txDate || "";
  if (els.isFixed) els.isFixed.checked = tx.isFixed === "Y";
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
  syncFixedFieldVisibility();
  syncCustomCategoryVisibility();
  hideCustomCategoryGroup();

  if (els.amount) els.amount.value = tx.amount ?? "";
  setTodayDate();
  if (els.isFixed) els.isFixed.checked = tx.isFixed === "Y";
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
  if (els.formTitle) els.formTitle.textContent = TEXT.formTitle;
  if (els.save) {
    els.save.textContent = TEXT.formSave;
    els.save.disabled = false;
  }
  if (els.cancel) els.cancel.style.display = "none";
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

  const categories = categoryList.filter((category) => category.catType === txType);
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

  return { txType: currentTxType, categoryId, amount, txDate, description, paymentMethod, isFixed, customCategoryName };
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
  const month = String(CURRENT_MONTH).padStart(2, "0");
  els.date.value = `${CURRENT_YEAR}-${month}-01`;
}

function formatAmount(amount) {
  return `₩${toNumber(amount).toLocaleString("ko-KR")}`;
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
    background: type === "success" ? "#22c55e" : "#ef4444",
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
