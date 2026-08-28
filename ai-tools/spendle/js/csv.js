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
