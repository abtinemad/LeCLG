import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import type { ReflectionCard } from "../../data/emotions";
import { personalConstellation, CONSTELLATION_R0 } from "../../lib/personalConstellation";

interface GalaxyEntryProps {
  cards: ReflectionCard[];
}

// Modale « Galaxie personnelle » — renderer canvas 2D ISOLÉ (galaxie de face),
// distinct du serpentin du Chat (sinusoïde de profil) : aucun moteur partagé.
// Phase 1 : rendu STATIQUE (dessin une fois + au resize), aucune animation.
function GalaxyModal({
  cards,
  onClose,
}: {
  cards: ReflectionCard[];
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { core, points } = personalConstellation(cards);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || 1;
      const cssH = canvas.clientHeight || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const cx = cssW / 2;
      const cy = cssH / 2;
      const Rpx = (Math.min(cssW, cssH) / 2) * 0.92;

      // Comète centrale : rayon + halo (le halo grandit avec la puissance).
      const coreR = 4 + core.intensity * 7;
      const haloR = coreR * 3.2;

      // Plancher radial DYNAMIQUE : les points démarrent juste APRÈS le halo,
      // jamais dedans. Couplé au halo (≠ fraction fixe) → un compte fourni
      // (grosse comète, gros halo) ne noie plus ses points récents dans le cœur.
      const innerPx = Math.max(CONSTELLATION_R0 * Rpx, haloR + 6);
      const span01 = 1 - CONSTELLATION_R0;

      // Points discrets — PAS de halo (l'anti-bouillie : séparés par rayon ET angle).
      for (const p of points) {
        const rNorm = (p.r - CONSTELLATION_R0) / span01; // [R0,1] → [0,1]
        const rPx = innerPx + (Rpx - innerPx) * rNorm;
        const x = cx + rPx * Math.cos(p.theta);
        const y = cy + rPx * Math.sin(p.theta);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + p.size * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Comète centrale (le soi-maintenant). Halo permis ICI seulement.
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
      grad.addColorStop(0, core.color);
      grad.addColorStop(0.35, core.color + "AA");
      grad.addColorStop(1, core.color + "00");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = core.color;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [cards]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-2xl bg-[#070707] border border-matrice/20 rounded-2xl p-6 md:p-8 shadow-2xl overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-beige-faint/40" />
        </button>
        <div className="text-center mb-4">
          <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-matrice/80 italic">
            Galaxie personnelle
          </div>
        </div>
        <div className="relative w-full aspect-square max-h-[70vh] mx-auto">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>
        <p className="mt-4 text-center font-serif text-[11px] italic text-beige-faint/50 leading-relaxed max-w-md mx-auto">
          Au centre, vous, maintenant. Autour, ce que vous avez traversé — plus
          c'est loin, plus c'est ancien.
        </p>
      </motion.div>
    </div>
  );
}

export function GalaxyEntry({ cards }: GalaxyEntryProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 py-2 px-6 bg-matrice/5 hover:bg-matrice/10 border border-matrice/20 text-matrice/80 hover:text-matrice font-mono text-[9px] tracking-[0.3em] uppercase rounded-full transition-all"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="flex flex-col items-center gap-0.5">
          <span>Galaxie personnelle</span>
          <span className="font-serif text-[7px] lowercase italic opacity-40 normal-case tracking-normal">
            votre parcours, vu du dessus
          </span>
        </span>
      </button>
      {open && <GalaxyModal cards={cards} onClose={() => setOpen(false)} />}
    </>
  );
}
