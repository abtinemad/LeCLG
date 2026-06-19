import { motion } from "motion/react";
import { X, Check, Heart } from "lucide-react";
import CollegueMark from "../CollegueMark";
import { PaymentWrapper } from "../PaymentModal";

interface EclatModalProps {
  isEclatModalOpen: boolean;
  setIsEclatModalOpen: (open: boolean) => void;
  eclatRequest: string;
  setEclatRequest: (r: string) => void;
  eclatStatus: "idle" | "sending" | "sent" | "error";
  setEclatStatus: (s: "idle" | "sending" | "sent" | "error") => void;
  handleEclatSubmit: () => void;
}

// Modal "Éclat" (invocation + formulaire) — extrait verbatim de Carnet.tsx.
export function EclatModal({
  isEclatModalOpen,
  setIsEclatModalOpen,
  eclatRequest,
  setEclatRequest,
  eclatStatus,
  setEclatStatus,
  handleEclatSubmit,
}: EclatModalProps) {
  if (!isEclatModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsEclatModalOpen(false)}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-[#0a0a0a] border border-evolution/20 rounded-2xl p-10 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-1 bg-red/50" />
        <button
          onClick={() => setIsEclatModalOpen(false)}
          className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-beige-faint/40" />
        </button>

        <div className="text-center mb-8">
          <CollegueMark className="w-14 h-14 text-red mx-auto mb-4" />
          <h3 className="text-xl font-serif text-beige mb-2 italic">
            L'Éclat
          </h3>
          <p className="text-xs text-beige-faint/60 leading-relaxed max-w-sm mx-auto italic mt-4">
            Votre Matrice et votre demande seront métabolisées par
            l'expérience humaine. Un acte ponctuel, rare et structurant.
          </p>
        </div>

        {eclatStatus === "sent" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green/5 border border-green/20 p-8 rounded-lg text-center"
          >
            <Check className="w-10 h-10 text-green mx-auto mb-4" />
            <p className="text-sm text-beige font-serif italic mb-4">
              Votre demande a été transmise pour métabolisation humaine.
            </p>
            <p className="text-[11px] text-beige-faint/40 font-mono uppercase tracking-widest italic leading-relaxed">
              Le temps de la métabolisation approche.
              <br />
              Une réponse vous sera remise sous peu.
            </p>
            <button
              onClick={() => setIsEclatModalOpen(false)}
              className="mt-8 px-6 py-2 border border-white/10 hover:border-white/20 text-beige/40 hover:text-beige/60 font-mono text-[8px] uppercase tracking-widest rounded-full transition-all"
            >
              Fermer
            </button>
          </motion.div>
        ) : eclatStatus === "error" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red/5 border border-red/20 p-8 rounded-lg text-center"
          >
            <p className="text-sm text-beige font-serif italic mb-4">
              Votre demande n'a pas pu être transmise.
            </p>
            <p className="text-[11px] text-beige-faint/40 font-mono uppercase tracking-widest italic leading-relaxed">
              Rien n'a été perdu de ce que vous avez écrit.
              <br />
              Vous pouvez réessayer.
            </p>
            <button
              onClick={() => setEclatStatus("idle")}
              className="mt-8 px-6 py-2 border border-white/10 hover:border-white/20 text-beige/40 hover:text-beige/60 font-mono text-[8px] uppercase tracking-widest rounded-full transition-all"
            >
              Réessayer
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-beige/30 ml-1">
                Votre question ou situation actuelle
              </label>
              <textarea
                value={eclatRequest}
                onChange={(e) => setEclatRequest(e.target.value)}
                placeholder="Formulez votre demande ici…"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-sm text-beige italic focus:border-evolution/40 outline-none transition-colors h-40 resize-none custom-scrollbar"
              />
            </div>

            <button
              onClick={handleEclatSubmit}
              disabled={!eclatRequest.trim() || eclatStatus === "sending"}
              className="w-full py-4 bg-evolution text-black font-mono text-[11px] tracking-[0.4em] uppercase rounded-xl hover:bg-evolution transition-all font-bold disabled:opacity-20"
            >
              {eclatStatus === "sending"
                ? "Transmission…"
                : "Envoyer la demande"}
            </button>

            {/* Don — discret, secondaire, sous l'action principale */}
            <div className="flex justify-center">
              <PaymentWrapper
                paypalUrl="https://www.paypal.com/donate/?business=REDACTED&item_name=Eclat+du+Coll%C3%A8gue&currency_code=EUR"
                title="Soutien"
                color="text-evolution"
                className="group inline-flex"
              >
                <div className="flex items-center gap-1.5 text-beige/25 group-hover:text-evolution/70 transition-colors">
                  <Heart className="w-3 h-3" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.25em]">
                    Soutenir
                  </span>
                </div>
              </PaymentWrapper>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
