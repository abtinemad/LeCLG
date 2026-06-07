import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageCircle } from "lucide-react";
import { sbGet, sbInsert } from "../lib/worker";

interface RetourModalProps {
  open: boolean;
  onClose: () => void;
  personalId: string;
}

// Modale « Un retour » — un message libre adressé au collègue, avec la
// réponse éventuelle. Composant partagé : déclenché depuis le Carnet,
// l'écran de fin de séance et la Landing. Tout l'échange (le retour, et la
// réponse) vit ici. Sans Clé (cas possible sur la Landing), l'envoi reste
// possible mais l'historique et la réponse ne peuvent pas remonter.
export function RetourModal({ open, onClose, personalId }: RetourModalProps) {
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [myFeedbacks, setMyFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Charge les retours de la personne (ses messages + réponses éventuelles),
  // du plus récent au plus ancien. Sans Clé, rien à charger.
  const loadMyFeedbacks = async () => {
    if (!personalId) return;
    setLoading(true);
    try {
      const rows = await sbGet(
        "feedbacks",
        `personal_id=eq.${personalId}&order=created_at.desc`,
      );
      setMyFeedbacks(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("Failed to load feedbacks:", e);
    } finally {
      setLoading(false);
    }
  };

  // Envoi d'un retour. Le serveur écarte tout champ de réponse forgé. En cas
  // d'échec on le dit — le message écrit n'est pas perdu, on peut réessayer.
  const sendRetour = async () => {
    if (!draft.trim() || status === "sending") return;
    setStatus("sending");
    try {
      await sbInsert("feedbacks", {
        personal_id: personalId,
        message: draft.trim(),
        created_at: new Date().toISOString(),
      });
      setDraft("");
      setStatus("sent");
      loadMyFeedbacks();
    } catch (e) {
      console.error("Failed to send retour:", e);
      setStatus("error");
    }
  };

  // Charge à l'ouverture ; remet tout à zéro à la fermeture.
  useEffect(() => {
    if (open) {
      loadMyFeedbacks();
    } else {
      setStatus("idle");
      setDraft("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-[#0a0a0a] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-white/20" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5 text-beige-faint/40" />
            </button>

            <div className="px-10 pt-10 pb-2 flex-shrink-0 text-center">
              <MessageCircle className="w-7 h-7 text-beige/40 mx-auto mb-3" />
              <h3 className="text-lg font-serif text-beige mb-2 italic">
                Un retour
              </h3>
              <p className="text-[11px] text-beige-faint/60 leading-relaxed max-w-sm mx-auto italic">
                Une remarque sur l'outil ? Le collègue la lira.
              </p>
            </div>

            <div className="px-10 py-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (status === "sent" || status === "error")
                      setStatus("idle");
                  }}
                  placeholder="Votre retour…"
                  rows={4}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-beige italic focus:border-white/25 outline-none transition-colors resize-none custom-scrollbar"
                />
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-[8px] italic leading-relaxed">
                    {status === "error" ? (
                      <span className="text-red">
                        Échec de l'envoi — réessayer.
                      </span>
                    ) : status === "sent" ? (
                      <span className="text-green/70">Retour envoyé.</span>
                    ) : null}
                  </span>
                  <button
                    onClick={sendRetour}
                    disabled={!draft.trim() || status === "sending"}
                    className="flex-shrink-0 px-5 py-2 bg-white/90 text-black font-mono text-[8px] uppercase tracking-[0.2em] rounded-full hover:bg-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    {status === "sending" ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </div>

              {(loading || myFeedbacks.length > 0) && (
                <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
                  <div className="font-mono text-[7px] uppercase tracking-[0.25em] text-beige/25">
                    Vos retours
                  </div>
                  {loading && myFeedbacks.length === 0 ? (
                    <div className="text-[11px] text-beige/20 italic font-mono py-2">
                      Chargement…
                    </div>
                  ) : (
                    myFeedbacks.map((f) => (
                      <div
                        key={f.id}
                        className="p-4 rounded-lg bg-white/[0.03] border border-white/5"
                      >
                        <div className="font-mono text-[7px] uppercase tracking-[0.25em] text-beige/25 mb-2">
                          {f.created_at
                            ? new Date(f.created_at).toLocaleDateString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )
                            : ""}
                        </div>
                        <p className="text-[13px] font-serif text-beige/70 leading-relaxed whitespace-pre-wrap">
                          {f.message}
                        </p>
                        {f.response_text && (
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <div className="font-mono text-[7px] uppercase tracking-[0.25em] text-beige/30 mb-1.5">
                              Réponse du collègue
                            </div>
                            <p className="text-[13px] font-serif italic text-beige/85 leading-relaxed whitespace-pre-wrap">
                              {f.response_text}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}