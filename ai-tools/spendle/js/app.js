import { calculateCategoryBurden, calculatePersonalBurden, calculateTotalBudget, createCategory, getCategoryById } from "./categories.js";
import { exportExpensesAsCsv } from "./csv.js";
import { createExpense, sortExpensesByDate, validateExpense } from "./expenses.js";
import { loadData, saveData } from "./storage.js";

const icons = ["bi-airplane", "bi-cup-hot", "bi-music-note-beamed", "bi-car-front", "bi-pc-display", "bi-cart", "bi-house", "bi-controller", "bi-gift", "bi-book", "bi-cup-straw", "bi-stars"];
const legacyEmojiIcons = {
  "✈️": "bi-airplane", "🍜": "bi-cup-hot", "🎵": "bi-music-note-beamed", "🚗": "bi-car-front",
  "💻": "bi-pc-display", "🛒": "bi-cart", "🏠": "bi-house", "🎮": "bi-controller",
  "🎁": "bi-gift", "📚": "bi-book", "🍻": "bi-cup-straw", "✨": "bi-stars"
};
let data = migrateLegacyEmojiIcons(loadData());
let selectedCategoryId = null;
let selectedIcon = icons[0];

const elements = {
  backButton: document.querySelector("#back-button"), pageEyebrow: document.querySelector("#page-eyebrow"), pageTitle: document.querySelector("#page-title"), settingsButton: document.querySelector("#settings-button"),
  homeView: document.querySelector("#home-view"), categoryView: document.querySelector("#category-view"), totalBurden: document.querySelector("#total-burden"), totalBudget: document.querySelector("#total-budget"), budgetChartNote: document.querySelector("#budget-chart-note"), budgetPercentage: document.querySelector("#budget-percentage"), budgetDonutChart: document.querySelector("#budget-donut-chart"), categoryList: document.querySelector("#category-list"),
  addCategoryButton: document.querySelector("#add-category-button"), addExpenseButton: document.querySelector("#add-expense-button"), detailCategoryIcon: document.querySelector("#detail-category-icon"), categoryBurden: document.querySelector("#category-burden"), categoryCount: document.querySelector("#category-count"), expenseList: document.querySelector("#expense-list"), editCategoryButton: document.querySelector("#edit-category-button"),
  expenseDialog: document.querySelector("#expense-dialog"), expenseForm: document.querySelector("#expense-form"), expenseDialogTitle: document.querySelector("#expense-dialog-title"), expenseId: document.querySelector("#expense-id"), expenseName: document.querySelector("#expense-name"), expenseAmount: document.querySelector("#expense-amount"), expensePeople: document.querySelector("#expense-people"), expenseCategory: document.querySelector("#expense-category"), expenseDate: document.querySelector("#expense-date"), expenseError: document.querySelector("#expense-form-error"), burdenPreviewValue: document.querySelector("#burden-preview-value"), burdenPreviewNote: document.querySelector("#burden-preview-note"),
  categoryDialog: document.querySelector("#category-dialog"), categoryForm: document.querySelector("#category-form"), categoryDialogTitle: document.querySelector("#category-dialog-title"), categoryId: document.querySelector("#category-id"), categoryName: document.querySelector("#category-name"), categoryBudget: document.querySelector("#category-budget"), categoryError: document.querySelector("#category-form-error"), iconOptions: document.querySelector("#icon-options"), deleteCategoryButton: document.querySelector("#delete-category-button"),
  settingsDialog: document.querySelector("#settings-dialog"), exportCsvButton: document.querySelector("#export-csv-button"), emptyCategories: document.querySelector("#empty-categories-template"), emptyExpenses: document.querySelector("#empty-expenses-template")
};

function formatYen(amount) { return `¥${new Intl.NumberFormat("ja-JP").format(amount)}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function formatDate(date) { return date.replaceAll("-", "/"); }
function persistAndRender() { saveData(data); render(); }

function migrateLegacyEmojiIcons(savedData) {
  let hasChanges = false;
  savedData.categories.forEach((category) => {
    const replacement = legacyEmojiIcons[category.icon];
    if (replacement) { category.icon = replacement; hasChanges = true; }
  });
  if (hasChanges) saveData(savedData);
  return savedData;
}

function createCategoryIcon(iconName, className) {
  const icon = document.createElement("i");
  icon.className = className;
  icon.setAttribute("aria-hidden", "true");
  if (iconName.startsWith("bi-")) {
    icon.classList.add("bi", iconName);
  }
  return icon;
}

function render() {
  const total = data.expenses.reduce((sum, expense) => sum + calculatePersonalBurden(expense.amount, expense.people), 0);
  elements.totalBurden.textContent = formatYen(total);
  renderBudgetChart(total, calculateTotalBudget(data.categories));
  renderCategories();
  if (selectedCategoryId) renderCategoryDetail();
}

function renderCategories() {
  elements.categoryList.replaceChildren();
  const categories = [...data.categories].sort((first, second) => first.order - second.order);
  if (!categories.length) { elements.categoryList.append(elements.emptyCategories.content.cloneNode(true)); return; }
  categories.forEach((category) => {
    const card = document.createElement("button"); card.type = "button"; card.className = "category-card"; card.setAttribute("aria-label", `${category.name}を開く`);
    const icon = createCategoryIcon(category.icon, "category-icon");
    const name = document.createElement("span"); name.className = "category-name"; name.textContent = category.name;
    const amount = document.createElement("span"); amount.className = "category-amount"; amount.textContent = formatYen(calculateCategoryBurden(data.expenses, category.id));
    const count = document.createElement("span"); count.className = "category-count"; const budget = getCategoryBudget(category); count.textContent = budget ? `予算 ${formatYen(budget)} ・ ${data.expenses.filter((expense) => expense.categoryId === category.id).length}件` : `${data.expenses.filter((expense) => expense.categoryId === category.id).length}件`;
    card.append(icon, name, amount, count); card.addEventListener("click", () => openCategory(category.id)); elements.categoryList.append(card);
  });
}

function openCategory(categoryId) {
  selectedCategoryId = categoryId;
  elements.homeView.classList.add("hidden"); elements.categoryView.classList.remove("hidden"); elements.backButton.classList.remove("hidden"); elements.settingsButton.classList.add("hidden"); elements.addCategoryButton.classList.add("hidden");
  renderCategoryDetail();
}

function returnHome() {
  selectedCategoryId = null;
  elements.homeView.classList.remove("hidden"); elements.categoryView.classList.add("hidden"); elements.backButton.classList.add("hidden"); elements.settingsButton.classList.remove("hidden"); elements.addCategoryButton.classList.remove("hidden");
  elements.pageEyebrow.textContent = "PERSONAL EXPENSES"; elements.pageTitle.textContent = "Spendle";
}

function renderCategoryDetail() {
  const category = getCategoryById(data.categories, selectedCategoryId);
  if (!category) { returnHome(); return; }
  const expenses = sortExpensesByDate(data.expenses.filter((expense) => expense.categoryId === category.id));
  elements.pageEyebrow.textContent = "CATEGORY"; elements.pageTitle.textContent = category.name; elements.detailCategoryIcon.replaceChildren(createCategoryIcon(category.icon, ""));
  elements.categoryBurden.textContent = formatYen(calculateCategoryBurden(data.expenses, category.id)); elements.categoryCount.textContent = `${expenses.length}件の支出`;
  elements.expenseList.replaceChildren();
  if (!expenses.length) { elements.expenseList.append(elements.emptyExpenses.content.cloneNode(true)); return; }
  expenses.forEach((expense) => elements.expenseList.append(createExpenseItem(expense)));
}

function createExpenseItem(expense) {
  const item = document.createElement("article"); item.className = "expense-item";
  const main = document.createElement("div"); main.className = "expense-main";
  const description = document.createElement("div"); const name = document.createElement("p"); name.className = "expense-name"; name.textContent = expense.name;
  const date = document.createElement("p"); date.className = "expense-date"; date.textContent = formatDate(expense.date); description.append(name, date);
  const burden = document.createElement("p"); burden.className = "expense-burden"; burden.textContent = formatYen(calculatePersonalBurden(expense.amount, expense.people)); main.append(description, burden);
  const meta = document.createElement("div"); meta.className = "expense-meta"; const details = document.createElement("span"); details.textContent = `合計 ${formatYen(expense.amount)} ・ ${expense.people}人で割り勘`;
  const actions = document.createElement("span"); const edit = document.createElement("button"); edit.type = "button"; edit.className = "expense-edit"; edit.textContent = "編集"; edit.addEventListener("click", () => openExpenseDialog(expense));
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "expense-edit"; remove.textContent = "削除"; remove.addEventListener("click", () => deleteExpense(expense.id)); actions.append(edit, remove); meta.append(details, actions); item.append(main, meta); return item;
}

function populateCategorySelect(selectedId) {
  elements.expenseCategory.replaceChildren();
  const placeholder = new Option("小冊子を選択", ""); placeholder.disabled = true; elements.expenseCategory.add(placeholder);
  data.categories.forEach((category) => elements.expenseCategory.add(new Option(category.name, category.id)));
  elements.expenseCategory.value = selectedId || "";
}

function openExpenseDialog(expense = null) {
  if (!data.categories.length) { window.alert("先に小冊子を1つ作成してください。"); openCategoryDialog(); return; }
  elements.expenseForm.reset(); elements.expenseError.textContent = ""; elements.expenseId.value = expense?.id || ""; elements.expenseDialogTitle.textContent = expense ? "支出を編集" : "支出を登録";
  elements.expenseName.value = expense?.name || ""; elements.expenseAmount.value = expense?.amount || ""; elements.expensePeople.value = expense?.people || 1; elements.expenseDate.value = expense?.date || today();
  const defaultCategoryId = expense?.categoryId || selectedCategoryId || (data.categories.length === 1 ? data.categories[0].id : "");
  populateCategorySelect(defaultCategoryId); updateBurdenPreview(); elements.expenseDialog.showModal(); elements.expenseName.focus();
}

function updateBurdenPreview() {
  const amount = Number(elements.expenseAmount.value); const people = Number(elements.expensePeople.value);
  if (Number.isInteger(amount) && amount > 0 && Number.isInteger(people) && people > 0) {
    elements.burdenPreviewValue.textContent = formatYen(calculatePersonalBurden(amount, people)); elements.burdenPreviewNote.textContent = `合計 ${formatYen(amount)} を ${people}人で割り勘`;
  } else { elements.burdenPreviewValue.textContent = "¥0"; elements.burdenPreviewNote.textContent = "合計金額と人数を入力してください"; }
}

function saveExpense(event) {
  event.preventDefault();
  const values = { name: elements.expenseName.value.trim(), amount: Number(elements.expenseAmount.value), people: Number(elements.expensePeople.value), categoryId: elements.expenseCategory.value, date: elements.expenseDate.value };
  const error = validateExpense(values, data.categories); elements.expenseError.textContent = error; if (error) return;
  if (elements.expenseId.value) { const index = data.expenses.findIndex((expense) => expense.id === elements.expenseId.value); data.expenses[index] = { ...data.expenses[index], ...values }; }
  else data.expenses.push(createExpense(values));
  elements.expenseDialog.close(); persistAndRender();
}

function deleteExpense(expenseId) {
  if (!window.confirm("この支出を削除しますか？")) return;
  data.expenses = data.expenses.filter((expense) => expense.id !== expenseId); persistAndRender();
}

function renderIconOptions() {
  elements.iconOptions.replaceChildren();
  icons.forEach((icon) => { const button = document.createElement("button"); button.type = "button"; button.className = `icon-choice${icon === selectedIcon ? " selected" : ""}`; button.append(createCategoryIcon(icon, "")); button.setAttribute("aria-label", `${icon.replace("bi-", "")} を選択`); button.setAttribute("aria-pressed", String(icon === selectedIcon)); button.addEventListener("click", () => { selectedIcon = icon; renderIconOptions(); }); elements.iconOptions.append(button); });
}

function getCategoryBudget(category) {
  return Number.isInteger(category.budget) && category.budget > 0 ? category.budget : 0;
}

function renderBudgetChart(totalBurden, totalBudget) {
  const percentage = totalBudget ? Math.round((totalBurden / totalBudget) * 100) : null;
  elements.totalBudget.textContent = formatYen(totalBudget);
  elements.budgetPercentage.textContent = percentage === null ? "—" : `${percentage}%`;
  elements.budgetChartNote.textContent = totalBudget ? `実質負担額 ${formatYen(totalBurden)} ・ ${percentage}%使用` : "小冊子ごとに予算を設定してください";
  const canvas = elements.budgetDonutChart;
  const context = canvas.getContext("2d");
  const size = canvas.width; const center = size / 2; const radius = 52; const lineWidth = 15;
  context.clearRect(0, 0, size, size);
  context.lineWidth = lineWidth; context.lineCap = "round";
  context.strokeStyle = "#d8e5ee"; context.beginPath(); context.arc(center, center, radius, 0, Math.PI * 2); context.stroke();
  if (!totalBudget) return;
  const usedRatio = Math.min(totalBurden / totalBudget, 1);
  context.strokeStyle = totalBurden > totalBudget ? "#c0364b" : "#004CA0";
  context.beginPath(); context.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * usedRatio)); context.stroke();
}

function openCategoryDialog(category = null) {
  elements.categoryForm.reset(); elements.categoryError.textContent = ""; elements.categoryId.value = category?.id || ""; elements.categoryDialogTitle.textContent = category ? "小冊子を編集" : "小冊子を作成"; elements.categoryName.value = category?.name || ""; elements.categoryBudget.value = getCategoryBudget(category || {} ) || ""; selectedIcon = category?.icon || icons[0];
  elements.deleteCategoryButton.classList.toggle("hidden", !category); renderIconOptions(); elements.categoryDialog.showModal(); elements.categoryName.focus();
}

function saveCategory(event) {
  event.preventDefault(); const name = elements.categoryName.value.trim(); const budget = elements.categoryBudget.value === "" ? 0 : Number(elements.categoryBudget.value);
  if (!name) { elements.categoryError.textContent = "小冊子名を入力してください。"; return; }
  if (!Number.isInteger(budget) || budget < 0) { elements.categoryError.textContent = "予算は0円以上の整数で入力してください。"; return; }
  const id = elements.categoryId.value;
  if (id) { const category = getCategoryById(data.categories, id); Object.assign(category, { name, icon: selectedIcon, budget }); }
  else data.categories.push(createCategory(name, selectedIcon, data.categories.length, budget));
  elements.categoryDialog.close(); persistAndRender();
}

function deleteCurrentCategory() {
  const categoryId = elements.categoryId.value; const count = data.expenses.filter((expense) => expense.categoryId === categoryId).length;
  const message = count ? "この小冊子を削除すると、紐づく支出もすべて削除されます。削除しますか？" : "この小冊子を削除しますか？";
  if (!window.confirm(message)) return;
  data.categories = data.categories.filter((category) => category.id !== categoryId); data.expenses = data.expenses.filter((expense) => expense.categoryId !== categoryId); elements.categoryDialog.close(); returnHome(); persistAndRender();
}

document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close()));
elements.addCategoryButton.addEventListener("click", () => openCategoryDialog()); elements.addExpenseButton.addEventListener("click", () => openExpenseDialog()); elements.backButton.addEventListener("click", returnHome); elements.editCategoryButton.addEventListener("click", () => openCategoryDialog(getCategoryById(data.categories, selectedCategoryId))); elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
elements.expenseAmount.addEventListener("input", updateBurdenPreview); elements.expensePeople.addEventListener("input", updateBurdenPreview); elements.expenseForm.addEventListener("submit", saveExpense); elements.categoryForm.addEventListener("submit", saveCategory); elements.deleteCategoryButton.addEventListener("click", deleteCurrentCategory); elements.exportCsvButton.addEventListener("click", () => exportExpensesAsCsv(sortExpensesByDate(data.expenses), data.categories));
window.addEventListener("resize", () => renderBudgetChart(data.expenses.reduce((sum, expense) => sum + calculatePersonalBurden(expense.amount, expense.people), 0), calculateTotalBudget(data.categories)));

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service Worker registration failed.", error));
  });
}
