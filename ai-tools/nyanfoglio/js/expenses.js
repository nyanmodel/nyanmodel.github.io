import { calculatePersonalBurden } from "./categories.js";

export function createExpense(values) {
  return { id: crypto.randomUUID(), ...values, createdAt: new Date().toISOString() };
}

export function validateExpense(values, categories) {
  if (!values.name.trim()) return "支出名を入力してください。";
  if (!Number.isInteger(values.amount) || values.amount <= 0) return "金額は1円以上の整数で入力してください。";
  if (!Number.isInteger(values.people) || values.people < 1) return "割り勘人数は1人以上の整数で入力してください。";
  if (!categories.some((category) => category.id === values.categoryId)) return "小冊子を選択してください。";
  if (!isValidDate(values.date)) return "日付を入力してください。";
  return "";
}

export function sortExpensesByDate(expenses) {
  return [...expenses].sort((first, second) => {
    const dateDifference = second.date.localeCompare(first.date);
    return dateDifference || second.createdAt.localeCompare(first.createdAt);
  });
}

export { calculatePersonalBurden };

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}
