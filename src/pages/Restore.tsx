import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Fingerprint } from "lucide-react";

// Page d'atterrissage du QR de transfert. Le QR encode
// `${origin}/restore#k=<clé>` : la clé arrive donc dans le FRAGMENT d'URL,
// jamais dans une query — elle ne part ni dans les logs serveur ni dans les
// params PostgREST. On la lit, on la retire de la barre d'adresse, et la
// personne saisit son code à 6 chiffres. Le QR seul ne déverrouille rien :
// le modèle `verify` (clé + code, avec lockout) reste intact.
export default function Restore() {
  const navigate = useNavigate();

  const keyFromHash = useMemo(() => {
    const h = window.location.hash.replace(/^#/, "");
    return (new URLSearchParams(h).get("k") || "").trim();
  }, []);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // La clé lue, on l'efface de la barre d'adresse (et de l'historique courant).
  useEffect(() => {
    if (keyFromHash) window.history.replaceState(null, "", "/restore");
  }, [keyFromHash]);

  const restore = async () => {
    if (!keyFromHash) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Code à 6 chiffres requis.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "verify",
          data: { personal_id: keyFromHash, code },
        }),
      });
      if (res.status === 200) {
        localStorage.setItem("collegue_personal_id", keyFromHash);
        localStorage.setItem("collegue_access_code", code);
        navigate("/carnet");
        return;
      }
      if (res.status === 423) {
        setError("Trop d'essais. Réessayez dans quelques minutes.");
      } else {
        setError("Clé ou code incorrect.");
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 text-beige-faint mb-5">
          <Fingerprint size={15} strokeWidth={1.5} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
            Retrouver mon carnet
          </span>
        </div>

        {keyFromHash ? (
          <div className="bg-[#0e0d08] border border-border rounded-md p-5 shadow-lg shadow-black/40">
            <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-beige-faint mb-2">
              Clé reconnue
            </div>
            <code className="block font-mono text-[12px] text-beige bg-[#161512] border border-border rounded px-2.5 py-1.5 break-all mb-4">
              {keyFromHash}
            </code>

            <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-beige-faint mb-2">
              Votre code
            </div>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") restore();
                }}
                placeholder="6 chiffres"
                className="flex-1 bg-[#161512] border border-border rounded text-base md:text-[12px] text-beige placeholder:text-beige-faint font-mono tracking-wide focus:outline-none px-2.5 py-1.5"
                id="restore-code"
              />
              <button
                onClick={restore}
                disabled={submitting}
                aria-label="Retrouver mon carnet"
                className="shrink-0 text-beige-faint hover:text-beige transition-colors p-2.5 disabled:opacity-40"
              >
                <ArrowRight size={16} />
              </button>
            </div>
            {error && <p className="text-[10px] text-red-400/80 mt-2.5">{error}</p>}
            <p className="text-[10px] text-beige-faint italic leading-relaxed mt-4">
              Le scan ne donne que la clé. Votre code reste connu de vous seul.
            </p>
          </div>
        ) : (
          <div className="bg-[#0e0d08] border border-border rounded-md p-5">
            <p className="text-[12px] text-beige-faint leading-relaxed mb-4">
              Aucune clé dans ce lien. Pour transférer un carnet, affichez le QR
              depuis l'appareil d'origine et scannez-le avec celui-ci.
            </p>
            <Link
              to="/"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-beige-faint hover:text-beige transition-colors"
            >
              Retour à l'accueil
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
