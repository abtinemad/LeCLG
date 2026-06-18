import { useState, useEffect } from "react";

// Notes Affect & Élan : champs courants + historiques archivés, persistés en
// localStorage. L'archivage (archiveAffectEvaluation / archiveElanEvaluation)
// reste dans Carnet car il dépend des getters d'analyse du composant ; ce hook
// ne possède que l'état et sa persistance.
export function useAffectElanNotes() {
  const [affectNote, setAffectNote] = useState(
    () => localStorage.getItem("collegue_affect_note") || "",
  );
  const [affectHistory, setAffectHistory] = useState<
    { date: string; note: string; analysis: string }[]
  >(() => JSON.parse(localStorage.getItem("collegue_affect_history") || "[]"));
  const [elanNarrative, setElanNarrative] = useState(
    () => localStorage.getItem("collegue_elan_narrative") || "",
  );
  const [userNote, setUserNote] = useState(
    () => localStorage.getItem("collegue_user_note") || "",
  );
  const [elanHistory, setElanHistory] = useState<
    { date: string; narrative: string; userNote: string }[]
  >(() => JSON.parse(localStorage.getItem("collegue_elan_history") || "[]"));

  // Nettoyage d'un ancien message Élan par défaut qui aurait été persisté.
  useEffect(() => {
    if (elanNarrative.includes("accumulation plus longue de fragments")) {
      setElanNarrative("");
    }
  }, [elanNarrative]);

  useEffect(() => {
    localStorage.setItem("collegue_affect_note", affectNote);
  }, [affectNote]);

  useEffect(() => {
    localStorage.setItem("collegue_affect_history", JSON.stringify(affectHistory));
  }, [affectHistory]);

  useEffect(() => {
    localStorage.setItem("collegue_elan_narrative", elanNarrative);
  }, [elanNarrative]);

  useEffect(() => {
    localStorage.setItem("collegue_user_note", userNote);
  }, [userNote]);

  useEffect(() => {
    localStorage.setItem("collegue_elan_history", JSON.stringify(elanHistory));
  }, [elanHistory]);

  return {
    affectNote,
    setAffectNote,
    affectHistory,
    setAffectHistory,
    elanNarrative,
    setElanNarrative,
    userNote,
    setUserNote,
    elanHistory,
    setElanHistory,
  };
}
