import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = name => readFile(new URL(`../js/${name}.js`, import.meta.url), 'utf8');
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const categoriesUrl = url(await read('categories'));
const { getActiveCategories, getActiveExpenses, calculateTotalBudget, calculatePersonalBurden } = await import(categoriesUrl);
const { sortChartExpenses } = await import(url((await read('expenses')).replace('"./categories.js"', JSON.stringify(categoriesUrl))));
const { createBackupCsv, parseExpensesCsv } = await import(url((await read('csv')).replace('"./categories.js"', JSON.stringify(categoriesUrl))));
const categories = [
  { id: 'old', name: '過去の旅行', budget: 10000, icon: 'bi-airplane', archived: true, order: 0 },
  { id: 'new', name: '今の旅行', budget: 20000, icon: 'bi-train-front', order: 1 },
  { id: 'empty', name: '空の小冊子', budget: 5000, icon: 'bi-house', archived: true, order: 2 },
];
const expenses = [
  { id: 'a', name: 'A', categoryId: 'old', date: '2026-10-20', amount: 18000, people: 2 },
  { id: 'b', name: 'B', categoryId: 'new', date: '2026-10-21', amount: 10000, people: 4 },
  { id: 'c', name: 'C', categoryId: 'new', date: '2026-10-20', amount: 6000, people: 1 },
];
assert.deepEqual(getActiveCategories(categories).map(c => c.id), ['new']);
assert.equal(calculateTotalBudget(getActiveCategories(categories)), 20000);
assert.equal(getActiveExpenses(expenses, categories).reduce((sum, e) => sum + calculatePersonalBurden(e.amount, e.people), 0), 8500);
const ids = sort => sortChartExpenses(expenses, sort).map(e => e.id);
assert.deepEqual(ids('amount-desc'), ['a', 'c', 'b']);
assert.deepEqual(ids('amount-asc'), ['b', 'c', 'a']);
assert.deepEqual(ids('date-desc'), ['b', 'a', 'c']);
assert.deepEqual(ids('date-asc'), ['c', 'a', 'b']);
assert.deepEqual(ids('name'), ['a', 'b', 'c']);
assert.deepEqual(expenses.map(e => e.id), ['a', 'b', 'c']);
const backup = createBackupCsv(expenses, categories);
const restored = parseExpensesCsv(backup);
assert.equal(restored.invalidCount, 0);
assert.deepEqual(restored.categories.map(c => c.archived), [true, false, true]);
assert.equal(restored.rows.length, 3);
// Old backups lack the new column and must remain readable as active books.
const legacyBackup = backup.split('\r\n').map(line => line.slice(0, line.lastIndexOf(','))).join('\r\n');
assert.ok(parseExpensesCsv(legacyBackup).categories.every(c => !c.archived));
categories[0].archived = false;
assert.equal(calculateTotalBudget(getActiveCategories(categories)), 30000);
assert.equal(getActiveExpenses(expenses, categories).length, 3);
console.log('Archive, CSV compatibility, restore and five detail sort modes passed');
