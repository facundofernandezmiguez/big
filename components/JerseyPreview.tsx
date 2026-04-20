"use client";

import { useEffect, useState, useRef, useCallback, forwardRef } from "react";
import { JerseyConfig, TextElement, SponsorElement, FontOption, SketchType } from "./types";

interface JerseyPreviewProps {
  config: JerseyConfig;
  className?: string;
  onTextMove?: (id: string, x: number, y: number, target?: "front" | "back", row?: "primary" | "secondary") => void;
  onSponsorMove?: (id: string, x: number, y: number, target?: "front" | "back") => void;
  selectedObjectId?: string | null;
  selectedObjectType?: "text" | "sponsor" | "shield" | null;
  onObjectSelect?: (id: string, type: "text" | "sponsor" | "shield") => void;
}

const FONT_FAMILY_MAP: Record<FontOption, string> = {
  "bebas": "var(--font-bebas-neue), 'Arial Black', sans-serif",
  "franklin": "var(--font-libre-franklin), 'Arial', sans-serif",
  "baskerville": "var(--font-libre-baskerville), 'Georgia', serif",
  "open-sans": "var(--font-open-sans), 'Arial', sans-serif",
  "oswald": "var(--font-oswald), 'Arial Black', sans-serif",
};

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

// ─── Template configuration ───
export interface TemplateConfig {
  imagePath: string;
  cropTopRatio: number;
  frontCropSx: number;
  backCropSx: number;
  cropSw: number;
  bodySeeds: Array<[number, number]>;
  bgSeeds: Array<[number, number]>;
  dorsoSeeds: Array<[number, number]>;
}

export const TEMPLATE_CONFIGS: Record<SketchType, TemplateConfig> = {
  "clasica": {
    imagePath: "/boceto.png",
    cropTopRatio: 0.46,
    frontCropSx: 592,
    backCropSx: 974,
    cropSw: 420,
    bodySeeds: [
      [801, 387],
      [1182, 404],
    ],
    bgSeeds: [
      [737, 124],
      [860, 121],
      [1122, 135],
      [1242, 133],
    ],
    dorsoSeeds: [
      [797, 104],
      [1091, 199],
      [1274, 200],
    ],
  },
  "recorte-lateral": {
    imagePath: "/recortelateral.jpg.jpeg",
    cropTopRatio: 0.50,
    frontCropSx: 270,
    backCropSx: 809,
    cropSw: 500,
    bodySeeds: [
      [520, 567],
      [1057, 589],
    ],
    bgSeeds: [
      [429, 213],
      [605, 210],
      [970, 226],
      [1140, 224],
    ],
    dorsoSeeds: [
      [515, 187],
      [339, 701],
      [699, 707],
      [877, 714],
      [1237, 719],
      [925, 318],
      [1185, 319],
    ],
  },
};

// ─── Legacy exports for backward compatibility ───
export const FRONT_CROP_SX = TEMPLATE_CONFIGS["clasica"].frontCropSx;
export const BACK_CROP_SX = TEMPLATE_CONFIGS["clasica"].backCropSx;
export const CROP_SW = TEMPLATE_CONFIGS["clasica"].cropSw;

// ─── Staging: per-template cache ───
interface StagingEntry {
  canvas: HTMLCanvasElement;
  imgW: number;
  imgH: number;
}
const _stagingCache: Record<string, StagingEntry> = {};
const _stagingPromises: Record<string, Promise<StagingEntry>> = {};

export function resetStaging(sketchType?: SketchType) {
  if (sketchType) {
    delete _stagingCache[sketchType];
    delete _stagingPromises[sketchType];
  } else {
    for (const k of Object.keys(_stagingCache)) delete _stagingCache[k];
    for (const k of Object.keys(_stagingPromises)) delete _stagingPromises[k];
  }
}

// ─── Body fill: floods tank body interiors with black so the recolor algorithm works ───
export function fillBodyInteriors(ctx: CanvasRenderingContext2D, w: number, h: number, bodySeeds?: Array<[number, number]>) {
  const seeds = bodySeeds ?? TEMPLATE_CONFIGS["clasica"].bodySeeds;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const total = w * h;
  const bri = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    bri[i] = (d[p] + d[p + 1] + d[p + 2]) / 3;
  }

  for (const [sx, sy] of seeds) {
    if (sx >= w || sy >= h) continue;
    const startIdx = sy * w + sx;
    if (bri[startIdx] < 200) continue;

    const visited = new Uint8Array(total);
    const queue = [startIdx];
    visited[startIdx] = 1;
    let qh = 0;

    while (qh < queue.length) {
      const idx = queue[qh++];
      const p = idx * 4;
      d[p] = 0; d[p + 1] = 0; d[p + 2] = 0; d[p + 3] = 255;
      bri[idx] = 0;

      const x = idx % w;
      const y = (idx - x) / w;
      const nb = [
        y > 0 ? idx - w : -1,
        y < h - 1 ? idx + w : -1,
        x > 0 ? idx - 1 : -1,
        x < w - 1 ? idx + 1 : -1,
      ];
      for (const n of nb) {
        if (n >= 0 && !visited[n] && bri[n] >= 200) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export function getStaging(sketchType: SketchType = "clasica"): Promise<StagingEntry> {
  if (_stagingCache[sketchType]) return Promise.resolve(_stagingCache[sketchType]);
  if (sketchType in _stagingPromises) return _stagingPromises[sketchType];
  const tmpl = TEMPLATE_CONFIGS[sketchType];
  _stagingPromises[sketchType] = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cropH = Math.round(img.naturalHeight * tmpl.cropTopRatio);
      const imgW = img.naturalWidth;
      const imgH = cropH;
      const c = document.createElement("canvas");
      c.width = imgW;
      c.height = imgH;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, imgW, cropH, 0, 0, imgW, cropH);

      fillBodyInteriors(ctx, imgW, imgH, tmpl.bodySeeds);

      const entry: StagingEntry = { canvas: c, imgW, imgH };
      _stagingCache[sketchType] = entry;
      resolve(entry);
    };
    img.onerror = reject;
    img.src = tmpl.imagePath;
  });
  return _stagingPromises[sketchType];
}

// ─── Canvas recoloring ───
export function recolorPixels(
  source: HTMLCanvasElement,
  sx: number, sy: number, sw: number, sh: number,
  color: string,
  outW: number, outH: number,
  dorsoColor?: string,
  gradientColor2?: string,
  dorsoGradientColor2?: string,
  bgSeedsParam?: Array<[number, number]>,
  dorsoSeedsParam?: Array<[number, number]>
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
  const hasGradient = !!gradientColor2;
  const gc = hasGradient ? hexToRgb(gradientColor2) : { r: 0, g: 0, b: 0 };

  if (dorsoColor) {
    const { r: dr, g: dg, b: db } = hexToRgb(dorsoColor);
    const hasDorsoGradient = !!dorsoGradientColor2;
    const dgc = hasDorsoGradient ? hexToRgb(dorsoGradientColor2) : { r: 0, g: 0, b: 0 };
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
    
    const BG_SEEDS_FULL = bgSeedsParam ?? TEMPLATE_CONFIGS["clasica"].bgSeeds;
    const DORSO_SEEDS_FULL = dorsoSeedsParam ?? TEMPLATE_CONFIGS["clasica"].dorsoSeeds;

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
      const py = Math.floor(i / outW);
      const gt = outH > 1 ? py / (outH - 1) : 0;

      // Interpolated body color (gradient or solid)
      const br2 = hasGradient ? Math.round(r * (1 - gt) + gc.r * gt) : r;
      const bg2 = hasGradient ? Math.round(g * (1 - gt) + gc.g * gt) : g;
      const bb2 = hasGradient ? Math.round(b * (1 - gt) + gc.b * gt) : b;

      // Interpolated dorso color (gradient or solid)
      const ddr = hasDorsoGradient ? Math.round(dr * (1 - gt) + dgc.r * gt) : dr;
      const ddg = hasDorsoGradient ? Math.round(dg * (1 - gt) + dgc.g * gt) : dg;
      const ddb = hasDorsoGradient ? Math.round(db * (1 - gt) + dgc.b * gt) : db;

      if (a < 200) {
        // Shirt body
        d[p] = br2; d[p + 1] = bg2; d[p + 2] = bb2; d[p + 3] = 255;
      } else if (isBg[i]) {
        // Background → transparent / semi-transparent edge
        d[p] = br2; d[p + 1] = bg2; d[p + 2] = bb2;
        d[p + 3] = a < 240 ? Math.round(((240 - a) / 40) * 255) : 0;
      } else {
        // Dorso (enclosed area)
        if (a >= 240) {
          d[p] = ddr; d[p + 1] = ddg; d[p + 2] = ddb; d[p + 3] = 255;
        } else {
          // Anti-aliased edge between body and dorso — blend
          const t = (a - 200) / 40;
          d[p] = Math.round(br2 * (1 - t) + ddr * t);
          d[p + 1] = Math.round(bg2 * (1 - t) + ddg * t);
          d[p + 2] = Math.round(bb2 * (1 - t) + ddb * t);
          d[p + 3] = 255;
        }
      }
    }
  } else {
    // Original behavior without dorso
    const total2 = outW * outH;
    for (let i = 0; i < total2; i++) {
      const p = i * 4;
      const avg = (d[p] + d[p + 1] + d[p + 2]) / 3;
      const py = Math.floor(i / outW);
      const gt = outH > 1 ? py / (outH - 1) : 0;
      const cr = hasGradient ? Math.round(r * (1 - gt) + gc.r * gt) : r;
      const cg = hasGradient ? Math.round(g * (1 - gt) + gc.g * gt) : g;
      const cb = hasGradient ? Math.round(b * (1 - gt) + gc.b * gt) : b;
      d[p] = cr; d[p + 1] = cg; d[p + 2] = cb;
      if (avg < 200) d[p + 3] = 255;
      else if (avg < 240) d[p + 3] = Math.round(((240 - avg) / 40) * 255);
      else d[p + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return out.toDataURL("image/png");
}

// ─── Hook: generates front + back data URLs for a given color ───
function useRecoloredPair(sketchType: SketchType, color: string, dorsoColor: string, gradientColor2?: string, dorsoGradientColor2?: string) {
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    const tmpl = TEMPLATE_CONFIGS[sketchType];
    getStaging(sketchType).then(({ canvas, imgH }) => {
      if (cancelled) return;
      setFrontUrl(recolorPixels(canvas, tmpl.frontCropSx, 0, tmpl.cropSw, imgH, color, tmpl.cropSw, imgH, dorsoColor, gradientColor2, dorsoGradientColor2, tmpl.bgSeeds, tmpl.dorsoSeeds));
      setBackUrl(recolorPixels(canvas, tmpl.backCropSx, 0, tmpl.cropSw, imgH, color, tmpl.cropSw, imgH, dorsoColor, gradientColor2, dorsoGradientColor2, tmpl.bgSeeds, tmpl.dorsoSeeds));
    });
    return () => { cancelled = true; };
  }, [sketchType, color, dorsoColor, gradientColor2, dorsoGradientColor2]);

  return { frontUrl, backUrl };
}

// ─── Component ───
const JerseyPreview = forwardRef<HTMLDivElement, JerseyPreviewProps>(function JerseyPreview({ config, className, onTextMove, onSponsorMove, selectedObjectId, selectedObjectType, onObjectSelect }, ref) {
  const internalGridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(520);

  // Merge forwarded ref with internal ref
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    internalGridRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [ref]);

  // Track grid width for container-relative font sizing
  useEffect(() => {
    const el = internalGridRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setGridWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute font sizes relative to grid width (not viewport)
  // At 520px grid (desktop): textBase = min(19.2, max(8, 520*0.037)) = 19.2px
  // At 350px grid (mobile):  textBase = min(19.2, max(8, 350*0.037)) = 12.95px
  const textBaseFontSize = Math.min(19.2, Math.max(8, gridWidth * 0.037));
  // At 520px grid: numberFont = min(72, max(28, 520*0.14)) = 72px
  // At 350px grid: numberFont = min(72, max(28, 350*0.14)) = 49px
  const numberFontSize = Math.min(72, Math.max(28, gridWidth * 0.14));

  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; containerRect: DOMRect; origTarget: "front" | "back"; origRow?: "primary" | "secondary"; moveCb: (id: string, x: number, y: number, target?: "front" | "back", row?: "primary" | "secondary") => void } | null>(null);
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, item: { id: string; x: number; y: number; target: "front" | "back"; row?: "primary" | "secondary" }, containerKey: string, moveCb: (id: string, x: number, y: number, target?: "front" | "back", row?: "primary" | "secondary") => void) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRefs.current[containerKey];
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { id: item.id, startX: clientX, startY: clientY, origX: item.x, origY: item.y, containerRect: rect, origTarget: item.target, origRow: item.row, moveCb };

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      if ('touches' in ev) ev.preventDefault();
      const cx = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = cx - dragRef.current.startX;
      const dy = cy - dragRef.current.startY;
      const newX = dragRef.current.origX + (dx / dragRef.current.containerRect.width) * 100;
      const newY = dragRef.current.origY + (dy / dragRef.current.containerRect.height) * 100;
      dragRef.current.moveCb(dragRef.current.id, newX, newY);
    };

    const handleEnd = (ev: MouseEvent | TouchEvent) => {
      if (dragRef.current) {
        const cx = 'touches' in ev && ev.changedTouches?.length ? ev.changedTouches[0].clientX : (ev as MouseEvent).clientX;
        const cy = 'touches' in ev && ev.changedTouches?.length ? ev.changedTouches[0].clientY : (ev as MouseEvent).clientY;
        const origTarget = dragRef.current.origTarget;
        const origRow = dragRef.current.origRow;

        // Check all containers to find which one the pointer landed on
        let switched = false;
        for (const [key, ref] of Object.entries(containerRefs.current)) {
          if (!ref) continue;
          const r = ref.getBoundingClientRect();
          if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
            // Parse key: format is "row-target" e.g. "primary-front", "secondary-back"
            const parts = key.split('-');
            const dropRow = parts[0] as "primary" | "secondary";
            const dropTarget = parts[1] as "front" | "back";
            if (dropRow !== origRow || dropTarget !== origTarget) {
              const newX = Math.max(0, Math.min(100, ((cx - r.left) / r.width) * 100));
              const newY = Math.max(0, Math.min(100, ((cy - r.top) / r.height) * 100));
              const rowArg = dropRow !== origRow ? dropRow : undefined;
              const targetArg = dropTarget !== origTarget ? dropTarget : undefined;
              dragRef.current.moveCb(dragRef.current.id, newX, newY, targetArg, rowArg);
              switched = true;
            }
            break;
          }
        }

        if (!switched) {
          const dx = cx - dragRef.current.startX;
          const dy = cy - dragRef.current.startY;
          const newX = Math.max(0, Math.min(100, dragRef.current.origX + (dx / dragRef.current.containerRect.width) * 100));
          const newY = Math.max(0, Math.min(100, dragRef.current.origY + (dy / dragRef.current.containerRect.height) * 100));
          dragRef.current.moveCb(dragRef.current.id, newX, newY);
        }
      }
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  }, []);

  const renderTextElements = (target: "front" | "back", row: "primary" | "secondary", containerKey: string, textColor: string) => {
    return config.textElements
      .filter((el) => el.target === target && (el.placement === "ambos" || (el.placement === "lado1" && row === "primary") || (el.placement === "lado2" && row === "secondary")))
      .map((el) => {
        const isSelected = selectedObjectId === el.id && selectedObjectType === "text";
        return (
          <div
            key={el.id}
            className={`absolute text-center tracking-wider cursor-grab active:cursor-grabbing select-none ${el.bold ? "font-black" : "font-normal"}`}
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              transform: "translate(-50%, -50%)",
              fontSize: `${textBaseFontSize * el.size}px`,
              color: textColor,
              fontFamily: FONT_FAMILY_MAP[el.font],
              whiteSpace: "nowrap",
              zIndex: 10,
              outline: isSelected ? "2px dashed rgba(59,130,246,0.8)" : "none",
              outlineOffset: "4px",
              borderRadius: "2px",
              touchAction: "none",
            }}
            onMouseDown={(e) => onTextMove && handleDragStart(e, el, containerKey, onTextMove)}
            onTouchStart={(e) => {
              if (onObjectSelect) { e.stopPropagation(); onObjectSelect(el.id, "text"); }
              if (onTextMove) handleDragStart(e, el, containerKey, onTextMove);
            }}
            onClick={(e) => { e.stopPropagation(); if (onObjectSelect) onObjectSelect(el.id, "text"); }}
          >
            {el.text}
          </div>
        );
      });
  };

  const renderSponsorElements = (target: "front" | "back", row: "primary" | "secondary", containerKey: string) => {
    return config.sponsors
      .filter((sp) => sp.target === target && sp.imageUrl && (sp.placement === "ambos" || (sp.placement === "lado1" && row === "primary") || (sp.placement === "lado2" && row === "secondary")))
      .map((sp) => {
        const isSelected = selectedObjectId === sp.id && selectedObjectType === "sponsor";
        return (
          <div
            key={sp.id}
            className="absolute cursor-grab active:cursor-grabbing select-none"
            style={{
              left: `${sp.x}%`,
              top: `${sp.y}%`,
              transform: "translate(-50%, -50%)",
              width: `${15 * sp.size}%`,
              zIndex: 10,
              outline: isSelected ? "2px dashed rgba(59,130,246,0.8)" : "none",
              outlineOffset: "4px",
              borderRadius: "2px",
              touchAction: "none",
            }}
            onMouseDown={(e) => onSponsorMove && handleDragStart(e, sp, containerKey, onSponsorMove)}
            onTouchStart={(e) => {
              if (onObjectSelect) { e.stopPropagation(); onObjectSelect(sp.id, "sponsor"); }
              if (onSponsorMove) handleDragStart(e, sp, containerKey, onSponsorMove);
            }}
            onClick={(e) => { e.stopPropagation(); if (onObjectSelect) onObjectSelect(sp.id, "sponsor"); }}
          >
            <img src={sp.imageUrl} alt="Sponsor" className="w-full h-auto object-contain pointer-events-none" draggable={false} />
          </div>
        );
      });
  };

  const primaryGrad2 = config.useGradient ? config.gradientColor : undefined;
  const secondaryGrad2 = config.useGradientSecondary ? config.gradientSecondaryColor : undefined;
  const primary = useRecoloredPair(config.sketchType, config.color, config.secondaryColor, primaryGrad2, secondaryGrad2);
  const secondary = useRecoloredPair(config.sketchType, config.secondaryColor, config.color, secondaryGrad2, primaryGrad2);

  const placeholder = (
    <div className="w-full aspect-[3/4] bg-gray-100 animate-pulse rounded" />
  );

  const imgStyle = { filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.15))" };

  const renderRow = (
    pair: { frontUrl: string; backUrl: string },
    row: "primary" | "secondary",
    labelFront: string,
    labelBack: string,
    textColor: string
  ) => (
    <>
      {/* Front */}
      <div className="relative flex flex-col items-center overflow-visible" ref={(node) => { containerRefs.current[`${row}-front`] = node; }}>
        {pair.frontUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pair.frontUrl} alt={labelFront} className="w-full h-auto" draggable={false} style={imgStyle} />
        ) : placeholder}
        {config.shields
          .filter((sh) => sh.imageUrl && sh.showShield && (sh.placement === "ambos" || (sh.placement === "lado1" && row === "primary") || (sh.placement === "lado2" && row === "secondary")))
          .map((sh) => {
            const isSelected = selectedObjectId === sh.id && selectedObjectType === "shield";
            return (
              <div
                key={sh.id}
                className="absolute cursor-pointer"
                style={{
                  left: sh.shieldPosition === "left" ? "22%" : sh.shieldPosition === "center" ? "40%" : "58%",
                  top: "26%",
                  width: "22%",
                  height: "22%",
                  transform: `scale(${sh.shieldSize})`,
                  transformOrigin: "center",
                  zIndex: 10,
                  outline: isSelected ? "2px dashed rgba(59,130,246,0.8)" : "none",
                  outlineOffset: "4px",
                  borderRadius: "2px",
                }}
                onClick={(e) => { e.stopPropagation(); if (onObjectSelect) onObjectSelect(sh.id, "shield"); }}
                onTouchStart={(e) => { e.stopPropagation(); if (onObjectSelect) onObjectSelect(sh.id, "shield"); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sh.imageUrl}
                  alt="Escudo"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              </div>
            );
          })}
        {renderTextElements("front", row, `${row}-front`, textColor)}
        {renderSponsorElements("front", row, `${row}-front`)}
        <span className="mt-1 text-[10px] font-bold tracking-[0.15em] uppercase text-black/40">
          {labelFront}
        </span>
      </div>

      {/* Back */}
      <div className="relative flex flex-col items-center overflow-visible" ref={(node) => { containerRefs.current[`${row}-back`] = node; }}>
        {pair.backUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pair.backUrl} alt={labelBack} className="w-full h-auto" draggable={false} style={imgStyle} />
        ) : placeholder}
        {config.showNumber && config.number && (
          <div
            className="absolute inset-x-0 text-center leading-none pointer-events-none"
            style={{
              top: "51%",
              fontSize: `${numberFontSize}px`,
              color: textColor,
              fontFamily: "var(--font-anton), 'Impact', 'Arial Black', sans-serif",
              transform: "scaleY(1.15)",
            }}
          >
            {config.number}
          </div>
        )}
        {renderTextElements("back", row, `${row}-back`, textColor)}
        {renderSponsorElements("back", row, `${row}-back`)}
        <span className="mt-1 text-[10px] font-bold tracking-[0.15em] uppercase text-black/40">
          {labelBack}
        </span>
      </div>
    </>
  );

  return (
    <div className={`select-none ${className ?? ""}`}>
      <div ref={mergedRef} className="grid grid-cols-2 gap-x-5 gap-y-6 overflow-visible">
        {renderRow(primary, "primary", "Lado 1 - Frente", "Lado 1 - Espalda", config.letterColor)}
        {renderRow(secondary, "secondary", "Lado 2 - Frente", "Lado 2 - Espalda", config.letterColorBack)}
      </div>
    </div>
  );
});

export default JerseyPreview;
