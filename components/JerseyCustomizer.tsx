"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, Loader2, X } from "lucide-react";
import JerseyPreview from "./JerseyPreview";
import { isLight, recolorPixels } from "./JerseyPreview";
import { JerseyConfig } from "./types";
import { removeBackground } from "@imgly/background-removal";

export default function JerseyCustomizer() {
  const [config, setConfig] = useState<JerseyConfig>({
    color: "#111111",
    secondaryColor: "#f5f5f5",
    letterColor: "#f5f5f5",
    letterColorBack: "#111111",
    shieldUrl: null,
    showShield: true,
    shieldPosition: "right",
    number: "10",
    showNumber: true,
    showFrontNumber: false,
    frontNumberPosition: "left",
    teamName: "MI EQUIPO",
    teamNameFont: "arial-black",
  });

  const [shieldFileName, setShieldFileName] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleColorSelect = (hex: string) => {
    setConfig((prev) => ({ ...prev, color: hex }));
  };

  const handleSecondaryColorSelect = (hex: string) => {
    setConfig((prev) => ({ ...prev, secondaryColor: hex }));
  };

  const handleLetterColorSelect = (hex: string) => {
    setConfig((prev) => ({ ...prev, letterColor: hex }));
  };

  const handleShieldUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setRemoveBgError(null);
      setShieldFileName(file.name);

      if (file.type === "image/png") {
        console.log("[Shield Upload] PNG file detected, skipping background removal");
        setConfig((prev) => ({ ...prev, shieldUrl: URL.createObjectURL(file) }));
        return;
      }

      console.log("[Shield Upload] Starting background removal for:", file.name, "Size:", (file.size / 1024).toFixed(1), "KB");
      setIsRemovingBg(true);
      
      // Add timeout to detect hangs
      const timeoutId = setTimeout(() => {
        console.warn("[Shield Upload] Background removal is taking longer than expected (>30s). Model may still be downloading...");
      }, 30000);
      
      try {
        console.log("[Shield Upload] Calling removeBackground()...");
        const imageBlob = await removeBackground(file);
        clearTimeout(timeoutId);
        console.log("[Shield Upload] Background removal complete. Blob size:", (imageBlob.size / 1024).toFixed(1), "KB");
        const url = URL.createObjectURL(imageBlob);
        setConfig((prev) => ({ ...prev, shieldUrl: url }));
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const message = err instanceof Error ? err.message : "Error desconocido";
        console.error("[Shield Upload] Error:", message, err);
        setRemoveBgError(message);
        setConfig((prev) => ({ ...prev, shieldUrl: URL.createObjectURL(file) }));
      } finally {
        setIsRemovingBg(false);
      }
    },
    []
  );

  const handleRemoveShield = () => {
    setConfig((prev) => ({ ...prev, shieldUrl: null }));
    setShieldFileName(null);
    setRemoveBgError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = useCallback(async () => {
    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });

    try {
      const templateImg = await loadImg("/frente.jpg");

      // Stage full image and erase baked-in elements
      const staging = document.createElement("canvas");
      staging.width = templateImg.naturalWidth;
      staging.height = templateImg.naturalHeight;
      const sCtx = staging.getContext("2d")!;
      sCtx.drawImage(templateImg, 0, 0);
      sCtx.fillStyle = "#000000";
      sCtx.fillRect(135, 112, 80, 63);

      const halfW = Math.round(templateImg.naturalWidth / 2);
      const backSw = templateImg.naturalWidth - halfW;
      const outW = Math.max(halfW, backSw);
      const imgH = templateImg.naturalHeight;

      const fpUrl = recolorPixels(staging, 0, 0, halfW, imgH, config.color, outW, imgH, config.secondaryColor);
      const bpUrl = recolorPixels(staging, halfW, 0, backSw, imgH, config.color, outW, imgH, config.secondaryColor);
      const fsUrl = recolorPixels(staging, 0, 0, halfW, imgH, config.secondaryColor, outW, imgH, config.color);
      const bsUrl = recolorPixels(staging, halfW, 0, backSw, imgH, config.secondaryColor, outW, imgH, config.color);

      const fpImg = await loadImg(fpUrl);
      const bpImg = await loadImg(bpUrl);
      const fsImg = await loadImg(fsUrl);
      const bsImg = await loadImg(bsUrl);

      // Layout: 2x2 grid
      const CW = 250;
      const ratio = fpImg.naturalHeight / fpImg.naturalWidth;
      const CH = Math.round(CW * ratio);
      const GAP = 24, PAD = 30, LABEL_H = 20;
      const W = PAD * 2 + CW * 2 + GAP;
      const H = PAD * 2 + (CH + LABEL_H) * 2 + GAP;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      const cells = [
        { x: PAD, y: PAD },
        { x: PAD + CW + GAP, y: PAD },
        { x: PAD, y: PAD + CH + LABEL_H + GAP },
        { x: PAD + CW + GAP, y: PAD + CH + LABEL_H + GAP },
      ];

      ctx.drawImage(fpImg, cells[0].x, cells[0].y, CW, CH);
      ctx.drawImage(bpImg, cells[1].x, cells[1].y, CW, CH);
      ctx.drawImage(fsImg, cells[2].x, cells[2].y, CW, CH);
      ctx.drawImage(bsImg, cells[3].x, cells[3].y, CW, CH);

      // Shield on both fronts (only if enabled)
      if (config.shieldUrl && config.showShield) {
        try {
          const shield = await loadImg(config.shieldUrl);
          // Made shield slightly larger (was 0.18 -> 0.22)
          const sw2 = Math.round(CW * 0.22), sh2 = Math.round(CH * 0.22);
          // Fixed positions: left -> 28%, center -> 46%, right -> 64% 
          const shieldX = config.shieldPosition === "left" ? CW * 0.28 : config.shieldPosition === "center" ? CW * 0.46 : CW * 0.64;
          ctx.drawImage(shield, cells[0].x + shieldX, cells[0].y + CH * 0.26, sw2, sh2);
          ctx.drawImage(shield, cells[2].x + shieldX, cells[2].y + CH * 0.26, sw2, sh2);
        } catch { /* skip */ }
      }

      // Front Number on both fronts
      if (config.showFrontNumber && config.number) {
        const drawFrontNumber = (cell: { x: number; y: number }, tc: string) => {
          ctx.save();
          // Fixed positions for front number: left -> 39%, center -> 57%, right -> 75% (center points)
          // 57% center point gives 46% start X for a 22% width element (46 + 11 = 57)
          const cx = cell.x + (config.frontNumberPosition === "left" ? CW * 0.39 : config.frontNumberPosition === "center" ? CW * 0.57 : CW * 0.75);
          // Made font larger (was 0.12 -> 0.16) to match larger shield
          ctx.font = `900 ${Math.round(CH * 0.16)}px 'Impact', 'Arial Black', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = tc;
          // Scale slightly taller like the back number
          ctx.translate(cx, cell.y + CH * 0.37); // Center Y of the shield area (adjusted slightly for larger size)
          ctx.scale(1, 1.15);
          ctx.fillText(config.number, 0, 0);
          ctx.restore();
        };
        drawFrontNumber(cells[0], config.letterColor);
        drawFrontNumber(cells[2], config.letterColorBack);
      }

      // Number + team name on both backs (only number if enabled, moved lower)
      const drawText = (cell: { x: number; y: number }, tc: string) => {
        const cx = cell.x + CW / 2;
        const fontMap: Record<JerseyConfig["teamNameFont"], string> = {
          "arial-black": "'Arial Black', Arial, sans-serif",
          "impact": "'Impact', 'Arial Black', sans-serif",
          "bebas": "'Bebas Neue', 'Arial Black', sans-serif",
          "roboto": "'Roboto Condensed', 'Arial', sans-serif",
          "montserrat": "'Montserrat', 'Arial Black', sans-serif",
          "oswald": "'Oswald', 'Arial Black', sans-serif",
          "teko": "'Teko', 'Arial Black', sans-serif",
          "anton": "'Anton', 'Arial Black', sans-serif",
        };
        const teamFont = fontMap[config.teamNameFont] || fontMap["arial-black"];
        if (config.showNumber && config.number) {
          ctx.save();
          // Larger font (was 0.18 -> 0.22)
          ctx.font = `900 ${Math.round(CH * 0.22)}px 'Impact', 'Arial Black', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = tc;
          // Position
          ctx.translate(cx, cell.y + CH * 0.51);
          ctx.scale(1, 1.15);
          ctx.fillText(config.number, 0, 0);
          ctx.restore();
        }
        if (config.teamName) {
          ctx.font = `900 ${Math.round(CH * 0.05)}px ${teamFont}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = tc;
          ctx.fillText(config.teamName, cx, cell.y + CH * 0.77);
        }
      };
      drawText(cells[1], config.letterColor);
      drawText(cells[3], config.letterColorBack);

      // Labels
      ctx.font = "bold 11px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#999";
      ctx.fillText("FRENTE", cells[0].x + CW / 2, cells[0].y + CH + 4);
      ctx.fillText("ESPALDA", cells[1].x + CW / 2, cells[1].y + CH + 4);
      ctx.fillText("FRENTE (DORSO)", cells[2].x + CW / 2, cells[2].y + CH + 4);
      ctx.fillText("ESPALDA (DORSO)", cells[3].x + CW / 2, cells[3].y + CH + 4);

      const link = document.createElement("a");
      link.download = `big-sportswear-${config.teamName || "equipo"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Download error:", err);
    }
  }, [config]);

  const handleWhatsAppOrder = useCallback(async () => {
    setIsGeneratingImage(true);
    
    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });

    try {
      const templateImg = await loadImg("/frente.jpg");

      // Stage full image and erase baked-in elements
      const staging = document.createElement("canvas");
      staging.width = templateImg.naturalWidth;
      staging.height = templateImg.naturalHeight;
      const sCtx = staging.getContext("2d")!;
      sCtx.drawImage(templateImg, 0, 0);
      sCtx.fillStyle = "#000000";
      sCtx.fillRect(135, 112, 80, 63);

      const halfW = Math.round(templateImg.naturalWidth / 2);
      const backSw = templateImg.naturalWidth - halfW;
      const outW = Math.max(halfW, backSw);
      const imgH = templateImg.naturalHeight;

      const fpUrl = recolorPixels(staging, 0, 0, halfW, imgH, config.color, outW, imgH, config.secondaryColor);
      const bpUrl = recolorPixels(staging, halfW, 0, backSw, imgH, config.color, outW, imgH, config.secondaryColor);
      const fsUrl = recolorPixels(staging, 0, 0, halfW, imgH, config.secondaryColor, outW, imgH, config.color);
      const bsUrl = recolorPixels(staging, halfW, 0, backSw, imgH, config.secondaryColor, outW, imgH, config.color);

      const fpImg = await loadImg(fpUrl);
      const bpImg = await loadImg(bpUrl);
      const fsImg = await loadImg(fsUrl);
      const bsImg = await loadImg(bsUrl);

      // Layout: 2x2 grid
      const CW = 250;
      const ratio = fpImg.naturalHeight / fpImg.naturalWidth;
      const CH = Math.round(CW * ratio);
      const GAP = 24, PAD = 30, LABEL_H = 20;
      const W = PAD * 2 + CW * 2 + GAP;
      const H = PAD * 2 + (CH + LABEL_H) * 2 + GAP;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      const cells = [
        { x: PAD, y: PAD },
        { x: PAD + CW + GAP, y: PAD },
        { x: PAD, y: PAD + CH + LABEL_H + GAP },
        { x: PAD + CW + GAP, y: PAD + CH + LABEL_H + GAP },
      ];

      ctx.drawImage(fpImg, cells[0].x, cells[0].y, CW, CH);
      ctx.drawImage(bpImg, cells[1].x, cells[1].y, CW, CH);
      ctx.drawImage(fsImg, cells[2].x, cells[2].y, CW, CH);
      ctx.drawImage(bsImg, cells[3].x, cells[3].y, CW, CH);

      // Shield on both fronts (only if enabled)
      if (config.shieldUrl && config.showShield) {
        try {
          const shield = await loadImg(config.shieldUrl);
          const sw2 = Math.round(CW * 0.22), sh2 = Math.round(CH * 0.22);
          const shieldX = config.shieldPosition === "left" ? CW * 0.28 : config.shieldPosition === "center" ? CW * 0.46 : CW * 0.64;
          ctx.drawImage(shield, cells[0].x + shieldX, cells[0].y + CH * 0.26, sw2, sh2);
          ctx.drawImage(shield, cells[2].x + shieldX, cells[2].y + CH * 0.26, sw2, sh2);
        } catch { /* skip */ }
      }

      // Front Number on both fronts
      if (config.showFrontNumber && config.number) {
        const drawFrontNumber = (cell: { x: number; y: number }, tc: string) => {
          ctx.save();
          const cx = cell.x + (config.frontNumberPosition === "left" ? CW * 0.39 : config.frontNumberPosition === "center" ? CW * 0.57 : CW * 0.75);
          ctx.font = `900 ${Math.round(CH * 0.16)}px 'Impact', 'Arial Black', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = tc;
          ctx.translate(cx, cell.y + CH * 0.37);
          ctx.scale(1, 1.15);
          ctx.fillText(config.number, 0, 0);
          ctx.restore();
        };
        drawFrontNumber(cells[0], config.letterColor);
        drawFrontNumber(cells[2], config.letterColorBack);
      }

      // Number + team name on both backs (only number if enabled, moved lower)
      const drawText = (cell: { x: number; y: number }, tc: string) => {
        const cx = cell.x + CW / 2;
        const fontMap: Record<JerseyConfig["teamNameFont"], string> = {
          "arial-black": "'Arial Black', Arial, sans-serif",
          "impact": "'Impact', 'Arial Black', sans-serif",
          "bebas": "'Bebas Neue', 'Arial Black', sans-serif",
          "roboto": "'Roboto Condensed', 'Arial', sans-serif",
          "montserrat": "'Montserrat', 'Arial Black', sans-serif",
          "oswald": "'Oswald', 'Arial Black', sans-serif",
          "teko": "'Teko', 'Arial Black', sans-serif",
          "anton": "'Anton', 'Arial Black', sans-serif",
        };
        const teamFont = fontMap[config.teamNameFont] || fontMap["arial-black"];
        if (config.showNumber && config.number) {
          ctx.save();
          ctx.font = `900 ${Math.round(CH * 0.22)}px 'Impact', 'Arial Black', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = tc;
          ctx.translate(cx, cell.y + CH * 0.51);
          ctx.scale(1, 1.15);
          ctx.fillText(config.number, 0, 0);
          ctx.restore();
        }
        if (config.teamName) {
          ctx.font = `900 ${Math.round(CH * 0.05)}px ${teamFont}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = tc;
          ctx.fillText(config.teamName, cx, cell.y + CH * 0.77);
        }
      };
      drawText(cells[1], config.letterColor);
      drawText(cells[3], config.letterColorBack);

      // Labels
      ctx.font = "bold 11px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#999";
      ctx.fillText("FRENTE", cells[0].x + CW / 2, cells[0].y + CH + 4);
      ctx.fillText("ESPALDA", cells[1].x + CW / 2, cells[1].y + CH + 4);
      ctx.fillText("FRENTE (DORSO)", cells[2].x + CW / 2, cells[2].y + CH + 4);
      ctx.fillText("ESPALDA (DORSO)", cells[3].x + CW / 2, cells[3].y + CH + 4);

      // Descargar la imagen
      const fileName = `big-sportswear-${config.teamName || "equipo"}.png`;
      const canvasDataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvasDataUrl;
      link.click();

      // Abrir WhatsApp con el texto (la imagen ya se descargó para que el usuario la adjunte manualmente)
      const phone = "5491126237532";
      const message = `Hola! Quisiera pedir este modelo!%0A%0A*Detalles:*%0A- Equipo: ${config.teamName}%0A- Color Principal: ${config.color}%0A- Color Dorso: ${config.secondaryColor}%0A%0ATe adjunto la imagen que acabo de descargar con el diseño.`;
      const whatsappUrl = `https://wa.me/${phone}?text=${message}`;
      
      // Pequeño delay para asegurar que la descarga comience antes de redirigir
      setTimeout(() => {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }, 500);

    } catch (err) {
      console.error("WhatsApp Order error:", err);
      alert("Hubo un error al preparar el pedido. Por favor intenta de nuevo.");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [config]);

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Header */}
      <header className="border-b border-black/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <a
            href="https://www.bigsportswear.com.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col leading-none"
          >
            <span className="text-xl font-black tracking-widest uppercase">BIG</span>
            <span className="text-[10px] font-semibold tracking-[0.3em] uppercase text-black/50">
              Sportswear
            </span>
          </a>
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-black/35 hidden sm:block">
            Personalizador de Remeras
          </span>
        </div>
      </header>

      {/* Announcement bar */}
      <div className="bg-black text-white text-center py-2.5">
        <p className="text-[11px] font-semibold tracking-[0.25em] uppercase">
          Diseñá la remera de tu equipo — Previsualización en tiempo real
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-12 items-start">

          {/* Preview */}
          <div className="flex flex-col items-center gap-4 sm:gap-5 sticky top-0 sm:top-4 z-10 w-full bg-white pb-4 lg:pb-0 shadow-[0_4px_20px_rgba(0,0,0,0.05)] sm:shadow-none">
            <div
              ref={previewRef}
              className="w-full bg-[#f7f7f7] border border-black/8 flex items-center justify-center p-4 sm:p-8 min-h-[350px] sm:min-h-[500px]"
            >
              <JerseyPreview
                config={config}
                className="w-full max-w-[520px]"
              />
            </div>
            <Button
              onClick={handleDownload}
              className="hidden lg:flex w-full max-w-[400px] bg-black hover:bg-black/80 text-white font-bold tracking-widest uppercase rounded-none h-12 gap-2 text-xs"
            >
              <Download className="w-4 h-4" />
              Descargar previsualización
            </Button>
            <p className="hidden lg:block text-[11px] text-black/35 text-center max-w-sm leading-relaxed">
              Esta imagen es una previsualización. El diseño final puede variar
              levemente según el proceso de producción.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-6 sm:gap-7 w-full">

            {/* Step 1 — Color */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase">
                  01 — Color de la remera
                </h2>
                <span className="text-[11px] text-black/45 font-medium uppercase">
                  {config.color}
                </span>
              </div>
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative w-14 h-14 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="absolute -top-2 -left-2 w-20 h-20 sm:w-16 sm:h-16 cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] sm:text-[11px] text-black/50 sm:text-black/40 leading-relaxed">
                    Elegí cualquier color usando el selector continuo.
                  </p>
                </div>
              </div>
            </div>

            <Separator className="bg-black/8" />

            {/* Step 2 — Secondary Color (Dorso) */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase">
                  02 — Color del dorso
                </h2>
                <span className="text-[11px] text-black/45 font-medium uppercase">
                  {config.secondaryColor}
                </span>
              </div>
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative w-14 h-14 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => handleSecondaryColorSelect(e.target.value)}
                    className="absolute -top-2 -left-2 w-20 h-20 sm:w-16 sm:h-16 cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.secondaryColor }} />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] sm:text-[11px] text-black/50 sm:text-black/40 leading-relaxed">
                    Elegí el color contrastante para el dorso y recortes.
                  </p>
                </div>
              </div>
            </div>

            <Separator className="bg-black/8" />

            {/* Step 3 — Shield */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3">
                03 — Escudo del club
              </h2>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleShieldUpload}
                className="hidden"
                id="shield-upload"
              />
              {!config.shieldUrl ? (
                <label
                  htmlFor="shield-upload"
                  className="flex flex-col items-center justify-center gap-3 border border-dashed border-black/20 p-8 sm:p-8 cursor-pointer hover:border-black/50 hover:bg-black/[0.015] transition-all min-h-[140px]"
                >
                  {isRemovingBg ? (
                    <>
                      <Loader2 className="w-6 h-6 sm:w-5 sm:h-5 text-black/40 animate-spin" />
                      <div className="text-center">
                        <p className="text-sm sm:text-xs text-black/45 font-medium tracking-wide">
                          Procesando escudo...
                        </p>
                        <p className="text-[11px] sm:text-[10px] text-black/30 mt-1">
                          Descargando modelo de IA (~4MB, puede tardar 30-60s la primera vez)
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 sm:w-5 sm:h-5 text-black/25" />
                      <div className="text-center">
                        <p className="text-sm sm:text-xs font-semibold text-black/60 tracking-wide">
                          Subir escudo del club
                        </p>
                        <p className="text-[12px] sm:text-[11px] text-black/35 mt-1">
                          JPG o PNG · El fondo se elimina automáticamente
                        </p>
                      </div>
                    </>
                  )}
                </label>
              ) : (
                <div className="flex items-center gap-3 border border-black/10 p-4 sm:p-3 bg-black/[0.015]">
                  <div className="w-12 h-12 bg-white border border-black/8 flex items-center justify-center flex-shrink-0">
                    <img
                      src={config.shieldUrl}
                      alt="Escudo"
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-black/70">
                      {shieldFileName ?? "Escudo cargado"}
                    </p>
                    <p className="text-[11px] text-black/40 mt-0.5">✓ Fondo eliminado</p>
                  </div>
                  <button
                    onClick={handleRemoveShield}
                    className="text-black/25 hover:text-black transition-colors p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {removeBgError && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 mt-2">
                  ⚠ {removeBgError}. Se usó la imagen original.
                </p>
              )}

              {/* Shield Options - only visible when shield is loaded */}
              {config.shieldUrl && (
                <div className="mt-4 space-y-3">
                  {/* Show/Hide Shield */}
                  <div className="flex items-center justify-between bg-[#f7f7f7] border border-black/8 p-3">
                    <span className="text-[11px] font-semibold tracking-widest uppercase text-black/70">
                      Mostrar escudo
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showShield}
                        onChange={(e) => setConfig((prev) => ({ ...prev, showShield: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  {/* Shield Position */}
                  {config.showShield && (
                    <div className="bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                      <span className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/70 block mb-3 sm:mb-2">
                        Posición del escudo
                      </span>
                      <div className="flex gap-2">
                        {[
                          { value: "left", label: "Izquierda" },
                          { value: "center", label: "Centro" },
                          { value: "right", label: "Derecha" },
                        ].map((pos) => (
                          <button
                            key={pos.value}
                            onClick={() => setConfig((prev) => ({ ...prev, shieldPosition: pos.value as "left" | "center" | "right" }))}
                            className={`flex-1 py-3 sm:py-2 px-2 text-[12px] sm:text-[11px] font-medium uppercase tracking-wide border transition-colors ${
                              config.shieldPosition === pos.value
                                ? "bg-black text-white border-black"
                                : "bg-white text-black/60 border-black/20 hover:border-black/40"
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator className="bg-black/8" />

            {/* Step 4 — Number & Name */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-4">
                04 — Número y nombre
              </h2>
              <div className="flex flex-col gap-4">
                {/* Number with toggle */}
                <div className="flex flex-col gap-2 bg-[#f7f7f7] border border-black/8 p-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="number"
                      className="text-[11px] font-semibold tracking-widest uppercase text-black/70"
                    >
                      Número en la espalda
                    </Label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showNumber}
                        onChange={(e) => setConfig((prev) => ({ ...prev, showNumber: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>
                  {config.showNumber && (
                    <Input
                      id="number"
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="Ej: 10"
                      value={config.number}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          number: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      className="rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-black text-base sm:text-sm h-12 sm:h-10 bg-white"
                    />
                  )}
                </div>

                {/* Front Number options */}
                <div className="flex flex-col gap-2 bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                  <div className="flex items-center justify-between">
                    <Label
                      className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/70"
                    >
                      Número en el frente
                    </Label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showFrontNumber}
                        onChange={(e) => setConfig((prev) => ({ ...prev, showFrontNumber: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  {/* Front Number Position */}
                  {config.showFrontNumber && (
                    <div className="mt-2 pt-4 sm:pt-2 border-t border-black/10">
                      <span className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/60 block mb-3 sm:mb-2">
                        Posición del número (Frente)
                      </span>
                      <div className="flex gap-2">
                        {[
                          { value: "left", label: "Izquierda" },
                          { value: "center", label: "Centro" },
                          { value: "right", label: "Derecha" },
                        ].map((pos) => (
                          <button
                            key={pos.value}
                            onClick={() => setConfig((prev) => ({ ...prev, frontNumberPosition: pos.value as "left" | "center" | "right" }))}
                            className={`flex-1 py-3 sm:py-2 px-2 text-[12px] sm:text-[11px] font-medium uppercase tracking-wide border transition-colors ${
                              config.frontNumberPosition === pos.value
                                ? "bg-black text-white border-black"
                                : "bg-white text-black/60 border-black/20 hover:border-black/40"
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Team Name with Font Selector */}
                <div className="flex flex-col gap-2 bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                  <Label
                    htmlFor="teamName"
                    className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/70"
                  >
                    Nombre del equipo
                  </Label>
                  <Input
                    id="teamName"
                    type="text"
                    maxLength={20}
                    placeholder="Ej: LAS TRULITAS"
                    value={config.teamName}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, teamName: e.target.value }))
                    }
                    className="rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-black text-base sm:text-sm h-12 sm:h-10 bg-white"
                  />
                  <p className="text-[11px] text-black/30">
                    {config.teamName.length}/20 caracteres
                  </p>

                  {/* Font Selector Dropdown */}
                  <div className="mt-3 sm:mt-2 pt-4 sm:pt-3 border-t border-black/10">
                    <Label
                      htmlFor="teamNameFont"
                      className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/60 block mb-3 sm:mb-2"
                    >
                      Tipografía
                    </Label>
                    <div className="relative">
                      <select
                        id="teamNameFont"
                        value={config.teamNameFont}
                        onChange={(e) => setConfig((prev) => ({ ...prev, teamNameFont: e.target.value as JerseyConfig["teamNameFont"] }))}
                        className="w-full appearance-none rounded-none border border-black/20 bg-white px-4 sm:px-3 py-3 sm:py-2.5 text-base sm:text-sm outline-none focus-visible:border-black focus-visible:ring-0"
                        style={{
                          fontFamily: [
                            { value: "arial-black", style: "'Arial Black', Arial, sans-serif" },
                            { value: "impact", style: "'Impact', 'Arial Black', sans-serif" },
                            { value: "bebas", style: "'Bebas Neue', sans-serif" },
                            { value: "roboto", style: "'Roboto Condensed', sans-serif" },
                            { value: "montserrat", style: "'Montserrat', sans-serif" },
                            { value: "oswald", style: "'Oswald', sans-serif" },
                            { value: "teko", style: "'Teko', sans-serif" },
                            { value: "anton", style: "'Anton', sans-serif" },
                          ].find(f => f.value === config.teamNameFont)?.style
                        }}
                      >
                        <option value="arial-black" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>Arial Black</option>
                        <option value="impact" style={{ fontFamily: "'Impact', 'Arial Black', sans-serif" }}>Impact</option>
                        <option value="bebas" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Bebas Neue</option>
                        <option value="roboto" style={{ fontFamily: "'Roboto Condensed', sans-serif" }}>Roboto Condensed</option>
                        <option value="montserrat" style={{ fontFamily: "'Montserrat', sans-serif" }}>Montserrat</option>
                        <option value="oswald" style={{ fontFamily: "'Oswald', sans-serif" }}>Oswald</option>
                        <option value="teko" style={{ fontFamily: "'Teko', sans-serif" }}>Teko</option>
                        <option value="anton" style={{ fontFamily: "'Anton', sans-serif" }}>Anton</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-black/50">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-black/8" />

            {/* Step 5 — Letter Color */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase">
                  05 — Color de letras
                </h2>
              </div>
              
              <div className="flex flex-col gap-4">
                {/* Front Text Color */}
                <div className="flex items-center justify-between gap-4 bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/70">Frente</span>
                    <span className="text-[10px] text-black/40 uppercase">{config.letterColor}</span>
                  </div>
                  <div className="relative w-12 h-12 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                    <input
                      type="color"
                      value={config.letterColor}
                      onChange={(e) => setConfig((prev) => ({ ...prev, letterColor: e.target.value }))}
                      className="absolute -top-2 -left-2 w-16 h-16 sm:w-14 sm:h-14 cursor-pointer opacity-0"
                    />
                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.letterColor }} />
                  </div>
                </div>

                {/* Back Text Color */}
                <div className="flex items-center justify-between gap-4 bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/70">Espalda</span>
                    <span className="text-[10px] text-black/40 uppercase">{config.letterColorBack}</span>
                  </div>
                  <div className="relative w-12 h-12 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                    <input
                      type="color"
                      value={config.letterColorBack}
                      onChange={(e) => setConfig((prev) => ({ ...prev, letterColorBack: e.target.value }))}
                      className="absolute -top-2 -left-2 w-16 h-16 sm:w-14 sm:h-14 cursor-pointer opacity-0"
                    />
                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.letterColorBack }} />
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-black/8" />

            {/* CTAs */}
            <div className="flex flex-col gap-2.5">
              <Button
                onClick={handleDownload}
                className="w-full bg-black hover:bg-black/80 text-white font-bold tracking-widest uppercase rounded-none h-12 text-xs gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar previsualización
              </Button>
              <div className="flex flex-col gap-3 mt-4">
                <Button
                  onClick={handleWhatsAppOrder}
                  disabled={isGeneratingImage}
                  className="w-full border border-black text-black font-bold tracking-widest uppercase rounded-none h-12 text-xs flex items-center justify-center hover:bg-black hover:text-white transition-colors bg-white disabled:opacity-50"
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Preparando pedido...
                    </>
                  ) : (
                    "Hacer pedido →"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden z-50">
        <Button
          onClick={handleWhatsAppOrder}
          disabled={isGeneratingImage}
          className="w-full bg-black hover:bg-black/80 text-white font-bold tracking-widest uppercase rounded-none h-14 gap-2 text-xs disabled:opacity-50"
        >
          {isGeneratingImage ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Preparando pedido...
            </>
          ) : (
            <>
              Hacer pedido →
            </>
          )}
        </Button>
      </div>

      {/* Footer */}
      <footer className="border-t border-black/10 mt-8 sm:mt-16 pb-24 lg:pb-0">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-col leading-none">
            <span className="text-sm font-black tracking-widest uppercase">BIG</span>
            <span className="text-[9px] font-semibold tracking-[0.3em] uppercase text-black/40">
              Sportswear
            </span>
          </div>
          <p className="text-[11px] text-black/35">@bigindumentaria.ar</p>
        </div>
      </footer>
    </div>
  );
}
