import { motion } from "motion/react";
import {
  Fingerprint,
  Download,
  Sparkles,
  MessagesSquare,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type { ReflectionCard } from "../../data/emotions";
import CollegueMark from "../CollegueMark";
import { LueurVisual } from "../LueurVisual";
import { LockedSection, LockedBlock, AnalysisError } from "./CarnetPrimitives";

interface MatriceViewProps {
  matriceDataAnalysis: any;
  cards: ReflectionCard[];
  lueurs: any[];
  unlockedBlocks: any;
  unlockedSections: any;
  isNextLocked: (key: any, viewMode: any) => boolean;
  enrichMatrice: any;
  analysisErrors: Record<string, boolean>;
  retryAnalysis: (key: string) => void;
  setIsEclatModalOpen: (open: boolean) => void;
  exportMatriceToPDF: () => void;
}

// Vue Matrice du Carnet — extraite verbatim de Carnet.tsx (decoupage JSX).
export function MatriceView({
  matriceDataAnalysis,
  cards,
  lueurs,
  unlockedBlocks,
  unlockedSections,
  isNextLocked,
  enrichMatrice,
  analysisErrors,
  retryAnalysis,
  setIsEclatModalOpen,
  exportMatriceToPDF,
}: MatriceViewProps) {
  return (
    <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
      {!unlockedSections.matrice ? (
        <LockedSection
          title="Matrice"
          requirements="21 jours, 5 fragments et 2 prismes"
          icon={Fingerprint}
        />
      ) : matriceDataAnalysis ? (
        <>
          <div className="grid md:grid-cols-2 gap-12">
            {/* Angoisses */}
            <div className="space-y-6">
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">
                Tensions de fond
              </h3>

              <div className="h-[200px] w-full mb-6">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={10}
                  minHeight={10}
                >
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="65%"
                    data={(matriceDataAnalysis.angoisses || []).map(
                      (a: any) => ({
                        subject: a.label,
                        A: typeof a.intensite === "number" ? a.intensite : 0,
                        fullMark: 100,
                      }),
                    )}
                  >
                    <PolarGrid stroke="#3a3420" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{
                        fill: "#a8a29e",
                        fontSize: 9,
                        fontFamily: "serif",
                        fontStyle: "italic",
                      }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Angoisses"
                      dataKey="A"
                      stroke="var(--color-red)"
                      fill="var(--color-red)"
                      fillOpacity={0.15}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4">
                {matriceDataAnalysis.angoisses?.map(
                  (a: any, i: number) => (
                    <div key={i} className="group">
                      <div className="flex justify-between items-end mb-1">
                        <span className="font-serif text-[15px] text-beige italic">
                          {a.label}
                        </span>
                        <span className="font-mono text-[8px] text-beige/20">
                          {a.intensite}%
                        </span>
                      </div>
                      <div className="h-0.5 w-full bg-white/5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${a.intensite}%` }}
                          className="h-full bg-red/30"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 mb-2">
                        {a.manifestations?.map((m: any, j: number) => (
                          <span
                            key={j}
                            className="font-mono text-[7px] text-beige-faint/40 px-1.5 py-0.5 bg-white/5 rounded-sm"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Valeurs */}
            <div className="space-y-6">
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">
                Valeurs d'ancrage
              </h3>
              <div className="space-y-6">
                {matriceDataAnalysis.valeurs?.map((v: any, i: number) => (
                  <div key={i}>
                    <div className="font-serif text-[15px] text-beige italic mb-2">
                      {v.label}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {v.proximite?.map((p: any, j: number) => (
                        <span
                          key={j}
                          className="font-mono text-[8px] text-beige-faint italic opacity-50"
                        >
                          "{p}"
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Schéma Central */}
          <div className="py-12 border-y border-white/5 text-center">
            <div className="flex justify-center items-center gap-8 mb-8">
              <button
                onClick={() => setIsEclatModalOpen(true)}
                className="flex items-center gap-2 py-2 px-6 bg-evolution/5 hover:bg-evolution/10 border border-evolution/20 text-evolution/80 hover:text-evolution font-mono text-[9px] tracking-[0.3em] uppercase rounded-full transition-all"
              >
                <CollegueMark size={26} className="animate-pulse text-red" />
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-evolution">
                    Invoquer un Éclat
                  </span>
                  <span className="font-serif text-[7px] lowercase italic opacity-40 text-beige-faint">
                    Métabolisation humaine ponctuelle
                  </span>
                </div>
              </button>

              <button
                onClick={exportMatriceToPDF}
                className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-beige-faint/40 hover:text-beige transition-colors"
              >
                <Download size={12} />
                <span>PDF</span>
              </button>
            </div>
            <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-matrice/80 mb-6 italic">
              Schéma Central
            </div>
            <p className="text-xl md:text-2xl font-serif italic text-beige leading-relaxed max-w-2xl mx-auto">
              "{matriceDataAnalysis.schema_central}"
            </p>
            {matriceDataAnalysis.coherence_elan_matrice && (
               <div className="mt-8 pt-6 border-t border-white/5 font-serif italic text-[14px] text-beige-faint opacity-80 max-w-xl mx-auto">
                  Observation : {matriceDataAnalysis.coherence_elan_matrice}
               </div>
            )}
          </div>

          {/* Défenses */}
          <div className="space-y-8">
            <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige-faint text-center">
              Manières de se protéger
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {matriceDataAnalysis.defenses?.map((d: any, i: number) => (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 p-5 rounded-lg"
                >
                  <div className="font-serif text-[16px] text-beige mb-3">
                    {d.label}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="font-mono text-[7px] uppercase text-beige/20 mb-1">
                        Ce qui les active
                      </div>
                      <div className="text-[13px] text-beige-faint leading-relaxed">
                        {d.declencheur}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[7px] uppercase text-beige/20 mb-1">
                        Direction
                      </div>
                      <div className="text-[13px] text-beige-faint leading-relaxed italic">
                        {d.direction}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lueurs */}
          {lueurs.length > 0 && (
            <div className="pt-12">
              <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige-faint text-center mb-8">
                Lueurs accumulées
              </h3>
              <div className="max-w-xl mx-auto space-y-12">
                {lueurs.map((lueur, i) => (
                  <div key={i} className="flex flex-col gap-6">
                    <LueurVisual context={lueur.context} />
                    <div className="bg-evolution/5 border border-evolution/20 p-6 rounded-lg text-center relative overflow-hidden group">
                      <div className="absolute inset-0 bg-evolution/10 blur-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Sparkles className="w-5 h-5 text-evolution mx-auto mb-4 opacity-50" />
                      <div className="font-serif text-lg text-evolution italic mb-2">
                        {lueur.title}
                      </div>
                      <p className="text-xs text-beige-faint leading-relaxed">
                        {lueur.text}
                      </p>
                      <div className="mt-4 font-mono text-[7px] uppercase tracking-widest text-beige/10">
                        {new Date(lueur.date).toLocaleDateString(
                          "fr-FR",
                          { month: "long", year: "numeric" },
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visualiser Matrice Button */}
          <div className="pt-20 text-center">
            <p className="font-mono text-[7px] text-beige/20 uppercase tracking-widest italic mb-4">
              Structure cristallisée · Prête pour l'Eclat
            </p>
          </div>

          <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
            <div className="grid md:grid-cols-2 gap-12">
              {/* EVOLUTION & VALIDATION SONGES */}
              <div className="space-y-6">
                 <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-matrice inline-flex items-center gap-2">
                    <Fingerprint className="w-3 h-3" />
                    Évolution du fond
                 </div>
                 {enrichMatrice ? (
                    <div className="space-y-6">
                      {enrichMatrice.evolution && (
                        <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                          {enrichMatrice.evolution}
                        </div>
                      )}
                      
                      {unlockedBlocks.matrice_validation_songes ? (
                        enrichMatrice.validation_songes && (
                          <div className="text-[11px] font-serif italic text-beige/50 border-l border-matrice/30 pl-3">
                            {enrichMatrice.validation_songes}
                          </div>
                        )
                      ) : isNextLocked('matrice_validation_songes', 'matrice') && (
                        <div className="mt-4"><LockedBlock title="Validation des Songes" requirements="1 songe rempli (exploration des Liens)" /></div>
                      )}
                    </div>
                 ) : analysisErrors["enrich_matrice"] ? (
                    <AnalysisError onRetry={() => retryAnalysis("enrich_matrice")} />
                 ) : (
                    <div className="text-[11px] font-mono italic opacity-40 uppercase">Analyse en cours...</div>
                 )}
              </div>
              
              {/* STRUCTURE DU MOUVEMENT COGNITIF */}
              <div className="space-y-6 md:border-l border-white/5 md:pl-12">
                 <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-matrice inline-flex items-center gap-2">
                    <MessagesSquare className="w-3 h-3" />
                    Mouvement Cognitif
                 </div>
                 {(() => {
                    if (cards.length < 5) return <div className="text-[11px] font-mono italic opacity-40 uppercase">Sédimentation insuffisante</div>;
                    
                    const validDirs = cards.map(c => (c.direction||'').toLowerCase()).filter(d => d.length > 5);
                    let asQuestions = 0; let asResolutions = 0; let asImages = 0;
                    
                    const qWords = ['pourquoi', 'comment', 'est-ce', '?'];
                    const rWords = ['je dois', 'il faut', 'décider', 'arrêter', 'continuer', 'faire', 'aller'];
                    const iWords = ['comme', 'ressemble', 'impression', 'sensation', 'mur', 'vide', 'lumière', 'chemin'];
                    
                    validDirs.forEach(d => {
                       if (qWords.some(w => d.includes(w))) asQuestions++;
                       if (rWords.some(w => d.includes(w))) asResolutions++;
                       if (iWords.some(w => d.includes(w))) asImages++;
                    });
                    
                    const validDeps = cards.map(c => (c.deplacement||'').toLowerCase()).filter(d => d.length > 5);
                    let regRelational: number = 0, regExistential: number = 0, regPractical: number = 0;
                    
                    const relWords = ['autre', 'parler', 'relation', 'lien', 'ils', 'avec'];
                    const exiWords = ['sens', 'vie', 'mort', 'toujours', 'jamais', 'peur', 'profond', 'fond'];
                    const praWords = ['travail', 'temps', 'organisation', 'faire', 'concret', 'quotidien', 'détail'];
                    
                    validDeps.forEach(d => {
                       if (relWords.some(w => d.includes(w))) regRelational++;
                       if (exiWords.some(w => d.includes(w))) regExistential++;
                       if (praWords.some(w => d.includes(w))) regPractical++;
                    });
                    
                    let formulation = "";
                    if (asQuestions > asResolutions && asQuestions > asImages) formulation = "privilégie la délibération et le questionnement ouvert";
                    else if (asResolutions > asQuestions && asResolutions > asImages) formulation = "tend vers des actes de résolution et de décision courte";
                    else if (asImages > asQuestions && asImages > asResolutions) formulation = "s'appuie sur une symbolisation par métaphores et sensations";
                    else formulation = "articule délibérations, images et tentatives de résolution (forme composite)";
                    
                    let registre = "";
                    if (regRelational > regExistential && regRelational > regPractical) registre = "le maillage relationnel";
                    else if (regExistential > regRelational && regExistential > regPractical) registre = "le fond existentiel invisible";
                    else if (regPractical > regRelational && regExistential < regPractical) registre = "l'ancrage dans la réalité pratique";
                    else registre = "une dynamique articulée entre pragmatisme et affects de fond";
                    
                    return (
                       <div className="space-y-4">
                          <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                             La structure de pensée {formulation}. Le mouvement vient préférentiellement traiter et interroger {registre}.
                          </div>
                          {enrichMatrice && enrichMatrice.mouvement_cognitif && (
                             <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm">
                                <div className="text-[10px] font-mono uppercase text-beige/40 mb-1">Dynamique formelle</div>
                                <div className="font-serif italic text-beige-faint/80 text-[12px]">{enrichMatrice.mouvement_cognitif}</div>
                             </div>
                          )}
                       </div>
                    );
                 })()}
              </div>
            </div>
          </div>
        </>
      ) : analysisErrors["matrice"] ? (
        <AnalysisError onRetry={() => retryAnalysis("matrice")} />
      ) : (
        <div className="text-center py-20">
          <p className="font-mono text-[11px] uppercase text-beige/20 tracking-widest">
            Calcul de la structure en cours…
          </p>
        </div>
      )}
    </div>
  );
}
