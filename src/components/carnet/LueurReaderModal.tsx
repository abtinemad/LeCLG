import { motion } from "motion/react";
import { X, Sparkles } from "lucide-react";
import { LueurVisual } from "../LueurVisual";

interface LueurReaderModalProps {
  readingLueur: any;
  setReadingLueur: (l: any) => void;
}

// Modal "Lecture d'une Lueur" — extrait verbatim de Carnet.tsx.
export function LueurReaderModal({
  readingLueur,
  setReadingLueur,
}: LueurReaderModalProps) {
  if (!readingLueur) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setReadingLueur(null)}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-[#0a0a0a] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-evolution/40" />
        <button
          onClick={() => setReadingLueur(null)}
          className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-beige-faint/40" />
        </button>
        <div className="px-10 pt-10 pb-5 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-beige/40">
              <Sparkles className="w-3.5 h-3.5 text-beige/30" />
              <span>Lueur</span>
            </div>
            {readingLueur.date && (
              <span className="font-mono text-[9px] tracking-wider text-beige/30">
                {new Date(readingLueur.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <div className="px-10 pb-10 overflow-y-auto custom-scrollbar">
          <div className="mb-6">
            <LueurVisual context={readingLueur.context} />
          </div>
          <div className="font-serif text-xl text-beige italic mb-3 text-center">
            {readingLueur.title}
          </div>
          <p className="text-[15px] font-serif text-beige-faint leading-loose whitespace-pre-wrap text-center">
            {readingLueur.text}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
