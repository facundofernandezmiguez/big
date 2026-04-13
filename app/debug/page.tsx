"use client";
import { useEffect, useState } from "react";

function analyzeTemplate(src: string, cropRatio: number): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cropH = Math.round(img.naturalHeight * cropRatio);
      const W = img.naturalWidth;
      const H = cropH;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, W, cropH, 0, 0, W, cropH);

      const imageData = ctx.getImageData(0, 0, W, H);
      const d = imageData.data;
      const total = W * H;

      const bri = new Float32Array(total);
      for (let i = 0; i < total; i++) {
        const p = i * 4;
        bri[i] = (d[p] + d[p + 1] + d[p + 2]) / 3;
      }

      const BARRIER = 220;
      const isBg = new Uint8Array(total);
      const queue = new Int32Array(total);
      let head = 0, tail = 0;

      const tryEnqueue = (idx: number) => {
        if (bri[idx] >= BARRIER && !isBg[idx]) {
          isBg[idx] = 1;
          queue[tail++] = idx;
        }
      };

      for (let x = 0; x < W; x++) {
        tryEnqueue(x);
        tryEnqueue((H - 1) * W + x);
      }
      for (let y = 1; y < H - 1; y++) {
        tryEnqueue(y * W);
        tryEnqueue(y * W + W - 1);
      }

      while (head < tail) {
        const idx = queue[head++];
        const x = idx % W;
        const y = (idx - x) / W;
        if (y > 0) tryEnqueue(idx - W);
        if (y < H - 1) tryEnqueue(idx + W);
        if (x > 0) tryEnqueue(idx - 1);
        if (x < W - 1) tryEnqueue(idx + 1);
      }

      // Find enclosed white regions
      const visited = new Uint8Array(total);
      const regions: { centerX: number; centerY: number; size: number; minX: number; maxX: number; minY: number; maxY: number }[] = [];

      for (let i = 0; i < total; i++) {
        if (bri[i] >= 200 && !isBg[i] && !visited[i]) {
          const rQueue: number[] = [i];
          visited[i] = 1;
          let sumX = 0, sumY = 0, count = 0;
          let minX = W, maxX = 0, minY = H, maxY = 0;
          let rh = 0;

          while (rh < rQueue.length) {
            const idx = rQueue[rh++];
            const x = idx % W;
            const y = (idx - x) / W;
            sumX += x; sumY += y; count++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            const nb = [
              y > 0 ? idx - W : -1,
              y < H - 1 ? idx + W : -1,
              x > 0 ? idx - 1 : -1,
              x < W - 1 ? idx + 1 : -1,
            ];
            for (const n of nb) {
              if (n >= 0 && !visited[n] && bri[n] >= 200 && !isBg[n]) {
                visited[n] = 1;
                rQueue.push(n);
              }
            }
          }

          if (count > 100) {
            regions.push({
              centerX: Math.round(sumX / count),
              centerY: Math.round(sumY / count),
              size: count,
              minX, maxX, minY, maxY,
            });
          }
        }
      }

      const halfW = Math.round(W / 2);
      const lines: string[] = [];
      lines.push(`Image: ${img.naturalWidth}x${img.naturalHeight} | Cropped top ${cropRatio}: ${W}x${H} | Half split at x=${halfW}`);
      lines.push(`Found ${regions.length} enclosed white regions (>100px):`);

      for (const r of regions.sort((a, b) => a.centerX - b.centerX)) {
        const side = r.centerX < halfW ? "FRONT" : "BACK";
        const line = `${side} | center=[${r.centerX}, ${r.centerY}] | size=${r.size}px | bounds=[${r.minX},${r.minY}]-[${r.maxX},${r.maxY}]`;
        lines.push(line);
        console.log(`[${src}] ${line}`);
      }

      resolve(lines);
    };
    img.onerror = () => resolve([`ERROR loading ${src}`]);
    img.src = src;
  });
}

export default function DebugPage() {
  const [bocetoResults, setBocetoResults] = useState<string[]>([]);
  const [recorteResults, setRecorteResults] = useState<string[]>([]);

  useEffect(() => {
    analyzeTemplate("/boceto.png", 0.48).then(setBocetoResults);
    analyzeTemplate("/recortelateral.jpg.jpeg", 0.47).then(setRecorteResults);
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 13 }}>
      <h2>Debug: Enclosed White Regions Analysis</h2>
      <h3 style={{ marginTop: 20 }}>BOCETO (Clásica) — /boceto.png</h3>
      {bocetoResults.map((line, i) => (
        <div key={`b-${i}`}>{line}</div>
      ))}
      <h3 style={{ marginTop: 20 }}>RECORTE LATERAL — /recortelateral.jpg.jpeg</h3>
      {recorteResults.map((line, i) => (
        <div key={`r-${i}`}>{line}</div>
      ))}
    </div>
  );
}
