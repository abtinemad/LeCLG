import { useEffect, useRef } from 'react';

/**
 * Serpentin — version autonome et calme du serpentin de la conversation.
 *
 * C'est une copie simplifiée de l'animation <canvas> de Chat.tsx : une onde
 * douce multi-harmonique parcourue de deux comètes, avec un flash quand elles
 * se croisent. Toute la physique liée à une conversation (montée d'intensité,
 * apaisement progressif, chaos, arc-en-ciel) a été retirée : ce serpentin
 * ondule, c'est tout — il ne dépend de rien.
 *
 * Le serpentin de Chat.tsx, lui, réagit à la conversation : c'est un code
 * séparé, laissé intact. Les deux ne partagent volontairement rien, pour
 * qu'un changement ici ne puisse jamais toucher la conversation.
 */

interface SerpentinLevel {
  amplitude: number;
  speed: number;
  opacity: number;
  thickness: number;
}

// Mêmes valeurs que les FLOW_LEVELS de Chat.tsx (0 = quasi plat, 3 = ample).
const LEVELS: SerpentinLevel[] = [
  { amplitude: 1.5, speed: 0.005, opacity: 0.28, thickness: 1.0 },
  { amplitude: 5.0, speed: 0.014, opacity: 0.48, thickness: 1.4 },
  { amplitude: 10.0, speed: 0.028, opacity: 0.65, thickness: 1.8 },
  { amplitude: 16.0, speed: 0.048, opacity: 0.85, thickness: 2.2 },
];

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full || 'E8D5B0', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface SerpentinCanvasProps {
  /** Couleur d'accent (hex). Défaut : le beige du Collègue. */
  color?: string;
  /** Niveau d'ondulation, 0 à 3 (0 = quasi plat, 3 = ample). Défaut : 1. */
  level?: number;
  /** Classes du conteneur — sert à le positionner (ex. "absolute inset-0"). */
  className?: string;
}

export const SerpentinCanvas = ({
  color = '#E8D5B0',
  level = 1,
  className = '',
}: SerpentinCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lvl = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, Math.round(level)))];
    const [r, g, b] = hexToRgb(color);

    let phase = 0;
    let cometX = 0;
    let cometX2 = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth || 1;
      canvas.height = canvas.offsetHeight || 44;
      cometX = canvas.width / 2;
      cometX2 = canvas.width / 2;
    };
    resize();
    window.addEventListener('resize', resize);

    // Onde de base : somme de sinusoïdes, avec une lente respiration d'amplitude.
    const sineY = (x: number, amp: number, ph: number, H: number, W: number): number => {
      const safeAmp = Math.min(amp, (H / 2 - 2) / 1.4);
      const f = (1 / W) * Math.PI * 2;
      const breathe = 1 + 0.22 * Math.sin(ph * 0.13 + 1.7);
      const a = safeAmp * breathe;
      return (
        H / 2 +
        a * 0.5 * Math.sin(x * f * 4.0 + ph * 1.0) +
        a * 0.28 * Math.sin(x * f * 6.47 + ph * 1.414) +
        a * 0.18 * Math.sin(x * f * 10.47 + ph * 0.618) +
        a * 0.11 * Math.sin(x * f * 16.18 + ph * 2.178) +
        a * 0.07 * Math.sin(x * f * 26.18 + ph * 0.414)
      );
    };
    const waveY = (x: number, amp: number, ph: number, H: number, W: number) =>
      sineY(x, amp, ph, H, W);
    const waveY2 = (x: number, amp: number, ph: number, H: number, W: number) =>
      sineY(x, amp * 0.75, ph + 1.6, H, W);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      if (!W) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const amp = lvl.amplitude;
      const thickness = lvl.thickness;
      const opacity = lvl.opacity;

      phase += lvl.speed;

      // Déplacement des comètes : l'une vers la droite, l'autre vers la gauche.
      const cometSpeed = 1.8 + lvl.speed * 80;
      cometX += cometSpeed;
      cometX2 -= cometSpeed * 0.85;
      if (cometX > W + 80) cometX = -80;
      if (cometX2 < -80) cometX2 = W + 80;

      ctx.clearRect(0, 0, W, H);

      // Rail — onde de fond, très discrète.
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},0.10)`;
      ctx.lineWidth = thickness * 0.6;
      for (let x = 0; x <= W; x++) {
        const y = waveY(x, amp, phase, H, W);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Onde 2 — légèrement déphasée.
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},0.16)`;
      ctx.lineWidth = thickness * 0.5;
      for (let x = 0; x <= W; x++) {
        const y = waveY2(x, amp, phase, H, W);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const trailLen = Math.round(70 + amp * 5);

      // Comète 1 — traîne puis tête.
      const t1s = Math.max(0, Math.round(cometX - trailLen));
      const t1e = Math.min(W, Math.round(cometX));
      if (t1e > t1s) {
        const grad = ctx.createLinearGradient(t1s, 0, t1e, 0);
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},${(opacity * 0.85).toFixed(2)})`);
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = thickness;
        for (let x = t1s; x <= t1e; x++) {
          const y = waveY(x, amp, phase, H, W);
          if (x === t1s) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (cometX >= 0 && cometX <= W) {
        const hy = waveY(cometX, amp, phase, H, W);
        const glowR = 2.5 + amp * 0.25;
        const halo = ctx.createRadialGradient(cometX, hy, 0, cometX, hy, glowR * 3.5);
        halo.addColorStop(0, `rgba(${r},${g},${b},${(opacity * 0.55).toFixed(2)})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.fillStyle = halo;
        ctx.arc(cometX, hy, glowR * 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r},${g},${b},${opacity.toFixed(2)})`;
        ctx.arc(cometX, hy, glowR * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      // Comète 2 — plus discrète, sur l'onde déphasée.
      const op2 = opacity * 0.38;
      const t2s = Math.min(W, Math.round(cometX2));
      const t2e = Math.min(W, Math.round(cometX2 + trailLen));
      if (t2e > t2s) {
        const grad2 = ctx.createLinearGradient(t2s, 0, t2e, 0);
        grad2.addColorStop(0, `rgba(${r},${g},${b},${(op2 * 0.85).toFixed(2)})`);
        grad2.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.strokeStyle = grad2;
        ctx.lineWidth = thickness * 0.8;
        for (let x = t2s; x <= t2e; x++) {
          const y = waveY2(x, amp, phase, H, W);
          if (x === t2s) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (cometX2 >= 0 && cometX2 <= W) {
        const hy2 = waveY2(cometX2, amp, phase, H, W);
        const glowR2 = 1.8 + amp * 0.15;
        const halo2 = ctx.createRadialGradient(cometX2, hy2, 0, cometX2, hy2, glowR2 * 3);
        halo2.addColorStop(0, `rgba(${r},${g},${b},${(op2 * 0.5).toFixed(2)})`);
        halo2.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.fillStyle = halo2;
        ctx.arc(cometX2, hy2, glowR2 * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r},${g},${b},${op2.toFixed(2)})`;
        ctx.arc(cometX2, hy2, glowR2 * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flash quand les deux comètes se croisent.
      const dist = Math.abs(cometX - cometX2);
      if (dist < 30 && cometX >= 0 && cometX <= W && cometX2 >= 0 && cometX2 <= W) {
        const cx = (cometX + cometX2) / 2;
        const cy = (waveY(cx, amp, phase, H, W) + waveY2(cx, amp, phase, H, W)) / 2;
        const flashAlpha = (1 - dist / 30) * opacity * 0.7;
        const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
        flash.addColorStop(0, `rgba(${r},${g},${b},${flashAlpha.toFixed(2)})`);
        flash.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.fillStyle = flash;
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [color, level]);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
