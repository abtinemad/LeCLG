import { Waves, Zap } from "lucide-react";
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ReflectionCard } from "../../data/emotions";
import { LockedSection, LockedBlock, AnalysisError } from "./CarnetPrimitives";

interface AffectViewProps {
  affectData: any;
  enrichAffect: any;
  analysisErrors: any;
  unlockedBlocks: any;
  unlockedSections: any;
  cards: ReflectionCard[];
  isNextLocked: (key: any, viewMode: any) => boolean;
  retryAnalysis: (key: string) => void;
  prismeKey: (v?: string) => string;
}

// Vue Affect du Carnet — extraite verbatim de Carnet.tsx (decoupage JSX).
// Purement presentationnelle : lit affectData / enrichAffect + le gating et les
// etats d'erreur ; ne possede aucun etat.
export function AffectView({
  affectData,
  enrichAffect,
  analysisErrors,
  unlockedBlocks,
  unlockedSections,
  cards,
  isNextLocked,
  retryAnalysis,
  prismeKey,
}: AffectViewProps) {
  return (
          <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
            {!unlockedSections.affect ? (
              <LockedSection
                title="Affect"
                requirements="Toujours visible"
                icon={Waves}
              />
            ) : affectData ? (
              <>
                {unlockedBlocks.affect_gradients ? (
                  <div className="grid md:grid-cols-3 gap-8">
                    {["active", "inhibe", "emerge"].map((key) => (
                      <div key={key} className="space-y-4">
                        <h3 className="font-mono text-[9px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">
                          Gradients de Profondeur {" ("}
                          {key === "active"
                             ? "moteurs"
                             : key === "inhibe"
                               ? "inhibiteurs"
                               : "émergents"}
                          {")"}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {affectData[key]?.map((a: string, i: number) => (
                            <div
                              key={i}
                              className={`px-3 py-1.5 rounded-sm border font-serif text-[15px] italic
                               ${
                                 key === "active"
                                   ? "border-evolution/20 bg-evolution/5 text-evolution"
                                   : key === "inhibe"
                                     ? "border-slate/20 bg-slate/5 text-slate"
                                     : "border-green/20 bg-green/5 text-green"
                               }`}
                            >
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isNextLocked('affect_gradients', 'affect') && (
                  <div className="w-full flex justify-center py-6">
                    <div className="w-full max-w-lg">
                      <LockedBlock title="Gradients de Profondeur" requirements="5 fragments" />
                    </div>
                  </div>
                )}

                <div className="py-12 border-t border-white/5 mt-12">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-beige/20 mb-4 italic">
                    Texture affective de la semaine
                  </div>
                  <p className="text-lg font-serif italic text-beige-faint leading-relaxed">
                    "{affectData.texture_semaine}"
                  </p>
                  
                  {unlockedBlocks.affect_lecture ? (
                    affectData.lecture_croisee_affect_prismes && affectData.lecture_croisee_affect_prismes.length > 0 && (
                       <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-affect/50 mb-4 inline-flex items-center gap-2">
                             Lecture croisée Affects / Prismes
                          </div>
                          {affectData.lecture_croisee_affect_prismes.map((obs: string, idx: number) => (
                             <div key={idx} className="font-serif italic text-[14px] text-beige-faint opacity-80 leading-relaxed border-l border-affect/20 pl-4">
                                Observation : {obs}
                             </div>
                          ))}
                       </div>
                    )
                  ) : isNextLocked('affect_lecture', 'affect') && (
                    <div className="mt-8 pt-8 border-t border-white/5 flex justify-center">
                       <div className="w-full max-w-sm"><LockedBlock title="Lecture Croisée" requirements="2 prismes distincts" /></div>
                    </div>
                  )}
                </div>

                <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
                  <div className="flex flex-col md:flex-row gap-12">
                     {/* HEATMAP TEMPORELLE & RYTHME */}
                     <div className="flex-1 space-y-6">
                        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-affect inline-flex items-center gap-2">
                           <Zap className="w-3 h-3" />
                           Rythme de sédimentation
                        </div>
                        
                        <div className="overflow-hidden">
                          <div className="flex">
                            <div className="flex flex-col gap-2 mr-4 mt-6">
                              {["Matin", "Midi", "Aprem", "Soir", "Nuit"].map(t => (
                                 <div key={t} className="h-4 flex items-center font-mono text-[7px] uppercase tracking-widest text-affect/50">{t}</div>
                              ))}
                            </div>
                            <div className="flex flex-1 gap-1">
                              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d, dIdx) => (
                                <div key={d} className="flex-1 flex flex-col gap-1">
                                   <div className="font-mono text-[7px] text-center uppercase tracking-widest text-affect/60 mb-2">{d}</div>
                                   {["Matin", "Midi", "Aprem", "Soir", "Nuit"].map((t, tIdx) => {
                                      const count = cards.filter(c => {
                                         if(!c.date) return false;
                                         const date = new Date(c.date);
                                         const day = (date.getDay() + 6) % 7; 
                                         if (day !== dIdx) return false;
                                         const h = date.getHours();
                                         let slot = "";
                                         if (h >= 6 && h < 11) slot = "Matin";
                                         else if (h >= 11 && h < 14) slot = "Midi";
                                         else if (h >= 14 && h < 18) slot = "Aprem";
                                         else if (h >= 18 && h < 22) slot = "Soir";
                                         else slot = "Nuit";
                                         return slot === t;
                                      }).length;
                                      const alpha = count === 0 ? 0 : Math.min(1, 0.2 + (count * 0.3));
                                      return (
                                        <div 
                                          key={tIdx} 
                                          className="h-4 rounded-sm w-full transition-all hover:ring-1 ring-affect/50"
                                          style={{ backgroundColor: `rgba(123, 167, 215, ${alpha})` }}
                                          title={`${count} fragment(s)`}
                                        />
                                      )
                                   })}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {enrichAffect && enrichAffect.rythme && (
                           <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed pt-4 border-t border-white/5">
                             {enrichAffect.rythme}
                           </div>
                        )}
                     </div>

                     {/* EVOLUTION DES AFFECTS */}
                     {(unlockedBlocks.affect_luminescence || isNextLocked('affect_luminescence', 'affect')) && (
                     <div className="flex-1 space-y-6 flex flex-col md:border-l border-white/5 md:pl-12">
                        {unlockedBlocks.affect_luminescence && (
                          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-affect inline-flex items-center gap-2 mb-4">
                             <Waves className="w-3 h-3" />
                             Luminescence Émotionnelle (Évolution)
                          </div>
                        )}
                        {unlockedBlocks.affect_luminescence ? (
                          <>
                            <div className="h-[180px] w-full relative">
                              {(() => {
                                const moteurs = ['joie', 'colere', 'anticipation', 'confiance'];
                                const inhibiteurs = ['tristesse', 'peur', 'degout', 'honte', 'melancolie'];
                                const emergents = ['surprise'];
                                
                                const weeks: Record<string, {name:string, moteurs:number, inhibiteurs:number, emergents:number}> = {};
                                const sortedCards = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                sortedCards.forEach(c => {
                                   if(!c.date) return;
                                   const d = new Date(c.date);
                                   const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                                   const dayNum = dCopy.getUTCDay() || 7;
                                   dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
                                   const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
                                   const weekNo = Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
                                   const w = `S${weekNo}`;
                                   
                                   if(!weeks[w]) weeks[w] = { name: w, moteurs:0, inhibiteurs:0, emergents:0 };
                                   
                                   const p = prismeKey(c.prisme);
                                   if(p) {
                                     if(moteurs.includes(p)) weeks[w].moteurs++;
                                     else if(inhibiteurs.includes(p)) weeks[w].inhibiteurs++;
                                     else if(emergents.includes(p)) weeks[w].emergents++;
                                   }
                                });
                                const chartData = Object.values(weeks);
                                if (chartData.length === 0) return <div className="text-[11px] text-beige/20 italic font-mono uppercase">Pas encore de données</div>;
                                
                                return (
                                   <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                                     <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                                       <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                       <Tooltip contentStyle={{backgroundColor:'#151515', borderColor:'#ffffff10', fontSize:'11px'}} itemStyle={{fontFamily:'monospace', fontSize:'10px'}} />
                                       <Line type="monotone" name="Moteurs" dataKey="moteurs" stroke="var(--color-ember)" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
                                       <Line type="monotone" name="Inhibiteurs" dataKey="inhibiteurs" stroke="var(--color-slate)" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
                                       <Line type="monotone" name="Émergents" dataKey="emergents" stroke="var(--color-green)" strokeWidth={2} dot={{r:2, fill:'#151515'}} />
                                     </LineChart>
                                   </ResponsiveContainer>
                                )
                              })()}
                            </div>
                            {(() => {
                               const sortedCards = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                               if (sortedCards.length < 5) return null;
                               let countAnticipation = 0;
                               for(let i=0; i<sortedCards.length-1; i++) {
                                  const sWord = (sortedCards[i].user_note||'').toLowerCase();
                                  const nextP = sortedCards[i+1].prisme;
                                  if(sWord.length > 5 && nextP) {
                                     if (nextP === 'colere' && (sWord.includes('bloqué') || sWord.includes('pression') || sWord.includes('injuste'))) countAnticipation++;
                                     if (nextP === 'peur' && (sWord.includes('vide') || sWord.includes('seul') || sWord.includes('ombre'))) countAnticipation++;
                                     if ((nextP === 'joie' || nextP === 'confiance') && (sWord.includes('clair') || sWord.includes('calme') || sWord.includes('mouvement') || sWord.includes('souffle'))) countAnticipation++;
                                     if (nextP === 'tristesse' && (sWord.includes('perte') || sWord.includes('jamais') || sWord.includes('rien'))) countAnticipation++;
                                  }
                               }
                               if(countAnticipation >= 1) {
                                  return <div className="text-[11px] font-serif italic text-beige-faint opacity-60 mt-4">Observation : Corrélation d'anticipation. Les songes préfigurent fréquemment l'affect de la session suivante.</div>;
                               }
                               return null;
                            })()}
                          </>
                        ) : isNextLocked('affect_luminescence', 'affect') && (
                          <div className="flex-1 flex items-center mt-4">
                            <div className="w-full"><LockedBlock title="Luminescence Émotionnelle" requirements="3 fragments sur 3 jours" /></div>
                          </div>
                        )}
                     </div>
                     )}
                  </div>
                </div>
              </>
            ) : analysisErrors["affect"] ? (
              <AnalysisError onRetry={() => retryAnalysis("affect")} />
            ) : (
              <div className="text-center py-20 font-mono text-[11px] uppercase text-beige/20 tracking-widest italic">
                Analyse des affects en cours…
              </div>
            )}
          </div>
  );
}
