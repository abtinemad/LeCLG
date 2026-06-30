import { useRef, useEffect } from "react";
import {
  personalConstellation,
  CONSTELLATION_R0,
  PRISME_TOTAL,
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
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/** Réglages de rendu (lumière + mouvement + profondeur), distincts de la géométrie (σ/τ). */
export interface GalaxyRenderOpts {
  pointAlpha?: number;
  pointGlow?: number;
  edgeBlur?: number;
  coreScale?: number;
  rotationPeriodS?: number;
  spiralTurns?: number;
  armThread?: number;
  tiltDeg?: number;
  twistTurns?: number;
  /** Recul angulaire de la traînée des astéroïdes, en tours (0 = aucune traînée). */
  trailTurns?: number;
  /** Override de la diversité [0,1] (simulateur) ; null = diversité réelle calculée. */
  diversityOverride?: number | null;
  /** Override de l'or (simulateur) : null = condition réelle (16 prismes) ; true/false = forcé. */
  goldOverride?: boolean | null;
}

const RENDER_DEFAULTS: Required<GalaxyRenderOpts> = {
  pointAlpha: 1,
  pointGlow: 6,
  edgeBlur: 3,
  coreScale: 22,
  rotationPeriodS: 120,
  spiralTurns: 1,
  armThread: 1,
  tiltDeg: 55,
  twistTurns: 0.5,
  trailTurns: 0,
  diversityOverride: null,
  goldOverride: null,
};

const DEPLOY_MS = 2500;

// Renderer canvas 2D ANIMÉ, profondeur 2D simulée (disque incliné + tri en
// profondeur), torsion des bras, fils de connexité par sphère. NOYAU terminal :
// bulbe BOMBÉ (dégradé sphérique, couleur = dominante vivante, taille/intensité =
// radiance/XP) — reste circulaire (une sphère se projette en cercle). À 16 prismes
// découverts, une SUR-COURONNE dorée le nimbe (transparente au centre : la
// dominante reste visible — l'or s'ajoute, ne remplace pas). Respecte
// prefers-reduced-motion.
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
      tiltDeg: render?.tiltDeg ?? RENDER_DEFAULTS.tiltDeg,
      twistTurns: render?.twistTurns ?? RENDER_DEFAULTS.twistTurns,
      trailTurns: render?.trailTurns ?? RENDER_DEFAULTS.trailTurns,
      diversityOverride: render?.diversityOverride ?? null,
      goldOverride: render?.goldOverride ?? null,
    };
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { core, points, radiance, prismsUnlocked, diversity } = personalConstellation(cards, Date.now(), opts);
    const [cr, cg, cb] = hexToRgb(core.color);
    const span01 = 1 - CONSTELLATION_R0;

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

    interface P {
      rNorm: number;
      x: number;
      y: number;
      z: number;
      depthScale: number;
      depthAlpha: number;
      pp: number;
      ease: number;
    }

    const computeP = (
      rNorm: number,
      thetaBase: number,
      innerPx: number,
      deployG: number,
      rot: number,
      rp: Required<GalaxyRenderOpts>,
      flatten: number,
      sinTilt: number,
      twistTurnsEff: number,
    ): P => {
      const rPxFinal = innerPx + (Rpx - innerPx) * rNorm;
      const localDur = 0.45 + rNorm * 0.55;
      const pp = clamp01(deployG / localDur);
      const ease = 1 - Math.pow(1 - pp, 3);
      const rPx = rPxFinal * ease;
      const spiral = rp.spiralTurns * (1 - pp) * Math.PI * 2;
      const twist = rNorm * twistTurnsEff * Math.PI * 2;
      const theta = thetaBase + twist + spiral + rot;
      const xp = rPx * Math.cos(theta);
      const yp = rPx * Math.sin(theta);
      const z = -yp * sinTilt;
      const zNorm = z / Rpx;
      return {
        rNorm,
        x: cx + xp,
        y: cy + yp * flatten,
        z,
        depthScale: clamp(1 - zNorm * 0.45, 0.4, 1.7),
        depthAlpha: clamp01(1 - zNorm * 0.55),
        pp,
        ease,
      };
    };

    const frame = (elapsed: number) => {
      const rp = renderRef.current;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.globalCompositeOperation = "source-over";

      const coreR = 4 + radiance * rp.coreScale;
      const haloR = coreR * 3.5;
      const haloA0 = 0.35 + radiance * 0.45;
      const haloA1 = 0.15 + radiance * 0.25;
      const innerPx = Math.max(CONSTELLATION_R0 * Rpx, haloR + 6);
      const deployG = reduce ? 1 : clamp01(elapsed / DEPLOY_MS);
      const rot =
        reduce || rp.rotationPeriodS <= 0
          ? 0
          : (elapsed / (rp.rotationPeriodS * 1000)) * Math.PI * 2;
      const tilt = (rp.tiltDeg * Math.PI) / 180;
      const flatten = Math.cos(tilt);
      const sinTilt = Math.sin(tilt);
      const goldOn = rp.goldOverride !== null ? rp.goldOverride : prismsUnlocked >= PRISME_TOTAL;

      // Torsion pilotée par la diversité (intégration des domaines), plafonnée par twistTurns.
      const effDiversity = rp.diversityOverride !== null ? rp.diversityOverride : diversity;
      const twistTurnsEff = rp.twistTurns * effDiversity;
      const pos = points.map((p) =>
        computeP((p.r - CONSTELLATION_R0) / span01, p.theta, innerPx, deployG, rot, rp, flatten, sinTilt, twistTurnsEff),
      );

      // Traînée des astéroïdes : position reculée d'un angle dθ (même computeP, donc
      // suit l'ellipse inclinée et la torsion). Recalculée chaque frame (aucune
      // persistance du canvas) → centre net, pas de salissage. null si éteinte.
      const dTheta = rp.trailTurns * Math.PI * 2;
      const posBack =
        rp.trailTurns > 0
          ? points.map((p) =>
              computeP((p.r - CONSTELLATION_R0) / span01, p.theta, innerPx, deployG, rot - dTheta, rp, flatten, sinTilt, twistTurnsEff),
            )
          : null;

      if (rp.armThread > 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(190,200,220,${(0.12 * rp.armThread).toFixed(3)})`;
        for (const idxs of arms.values()) {
          ctx.beginPath();
          let started = false;
          for (const idx of idxs) {
            if (pos[idx].pp <= 0) continue;
            if (!started) {
              ctx.moveTo(pos[idx].x, pos[idx].y);
              started = true;
            } else ctx.lineTo(pos[idx].x, pos[idx].y);
          }
          ctx.stroke();
        }
      }

      const drawCore = () => {
        // Halo diffus (dominante) — rondeur lumineuse.
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
        halo.addColorStop(0, `rgba(${cr},${cg},${cb},${haloA0.toFixed(3)})`);
        halo.addColorStop(0.4, `rgba(${cr},${cg},${cb},${haloA1.toFixed(3)})`);
        halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Cœur BOMBÉ : point chaud quasi-blanc décalé → dominante → fondu, sans
        // bord dur → lit comme une sphère lumineuse, pas un disque plat.
        const cR = coreR * 1.6;
        const bulb = ctx.createRadialGradient(cx, cy - coreR * 0.25, 0, cx, cy, cR);
        bulb.addColorStop(0, `rgba(255,250,244,0.85)`);
        bulb.addColorStop(0.45, `rgba(${cr},${cg},${cb},${(0.6 + radiance * 0.3).toFixed(3)})`);
        bulb.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = bulb;
        ctx.beginPath();
        ctx.arc(cx, cy, cR, 0, Math.PI * 2);
        ctx.fill();

        // OR (16 prismes) : sur-couronne dorée, transparente au centre → la
        // dominante reste visible. Sur-impose, ne remplace pas.
        if (goldOn) {
          ctx.globalCompositeOperation = "lighter";
          const goldR = coreR * 2.0; // confiné au bulbe, pas à toute la galaxie
          const g = ctx.createRadialGradient(cx, cy, coreR * 0.6, cx, cy, goldR);
          g.addColorStop(0, "rgba(255,205,110,0)");
          g.addColorStop(0.5, "rgba(255,200,100,0.32)");
          g.addColorStop(1, "rgba(255,190,90,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, goldR, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = "rgba(255,212,120,0.6)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, coreR * 1.35, 0, Math.PI * 2);
          ctx.stroke();
        }
      };

      const order = points.map((_, i) => i).sort((a, b) => pos[b].z - pos[a].z);
      ctx.globalCompositeOperation = "lighter";
      let coreDrawn = false;
      for (const idx of order) {
        if (!coreDrawn && pos[idx].z < 0) {
          ctx.globalCompositeOperation = "source-over";
          drawCore();
          ctx.globalCompositeOperation = "lighter";
          coreDrawn = true;
        }
        const p = points[idx];
        const ps = pos[idx];
        const [r, g, b] = hexToRgb(p.color);
        const a = p.alpha * rp.pointAlpha * ps.ease * ps.depthAlpha;
        // Traînée flamboyante : trace couleur→transparent de la position reculée à
        // la tête, en additif (flambe à la superposition). Astéroïdes seulement
        // (arm ≠ null) → les étoiles de fond restent des points nets.
        if (posBack && p.arm !== null && ps.pp > 0) {
          const pb = posBack[idx];
          const aTrail = a * 0.55;
          const grad = ctx.createLinearGradient(pb.x, pb.y, ps.x, ps.y);
          grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
          grad.addColorStop(1, `rgba(${r},${g},${b},${aTrail.toFixed(3)})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = Math.max(0.6, (0.75 + p.size) * 0.9 * ps.depthScale);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(pb.x, pb.y);
          ctx.lineTo(ps.x, ps.y);
          ctx.stroke();
        }
        const glowR =
          rp.pointGlow * (0.45 + ps.rNorm * rp.edgeBlur) * (0.75 + p.size) * ps.depthScale;
        const gR = Math.max(0.1, glowR);
        const halo = ctx.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, gR);
        halo.addColorStop(0, `rgba(255,252,248,${a})`); // étincelle chaude → corps/volume (comme le bulbe)
        halo.addColorStop(0.18, `rgba(${r},${g},${b},${a})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(ps.x, ps.y, gR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      if (!coreDrawn) drawCore();
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
