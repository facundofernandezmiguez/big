"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const SESSION_KEY = "big-scroll-tip-dismissed";

export default function MobileSwipeTip() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(SESSION_KEY) === "true";
    if (wasDismissed) {
      setDismissed(true);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, "true");
    setTimeout(() => setDismissed(true), 300);
  };

  if (dismissed) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={handleDismiss}
    >
      <div
        className={`relative mx-6 max-w-xs bg-white border border-black/10 shadow-2xl p-5 transition-all duration-300 ${
          visible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-black/30 hover:text-black/60 transition-colors p-1"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scroll illustration */}
        <div className="flex items-center justify-center mb-3">
          <div className="relative flex items-center gap-6">
            {/* Left side indicator */}
            <div className="flex flex-col items-center gap-1">
              <svg className="w-5 h-5 text-black/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
              <div className="w-6 h-10 border-2 border-dashed border-black/15 rounded-sm" />
              <svg className="w-5 h-5 text-black/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M19 12l-7 7-7-7" />
              </svg>
            </div>

            {/* Preview box representation */}
            <div className="w-16 h-20 bg-[#f7f7f7] border border-black/15 flex items-center justify-center">
              <span className="text-[9px] text-black/30 font-medium">Preview</span>
            </div>

            {/* Right side indicator */}
            <div className="flex flex-col items-center gap-1">
              <svg className="w-5 h-5 text-black/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
              <div className="w-6 h-10 border-2 border-dashed border-black/15 rounded-sm" />
              <svg className="w-5 h-5 text-black/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M19 12l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <p className="text-center text-[13px] font-semibold text-black/80 leading-snug">
          Tocá fuera de la previsualización para desplazarte por la página
        </p>
        <p className="text-center text-[11px] text-black/40 mt-1.5">
          Deslizá arriba o abajo desde los costados
        </p>

        <button
          onClick={handleDismiss}
          className="mt-4 w-full bg-black text-white font-bold tracking-widest uppercase text-[11px] py-2.5 hover:bg-black/80 transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
