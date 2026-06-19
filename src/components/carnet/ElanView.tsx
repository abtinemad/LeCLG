import { Network, Orbit } from "lucide-react";
import type { ReflectionCard } from "../../data/emotions";
import { LockedSection, LockedBlock, AnalysisError } from "./CarnetPrimitives";

interface ElanViewProps {
  elanDataAnalysis: any;
  enrichElan: any;
  analysisErrors: any;
  unlockedBlocks: any;
  unlockedSections: any;
  cards: ReflectionCard[];
  isNextLocked: (key: any, viewMode: any) => boolean;
  retryAnalysis: (key: string) => void;
}

// Vue Élan du Carnet — extraite verbatim de Carnet.tsx (decoupage JSX).
// Presentationnelle : lit elanDataAnalysis / enrichElan + gating + erreurs.
export function ElanView({
  elanDataAnalysis,
  enrichElan,
  analysisErrors,
  unlockedBlocks,
  unlockedSections,
  cards,
  isNextLocked,
  retryAnalysis,
}: ElanViewProps) {
  return (
          <div className="space-y-12 animate-fade-up max-w-2xl mx-auto text-center">
            {!unlockedSections.elan ? (
              <LockedSection
                title="Élan"
                requirements="7 jours + 3 fragments"
                icon={Orbit}
              />
            ) : elanDataAnalysis ? (
              <div className="space-y-12">
                <div className="space-y-4 text-center">
                  {unlockedBlocks.elan_mouvement && (
                    <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-beige/20 mb-4">
                      Mouvement
                    </div>
                  )}
                  {unlockedBlocks.elan_mouvement ? (
                    <p className="text-2xl md:text-3xl font-serif italic text-beige leading-snug">
                      "{elanDataAnalysis.mouvement}"
                    </p>
                  ) : isNextLocked('elan_mouvement', 'elan') && (
                    <div className="w-full flex justify-center"><div className="max-w-sm w-full"><LockedBlock title="Analyse de Mouvement" requirements="7 jours + 4 fragments" /></div></div>
                  )}
                </div>

                <div className="w-12 h-px bg-white/10 mx-auto" />

                <div className="space-y-4 text-center">
                  {unlockedBlocks.elan_direction && (
                    <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-beige/20 mb-4">
                      Direction
                    </div>
                  )}
                  {unlockedBlocks.elan_direction ? (
                    <p className="text-lg font-serif text-beige-faint leading-relaxed">
                      {elanDataAnalysis.direction}
                    </p>
                  ) : isNextLocked('elan_direction', 'elan') && (
                    <div className="w-full flex justify-center"><div className="max-w-sm w-full"><LockedBlock title="Direction" requirements="7 jours + 5 fragments" /></div></div>
                  )}
                </div>

                <div className="pt-12 border-t border-white/5 text-center">
                  {unlockedBlocks.elan_question && (
                    <div className="font-mono text-[8px] tracking-[0.4em] uppercase text-green/40 mb-4 italic">
                      La question qui travaille
                    </div>
                  )}
                  {unlockedBlocks.elan_question ? (
                    <p className="text-xl font-serif italic text-beige leading-relaxed">
                      "{elanDataAnalysis.question}"
                    </p>
                  ) : isNextLocked('elan_question', 'elan') && (
                    <div className="w-full flex justify-center mt-4"><div className="max-w-sm w-full"><LockedBlock title="La question qui travaille" requirements="7 jours + 6 fragments" /></div></div>
                  )}
                </div>

                <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12 text-left">
                   <div className="flex flex-col md:flex-row gap-12">
                     {(unlockedBlocks.elan_clusters || isNextLocked('elan_clusters', 'elan')) && (
                     <div className="flex-1 space-y-6">
                        {unlockedBlocks.elan_clusters && (
                          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#FAF9F6] inline-flex items-center gap-2 mb-4">
                             <Orbit className="w-3 h-3" />
                             Clusters récurrents & Signaux
                          </div>
                        )}
                        {unlockedBlocks.elan_clusters ? (
                          <>
                            {enrichElan && enrichElan.clusters_recurrents ? (
                              <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                                {enrichElan.clusters_recurrents}
                              </div>
                            ) : (
                              <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas de clusters détectés</div>
                            )}

                            <div className="pt-6 border-t border-white/5">
                               {(() => {
                                  const directionWords = ['aller', 'faire', 'changer', 'partir', 'mieux', 'besoin', 'envie', 'vouloir', 'décision', 'choix'];
                                  const songeCards = cards.filter(c => c.user_note && c.user_note.length > 5);
                                  
                                  let matches = 0;
                                  songeCards.forEach(c => {
                                     if (directionWords.some(w => c.user_note!.toLowerCase().includes(w))) matches++;
                                  });

                                  if (matches >= 2) {
                                      return (
                                         <div className="font-serif italic text-lien opacity-80 text-[13px]">
                                           Observation : La personne savait avant de savoir. Les mouvements de direction étaient déjà murmurés dans les songes.
                                         </div>
                                      );
                                  }
                                  return <div className="text-[11px] font-mono italic opacity-40 uppercase">Aucun signal précurseur clair</div>;
                               })()}
                               
                               {(() => {
                                  if (cards.length < 6) return null;
                                  const chronological = [...cards].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                  let sansSuiteCount = 0;
                                  const stopWords = new Set(['le','la','les','un','une','des','et','ou','mais','donc','car','ni','est','sont','que','qu','qui','quoi','je','tu','il','elle','nous','vous','ils','elles','mon','ton','son','ma','ta','sa','mes','tes','ses','notre','votre','leur','nos','vos','leurs','de','du','au','aux','à','en','pour','par','sur','sous','avec','sans','dans','ce','cet','cette','ces','pas','plus','très','trop','tout','tous','toute','toutes','être','avoir','faire','comme','y','ne','se','me','te','cette','vers','dont', 'bien', 'fait', 'plus', 'quand']);
                                  
                                  const spherePrev: Record<string, ReflectionCard> = {};
                                  
                                  for (const c of chronological) {
                                     if (!c.sphere) continue;
                                     const prev = spherePrev[c.sphere];
                                     if (prev && prev.direction && prev.direction.split(/\s+/).length > 3) {
                                        const nextText = `${c.fragment || ''} ${c.deplacement || ''} ${c.user_note || ''}`.toLowerCase();
                                        const dirWords = prev.direction.toLowerCase().replace(/[.,!?;:()’']/g, ' ').split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w));
                                        
                                        let hasOverlap = false;
                                        for (const w of dirWords) {
                                           if (nextText.includes(w)) { hasOverlap = true; break; }
                                        }
                                        
                                        if (!hasOverlap && dirWords.length > 0) {
                                           sansSuiteCount++;
                                        }
                                     }
                                     spherePrev[c.sphere] = c;
                                  }
                                  
                                  if (sansSuiteCount >= 3) {
                                     return (
                                        <div className="font-serif italic text-beige/50 text-[13px] mt-4 pt-4 border-t border-white/5 leading-relaxed">
                                          Observation : Certaines directions formulées ici ne semblent pas avoir trouvé de suite. Ce qui peut être pensé et ce qui peut être agi ne coïncident pas toujours.
                                        </div>
                                     );
                                  }
                                  return null;
                               })()}
                            </div>
                          </>
                        ) : isNextLocked('elan_clusters', 'elan') && (
                          <div className="mt-4"><LockedBlock title="Clusters Récurrents" requirements="7 jours + 3 fragments" /></div>
                        )}
                     </div>
                     )}
                     
                     {(unlockedBlocks.elan_direction || isNextLocked('elan_direction', 'elan')) && (
                     <div className={`flex-1 space-y-6 ${(unlockedBlocks.elan_clusters || isNextLocked('elan_clusters', 'elan')) ? "md:border-l border-white/5 md:pl-12" : ""}`}>
                        {unlockedBlocks.elan_direction && (
                          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#FAF9F6] inline-flex items-center gap-2 mb-4">
                             <Network className="w-3 h-3" />
                             Convergence des directions
                          </div>
                        )}
                        {unlockedBlocks.elan_direction ? (
                          (() => {
                              const directions = cards.map(c => (c.direction||'').toLowerCase()).filter(d => d.length > 5);
                              
                              let regAction = 0;
                              let regSens = 0;
                              let regLien = 0;
                              
                              const actionD = ['faire', 'agir', 'changer', 'choix', 'décider'];
                              const sensD = ['comprendre', 'pourquoi', 'sens', 'voir', 'besoin'];
                              const lienD = ['autre', 'parler', 'relation', 'ensemble', 'limite'];
                              
                              directions.forEach(d => {
                                 if (actionD.some(w => d.includes(w))) regAction++;
                                 if (sensD.some(w => d.includes(w))) regSens++;
                                 if (lienD.some(w => d.includes(w))) regLien++;
                              });
                              
                              let obs = null;
                              if (regAction > regSens && regAction > regLien) obs = "Action et décision";
                              else if (regSens > regAction && regSens > regLien) obs = "Quête de sens et clarté";
                              else if (regLien > regAction && regLien > regSens) obs = "Réarticulation des liens";

                              const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                              const recentDirs = cards.filter(c => c.date && new Date(c.date) > thirtyDaysAgo && c.direction).map(c => c.direction!.toLowerCase());
                              const fondObs = recentDirs.length > 4 ? "Un mouvement de fond se dessine activement." : "Convergence lente en cours de décantation.";

                              return (
                                 <div className="space-y-4">
                                    <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                                       {fondObs}
                                    </div>
                                    {obs && (
                                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm">
                                        <div className="text-[10px] font-mono uppercase text-beige/40 mb-1">Polarité dominante</div>
                                        <div className="font-serif italic text-beige/80">{obs}</div>
                                      </div>
                                    )}
                                 </div>
                              );
                          })()
                        ) : null}
                     </div>
                     )}
                   </div>
                </div>
              </div>
            ) : analysisErrors["elan"] ? (
              <AnalysisError onRetry={() => retryAnalysis("elan")} />
            ) : (
              <div className="text-center py-20 font-mono text-[11px] uppercase text-beige/20 tracking-widest italic">
                Trajectoire en cours d'évaluation…
              </div>
            )}
          </div>
  );
}
