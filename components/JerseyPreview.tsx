"use client";

import { useEffect, useState } from "react";
import { JerseyConfig } from "./types";

interface JerseyPreviewProps {
  config: JerseyConfig;
  className?: string;
}

// ─── Helpers ───
function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export function isLight(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

// ─── Staging: load image once, erase baked-in shield, cache canvas ───
let _stagingCanvas: HTMLCanvasElement | null = null;
let _stagingPromise: Promise<HTMLCanvasElement> | null = null;
let _imgW = 0;
let _imgH = 0;

// Call this to force staging re-build (e.g. after coordinate changes)
export function resetStaging() {
  _stagingCanvas = null;
  _stagingPromise = null;
}

function getStaging(): Promise<HTMLCanvasElement> {
  if (_stagingCanvas) return Promise.resolve(_stagingCanvas);
  if (_stagingPromise) return _stagingPromise;
  _stagingPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      _imgW = img.naturalWidth;
      _imgH = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = _imgW;
      c.height = _imgH;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      // Paint over the baked-in shield logo on the front (right chest area)
      // with black so it recolors to the chosen shirt color, blending in.
      // The user-uploaded shield is overlaid via HTML absolute positioning.
      ctx.fillStyle = "#000000";
      ctx.fillRect(135, 112, 80, 63);

      _stagingCanvas = c;
      resolve(c);
    };
    img.onerror = reject;
    img.src = "/frente.jpg";
  });
  return _stagingPromise;
}

// ─── Canvas recoloring ───
export function recolorPixels(
  source: HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
  color: string,
  outW: number, outH: number,
  dorsoColor?: string
): string {
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d")!;

  // Draw cropped region centered in the output canvas
  const offsetX = Math.round((outW - sw) / 2);
  ctx.drawImage(source, sx, sy, sw, sh, offsetX, 0, sw, sh);

  const imageData = ctx.getImageData(0, 0, outW, outH);
  const d = imageData.data;
  const { r, g, b } = hexToRgb(color);

  if (dorsoColor) {
    const { r: dr, g: dg, b: db } = hexToRgb(dorsoColor);
    const total = outW * outH;

    // Pre-compute brightness
    const bri = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      const p = i * 4;
      bri[i] = (d[p] + d[p + 1] + d[p + 2]) / 3;
    }

    // Flood fill from all 4 image edges to find background pixels.
    // Barrier: avg < 220 (body + strong anti-aliased edges block the flood).
    // Enclosed white areas (neckline scoop, racerback cutouts) stay un-flooded → dorso.
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

    // Seed from all 4 edges
    for (let x = 0; x < outW; x++) {
      tryEnqueue(x);
      tryEnqueue((outH - 1) * outW + x);
    }
    for (let y = 1; y < outH - 1; y++) {
      tryEnqueue(y * outW);
      tryEnqueue(y * outW + outW - 1);
    }

    // BFS 4-connectivity
    while (head < tail) {
      const idx = queue[head++];
      const x = idx % outW;
      const y = (idx - x) / outW;
      if (y > 0) tryEnqueue(idx - outW);
      if (y < outH - 1) tryEnqueue(idx + outW);
      if (x > 0) tryEnqueue(idx - 1);
      if (x < outW - 1) tryEnqueue(idx + 1);
    }

    // Expand background by 1 px to capture outer anti-aliased ring (200-220)
    const expand: number[] = [];
    for (let i = 0; i < total; i++) {
      if (bri[i] >= 200 && !isBg[i]) {
        const x = i % outW;
        const y = (i - x) / outW;
        if (
          (y > 0 && isBg[i - outW]) ||
          (y < outH - 1 && isBg[i + outW]) ||
          (x > 0 && isBg[i - 1]) ||
          (x < outW - 1 && isBg[i + 1])
        ) {
          expand.push(i);
        }
      }
    }
    for (const i of expand) isBg[i] = 1;

    // 1. FRONT: Neckline is DORSO (colored), Armholes are BG (transparent)
    // 2. BACK: Racerback cutouts are BG (transparent), Armholes are DORSO (colored)
    // We group them by what they should become: BG vs DORSO.
    // Seed coords are in source-image space; offset by sx to get output coords.
    
    // These become BACKGROUND (transparent)
    const BG_SEEDS_FULL: Array<[number, number]> = [
      [111, 68],   // Front left armhole
      [188, 66],   // Front right armhole
      [361, 76],   // Back left racerback cutout
      [433, 74],   // Back right racerback cutout
    ];

    // These become DORSO (colored)
    const DORSO_SEEDS_FULL: Array<[number, number]> = [
      [150, 63],   // Front neckline V center
      [196, 154],  // Front neckline bottom pocket
      [339, 100],  // Back left armhole
      [451, 99],   // Back right armhole
    ];

    const isExplicitBg = new Uint8Array(total);
    const isDorso = new Uint8Array(total);

    const floodFillFromSeeds = (seeds: Array<[number, number]>, targetMap: Uint8Array) => {
      for (const [seedFx, seedFy] of seeds) {
        const seedX = seedFx - sx;
        const seedY = seedFy;
        if (seedX < 0 || seedX >= outW || seedY < 0 || seedY >= outH) continue;

        let found = -1;
        for (let dy = -5; dy <= 5 && found < 0; dy++) {
          for (let dx = -5; dx <= 5 && found < 0; dx++) {
            const nx = seedX + dx, ny = seedY + dy;
            if (nx >= 0 && nx < outW && ny >= 0 && ny < outH) {
              const ni = ny * outW + nx;
              if (bri[ni] >= 200 && !isBg[ni] && !targetMap[ni]) found = ni;
            }
          }
        }
        if (found < 0) continue;

        const sq: number[] = [found];
        targetMap[found] = 1;
        while (sq.length > 0) {
          const idx = sq.pop()!;
          const cx = idx % outW, cy = (idx - cx) / outW;
          const nb = [
            cy > 0 ? idx - outW : -1,
            cy < outH - 1 ? idx + outW : -1,
            cx > 0 ? idx - 1 : -1,
            cx < outW - 1 ? idx + 1 : -1,
          ];
          for (const n of nb) {
            if (n >= 0 && !targetMap[n] && bri[n] >= 200 && !isBg[n]) {
              targetMap[n] = 1;
              sq.push(n);
            }
          }
        }
      }
    };

    floodFillFromSeeds(BG_SEEDS_FULL, isExplicitBg);
    floodFillFromSeeds(DORSO_SEEDS_FULL, isDorso);

    // Any pixel in the explicit BG map becomes background
    for (let i = 0; i < total; i++) {
      if (isExplicitBg[i]) {
        isBg[i] = 1;
      }
    }

    // Any bright pixel that is NOT in the dorso map also becomes background
    // (This catches any stray enclosed regions that we didn't explicitly seed as Dorso)
    for (let i = 0; i < total; i++) {
      if (bri[i] >= 200 && !isBg[i] && !isDorso[i]) {
        isBg[i] = 1;
      }
    }

    // Recolor with dorso awareness
    for (let i = 0; i < total; i++) {
      const p = i * 4;
      const a = bri[i];

      if (a < 200) {
        // Shirt body
        d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
      } else if (isBg[i]) {
        // Background → transparent / semi-transparent edge
        d[p] = r; d[p + 1] = g; d[p + 2] = b;
        d[p + 3] = a < 240 ? Math.round(((240 - a) / 40) * 255) : 0;
      } else {
        // Dorso (enclosed area)
        if (a >= 240) {
          d[p] = dr; d[p + 1] = dg; d[p + 2] = db; d[p + 3] = 255;
        } else {
          // Anti-aliased edge between body and dorso — blend
          const t = (a - 200) / 40;
          d[p] = Math.round(r * (1 - t) + dr * t);
          d[p + 1] = Math.round(g * (1 - t) + dg * t);
          d[p + 2] = Math.round(b * (1 - t) + db * t);
          d[p + 3] = 255;
        }
      }
    }
  } else {
    // Original behavior without dorso
    for (let i = 0; i < d.length; i += 4) {
      const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
      if (avg < 200) d[i + 3] = 255;
      else if (avg < 240) d[i + 3] = Math.round(((240 - avg) / 40) * 255);
      else d[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return out.toDataURL("image/png");
}

// ─── Hook: generates front + back data URLs for a given color ───
function useRecoloredPair(color: string, dorsoColor: string) {
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStaging().then((staging) => {
      if (cancelled) return;
      // Split at 50% so both halves have equal width → same rendered height
      const halfW = Math.round(_imgW / 2);
      const frontSw = halfW;
      const backSw = _imgW - halfW;
      const outW = Math.max(frontSw, backSw);

      setFrontUrl(recolorPixels(staging, 0, 0, frontSw, _imgH, color, outW, _imgH, dorsoColor));
      setBackUrl(recolorPixels(staging, halfW, 0, backSw, _imgH, color, outW, _imgH, dorsoColor));
    });
    return () => { cancelled = true; };
  }, [color, dorsoColor]);

  return { frontUrl, backUrl };
}

// ─── Component ───
export default function JerseyPreview({ config, className }: JerseyPreviewProps) {
  const primary = useRecoloredPair(config.color, config.secondaryColor);
  const secondary = useRecoloredPair(config.secondaryColor, config.color);

  const placeholder = (
    <div className="w-full aspect-[3/4] bg-gray-100 animate-pulse rounded" />
  );

  const imgStyle = { filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.15))" };

  const renderRow = (
    pair: { frontUrl: string; backUrl: string },
    color: string,
    labelFront: string,
    labelBack: string,
    textColor: string
  ) => (
    <>
      {/* Front */}
      <div className="relative flex flex-col items-center">
        {pair.frontUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pair.frontUrl} alt={labelFront} className="w-full h-auto" draggable={false} style={imgStyle} />
        ) : placeholder}
        {config.shieldUrl && config.showShield && (
          <div
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              left: config.shieldPosition === "left" ? "15%" : config.shieldPosition === "center" ? "32.5%" : "50.5%",
              top: "12%",
              width: "50%",
              height: "50%",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.shieldUrl}
              alt="Escudo"
              className="object-contain w-full h-full"
              style={{ width: `${config.shieldSize / 50 * 100}%`, height: `${config.shieldSize / 50 * 100}%` }}
              draggable={false}
            />
          </div>
        )}
        {config.showFrontNumber && config.number && (
          <div
            className="absolute text-center leading-none pointer-events-none"
            style={{
              left: config.frontNumberPosition === "left" ? "28%" : config.frontNumberPosition === "center" ? "46%" : "64%",
              top: "26%", // Align with shield top
              width: "22%", // Same width as shield container
              height: "22%", // Same height to center vertically
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "clamp(1.6rem, 5vw, 2.5rem)", // Larger font size for front
              color: textColor,
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              transform: "scaleY(1.15)",
            }}
          >
            {config.number}
          </div>
        )}
        <span className="mt-1 text-[10px] font-bold tracking-[0.15em] uppercase text-black/40">
          {labelFront}
        </span>
      </div>

      {/* Back */}
      <div className="relative flex flex-col items-center">
        {pair.backUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pair.backUrl} alt={labelBack} className="w-full h-auto" draggable={false} style={imgStyle} />
        ) : placeholder}
        {config.showNumber && config.number && (
          <div
            className="absolute inset-x-0 text-center leading-none pointer-events-none"
            style={{
              top: "51%", // Moved up slightly from 55%
              fontSize: "clamp(2rem, 12vw, 5.5rem)", // Made slightly larger again
              color: textColor,
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              transform: "scaleY(1.15)",
            }}
          >
            {config.number}
          </div>
        )}
        {config.teamName && (
          <div
            className="absolute inset-x-0 text-center font-black tracking-wider pointer-events-none"
            style={{
              top: "77%",
              fontSize: "clamp(0.5rem, 2.2vw, 1.2rem)",
              color: textColor,
              fontFamily: config.teamNameFont === "bebas" ? "'Bebas Neue', 'Arial Black', sans-serif" : 
                          config.teamNameFont === "roboto" ? "'Roboto Condensed', 'Arial', sans-serif" : 
                          config.teamNameFont === "impact" ? "'Impact', 'Arial Black', sans-serif" : 
                          config.teamNameFont === "montserrat" ? "'Montserrat', 'Arial Black', sans-serif" : 
                          config.teamNameFont === "oswald" ? "'Oswald', 'Arial Black', sans-serif" : 
                          config.teamNameFont === "teko" ? "'Teko', 'Arial Black', sans-serif" : 
                          config.teamNameFont === "anton" ? "'Anton', 'Arial Black', sans-serif" : 
                          "'Arial Black', sans-serif",
            }}
          >
            {config.teamName}
          </div>
        )}
        <span className="mt-1 text-[10px] font-bold tracking-[0.15em] uppercase text-black/40">
          {labelBack}
        </span>
      </div>
    </>
  );

  return (
    <div className={`select-none ${className ?? ""}`}>
      <div className="grid grid-cols-2 gap-x-5 gap-y-6">
        {renderRow(primary, config.color, "Frente", "Espalda", config.letterColor)}
        {renderRow(secondary, config.secondaryColor, "Frente (Dorso)", "Espalda (Dorso)", config.letterColorBack)}
      </div>
    </div>
  );
}
