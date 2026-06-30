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

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Réglages de rendu (lumière + mouvement), distincts de la géométrie (σ/τ). */
export interface GalaxyRenderOpts {
  /** Multiplicateur d'éclat par point (1 = tel quel). */
  pointAlpha?: number;
  /** Rayon de halo par point en px, au centre (net). */
  pointGlow?: number;
  /** Facteur de flou au bord : glow = pointGlow·(0.3 + rNorm·edgeBlur)·(0.6+size). */
  edgeBlur?: number;
  /** Plafond de rayonnement : px ajoutés au rayon du noyau à radiance=1. */
  coreScale?: number;
  /** Période d'un tour complet du disque, en secondes (rotation rigide). 0 = figé. */
  rotationPeriodS?: number;
  /** Tours de spirale à la naissance (déploiement). 0 = trajet droit. */
  spiralTurns?: number;
}

const RENDER_DEFAULTS: Required<GalaxyRenderOpts> = {
  pointAlpha: 1,
  pointGlow: 4,
  edgeBlur: 3,
  coreScale: 22,
  rotationPeriodS: 120,
  spiralTurns: 1,
};

const DEPLOY_MS = 2500; // durée de la naissance (déploiement des astéroïdes)

// Renderer canvas 2D ANIMÉ. Au montage, les astéroïdes JAILLISSENT du centre en
// spirale (ils s'éloignent en tournant) puis se posent à leur rayon d'âge : le
// centre se peuple d'abord, le bord se complète en dernier. Ensuite, rotation
// RIGIDE lente du disque entier (angles relatifs préservés → les 4 sphères
// restent à leur quartier ; pas de winding problem). Lumière par densité additive
// (halo doux par point, flou croissant vers le bord). Noyau = source vivante
// (couleur = dominante, taille/intensité = radiance/XP). Respecte
// prefers-reduced-motion (→ rendu statique). La Phase 2b (profondeur, torsion,
// traînées) viendra ici.
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
  const renderRef = useRef<Required<GalaxyRenderOpts>>(RENDER_DEFAULTS);

  // Params lumière/mouvement : mis à jour SANS redémarrer la boucle (donc bouger
  // un curseur de lumière ou de vitesse ne re-déclenche pas la naissance).
  useEffect(() => {
    renderRef.current = {
      pointAlpha: render?.pointAlpha ?? RENDER_DEFAULTS.pointAlpha,
      pointGlow: render?.pointGlow ?? RENDER_DEFAULTS.pointGlow,
      edgeBlur: render?.edgeBlur ?? RENDER_DEFAULTS.edgeBlur,
      coreScale: render?.coreScale ?? RENDER_DEFAULTS.coreScale,
      rotationPeriodS: render?.rotationPeriodS ?? RENDER_DEFAULTS.rotationPeriodS,
      spiralTurns: render?.spiralTurns ?? RENDER_DEFAULTS.spiralTurns,
    };
  }, [render]);

  // Constellation + boucle d'animation. Re-naît seulement si cards/opts changent
  // (ou via remontage `key` côté simulateur — bouton « rejouer la naissance »).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { core, points, radiance } = personalConstellation(cards, Date.now(), opts);
    const [cr, cg, cb] = hexToRgb(core.color);
    const span01 = 1 - CONSTELLATION_R0;

    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cssW = 1, cssH = 1, cx = 0, cy = 0, Rpx = 1;
    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      cssW = canvas.clientWidth || 1;
      cssH = canvas.clientHeight || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = cssW / 2;
      cy = cssH / 2;
      Rpx = (Math.min(cssW, cssH) / 2) * 0.92;
    };
    setup();

    const frame = (elapsed: number) => {
      const rp = renderRef.current;
      ctx.clearRect(0, 0, cssW, cssH);

      const coreR = 4 + radiance * rp.coreScale;
      const haloR = coreR * 3.5;
      const innerPx = Math.max(CONSTELLATION_R0 * Rpx, haloR + 6);

      // Progression globale de la naissance [0,1]. reduce → posé d'emblée.
      const deployG = reduce ? 1 : clamp01(elapsed / DEPLOY_MS);
      // Rotation rigide (rad). reduce ou période nulle → pas de rotation.
      const rot =
        reduce || rp.rotationPeriodS <= 0
          ? 0
          : (elapsed / (rp.rotationPeriodS * 1000)) * Math.PI * 2;

      ctx.globalCompositeOperation = "lighter";
      for (const p of points) {
        const rNorm = (p.r - CONSTELLATION_R0) / span01; // nature du point (âge)
        const rPxFinal = innerPx + (Rpx - innerPx) * rNorm;
        // Même départ (centre), vitesse dégradée par la distance → le bord arrive
        // en dernier. ease-out : jaillit vite puis se pose.
        const localDur = 0.45 + rNorm * 0.55;
        const pp = clamp01(deployG / localDur);
        const ease = 1 - Math.pow(1 - pp, 3);
        const rPx = rPxFinal * ease;
        const spiral = rp.spiralTurns * (1 - pp) * Math.PI * 2; // se résorbe à l'arrivée
        const theta = p.theta + spiral + rot;
        const x = cx + rPx * Math.cos(theta);
        const y = cy + rPx * Math.sin(theta);
        const [r, g, b] = hexToRgb(p.color);
        const a = p.alpha * rp.pointAlpha * ease; // fade-in pendant la naissance
        const glowR = rp.pointGlow * (0.3 + rNorm * rp.edgeBlur) * (0.6 + p.size);
        const halo = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        halo.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // Noyau central : source présente dès t=0, les astéroïdes en jaillissent.
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

    let raf = 0;
    let t0 = 0;
    let staticDrawn = false;
    const loop = (ts: number) => {
      if (t0 === 0) t0 = ts;
      const elapsed = ts - t0;
      const rp = renderRef.current;
      const deploying = !reduce && elapsed < DEPLOY_MS;
      const rotating = !reduce && rp.rotationPeriodS > 0;
      if (deploying || rotating) {
        frame(elapsed);
        staticDrawn = false;
      } else if (!staticDrawn) {
        frame(elapsed); // une dernière frame à l'état posé
        staticDrawn = true;
      }
      if (reduce) return; // statique : une frame puis stop (le resize redessine)
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      setup();
      staticDrawn = false; // force un redraw
      if (reduce) frame(DEPLOY_MS);
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [cards, opts]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "absolute inset-0 w-full h-full"}
    />
  );
}
