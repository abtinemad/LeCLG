import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Share2, Unlink, Copy, Check, KeyRound, Users, Link2 } from 'lucide-react';
import Climat from './Climat';

const LS_SEL = 'collegue_epicentre';
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")";

export default function Epicentre() {
  const navigate = useNavigate();
  const location = useLocation();

  const personalId = (typeof window !== 'undefined' && localStorage.getItem('collegue_personal_id')) || '';
  const accessCode = (typeof window !== 'undefined' && localStorage.getItem('collegue_access_code')) || '';
  const hasKey = !!(personalId && accessCode);

  const [list, setList] = useState<{ code: string; members: number; label?: string | null }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingMine, setLoadingMine] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  // Appel générique du proxy worker, toujours signé clé + code.
  const call = useCallback(
    async (type: string, extra: any = {}) => {
      const res = await fetch('/api/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: { personal_id: personalId, code: accessCode, ...extra } }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || 'erreur');
      return d;
    },
    [personalId, accessCode],
  );

  const refreshMine = useCallback(async () => {
    const d = await call('epicentre_mine');
    const arr = Array.isArray(d?.epicentres) ? d.epicentres : [];
    setList(arr);
    return arr as { code: string; members: number; label?: string | null }[];
  }, [call]);

  // Montage : charger mes épicentres + traiter une éventuelle jonction par hash
  // (#<token> = cible du QR). Jonction interdite sans clé.
  useEffect(() => {
    if (!hasKey) {
      setLoadingMine(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const arr = await refreshMine();
        const hashToken = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
        let pending = '';
        try {
          pending = localStorage.getItem('collegue_epicentre_pending') || '';
        } catch {
          /* ignore */
        }
        const token = hashToken || pending;
        if (token) {
          try {
            await call('epicentre_join', { epicentre_code: token });
            await refreshMine();
            if (!cancelled) {
              setSelected(token);
              localStorage.setItem(LS_SEL, token);
              setNote('Tu as rejoint cet épicentre.');
            }
          } catch (e: any) {
            if (!cancelled) {
              setNote(
                e?.message === 'unknown_epicentre'
                  ? "Cet épicentre n'existe pas (ou plus)."
                  : 'Lien de jonction invalide.',
              );
            }
          }
          // Consommé : on efface le pending (succès comme échec) pour éviter toute
          // boucle de redirection, et on nettoie le hash.
          try {
            localStorage.removeItem('collegue_epicentre_pending');
          } catch {
            /* ignore */
          }
          window.history.replaceState(null, '', '/epicentre');
        } else {
          const saved = localStorage.getItem(LS_SEL);
          const pick = saved && arr.some((e) => e.code === saved) ? saved : arr[0]?.code ?? null;
          if (!cancelled) setSelected(pick);
        }
      } catch {
        /* silencieux : on retombe sur l'état vide */
      } finally {
        if (!cancelled) setLoadingMine(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasKey, call, refreshMine, location.hash]);

  // Scan sans clé : on mémorise le token pour rejoindre AUTOMATIQUEMENT une fois
  // la clé créée (le scan devient un canal d'acquisition : scan → onboarding →
  // entrée dans le cercle). « Pas de clé = pas de jonction » reste respecté : la
  // clé est créée d'abord, la jonction se fait après.
  useEffect(() => {
    if (hasKey) return;
    const token = decodeURIComponent((location.hash || '').replace(/^#/, '')).trim();
    if (token) {
      try {
        localStorage.setItem('collegue_epicentre_pending', token);
      } catch {
        /* ignore */
      }
    }
  }, [hasKey, location.hash]);

  const select = (code: string) => {
    setSelected(code);
    setShowQR(false);
    setLeaveConfirm(false);
    localStorage.setItem(LS_SEL, code);
  };

  const openCreate = () => {
    setNewName('');
    setNote(null);
    setCreating(true);
  };

  const confirmCreate = async () => {
    const label = newName.trim();
    if (!label) return;
    setBusy(true);
    setNote(null);
    try {
      const d = await call('epicentre_create', { label });
      await refreshMine();
      if (d?.code) {
        setSelected(d.code);
        localStorage.setItem(LS_SEL, d.code);
        setShowQR(true);
      }
      setCreating(false);
      setNewName('');
    } catch {
      setNote('Création impossible pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!selected) return;
    setBusy(true);
    setNote(null);
    try {
      await call('epicentre_leave', { epicentre_code: selected });
      const arr = await refreshMine();
      const pick = arr[0]?.code ?? null;
      setSelected(pick);
      if (pick) localStorage.setItem(LS_SEL, pick);
      else localStorage.removeItem(LS_SEL);
      setShowQR(false);
    } catch {
      setNote('Impossible de se délier.');
    } finally {
      setBusy(false);
      setLeaveConfirm(false);
    }
  };

  const shareUrl = selected ? `${window.location.origin}/epicentre/rejoindre#${encodeURIComponent(selected)}` : '';
  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const selectedMembers = selected ? list.find((e) => e.code === selected)?.members ?? 1 : 0;
  const selectedLabel = selected ? list.find((e) => e.code === selected)?.label || 'Cercle' : '';

  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 pointer-events-none z-[9999] opacity-60 mix-blend-soft-light"
        style={{ backgroundImage: GRAIN }}
      />
      <main className="max-w-[720px] mx-auto px-6 md:px-8 pt-16 pb-32">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          {/* En-tête */}
          <div className="mb-12">
            <div className="flex items-center gap-2.5 mb-4 text-beige-faint">
              <Link2 className="w-4 h-4" strokeWidth={1.5} />
              <span className="font-mono text-[11px] tracking-widest uppercase">Épicentre</span>
            </div>
            <h1 className="font-serif italic text-[36px] md:text-[44px] font-medium text-beige leading-tight mb-4">
              Le climat d'un cercle
            </h1>
            <p className="text-[15px] text-beige-faint leading-relaxed font-mono tracking-wide">
              Une famille, des proches, une équipe — un cercle que tu choisis. Anonyme comme le reste : personne ne voit ce
              que chacun dépose, seulement la résonance d'ensemble.
            </p>
          </div>

          {note && (
            <div className="mb-8 border-l-2 border-beige/30 pl-4 py-1">
              <p className="font-mono text-[11px] tracking-wide text-beige-faint italic">{note}</p>
            </div>
          )}

          {/* Formulaire de création : on nomme le cercle au moment où on génère son QR. */}
          {hasKey && creating && (
            <div className="mb-8 border border-beige/10 rounded-lg p-6 bg-[#0d110d]/30 backdrop-blur-sm max-w-lg">
              <label className="block font-mono text-[10px] tracking-widest uppercase text-beige-faint mb-3">
                Nom du cercle
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) confirmCreate();
                }}
                maxLength={60}
                autoFocus
                placeholder="Famille, Coloc, Équipe…"
                className="w-full bg-transparent border-b border-beige/20 focus:border-beige/50 outline-none text-beige text-[15px] py-2 placeholder:text-beige-faint/40 transition-colors"
              />
              <div className="flex items-center gap-5 mt-5">
                <button
                  onClick={confirmCreate}
                  disabled={busy || !newName.trim()}
                  className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-beige border border-beige/30 hover:border-beige/60 rounded-md px-4 py-2.5 transition-colors disabled:opacity-30"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  {busy ? 'Création...' : 'Créer le cercle'}
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewName('');
                  }}
                  className="font-mono text-[11px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Garde-clé : pas de jonction ni de création sans clé. */}
          {!hasKey ? (
            <div className="border border-beige/10 rounded-lg p-8 bg-[#0d110d]/30 backdrop-blur-sm max-w-lg">
              <div className="flex items-center gap-2.5 mb-4 text-beige-faint">
                <KeyRound className="w-4 h-4" strokeWidth={1.5} />
                <span className="font-mono text-[11px] tracking-widest uppercase">Il te faut d'abord ta clé</span>
              </div>
              <p className="text-[14px] text-beige-faint leading-relaxed mb-6">
                Un épicentre relie des clés entre elles. Crée la tienne, puis reviens créer un cercle ou en rejoindre un par
                QR.
              </p>
              <button
                onClick={() => navigate('/')}
                className="font-mono text-[11px] tracking-widest uppercase text-beige border border-beige/30 hover:border-beige/60 rounded-md px-4 py-2.5 transition-colors"
              >
                Créer ma clé
              </button>
            </div>
          ) : loadingMine ? (
            <div className="font-mono text-[11px] uppercase tracking-widest text-beige-faint animate-pulse py-8">
              Lecture de tes cercles...
            </div>
          ) : list.length === 0 ? (
            /* Aucun épicentre encore */
            !creating && (
              <div className="border border-beige/10 rounded-lg p-8 bg-[#0d110d]/30 backdrop-blur-sm max-w-lg">
                <p className="text-[14px] text-beige-faint leading-relaxed mb-6">
                  Tu n'as pas encore d'épicentre. Crée-en un — tu en deviens le premier membre — puis fais scanner son QR aux
                  personnes que tu veux y réunir.
                </p>
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-beige border border-beige/30 hover:border-beige/60 rounded-md px-4 py-2.5 transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  Créer un épicentre
                </button>
              </div>
            )
          ) : (
            <>
              {/* Sélecteur de cercles (plusieurs possibles) */}
              <div className="flex flex-wrap items-center gap-2.5 mb-8">
                {list.map((e, i) => {
                  const active = e.code === selected;
                  return (
                    <button
                      key={e.code}
                      onClick={() => select(e.code)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] tracking-widest uppercase transition-colors ${
                        active
                          ? 'border-beige/60 text-beige'
                          : 'border-beige/15 text-beige-faint hover:border-beige/35 hover:text-beige'
                      }`}
                    >
                      {e.label || `Cercle ${i + 1}`}
                      <span className="inline-flex items-center gap-1 opacity-70">
                        <Users className="w-3 h-3" strokeWidth={1.5} />
                        {e.members}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={openCreate}
                  title="Nouvel épicentre"
                  aria-label="Nouvel épicentre"
                  className="inline-flex items-center justify-center rounded-full border border-beige/15 text-beige-faint hover:border-beige/35 hover:text-beige w-8 h-8 transition-colors disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              {selected && (
                <>
                  {/* Actions du cercle sélectionné */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8">
                    <button
                      onClick={() => setShowQR((v) => !v)}
                      className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors"
                    >
                      <Share2 className="w-4 h-4" strokeWidth={1.5} />
                      {showQR ? 'Masquer le QR' : 'Partager'}
                    </button>
                    {!leaveConfirm ? (
                      <button
                        onClick={() => setLeaveConfirm(true)}
                        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest uppercase text-beige-faint hover:text-clay transition-colors"
                      >
                        <Unlink className="w-4 h-4" strokeWidth={1.5} />
                        Se délier
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-4">
                        <span className="font-mono text-[11px] tracking-widest uppercase text-beige-faint">Se délier ?</span>
                        <button
                          onClick={leave}
                          disabled={busy}
                          className="font-mono text-[11px] tracking-widest uppercase text-clay hover:opacity-80 transition-opacity disabled:opacity-40"
                        >
                          {busy ? '...' : 'Confirmer'}
                        </button>
                        <button
                          onClick={() => setLeaveConfirm(false)}
                          className="font-mono text-[11px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors"
                        >
                          Annuler
                        </button>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase text-beige-faint/50">
                      <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {selectedMembers} {selectedMembers > 1 ? 'membres' : 'membre'}
                    </span>
                  </div>

                  {/* QR de partage */}
                  {showQR && (
                    <div className="mb-12 flex flex-col items-center">
                      <p className="font-mono text-[11px] tracking-widest uppercase text-beige mb-3">{selectedLabel}</p>
                      <div className="bg-[#f3efe6] rounded-md p-3 flex flex-col items-center">
                        <QRCodeSVG value={shareUrl} size={168} bgColor="#f3efe6" fgColor="#1a1814" level="M" />
                        <div className="flex items-center justify-center gap-1.5 mt-2">
                          <img src="/favicon.svg" alt="" className="w-7 h-7" />
                          <span className="font-mono text-[9px] tracking-wide text-[#1a1814]/70">Rejoignez la communauté</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-beige-faint italic leading-relaxed mt-3 text-center max-w-xs">
                        Fais scanner ce code pour réunir quelqu'un dans ce cercle.
                      </p>
                      <button
                        onClick={copyLink}
                        className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        {copied ? 'Lien copié' : 'Copier le lien'}
                      </button>
                    </div>
                  )}

                  {/* Climat du cercle (corps réutilisé de Climat) */}
                  <div className="border-t border-beige/10 pt-12">
                    <Climat epicentreCode={selected} />
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}