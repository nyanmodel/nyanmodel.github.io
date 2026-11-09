import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../js/ocr.js', import.meta.url), 'utf8');
const { extractLikelyAmount, extractReceiptCandidates } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const cases = [
  ['小計 1,000\n消費税 100\n合計 ¥1,100\nお預り 10,000\nお釣り 8,900', 1100],
  ['合 計 ￥１，２８０\n現金 10,000', 1280],
  ['小計 900\nお支払額 990\nポイント 10000', 990],
  ['SUBTOTAL 1,000\nTOTAL 1,100\nCASH 10,000\nCHANGE 8,900', 1100],
  ['合計\n¥2,345\nお預り 5,000', 2345],
  ['合計\n消費税 100\nお預り 10,000', null],
  ['2026/09/07 12:34\nTEL 03-1234-5678\n登録番号 T1234567890123', null],
  ['10%対象 1,000\n内税 90\nお釣り 9,000', null],
  ['合計 9円', 9],
  ['合計: 1,100', 1100],
  ['合計：￥1,100', 1100],
  ['小計 1,000\n合計: 1,100', 1100],
  ['TOTAL: 1,100', 1100],
  ['合計 12:34', null],
  ['合計 12 : 34', null],
  ['合計 2026/09/07', null],
  ['合計 1,000.50', null],
  ['商品 300円\n合計 900\n値引 -100', 900],
  ['', null],
];
for (const [text, expected] of cases) assert.equal(extractLikelyAmount(text), expected, text);
assert.equal(extractReceiptCandidates('小計 1,000')[0].score, 50);
assert.equal(extractReceiptCandidates('商品 ¥500')[0].score, 10);
assert.equal(extractReceiptCandidates('合計 1000\n合計 1000').length, 1);
assert.equal(extractReceiptCandidates('合計 1000\n合計 2000').length, 2);
console.log(`${cases.length + 4} OCR parsing checks passed`);
