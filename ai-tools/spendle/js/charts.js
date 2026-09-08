import { calculatePersonalBurden } from "./categories.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function createSpendingSeries(expenses, period, referenceDate) {
  const reference = parseDateKey(referenceDate);
  return period === "month"
    ? createMonthlySeries(expenses, reference)
    : period === "week"
      ? createWeeklySeries(expenses, reference)
      : createDailySeries(expenses, reference);
}

function createDailySeries(expenses, reference) {
  const start = new Date(reference.getTime() - 6 * DAY_MS);
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return {
      key: toDateKey(date),
      label: formatShortDate(date),
      detail: toDateKey(date),
      amount: 0,
      current: index === 6,
    };
  });
  addExpenses(points, expenses, (expense) => expense.date);
  return {
    points,
    title: "直近7日",
    note: "ピンクは今日",
    range: `${formatShortDate(start)} – ${formatShortDate(reference)}`,
  };
}

function createWeeklySeries(expenses, reference) {
  const monday = weekStart(reference);
  const start = new Date(monday.getTime() - 5 * 7 * DAY_MS);
  const points = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start.getTime() + index * 7 * DAY_MS);
    const end = new Date(Math.min(date.getTime() + 6 * DAY_MS, reference.getTime()));
    return {
      key: toDateKey(date),
      label: formatShortDate(date),
      detail: `${toDateKey(date)} ～ ${toDateKey(end)}`,
      amount: 0,
      current: index === 5,
    };
  });
  addExpenses(points, expenses.filter((expense) => expense.date <= toDateKey(reference)),
    (expense) => toDateKey(weekStart(parseDateKey(expense.date))));
  return {
    points,
    title: "直近6週",
    range: `${formatShortDate(start)} – ${formatShortDate(reference)}`,
    note: "月曜始まり · ピンクは今週（今日まで）",
  };
}

function weekStart(date) {
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
}

function createMonthlySeries(expenses, reference) {
  const points = Array.from({ length: 6 }, (_, index) => {
    const offset = index - 5;
    const date = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offset, 1));
    return {
      key: toMonthKey(date),
      label: `${date.getUTCMonth() + 1}月`,
      detail: `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`,
      amount: 0,
      current: index === 5,
    };
  });
  addExpenses(points, expenses.filter((expense) => expense.date <= toDateKey(reference)), (expense) => expense.date.slice(0, 7));
  const first = points[0].key.split("-").map(Number);
  const last = points[5].key.split("-").map(Number);
  return {
    points,
    title: "直近6か月",
    note: "ピンクは今月（今日まで）",
    range: `${first[0]}年${first[1]}月 – ${last[0]}年${last[1]}月`,
  };
}

function addExpenses(points, expenses, getKey) {
  const pointByKey = new Map(points.map((point) => [point.key, point]));
  expenses.forEach((expense) => {
    const point = pointByKey.get(getKey(expense));
    if (point) point.amount += calculatePersonalBurden(expense.amount, expense.people);
  });
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new TypeError("referenceDate must use YYYY-MM-DD format");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function toMonthKey(date) {
  return date.toISOString().slice(0, 7);
}

function formatShortDate(date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

export function createChartScale(maximum) {
  const target = Math.max(maximum, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].find(value => value * magnitude >= target) * magnitude);
  return { maximum: step * 4, ticks: Array.from({ length: 5 }, (_, index) => step * index) };
}
