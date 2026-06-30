import { useRef, useEffect } from "react";
import {
  personalConstellation,
  CONSTELLATION_R0,
  type ConstellationCard,
  type ConstellationOpts,
} from "../../lib/personalConstellation";

// Renderer canvas 2D de la galaxie — EXTRAIT verbatim de GalaxyModal pour être
// réutilisable (modale réelle + simulateur de réglage). Le corps de `draw` est
// byte-identique à l'original : aucun changement de rendu, seulement la
// réutilisabilité (cards + opts injectables). Rendu STATIQUE (dessin une fois +
// au resize), aucune animation — la Phase 2 viendra ici.
export function GalaxyCanvas({
  cards,
  opts,
  className,
}: {
  cards: ConstellationCard[];
  opts?: ConstellationOpts;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { core, points } = personalConstellation(cards, Date.now(), opts);

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
  }, [cards, opts]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "absolute inset-0 w-full h-full"}
    />
  );
}
