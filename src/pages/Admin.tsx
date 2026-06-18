import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useGoBack } from '../lib/useGoBack';
import { ArrowLeft } from 'lucide-react';
import PrismeIcon from '../components/PrismeIcon';
import { sbGet, sbUpdate } from '../lib/worker';

interface Session {
  id: string;
  started_at: string;
  ended_at?: string;
  step_reached: number;
  messages: any[];
  personal_id?: string;
  reflection_card?: {
    fragment: string;
    deplacement: string;
    direction: string;
    texture_relationnelle?: string;
    sphere?: string;
    prisme?: string;
  };
}

interface Feedback {
  id: string;
  personal_id: string;
  message: string;
  response_text?: string | null;
  answered_at?: string | null;
  created_at: string;
}

interface Eclat {
  id: string;
  request_text: string;
  matrice_snapshot: any;
  elan_snapshot: any;
  affect_snapshot: any;
  lien_snapshot: any;
  created_at: string;
  personal_id: string;
  response_text?: string | null;
  answered_at?: string | null;
  replies?: any[] | null;
  replies_closed?: boolean | null;
}

export default function Admin() {
  const goBack = useGoBack();
  const [password, setPassword] = useState("");
  const [isAuth, setIsAuth] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [eclats, setEclats] = useState<Eclat[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedEclatId, setSelectedEclatId] = useState<string | null>(null);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'analyse' | 'eclats' | 'retours'>('list');
  // Éditeur de réponse d'Éclat (vue détail).
  const [eclatResponse, setEclatResponse] = useState("");
  const [eclatSaving, setEclatSaving] = useState(false);
  const [eclatSaveError, setEclatSaveError] = useState(false);
  const [eclatClosing, setEclatClosing] = useState(false);
  // Éditeur de réponse de retour (vue détail).
  const [feedbackResponse, setFeedbackResponse] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaveError, setFeedbackSaveError] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const data = await sbGet("sessions", "order=started_at.desc&limit=500", password);
      setSessions(data);
      try {
        const fbData = await sbGet("feedbacks", "order=created_at.desc&limit=200", password);
        setFeedbacks(fbData);
      } catch (e) {
        console.warn("Table feedbacks: erreur de lecture", e);
        setFeedbacks([]);
      }
      try {
        const eclatData = await sbGet("eclats", "order=created_at.desc&limit=100", password);
        setEclats(eclatData);
      } catch (e) {
        console.warn("Table eclats likely missing or error fetching", e);
        setEclats([]);
      }
      setIsAuth(true);
    } catch (e) {
      setAuthError(true);
    } finally {
      setLoading(false);
    }
  };

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const selectedEclat = eclats.find(e => e.id === selectedEclatId);
  const selectedFeedback = feedbacks.find(f => f.id === selectedFeedbackId);

  // Nombre de prismes distincts débloqués par une personne, sur 10 — calculé
  // sur l'ensemble de ses sessions. Un prisme est une émotion débloquée sur
  // une carte de réflexion quand l'équilibre est atteint.
  const prismeCount = (pid?: string | null): number => {
    if (!pid) return 0;
    return new Set(
      sessions
        .filter(s => s.personal_id === pid)
        .map(s => s.reflection_card?.prisme)
        .filter(Boolean)
    ).size;
  };

  // Quand on change d'Éclat sélectionné, on charge sa réponse existante dans
  // le champ d'écriture — vide si la demande n'a pas encore été répondue.
  useEffect(() => {
    setEclatResponse(selectedEclat?.response_text || "");
    setEclatSaveError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEclatId]);

  // Charge la réponse existante d'un retour dans le champ d'écriture.
  useEffect(() => {
    setFeedbackResponse(selectedFeedback?.response_text || "");
    setFeedbackSaveError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeedbackId]);

  // Dépose la réponse humaine sur la ligne eclats (sb_update, protégé par le
  // mot de passe admin côté serveur). answered_at marque la demande comme
  // répondue : c'est ce que le Carnet de la personne ira lire.
  const publishEclatResponse = async () => {
    if (!selectedEclat || !eclatResponse.trim() || eclatSaving) return;
    setEclatSaving(true);
    setEclatSaveError(false);
    const text = eclatResponse.trim();
    const answered_at = new Date().toISOString();
    try {
      await sbUpdate("eclats", selectedEclat.id, { response_text: text, answered_at }, password);
      // Reflète la publication localement, sans recharger toute la liste.
      setEclats(prev => prev.map(e =>
        e.id === selectedEclat.id ? { ...e, response_text: text, answered_at } : e
      ));
    } catch (e) {
      setEclatSaveError(true);
    } finally {
      setEclatSaving(false);
    }
  };

  // Clôture / réouverture de la possibilité de répondre. replies_closed est
  // une colonne normale d'eclats : un sb_update admin suffit (déjà protégé
  // par mot de passe côté serveur). Clôturer ne supprime rien — les réponses
  // déjà déposées restent visibles ; seul l'ajout devient impossible.
  const toggleEclatClosure = async () => {
    if (!selectedEclat || eclatClosing) return;
    setEclatClosing(true);
    const next = !selectedEclat.replies_closed;
    try {
      await sbUpdate("eclats", selectedEclat.id, { replies_closed: next }, password);
      setEclats(prev => prev.map(e =>
        e.id === selectedEclat.id ? { ...e, replies_closed: next } : e
      ));
    } catch (e) {
      // échec silencieux : l'état n'a pas changé, l'admin peut réessayer.
      console.error("toggle closure failed", e);
    } finally {
      setEclatClosing(false);
    }
  };

  // Dépose la réponse de l'admin sur un retour. sb_update sur feedbacks est
  // protégé par le mot de passe admin côté serveur, comme pour les eclats.
  // answered_at marque le retour comme répondu : c'est ce que le Carnet de
  // la personne ira lire pour afficher la réponse.
  const publishFeedbackResponse = async () => {
    if (!selectedFeedback || !feedbackResponse.trim() || feedbackSaving) return;
    setFeedbackSaving(true);
    setFeedbackSaveError(false);
    const text = feedbackResponse.trim();
    const answered_at = new Date().toISOString();
    try {
      await sbUpdate("feedbacks", selectedFeedback.id, { response_text: text, answered_at }, password);
      setFeedbacks(prev => prev.map(f =>
        f.id === selectedFeedback.id ? { ...f, response_text: text, answered_at } : f
      ));
    } catch (e) {
      setFeedbackSaveError(true);
    } finally {
      setFeedbackSaving(false);
    }
  };

  if (!isAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg p-6 font-mono">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-[#0d0c0a] border border-[#2a2820] rounded-md p-10 overflow-hidden"
        >
          <h1 className="font-serif text-lg text-beige mb-1.5 text-center">Le collègue</h1>
          <p className="text-[9px] tracking-[0.12em] uppercase text-beige-faint text-center mb-10">Interface admin · Accès restreint</p>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            placeholder="Mot de passe" 
            className="w-full bg-[#161512] border border-[#2a2820] rounded px-3 py-2.5 text-[16px] text-beige-dim outline-none mb-3 focus:border-beige-faint"
          />
          {authError && <p className="text-[9px] text-red tracking-wider mb-4 animate-pulse">Mot de passe incorrect.</p>}
          <button 
            onClick={handleAuth}
            disabled={loading}
            className="w-full bg-beige text-bg py-2.5 rounded-sm text-[9px] tracking-[0.12em] uppercase hover:bg-[#f0e0c0] transition-colors disabled:opacity-50"
          >
            {loading ? 'Connexion…' : 'Accéder'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen h-dvh bg-bg text-beige-dim font-mono">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-[#1e1d1a]">
        <div className="flex items-center gap-6">
          <button 
            onClick={goBack}
            className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Retour
          </button>
          <div className="w-[1px] h-8 bg-[#1e1d1a]" />
          <div>
            <div className="font-serif text-lg text-beige">Le collègue — Admin</div>
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <button 
            onClick={() => {
              localStorage.removeItem('lclg_guide_seen');
              alert('Guide réinitialisé. Le guide réapparaîtra sur la page d\'accueil.');
              window.location.reload();
            }}
            className="px-3 py-1.5 border border-white/5 hover:bg-white/5 font-mono text-[8px] uppercase tracking-widest text-beige-faint hover:text-beige transition-all rounded-sm"
          >
            Reset Guide
          </button>
          <div className="w-[1px] h-8 bg-[#1e1d1a]" />
          <div className="text-right">
            <span className="block text-xl text-beige font-medium">{sessions.length}</span>
            <span className="text-[8px] tracking-widest uppercase text-beige-faint">Sessions</span>
          </div>
          <div className="text-right">
            <span className="block text-xl text-beige font-medium">{sessions.filter(s => s.step_reached >= 5).length}</span>
            <span className="text-[8px] tracking-widest uppercase text-beige-faint">Complètes</span>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[300px_1fr] overflow-hidden">
        {/* Left Panel */}
        <div className="border-r border-[#1e1d1a] overflow-y-auto">
          <div className="sticky top-0 bg-bg px-5 py-4 border-b border-[#1e1d1a] flex items-center justify-between z-10">
            <span className="text-[8px] tracking-widest uppercase text-beige-faint">Sessions</span>
            <span className="text-[10px] text-[#5a5548]">{sessions.length}</span>
          </div>
          
          <button 
            onClick={() => setView('analyse')}
            className={`w-full text-left px-5 py-3 border-b border-[#1e1d1a] text-[9px] tracking-widest uppercase transition-colors
              ${view === 'analyse' ? 'bg-[#141210] text-beige border-l-2 border-l-beige' : 'text-beige-faint hover:bg-[#0f0e0c]'}`}
          >
            ↗ Analyse globale
          </button>

          <button 
            onClick={() => { setView('eclats'); setSelectedEclatId(null); }}
            className={`w-full text-left px-5 py-3 border-b border-[#1e1d1a] text-[9px] tracking-widest uppercase transition-colors flex items-center justify-between
              ${view === 'eclats' ? 'bg-[#141210] text-beige border-l-2 border-l-beige' : 'text-beige-faint hover:bg-[#0f0e0c]'}`}
          >
            <span>✧ Éclats</span>
            {eclats.length > 0 && <span className="bg-yellow-400/20 text-yellow-500 px-1.5 py-0.5 rounded-full text-[7px]">{eclats.length}</span>}
          </button>

          <button 
            onClick={() => { setView('retours'); setSelectedFeedbackId(null); }}
            className={`w-full text-left px-5 py-3 border-b border-[#1e1d1a] text-[9px] tracking-widest uppercase transition-colors flex items-center justify-between
              ${view === 'retours' ? 'bg-[#141210] text-beige border-l-2 border-l-beige' : 'text-beige-faint hover:bg-[#0f0e0c]'}`}
          >
            <span>✉ Retours</span>
            {feedbacks.length > 0 && <span className="bg-white/10 text-beige-dim px-1.5 py-0.5 rounded-full text-[7px]">{feedbacks.length}</span>}
          </button>

          <div className="divide-y divide-[#1a1918]">
            {view === 'eclats' ? (
              eclats.map(e => {
                const date = new Date(e.created_at);
                return (
                  <div 
                    key={e.id}
                    onClick={() => setSelectedEclatId(e.id)}
                    className={`px-5 py-4 cursor-pointer transition-colors hover:bg-[#0f0e0c]
                      ${selectedEclatId === e.id ? 'bg-[#141210] border-l-2 border-l-yellow-400' : ''}`}
                  >
                    <div className="text-[9px] text-yellow-400/60 tracking-wider mb-1.5 flex justify-between">
                      <span>{date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {e.answered_at
                        ? <span className="text-[7px] uppercase tracking-wider text-emerald-500/70 not-italic">✓ Répondu</span>
                        : <span className="text-[7px] uppercase opacity-40 italic">En attente</span>}
                    </div>
                    <div className="font-serif text-xs text-[#8a8278] italic line-clamp-2">
                       "{e.request_text}"
                    </div>
                  </div>
                );
              })
            ) : view === 'retours' ? (
              feedbacks.map(f => {
                const date = new Date(f.created_at);
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFeedbackId(f.id)}
                    className={`px-5 py-4 cursor-pointer transition-colors hover:bg-[#0f0e0c]
                      ${selectedFeedbackId === f.id ? 'bg-[#141210] border-l-2 border-l-beige' : ''}`}
                  >
                    <div className="text-[9px] text-[#5a5548] tracking-wider mb-1.5 flex justify-between">
                      <span>{date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {f.answered_at
                        ? <span className="text-[7px] uppercase tracking-wider text-emerald-500/70 not-italic">✓ Répondu</span>
                        : <span className="text-[7px] uppercase opacity-40 italic">En attente</span>}
                    </div>
                    <div className="font-serif text-xs text-[#8a8278] italic line-clamp-2">
                      {f.message}
                    </div>
                  </div>
                );
              })
            ) : sessions.map(s => {
              const msgs = Array.isArray(s.messages) ? s.messages : [];
              const firstUserMsg = msgs.find(m => m.role === 'user' && m.content !== "Bonjour, j'ai une situation à vous soumettre.");
              const preview = firstUserMsg ? firstUserMsg.content.substring(0, 70) : "—";
              const date = new Date(s.started_at);
              
              return (
                <div 
                  key={s.id}
                  onClick={() => { setSelectedSessionId(s.id); setView('list'); }}
                  className={`px-5 py-4 cursor-pointer transition-colors hover:bg-[#0f0e0c]
                    ${selectedSessionId === s.id && view === 'list' ? 'bg-[#141210] border-l-2 border-l-beige' : ''}`}
                >
                  <div className="text-[9px] text-[#5a5548] tracking-wider mb-1.5">
                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="font-serif text-xs text-[#8a8278] italic line-clamp-1 mb-2.5">
                    {preview}{preview.length > 70 ? "…" : ""}
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <span className="text-[8px] tracking-widest uppercase text-beige-faint">{s.step_reached}/5</span>
                    {s.step_reached >= 5 && <span className="text-[8px] text-green tracking-wider">✓ complète</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="overflow-y-auto">
          {view === 'analyse' ? (
            <div className="p-8">
               <div className="text-[8px] tracking-[0.2em] uppercase text-beige-faint border-b border-[#1e1d1a] pb-2.5 mb-8">Analyse globale</div>
               {/* Simplified analysis for now */}
               <div className="grid grid-cols-4 gap-4 mb-8">
                  {[
                    { label: "Sessions", val: sessions.length },
                    { label: "Complétion", val: sessions.length > 0 ? `${Math.round((sessions.filter(s => s.step_reached >= 5).length / sessions.length) * 100)}%` : "—" },
                    { label: "Retours", val: feedbacks.length },
                    { label: "Éclats", val: eclats.length }
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#0d0c0a] border border-[#1e1d1a] rounded p-5">
                      <span className="block text-2xl text-beige font-medium mb-1">{stat.val}</span>
                      <span className="text-[8px] tracking-widest uppercase text-beige-faint">{stat.label}</span>
                    </div>
                  ))}
               </div>
            </div>
          ) : view === 'eclats' ? (
            selectedEclat ? (
              <div className="p-8">
                <div className="flex flex-wrap gap-8 mb-8 border-b border-[#1e1d1a] pb-6">
                  <div>
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">Date de demande</div>
                    <div className="text-sm text-beige-dim">{new Date(selectedEclat.created_at).toLocaleString('fr-FR')}</div>
                  </div>
                  <div>
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">ID Client</div>
                    <div className="text-sm text-beige-dim">{selectedEclat.personal_id}</div>
                  </div>
                  <div>
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">Prismes</div>
                    <div className="text-sm text-beige-dim">{prismeCount(selectedEclat.personal_id)}/10</div>
                  </div>
                  <div className="ml-auto">
                    {selectedEclat.answered_at ? (
                      <>
                        <div className="text-[8px] tracking-widest uppercase text-emerald-500/50 mb-1">Répondu le</div>
                        <div className="text-sm text-emerald-500/80">{new Date(selectedEclat.answered_at).toLocaleString('fr-FR')}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">Statut</div>
                        <div className="text-sm text-yellow-400/70">En attente de réponse</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-10">
                  <div className="text-[8px] tracking-widest uppercase text-yellow-400/40 mb-3 ml-1">Demande spécifique</div>
                  <div className="bg-[#141208] border border-yellow-400/10 rounded-lg p-6 font-serif italic text-lg leading-relaxed text-beige">
                    "{selectedEclat.request_text}"
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="space-y-6">
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">Matrice Snapshot</div>
                    {selectedEclat.matrice_snapshot ? (
                      <div className="space-y-4">
                        <div>
                          <div className="text-[7px] uppercase tracking-widest text-[#EA580C]/60 mb-2">Schéma Central</div>
                          <div className="text-sm italic text-beige-faint leading-relaxed">"{selectedEclat.matrice_snapshot.schema_central}"</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           {selectedEclat.matrice_snapshot.angoisses?.map((a: any, i: number) => (
                             <div key={i} className="bg-white/5 p-3 rounded">
                               <div className="text-[7px] uppercase opacity-40 mb-1">{a.label}</div>
                               <div className="text-[10px] text-beige-faint">{a.manifestations?.[0]}</div>
                             </div>
                           ))}
                        </div>
                      </div>
                    ) : <div className="text-xs italic opacity-20">Pas de snapshot disponible</div>}
                  </div>

                  <div className="space-y-6">
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">Sphères & Affects</div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          {['Familiale', 'Sociale', 'Amoureuse', 'Professionnelle'].map(s => {
                            const key = s.toLowerCase();
                            const data = selectedEclat.lien_snapshot?.[s] || selectedEclat.lien_snapshot?.[key];
                            return (
                              <div key={s} className="bg-white/5 p-3 rounded">
                                <div className="text-[7px] uppercase opacity-40 mb-1">{s}</div>
                                <div className="text-[10px] text-beige-faint">{data?.teinte || '—'} ({data?.intensite}%)</div>
                              </div>
                            );
                          })}
                       </div>
                       <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded">
                          <div className="text-[7px] tracking-widest uppercase text-blue-400/60 mb-2">Élan (Direction)</div>
                          <div className="text-xs italic text-beige-faint">"{selectedEclat.elan_snapshot?.direction || 'Non évalué'}"</div>
                       </div>
                    </div>
                  </div>

                  {selectedEclat.affect_snapshot && Object.keys(selectedEclat.affect_snapshot).length > 0 && (
                    <div className="space-y-6">
                      <div className="text-[8px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">Affect Snapshot</div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { key: 'active', label: 'Moteurs' },
                            { key: 'inhibe', label: 'Inhibiteurs' },
                            { key: 'emerge', label: 'Émergents' },
                          ].map(({ key, label }) => {
                            const items = selectedEclat.affect_snapshot[key];
                            return (
                              <div key={key} className="bg-white/5 p-3 rounded">
                                <div className="text-[7px] uppercase opacity-40 mb-1">{label}</div>
                                <div className="text-[10px] text-beige-faint">
                                  {Array.isArray(items) && items.length > 0 ? items.join(', ') : '—'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded">
                          <div className="text-[7px] tracking-widest uppercase text-blue-400/60 mb-2">Texture de la semaine</div>
                          <div className="text-xs italic text-beige-faint">"{selectedEclat.affect_snapshot.texture_semaine || 'Non évalué'}"</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Réponse — rédigée à la main, déposée sur la ligne eclats.
                    answered_at marque la demande comme répondue ; le Carnet
                    de la personne lit response_text et l'affiche. */}
                <div className="mt-12 pt-8 border-t border-[#1e1d1a]">
                  <div className="text-[8px] tracking-widest uppercase text-yellow-400/40 mb-3 ml-1">
                    Réponse — métabolisation humaine
                  </div>
                  <textarea
                    value={eclatResponse}
                    onChange={(e) => setEclatResponse(e.target.value)}
                    placeholder="Écrire la réponse à cette demande d'Éclat…"
                    rows={12}
                    className="w-full bg-[#141208] border border-yellow-400/10 rounded-lg p-6 font-serif text-base leading-relaxed text-beige outline-none resize-y focus:border-yellow-400/30 placeholder:text-[#5a5548] placeholder:italic"
                  />
                  <div className="flex items-center justify-between gap-6 mt-4">
                    <div className="text-[9px] text-beige-faint leading-relaxed">
                      {eclatSaveError ? (
                        <span className="text-red animate-pulse">Échec de la publication — réessayer.</span>
                      ) : selectedEclat.answered_at ? (
                        <span className="italic">Cette réponse est visible dans le Carnet de la personne. La modifier la met à jour.</span>
                      ) : (
                        <span className="italic">La réponse apparaîtra dans le Carnet de la personne dès sa publication.</span>
                      )}
                    </div>
                    <button
                      onClick={publishEclatResponse}
                      disabled={!eclatResponse.trim() || eclatSaving}
                      className="flex-shrink-0 bg-yellow-400 text-black px-5 py-2 font-mono text-[9px] uppercase tracking-widest rounded hover:bg-yellow-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {eclatSaving
                        ? 'Publication…'
                        : selectedEclat.answered_at ? 'Mettre à jour la réponse' : 'Publier la réponse'}
                    </button>
                  </div>
                </div>

                {/* Réponses de la personne + clôture de l'échange.
                    Clôturer ne supprime rien : empêche seulement d'ajouter. */}
                <div className="mt-10 pt-8 border-t border-[#1e1d1a]">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint ml-1">
                      Réponses de la personne
                      {selectedEclat.replies_closed && (
                        <span className="ml-2 text-emerald-500/50 normal-case tracking-normal">· clôturé</span>
                      )}
                    </div>
                    <button
                      onClick={toggleEclatClosure}
                      disabled={eclatClosing}
                      className={`flex-shrink-0 px-4 py-1.5 border font-mono text-[8px] uppercase tracking-widest rounded transition-colors disabled:opacity-30 ${
                        selectedEclat.replies_closed
                          ? 'border-emerald-500/30 text-emerald-500/70 hover:bg-emerald-500/5'
                          : 'border-white/10 text-beige-faint hover:bg-white/5'
                      }`}
                    >
                      {eclatClosing
                        ? '…'
                        : selectedEclat.replies_closed ? 'Rouvrir les réponses' : 'Clôturer les réponses'}
                    </button>
                  </div>
                  {selectedEclat.replies && selectedEclat.replies.length > 0 ? (
                    <div className="space-y-3">
                      {selectedEclat.replies.map((r: any, i: number) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
                          <div className="text-[7px] uppercase tracking-widest text-beige-faint mb-2">
                            {r.at ? new Date(r.at).toLocaleString('fr-FR') : '—'}
                          </div>
                          <p className="text-sm font-serif italic text-beige leading-relaxed whitespace-pre-wrap">
                            "{r.text}"
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs italic text-[#3a3830] py-2">
                      Aucune réponse de la personne pour l'instant.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full font-serif italic text-sm text-[#2a2820]">
                Sélectionner un Éclat pour voir les données transmises
              </div>
            )
          ) : view === 'retours' ? (
            selectedFeedback ? (
              <div className="p-8">
                <div className="flex flex-wrap gap-8 mb-8 border-b border-[#1e1d1a] pb-6">
                  <div>
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">Reçu le</div>
                    <div className="text-sm text-beige-dim">{new Date(selectedFeedback.created_at).toLocaleString('fr-FR')}</div>
                  </div>
                  <div>
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">ID Client</div>
                    <div className="text-sm text-beige-dim">{selectedFeedback.personal_id || 'anonyme'}</div>
                  </div>
                  <div>
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">Prismes</div>
                    <div className="text-sm text-beige-dim">{prismeCount(selectedFeedback.personal_id)}/10</div>
                  </div>
                  <div className="ml-auto">
                    {selectedFeedback.answered_at ? (
                      <>
                        <div className="text-[8px] tracking-widest uppercase text-emerald-500/50 mb-1">Répondu le</div>
                        <div className="text-sm text-emerald-500/80">{new Date(selectedFeedback.answered_at).toLocaleString('fr-FR')}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">Statut</div>
                        <div className="text-sm text-yellow-400/70">En attente de réponse</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-10">
                  <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-3 ml-1">Le retour</div>
                  <div className="bg-[#0d0c0a] border border-[#1e1d1a] rounded-lg p-6 font-serif text-base leading-relaxed text-beige whitespace-pre-wrap">
                    {selectedFeedback.message}
                  </div>
                </div>

                {/* Réponse — facultative. Déposée via sb_update (protégé par
                    le mot de passe admin). Le Carnet de la personne la lit
                    et l'affiche dans sa modale « Un retour ». */}
                <div className="mt-12 pt-8 border-t border-[#1e1d1a]">
                  <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-3 ml-1">
                    Réponse — facultative
                  </div>
                  <textarea
                    value={feedbackResponse}
                    onChange={(e) => setFeedbackResponse(e.target.value)}
                    placeholder="Répondre à ce retour, si une réponse est utile…"
                    rows={8}
                    className="w-full bg-[#0d0c0a] border border-[#1e1d1a] rounded-lg p-6 font-serif text-base leading-relaxed text-beige outline-none resize-y focus:border-beige-faint placeholder:text-[#5a5548] placeholder:italic"
                  />
                  <div className="flex items-center justify-between gap-6 mt-4">
                    <div className="text-[9px] text-beige-faint leading-relaxed">
                      {feedbackSaveError ? (
                        <span className="text-red animate-pulse">Échec de la publication — réessayer.</span>
                      ) : selectedFeedback.answered_at ? (
                        <span className="italic">Cette réponse est visible par la personne dans « Un retour ». La modifier la met à jour.</span>
                      ) : (
                        <span className="italic">La réponse apparaîtra côté personne dès sa publication.</span>
                      )}
                    </div>
                    <button
                      onClick={publishFeedbackResponse}
                      disabled={!feedbackResponse.trim() || feedbackSaving}
                      className="flex-shrink-0 bg-beige text-bg px-5 py-2 font-mono text-[9px] uppercase tracking-widest rounded hover:bg-[#f0e0c0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {feedbackSaving
                        ? 'Publication…'
                        : selectedFeedback.answered_at ? 'Mettre à jour la réponse' : 'Publier la réponse'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full font-serif italic text-sm text-[#2a2820]">
                Sélectionner un retour
              </div>
            )
          ) : selectedSession ? (
            <div className="p-8">
              <div className="flex flex-wrap gap-6 mb-8 border-b border-[#1e1d1a] pb-6">
                {[
                  { lbl: 'Date', val: new Date(selectedSession.started_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) },
                  { lbl: 'Messages', val: (selectedSession.messages || []).length },
                  { lbl: 'Étapes', val: `${selectedSession.step_reached}/5` },
                  { lbl: 'ID Client', val: selectedSession.personal_id || 'anonyme' },
                  { lbl: 'Prismes', val: `${prismeCount(selectedSession.personal_id)}/10` }
                ].map((m, i) => (
                  <div key={i}>
                    <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-1">{m.lbl}</div>
                    <div className="text-sm text-beige-dim">{m.val}</div>
                  </div>
                ))}
              </div>

              {selectedSession.reflection_card && (
                <div className="bg-[#0e0d08] border border-[#3a3420] rounded-lg p-6 mb-8 text-left">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="font-mono text-[8px] tracking-[0.16em] uppercase text-[#4a4028]">Carte de réflexion générée</div>
                      {selectedSession.reflection_card.prisme && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-mono text-[7px] uppercase">
                          <PrismeIcon rainbow={false} className="w-2 h-2" />
                          Prisme débloqué
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                    <div className="border-l border-[#3a3420] pl-4 font-serif text-[12px] leading-relaxed text-[#9a8a68]">
                      {selectedSession.reflection_card.fragment}
                    </div>
                    <div className="border-l border-[#3a3420] pl-4 font-serif text-[12px] leading-relaxed text-[#9a8a68]">
                      {selectedSession.reflection_card.deplacement}
                    </div>
                    <div className="border-l border-[#3a3420] pl-4 font-serif text-[12px] leading-relaxed text-[#9a8a68]">
                      {selectedSession.reflection_card.direction}
                    </div>
                    {selectedSession.reflection_card.texture_relationnelle && (
                      <div className="pt-3 border-t border-[#3a3420]/30 mt-3 flex justify-between items-center">
                        <span className="font-mono text-[8px] uppercase tracking-widest text-green/60">
                          Résonance : {selectedSession.reflection_card.texture_relationnelle}
                        </span>
                        {selectedSession.reflection_card.sphere && (
                          <span className="font-mono text-[8px] uppercase tracking-widest text-beige-faint/40">
                            {selectedSession.reflection_card.sphere}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

              <div className="text-[8px] tracking-widest uppercase text-beige-faint mb-5">Transcript</div>
              <div className="space-y-4">
                {(selectedSession.messages || []).map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-3.5 font-serif text-[13px] leading-relaxed rounded-md border
                      ${m.role === 'user' ? 'bg-[#1a2a1a] border-[#2a3a2a] text-[#7a9a78] italic' : 'bg-[#111008] border-[#2a2820] text-beige-dim'}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full font-serif italic text-sm text-[#2a2820]">
              Sélectionner une session
            </div>
          )}
        </div>
      </main>
    </div>
  );
}