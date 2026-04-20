import { removeBackground } from "@imgly/background-removal";

/**
 * Removes only the OUTER background of a shield/crest image, preserving the interior.
 *
 * Strategy:
 *  1. Run AI background removal to get a precise outer contour.
 *  2. Binarize weak-alpha fringe pixels (anti-alias halo) to fully transparent.
 *  3. Color-based flood-fill from the image edges on the ORIGINAL image, using
 *     the color sampled at the corners as "background reference". This removes
 *     any solid-color background that reaches the edge (including regions the
 *     AI kept opaque, e.g. the blue outside a circular crest, or the white
 *     around stars placed above a shield). The flood stops at any color
 *     boundary, so interiors enclosed by a distinct outline are preserved.
 *  4. Flood-fill from the image edges through transparent pixels of the result
 *     to mark the real background region.
 *  5. Any transparent pixel NOT reached by that flood-fill is an "interior hole"
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

  // Step 0.5: Color-based flood-fill from the image edges using the ORIGINAL
  // image. Samples the corner colors as the "background reference" and floods
  // through every pixel whose original color is within a tolerance of that
  // reference. This catches:
  //   - solid backgrounds the AI kept opaque (e.g. blue around a circle crest),
  //   - background color leftover around decorative elements outside the main
  //     shape (e.g. white around stars sitting above a shield).
  // The flood stops at any differently-colored boundary, so interior regions
  // enclosed by a distinct outline are never affected.
  //
  // A uniformity check over the sampled corners avoids running this pass on
  // images with photographic / non-uniform backgrounds where corner color is
  // not a reliable background reference.
  {
    const cornerRegion = 5;
    const samples: Array<[number, number, number]> = [];
    for (let cy = 0; cy < cornerRegion; cy++) {
      for (let cx = 0; cx < cornerRegion; cx++) {
        const coords: Array<[number, number]> = [
          [cx, cy],
          [w - 1 - cx, cy],
          [cx, h - 1 - cy],
          [w - 1 - cx, h - 1 - cy],
        ];
        for (const [x, y] of coords) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const p = (y * w + x) * 4;
          samples.push([original[p], original[p + 1], original[p + 2]]);
        }
      }
    }

    let avgR = 0, avgG = 0, avgB = 0;
    for (const s of samples) { avgR += s[0]; avgG += s[1]; avgB += s[2]; }
    avgR /= samples.length;
    avgG /= samples.length;
    avgB /= samples.length;

    // Uniformity check: if any sample deviates strongly from the mean, corners
    // are not a clean solid color -> skip this pass to stay safe.
    const UNIFORMITY_MAX_DIST2 = 60 * 60;
    let cornersUniform = true;
    for (const s of samples) {
      const dr = s[0] - avgR;
      const dg = s[1] - avgG;
      const db = s[2] - avgB;
      if (dr * dr + dg * dg + db * db > UNIFORMITY_MAX_DIST2) {
        cornersUniform = false;
        break;
      }
    }

    if (cornersUniform) {
      const COLOR_TOLERANCE = 48;
      const colorThresh2 = COLOR_TOLERANCE * COLOR_TOLERANCE;

      const colorBg = new Uint8Array(total);
      const cq = new Int32Array(total);
      let cqHead = 0;
      let cqTail = 0;

      const closeToBg = (idx: number) => {
        const p = idx * 4;
        const dr = original[p] - avgR;
        const dg = original[p + 1] - avgG;
        const db = original[p + 2] - avgB;
        return dr * dr + dg * dg + db * db < colorThresh2;
      };

      const seedColor = (idx: number) => {
        if (colorBg[idx]) return;
        if (!closeToBg(idx)) return;
        colorBg[idx] = 1;
        cq[cqTail++] = idx;
      };

      for (let x = 0; x < w; x++) {
        seedColor(x);
        seedColor((h - 1) * w + x);
      }
      for (let y = 0; y < h; y++) {
        seedColor(y * w);
        seedColor(y * w + (w - 1));
      }

      while (cqHead < cqTail) {
        const idx = cq[cqHead++];
        const x = idx % w;
        const y = (idx - x) / w;
        if (x > 0) seedColor(idx - 1);
        if (x < w - 1) seedColor(idx + 1);
        if (y > 0) seedColor(idx - w);
        if (y < h - 1) seedColor(idx + w);
      }

      for (let i = 0; i < total; i++) {
        if (colorBg[i]) pixels[i * 4 + 3] = 0;
      }
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
