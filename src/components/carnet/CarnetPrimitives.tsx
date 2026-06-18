import { useState, type ReactNode } from "react";
import { motion } from "motion/react";

// Affiché à la place du spinner quand une analyse a définitivement échoué.
// Ton accordé à LockedBlock / au « pas encore métabolisée » — discret,
// surtout pas un bandeau d'alerte.
export const AnalysisError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="text-center py-20">
    <p className="font-serif italic text-beige-faint/70 leading-relaxed max-w-sm mx-auto mb-6">
      L'analyse n'a pas abouti. Le calcul n'a pas pu être mené jusqu'au bout.
    </p>
    <button
      onClick={onRetry}
      className="py-2 px-6 rounded-full border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] font-mono text-[9px] uppercase tracking-widest text-beige/50 hover:text-beige/70 transition-colors"
    >
      Réessayer
    </button>
  </div>
);

export function LienSphereDeck({ cards }: { cards: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const n = cards.length;
  if (n === 0) return null;
  const idx = Math.min(active, n - 1);
  const go = (dir: number) => setActive((a) => (Math.min(a, n - 1) + dir + n) % n);
  return (
    <div className="md:hidden max-w-sm mx-auto w-full">
      <div className="relative">
        {n - 1 - idx >= 2 && (
          <div className="absolute inset-0 rounded-lg bg-[#1a1814] border border-white/10 pointer-events-none" style={{ transform: "translateY(8px) rotate(-5deg)", zIndex: 0 }} />
        )}
        {n - 1 - idx >= 1 && (
          <div className="absolute inset-0 rounded-lg bg-[#1a1814] border border-white/10 pointer-events-none" style={{ transform: "translateY(4px) rotate(4deg)", zIndex: 1 }} />
        )}
        <div className="absolute inset-0 rounded-lg bg-[#1a1814] pointer-events-none" style={{ zIndex: 2 }} />
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 28, rotate: -1.5 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", zIndex: 3, touchAction: "pan-y" }}
          drag={n > 1 ? "x" : false}
          dragSnapToOrigin
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (n <= 1) return;
            if (info.offset.x <= -60) go(1);
            else if (info.offset.x >= 60) go(-1);
          }}
        >
          {cards[idx]}
        </motion.div>
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-5 mt-4">
          <button onClick={() => go(-1)} className="font-mono text-[15px] leading-none text-beige-faint hover:text-beige transition-colors px-2" aria-label="précédent">‹</button>
          <span className="font-mono text-[9px] tracking-widest text-beige-faint/60">{idx + 1} / {n}</span>
          <button onClick={() => go(1)} className="font-mono text-[15px] leading-none text-beige-faint hover:text-beige transition-colors px-2" aria-label="suivant">›</button>
        </div>
      )}
    </div>
  );
}

export const LockedSection = ({
  title,
  requirements,
  icon: Icon,
}: {
  title: string;
  requirements: string;
  icon: any;
}) => (
  <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-up">
    <div className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center mb-6">
      <Icon className="w-6 h-6 text-beige/10" />
    </div>
    <h3 className="font-mono text-[11px] uppercase tracking-[0.4em] text-beige/40 mb-4">
      {title}
    </h3>
    <p className="font-serif italic text-beige-faint leading-relaxed max-w-sm mb-8">
      L'analyse n'est pas encore métabolisée. Elle nécessite une sédimentation
      plus profonde de votre vécu.
    </p>
    <div className="py-3 px-6 rounded-full border border-white/5 bg-black/20">
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#6BA368]">
        <span className="opacity-50">Condition : </span>
        {requirements}
      </div>
    </div>
  </div>
);

export const LockedBlock = ({ title, requirements }: { title: string; requirements: string }) => (
  <div className="flex flex-col items-center justify-center p-6 text-center border border-white/5 bg-white/[0.01] rounded-lg border-dashed">
    <div className="font-mono text-[9px] uppercase tracking-widest text-beige/30 mb-2">
      {title}
    </div>
    <div className="text-[8px] font-mono tracking-widest uppercase opacity-40">
      Requis : {requirements}
    </div>
  </div>
);
