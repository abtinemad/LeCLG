import React from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  Feather,
  Activity,
  Waves,
  Orbit,
  RotateCw,
  Check,
  Copy,
  MessagesSquare,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
} from "recharts";
import { EMOTIONS, type ReflectionCard } from "../../data/emotions";
import PrismeIcon from "../../components/PrismeIcon";
import { normalizeSphere, groupCardsByWeek } from "../../lib/carnet-helpers";
import { LockedBlock } from "./CarnetPrimitives";

interface FragmentsViewProps {
  loading: boolean;
  cards: ReflectionCard[];
  sessionsData: any[];
  affectData: any;
  enrichFragments: any;
  unlockedBlocks: Record<string, boolean>;
  isNextLocked: (key: string, viewMode: string) => boolean;
  weekFlip: Record<string, number>;
  setWeekFlip: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  voiceRead: Record<string, boolean>;
  openVoice: (card: ReflectionCard, key: string) => void;
  copyToClipboard: (text: string, section: string) => void;
  copiedSection: string | null;
  setSelectedPrisme: (prisme: string | null) => void;
  prismeKey: (v?: string) => string;
  updateCardNote: (index: number, note: string) => void;
  setResumeConfirm: (card: ReflectionCard | null) => void;
}

export function FragmentsView({
  loading,
  cards,
  sessionsData,
  affectData,
  enrichFragments,
  unlockedBlocks,
  isNextLocked,
  weekFlip,
  setWeekFlip,
  voiceRead,
  openVoice,
  copyToClipboard,
  copiedSection,
  setSelectedPrisme,
  prismeKey,
  updateCardNote,
  setResumeConfirm,
}: FragmentsViewProps) {
  return (
  <div className="space-y-6">
    <div className="space-y-12">
      <style>{`
        .card-holo {
          position: absolute; inset: 0; border-radius: 0.5rem;
          overflow: hidden; pointer-events: none; z-index: 5;
        }
        /* la lame de lumière qui traverse la carte en diagonale, coin à coin */
        .card-holo::before {
          content: ""; position: absolute; top: -60%; left: -60%;
          width: 220%; height: 220%;
          background: linear-gradient(115deg,
            transparent 38%,
            rgba(253,245,230,0.10) 46%,
            rgba(255,255,255,0.42) 50%,
            rgba(253,245,230,0.10) 54%,
            transparent 62%);
          transform: translate(-120%, -120%);
          animation: cardHoloSweep 4.2s ease-in-out infinite;
        }
        /* teinte holographique discrète facon "foil" */
        .card-holo::after {
          content: ""; position: absolute; inset: 0; border-radius: inherit;
          background: linear-gradient(115deg,
            transparent 40%,
            rgba(99,163,104,0.10),
            rgba(123,167,215,0.12),
            rgba(234,88,12,0.08),
            rgba(139,92,246,0.12),
            transparent 60%);
          background-size: 260% 260%;
          mix-blend-mode: screen; opacity: 0.55;
          animation: cardHoloHue 4.2s ease-in-out infinite;
        }
        @keyframes cardHoloSweep {
          0%   { transform: translate(-120%, -120%); }
          28%  { transform: translate(120%, 120%); }
          100% { transform: translate(120%, 120%); }
        }
        @keyframes cardHoloHue {
          0%   { background-position: 0% 0%; }
          28%  { background-position: 100% 100%; }
          100% { background-position: 100% 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .card-holo::before, .card-holo::after { animation: none; opacity: 0; }
        }
      `}</style>
      {loading ? (
        <div className="col-span-2 text-center py-20 font-mono text-[9px] uppercase tracking-widest opacity-40">
          Immersion dans vos archives…
        </div>
      ) : cards.length === 0 ? (
        <div className="col-span-2 flex flex-col items-center py-24 gap-4">
          <Link
            to="/chat"
            className="font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-beige-faint hover:text-beige ring-1 ring-beige-faint/20 bg-white/[0.02]"
          >
            <MessagesSquare size={10} strokeWidth={1.5} />
            <span>penser</span>
          </Link>
          <p className="italic text-beige-faint opacity-40 text-[14px]">
            le vécu pour prendre du recul.
          </p>
        </div>
      ) : (
        groupCardsByWeek(cards).map((week) => {
          const __n = week.items.length;
          const __active = Math.min(weekFlip[week.key] ?? 0, __n - 1);
          const { card, i } = week.items[__active];
          const emotionKey = (
            card.emotion ||
            card.prisme ||
            ""
          ).toLowerCase() as keyof typeof EMOTIONS;
          const emotionData = EMOTIONS[emotionKey] || null;
          const isLocked = !card.prisme;
          const __edOf = (k: number) => {
            const c = week.items[__active + k]?.card;
            if (!c) return null;
            const ek = (c.emotion || c.prisme || "").toLowerCase() as keyof typeof EMOTIONS;
            return EMOTIONS[ek] || null;
          };
          const __ed1 = __edOf(1);
          const __ed2 = __edOf(2);
          // « neuve » = encore jamais affichée (aucune date de lecture).
                            // Brillant tant que le message du Collègue n'a pas été consulté
          // (openVoice marque la lecture -> le brillant s'éteint).
          const isShiny = !voiceRead[card.id || `idx-${i}`];
          return (
            <div key={week.key} className="max-w-lg mx-auto w-full px-3">
              <div className="flex items-baseline justify-between mb-3 px-1">
                <span className="font-mono text-[10px] tracking-widest uppercase text-beige-faint">{week.label}</span>
                <span className="font-mono text-[9px] tracking-widest text-beige-faint/50">{__n} fragment{__n > 1 ? "s" : ""}</span>
              </div>
              <div className="relative">
                {__n - 1 - __active >= 2 && (
                  <div className={`absolute inset-0 rounded-lg ${__ed2 ? __ed2.bg : "bg-[#0a1a12]"} border ${__ed2 ? __ed2.border : "border-[#3a3420]"} pointer-events-none`} style={{ transform: "translateY(8px) rotate(-6deg)", zIndex: 0 }} />
                )}
                {__n - 1 - __active >= 1 && (
                  <div className={`absolute inset-0 rounded-lg ${__ed1 ? __ed1.bg : "bg-[#0a1a12]"} border ${__ed1 ? __ed1.border : "border-[#3a3420]"} pointer-events-none`} style={{ transform: "translateY(4px) rotate(5deg)", zIndex: 1 }} />
                )}
                {/* base opaque : empêche la carte du dessus de laisser passer le fond */}
                <div className="absolute inset-0 rounded-lg bg-[#0a1a12] pointer-events-none" style={{ zIndex: 2 }} />
            <motion.div
              key={`${week.key}-${card.id ?? i}-${i}`}
              initial={{ opacity: 0, x: 28, rotate: -1.5 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "relative", zIndex: 3, touchAction: "pan-y" }}
              drag={__n > 1 ? "x" : false}
              dragSnapToOrigin
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (__n <= 1) return;
                if (info.offset.x <= -60) setWeekFlip((st) => ({ ...st, [week.key]: (__active + 1) % __n }));
                else if (info.offset.x >= 60) setWeekFlip((st) => ({ ...st, [week.key]: (__active - 1 + __n) % __n }));
              }}
              className={`${emotionData ? emotionData.bg : "bg-[#0a1a12]"} border ${emotionData ? emotionData.border : "border-[#3a3420]"} rounded-lg p-6 relative space-y-4 hover:border-[#3a3420]/60 transition-all`}
            >
              {isShiny && (
                <div className="card-holo" aria-hidden="true" />
              )}
              <div className="text-[11px] font-mono text-[#4a4028] mb-2 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span>
                    {new Date(card.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Fragment: ${card.fragment}\nDéplacement: ${card.deplacement}\nDirection: ${card.direction}`,
                        `card-${i}`,
                      )
                    }
                    className="p-1 hover:bg-white/5 rounded transition-colors group relative"
                    title="Copier le chemin"
                  >
                    {copiedSection === `card-${i}` ? (
                      <Check className="w-2.5 h-2.5 text-green" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 opacity-20 group-hover:opacity-100" />
                    )}
                  </button>
                </div>
                <div className="flex gap-2 items-center">
                  {card.sphere && (
                    <span className="text-[8px] uppercase tracking-tighter text-beige-faint/40">
                      {card.sphere}
                    </span>
                  )}
                  {!isLocked && emotionData ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPrisme(prismeKey(card.prisme)); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm border ${emotionData.bg} ${emotionData.border} hover:brightness-125 transition-all`}
                        title="Prisme — toucher pour comprendre sa clarté"
                      >
                        <PrismeIcon
                          rainbow={false}
                          color={emotionData.color}
                          className="w-2.5 h-2.5"
                          title={`Prisme: ${card.prisme}`}
                        />
                        <span className="text-[8px] font-mono uppercase tracking-tighter text-beige">
                          {emotionData.label.split(" ")[0]}
                        </span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openVoice(card, card.id || `idx-${i}`); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border transition-colors ${
                          voiceRead[card.id || `idx-${i}`]
                            ? "border-beige-faint/45 hover:border-beige-faint/70"
                            : "border-green/50 hover:border-green/80"
                        }`}
                        title="Signal capté — toucher pour entendre le collègue"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          voiceRead[card.id || `idx-${i}`]
                            ? "bg-beige-faint"
                            : "bg-green animate-pulse"
                        }`} />
                        <span className={`text-[9px] font-mono uppercase tracking-tighter ${
                          voiceRead[card.id || `idx-${i}`]
                            ? "text-beige-dim"
                            : "text-green animate-pulse"
                        }`}>
                          Signal capté
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); openVoice(card, card.id || `idx-${i}`); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border transition-colors ${
                        voiceRead[card.id || `idx-${i}`]
                          ? "border-beige-faint/45 hover:border-beige-faint/70"
                          : "border-red/50 hover:border-red/80"
                      }`}
                      title="Signal détecté — toucher pour entendre le collègue"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        voiceRead[card.id || `idx-${i}`]
                          ? "bg-beige-faint"
                          : "bg-red animate-pulse"
                      }`} />
                      <span className={`text-[9px] font-mono uppercase tracking-tighter ${
                        voiceRead[card.id || `idx-${i}`]
                          ? "text-beige-dim"
                          : "text-red animate-pulse"
                      }`}>
                        Signal détecté
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div
                className={`border-l ${emotionData ? emotionData.border : "border-[#3a3420]"} pl-4 text-xs italic text-[#9a8a68]`}
              >
                {card.fragment}
              </div>

              {card.image_url && (
                <div className="my-4 relative aspect-video overflow-hidden rounded border border-white/5 group">
                  <img
                    src={card.image_url}
                    alt="Texture relationnelle"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-3 font-mono text-[7px] uppercase tracking-widest text-beige-faint opacity-50">
                    Texture générée
                  </div>
                </div>
              )}

              <div
                className={`border-l ${emotionData ? emotionData.border : "border-[#3a3420]"} pl-4 text-xs text-[#9a8a68]`}
              >
                {card.deplacement}
              </div>
              <div
                className={`border-l ${emotionData ? emotionData.border : "border-[#3a3420]"} pl-4 text-xs font-medium text-[#9a8a68] mb-2`}
              >
                {card.direction}
              </div>

              <div className="pt-2">
                <div className="flex items-center gap-1.5 mb-1.5 opacity-40">
                  <Feather className="w-2.5 h-2.5" />
                  <span className="font-mono text-[7px] uppercase tracking-widest">
                    Songe
                  </span>
                </div>
                <div className="relative">
                  <textarea
                    value={card.user_note || ""}
                    onChange={(e) => updateCardNote(i, e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="Déposer un songe..."
                    className="w-full bg-black/20 border border-white/5 rounded px-3 py-2 text-[11px] text-beige-faint italic outline-none focus:border-white/10 resize-none h-12 custom-scrollbar"
                  />
                  {(() => {
                     if (!card.user_note || card.user_note.trim() === "" || !enrichFragments?.reformulations || !card.id) return null;
                     const ref = enrichFragments.reformulations[card.id];
                     if (!ref) return null;
                     const icon = ref === 'convergent' ? '→' : ref === 'divergent' ? '↗' : '+';
                     return <div className="absolute right-3 top-3 text-beige/20 text-[10px] font-mono pointer-events-none">{icon}</div>;
                  })()}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-[#3a3420]/30">
                <div className="flex items-center gap-2">
                  {card.texture_relationnelle && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-green/60">
                      Résonance : {card.texture_relationnelle}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {isLocked && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setResumeConfirm(card); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="p-2 rounded-md border border-beige-faint/25 text-beige-faint hover:text-beige hover:border-beige-faint/50 hover:bg-beige/5 transition-colors"
                      title="Reprendre cette réflexion"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
              </div>
              {__n > 1 && (
                <div className="flex items-center justify-center gap-5 mt-4">
                  <button onClick={() => setWeekFlip((st) => ({ ...st, [week.key]: (__active - 1 + __n) % __n }))} className="font-mono text-[15px] leading-none text-beige-faint hover:text-beige transition-colors px-2" aria-label="précédent">‹</button>
                  <span className="font-mono text-[9px] tracking-widest text-beige-faint/60">{__active + 1} / {__n}</span>
                  <button onClick={() => setWeekFlip((st) => ({ ...st, [week.key]: (__active + 1) % __n }))} className="font-mono text-[15px] leading-none text-beige-faint hover:text-beige transition-colors px-2" aria-label="suivant">›</button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>

    {cards.length > 0 && (
      <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
        {unlockedBlocks.fragments_progression ? (
          <div className="border-b border-white/5 pb-8">
             <div className="flex flex-col items-center">
                <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
                   <Activity className="w-3 h-3" />
                   Progression dans les étapes
                </div>
                <div className="w-full max-w-xl h-24 relative flex items-end">
                   <div className="absolute inset-0 flex flex-col justify-between">
                      {[5,4,3,2,1].map(lvl => (
                         <div key={lvl} className="w-full border-t border-white/5" />
                      ))}
                   </div>
                   <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                      <LineChart data={sessionsData.filter(s => s.step_reached !== undefined).map((s, idx) => ({ name: idx, step: s.step_reached }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                         <YAxis domain={[1, 5]} hide={true} />
                         <Line type="stepAfter" dataKey="step" stroke="var(--color-green)" strokeWidth={1} dot={false} isAnimationActive={false} />
                      </LineChart>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>
        ) : isNextLocked('fragments_progression', 'fragments') && (
          <div className="border-b border-white/5 pb-8 flex flex-col items-center">
            <div className="w-full max-w-sm"><LockedBlock title="Progression dans les étapes" requirements="2 sessions" /></div>
          </div>
        )}

        {unlockedBlocks.fragments_relation_prismes ? (() => {
           const cardsWithSteps = cards.map(c => {
             const s = sessionsData.find(sess => sess.reflection_card?.id === c.id || sess.reflection_card?.date === c.date);
             return { prisme: c.prisme, step: s?.step_reached };
           }).filter(c => c.prisme && c.step !== undefined);

           const prismeStats: Record<string, { totalStep: number; count: number }> = {};
           for (const c of cardsWithSteps) {
             if (!c.prisme) continue;
             if (!prismeStats[c.prisme]) {
               prismeStats[c.prisme] = { totalStep: 0, count: 0 };
             }
             prismeStats[c.prisme].totalStep += (c.step as number);
             prismeStats[c.prisme].count += 1;
           }

           const prismeAverages = Object.entries(prismeStats)
             .map(([prisme, stats]) => ({ prisme, avg: stats.totalStep / stats.count }));

           if (prismeAverages.length < 2) return <div className="border-b border-white/5 pb-8 mb-8 text-center text-[11px] text-beige/20 italic font-mono uppercase">Pas assez de diversité affective</div>;
           prismeAverages.sort((a, b) => b.avg - a.avg);

           const highest = prismeAverages[0];
           const lowest = prismeAverages[prismeAverages.length - 1];

           if (highest.avg - lowest.avg < 0.5) return <div className="border-b border-white/5 pb-8 mb-8 text-center text-[11px] text-beige/20 italic font-mono uppercase">Aucune corrélation nette détectée (écarts &lt; 0.5)</div>;

           const article = (p: string) => {
             const lower = p.toLowerCase();
             if (['honneur','honte','joie','tristesse','colère','peur','confiance','surprise','mélancolie'].includes(lower)) return `la ${p}`;
             if (['anticipation'].includes(lower)) return `l'${p}`;
             if (['dégoût'].includes(lower)) return `le ${p}`;
             return `la ${p}`; 
           };

           return (
              <div className="border-b border-white/5 pb-8 mb-8 space-y-4 text-center mt-8">
                 <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
                   <Activity className="w-3 h-3" />
                   Relation Prismes / Étapes
                 </div>
                 <div className="flex flex-col items-center max-w-xl mx-auto space-y-4">
                    <div className="font-serif italic text-[14px] text-beige-faint leading-relaxed border-l-2 border-white/5 pl-4 text-left w-full">
                       Observation : Les sessions marquées par {article(highest.prisme)} semblent aller plus loin dans le cheminement.
                    </div>
                    <div className="font-serif italic text-[14px] text-beige-faint leading-relaxed border-l-2 border-white/5 pl-4 text-left w-full">
                       Observation : Les sessions marquées par {article(lowest.prisme)} s'arrêtent plus tôt. Ce n'est pas un échec — c'est ce que ce signal permet pour l'instant.
                    </div>
                 </div>
              </div>
           );
        })() : isNextLocked('fragments_relation_prismes', 'fragments') && (
          <div className="border-b border-white/5 pb-8 mb-8 flex flex-col items-center mt-8">
            <div className="w-full max-w-sm"><LockedBlock title="Relation Prismes / Étapes" requirements="3 fragments + 2 prismes conscients distincts" /></div>
          </div>
        )}

        {unlockedBlocks.fragments_resistances ? (() => {
           const depObs = (() => {
              const spheres = cards.map(c => normalizeSphere(c.sphere)).filter(Boolean);
              const emptyWords = ['je ne sais pas', "rien n'a bougé", "je suis resté", "difficile à dire", "rien", "ne sais pas", "aucun"];
              const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              let sphereSeq: Record<string, number> = {};
              let foundSphere = null;
              for (const c of chronological) {
                 const normSp = normalizeSphere(c.sphere);
                 if (!normSp) continue;
                 const d = (c.deplacement || '').toLowerCase().trim();
                 const words = d.split(/\s+/).filter(w => w.length > 0);
                 if (words.length < 5 || emptyWords.some(ew => d.includes(ew))) {
                    sphereSeq[normSp] = (sphereSeq[normSp] || 0) + 1;
                    if (sphereSeq[normSp] >= 3) { foundSphere = normSp; break; }
                 } else {
                    sphereSeq[normSp] = 0;
                 }
              }
              return foundSphere ? <div className="font-mono text-[7px] italic text-beige/20">Quelque chose résiste au déplacement dans cette sphère.</div> : null;
           })();

           const songesObs = (() => {
              const missing = cards.filter(c => !c.user_note || c.user_note.trim() === '').length;
              return (missing / cards.length > 0.6) ? <div className="font-mono text-[7px] italic text-beige/20">La plupart de vos fragments n'ont pas de Songe déposé. L'espace est là.</div> : null;
           })();

           const prismesObs = (() => {
              const missing = cards.filter(c => !c.prisme).length;
              return (missing / cards.length > 0.4) ? <div className="font-mono text-[7px] italic text-beige/20">Certaines sessions n'ont pas laissé de signal émotionnel détectable. Ce qui est diffus ou défendu laisse moins de trace.</div> : null;
           })();

           if (!depObs && !songesObs && !prismesObs) return null;

           return (
              <div className="border-b border-white/5 pb-8 space-y-2 text-center flex flex-col items-center">
                 {depObs}
                 {songesObs}
                 {prismesObs}
              </div>
           );
        })() : isNextLocked('fragments_resistances', 'fragments') && (
          <div className="border-b border-white/5 pb-8 mb-8 flex flex-col items-center">
            <div className="w-full max-w-sm"><LockedBlock title="Résistances et blancs" requirements="4 fragments + 3 jours différents" /></div>
          </div>
        )}
        {unlockedBlocks.fragments_signaux ? (
          !loading && enrichFragments && enrichFragments.mots_recurrents && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-white/5 pb-8">
              <div className="flex-1">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                  <div className="w-1 h-1 rounded-full bg-green" />
                  <div className="font-mono text-[9px] uppercase tracking-widest text-green">
                    Signaux lexicaux
                  </div>
                </div>
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  {(enrichFragments.mots_recurrents as string[]).map((mot, i) => (
                    <span
                      key={i}
                      className="text-[12px] font-serif italic text-beige bg-green/5 px-2.5 py-1 rounded-sm border border-green/10"
                    >
                      {mot}
                    </span>
                  ))}
                </div>
              </div>
              {enrichFragments.pattern_arret && (
                <div className="flex-1 md:border-l border-white/5 md:pl-8 flex flex-col justify-center text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                    <div className="w-1 h-1 rounded-full bg-green" />
                    <div className="font-mono text-[9px] uppercase tracking-widest text-green/60">
                      Pattern de clôture
                    </div>
                  </div>
                  <div className="text-[14px] font-serif italic text-beige-faint leading-relaxed">
                    {enrichFragments.pattern_arret}
                  </div>
                </div>
              )}
            </div>
          )
        ) : isNextLocked('fragments_signaux', 'fragments') && (
          <div className="border-b border-white/5 pb-8 flex flex-col items-center">
            <div className="w-full max-w-sm"><LockedBlock title="Signaux & Pattern lexicaux" requirements="5 fragments + Analyse de fond active" /></div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-center items-start pt-4">
          <div className="flex flex-col items-center">
            {unlockedBlocks.fragments_echo ? (
              <>
                <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
                   <Feather className="w-3 h-3" />
                   Écho lexical des fragments
                </div>
                <div className="flex flex-wrap justify-center items-baseline gap-x-6 gap-y-4 max-w-sm">
                  {(() => {
                     const stopWords = new Set(['le','la','les','un','une','des','et','ou','mais','donc','car','ni','est','sont','que','qu','qui','quoi','je','tu','il','elle','nous','vous','ils','elles','mon','ton','son','ma','ta','sa','mes','tes','ses','notre','votre','leur','nos','vos','leurs','de','du','au','aux','à','en','pour','par','sur','sous','avec','sans','dans','ce','cet','cette','ces','pas','plus','très','trop','tout','tous','toute','toutes','être','avoir','faire','comme','y','ne','se','me','te','cette','vers','dont', 'bien', 'fait', 'plus', 'quand']);
                     const wordCounts: Record<string, number> = {};
                     cards.forEach(c => {
                       const t = `${c.fragment || ''} ${c.deplacement || ''} ${c.direction || ''}`;
                       const words = t.toLowerCase().replace(/[.,!?;:()’']/g, ' ').split(/\s+/);
                       words.forEach(w => {
                         if (w.length > 3 && !stopWords.has(w)) {
                           wordCounts[w] = (wordCounts[w] || 0) + 1;
                         }
                       });
                     });
                     const sorted = Object.entries(wordCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
                     if (sorted.length === 0) return <div className="text-[11px] text-beige/20 italic font-mono uppercase">Pas encore assez de résonance</div>;
                     const maxC = sorted[0][1];
                     return sorted.map(([w, c], idx) => {
                         const size = Math.max(0.85, 0.85 + (c / maxC) * 1.5);
                         const opacity = Math.max(0.3, (c / maxC));
                         return (
                           <span key={idx} style={{ fontSize: `${size}rem`, opacity }} className="font-serif italic text-beige transition-all duration-500 hover:opacity-100 hover:text-beige cursor-default">
                             {w}
                           </span>
                         )
                     })
                  })()}
                </div>
              </>
            ) : isNextLocked('fragments_echo', 'fragments') && (
              <div className="w-full max-w-sm"><LockedBlock title="Écho lexical" requirements="5 fragments" /></div>
            )}
          </div>

          <div className="flex flex-col items-center">
            {unlockedBlocks.fragments_sillage ? (
              <>
                <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
                   <Waves className="w-3 h-3" />
                   Sillage sémantique des Songes
                </div>
                {(() => {
                  const tensionWords = ['coincé', 'bloqué', 'pression', 'peur', 'fatigue', 'lourd', 'sombre', 'vide', 'dur', 'impossible', 'seul', 'perte', 'jamais', 'rien'];
                  const openWords = ['souffle', 'libre', 'espace', 'calme', 'clair', 'léger', 'mouvement', 'aller', 'faire', 'possible', 'lien', 'voir', 'mieux', 'envie', 'besoin'];

                  const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).filter(c => c.user_note && c.user_note.trim().length > 10);

                  const firstHalf = chronological.slice(0, Math.ceil(chronological.length/2));
                  const secondHalf = chronological.slice(Math.ceil(chronological.length/2));

                  let t1=0, o1=0, t2=0, o2=0;
                  firstHalf.forEach(c => {
                     const w = (c.user_note||'').toLowerCase();
                     tensionWords.forEach(t => { if(w.includes(t)) t1++; });
                     openWords.forEach(o => { if(w.includes(o)) o1++; });
                  });
                  secondHalf.forEach(c => {
                     const w = (c.user_note||'').toLowerCase();
                     tensionWords.forEach(t => { if(w.includes(t)) t2++; });
                     openWords.forEach(o => { if(w.includes(o)) o2++; });
                  });

                  if (t1+o1+t2+o2 === 0) return <div className="text-[11px] text-beige/20 italic font-mono uppercase text-center mt-4">Peu de mots de charge détectés</div>;

                  const tensionRatio1 = t1+o1 > 0 ? t1/(t1+o1) : 0.5;
              const tensionRatio2 = t2+o2 > 0 ? t2/(t2+o2) : 0.5;

              let observation = "Équilibre sémantique stable.";
              if (tensionRatio2 < tensionRatio1 - 0.15) observation = "Glissement lexical : de la tension vers l'ouverture.";
              if (tensionRatio2 > tensionRatio1 + 0.15) observation = "Glissement lexical : le sillage s'alourdit.";

              return (
                 <div className="flex flex-col items-center gap-6 w-full max-w-[200px]">
                   <div className="flex justify-between w-full text-[9px] font-mono uppercase opacity-50">
                     <span>Tension</span>
                     <span>Ouverture</span>
                   </div>
                   <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden flex relative">
                      <div className="absolute top-0 bottom-0 w-[1px] bg-white/20 z-10" style={{left: `${tensionRatio1*100}%`}} title="Tension initiale" />
                      <motion.div initial={{width:0}} animate={{width:`${tensionRatio2*100}%`}} className="h-full bg-clay/80" transition={{duration:1}} />
                      <motion.div initial={{width:0}} animate={{width:`${(1-tensionRatio2)*100}%`}} className="h-full bg-slate/80" transition={{duration:1}} />
                   </div>
                   <div className="font-serif italic text-[14px] text-beige-faint leading-relaxed">
                     Observation : {observation}
                   </div>
                 </div>
              )
            })()}
          </>
        ) : isNextLocked('fragments_sillage', 'fragments') && (
          <div className="w-full max-w-sm"><LockedBlock title="Sillage sémantique des Songes" requirements="2 songes remplis + 7 jours" /></div>
        )}
          </div>
        </div>

        {affectData?.texture_croisee && affectData.texture_croisee.length > 0 && (
           <div className="border-t border-white/5 pt-8 text-center pb-8">
             <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
               <Waves className="w-3 h-3" />
               Texture relationnelle croisée
             </div>
             <div className="space-y-4 max-w-xl mx-auto flex flex-col items-center">
                {affectData.texture_croisee.map((obs: string, idx: number) => (
                   <div key={idx} className="font-serif italic text-[14px] text-beige-faint leading-relaxed border-l-2 border-white/5 pl-3 text-left">
                      Observation : {obs}
                   </div>
                ))}
             </div>
           </div>
        )}
        <div className="grid md:grid-cols-2 gap-12 border-t border-white/5 pt-8">
          <div className="flex flex-col items-center text-center">
             <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
               <Waves className="w-3 h-3" />
               Évolution de la texture
             </div>
             {(() => {
                const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).filter(c => c.texture_relationnelle);
                if (chronological.length < 3) return <div className="text-[10px] font-mono italic opacity-40">Observation en cours de sédimentation.</div>;

                const tWords = ['tendu', 'pression', 'lourd', 'difficile', 'coincé', 'peur', 'dur', 'sombre', 'bloqué'];
                const oWords = ['calme', 'fluide', 'doux', 'léger', 'apaisé', 'clair', 'ouvert', 'bien', 'souffle'];

                const firstHalf = chronological.slice(0, Math.ceil(chronological.length/2));
                const secondHalf = chronological.slice(Math.ceil(chronological.length/2));

                let t1=0, o1=0, t2=0, o2=0;
                firstHalf.forEach(c => {
                   const w = c.texture_relationnelle!.toLowerCase();
                   tWords.forEach(t => { if(w.includes(t)) t1++; });
                   oWords.forEach(o => { if(w.includes(o)) o1++; });
                });
                secondHalf.forEach(c => {
                   const w = c.texture_relationnelle!.toLowerCase();
                   tWords.forEach(t => { if(w.includes(t)) t2++; });
                   oWords.forEach(o => { if(w.includes(o)) o2++; });
                });

                let direction = "La texture relationnelle maintient sa densité.";
                if (t1 > o1 && o2 > t2) direction = "Observation : Évolution notable vers l'apaisement.";
                if (o1 >= t1 && t2 > o2) direction = "Observation : La résonance se fait plus tendue au fil du temps.";
                if (t1 > o1 && t2 > o2) direction = "Observation : La tension reste ancrée dans la structure.";
                if (o1 >= t1 && o2 >= t2) direction = "Observation : Le calme caractérise ce mouvement continu.";

                return <div className="font-serif italic text-beige-faint text-[13px]">{direction}</div>;
             })()}
          </div>

          <div className="flex flex-col items-center text-center">
             <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-green mb-6 inline-flex items-center gap-2">
               <Orbit className="w-3 h-3" />
               Amplitude du mouvement
             </div>
             {(() => {
                const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).filter(c => c.deplacement);
                if (chronological.length < 3) return <div className="text-[10px] font-mono italic opacity-40">Observation en cours de sédimentation.</div>;

                const surfaceWords = ['peu', 'léger', 'surface', 'détail', 'quotidien'];
                const depthWords = ['fond', 'profond', 'racine', 'structure', 'bouleverse', 'grand', 'vaste'];

                let s1=0, d1=0, s2=0, d2=0;
                const firstHalf = chronological.slice(0, Math.ceil(chronological.length/2));
                const secondHalf = chronological.slice(Math.ceil(chronological.length/2));

                firstHalf.forEach(c => {
                   const w = c.deplacement!.toLowerCase();
                   surfaceWords.forEach(t => { if(w.includes(t)) s1++; });
                   depthWords.forEach(o => { if(w.includes(o)) d1++; });
                });
                secondHalf.forEach(c => {
                   const w = c.deplacement!.toLowerCase();
                   surfaceWords.forEach(t => { if(w.includes(t)) s2++; });
                   depthWords.forEach(o => { if(w.includes(o)) d2++; });
                });

                let amplitude = "Les déplacements maintiennent une amplitude mesurée.";
                if (d2 > d1) amplitude = "Observation : Le mouvement s'approfondit et touche aux fondations.";
                if (d1 === 0 && d2 === 0) amplitude = "Observation : Le mouvement reste dans un registre quotidien.";

                return <div className="font-serif italic text-beige-faint text-[13px]">{amplitude}</div>;
             })()}
          </div>
        </div>
      </div>
    )}
  </div>  );
}
