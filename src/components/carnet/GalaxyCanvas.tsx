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
  /** Rayon de halo par point en px, AU CENTRE (net). */
  pointGlow?: number;
  /** Facteur de flou au bord : glow effectif = pointGlow·(0.3 + rNorm·edgeBlur).
   *  0 = flou constant ; grand = très diffus au bord, piqué au centre. */
  edgeBlur?: number;
}

const RENDER_DEFAULTS: Required<GalaxyRenderOpts> = {
  pointAlpha: 1,
  pointGlow: 4,
  edgeBlur: 3,
};

// Renderer canvas 2D. Lumière par DENSITÉ (composition additive `lighter`) :
// chaque astéroïde est un halo doux dont le rayon CROÎT avec la distance au
// centre — net au cœur, diffus au bord (où les vieux comprimés fondent en nappe).
// Le centre est un NOYAU rayonnant (le « vous-maintenant ») : halo coloré + cœur
// net. Sa couleur = la dominante émotionnelle vivante (core.color, crème seulement
// tant qu'il n'y a pas de dominante) — signifiante, jamais le crème figé.
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

    const { core, points } = personalConstellation(cards, Date.now(), opts);
    const pointAlpha = render?.pointAlpha ?? RENDER_DEFAULTS.pointAlpha;
    const pointGlow = render?.pointGlow ?? RENDER_DEFAULTS.pointGlow;
    const edgeBlur = render?.edgeBlur ?? RENDER_DEFAULTS.edgeBlur;

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
      const coreR = 4 + core.intensity * 7;
      const haloR = coreR * 3.5;

      // Plancher radial couplé au halo central : les points démarrent juste après
      // le noyau, jamais dedans (sinon ils naissent dans le halo et le brouillent).
      const innerPx = Math.max(CONSTELLATION_R0 * Rpx, haloR + 6);
      const span01 = 1 - CONSTELLATION_R0;

      // Astéroïdes — composition ADDITIVE. Halo dont le rayon croît avec rNorm :
      // net au centre, diffus au bord (fondu en nappe). Pas d'aplat dur.
      ctx.globalCompositeOperation = "lighter";
      for (const p of points) {
        const rNorm = (p.r - CONSTELLATION_R0) / span01; // [0,1] centre→bord
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

      // Noyau central (le « vous-maintenant ») : halo rayonnant + cœur net.
      // Couleur = dominante vivante (core.color). Posé APRÈS la nuée → non lavé.
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
      halo.addColorStop(0, `rgba(${cr},${cg},${cb},0.7)`);
      halo.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.3)`);
      halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.95)`;
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
