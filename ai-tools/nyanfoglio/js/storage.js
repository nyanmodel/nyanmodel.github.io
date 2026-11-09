const STORAGE_KEY = "simple-expense-manager-data";
const CURRENT_VERSION = 1;

export function createEmptyData() {
  return { version: CURRENT_VERSION, categories: [], expenses: [] };
}

export function loadData() {
  try {
    const savedValue = localStorage.getItem(STORAGE_KEY);
    if (!savedValue) return createEmptyData();
    const data = JSON.parse(savedValue);
    if (!isValidData(data)) return createEmptyData();
    return data;
  } catch {
    return createEmptyData();
  }
}

export function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isValidData(data) {
  return data && data.version === CURRENT_VERSION && Array.isArray(data.categories) && Array.isArray(data.expenses);
}
