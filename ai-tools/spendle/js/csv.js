import { calculatePersonalBurden } from "./categories.js";

export function exportExpensesAsCsv(expenses, categories) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const rows = [["日付", "カテゴリ", "支出名", "合計金額", "割り勘人数", "自分の負担額"]];
  expenses.forEach((expense) => {
    rows.push([expense.date, categoryNames.get(expense.categoryId) || "削除済みカテゴリ", expense.name, expense.amount, expense.people, calculatePersonalBurden(expense.amount, expense.people)]);
  });
  const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `支出データ_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  let text = String(value);
  // Spreadsheet formula injection prevention.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function parseExpensesCsv(text) {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  const dataRows = rows.slice(1);
  const parsedRows = [];
  let invalidCount = 0;
  dataRows.forEach((columns) => {
    const [date, categoryName, name, amountText, peopleText] = columns.map(unescapeFormulaGuard);
    const amount = Number(amountText);
    const people = Number(peopleText);
    if (!isValidDate(date) || !categoryName || !name || !Number.isInteger(amount) || amount <= 0 || !Number.isInteger(people) || people <= 0) {
      invalidCount++;
      return;
    }
    parsedRows.push({ date, categoryName, name, amount, people });
  });
  return { rows: parsedRows, invalidCount };
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
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
