import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import type { ReflectionCard } from "../../data/emotions";
import { GalaxyCanvas } from "./GalaxyCanvas";

interface GalaxyEntryProps {
  cards: ReflectionCard[];
}

// Modale « Galaxie personnelle » — vue contemplative du parcours, ouverte depuis
// la Matrice. Le rendu canvas vit dans <GalaxyCanvas> (réutilisé par le
// simulateur de réglage). Animé : naissance des astéroïdes depuis le centre +
// rotation rigide lente (Phase 2). Respecte prefers-reduced-motion.
function GalaxyModal({
  cards,
  onClose,
}: {
  cards: ReflectionCard[];
  onClose: () => void;
}) {
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
          <GalaxyCanvas cards={cards} />
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
