import { removeBackground } from "@imgly/background-removal";

/**
 * Removes only the OUTER background of a shield/crest image, preserving the interior.
 *
 * Strategy:
 *  1. Run AI background removal to get a precise outer contour.
 *  2. Flood-fill from the image edges through transparent pixels to mark the
 *     real background region.
 *  3. Any transparent pixel NOT reached by that flood-fill is an "interior hole"
 *     (wrongly erased by the model) and is restored from the original image.
 *
 * This keeps the external cutout while respecting what is inside the shield.
 */
export async function removeOuterBackground(file: File): Promise<Blob> {
  const originalBitmap = await createImageBitmap(file);
  const w = originalBitmap.width;
  const h = originalBitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.drawImage(originalBitmap, 0, 0);
  const originalData = ctx.getImageData(0, 0, w, h);

  const bgRemovedBlob = await removeBackground(file);
  const bgRemovedBitmap = await createImageBitmap(bgRemovedBlob);

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(bgRemovedBitmap, 0, 0, w, h);
  const processedData = ctx.getImageData(0, 0, w, h);

  const pixels = processedData.data;
  const original = originalData.data;
  const total = w * h;

  // Step 0: kill the weak semi-transparent fringe the model leaves around the
  // shield. Those partially transparent pixels keep a mix of the original
  // (white-ish) background and show up as a dark halo over a dark jersey.
  // Binarizing low alphas to 0 removes the halo cleanly.
  const FRINGE_ALPHA = 128;
  for (let i = 0; i < total; i++) {
    if (pixels[i * 4 + 3] < FRINGE_ALPHA) {
      pixels[i * 4 + 3] = 0;
    }
  }

  const ALPHA_THRESHOLD = 16;
  const isTransparent = (i: number) => pixels[i * 4 + 3] < ALPHA_THRESHOLD;

  // BFS (using typed array + head pointer for speed).
  const reachable = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  const enqueueIfTransparent = (idx: number) => {
    if (reachable[idx]) return;
    if (!isTransparent(idx)) return;
    reachable[idx] = 1;
    queue[qTail++] = idx;
  };

  for (let x = 0; x < w; x++) {
    enqueueIfTransparent(x);
    enqueueIfTransparent((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    enqueueIfTransparent(y * w);
    enqueueIfTransparent(y * w + (w - 1));
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % w;
    const y = (idx - x) / w;

    if (x > 0) enqueueIfTransparent(idx - 1);
    if (x < w - 1) enqueueIfTransparent(idx + 1);
    if (y > 0) enqueueIfTransparent(idx - w);
    if (y < h - 1) enqueueIfTransparent(idx + w);
  }

  // Restore interior transparent pixels from the original image.
  let restoredCount = 0;
  for (let i = 0; i < total; i++) {
    if (!reachable[i] && isTransparent(i)) {
      const p = i * 4;
      pixels[p] = original[p];
      pixels[p + 1] = original[p + 1];
      pixels[p + 2] = original[p + 2];
      pixels[p + 3] = original[p + 3];
      restoredCount++;
    }
  }

  if (restoredCount > 0) {
    ctx.putImageData(processedData, 0, 0);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/png"
    );
  });
}
