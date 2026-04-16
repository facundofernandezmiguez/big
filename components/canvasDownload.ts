import { JerseyConfig, FontOption } from "./types";
import { TEMPLATE_CONFIGS, recolorPixels, getStaging } from "./JerseyPreview";

// ─── Font CSS variable → canvas font family resolution ───
const FONT_VAR_MAP: Record<FontOption, string> = {
  "bebas": "--font-bebas-neue",
  "franklin": "--font-libre-franklin",
  "baskerville": "--font-libre-baskerville",
  "open-sans": "--font-open-sans",
  "oswald": "--font-oswald",
};

const FONT_FALLBACK_MAP: Record<FontOption, string> = {
  "bebas": "'Arial Black', sans-serif",
  "franklin": "'Arial', sans-serif",
  "baskerville": "'Georgia', serif",
  "open-sans": "'Arial', sans-serif",
  "oswald": "'Arial Black', sans-serif",
};

function resolveFont(cssVar: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return val ? `${val}, ${fallback}` : fallback;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Renders the full jersey configuration to a PNG data URL using Canvas 2D.
 * This bypasses html-to-image entirely, fixing Safari/iOS where foreignObject
 * SVG serialization drops <img> elements with large data URLs.
 */
export async function renderConfigToDataUrl(config: JerseyConfig, pixelRatio = 3): Promise<string> {
  await document.fonts.ready;

  const tmpl = TEMPLATE_CONFIGS[config.sketchType];
  const { canvas: srcCanvas, imgH } = await getStaging(config.sketchType);

  // ─── Generate recolored jersey data URLs ───
  const pg2 = config.useGradient ? config.gradientColor : undefined;
  const sg2 = config.useGradientSecondary ? config.gradientSecondaryColor : undefined;

  const primaryFrontUrl = recolorPixels(srcCanvas, tmpl.frontCropSx, 0, tmpl.cropSw, imgH, config.color, tmpl.cropSw, imgH, config.secondaryColor, pg2, sg2, tmpl.bgSeeds, tmpl.dorsoSeeds);
  const primaryBackUrl = recolorPixels(srcCanvas, tmpl.backCropSx, 0, tmpl.cropSw, imgH, config.color, tmpl.cropSw, imgH, config.secondaryColor, pg2, sg2, tmpl.bgSeeds, tmpl.dorsoSeeds);
  const secondaryFrontUrl = recolorPixels(srcCanvas, tmpl.frontCropSx, 0, tmpl.cropSw, imgH, config.secondaryColor, tmpl.cropSw, imgH, config.color, sg2, pg2, tmpl.bgSeeds, tmpl.dorsoSeeds);
  const secondaryBackUrl = recolorPixels(srcCanvas, tmpl.backCropSx, 0, tmpl.cropSw, imgH, config.secondaryColor, tmpl.cropSw, imgH, config.color, sg2, pg2, tmpl.bgSeeds, tmpl.dorsoSeeds);

  // ─── Load all images in parallel ───
  const [pf, pb, sf, sb] = await Promise.all([
    loadImg(primaryFrontUrl),
    loadImg(primaryBackUrl),
    loadImg(secondaryFrontUrl),
    loadImg(secondaryBackUrl),
  ]);

  let shieldImg: HTMLImageElement | null = null;
  if (config.shieldUrl && config.showShield) {
    shieldImg = await loadImg(config.shieldUrl).catch(() => null);
  }

  const sponsorImgs = new Map<string, HTMLImageElement>();
  await Promise.all(
    config.sponsors.filter(s => s.imageUrl).map(async (s) => {
      try { sponsorImgs.set(s.id, await loadImg(s.imageUrl)); } catch { /* skip */ }
    })
  );

  // ─── Layout constants (CSS px, scaled by pixelRatio) ───
  const GRID_W = 520;
  const GAP_X = 20;  // gap-x-5
  const GAP_Y = 24;  // gap-y-6
  const COL_W = (GRID_W - GAP_X) / 2; // 250px
  const JERSEY_ASPECT = imgH / tmpl.cropSw;
  const JERSEY_H = COL_W * JERSEY_ASPECT;
  const LABEL_GAP = 4;
  const LABEL_SIZE = 10;
  const LABEL_ROW_H = LABEL_GAP + LABEL_SIZE + 4;
  const PAD = 20;

  const W = GRID_W + PAD * 2;
  const H = PAD + JERSEY_H + LABEL_ROW_H + GAP_Y + JERSEY_H + LABEL_ROW_H + PAD;

  const c = document.createElement("canvas");
  c.width = Math.round(W * pixelRatio);
  c.height = Math.round(H * pixelRatio);
  const ctx = c.getContext("2d")!;
  ctx.scale(pixelRatio, pixelRatio);

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ─── Panel positions ───
  const row1Y = PAD;
  const row2Y = PAD + JERSEY_H + LABEL_ROW_H + GAP_Y;

  const panels = [
    { img: pf, x: PAD, y: row1Y, label: "LADO 1 - FRENTE", row: "primary", target: "front", textColor: config.letterColor },
    { img: pb, x: PAD + COL_W + GAP_X, y: row1Y, label: "LADO 1 - ESPALDA", row: "primary", target: "back", textColor: config.letterColor },
    { img: sf, x: PAD, y: row2Y, label: "LADO 2 - FRENTE", row: "secondary", target: "front", textColor: config.letterColorBack },
    { img: sb, x: PAD + COL_W + GAP_X, y: row2Y, label: "LADO 2 - ESPALDA", row: "secondary", target: "back", textColor: config.letterColorBack },
  ] as const;

  // ─── Draw jerseys with drop shadow ───
  for (const p of panels) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.drawImage(p.img, p.x, p.y, COL_W, JERSEY_H);
    ctx.restore();
  }

  // ─── Resolve fonts from CSS variables (next/font generates unique names) ───
  const fonts: Record<FontOption, string> = {} as Record<FontOption, string>;
  for (const key of Object.keys(FONT_VAR_MAP) as FontOption[]) {
    fonts[key] = resolveFont(FONT_VAR_MAP[key], FONT_FALLBACK_MAP[key]);
  }
  const numberFont = resolveFont("--font-anton", "'Impact', 'Arial Black', sans-serif");

  // ─── Font sizes (matching JerseyPreview at 520px grid width) ───
  const TEXT_BASE = Math.min(19.2, Math.max(8, GRID_W * 0.037));
  const NUM_SIZE = Math.min(88, Math.max(32, GRID_W * 0.169));

  for (const p of panels) {
    // ── Text elements ──
    const texts = config.textElements.filter(el =>
      el.target === p.target &&
      (el.placement === "ambos" ||
        (el.placement === "lado1" && p.row === "primary") ||
        (el.placement === "lado2" && p.row === "secondary"))
    );

    for (const el of texts) {
      const fs = TEXT_BASE * el.size;
      ctx.save();
      ctx.font = `${el.bold ? 900 : 400} ${fs}px ${fonts[el.font]}`;
      ctx.fillStyle = p.textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(el.text, p.x + (el.x / 100) * COL_W, p.y + (el.y / 100) * JERSEY_H);
      ctx.restore();
    }

    // ── Number (back panels only) ──
    if (p.target === "back" && config.showNumber && config.number) {
      ctx.save();
      ctx.font = `400 ${NUM_SIZE}px ${numberFont}`;
      ctx.fillStyle = p.textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const nx = p.x + COL_W / 2;
      const ny = p.y + JERSEY_H * 0.51;
      ctx.translate(nx, ny);
      ctx.scale(1, 1.15); // match CSS scaleY(1.15)
      ctx.fillText(config.number, 0, 0);
      ctx.restore();
    }

    // ── Shield (primary-front only) ──
    if (p.row === "primary" && p.target === "front" && shieldImg) {
      const leftPct = config.shieldPosition === "left" ? 0.22 : config.shieldPosition === "center" ? 0.40 : 0.58;
      const boxX = p.x + COL_W * leftPct;
      const boxY = p.y + JERSEY_H * 0.26;
      const boxW = COL_W * 0.22;
      const boxH = JERSEY_H * 0.22;
      const cx = boxX + boxW / 2;
      const cy = boxY + boxH / 2;
      const sw = boxW * config.shieldSize;
      const sh = boxH * config.shieldSize;
      // object-contain: fit image preserving aspect ratio
      const iAspect = shieldImg.naturalWidth / shieldImg.naturalHeight;
      const bAspect = sw / sh;
      let dw: number, dh: number;
      if (iAspect > bAspect) { dw = sw; dh = sw / iAspect; }
      else { dh = sh; dw = sh * iAspect; }
      ctx.drawImage(shieldImg, cx - dw / 2, cy - dh / 2, dw, dh);
    }

    // ── Sponsors ──
    for (const sp of config.sponsors.filter(s => s.target === p.target && s.imageUrl)) {
      const spImg = sponsorImgs.get(sp.id);
      if (!spImg) continue;
      const spW = COL_W * 0.15 * sp.size;
      const spH = spW * (spImg.naturalHeight / spImg.naturalWidth);
      ctx.drawImage(
        spImg,
        p.x + (sp.x / 100) * COL_W - spW / 2,
        p.y + (sp.y / 100) * JERSEY_H - spH / 2,
        spW, spH
      );
    }

    // ── Label ──
    ctx.save();
    ctx.font = `700 ${LABEL_SIZE}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(p.label, p.x + COL_W / 2, p.y + JERSEY_H + LABEL_GAP);
    ctx.restore();
  }

  return c.toDataURL("image/png");
}
