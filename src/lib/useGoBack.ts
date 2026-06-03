import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Retour « sûr » : ne revient en arrière que si l'on a déjà navigué à
// l'intérieur de l'app. React Router donne location.key, qui vaut "default"
// tant qu'on est sur la première entrée de session (arrivée directe, lien
// externe, rechargement) et change dès la première navigation interne.
//
// On NE peut PAS se fier à window.history.length : il compte toutes les
// entrées de l'onglet, y compris les pages visitées avant d'arriver sur le
// collègue — d'où le bug où « Retour » ramenait hors de l'app.
//
// Si aucune entrée interne n'existe, on retombe sur la Landing (ou le
// fallback fourni) : jamais en dehors du collègue.
export function useGoBack(fallback = "/") {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.key !== "default") navigate(-1);
    else navigate(fallback);
  }, [navigate, location.key, fallback]);
}
