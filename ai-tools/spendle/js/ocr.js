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

// Best-effort guess only: OCR on a receipt photo is noisy (skew, faded thermal
// paper, mixed Japanese/numeric text), so this deliberately favors a simple,
// explainable heuristic over an attempt at fully parsing the receipt layout.
// The caller must always let the user review/edit the returned amount.
export async function recognizeReceiptAmount(imageFile) {
  const Tesseract = await loadTesseract();
  const { data } = await Tesseract.recognize(imageFile, "eng");
  return extractLikelyAmount(data.text);
}

function extractLikelyAmount(text) {
  // Comma-grouped numbers (e.g. "1,200") are very likely printed prices, so
  // prefer them when present over any plain digit run (which also catches
  // phone numbers, receipt IDs, etc.).
  const commaMatches = text.match(/\d{1,3}(?:,\d{3})+/g) || [];
  const pool = commaMatches.length ? commaMatches : text.match(/\d{2,7}/g) || [];
  const candidates = pool
    .map((match) => Number(match.replaceAll(",", "")))
    .filter((amount) => Number.isInteger(amount) && amount >= 10 && amount <= 1000000);
  return candidates.length ? Math.max(...candidates) : null;
}
