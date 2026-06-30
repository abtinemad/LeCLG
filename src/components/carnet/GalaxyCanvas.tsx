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

/** Réglages de rendu (lumière), distincts de la géométrie (σ/τ). */
export interface GalaxyRenderOpts {
  /** Multiplicateur d'éclat par point (1 = tel quel). */
  pointAlpha?: number;
  /** Rayon de halo par point en px, au centre (net). */
  pointGlow?: number;
  /** Facteur de flou au bord : glow = pointGlow·(0.3 + rNorm·edgeBlur)·(0.6+size). */
  edgeBlur?: number;
  /** Plafond de rayonnement : px ajoutés au rayon du noyau à radiance=1 (l'XP « plus fort »). */
  coreScale?: number;
}

const RENDER_DEFAULTS: Required<GalaxyRenderOpts> = {
  pointAlpha: 1,
  pointGlow: 4,
  edgeBlur: 3,
  coreScale: 22,
};

// Renderer canvas 2D. Lumière par DENSITÉ (composition additive `lighter`) :
// halo doux par astéroïde, rayon croissant vers le bord (net au cœur, diffus au
// bord → nappe). Noyau central (le « vous-maintenant ») = halo rayonnant + cœur
// net, couleur = dominante vivante (core.color). Sa TAILLE et son INTENSITÉ
// suivent la RADIANCE (XP : volume × régularité) → il irradie de plus en plus
// fort à mesure qu'on pratique. Rendu STATIQUE — la Phase 2 (profondeur, rotation)
// viendra ici.
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

    const { core, points, radiance } = personalConstellation(cards, Date.now(), opts);
    const pointAlpha = render?.pointAlpha ?? RENDER_DEFAULTS.pointAlpha;
    const pointGlow = render?.pointGlow ?? RENDER_DEFAULTS.pointGlow;
    const edgeBlur = render?.edgeBlur ?? RENDER_DEFAULTS.edgeBlur;
    const coreScale = render?.coreScale ?? RENDER_DEFAULTS.coreScale;

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

      const [cr, cg, cb] = hexToRgb(core.color);
      // Taille du noyau pilotée par l'XP (radiance), pas par core.intensity.
      const coreR = 4 + radiance * coreScale;
      const haloR = coreR * 3.5;

      const innerPx = Math.max(CONSTELLATION_R0 * Rpx, haloR + 6);
      const span01 = 1 - CONSTELLATION_R0;

      // Astéroïdes — additif, halo croissant vers le bord.
      ctx.globalCompositeOperation = "lighter";
      for (const p of points) {
        const rNorm = (p.r - CONSTELLATION_R0) / span01;
        const rPx = innerPx + (Rpx - innerPx) * rNorm;
        const x = cx + rPx * Math.cos(p.theta);
        const y = cy + rPx * Math.sin(p.theta);
        const [r, g, b] = hexToRgb(p.color);
        const a = p.alpha * pointAlpha;
        const glowR = pointGlow * (0.3 + rNorm * edgeBlur) * (0.6 + p.size);
        const halo = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        halo.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // Noyau central : halo rayonnant + cœur net. Intensité ↑ avec la radiance.
      const haloA0 = 0.35 + radiance * 0.45;
      const haloA1 = 0.15 + radiance * 0.25;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
      halo.addColorStop(0, `rgba(${cr},${cg},${cb},${haloA0.toFixed(3)})`);
      halo.addColorStop(0.4, `rgba(${cr},${cg},${cb},${haloA1.toFixed(3)})`);
      halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.6 + radiance * 0.35).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();
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
