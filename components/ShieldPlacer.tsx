"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, Loader2, X, Hash, ArrowLeft } from "lucide-react";
import { removeOuterBackground } from "./shieldProcessing";

const GARMENT_IMAGES = [
  { id: "negro", src: "/negro.png", label: "Negro" },
  { id: "verde", src: "/verde.png", label: "Verde" },
  { id: "rojo", src: "/rojo.png", label: "Rojo" },
  { id: "blanco", src: "/blanco.png", label: "Blanco" },
  { id: "azul", src: "/azul.png", label: "Azul" },
];

// ─── Fixed positions (% of container) ───
const SHIELD_WIDTH_PCT_DEFAULT = 20;
const SHIELD_WIDTH_PCT_MIN = 8;
const SHIELD_WIDTH_PCT_MAX = 35;
const SHIELD_TOP_POS = { x: 65, y: 30 };
const SHIELD_CALZA_POS = { x: 68, y: 82 };

const NUMBER_FONT_PCT = 9;
const NUMBER_TOP_POS = { x: 37, y: 30 };
const NUMBER_CALZA_POS = { x: 35, y: 82 };

type NumberPlacement = "none" | "top" | "calza" | "both";

export default function ShieldPlacer() {
  const [selectedImage, setSelectedImage] = useState(GARMENT_IMAGES[0]);
  const [shieldUrl, setShieldUrl] = useState<string | null>(null);
  const [shieldFileName, setShieldFileName] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removeBgError, setRemoveBgError] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [numberValue, setNumberValue] = useState("");
  const [numberPlacement, setNumberPlacement] = useState<NumberPlacement>("none");

  const [shieldWidthPct, setShieldWidthPct] = useState(SHIELD_WIDTH_PCT_DEFAULT);

  const [previewWidth, setPreviewWidth] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Track preview container width for responsive number font size
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleShieldUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setRemoveBgError(null);
      setShieldFileName(file.name);

      if (file.type === "image/png") {
        setShieldUrl(URL.createObjectURL(file));
        return;
      }

      setIsRemovingBg(true);
      try {
        const imageBlob = await removeOuterBackground(file);
        const url = URL.createObjectURL(imageBlob);
        setShieldUrl(url);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setRemoveBgError(message);
        setShieldUrl(URL.createObjectURL(file));
      } finally {
        setIsRemovingBg(false);
      }
    },
    []
  );

  const handleRemoveShield = () => {
    setShieldUrl(null);
    setShieldFileName(null);
    setRemoveBgError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Helper: draw number on canvas ───
  const drawNumberOnCanvas = (
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    pos: { x: number; y: number },
    value: string,
    useBlackFill: boolean = false
  ) => {
    const fontSize = Math.round((NUMBER_FONT_PCT / 100) * canvasW);
    ctx.save();
    ctx.font = `900 ${fontSize}px "Open Sans", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = useBlackFill ? "black" : "white";
    const dx = (pos.x / 100) * canvasW;
    const dy = (pos.y / 100) * canvasH;
    ctx.fillText(value, dx, dy);
    ctx.restore();
  };

  // ─── Download composite image ───
  const handleDownload = useCallback(async () => {
    const hasContent = shieldUrl || (numberValue && numberPlacement !== "none");
    if (!hasContent) return;
    setIsGeneratingImage(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = selectedImage.src;
      await new Promise((res, rej) => { baseImg.onload = res; baseImg.onerror = rej; });

      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      ctx.drawImage(baseImg, 0, 0);

      // Draw shields at fixed right-side positions
      if (shieldUrl) {
        const shieldImg = new Image();
        shieldImg.crossOrigin = "anonymous";
        shieldImg.src = shieldUrl;
        await new Promise((res, rej) => { shieldImg.onload = res; shieldImg.onerror = rej; });

        const shieldW = (shieldWidthPct / 100) * canvas.width;
        const shieldH = (shieldImg.naturalHeight / shieldImg.naturalWidth) * shieldW;

        // Shield on top
        const topX = (SHIELD_TOP_POS.x / 100) * canvas.width - shieldW / 2;
        const topY = (SHIELD_TOP_POS.y / 100) * canvas.height - shieldH / 2;
        ctx.drawImage(shieldImg, topX, topY, shieldW, shieldH);

        // Shield on calza
        const calzaX = (SHIELD_CALZA_POS.x / 100) * canvas.width - shieldW / 2;
        const calzaY = (SHIELD_CALZA_POS.y / 100) * canvas.height - shieldH / 2;
        ctx.drawImage(shieldImg, calzaX, calzaY, shieldW, shieldH);
      }

      // Draw numbers at fixed left-side positions
      const isBlanco = selectedImage.id === "blanco";
      if (numberValue && numberPlacement !== "none") {
        if (numberPlacement === "top" || numberPlacement === "both") {
          drawNumberOnCanvas(ctx, canvas.width, canvas.height, NUMBER_TOP_POS, numberValue, isBlanco);
        }
        if (numberPlacement === "calza" || numberPlacement === "both") {
          drawNumberOnCanvas(ctx, canvas.width, canvas.height, NUMBER_CALZA_POS, numberValue);
        }
      }

      const link = document.createElement("a");
      link.download = `big-escudo-${selectedImage.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      if (typeof window !== "undefined" && (window as any).umami) {
        (window as any).umami.track("boceto_descargado", {
          prenda: "top-calza",
          color: selectedImage.id,
          tiene_escudo: !!shieldUrl,
          tiene_numero: !!numberValue,
        });
      }
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [shieldUrl, selectedImage, numberValue, numberPlacement, shieldWidthPct]);

  // ─── WhatsApp order ───
  const handleWhatsAppOrder = useCallback(async () => {
    const hasContent = shieldUrl || (numberValue && numberPlacement !== "none");
    if (!hasContent) return;
    setIsGeneratingImage(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = selectedImage.src;
      await new Promise((res, rej) => { baseImg.onload = res; baseImg.onerror = rej; });

      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      ctx.drawImage(baseImg, 0, 0);

      if (shieldUrl) {
        const shieldImg = new Image();
        shieldImg.crossOrigin = "anonymous";
        shieldImg.src = shieldUrl;
        await new Promise((res, rej) => { shieldImg.onload = res; shieldImg.onerror = rej; });

        const shieldW = (shieldWidthPct / 100) * canvas.width;
        const shieldH = (shieldImg.naturalHeight / shieldImg.naturalWidth) * shieldW;

        const topX = (SHIELD_TOP_POS.x / 100) * canvas.width - shieldW / 2;
        const topY = (SHIELD_TOP_POS.y / 100) * canvas.height - shieldH / 2;
        ctx.drawImage(shieldImg, topX, topY, shieldW, shieldH);

        const calzaX = (SHIELD_CALZA_POS.x / 100) * canvas.width - shieldW / 2;
        const calzaY = (SHIELD_CALZA_POS.y / 100) * canvas.height - shieldH / 2;
        ctx.drawImage(shieldImg, calzaX, calzaY, shieldW, shieldH);
      }

      const isBlanco2 = selectedImage.id === "blanco";
      if (numberValue && numberPlacement !== "none") {
        if (numberPlacement === "top" || numberPlacement === "both") {
          drawNumberOnCanvas(ctx, canvas.width, canvas.height, NUMBER_TOP_POS, numberValue, isBlanco2);
        }
        if (numberPlacement === "calza" || numberPlacement === "both") {
          drawNumberOnCanvas(ctx, canvas.width, canvas.height, NUMBER_CALZA_POS, numberValue);
        }
      }

      const fileName = `big-sportswear-top-calza-${selectedImage.id}.png`;

      // Download image so the user can attach it
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png");
      link.click();
      
      if (typeof window !== "undefined" && (window as any).umami) {
        (window as any).umami.track("whatsapp_click", {
          prenda: "top-calza",
          color: selectedImage.id,
          tiene_escudo: !!shieldUrl,
          tiene_numero: !!numberValue,
        });
      }

      // Open WhatsApp conversation directly with the number and message
      const message = `Hola! Quiero cotizar este top y calza.`;
      const phone = "5491126237532";
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message + "\n\nTe adjunto la imagen con el diseño.")}`;
      setTimeout(() => {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }, 500);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("WhatsApp order error:", err);
      alert("Hubo un error al preparar el pedido. Por favor intenta de nuevo.");
    } finally {
      setTimeout(() => setIsGeneratingImage(false), 500);
    }
  }, [shieldUrl, selectedImage, numberValue, numberPlacement, shieldWidthPct]);

  const isBlanco = selectedImage.id === "blanco";
  const hasContent = shieldUrl || (numberValue && numberPlacement !== "none");
  const numberFontSize = Math.round((NUMBER_FONT_PCT / 100) * previewWidth);
  const showNumberTop = numberValue && (numberPlacement === "top" || numberPlacement === "both");
  const showNumberCalza = numberValue && (numberPlacement === "calza" || numberPlacement === "both");

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Header */}
      <header className="border-b border-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase text-black/45 hover:text-black transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </Link>
            <span className="w-px h-5 bg-black/10 flex-shrink-0" />
            <a
              href="https://www.bigsportswear.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col leading-none min-w-0"
            >
              <span className="text-lg sm:text-xl font-black tracking-widest uppercase">BIG</span>
              <span className="text-[10px] font-semibold tracking-[0.3em] uppercase text-black/50">
                Sportswear
              </span>
            </a>
          </div>
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-black/35 hidden sm:block">
            Top y Calza
          </span>
        </div>
      </header>

      {/* Announcement bar */}
      <div className="bg-black text-white text-center py-2.5">
        <p className="text-[11px] font-semibold tracking-[0.25em] uppercase">
          Elegí tu prenda, subí el escudo y agregá tu número
        </p>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-12 items-start">

          {/* Preview */}
          <div className="flex flex-col items-center gap-4 sm:gap-5 lg:sticky lg:top-4 lg:z-10 w-full bg-white pb-4 lg:pb-0">
            <div
              ref={previewRef}
              className="relative w-full bg-[#f7f7f7] border border-black/8 flex items-center justify-center overflow-hidden select-none"
            >
              {/* Base garment image */}
              <img
                src={selectedImage.src}
                alt={selectedImage.label}
                className="w-full h-auto block"
                draggable={false}
              />

              {/* Shield on top — fixed right side */}
              {shieldUrl && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${SHIELD_TOP_POS.x}%`,
                    top: `${SHIELD_TOP_POS.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${shieldWidthPct}%`,
                    zIndex: 10,
                  }}
                >
                  <img
                    src={shieldUrl}
                    alt="Escudo top"
                    className="w-full h-auto drop-shadow-lg"
                    draggable={false}
                  />
                </div>
              )}

              {/* Shield on calza — fixed right side */}
              {shieldUrl && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${SHIELD_CALZA_POS.x}%`,
                    top: `${SHIELD_CALZA_POS.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${shieldWidthPct}%`,
                    zIndex: 10,
                  }}
                >
                  <img
                    src={shieldUrl}
                    alt="Escudo calza"
                    className="w-full h-auto drop-shadow-lg"
                    draggable={false}
                  />
                </div>
              )}

              {/* Number on top — fixed left side */}
              {showNumberTop && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${NUMBER_TOP_POS.x}%`,
                    top: `${NUMBER_TOP_POS.y}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${numberFontSize}px`,
                    zIndex: 10,
                  }}
                >
                  <span
                    className={`font-black select-none ${isBlanco ? "text-black" : "text-white"}`}
                    style={{
                      fontFamily: '"Open Sans", Arial, sans-serif',
                    }}
                  >
                    {numberValue}
                  </span>
                </div>
              )}

              {/* Number on calza — fixed left side */}
              {showNumberCalza && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${NUMBER_CALZA_POS.x}%`,
                    top: `${NUMBER_CALZA_POS.y}%`,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${numberFontSize}px`,
                    zIndex: 10,
                  }}
                >
                  <span
                    className="font-black text-white select-none"
                    style={{
                      fontFamily: '"Open Sans", Arial, sans-serif',
                    }}
                  >
                    {numberValue}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-6 sm:gap-7 w-full">

            {/* Step 1 — Choose garment */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3">
                01 — Elegí la prenda
              </h2>
              <div className="grid grid-cols-5 gap-2">
                {GARMENT_IMAGES.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className={`relative aspect-[3/4] overflow-hidden border-2 transition-all ${
                      selectedImage.id === img.id
                        ? "border-black shadow-md"
                        : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    <img
                      src={img.src}
                      alt={img.label}
                      className="w-full h-full object-cover"
                    />
                    <span className={`absolute bottom-0 inset-x-0 text-center text-[9px] font-semibold uppercase tracking-wider py-1 ${
                      selectedImage.id === img.id
                        ? "bg-black text-white"
                        : "bg-white/80 text-black/60"
                    }`}>
                      {img.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-black/8" />

            {/* Step 2 — Upload shield */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3">
                02 — Escudo del club
              </h2>
              <div className="flex flex-col gap-2 bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleShieldUpload}
                  className="hidden"
                  id="shield-upload"
                />
                {!shieldUrl ? (
                  <label
                    htmlFor="shield-upload"
                    className="flex items-center justify-center gap-2 border border-dashed border-black/20 p-3 cursor-pointer hover:border-black/50 hover:bg-black/[0.015] transition-all"
                  >
                    {isRemovingBg ? (
                      <>
                        <Loader2 className="w-5 h-5 text-black/40 animate-spin" />
                        <p className="text-[11px] text-black/45 font-medium">Procesando...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-black/25" />
                        <p className="text-xs font-semibold text-black/60 tracking-wide">
                          Subir escudo
                        </p>
                      </>
                    )}
                  </label>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white border border-black/8 flex items-center justify-center flex-shrink-0">
                        <img
                          src={shieldUrl}
                          alt="Escudo"
                          className="w-8 h-8 object-contain"
                        />
                      </div>
                      <p className="text-xs font-semibold truncate text-black/70 flex-1">
                        {shieldFileName ?? "Escudo cargado"}
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] text-black/40 hover:text-black/70 underline flex-shrink-0"
                      >
                        Cambiar
                      </button>
                      <button
                        onClick={handleRemoveShield}
                        className="text-black/25 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Shield Size */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-black/40 whitespace-nowrap">Tamaño</span>
                      <input
                        type="range"
                        min={SHIELD_WIDTH_PCT_MIN}
                        max={SHIELD_WIDTH_PCT_MAX}
                        value={shieldWidthPct}
                        onChange={(e) => setShieldWidthPct(Number(e.target.value))}
                        className="flex-1 h-1 accent-black cursor-pointer"
                      />
                      <span className="text-[10px] text-black/40 w-10 text-right tabular-nums">{shieldWidthPct}%</span>
                    </div>
                    <p className="text-[10px] text-black/40 mt-1">
                      El escudo se ubica automáticamente en el lado derecho del top y la calza.
                    </p>
                  </>
                )}
              </div>
              {removeBgError && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 mt-2">
                  ⚠ {removeBgError}. Se usó la imagen original.
                </p>
              )}
            </div>

            <div className="h-px bg-black/8" />

            {/* Step 3 — Number */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3">
                03 — Agregá un número
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/25" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      placeholder="Ej: 10"
                      value={numberValue}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                        setNumberValue(val);
                        if (val && numberPlacement === "none") setNumberPlacement("both");
                        if (!val) setNumberPlacement("none");
                      }}
                      className="w-full border border-black/15 bg-white px-3 py-2.5 pl-9 text-sm font-bold tracking-widest text-center focus:outline-none focus:border-black/40 transition-colors"
                    />
                  </div>
                  {numberValue && (
                    <button
                      onClick={() => { setNumberValue(""); setNumberPlacement("none"); }}
                      className="text-black/25 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {numberValue && (
                  <div className="bg-[#f7f7f7] border border-black/8 p-3">
                    <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-black/45 mb-2">
                      Ubicación del número
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["top", "calza", "both"] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => setNumberPlacement(option)}
                          className={`text-[11px] font-semibold uppercase tracking-wider py-2 border transition-all ${
                            numberPlacement === option
                              ? "border-black bg-black text-white"
                              : "border-black/15 bg-white text-black/50 hover:border-black/30"
                          }`}
                        >
                          {option === "top" ? "Top" : option === "calza" ? "Calza" : "Ambos"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-black/40 mt-2">
                      El número se ubica automáticamente en el lado izquierdo.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-black/8" />

            {/* CTAs */}
            <div className="flex flex-col gap-2.5">
              <Button
                onClick={handleDownload}
                disabled={!hasContent || isGeneratingImage}
                className="w-full bg-black hover:bg-black/80 text-white font-bold tracking-widest uppercase rounded-none h-12 text-xs gap-2 disabled:opacity-40"
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Descargar previsualización
              </Button>
              <Button
                onClick={handleWhatsAppOrder}
                disabled={!hasContent || isGeneratingImage}
                className="w-full border border-black text-black font-bold tracking-widest uppercase rounded-none h-12 text-xs flex items-center justify-center hover:bg-black hover:text-white transition-colors bg-white disabled:opacity-40"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Preparando...
                  </>
                ) : (
                  "Contactanos →"
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Action Bar */}
      {hasContent && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-black/10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden z-50">
          <Button
            onClick={handleWhatsAppOrder}
            disabled={isGeneratingImage}
            className="w-full bg-black hover:bg-black/80 text-white font-bold tracking-widest uppercase rounded-none h-14 gap-2 text-xs disabled:opacity-50"
          >
            {isGeneratingImage ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Preparando...
              </>
            ) : (
              "Contactanos →"
            )}
          </Button>
        </div>
      )}

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
