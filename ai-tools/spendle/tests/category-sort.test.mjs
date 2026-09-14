import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../js/categories.js', import.meta.url), 'utf8');
const { sortCategories, touchCategories } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const categories = [
  { id: 'a', name: '旅行10', order: 0, createdAt: '2026-01-01' },
  { id: 'b', name: '旅行2', order: 1, createdAt: '2026-02-01' },
  { id: 'c', name: '旅行1', order: 2, createdAt: '2026-03-01' },
];
const expenses = [{ categoryId: 'a', createdAt: '2026-04-01', date: '2020-01-01' }];
const ids = (mode) => sortCategories(categories, expenses, mode).map(c => c.id).join(',');
assert.equal(ids(), 'a,c,b', 'Legacy records use creation timestamps, not expense dates');
assert.equal(ids('name'), 'c,b,a', 'Japanese names sort with natural numbers');
assert.equal(ids('created'), 'a,b,c');
touchCategories(categories, ['b'], '2026-05-01');
assert.equal(ids(), 'b,a,c', 'Editing/deleting contents keeps the booklet most recent');
touchCategories(categories, ['a', 'c'], '2026-06-01');
assert.equal(ids(), 'a,c,b', 'Moving an expense updates both booklets with a stable tie order');
assert.equal(categories.map(c => c.id).join(','), 'a,b,c', 'Sorting does not mutate stored registration order');
console.log('6 booklet sorting checks passed');
