"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, Loader2, X, Check } from "lucide-react";
import JerseyPreview from "./JerseyPreview";
import { isLight, recolorPixels } from "./JerseyPreview";
import { JerseyConfig } from "./types";

export default function JerseyCustomizer() {
  const [config, setConfig] = useState<JerseyConfig>({
    color: "#111111",
    secondaryColor: "#f5f5f5",
    letterColor: "#f5f5f5",
    letterColorBack: "#111111",
    shieldUrl: null,
    number: "10",
    teamName: "MI EQUIPO",
  });

  const [shieldFileName, setShieldFileName] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
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
        setConfig((prev) => ({ ...prev, shieldUrl: URL.createObjectURL(file) }));
        return;
      }

      setIsRemovingBg(true);
      try {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch("/api/remove-bg", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al quitar el fondo");
        }
        const data = await res.json();
        setConfig((prev) => ({ ...prev, shieldUrl: data.image }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
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

      // Shield on both fronts
      if (config.shieldUrl) {
        try {
          const shield = await loadImg(config.shieldUrl);
          const sw2 = Math.round(CW * 0.18), sh2 = Math.round(CH * 0.18);
          ctx.drawImage(shield, cells[0].x + CW * 0.60, cells[0].y + CH * 0.26, sw2, sh2);
          ctx.drawImage(shield, cells[2].x + CW * 0.60, cells[2].y + CH * 0.26, sw2, sh2);
        } catch { /* skip */ }
      }

      // Number + team name on both backs
      const drawText = (cell: { x: number; y: number }, tc: string) => {
        const cx = cell.x + CW / 2;
        if (config.number) {
          ctx.save();
          ctx.font = `900 ${Math.round(CH * 0.16)}px 'Impact', 'Arial Black', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = tc;
          ctx.translate(cx, cell.y + CH * 0.40);
          ctx.scale(1, 1.15);
          ctx.fillText(config.number, 0, 0);
          ctx.restore();
        }
        if (config.teamName) {
          ctx.font = `900 ${Math.round(CH * 0.05)}px 'Arial Black', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = tc;
          ctx.fillText(config.teamName.toUpperCase(), cx, cell.y + CH * 0.62);
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

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 items-start">

          {/* Preview */}
          <div className="flex flex-col items-center gap-5">
            <div
              ref={previewRef}
              className="w-full bg-[#f7f7f7] border border-black/8 flex items-center justify-center p-8 min-h-[500px]"
            >
              <JerseyPreview
                config={config}
                className="w-full max-w-[520px]"
              />
            </div>
            <Button
              onClick={handleDownload}
              className="w-full max-w-[400px] bg-black hover:bg-black/80 text-white font-bold tracking-widest uppercase rounded-none h-12 gap-2 text-xs"
            >
              <Download className="w-4 h-4" />
              Descargar previsualización
            </Button>
            <p className="text-[11px] text-black/35 text-center max-w-sm leading-relaxed">
              Esta imagen es una previsualización. El diseño final puede variar
              levemente según el proceso de producción.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-7">

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
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                  <input
                    type="color"
                    value={config.color}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-black/40 leading-relaxed">
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
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                  <input
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => handleSecondaryColorSelect(e.target.value)}
                    className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.secondaryColor }} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-black/40 leading-relaxed">
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
                  className="flex flex-col items-center justify-center gap-3 border border-dashed border-black/20 p-8 cursor-pointer hover:border-black/50 hover:bg-black/[0.015] transition-all"
                >
                  {isRemovingBg ? (
                    <>
                      <Loader2 className="w-5 h-5 text-black/40 animate-spin" />
                      <p className="text-xs text-black/45 font-medium tracking-wide">
                        Procesando escudo...
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-black/25" />
                      <div className="text-center">
                        <p className="text-xs font-semibold text-black/60 tracking-wide">
                          Subir escudo del club
                        </p>
                        <p className="text-[11px] text-black/35 mt-1">
                          JPG o PNG · El fondo se elimina automáticamente
                        </p>
                      </div>
                    </>
                  )}
                </label>
              ) : (
                <div className="flex items-center gap-3 border border-black/10 p-3 bg-black/[0.015]">
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
            </div>

            <Separator className="bg-black/8" />

            {/* Step 4 — Number & Name */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-4">
                04 — Número y nombre
              </h2>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="number"
                    className="text-[11px] font-semibold tracking-widest uppercase text-black/45"
                  >
                    Número
                  </Label>
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
                    className="rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-black text-sm h-10"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="teamName"
                    className="text-[11px] font-semibold tracking-widest uppercase text-black/45"
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
                    className="rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-black text-sm h-10"
                  />
                  <p className="text-[11px] text-black/30">
                    {config.teamName.length}/20 caracteres
                  </p>
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
                <div className="flex items-center justify-between gap-4 bg-[#f7f7f7] border border-black/8 p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold tracking-widest uppercase text-black/70">Frente</span>
                    <span className="text-[10px] text-black/40 uppercase">{config.letterColor}</span>
                  </div>
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                    <input
                      type="color"
                      value={config.letterColor}
                      onChange={(e) => setConfig((prev) => ({ ...prev, letterColor: e.target.value }))}
                      className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer opacity-0"
                    />
                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.letterColor }} />
                  </div>
                </div>

                {/* Back Text Color */}
                <div className="flex items-center justify-between gap-4 bg-[#f7f7f7] border border-black/8 p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold tracking-widest uppercase text-black/70">Espalda</span>
                    <span className="text-[10px] text-black/40 uppercase">{config.letterColorBack}</span>
                  </div>
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                    <input
                      type="color"
                      value={config.letterColorBack}
                      onChange={(e) => setConfig((prev) => ({ ...prev, letterColorBack: e.target.value }))}
                      className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer opacity-0"
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
              <a
                href="https://www.bigsportswear.com.ar/contacto/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full border border-black text-black font-bold tracking-widest uppercase rounded-none h-12 text-xs flex items-center justify-center hover:bg-black hover:text-white transition-colors"
              >
                Hacer pedido →
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/10 mt-16">
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
