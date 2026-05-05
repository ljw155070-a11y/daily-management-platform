const txList = Array.isArray(TRANSACTIONS) ? [...TRANSACTIONS] : [];
let editingId = null;
let currentTxType = "EXPENSE";
let summaryState = normalizeSummary(SUMMARY);
let selectedCalendarDay = null;
const DEFAULT_TX_TYPE = document.querySelector(".finance-type-btn.active")?.dataset.value || document.querySelector(".finance-type-btn")?.dataset.value || "EXPENSE";

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
  chartList: document.getElementById("category-chart-list"),
  chartEmpty: document.getElementById("category-chart-empty"),
  budgetList: document.getElementById("budget-list"),
  budgetEmpty: document.getElementById("budget-empty"),
  calendarGrid: document.getElementById("calendar-grid"),
  calendarDayDetail: document.getElementById("calendar-day-detail"),
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
  categorySettingsBtn: document.getElementById("category-settings-btn"),
  categoryModal: document.getElementById("category-modal"),
  modalClose: document.getElementById("modal-close"),
  modalExpenseList: document.getElementById("modal-expense-list"),
  modalIncomeList: document.getElementById("modal-income-list"),
  modalAddType: document.getElementById("modal-add-type"),
  modalAddName: document.getElementById("modal-add-name"),
  modalAddBtn: document.getElementById("modal-add-btn"),
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
  renderCalendarDayDetail();
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
  const calendarGrid = els.calendarGrid;
  if (!calendarGrid) return;

  const headers = ["일", "월", "화", "수", "목", "금", "토"];
  const firstDay = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 1);
  const firstWeekday = firstDay.getDay();
  const totalDays = new Date(CURRENT_YEAR, CURRENT_MONTH, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === CURRENT_YEAR && today.getMonth() === CURRENT_MONTH - 1;
  const dailyIncome = {};
  const dailyExpense = {};

  txList.forEach((t) => {
    if (!t.txDate) return;
    const parts = String(t.txDate).split("-");
    if (parts.length !== 3) return;
    const txYear = Number(parts[0]);
    const txMonth = Number(parts[1]);
    const day = Number(parts[2]);
    const amt = Number(t.amount || 0);
    if (txYear !== CURRENT_YEAR || txMonth !== CURRENT_MONTH || !Number.isFinite(day)) return;
    if (t.txType === "INCOME") {
      dailyIncome[day] = (dailyIncome[day] || 0) + amt;
    } else {
      dailyExpense[day] = (dailyExpense[day] || 0) + amt;
    }
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
    const incomeAmt = dailyIncome[day] || 0;
    const expenseAmt = dailyExpense[day] || 0;
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
        ${incomeAmt > 0 ? `<div class="calendar-income">+${escHtml(formatCompact(incomeAmt))}</div>` : ""}
        ${expenseAmt > 0 ? `<div class="calendar-expense">-${escHtml(formatCompact(expenseAmt))}</div>` : ""}
      </div>`);
  }

  calendarGrid.innerHTML = html.join("");
}

function handleCalendarClick(event) {
  const cell = event.target.closest(".calendar-cell");
  if (!cell || cell.classList.contains("empty")) return;

  const day = Number(cell.dataset.day);
  if (!Number.isFinite(day)) return;

  if (selectedCalendarDay === day) {
    selectedCalendarDay = null;
    renderCalendar();
    renderCalendarDayDetail();
    return;
  }

  selectedCalendarDay = day;
  showDayDetail(day);
}

function showDayDetail(day) {
  selectedCalendarDay = day;
  renderCalendar();
  renderCalendarDayDetail();
}

function renderCalendarDayDetail() {
  if (!els.calendarDayDetail) return;
  if (selectedCalendarDay == null) {
    els.calendarDayDetail.style.display = "none";
    els.calendarDayDetail.innerHTML = "";
    return;
  }

  const items = txList
    .filter((tx) => matchesCurrentMonthDay(tx, selectedCalendarDay))
    .sort((a, b) => compareTransactions(b, a));

  const title = formatCalendarDayDetailTitle(CURRENT_MONTH, selectedCalendarDay);
  const body = items.length > 0
    ? items.map((tx) => `
        <div class="day-detail-item">
          <div class="transaction-title-row">
            <span class="cat-icon">${escHtml(tx.categoryIcon || "•")}</span>
            <span>${escHtml(tx.categoryName || TEXT.formCategory)}</span>
          </div>
          <strong class="transaction-amount ${tx.txType === "INCOME" ? "income" : "expense"}">${formatTxAmount(tx.amount, tx.txType)}</strong>
        </div>`).join("")
    : `<div class="day-detail-item">${escHtml(TEXT.calendarNoTransaction)}</div>`;

  els.calendarDayDetail.innerHTML = `<h4>${escHtml(title)}</h4>${body}`;
  els.calendarDayDetail.style.display = "block";
}

function matchesCurrentMonthDay(tx, day) {
  if (!tx?.txDate) return false;
  const parts = String(tx.txDate).split("-");
  if (parts.length !== 3) return false;
  return Number(parts[0]) === CURRENT_YEAR
    && Number(parts[1]) === CURRENT_MONTH
    && Number(parts[2]) === day;
}

function formatCalendarDayDetailTitle(month, day) {
  if (String(TEXT.pageTitle || "").includes("가계")) {
    return `${month}월 ${day}일 거래내역`;
  }

  return String(TEXT.calendarDayDetail || "Transactions on {0}/{1}")
    .replace("{0}", String(month))
    .replace("{1}", String(day))
    .replace("{month}", String(month))
    .replace("{day}", String(day));
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
          <button type="button" class="action-btn copy" data-action="copy" data-id="${tx.id}">${escHtml(TEXT.copyLabel)}</button>
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
  els.categorySettingsBtn?.addEventListener("click", openCategoryModal);
  els.modalClose?.addEventListener("click", closeCategoryModal);
  els.modalAddBtn?.addEventListener("click", addCategoryFromModal);
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

    if (target.dataset.action === "copy") copyTransaction(id);
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

function openCategoryModal() {
  renderCategoryModal();
  if (els.categoryModal) {
    els.categoryModal.style.display = "flex";
  }
}

function closeCategoryModal() {
  if (els.categoryModal) {
    els.categoryModal.style.display = "none";
  }
  if (els.modalAddName) {
    els.modalAddName.value = "";
  }
  populateCategoryOptions(currentTxType, els.category?.value || null);
  populateFilterCategories();
  syncCustomCategoryVisibility();
  renderHistory();
}

function renderCategoryModal() {
  renderCategoryModalList("EXPENSE", els.modalExpenseList);
  renderCategoryModalList("INCOME", els.modalIncomeList);
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
        <span class="cat-icon">${escHtml(category.icon || "•")}</span>
        <span class="cat-name">${escHtml(category.catName)}</span>
        <div class="cat-order-actions">
          <button type="button" class="cat-move" data-action="move-up" data-type="${catType}" data-id="${category.id}" ${disableUp}>↑</button>
          <button type="button" class="cat-move" data-action="move-down" data-type="${catType}" data-id="${category.id}" ${disableDown}>↓</button>
        </div>
        <button type="button" class="cat-delete" data-action="delete-category" data-type="${catType}" data-id="${category.id}" ${disableDelete}>✕</button>
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

async function addCategoryFromModal() {
  const catType = els.modalAddType?.value || "EXPENSE";
  const catName = (els.modalAddName?.value || "").trim();
  if (!catName) {
    showToast(TEXT.formCategory);
    return;
  }

  const params = new URLSearchParams({ catType, catName });
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
