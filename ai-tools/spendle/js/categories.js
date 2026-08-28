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
