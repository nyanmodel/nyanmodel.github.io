import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readModule = name => readFile(new URL(`../js/${name}.js`, import.meta.url), "utf8");
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const categoriesUrl = moduleUrl(await readModule("categories"));
const chartsUrl = moduleUrl((await readModule("charts")).replace('"./categories.js"', JSON.stringify(categoriesUrl)));
const { createSpendingSeries } = await import(chartsUrl);

const expenses = [
  { date: "2026-09-01", amount: 900, people: 3 },
  { date: "2026-09-07", amount: 1200, people: 2 },
  { date: "2026-08-12", amount: 1000, people: 1 },
  { date: "2026-04-30", amount: 400, people: 1 },
  { date: "2026-03-31", amount: 9999, people: 1 },
];

const weekly = createSpendingSeries(expenses, "week", "2026-09-07");
assert.deepEqual(weekly.points.map(point => point.key), [
  "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07",
]);
assert.deepEqual(weekly.points.map(point => point.amount), [300, 0, 0, 0, 0, 0, 600]);
assert.equal(weekly.points.at(-1).current, true);

const monthly = createSpendingSeries(expenses, "month", "2026-09-07");
assert.deepEqual(monthly.points.map(point => point.key), ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
assert.deepEqual(monthly.points.map(point => point.amount), [400, 0, 0, 0, 1000, 900]);
assert.equal(monthly.range, "2026年4月 – 2026年9月");

console.log("6 chart aggregation checks passed");
