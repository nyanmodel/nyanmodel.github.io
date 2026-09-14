import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readModule = name => readFile(new URL(`../js/${name}.js`, import.meta.url), "utf8");
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const categoriesUrl = moduleUrl(await readModule("categories"));
const chartsUrl = moduleUrl((await readModule("charts")).replace('"./categories.js"', JSON.stringify(categoriesUrl)));
const { createSpendingSeries, createChartScale } = await import(chartsUrl);

const expenses = [
  { date: "2026-09-01", amount: 900, people: 3 },
  { date: "2026-09-07", amount: 1200, people: 2 },
  { date: "2026-08-12", amount: 1000, people: 1 },
  { date: "2026-04-30", amount: 400, people: 1 },
  { date: "2026-03-31", amount: 9999, people: 1 },
];

const weekly = createSpendingSeries(expenses, "day", "2026-09-07");
assert.deepEqual(weekly.points.map(point => point.key), [
  "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07",
]);
assert.deepEqual(weekly.points.map(point => point.amount), [300, 0, 0, 0, 0, 0, 600]);
assert.equal(weekly.points.at(-1).current, true);

const monthly = createSpendingSeries(expenses, "month", "2026-09-07");
assert.deepEqual(monthly.points.map(point => point.key), ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
assert.deepEqual(monthly.points.map(point => point.amount), [400, 0, 0, 0, 1000, 900]);
assert.equal(monthly.range, "2026年4月 – 2026年9月");

const weeks = createSpendingSeries([
  { date: "2026-08-30", amount: 100, people: 1 },
  { date: "2026-08-31", amount: 600, people: 2 },
  { date: "2026-09-06", amount: 200, people: 1 },
  { date: "2026-09-07", amount: 400, people: 2 },
  { date: "2026-09-08", amount: 50, people: 1 },
  { date: "2026-09-09", amount: 999, people: 1 },
], "week", "2026-09-08");
assert.deepEqual(weeks.points.map(p => p.key), ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07"]);
assert.deepEqual(weeks.points.map(p => p.amount), [0, 0, 0, 100, 500, 250]);
assert.equal(weeks.points.at(-1).label, "9/7");
assert.equal(weeks.points.at(-1).detail, "2026-09-07 ～ 2026-09-08");
assert.equal(weeks.points.filter(p => p.current).length, 1);
assert.equal(createSpendingSeries([], "week", "2027-01-03").points.at(-1).key, "2026-12-28");
assert.equal(createSpendingSeries([], "week", "2024-03-01").points.at(-1).key, "2024-02-26");
assert.equal(createSpendingSeries([{date: "2026-09-09", amount: 999, people: 1}], "month", "2026-09-08").points.at(-1).amount, 0);
console.log("Chart aggregation checks passed");

for (const maximum of [0, 1, 3, 900, 10000, 123456]) {
  const scale = createChartScale(maximum);
  assert.ok(scale.maximum >= maximum);
  assert.equal(scale.ticks.length, 5);
  assert.equal(scale.ticks[0], 0);
  assert.equal(scale.ticks.at(-1), scale.maximum);
}
