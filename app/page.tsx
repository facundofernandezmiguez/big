import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black font-sans flex flex-col">
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
            Personalizá tu indumentaria
          </span>
        </div>
      </header>

      {/* Announcement bar */}
      <div className="bg-black text-white text-center py-2.5">
        <p className="text-[11px] font-semibold tracking-[0.25em] uppercase">
          Elegí qué prenda querés personalizar
        </p>
      </div>

      {/* Hero / Intro */}
      <section className="max-w-6xl mx-auto px-6 pt-10 sm:pt-16 pb-6 sm:pb-10 text-center">
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight uppercase leading-[0.95]">
          Diseñá tu<br />
          indumentaria BIG
        </h1>
        <p className="mt-4 sm:mt-6 text-sm sm:text-base text-black/55 max-w-xl mx-auto">
          Elegí una prenda, sumá el escudo de tu club y personalizá cada detalle.
        </p>
      </section>

      {/* Options */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pb-12 sm:pb-20">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Musculosa reversible */}
          <Link
            href="/musculosa-reversible"
            className="group relative flex items-center justify-between gap-4 border border-black/15 bg-white px-5 sm:px-8 py-5 sm:py-7 hover:border-black hover:bg-black hover:text-white transition-all duration-200"
          >
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] uppercase text-black/40 group-hover:text-white/50 transition-colors flex-shrink-0">
                01
              </span>
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-black tracking-wider uppercase leading-tight">
                  Musculosa Reversible
                </h2>
                <p className="text-[11px] sm:text-xs text-black/50 group-hover:text-white/60 mt-1 tracking-wide">
                  Diseñá tu boceto: colores, escudos, sponsors y nombre.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Top y Calza */}
          <Link
            href="/top-calza"
            className="group relative flex items-center justify-between gap-4 border border-black/15 bg-white px-5 sm:px-8 py-5 sm:py-7 hover:border-black hover:bg-black hover:text-white transition-all duration-200"
          >
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.25em] uppercase text-black/40 group-hover:text-white/50 transition-colors flex-shrink-0">
                02
              </span>
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-black tracking-wider uppercase leading-tight">
                  Top y Calza
                </h2>
                <p className="text-[11px] sm:text-xs text-black/50 group-hover:text-white/60 mt-1 tracking-wide">
                  Elegí el color, sumá el escudo y el número de tu equipo.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/10">
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
