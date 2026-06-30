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
  pointAlpha?: number;
  pointGlow?: number;
  edgeBlur?: number;
  coreScale?: number;
  rotationPeriodS?: number;
  spiralTurns?: number;
  /** Opacité des fils reliant les points d'une même sphère (0 = aucun fil). */
  armThread?: number;
}

const RENDER_DEFAULTS: Required<GalaxyRenderOpts> = {
  pointAlpha: 1,
  pointGlow: 4,
  edgeBlur: 3,
  coreScale: 22,
  rotationPeriodS: 120,
  spiralTurns: 1,
  armThread: 1,
};

const DEPLOY_MS = 2500; // durée de la naissance (déploiement des astéroïdes)

// Renderer canvas 2D ANIMÉ. Naissance spiralée depuis le centre puis rotation
// RIGIDE lente. Les 4 SPHÈRES sont rendues lisibles par CONNEXITÉ : un fil ténu
// relie, dans chaque sphère, les points triés par rayon (le fil du temps,
// centre→bord) → 4 gerbes distinctes, malgré la couleur (émotion) qui varie dans
// chaque bras. Lumière par densité additive ; noyau = source vivante (couleur =
// dominante, taille/intensité = radiance/XP). Respecte prefers-reduced-motion.
// Phase 2b (profondeur, torsion, traînées) viendra ici.
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

  useEffect(() => {
    renderRef.current = {
      pointAlpha: render?.pointAlpha ?? RENDER_DEFAULTS.pointAlpha,
      pointGlow: render?.pointGlow ?? RENDER_DEFAULTS.pointGlow,
      edgeBlur: render?.edgeBlur ?? RENDER_DEFAULTS.edgeBlur,
      coreScale: render?.coreScale ?? RENDER_DEFAULTS.coreScale,
      rotationPeriodS: render?.rotationPeriodS ?? RENDER_DEFAULTS.rotationPeriodS,
      spiralTurns: render?.spiralTurns ?? RENDER_DEFAULTS.spiralTurns,
      armThread: render?.armThread ?? RENDER_DEFAULTS.armThread,
    };
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { core, points, radiance } = personalConstellation(cards, Date.now(), opts);
    const [cr, cg, cb] = hexToRgb(core.color);
    const span01 = 1 - CONSTELLATION_R0;

    // Groupement par sphère, trié par rayon — STATIQUE (arm et r fixes) : calculé
    // une fois, pas par frame. Sert à tracer les fils de connexité.
    const arms = new Map<number, number[]>();
    points.forEach((p, idx) => {
      if (p.arm === null) return;
      const arr = arms.get(p.arm);
      if (arr) arr.push(idx);
      else arms.set(p.arm, [idx]);
    });
    for (const arr of arms.values()) arr.sort((a, b) => points[a].r - points[b].r);

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

    // Position animée d'un point (naissance spiralée + rotation rigide).
    const posOf = (
      rNorm: number,
      thetaBase: number,
      innerPx: number,
      deployG: number,
      rot: number,
      spiralTurns: number,
    ): [number, number, number] => {
      const rPxFinal = innerPx + (Rpx - innerPx) * rNorm;
      const localDur = 0.45 + rNorm * 0.55;
      const pp = clamp01(deployG / localDur);
      const ease = 1 - Math.pow(1 - pp, 3);
      const rPx = rPxFinal * ease;
      const spiral = spiralTurns * (1 - pp) * Math.PI * 2;
      const theta = thetaBase + spiral + rot;
      return [cx + rPx * Math.cos(theta), cy + rPx * Math.sin(theta), pp];
    };

    const frame = (elapsed: number) => {
      const rp = renderRef.current;
      ctx.clearRect(0, 0, cssW, cssH);

      const coreR = 4 + radiance * rp.coreScale;
      const haloR = coreR * 3.5;
      const innerPx = Math.max(CONSTELLATION_R0 * Rpx, haloR + 6);
      const deployG = reduce ? 1 : clamp01(elapsed / DEPLOY_MS);
      const rot =
        reduce || rp.rotationPeriodS <= 0
          ? 0
          : (elapsed / (rp.rotationPeriodS * 1000)) * Math.PI * 2;

      // Fils de connexité par sphère — tracés EN DESSOUS des points. Ténus : la
      // connexité regroupe sans rivaliser avec la couleur des points (émotion).
      if (rp.armThread > 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(190,200,220,${(0.12 * rp.armThread).toFixed(3)})`;
        for (const idxs of arms.values()) {
          ctx.beginPath();
          let started = false;
          for (const idx of idxs) {
            const p = points[idx];
            const rNorm = (p.r - CONSTELLATION_R0) / span01;
            const [x, y, pp] = posOf(rNorm, p.theta, innerPx, deployG, rot, rp.spiralTurns);
            if (pp <= 0) continue; // pas encore né
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // Astéroïdes — additif, halo croissant vers le bord.
      ctx.globalCompositeOperation = "lighter";
      for (const p of points) {
        const rNorm = (p.r - CONSTELLATION_R0) / span01;
        const [x, y, pp] = posOf(rNorm, p.theta, innerPx, deployG, rot, rp.spiralTurns);
        const ease = 1 - Math.pow(1 - pp, 3);
        const [r, g, b] = hexToRgb(p.color);
        const a = p.alpha * rp.pointAlpha * ease;
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
        frame(elapsed);
        staticDrawn = true;
      }
      if (reduce) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      setup();
      staticDrawn = false;
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
