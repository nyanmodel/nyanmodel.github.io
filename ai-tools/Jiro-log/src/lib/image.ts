export async function compressImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選択してください。');
  if (file.size > 30 * 1024 * 1024) throw new Error('写真は30MB以下のものを選択してください。');
  const url = URL.createObjectURL(file);
  try {
    // Modern Safari applies EXIF orientation when decoding into an HTMLImageElement.
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error('この画像形式は読み込めません。JPEGまたはPNGで選び直してください。'); }
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('画像処理を開始できませんでした。');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const encode = (type: string, quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
    let blob = await encode('image/webp', 0.8);
    if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', 0.8);
    if (!blob) throw new Error('画像を圧縮できませんでした。');
    if (blob.size > 800_000) blob = await encode(blob.type, 0.65) ?? blob;
    if (blob.size > 5 * 1024 * 1024) throw new Error('画像が大きすぎます。別の写真を選択してください。');
    return { blob, width: canvas.width, height: canvas.height, extension: blob.type === 'image/webp' ? 'webp' : 'jpg' };
  } finally { URL.revokeObjectURL(url); }
}
