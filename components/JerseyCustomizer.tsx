"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, Loader2, X, Plus, GripVertical } from "lucide-react";
import JerseyPreview from "./JerseyPreview";
import { isLight, recolorPixels } from "./JerseyPreview";
import { JerseyConfig, TextElement, SponsorElement, FontOption } from "./types";
import { removeBackground } from "@imgly/background-removal";

export default function JerseyCustomizer() {
  const [config, setConfig] = useState<JerseyConfig>({
    color: "#111111",
    secondaryColor: "#f5f5f5",
    useGradient: false,
    gradientColor: "#333333",
    useGradientSecondary: false,
    gradientSecondaryColor: "#cccccc",
    letterColor: "#f5f5f5",
    letterColorBack: "#111111",
    shieldUrl: null,
    showShield: true,
    shieldPosition: "right",
    number: "10",
    showNumber: true,
    textElements: [
      { id: "1", text: "MI EQUIPO", font: "arial-black", size: 1, x: 50, y: 77, target: "back" },
    ],
    sponsors: [],
  });

  const nextTextId = useRef(2);

  const handleAddText = () => {
    const newEl: TextElement = {
      id: String(nextTextId.current++),
      text: "",
      font: "arial-black",
      size: 1,
      x: 50,
      y: 50,
      target: "back",
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

  const handleTextMove = useCallback((id: string, x: number, y: number, target?: "front" | "back") => {
    setConfig((prev) => ({
      ...prev,
      textElements: prev.textElements.map((el) => {
        if (el.id !== id) return el;
        const updates: Partial<TextElement> = { x, y };
        if (target) updates.target = target;
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

      const pGrad = config.useGradient ? config.gradientColor : undefined;
      const sGrad = config.useGradientSecondary ? config.gradientSecondaryColor : undefined;
      const fpUrl = recolorPixels(staging, 0, 0, halfW, imgH, config.color, outW, imgH, config.secondaryColor, pGrad, sGrad);
      const bpUrl = recolorPixels(staging, halfW, 0, backSw, imgH, config.color, outW, imgH, config.secondaryColor, pGrad, sGrad);
      const fsUrl = recolorPixels(staging, 0, 0, halfW, imgH, config.secondaryColor, outW, imgH, config.color, sGrad, pGrad);
      const bsUrl = recolorPixels(staging, halfW, 0, backSw, imgH, config.secondaryColor, outW, imgH, config.color, sGrad, pGrad);

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

      // Sponsors
      for (const sp of config.sponsors) {
        if (!sp.imageUrl) continue;
        try {
          const spImg = await loadImg(sp.imageUrl);
          const spW = Math.round(CW * 0.15 * sp.size);
          const spH = Math.round(spW * (spImg.naturalHeight / spImg.naturalWidth));
          const spX = CW * (sp.x / 100) - spW / 2;
          const spY = CH * (sp.y / 100) - spH / 2;
          if (sp.target === "front") {
            ctx.drawImage(spImg, cells[0].x + spX, cells[0].y + spY, spW, spH);
            ctx.drawImage(spImg, cells[2].x + spX, cells[2].y + spY, spW, spH);
          } else {
            ctx.drawImage(spImg, cells[1].x + spX, cells[1].y + spY, spW, spH);
            ctx.drawImage(spImg, cells[3].x + spX, cells[3].y + spY, spW, spH);
          }
        } catch { /* skip */ }
      }

      // Back number on both backs
      if (config.showNumber && config.number) {
        const drawBackNumber = (cell: { x: number; y: number }, tc: string) => {
          const cx = cell.x + CW / 2;
          ctx.save();
          ctx.font = `900 ${Math.round(CH * 0.22)}px 'Impact', 'Arial Black', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = tc;
          ctx.translate(cx, cell.y + CH * 0.51);
          ctx.scale(1, 1.15);
          ctx.fillText(config.number, 0, 0);
          ctx.restore();
        };
        drawBackNumber(cells[1], config.letterColor);
        drawBackNumber(cells[3], config.letterColorBack);
      }

      // Text elements
      const fontMap: Record<FontOption, string> = {
        "arial-black": "'Arial Black', Arial, sans-serif",
        "impact": "'Impact', 'Arial Black', sans-serif",
        "bebas": "'Bebas Neue', 'Arial Black', sans-serif",
        "roboto": "'Roboto Condensed', 'Arial', sans-serif",
        "montserrat": "'Montserrat', 'Arial Black', sans-serif",
        "oswald": "'Oswald', 'Arial Black', sans-serif",
        "teko": "'Teko', 'Arial Black', sans-serif",
        "anton": "'Anton', 'Arial Black', sans-serif",
      };
      const drawTextElements = (cell: { x: number; y: number }, target: "front" | "back", tc: string) => {
        for (const el of config.textElements) {
          if (el.target !== target || !el.text) continue;
          const elFont = fontMap[el.font] || fontMap["arial-black"];
          ctx.font = `900 ${Math.round(CH * 0.05 * el.size)}px ${elFont}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = tc;
          ctx.fillText(el.text, cell.x + CW * (el.x / 100), cell.y + CH * (el.y / 100));
        }
      };
      drawTextElements(cells[0], "front", config.letterColor);
      drawTextElements(cells[1], "back", config.letterColor);
      drawTextElements(cells[2], "front", config.letterColorBack);
      drawTextElements(cells[3], "back", config.letterColorBack);

      // Labels
      ctx.font = "bold 11px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#999";
      ctx.fillText("FRENTE", cells[0].x + CW / 2, cells[0].y + CH + 4);
      ctx.fillText("ESPALDA", cells[1].x + CW / 2, cells[1].y + CH + 4);
      ctx.fillText("FRENTE (DORSO)", cells[2].x + CW / 2, cells[2].y + CH + 4);
      ctx.fillText("ESPALDA (DORSO)", cells[3].x + CW / 2, cells[3].y + CH + 4);

      const firstText = config.textElements.find(el => el.text)?.text || "equipo";
      const link = document.createElement("a");
      link.download = `big-sportswear-${firstText}.png`;
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

      const pGrad2 = config.useGradient ? config.gradientColor : undefined;
      const sGrad2 = config.useGradientSecondary ? config.gradientSecondaryColor : undefined;
      const fpUrl = recolorPixels(staging, 0, 0, halfW, imgH, config.color, outW, imgH, config.secondaryColor, pGrad2, sGrad2);
      const bpUrl = recolorPixels(staging, halfW, 0, backSw, imgH, config.color, outW, imgH, config.secondaryColor, pGrad2, sGrad2);
      const fsUrl = recolorPixels(staging, 0, 0, halfW, imgH, config.secondaryColor, outW, imgH, config.color, sGrad2, pGrad2);
      const bsUrl = recolorPixels(staging, halfW, 0, backSw, imgH, config.secondaryColor, outW, imgH, config.color, sGrad2, pGrad2);

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

      // Sponsors
      for (const sp of config.sponsors) {
        if (!sp.imageUrl) continue;
        try {
          const spImg = await loadImg(sp.imageUrl);
          const spW = Math.round(CW * 0.15 * sp.size);
          const spH = Math.round(spW * (spImg.naturalHeight / spImg.naturalWidth));
          const spX = CW * (sp.x / 100) - spW / 2;
          const spY = CH * (sp.y / 100) - spH / 2;
          if (sp.target === "front") {
            ctx.drawImage(spImg, cells[0].x + spX, cells[0].y + spY, spW, spH);
            ctx.drawImage(spImg, cells[2].x + spX, cells[2].y + spY, spW, spH);
          } else {
            ctx.drawImage(spImg, cells[1].x + spX, cells[1].y + spY, spW, spH);
            ctx.drawImage(spImg, cells[3].x + spX, cells[3].y + spY, spW, spH);
          }
        } catch { /* skip */ }
      }

      // Back number on both backs
      if (config.showNumber && config.number) {
        const drawBackNumber2 = (cell: { x: number; y: number }, tc: string) => {
          const cx = cell.x + CW / 2;
          ctx.save();
          ctx.font = `900 ${Math.round(CH * 0.22)}px 'Impact', 'Arial Black', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = tc;
          ctx.translate(cx, cell.y + CH * 0.51);
          ctx.scale(1, 1.15);
          ctx.fillText(config.number, 0, 0);
          ctx.restore();
        };
        drawBackNumber2(cells[1], config.letterColor);
        drawBackNumber2(cells[3], config.letterColorBack);
      }

      // Text elements
      const fontMap2: Record<FontOption, string> = {
        "arial-black": "'Arial Black', Arial, sans-serif",
        "impact": "'Impact', 'Arial Black', sans-serif",
        "bebas": "'Bebas Neue', 'Arial Black', sans-serif",
        "roboto": "'Roboto Condensed', 'Arial', sans-serif",
        "montserrat": "'Montserrat', 'Arial Black', sans-serif",
        "oswald": "'Oswald', 'Arial Black', sans-serif",
        "teko": "'Teko', 'Arial Black', sans-serif",
        "anton": "'Anton', 'Arial Black', sans-serif",
      };
      const drawTextElements2 = (cell: { x: number; y: number }, target: "front" | "back", tc: string) => {
        for (const el of config.textElements) {
          if (el.target !== target || !el.text) continue;
          const elFont = fontMap2[el.font] || fontMap2["arial-black"];
          ctx.font = `900 ${Math.round(CH * 0.05 * el.size)}px ${elFont}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = tc;
          ctx.fillText(el.text, cell.x + CW * (el.x / 100), cell.y + CH * (el.y / 100));
        }
      };
      drawTextElements2(cells[0], "front", config.letterColor);
      drawTextElements2(cells[1], "back", config.letterColor);
      drawTextElements2(cells[2], "front", config.letterColorBack);
      drawTextElements2(cells[3], "back", config.letterColorBack);

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
      const firstText2 = config.textElements.find(el => el.text)?.text || "equipo";
      const fileName = `big-sportswear-${firstText2}.png`;
      const canvasDataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvasDataUrl;
      link.click();

      // Abrir WhatsApp con el texto (la imagen ya se descargó para que el usuario la adjunte manualmente)
      const phone = "5491126237532";
      const textsDescription = config.textElements.filter(el => el.text).map(el => el.text).join(", ") || "Sin texto";
      const message = `Hola! Quisiera pedir este modelo!%0A%0A*Detalles:*%0A- Textos: ${textsDescription}%0A- Color Principal: ${config.color}%0A- Color Dorso: ${config.secondaryColor}%0A%0ATe adjunto la imagen que acabo de descargar con el diseño.`;
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
          <div className="flex flex-col items-center gap-4 sm:gap-5 lg:sticky lg:top-4 lg:z-10 w-full bg-white pb-4 lg:pb-0">
            <div
              ref={previewRef}
              className="w-full bg-[#f7f7f7] border border-black/8 flex items-center justify-center p-4 sm:p-8 min-h-[220px] sm:min-h-[500px]"
            >
              <JerseyPreview
                config={config}
                className="w-full max-w-[520px]"
                onTextMove={handleTextMove}
                onSponsorMove={handleSponsorMove}
              />
            </div>
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

            {/* Step 3 — Shield */}
            <div className="order-first lg:order-none">
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
                        Subir escudo del club
                      </p>
                    </>
                  )}
                </label>
              ) : (
                <div className="flex items-center gap-3 border border-black/10 p-3 bg-black/[0.015]">
                  <div className="w-10 h-10 bg-white border border-black/8 flex items-center justify-center flex-shrink-0">
                    <img
                      src={config.shieldUrl}
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

            {/* Step 3b — Sponsors */}
            <div className="order-2 lg:order-none">
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3">
                Sponsors
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
                        className="flex flex-col items-center justify-center gap-2 border border-dashed border-black/20 p-4 cursor-pointer hover:border-black/50 hover:bg-black/[0.015] transition-all"
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
                            <p className="text-[11px] text-black/35">JPG o PNG · Fondo se elimina automáticamente</p>
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
                        {/* Font selector */}
                        <div className="relative flex-1">
                          <select
                            value={el.font}
                            onChange={(e) => handleUpdateText(el.id, { font: e.target.value as FontOption })}
                            className="w-full appearance-none rounded-none border border-black/20 bg-white px-3 py-1.5 text-[11px] outline-none focus-visible:border-black"
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
                              ].find(f => f.value === el.font)?.style
                            }}
                          >
                            <option value="arial-black">Arial Black</option>
                            <option value="impact">Impact</option>
                            <option value="bebas">Bebas Neue</option>
                            <option value="roboto">Roboto Condensed</option>
                            <option value="montserrat">Montserrat</option>
                            <option value="oswald">Oswald</option>
                            <option value="teko">Teko</option>
                            <option value="anton">Anton</option>
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
