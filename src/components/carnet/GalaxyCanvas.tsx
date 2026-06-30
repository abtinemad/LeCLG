import { useRef, useEffect } from "react";
import {
  personalConstellation,
  CONSTELLATION_R0,
  type ConstellationCard,
  type ConstellationOpts,
} from "../../lib/personalConstellation";

// hex → rgb (repris de SerpentinCanvas) : parler en rgba comme le serpentin.
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full || "E8D5B0", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Réglages de rendu (lumière), distincts de la géométrie (σ/τ). Défauts pensés
 *  pour la modale réelle ; le simulateur les pilote par curseurs. */
export interface GalaxyRenderOpts {
  /** Multiplicateur d'éclat par point (1 = tel quel). Bas → seule la densité allume. */
  pointAlpha?: number;
  /** Rayon de halo par point en px (le flou qui fait « fondre » les amas). */
  pointGlow?: number;
}

const RENDER_DEFAULTS: Required<GalaxyRenderOpts> = {
  pointAlpha: 1,
  pointGlow: 5,
};

// Renderer canvas 2D. Lumière par DENSITÉ (composition additive `lighter`) :
// chaque point est un halo doux ; là où ça s'entasse — le cœur (récents) et le
// bord (vieux comprimés par la loi exp) — les halos s'additionnent et FONDENT en
// nappe. AUCUN bulbe ni cœur dessiné : le centre ÉMERGE de la concentration des
// astéroïdes récents (vide pour un débutant, bulbe lumineux pour un compte fourni)
// — « composition à partir des fragments », jamais une bille posée au milieu.
// Rendu STATIQUE (dessin une fois + au resize) — la Phase 2 (rotation) viendra ici.
export function GalaxyCanvas({
  cards,
  opts,
  render,
  className,
}: {
  cards: ConstellationCard[];
  opts?: ConstellationOpts;
  render?: GalaxyRenderOpts;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { points } = personalConstellation(cards, Date.now(), opts);
    const pointAlpha = render?.pointAlpha ?? RENDER_DEFAULTS.pointAlpha;
    const pointGlow = render?.pointGlow ?? RENDER_DEFAULTS.pointGlow;

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

      // Plancher radial simple : un rayon interne fixe pour que les tout premiers
      // récents ne s'effondrent pas au centre exact (singularité). Plus de halo
      // central à éviter → plus besoin du plancher dynamique d'avant.
      const innerPx = CONSTELLATION_R0 * Rpx;
      const span01 = 1 - CONSTELLATION_R0;

      // Astéroïdes — composition ADDITIVE : les halos s'additionnent. Au cœur, les
      // récents se concentrent et FORMENT le bulbe (émergent) ; au bord, les vieux
      // s'entassent et fondent en nappe d'amas. Halo doux, jamais d'aplat dur.
      ctx.globalCompositeOperation = "lighter";
      for (const p of points) {
        const rNorm = (p.r - CONSTELLATION_R0) / span01;
        const rPx = innerPx + (Rpx - innerPx) * rNorm;
        const x = cx + rPx * Math.cos(p.theta);
        const y = cy + rPx * Math.sin(p.theta);
        const [r, g, b] = hexToRgb(p.color);
        const a = p.alpha * pointAlpha;
        const glowR = pointGlow * (0.5 + p.size);
        const halo = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        halo.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [cards, opts, render]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "absolute inset-0 w-full h-full"}
    />
  );
}
