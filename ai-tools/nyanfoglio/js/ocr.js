const TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

let tesseractLoadPromise = null;

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!tesseractLoadPromise) {
    tesseractLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TESSERACT_SRC;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => { tesseractLoadPromise = null; reject(new Error("Tesseract.jsの読み込みに失敗しました。")); };
      document.head.append(script);
    });
  }
  return tesseractLoadPromise;
}

// Images stay in the browser. Only the OCR engine and language data are downloaded.
export async function recognizeReceiptAmount(imageFile) {
  const Tesseract = await loadTesseract();
  const worker = await Tesseract.createWorker("jpn+eng");
  try {
    const { data } = await worker.recognize(imageFile);
    return extractReceiptCandidates(data.text);
  } finally {
    await worker.terminate();
  }
}

const EXCLUDED = /お?預[かり]*|釣[り銭]*|現金|消費税|内税|外税|税額|税対象|対象額|対象計|対象|値引|割引|ポイント|電話|TEL|登録番号|伝票|レシート番号|領収書番号|住所|SUBTOTAL|CHANGE|CASH|TENDER|TAX|DISCOUNT/i;
const TOTAL = /総合計|合計金額|お?支払[い]?金額|お?支払[い]?額|お?買[い]?上[げ]?金額|ご?請求[金]?額|税込[み]?合計|合計|総額|GRANDTOTAL|AMOUNTDUE|TOTAL/i;

function amountsInLine(line) {
  const amounts = [];
  for (const match of line.matchAll(/(?:[¥￥]\s*)?(?:\d{1,3}(?:,\s*\d{3})+|\d+)(?:\.\d+)?(?:\s*円)?/g)) {
    const before = line.slice(0, match.index);
    const after = line.slice(match.index + match[0].length);
    // Reject dates, percentages, phone fragments, identifiers and negative prices.
    if (/[-−\d/.]\s*$/.test(before) || /\d\s*:\s*$/.test(before) || /^\s*[%年月日点個名人/：:.-]/.test(after)) continue;
    const amount = Number(match[0].replace(/[¥￥円,\s]/g, ""));
    if (Number.isInteger(amount) && amount > 0 && amount <= 1000000) {
      amounts.push({ amount, marked: /[¥￥円,]/.test(match[0]) });
    }
  }
  return amounts;
}

// Keep the source label so a subtotal never masquerades as a confirmed total.
export function extractReceiptCandidates(text) {
  const lines = text.normalize("NFKC").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const candidates = [];
  lines.forEach((line, index) => {
    const compact = line.replace(/\s/g, "");
    const subtotal = /小計|SUBTOTAL/i.test(compact);
    if (EXCLUDED.test(compact) && !subtotal) return;
    const label = subtotal ? "小計" : compact.match(TOTAL)?.[0];
    let amounts = amountsInLine(line);
    if (label && !amounts.length && lines[index + 1] && /^[\s¥￥\d,.円]+$/.test(lines[index + 1])) {
      amounts = amountsInLine(lines[index + 1]);
    }
    if (label) {
      const candidate = amounts.at(-1);
      if (candidate) candidates.push({ amount: candidate.amount, label, score: subtotal ? 50 : 100 });
    } else if (!/[電話番号日時年月日]|TEL|\d[-/:]\d/i.test(compact)) {
      for (const candidate of amounts.filter(value => value.marked)) {
        candidates.push({ amount: candidate.amount, label: "金額表記（要確認）", score: 10 });
      }
    }
  });
  const unique = new Map();
  candidates.sort((a, b) => b.score - a.score).forEach(candidate => {
    if (!unique.has(candidate.amount)) unique.set(candidate.amount, candidate);
  });
  return [...unique.values()].slice(0, 5);
}

export function extractLikelyAmount(text) {
  return extractReceiptCandidates(text)[0]?.amount ?? null;
}
