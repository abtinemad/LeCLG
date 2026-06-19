import { motion } from "motion/react";
import { X, RotateCw } from "lucide-react";
import type { ReflectionCard } from "../../data/emotions";

interface ResumeModalProps {
  resumeConfirm: ReflectionCard | null;
  setResumeConfirm: (card: ReflectionCard | null) => void;
  resumeFragment: (card: ReflectionCard) => void;
}

// Modal "Reprendre cette réflexion ?" — extrait verbatim de Carnet.tsx.
export function ResumeModal({
  resumeConfirm,
  setResumeConfirm,
  resumeFragment,
}: ResumeModalProps) {
  if (!resumeConfirm) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setResumeConfirm(null)}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-[#0a0a0a] border border-beige-faint/20 rounded-2xl p-8 shadow-2xl"
      >
        <button
          onClick={() => setResumeConfirm(null)}
          className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-beige-faint/40" />
        </button>

        <div className="text-center">
          <RotateCw className="w-9 h-9 text-beige-faint mx-auto mb-5" />
          <h3 className="text-xl font-serif italic text-beige mb-3">
            Reprendre cette réflexion ?
          </h3>
          <p className="text-[13px] text-beige-faint/80 leading-relaxed max-w-sm mx-auto">
            Allez au bout des cinq étapes pour déverrouiller le prisme : il décompose
            un faisceau complexe en rayons distincts, perceptibles et analysables —
            un signe de clairvoyance sur le mouvement en cours.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 mt-8">
          <button
            onClick={() => {
              const card = resumeConfirm;
              setResumeConfirm(null);
              if (card) resumeFragment(card);
            }}
            className="w-full text-center font-mono text-[11px] tracking-widest uppercase text-bg bg-beige px-8 py-3.5 rounded-sm hover:opacity-85 transition-opacity"
          >
            Reprendre
          </button>
          <button
            onClick={() => setResumeConfirm(null)}
            className="w-full text-center font-mono text-[11px] tracking-widest uppercase text-beige-faint border border-beige-faint/20 px-8 py-3 rounded-sm hover:text-beige-dim hover:border-beige-faint/40 transition-colors"
          >
            Plus tard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
