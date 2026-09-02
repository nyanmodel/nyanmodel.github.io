import { calculateCategoryBurden, calculatePersonalBurden, calculateTotalBudget, createCategory, getCategoryById } from "./categories.js";
import { exportExpensesAsCsv, parseExpensesCsv } from "./csv.js";
import { createExpense, sortExpensesByDate, validateExpense } from "./expenses.js";
import { recognizeReceiptAmount } from "./ocr.js";
import { loadData, saveData } from "./storage.js";

const icons = ["bi-airplane", "bi-cup-hot", "bi-music-note-beamed", "bi-car-front", "bi-pc-display", "bi-cart", "bi-house", "bi-controller", "bi-gift", "bi-book", "bi-cup-straw", "bi-stars"];
const legacyEmojiIcons = {
  "✈️": "bi-airplane", "🍜": "bi-cup-hot", "🎵": "bi-music-note-beamed", "🚗": "bi-car-front",
  "💻": "bi-pc-display", "🛒": "bi-cart", "🏠": "bi-house", "🎮": "bi-controller",
  "🎁": "bi-gift", "📚": "bi-book", "🍻": "bi-cup-straw", "✨": "bi-stars"
};
// Must stay >= the wave mask's max y in css/style.css (.category-fill), so the
// mask's lowest point (not its box edge) lines up with the budget percentage.
const WAVE_CREST_PX = 20;
let data = migrateLegacyEmojiIcons(loadData());
let selectedCategoryId = null;
let selectedIcon = icons[0];

const elements = {
  backButton: document.querySelector("#back-button"), pageTitle: document.querySelector("#page-title"), helpButton: document.querySelector("#help-button"), settingsButton: document.querySelector("#settings-button"),
  homeView: document.querySelector("#home-view"), categoryView: document.querySelector("#category-view"), totalBurden: document.querySelector("#total-burden"), totalBudgetNote: document.querySelector("#total-budget-note"), totalBudget: document.querySelector("#total-budget"), budgetPercentage: document.querySelector("#budget-percentage"), budgetDonutChart: document.querySelector("#budget-donut-chart"), categoryList: document.querySelector("#category-list"),
  addCategoryButton: document.querySelector("#add-category-button"), addExpenseButton: document.querySelector("#add-expense-button"), detailCategoryIcon: document.querySelector("#detail-category-icon"), categoryBurden: document.querySelector("#category-burden"), categoryCount: document.querySelector("#category-count"), categoryDonutWrap: document.querySelector("#category-donut-wrap"), categoryDonutChart: document.querySelector("#category-donut-chart"), categoryPercentage: document.querySelector("#category-percentage"), expenseList: document.querySelector("#expense-list"), editCategoryButton: document.querySelector("#edit-category-button"),
  expenseDialog: document.querySelector("#expense-dialog"), expenseForm: document.querySelector("#expense-form"), expenseDialogTitle: document.querySelector("#expense-dialog-title"), expenseId: document.querySelector("#expense-id"), expenseName: document.querySelector("#expense-name"), expenseAmount: document.querySelector("#expense-amount"), expensePeople: document.querySelector("#expense-people"), expenseCategory: document.querySelector("#expense-category"), expenseDate: document.querySelector("#expense-date"), expenseError: document.querySelector("#expense-form-error"), burdenPreviewValue: document.querySelector("#burden-preview-value"), burdenPreviewNote: document.querySelector("#burden-preview-note"),
  ocrScanButton: document.querySelector("#ocr-scan-button"), ocrFileInput: document.querySelector("#ocr-file-input"), ocrStatus: document.querySelector("#ocr-status"),
  categoryDialog: document.querySelector("#category-dialog"), categoryForm: document.querySelector("#category-form"), categoryDialogTitle: document.querySelector("#category-dialog-title"), categoryId: document.querySelector("#category-id"), categoryName: document.querySelector("#category-name"), categoryBudget: document.querySelector("#category-budget"), categoryError: document.querySelector("#category-form-error"), iconOptions: document.querySelector("#icon-options"), deleteCategoryButton: document.querySelector("#delete-category-button"),
  settingsDialog: document.querySelector("#settings-dialog"), exportCsvButton: document.querySelector("#export-csv-button"), importCsvButton: document.querySelector("#import-csv-button"), importCsvInput: document.querySelector("#import-csv-input"), helpDialog: document.querySelector("#help-dialog"), emptyCategories: document.querySelector("#empty-categories-template"), emptyExpenses: document.querySelector("#empty-expenses-template")
};

function formatYen(amount) { return `¥${new Intl.NumberFormat("ja-JP").format(amount)}`; }
function today() { return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }
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
    const budget = getCategoryBudget(category); const burden = calculateCategoryBurden(data.expenses, category.id);
    if (budget) {
      const fill = document.createElement("span"); fill.className = `category-fill${burden > budget ? " category-fill--over" : ""}`;
      const percent = Math.min((burden / budget) * 100, 100);
      fill.style.height = percent > 0 ? `calc(${percent}% + ${WAVE_CREST_PX}px)` : "0";
      fill.setAttribute("aria-hidden", "true");
      card.append(fill);
    }
    const icon = createCategoryIcon(category.icon, "category-icon");
    const name = document.createElement("span"); name.className = "category-name"; name.textContent = category.name;
    const amount = document.createElement("span"); amount.className = "category-amount"; amount.textContent = formatYen(burden);
    const count = document.createElement("span"); count.className = "category-count"; count.textContent = budget ? `予算 ${formatYen(budget)} ・ ${data.expenses.filter((expense) => expense.categoryId === category.id).length}件` : `${data.expenses.filter((expense) => expense.categoryId === category.id).length}件`;
    card.append(icon, name, amount, count); card.addEventListener("click", () => openCategory(category.id)); elements.categoryList.append(card);
  });
}

function openCategory(categoryId) {
  selectedCategoryId = categoryId;
  elements.homeView.classList.add("hidden"); elements.categoryView.classList.remove("hidden"); elements.backButton.classList.remove("hidden"); elements.helpButton.classList.add("hidden"); elements.settingsButton.classList.add("hidden"); elements.addCategoryButton.classList.add("hidden");
  renderCategoryDetail();
}

function returnHome() {
  selectedCategoryId = null;
  elements.homeView.classList.remove("hidden"); elements.categoryView.classList.add("hidden"); elements.backButton.classList.add("hidden"); elements.helpButton.classList.remove("hidden"); elements.settingsButton.classList.remove("hidden"); elements.addCategoryButton.classList.remove("hidden");
  elements.pageTitle.textContent = "Spendle."; elements.pageTitle.classList.add("app-logo");
}

function renderCategoryDetail() {
  const category = getCategoryById(data.categories, selectedCategoryId);
  if (!category) { returnHome(); return; }
  const expenses = sortExpensesByDate(data.expenses.filter((expense) => expense.categoryId === category.id));
  elements.pageTitle.textContent = category.name; elements.pageTitle.classList.remove("app-logo"); elements.detailCategoryIcon.replaceChildren(createCategoryIcon(category.icon, ""));
  const categoryBurden = calculateCategoryBurden(data.expenses, category.id);
  elements.categoryBurden.textContent = formatYen(categoryBurden); elements.categoryCount.textContent = `${expenses.length}件の支出`;
  renderCategoryDonutChart(categoryBurden, getCategoryBudget(category));
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
  populateCategorySelect(defaultCategoryId); updateBurdenPreview(); setOcrStatus(""); elements.expenseDialog.showModal(); elements.expenseName.focus();
}

function setOcrStatus(message, warn = false) {
  elements.ocrStatus.textContent = message;
  elements.ocrStatus.classList.toggle("hidden", !message);
  elements.ocrStatus.classList.toggle("ocr-status--warn", warn);
}

async function handleReceiptScan(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  elements.ocrScanButton.disabled = true;
  setOcrStatus("読み取り中…");
  try {
    const amount = await recognizeReceiptAmount(file);
    if (amount === null) {
      setOcrStatus("金額を読み取れませんでした。手入力してください。", true);
    } else {
      elements.expenseAmount.value = amount;
      updateBurdenPreview();
      setOcrStatus(`${formatYen(amount)} を読み取りました。金額が正しいか確認してください。`, true);
    }
  } catch (error) {
    console.warn("Receipt OCR failed.", error);
    setOcrStatus("読み取りに失敗しました。手入力してください。", true);
  } finally {
    elements.ocrScanButton.disabled = false;
  }
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

function drawDonut(canvas, percentageEl, burden, budget, options = {}) {
  const { radius = 52, lineWidth = 15, trackColor = "#d8e5ee", progressColor = "#004CA0", overBudgetColor = "#c0364b" } = options;
  const percentage = budget ? Math.round((burden / budget) * 100) : null;
  percentageEl.textContent = percentage === null ? "—" : `${percentage}%`;
  const context = canvas.getContext("2d");
  const size = canvas.width; const center = size / 2;
  context.clearRect(0, 0, size, size);
  context.lineWidth = lineWidth; context.lineCap = "round";
  context.strokeStyle = trackColor; context.beginPath(); context.arc(center, center, radius, 0, Math.PI * 2); context.stroke();
  if (!budget) return;
  const usedRatio = Math.min(burden / budget, 1);
  context.strokeStyle = burden > budget ? overBudgetColor : progressColor;
  context.beginPath(); context.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * usedRatio)); context.stroke();
}

function renderBudgetChart(totalBurden, totalBudget) {
  elements.totalBudgetNote.classList.toggle("hidden", !totalBudget);
  if (totalBudget) elements.totalBudget.textContent = formatYen(totalBudget);
  drawDonut(elements.budgetDonutChart, elements.budgetPercentage, totalBurden, totalBudget, {
    radius: 52, lineWidth: 15, trackColor: "rgba(255, 255, 255, 0.3)", progressColor: "#ffffff", overBudgetColor: "#ffb4c0",
  });
}

function renderCategoryDonutChart(categoryBurden, categoryBudget) {
  elements.categoryDonutWrap.classList.toggle("hidden", !categoryBudget);
  if (!categoryBudget) return;
  drawDonut(elements.categoryDonutChart, elements.categoryPercentage, categoryBurden, categoryBudget, { radius: 34, lineWidth: 11 });
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

function handleCsvFileSelected(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const mode = document.querySelector('input[name="import-mode"]:checked').value;
  const reader = new FileReader();
  reader.onload = () => importExpensesFromCsv(String(reader.result), mode);
  reader.readAsText(file);
}

function importExpensesFromCsv(text, mode) {
  const { rows, invalidCount } = parseExpensesCsv(text);
  if (!rows.length) { window.alert("読み込める支出データが見つかりませんでした。"); return; }
  if (mode === "replace") {
    if (!window.confirm(`既存の小冊子・支出をすべて削除して、CSVの内容に置き換えます。よろしいですか？`)) return;
    data.categories = []; data.expenses = [];
  }
  const categoryIdByName = new Map(data.categories.map((category) => [category.name, category.id]));
  let imported = 0; let duplicates = 0;
  rows.forEach((row) => {
    let categoryId = categoryIdByName.get(row.categoryName);
    if (!categoryId) {
      const category = createCategory(row.categoryName, icons[0], data.categories.length, 0);
      data.categories.push(category); categoryIdByName.set(category.name, category.id); categoryId = category.id;
    }
    const isDuplicate = data.expenses.some((expense) => expense.categoryId === categoryId && expense.date === row.date && expense.name === row.name && expense.amount === row.amount && expense.people === row.people);
    if (isDuplicate) { duplicates++; return; }
    data.expenses.push(createExpense({ name: row.name, amount: row.amount, people: row.people, categoryId, date: row.date }));
    imported++;
  });
  persistAndRender();
  const messages = [`${imported}件の支出を読み込みました。`];
  if (duplicates) messages.push(`${duplicates}件は既存データと重複していたためスキップしました。`);
  if (invalidCount) messages.push(`${invalidCount}件は形式が不正なためスキップしました。`);
  window.alert(messages.join("\n"));
}

function deleteCurrentCategory() {
  const categoryId = elements.categoryId.value; const count = data.expenses.filter((expense) => expense.categoryId === categoryId).length;
  const message = count ? "この小冊子を削除すると、紐づく支出もすべて削除されます。削除しますか？" : "この小冊子を削除しますか？";
  if (!window.confirm(message)) return;
  data.categories = data.categories.filter((category) => category.id !== categoryId); data.expenses = data.expenses.filter((expense) => expense.categoryId !== categoryId); elements.categoryDialog.close(); returnHome(); persistAndRender();
}

document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close()));
elements.addCategoryButton.addEventListener("click", () => openCategoryDialog()); elements.addExpenseButton.addEventListener("click", () => openExpenseDialog()); elements.backButton.addEventListener("click", returnHome); elements.editCategoryButton.addEventListener("click", () => openCategoryDialog(getCategoryById(data.categories, selectedCategoryId))); elements.helpButton.addEventListener("click", () => elements.helpDialog.showModal()); elements.settingsButton.addEventListener("click", () => elements.settingsDialog.showModal());
elements.expenseAmount.addEventListener("input", updateBurdenPreview); elements.expensePeople.addEventListener("input", updateBurdenPreview); elements.expenseForm.addEventListener("submit", saveExpense); elements.categoryForm.addEventListener("submit", saveCategory); elements.deleteCategoryButton.addEventListener("click", deleteCurrentCategory); elements.exportCsvButton.addEventListener("click", () => exportExpensesAsCsv(sortExpensesByDate(data.expenses), data.categories));
elements.ocrScanButton.addEventListener("click", () => elements.ocrFileInput.click()); elements.ocrFileInput.addEventListener("change", handleReceiptScan);
elements.importCsvButton.addEventListener("click", () => elements.importCsvInput.click()); elements.importCsvInput.addEventListener("change", handleCsvFileSelected);
window.addEventListener("resize", render);

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service Worker registration failed.", error));
  });
}
