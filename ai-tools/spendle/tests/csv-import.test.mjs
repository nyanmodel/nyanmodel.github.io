import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const readModule = name => readFile(new URL(`../js/${name}.js`, import.meta.url), 'utf8');
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const categoriesUrl = moduleUrl(await readModule('categories'));
const { createCategory } = await import(categoriesUrl);
const { createExpense } = await import(moduleUrl(
  (await readModule('expenses')).replace('"./categories.js"', JSON.stringify(categoriesUrl))
));
const { createBackupCsv, parseExpensesCsv } = await import(moduleUrl(
  (await readModule('csv')).replace('"./categories.js"', JSON.stringify(categoriesUrl))
));
// Exercise the actual UI import handler without needing a browser or localStorage.
const app = await readModule('app');
const handler = app.slice(app.indexOf('function importExpensesFromCsv('), app.indexOf('function deleteCurrentCategory('));
const context = vm.createContext({
  data: { categories: [], expenses: [] },
  parseExpensesCsv, createCategory, createExpense,
  icons: ['bi-cart'], persistAndRender() {},
  window: { confirm: () => true, alert() {} },
});
vm.runInContext(handler, context);
const categories = [{ id: 'c1', name: '食費', icon: 'bi-cart', budget: 3000, order: 0 }];
const expenses = ['e1', 'e2'].map(id => ({
  id, categoryId: 'c1', date: '2026-09-07', name: 'コーヒー', amount: 300, people: 1,
}));
const backup = createBackupCsv(expenses, categories);
context.importExpensesFromCsv(backup, 'replace');
assert.equal(context.data.expenses.length, 2, 'Replace must preserve distinct IDs with identical content');
assert.equal(context.data.expenses.map(row => row.id).join(','), 'e1,e2');
context.importExpensesFromCsv(backup, 'append');
assert.equal(context.data.expenses.length, 2, 'Appending the same backup must not duplicate IDs');
context.importExpensesFromCsv(createBackupCsv([{ ...expenses[0], id: 'e3' }], categories), 'append');
assert.equal(context.data.expenses.length, 3, 'Append must preserve a new ID with identical content');
const legacy = '日付,カテゴリ,支出名,合計金額,割り勘人数,自分の負担額\n2026-09-07,食費,コーヒー,300,1,300';
context.importExpensesFromCsv(legacy, 'append');
assert.equal(context.data.expenses.length, 3, 'Legacy imports must still deduplicate by content');
console.log('5 CSV import checks passed');
