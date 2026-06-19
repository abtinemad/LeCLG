import { motion } from "motion/react";
import { X, Sparkles } from "lucide-react";
import CollegueMark from "../CollegueMark";
import { LockedBlock } from "./CarnetPrimitives";

interface LueursEclatsModalProps {
  isLueursModalOpen: boolean;
  setIsLueursModalOpen: (open: boolean) => void;
  lueurs: any[];
  eclatList: any[];
  setReadingLueur: (l: any) => void;
  setReadingEclat: (e: any) => void;
  setIsEclatModalOpen: (open: boolean) => void;
}

// Modal "Lueurs & Éclats" (pile) — extrait verbatim de Carnet.tsx.
export function LueursEclatsModal({
  isLueursModalOpen,
  setIsLueursModalOpen,
  lueurs,
  eclatList,
  setReadingLueur,
  setReadingEclat,
  setIsEclatModalOpen,
}: LueursEclatsModalProps) {
  if (!isLueursModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsLueursModalOpen(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl p-10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-evolution/40" />
        <button
          onClick={() => setIsLueursModalOpen(false)}
          className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-beige-faint/40" />
        </button>

        <div className="mb-10 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles
              strokeWidth={1.5}
              className="w-5 h-5 text-evolution/40 shrink-0"
            />
            <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-evolution/40">
              Lueurs &amp; Éclats
            </div>
          </div>
          <p className="text-[11px] text-beige-faint/60 italic leading-relaxed">
            Pour éclairer les vides de votre Matrice.
          </p>
        </div>

        <div className="overflow-y-auto pr-2 custom-scrollbar pb-6">
          {lueurs.length > 0 ? (
            <div className="space-y-3">
              {lueurs.map((lueur, i) => (
                <button
                  key={i}
                  onClick={() => setReadingLueur(lueur)}
                  className="w-full text-left p-5 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-lg transition-colors group"
                >
                  <div className="font-mono text-[8px] uppercase tracking-widest text-beige/40 mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-beige/20" />
                      <span>{i === 0 ? "Dernière lueur" : "Lueur"}</span>
                    </span>
                    {lueur.date && (
                      <span className="text-beige/25 tracking-wider">
                        {new Date(lueur.date).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <div className="font-serif text-base text-beige/90 italic mb-1.5">
                    {lueur.title}
                  </div>
                  <p className="text-[13px] font-serif text-beige/70 leading-relaxed line-clamp-3">
                    {lueur.text}
                  </p>
                  <div className="mt-3 font-mono text-[7px] uppercase tracking-[0.25em] text-beige/30 group-hover:text-beige/50 transition-colors">
                    Lire en entier →
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="w-full max-w-sm mx-auto">
              <LockedBlock
                title="Lueurs"
                requirements="30 jours + Matrice dévoilée"
              />
            </div>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 flex-shrink-0 space-y-6">
          {eclatList.length > 0 ? (
            <div className="space-y-3">
              {eclatList.map((e, i) => (
                <button
                  key={e.id || i}
                  onClick={() => setReadingEclat(e)}
                  className="w-full text-left p-5 bg-white/5 hover:bg-white/[0.07] border border-white/10 rounded-lg transition-colors group"
                >
                  <div className="font-mono text-[8px] uppercase tracking-widest text-beige/40 mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <CollegueMark className="w-6 h-6 text-red/70" />
                      <span>{i === 0 ? "Dernier Éclat" : "Éclat"}</span>
                    </span>
                    {e.answered_at && (
                      <span className="text-beige/25 tracking-wider">
                        {new Date(e.answered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-serif italic text-beige/80 leading-relaxed line-clamp-3">
                    "{e.response_text}"
                  </p>
                  <div className="mt-3 font-mono text-[7px] uppercase tracking-[0.25em] text-beige/30 group-hover:text-beige/50 transition-colors">
                    Lire en entier →
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={() => setIsEclatModalOpen(true)}
                className="w-full py-3 bg-white/[0.02] hover:bg-white/5 border border-white/5 text-beige/40 hover:text-beige/60 font-mono text-[8px] tracking-[0.3em] uppercase rounded-full transition-all disabled:opacity-20"
              >
                Invoquer un Éclat
              </button>
              <div className="mt-3 font-mono text-[6px] text-beige/20 uppercase tracking-[0.2em] italic text-center">
                Métabolisation d'une demande par l'expérience humaine
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
