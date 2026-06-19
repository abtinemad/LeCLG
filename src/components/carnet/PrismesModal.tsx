import { motion } from "motion/react";
import { X } from "lucide-react";
import { EMOTIONS, type ReflectionCard } from "../../data/emotions";
import PrismeIcon from "../PrismeIcon";

interface PrismesModalProps {
  isPrismesModalOpen: boolean;
  setIsPrismesModalOpen: (open: boolean) => void;
  prismesCount: number;
  cards: ReflectionCard[];
  selectedPrisme: string | null;
  setSelectedPrisme: (p: string | null) => void;
  prismeKey: (v?: string) => string;
}

// Modal "Prismes collectés" — extrait verbatim de Carnet.tsx.
export function PrismesModal({
  isPrismesModalOpen,
  setIsPrismesModalOpen,
  prismesCount,
  cards,
  selectedPrisme,
  setSelectedPrisme,
  prismeKey,
}: PrismesModalProps) {
  if (!isPrismesModalOpen) return null;

  const close = () => {
    setIsPrismesModalOpen(false);
    setSelectedPrisme(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden"
      >
        <div
          className="absolute top-0 inset-x-0 h-1 opacity-60"
          style={{ background: "linear-gradient(90deg, var(--color-heart), var(--color-clay), var(--color-ember), var(--color-green), var(--color-slate), var(--color-plum))" }}
        />
        <button
          onClick={close}
          className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-beige-faint/40" />
        </button>

        <div className="mb-8 text-center md:text-left">
          <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-beige-faint mb-2">
            Prismes Collectés
          </div>
          <div className="text-3xl font-serif text-beige">
            {prismesCount}
            <span className="text-beige/20">/{Object.keys(EMOTIONS).length}</span>
          </div>
          <p className="text-[11px] text-beige-faint/70 italic leading-relaxed mt-2 max-w-sm mx-auto md:mx-0">
            Une lentille qui décompose ce que tu traverses pour le rendre lisible.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-8">
          {Object.entries(EMOTIONS).map(([key, em]) => {
            const foundCount = cards.filter((c) => prismeKey(c.prisme) === key).length;
            const isFound = foundCount > 0;
            return (
              <div
                key={key}
                className="flex flex-col items-center gap-1.5 relative"
              >
                <button
                  onClick={() => {
                    if (isFound) {
                      setSelectedPrisme(key);
                    }
                  }}
                  className={`relative aspect-square w-full flex items-center justify-center transition-all
                    ${isFound ? "cursor-pointer hover:scale-110" : "opacity-30 cursor-default"}`}
                  title={isFound ? em.label : "Prisme non découvert"}
                >
                  {isFound && foundCount >= 2 && (
                    <div className="absolute -top-1 -right-1 bg-white/10 text-beige/70 text-[6px] font-mono w-3 h-3 rounded-full flex items-center justify-center border border-white/20">
                      {foundCount}
                    </div>
                  )}
                  <PrismeIcon
                    rainbow={false}
                    color={isFound ? em.color : undefined}
                    strokeWidth={1.5}
                    className={`w-8 h-8 ${isFound ? "" : "text-beige/10"}`}
                  />
                </button>
                {isFound && (
                  <span className="font-mono text-[6px] uppercase tracking-tighter text-beige/20 text-center truncate w-full">
                    {em.label.split(" ")[0]}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {cards.length >= 15 && Object.keys(EMOTIONS).some(key => cards.filter((c) => prismeKey(c.prisme) === key).length === 0) && (
          <div className="text-center mb-8">
             <p className="font-mono text-[7px] italic text-beige/20">
               Certains signaux n'ont pas encore émergé. Ils peuvent être absents — ou chercher leur forme.
             </p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-[11px] font-mono leading-relaxed text-beige-faint/40 italic text-center">
            Cliquez sur un prisme pour en comprendre la clarté.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
