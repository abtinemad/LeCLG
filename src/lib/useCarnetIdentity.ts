import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Identité Carnet : la Clé-LCLG (lecture seule depuis localStorage), son
// affichage/copie/QR depuis le header, et la déconnexion. personalId n'est
// jamais réécrit en session — c'est une valeur stable lue à l'init.
export function useCarnetIdentity() {
  const navigate = useNavigate();

  const [personalId] = useState(
    () => localStorage.getItem("collegue_personal_id") || "",
  );
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const copyKey = () => {
    if (!personalId) return;
    try {
      navigator.clipboard.writeText(personalId);
    } catch (e) {
      console.warn("copy failed", e);
    }
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("collegue_personal_id");
      localStorage.removeItem("collegue_access_code");
    } catch {
      /* ignore */
    }
    navigate("/");
  };

  return {
    personalId,
    showKey,
    setShowKey,
    keyCopied,
    copyKey,
    showQr,
    setShowQr,
    confirmLogout,
    setConfirmLogout,
    handleLogout,
  };
}
