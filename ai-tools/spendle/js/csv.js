import { calculatePersonalBurden } from "./categories.js";

const BACKUP_HEADER = ["データ種別", "レコードID", "小冊子ID", "小冊子名", "アイコン", "予算", "表示順", "日付", "支出名", "合計金額", "割り勘人数", "自分の負担額", "作成日時"];
const LEGACY_HEADER = ["日付", "カテゴリ", "支出名", "合計金額", "割り勘人数", "自分の負担額"];

export function exportExpensesAsCsv(expenses, categories) {
  const csv = createBackupCsv(expenses, categories);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Spendleバックアップ_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function createBackupCsv(expenses, categories) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const rows = [BACKUP_HEADER];
  [...categories]
    .sort((first, second) => first.order - second.order)
    .forEach((category) => rows.push([
      "小冊子", category.id, category.id, category.name, category.icon, category.budget ?? 0, category.order, "", "", "", "", "", category.createdAt || "",
    ]));
  expenses.forEach((expense) => rows.push([
    "支出", expense.id, expense.categoryId, categoryNames.get(expense.categoryId) || "削除済み小冊子", "", "", "", expense.date, expense.name, expense.amount, expense.people,
    calculatePersonalBurden(expense.amount, expense.people), expense.createdAt || "",
  ]));
  return "\uFEFF" + rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

function escapeCsvValue(value) {
  let text = String(value);
  // Spreadsheet formula injection prevention.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function parseExpensesCsv(text) {
  const csvRows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  const header = csvRows[0]?.map(unescapeFormulaGuard) || [];
  if (header[0] === BACKUP_HEADER[0] && header.includes("小冊子ID")) return parseBackupRows(csvRows.slice(1), header);
  return parseLegacyRows(csvRows, header);
}

function parseBackupRows(dataRows, header) {
  const column = Object.fromEntries(header.map((name, index) => [name, index]));
  const categories = [];
  const rows = [];
  const categoryIds = new Set();
  const recordIds = new Set();
  let invalidCount = 0;

  dataRows.forEach((columns) => {
    const value = (name) => unescapeFormulaGuard(columns[column[name]] ?? "");
    const type = value("データ種別");
    const id = value("レコードID");
    const categoryId = value("小冊子ID");
    const createdAt = value("作成日時");
    if (type === "小冊子") {
      const name = value("小冊子名");
      const icon = value("アイコン");
      const budget = Number(value("予算"));
      const order = Number(value("表示順"));
      if (!id || !categoryId || id !== categoryId || categoryIds.has(categoryId) || !name || !/^bi-[a-z0-9-]+$/.test(icon) || !Number.isInteger(budget) || budget < 0 || !Number.isInteger(order) || order < 0) {
        invalidCount++;
        return;
      }
      categoryIds.add(categoryId);
      categories.push({ id, name, icon, budget, order, createdAt });
      return;
    }
    if (type === "支出") {
      const date = value("日付");
      const categoryName = value("小冊子名");
      const name = value("支出名");
      const amount = Number(value("合計金額"));
      const people = Number(value("割り勘人数"));
      if (!id || recordIds.has(id) || !categoryId || !categoryName || !isValidDate(date) || !name || !Number.isInteger(amount) || amount <= 0 || !Number.isInteger(people) || people <= 0) {
        invalidCount++;
        return;
      }
      recordIds.add(id);
      rows.push({ id, categoryId, categoryName, date, name, amount, people, createdAt });
      return;
    }
    invalidCount++;
  });
  return { categories, rows, invalidCount, format: "backup" };
}

function parseLegacyRows(csvRows, header) {
  if (!LEGACY_HEADER.every((name, index) => header[index] === name)) {
    return { categories: [], rows: [], invalidCount: Math.max(csvRows.length - 1, 0), format: "unknown" };
  }
  const parsedRows = [];
  let invalidCount = 0;
  csvRows.slice(1).forEach((columns) => {
    const [date, categoryName, name, amountText, peopleText] = columns.map(unescapeFormulaGuard);
    const amount = Number(amountText);
    const people = Number(peopleText);
    if (!isValidDate(date) || !categoryName || !name || !Number.isInteger(amount) || amount <= 0 || !Number.isInteger(people) || people <= 0) {
      invalidCount++;
      return;
    }
    parsedRows.push({ date, categoryName, name, amount, people });
  });
  return { categories: [], rows: parsedRows, invalidCount, format: "legacy" };
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function unescapeFormulaGuard(value = "") {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else field += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\r") {
      // Ignore; the following \n (or end of field) terminates the row.
    } else if (char === "\n") {
      row.push(field); field = ""; rows.push(row); row = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((columns) => columns.length > 1 || columns[0] !== "");
}
