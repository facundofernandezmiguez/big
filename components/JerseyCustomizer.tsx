"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Upload, Download, Loader2, X, Plus, GripVertical, ArrowLeft } from "lucide-react";
import JerseyPreview from "./JerseyPreview";
import { JerseyConfig, TextElement, SponsorElement, ShieldElement, FontOption, SketchType } from "./types";
import { removeBackground } from "@imgly/background-removal";
import { renderConfigToDataUrl } from "./canvasDownload";
import MobileSwipeTip from "./MobileSwipeTip";

export default function JerseyCustomizer() {
  const [config, setConfig] = useState<JerseyConfig>({
    sketchType: "clasica",
    color: "#111111",
    secondaryColor: "#f5f5f5",
    useGradient: false,
    gradientColor: "#333333",
    useGradientSecondary: false,
    gradientSecondaryColor: "#cccccc",
    letterColor: "#f5f5f5",
    letterColorBack: "#111111",
    shields: [],
    number: "10",
    showNumber: true,
    textElements: [
      { id: "1", text: "MI EQUIPO", font: "bebas", bold: true, size: 1, x: 50, y: 77, target: "back", row: "primary", placement: "lado1" },
    ],
    sponsors: [],
  });

  const nextTextId = useRef(2);

  const handleAddText = () => {
    const newEl: TextElement = {
      id: String(nextTextId.current++),
      text: "",
      font: "bebas",
      bold: true,
      size: 1,
      x: 50,
      y: 50,
      target: "back",
      row: "primary",
      placement: "lado1",
    };
    setConfig((prev) => ({ ...prev, textElements: [...prev.textElements, newEl] }));
  };

  const handleUpdateText = (id: string, updates: Partial<TextElement>) => {
    setConfig((prev) => ({
      ...prev,
      textElements: prev.textElements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
    }));
  };

  const handleRemoveText = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      textElements: prev.textElements.filter((el) => el.id !== id),
    }));
  };

  const handleTextMove = useCallback((id: string, x: number, y: number, target?: "front" | "back", row?: "primary" | "secondary") => {
    setConfig((prev) => ({
      ...prev,
      textElements: prev.textElements.map((el) => {
        if (el.id !== id) return el;
        const updates: Partial<TextElement> = { x, y };
        if (target) updates.target = target;
        if (row && el.placement !== "ambos") {
          updates.row = row;
          updates.placement = row === "primary" ? "lado1" : "lado2";
        }
        return { ...el, ...updates };
      }),
    }));
  }, []);

  const nextSponsorId = useRef(1);

  const handleSponsorMove = useCallback((id: string, x: number, y: number, target?: "front" | "back") => {
    setConfig((prev) => ({
      ...prev,
      sponsors: prev.sponsors.map((s) => {
        if (s.id !== id) return s;
        const updates: Partial<SponsorElement> = { x, y };
        if (target) updates.target = target;
        return { ...s, ...updates };
      }),
    }));
  }, []);

  const handleRemoveSponsor = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      sponsors: prev.sponsors.filter((s) => s.id !== id),
    }));
  };

  const handleUpdateSponsor = (id: string, updates: Partial<SponsorElement>) => {
    setConfig((prev) => ({
      ...prev,
      sponsors: prev.sponsors.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const jerseyGridRef = useRef<HTMLDivElement>(null);

  const nextShieldId = useRef(1);
  const [shieldProcessingId, setShieldProcessingId] = useState<string | null>(null);
  const shieldFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleColorSelect = (hex: string) => {
    setConfig((prev) => ({ ...prev, color: hex }));
  };

  const handleSecondaryColorSelect = (hex: string) => {
    setConfig((prev) => ({ ...prev, secondaryColor: hex }));
  };

  const handleLetterColorSelect = (hex: string) => {
    setConfig((prev) => ({ ...prev, letterColor: hex }));
  };

  const handleAddShield = () => {
    const id = `sh-${nextShieldId.current++}`;
    setTimeout(() => shieldFileRefs.current[id]?.click(), 50);
    const newShield: ShieldElement = {
      id,
      imageUrl: "",
      fileName: "",
      showShield: true,
      shieldPosition: "right",
      shieldSize: 1,
      placement: "lado1",
    };
    setConfig((prev) => ({ ...prev, shields: [...prev.shields, newShield] }));
  };

  const handleShieldUpload = useCallback(async (shieldId: string, file: File) => {
    setShieldProcessingId(shieldId);
    try {
      let url: string;
      if (file.type === "image/png") {
        url = URL.createObjectURL(file);
      } else {
        try {
          const blob = await removeBackground(file);
          url = URL.createObjectURL(blob);
        } catch {
          url = URL.createObjectURL(file);
        }
      }
      setConfig((prev) => ({
        ...prev,
        shields: prev.shields.map((s) =>
          s.id === shieldId ? { ...s, imageUrl: url, fileName: file.name } : s
        ),
      }));
    } finally {
      setShieldProcessingId(null);
    }
  }, []);

  const handleUpdateShield = (id: string, updates: Partial<ShieldElement>) => {
    setConfig((prev) => ({
      ...prev,
      shields: prev.shields.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const handleRemoveShield = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      shields: prev.shields.filter((s) => s.id !== id),
    }));
  };

  // ─── Mobile gestures: pan+zoom preview & pinch-resize selected object ───
  const [viewScale, setViewScale] = useState(1);
  const [viewX, setViewX] = useState(0);
  const [viewY, setViewY] = useState(0);
  const [selectedObject, setSelectedObject] = useState<{ id: string; type: "text" | "sponsor" | "shield" } | null>(null);
  const gestureRef = useRef<{ startDist: number; startScale: number; startMidX: number; startMidY: number; startViewX: number; startViewY: number; mode: "view" | "resize" } | null>(null);

  const handleObjectSelect = useCallback((id: string, type: "text" | "sponsor" | "shield") => {
    setSelectedObject((prev) => (prev?.id === id && prev?.type === type ? null : { id, type }));
  }, []);

  const handleObjectDeselect = useCallback(() => {
    setSelectedObject(null);
  }, []);

  const handleResetView = useCallback(() => {
    setViewScale(1);
    setViewX(0);
    setViewY(0);
  }, []);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    const getDist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const getMid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dist = getDist(e.touches);
      const mid = getMid(e.touches);
      // If an object is selected, pinch resizes it; otherwise pan+zoom the preview
      const sel = selectedObject;
      let startScale: number;
      if (sel) {
        if (sel.type === "shield") startScale = config.shields.find((s) => s.id === sel.id)?.shieldSize ?? 1;
        else if (sel.type === "text") startScale = config.textElements.find((t) => t.id === sel.id)?.size ?? 1;
        else startScale = config.sponsors.find((s) => s.id === sel.id)?.size ?? 1;
        gestureRef.current = { startDist: dist, startScale, startMidX: mid.x, startMidY: mid.y, startViewX: viewX, startViewY: viewY, mode: "resize" };
      } else {
        gestureRef.current = { startDist: dist, startScale: viewScale, startMidX: mid.x, startMidY: mid.y, startViewX: viewX, startViewY: viewY, mode: "view" };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !gestureRef.current) return;
      e.preventDefault();
      const dist = getDist(e.touches);
      const mid = getMid(e.touches);
      const g = gestureRef.current;
      const ratio = dist / g.startDist;

      if (g.mode === "resize") {
        const newSize = Math.min(5, Math.max(0.3, g.startScale * ratio));
        const sel = selectedObject;
        if (!sel) return;
        if (sel.type === "shield") {
          setConfig((prev) => ({ ...prev, shields: prev.shields.map((s) => s.id === sel.id ? { ...s, shieldSize: newSize } : s) }));
        } else if (sel.type === "text") {
          setConfig((prev) => ({
            ...prev,
            textElements: prev.textElements.map((t) => t.id === sel.id ? { ...t, size: newSize } : t),
          }));
        } else {
          setConfig((prev) => ({
            ...prev,
            sponsors: prev.sponsors.map((s) => s.id === sel.id ? { ...s, size: newSize } : s),
          }));
        }
      } else {
        const newScale = Math.min(4, Math.max(0.5, g.startScale * ratio));
        const panX = mid.x - g.startMidX;
        const panY = mid.y - g.startMidY;
        setViewScale(newScale);
        setViewX(g.startViewX + panX);
        setViewY(g.startViewY + panY);
      }
    };

    const onTouchEnd = () => { gestureRef.current = null; };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [selectedObject, viewScale, viewX, viewY, config.shields, config.textElements, config.sponsors]);

  const [sponsorProcessingId, setSponsorProcessingId] = useState<string | null>(null);
  const sponsorFileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleAddSponsor = () => {
    const id = `sp-${nextSponsorId.current++}`;
    // Trigger file picker immediately after adding
    setTimeout(() => sponsorFileRefs.current[id]?.click(), 50);
    const newSponsor: SponsorElement = {
      id,
      imageUrl: "",
      fileName: "",
      x: 50,
      y: 45,
      size: 1,
      target: "front",
      placement: "lado1",
    };
    setConfig((prev) => ({ ...prev, sponsors: [...prev.sponsors, newSponsor] }));
  };

  const handleSponsorUpload = useCallback(async (sponsorId: string, file: File) => {
    setSponsorProcessingId(sponsorId);
    try {
      let url: string;
      if (file.type === "image/png") {
        url = URL.createObjectURL(file);
      } else {
        try {
          const blob = await removeBackground(file);
          url = URL.createObjectURL(blob);
        } catch {
          url = URL.createObjectURL(file);
        }
      }
      setConfig((prev) => ({
        ...prev,
        sponsors: prev.sponsors.map((s) =>
          s.id === sponsorId ? { ...s, imageUrl: url, fileName: file.name } : s
        ),
      }));
    } finally {
      setSponsorProcessingId(null);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    setSelectedObject(null);
    try {
      const dataUrl = await renderConfigToDataUrl(config);
      const firstText = config.textElements.find(el => el.text)?.text || "equipo";
      const link = document.createElement("a");
      link.download = `big-sportswear-${firstText}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download error:", err);
    }
  }, [config]);

  const handleWhatsAppOrder = useCallback(async () => {
    setIsGeneratingImage(true);
    setSelectedObject(null);
    try {
      const dataUrl = await renderConfigToDataUrl(config);
      const firstText = config.textElements.find(el => el.text)?.text || "equipo";
      const fileName = `big-sportswear-${firstText}.png`;

      // Convert data URL to File
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/png" });

      const message = `Hola! Quiero cotizar esta musculosa.`;
      const phone = "5491126237532";

      // Download image so the user can attach it
      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      link.click();

      // Open WhatsApp conversation directly with the number and message
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message + "\n\nTe adjunto la imagen con el diseño.")}`;
      setTimeout(() => {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }, 500);
    } catch (err) {
      // User cancelled share dialog — not an error
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("WhatsApp Order error:", err);
      alert("Hubo un error al preparar el pedido. Por favor intenta de nuevo.");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [config]);

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <MobileSwipeTip />
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
            Musculosa Reversible
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
          <div className="flex flex-col items-center gap-4 sm:gap-5 lg:sticky lg:top-4 lg:z-10 w-full bg-white pb-4 lg:pb-0">
            <div
              ref={previewRef}
              className="relative w-[calc(100%-3rem)] sm:w-full mx-auto bg-[#f7f7f7] border border-black/8 flex items-center justify-center px-2 py-4 sm:p-8 min-h-[220px] sm:min-h-[500px] overflow-hidden"
              style={{ touchAction: "none" }}
              onClick={handleObjectDeselect}
            >
              <div
                className="min-w-[340px] sm:min-w-0"
                style={{
                  transform: `translate(${viewX}px, ${viewY}px) scale(${viewScale})`,
                  transformOrigin: "center",
                  transition: gestureRef.current ? "none" : "transform 0.15s ease-out",
                }}
              >
                <JerseyPreview
                  ref={jerseyGridRef}
                  config={config}
                  className="w-full max-w-[520px]"
                  onTextMove={handleTextMove}
                  onSponsorMove={handleSponsorMove}
                  selectedObjectId={selectedObject?.id ?? null}
                  selectedObjectType={selectedObject?.type ?? null}
                  onObjectSelect={handleObjectSelect}
                />
              </div>
            </div>
            {(viewScale !== 1 || viewX !== 0 || viewY !== 0) && (
              <button
                onClick={handleResetView}
                className="text-[11px] font-semibold text-black/50 hover:text-black/80 underline transition-colors"
              >
                Restablecer zoom
              </button>
            )}
            {selectedObject && (
              <div className="flex items-center gap-2 text-[11px] text-black/60 bg-black/5 border border-black/10 px-3 py-1.5 rounded-full">
                <span className="font-semibold">
                  {selectedObject.type === "shield" ? "Escudo" : selectedObject.type === "text" ? "Texto" : "Sponsor"} seleccionado
                </span>
                <span className="text-black/40">&mdash; Pinch para redimensionar</span>
                <button onClick={handleObjectDeselect} className="ml-1 text-black/40 hover:text-black/70 font-bold">&times;</button>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-6 sm:gap-7 w-full">

            {/* Step 1 — Shields */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3">
                01 — Escudo del club
              </h2>
              <div className="flex flex-col gap-3">
                {config.shields.map((sh) => (
                  <div key={sh.id} className="flex flex-col gap-2 bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                    <input
                      ref={(node) => { shieldFileRefs.current[sh.id] = node; }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleShieldUpload(sh.id, file);
                      }}
                      className="hidden"
                    />
                    {!sh.imageUrl ? (
                      <label
                        onClick={() => shieldFileRefs.current[sh.id]?.click()}
                        className="flex items-center justify-center gap-2 border border-dashed border-black/20 p-3 cursor-pointer hover:border-black/50 hover:bg-black/[0.015] transition-all"
                      >
                        {shieldProcessingId === sh.id ? (
                          <>
                            <Loader2 className="w-5 h-5 text-black/40 animate-spin" />
                            <p className="text-[11px] text-black/45 font-medium">Procesando...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-black/25" />
                            <p className="text-xs font-semibold text-black/60 tracking-wide">Subir escudo</p>
                          </>
                        )}
                      </label>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white border border-black/8 flex items-center justify-center flex-shrink-0">
                            <img src={sh.imageUrl} alt="Escudo" className="w-8 h-8 object-contain" />
                          </div>
                          <p className="text-xs font-semibold truncate text-black/70 flex-1">{sh.fileName}</p>
                          <button
                            onClick={() => shieldFileRefs.current[sh.id]?.click()}
                            className="text-[10px] text-black/40 hover:text-black/70 underline flex-shrink-0"
                          >
                            Cambiar
                          </button>
                          <button
                            onClick={() => handleRemoveShield(sh.id)}
                            className="text-black/25 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Show/Hide Shield */}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[11px] font-semibold tracking-widest uppercase text-black/70">
                            Mostrar
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sh.showShield}
                              onChange={(e) => handleUpdateShield(sh.id, { showShield: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                          </label>
                        </div>

                        {sh.showShield && (
                          <>
                            {/* Shield Position */}
                            <div className="mt-1">
                              <span className="text-[10px] text-black/40 block mb-1">Posición</span>
                              <div className="flex gap-2">
                                {[
                                  { value: "left", label: "Izquierda" },
                                  { value: "center", label: "Centro" },
                                  { value: "right", label: "Derecha" },
                                ].map((pos) => (
                                  <button
                                    key={pos.value}
                                    onClick={() => handleUpdateShield(sh.id, { shieldPosition: pos.value as "left" | "center" | "right" })}
                                    className={`flex-1 py-2 px-1 text-[10px] font-medium uppercase tracking-wide border transition-colors ${
                                      sh.shieldPosition === pos.value
                                        ? "bg-black text-white border-black"
                                        : "bg-white text-black/60 border-black/20 hover:border-black/40"
                                    }`}
                                  >
                                    {pos.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Shield Size */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-black/40 whitespace-nowrap">Tamaño</span>
                              <input
                                type="range"
                                min="0.5"
                                max="2.5"
                                step="0.1"
                                value={sh.shieldSize}
                                onChange={(e) => handleUpdateShield(sh.id, { shieldSize: parseFloat(e.target.value) })}
                                className="flex-1 h-1 accent-black cursor-pointer"
                              />
                              <span className="text-[10px] text-black/40 w-8 text-right">{sh.shieldSize.toFixed(1)}x</span>
                            </div>

                            {/* Placement selector */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-black/40 whitespace-nowrap">Ubicación</span>
                              <div className="flex gap-1 flex-1">
                                {([
                                  { value: "lado1", label: "Lado 1" },
                                  { value: "lado2", label: "Lado 2" },
                                  { value: "ambos", label: "Ambos lados" },
                                ] as const).map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => handleUpdateShield(sh.id, { placement: opt.value })}
                                    className={`flex-1 py-1.5 px-1 text-[10px] font-medium uppercase tracking-wide border transition-colors ${
                                      sh.placement === opt.value
                                        ? "bg-black text-white border-black"
                                        : "bg-white text-black/60 border-black/20 hover:border-black/40"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddShield}
                  className="flex items-center justify-center gap-2 border border-dashed border-black/20 p-3 text-[11px] font-semibold tracking-widest uppercase text-black/50 hover:border-black/40 hover:text-black/70 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar escudo
                </button>
              </div>
            </div>

            <Separator className="bg-black/8" />

            {/* Step 2 — Color */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase">
                  02 — Color de lado 1
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

              {/* Gradient toggle */}
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between bg-[#f7f7f7] border border-black/8 p-3">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-black/70">
                    Degradé
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useGradient}
                      onChange={(e) => setConfig((prev) => ({ ...prev, useGradient: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
                {config.useGradient && (
                  <div className="flex items-center gap-4 sm:gap-5 bg-[#f7f7f7] border border-black/8 p-3">
                    <div className="relative w-14 h-14 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                      <input
                        type="color"
                        value={config.gradientColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, gradientColor: e.target.value }))}
                        className="absolute -top-2 -left-2 w-20 h-20 sm:w-16 sm:h-16 cursor-pointer opacity-0"
                      />
                      <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.gradientColor }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] sm:text-[11px] text-black/50 sm:text-black/40 leading-relaxed">
                        Segundo color del degradé.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator className="bg-black/8" />

            {/* Step 2 — Secondary Color (Dorso) */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase">
                  03 — Color de lado 2
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
                    Elegí el color contrastante para el lado 2 y recortes.
                  </p>
                </div>
              </div>

              {/* Gradient toggle for secondary */}
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between bg-[#f7f7f7] border border-black/8 p-3">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-black/70">
                    Degradé
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useGradientSecondary}
                      onChange={(e) => setConfig((prev) => ({ ...prev, useGradientSecondary: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
                {config.useGradientSecondary && (
                  <div className="flex items-center gap-4 sm:gap-5 bg-[#f7f7f7] border border-black/8 p-3">
                    <div className="relative w-14 h-14 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                      <input
                        type="color"
                        value={config.gradientSecondaryColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, gradientSecondaryColor: e.target.value }))}
                        className="absolute -top-2 -left-2 w-20 h-20 sm:w-16 sm:h-16 cursor-pointer opacity-0"
                      />
                      <div className="w-full h-full pointer-events-none" style={{ backgroundColor: config.gradientSecondaryColor }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] sm:text-[11px] text-black/50 sm:text-black/40 leading-relaxed">
                        Segundo color del degradé.
                      </p>
                    </div>
                  </div>
                )}
              </div>
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

                {/* Text Elements */}
                <div className="flex flex-col gap-3">
                  {config.textElements.map((el) => (
                    <div key={el.id} className="flex flex-col gap-2 bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-black/20 flex-shrink-0" />
                        <Input
                          type="text"
                          maxLength={30}
                          placeholder="Escribí tu texto"
                          value={el.text}
                          onChange={(e) => handleUpdateText(el.id, { text: e.target.value })}
                          className="rounded-none border-black/20 focus-visible:ring-0 focus-visible:border-black text-base sm:text-sm h-10 sm:h-9 bg-white flex-1"
                        />
                        <button
                          onClick={() => handleRemoveText(el.id)}
                          className="text-black/25 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Bold toggle */}
                        <button
                          onClick={() => handleUpdateText(el.id, { bold: !el.bold })}
                          className={`flex-shrink-0 w-9 h-8 flex items-center justify-center border text-[13px] font-black transition-colors ${
                            el.bold
                              ? "bg-black text-white border-black"
                              : "bg-white text-black/40 border-black/20 hover:border-black/40"
                          }`}
                          title="Negrita"
                        >
                          B
                        </button>
                        {/* Font selector */}
                        <div className="relative flex-1">
                          <select
                            value={el.font}
                            onChange={(e) => handleUpdateText(el.id, { font: e.target.value as FontOption })}
                            className="w-full appearance-none rounded-none border border-black/20 bg-white px-3 py-1.5 text-[11px] outline-none focus-visible:border-black"
                            style={{
                              fontFamily: [
                                { value: "bebas", style: "'Bebas Neue', sans-serif" },
                                { value: "franklin", style: "'Libre Franklin', sans-serif" },
                                { value: "baskerville", style: "'Libre Baskerville', serif" },
                                { value: "open-sans", style: "'Open Sans', sans-serif" },
                                { value: "oswald", style: "'Oswald', sans-serif" },
                              ].find(f => f.value === el.font)?.style
                            }}
                          >
                            <option value="bebas" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Bebas Neue</option>
                            <option value="franklin" style={{ fontFamily: "'Libre Franklin', sans-serif" }}>ITC Franklin Gothic</option>
                            <option value="baskerville" style={{ fontFamily: "'Libre Baskerville', serif" }}>Libre Baskerville</option>
                            <option value="open-sans" style={{ fontFamily: "'Open Sans', sans-serif" }}>Open Sans</option>
                            <option value="oswald" style={{ fontFamily: "'Oswald', sans-serif" }}>Oswald</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-black/50">
                            <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-black/40 whitespace-nowrap">Tamaño</span>
                        <input
                          type="range"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={el.size}
                          onChange={(e) => handleUpdateText(el.id, { size: parseFloat(e.target.value) })}
                          className="flex-1 h-1 accent-black cursor-pointer"
                        />
                        <span className="text-[10px] text-black/40 w-8 text-right">{el.size.toFixed(1)}x</span>
                      </div>

                      {/* Placement selector */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-black/40 whitespace-nowrap">Ubicación</span>
                        <div className="flex gap-1 flex-1">
                          {([
                            { value: "lado1", label: "Lado 1" },
                            { value: "lado2", label: "Lado 2" },
                            { value: "ambos", label: "Ambos lados" },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => handleUpdateText(el.id, {
                                placement: opt.value,
                                row: opt.value === "lado2" ? "secondary" : "primary",
                              })}
                              className={`flex-1 py-1.5 px-1 text-[10px] font-medium uppercase tracking-wide border transition-colors ${
                                el.placement === opt.value
                                  ? "bg-black text-white border-black"
                                  : "bg-white text-black/60 border-black/20 hover:border-black/40"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <p className="text-[10px] text-black/30 flex items-center gap-1">
                        <GripVertical className="w-3 h-3" />
                        Arrastrá el texto en la previsualización para posicionarlo
                      </p>
                    </div>
                  ))}

                  <button
                    onClick={handleAddText}
                    className="flex items-center justify-center gap-2 border border-dashed border-black/20 p-3 text-[11px] font-semibold tracking-widest uppercase text-black/50 hover:border-black/40 hover:text-black/70 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar texto
                  </button>
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
                    <span className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/70">Lado 1</span>
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
                    <span className="text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/70">Lado 2</span>
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

            {/* Step 6 — Sponsors */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3">
                06 — Sponsors
              </h2>
              <div className="flex flex-col gap-3">
                {config.sponsors.map((sp) => (
                  <div key={sp.id} className="flex flex-col gap-2 bg-[#f7f7f7] border border-black/8 p-4 sm:p-3">
                    <input
                      ref={(node) => { sponsorFileRefs.current[sp.id] = node; }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSponsorUpload(sp.id, file);
                      }}
                      className="hidden"
                    />
                    {!sp.imageUrl ? (
                      <label
                        onClick={() => sponsorFileRefs.current[sp.id]?.click()}
                        className="flex items-center justify-center gap-2 border border-dashed border-black/20 p-3 cursor-pointer hover:border-black/50 hover:bg-black/[0.015] transition-all"
                      >
                        {sponsorProcessingId === sp.id ? (
                          <>
                            <Loader2 className="w-5 h-5 text-black/40 animate-spin" />
                            <p className="text-[11px] text-black/45 font-medium">Procesando...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-black/25" />
                            <p className="text-xs font-semibold text-black/60 tracking-wide">Subir imagen de sponsor</p>
                          </>
                        )}
                      </label>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white border border-black/8 flex items-center justify-center flex-shrink-0">
                            <img src={sp.imageUrl} alt="Sponsor" className="w-8 h-8 object-contain" />
                          </div>
                          <p className="text-xs font-semibold truncate text-black/70 flex-1">{sp.fileName}</p>
                          <button
                            onClick={() => sponsorFileRefs.current[sp.id]?.click()}
                            className="text-[10px] text-black/40 hover:text-black/70 underline flex-shrink-0"
                          >
                            Cambiar
                          </button>
                          <button
                            onClick={() => handleRemoveSponsor(sp.id)}
                            className="text-black/25 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-black/40 whitespace-nowrap">Tamaño</span>
                          <input
                            type="range"
                            min="0.3"
                            max="3"
                            step="0.1"
                            value={sp.size}
                            onChange={(e) => handleUpdateSponsor(sp.id, { size: parseFloat(e.target.value) })}
                            className="flex-1 h-1 accent-black cursor-pointer"
                          />
                          <span className="text-[10px] text-black/40 w-8 text-right">{sp.size.toFixed(1)}x</span>
                        </div>
                        {/* Placement selector */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-black/40 whitespace-nowrap">Ubicación</span>
                          <div className="flex gap-1 flex-1">
                            {([
                              { value: "lado1", label: "Lado 1" },
                              { value: "lado2", label: "Lado 2" },
                              { value: "ambos", label: "Ambos lados" },
                            ] as const).map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => handleUpdateSponsor(sp.id, { placement: opt.value })}
                                className={`flex-1 py-1.5 px-1 text-[10px] font-medium uppercase tracking-wide border transition-colors ${
                                  sp.placement === opt.value
                                    ? "bg-black text-white border-black"
                                    : "bg-white text-black/60 border-black/20 hover:border-black/40"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-black/30 flex items-center gap-1">
                          <GripVertical className="w-3 h-3" />
                          Arrastrá el sponsor en la previsualización para posicionarlo
                        </p>
                      </>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddSponsor}
                  className="flex items-center justify-center gap-2 border border-dashed border-black/20 p-3 text-[11px] font-semibold tracking-widest uppercase text-black/50 hover:border-black/40 hover:text-black/70 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar sponsor
                </button>
              </div>
            </div>

            <Separator className="bg-black/8" />

            {/* Step 7 — Sketch Type */}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3">
                07 — Boceto
              </h2>
              <div className="relative">
                <select
                  value={config.sketchType}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sketchType: e.target.value as SketchType }))}
                  className="w-full appearance-none rounded-none border border-black/20 bg-[#f7f7f7] px-4 py-3 text-[12px] sm:text-[11px] font-semibold tracking-widest uppercase text-black/70 outline-none focus-visible:border-black cursor-pointer"
                >
                  <option value="clasica">Clásica</option>
                  <option value="recorte-lateral">Recorte Lateral</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-black/50">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-black/40 mt-2">
                Elegí el tipo de boceto para la remera.
              </p>
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
                      Preparando...
                    </>
                  ) : (
                    "Contactanos →"
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
              Preparando...
            </>
          ) : (
            <>
              Contactanos →
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
