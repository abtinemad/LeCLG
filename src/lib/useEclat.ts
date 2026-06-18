import { useState, useEffect } from "react";
import { sbInsert, sendEclatReply } from "../lib/worker";

interface UseEclatArgs {
  personalId: string;
  matriceDataAnalysis: any;
  elanDataAnalysis: any;
  affectData: any;
  lienData: any;
}

// Boucle Éclat côté personne : envoi d'une demande (avec snapshot des analyses),
// lecture des Éclats répondus, et réponses de la personne. eclatList est hydraté
// depuis le cloud par loadCards (qui possède cards) via setEclatList exposé ici.
export function useEclat({
  personalId,
  matriceDataAnalysis,
  elanDataAnalysis,
  affectData,
  lienData,
}: UseEclatArgs) {
  const [eclatList, setEclatList] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem("collegue_eclats");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isEclatModalOpen, setIsEclatModalOpen] = useState(false);
  const [readingEclat, setReadingEclat] = useState<any | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState(false);
  const [eclatRequest, setEclatRequest] = useState("");
  const [eclatStatus, setEclatStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  const sendEclatRequest = async () => {
    if (!eclatRequest.trim()) return;
    setEclatStatus("sending");

    try {
      const payload = {
        type: "eclat",
        request_text: eclatRequest,
        matrice_snapshot: matriceDataAnalysis,
        elan_snapshot: elanDataAnalysis,
        affect_snapshot: affectData,
        lien_snapshot: lienData,
        created_at: new Date().toISOString(),
        personal_id: personalId,
      };

      // We use sbInsert to save it to a table named 'eclats'
      await sbInsert("eclats", payload);
      setEclatStatus("sent");
      setEclatRequest("");
    } catch (e) {
      console.error("Failed to send eclat:", e);
      // En cas d'échec, on le dit à la personne : l'Éclat est un geste
      // investi, lui afficher « envoyé » à tort lui ferait perdre sa demande
      // sans le savoir. Statut d'erreur -> elle peut réessayer.
      setEclatStatus("error");
    }
  };

  const handleEclatSubmit = () => {
    sendEclatRequest();
  };

  // Envoi d'une réponse de la personne à un Éclat. Passe par le handler
  // serveur dédié, qui vérifie l'appartenance et l'état de clôture.
  const sendReply = async () => {
    if (!readingEclat || !replyDraft.trim() || replySending) return;
    setReplySending(true);
    setReplyError(false);
    try {
      const result = await sendEclatReply(
        readingEclat.id,
        personalId,
        replyDraft.trim(),
      );
      const newReplies =
        result && Array.isArray(result.replies) ? result.replies : [];
      // Met à jour la modale, la pile, et le cache localStorage.
      setReadingEclat({ ...readingEclat, replies: newReplies });
      setEclatList((prev) => {
        const next = prev.map((e) =>
          e.id === readingEclat.id ? { ...e, replies: newReplies } : e,
        );
        localStorage.setItem("collegue_eclats", JSON.stringify(next));
        return next;
      });
      setReplyDraft("");
    } catch (e) {
      setReplyError(true);
    } finally {
      setReplySending(false);
    }
  };

  // Vider la zone d'écriture quand la modale Éclat se ferme.
  useEffect(() => {
    if (!readingEclat) {
      setReplyDraft("");
      setReplyError(false);
    }
  }, [readingEclat]);

  return {
    eclatList,
    setEclatList,
    isEclatModalOpen,
    setIsEclatModalOpen,
    readingEclat,
    setReadingEclat,
    replyDraft,
    setReplyDraft,
    replySending,
    replyError,
    eclatRequest,
    setEclatRequest,
    eclatStatus,
    setEclatStatus,
    sendEclatRequest,
    handleEclatSubmit,
    sendReply,
  };
}
