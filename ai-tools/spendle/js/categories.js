export function getCategoryById(categories, categoryId) {
  return categories.find((category) => category.id === categoryId);
}

export function calculateCategoryBurden(expenses, categoryId) {
  return expenses
    .filter((expense) => expense.categoryId === categoryId)
    .reduce((total, expense) => total + calculatePersonalBurden(expense.amount, expense.people), 0);
}

export function calculateTotalBudget(categories) {
  return categories.reduce((total, category) => total + (Number.isInteger(category.budget) && category.budget > 0 ? category.budget : 0), 0);
}

export function calculatePersonalBurden(amount, people) {
  return Math.round(amount / people);
}

export function createCategory(name, icon, order, budget) {
  return { id: createId(), name, icon, budget, createdAt: new Date().toISOString(), order };
}

function createId() {
  return crypto.randomUUID();
}

// Older records use the latest available creation timestamp until first edited.
export function sortCategories(categories, expenses, sort = "updated") {
  const timestamp = (value) => Date.parse(value) || 0;
  const latest = new Map(categories.map((category) => [category.id,
    Math.max(timestamp(category.updatedAt), timestamp(category.createdAt))]));
  expenses.forEach((expense) => latest.set(expense.categoryId, Math.max(
    latest.get(expense.categoryId) || 0, timestamp(expense.updatedAt), timestamp(expense.createdAt))));
  const names = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
  return [...categories].sort((a, b) => {
    const fallback = (a.order - b.order) || a.id.localeCompare(b.id);
    if (sort === "name") return names.compare(a.name, b.name) || fallback;
    if (sort === "created") return fallback;
    return (latest.get(b.id) - latest.get(a.id)) || fallback;
  });
}

export function touchCategories(categories, ids, updatedAt = new Date().toISOString()) {
  categories.forEach((category) => {
    if (ids.includes(category.id)) category.updatedAt = updatedAt;
  });
}
