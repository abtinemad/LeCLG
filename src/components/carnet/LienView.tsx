import { motion } from "motion/react";
import { Heart, Network, Feather } from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type { ReflectionCard } from "../../data/emotions";
import { normalizeSphere } from "../../lib/carnet-helpers";
import {
  LockedSection,
  LockedBlock,
  AnalysisError,
  LienSphereDeck,
} from "./CarnetPrimitives";

interface LienViewProps {
  lienData: any;
  networkData: any;
  cards: ReflectionCard[];
  sphereSonges: Record<string, string>;
  updateSphereSonge: (sphere: string, text: string) => void;
  unlockedBlocks: any;
  unlockedSections: any;
  isNextLocked: (key: any, viewMode: any) => boolean;
  prismeKey: (v?: string) => string;
  enrichLien: any;
  retryAnalysis: (key: string) => void;
  analysisErrors: any;
  getEmotionTheme: (teinte: string) => { colorName: string; hex: string; isDefault: boolean };
}

// Vue Lien du Carnet — extraite verbatim de Carnet.tsx (decoupage JSX).
export function LienView({
  lienData,
  networkData,
  cards,
  sphereSonges,
  updateSphereSonge,
  unlockedBlocks,
  unlockedSections,
  isNextLocked,
  prismeKey,
  enrichLien,
  retryAnalysis,
  analysisErrors,
  getEmotionTheme,
}: LienViewProps) {
  return (
    <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
      {!unlockedSections.lien ? (
        <LockedSection
          title="Lien"
          requirements="Toujours visible"
          icon={Heart}
        />
      ) : lienData ? (
        <>
          <div className="h-[280px] w-full mb-6">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={10}
              minHeight={10}
            >
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="70%"
                data={[
                  "Familiale",
                  "Sociale",
                  "Amoureuse",
                  "Professionnelle",
                ].map((s) => {
                  const data = lienData[s] || lienData[s.toLowerCase()];
                  return {
                    subject: s,
                    A: typeof data?.intensite === "number" ? data.intensite : 0,
                    fullMark: 100,
                  };
                })}
              >
                <PolarGrid stroke="#3a3420" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{
                    fill: "#a8a29e",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="Lien"
                  dataKey="A"
                  stroke="var(--color-lien)"
                  fill="var(--color-lien)"
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {(() => {
            const renderSphereCard = (s: string) => {
              const isVisited = cards.some((c) => {
                 return normalizeSphere(c.sphere) === s;
              });

              if (cards.length >= 10 && !isVisited) {
                 return (
                   <div key={s} className="bg-[#1a1814]/30 border-dashed border border-white/10 p-6 rounded-lg flex flex-col h-full transition-all duration-500">
                     <div className="flex justify-between items-center mb-6">
                       <h3 className="font-mono text-[11px] tracking-widest uppercase opacity-40 text-beige/40">
                         {s}
                       </h3>
                     </div>
                     <div className="font-mono text-[7px] text-beige/30">Cette sphère n'a pas encore été visitée.</div>
                   </div>
                 );
              }

              const key = s.toLowerCase();
              const data = lienData[s] || lienData[key];
              if (!data) return null;
              const theme = getEmotionTheme(data.teinte);
              const isDefault = theme.isDefault;

              return (
                <div
                  key={s}
                  className="bg-[#1a1814] border p-6 rounded-lg flex flex-col h-full transform hover:scale-[1.02] transition-all duration-500 group relative overflow-hidden"
                  style={{
                    borderColor: isDefault
                      ? "rgba(245, 158, 11, 0.1)"
                      : `${theme.hex}33`,
                  }}
                >
                  {/* Glow effect matching emotion color */}
                  <div
                    className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-xl -z-10"
                    style={{
                      background: `radial-gradient(circle at center, ${theme.hex}11, transparent 70%)`,
                    }}
                  />

                  <div className="flex justify-between items-center mb-6">
                    <h3
                      className="font-mono text-[11px] tracking-widest uppercase transition-colors opacity-60 group-hover:opacity-100"
                      style={{ color: theme.hex }}
                    >
                      {s}
                    </h3>
                    <div
                      className="text-[12px] font-mono font-medium opacity-70 group-hover:opacity-100 transition-colors"
                      style={{ color: theme.hex }}
                    >
                      {data.intensite}%
                    </div>
                  </div>
                  <div className="h-0.5 bg-white/5 mb-6 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${data.intensite}%` }}
                      className="h-full transition-colors duration-500"
                      style={{ backgroundColor: `${theme.hex}66` }}
                    />
                  </div>
                  <div className="flex-1 space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {data.fragments?.map((f: string, i: number) => (
                      <div
                        key={i}
                        className="text-[14px] font-serif italic text-beige-faint/80 border-l pl-3 leading-relaxed transition-colors duration-500"
                        style={{ borderLeftColor: `${theme.hex}1a` }}
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5">
                    <div
                      className="font-mono text-[7px] uppercase mb-1 italic opacity-30"
                      style={{ color: theme.hex }}
                    >
                      Teinte dominante
                    </div>
                    <div
                      className="text-[13px] italic transition-colors duration-500 mb-4"
                      style={{ color: theme.hex }}
                    >
                      {data.teinte}
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5 mb-1.5 opacity-40">
                        <Feather className="w-2 h-2" />
                        <span className="font-mono text-[6px] uppercase tracking-widest">
                          Songe
                        </span>
                      </div>
                      <textarea
                        value={
                          sphereSonges[s] || sphereSonges[key] || ""
                        }
                        onChange={(e) =>
                          updateSphereSonge(s, e.target.value)
                        }
                        placeholder="Déposer un songe..."
                        className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[9px] text-beige-faint italic outline-none focus:border-white/10 resize-none h-12 custom-scrollbar"
                      />
                    </div>
                  </div>
                </div>
              );
            };
            const sphereCards = ["Familiale", "Sociale", "Amoureuse", "Professionnelle"]
              .map(renderSphereCard)
              .filter(Boolean);
            return (
              <>
                <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {sphereCards}
                </div>
                <LienSphereDeck cards={sphereCards} />
              </>
            );
          })()}
          {unlockedBlocks.lien_structure ? (
            <div className="py-12 border-t border-white/5 text-center mt-12">
              <div className="font-mono text-[8px] uppercase tracking-[0.5em] text-beige/20 mb-4">
                Structure Invisible
              </div>
              <p className="text-xl md:text-2xl font-serif italic text-beige leading-relaxed max-w-2xl mx-auto">
                "{lienData.relief}"
              </p>
              <p className="mt-8 font-mono text-[9px] uppercase tracking-widest text-beige-faint italic opacity-40">
                Avant le mouvement, avant la pensée.
              </p>
            </div>
          ) : isNextLocked('lien_structure', 'lien') && (
            <div className="py-12 border-t border-white/5 text-center mt-12 flex justify-center">
               <div className="w-full max-w-sm"><LockedBlock title="Structure Invisible" requirements="4 fragments + 3 prismes" /></div>
            </div>
          )}

          <div className="mt-12 bg-white/[0.02] border border-[#FCFBF4]/40 shadow-[0_0_15px_rgba(252,251,244,0.15)] p-6 md:p-8 rounded-lg space-y-12">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Corrélation Texture / Prismes */}
              <div className="space-y-6">
                 <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2">
                    <Network className="w-3 h-3" />
                    Corrélation Texture / Prismes
                 </div>
                 {unlockedBlocks.lien_correlation ? (
                   (() => {
                     const spherePrismes = { familiale:0, sociale:0, amoureuse:0, professionnelle:0 };
                     const sphereSongesCount = { familiale:0, sociale:0, amoureuse:0, professionnelle:0 };
                     cards.forEach(c => {
                        const s = normalizeSphere(c.sphere).toLowerCase() as keyof typeof spherePrismes;
                        if (spherePrismes[s] !== undefined) spherePrismes[s]++;
                     });
                     Object.keys(sphereSonges).forEach(k => {
                        const s = k.toLowerCase() as keyof typeof sphereSongesCount;
                        if (sphereSongesCount[s] !== undefined && sphereSonges[k] && sphereSonges[k].trim().length > 10) {
                           sphereSongesCount[s] += sphereSonges[k].length;
                        }
                     });
                     const maxPrismeSphere = Object.keys(spherePrismes).reduce((a,b) => spherePrismes[a as keyof typeof spherePrismes] > spherePrismes[b as keyof typeof spherePrismes] ? a : b) as keyof typeof spherePrismes;
                     const maxSongeSphere = Object.keys(sphereSongesCount).reduce((a,b) => sphereSongesCount[a as keyof typeof sphereSongesCount] > sphereSongesCount[b as keyof typeof sphereSongesCount] ? a : b) as keyof typeof sphereSongesCount;
                     if (spherePrismes[maxPrismeSphere] > 3 && 
                         sphereSongesCount[maxSongeSphere] > 50 && 
                         maxPrismeSphere !== maxSongeSphere &&
                         sphereSongesCount[maxPrismeSphere] < 20) {
                        return (
                          <div className="font-serif italic text-lien opacity-80 text-[13px]">
                            Observation : Décalage entre charge prismatique et songes. La sphère <span className="capitalize">{maxPrismeSphere}</span> concentre les prismes, mais les songes se déversent ailleurs.
                          </div>
                        );
                     }
                     return <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas de déséquilibre marqué</div>;
                   })()
                 ) : isNextLocked('lien_correlation', 'lien') && (
                   <div className="w-full flex justify-center"><div className="max-w-sm w-full"><LockedBlock title="Corrélation Texture / Prismes" requirements="3 fragments + 2 jours + 2 prismes" /></div></div>
                 )}
              </div>

              {/* Constellation des Prismes */}
              <div className="space-y-6 md:border-l border-white/5 md:pl-12">
                 <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2">
                    <Network className="w-3 h-3" />
                    Constellation des Prismes
                 </div>
                 {unlockedBlocks.lien_constellation ? (
                   (() => {
                     const obs: string[] = [];
                     ['familiale','sociale','amoureuse','professionnelle'].forEach(key => {
                        const sSonge = (sphereSonges[key] || sphereSonges[key.charAt(0).toUpperCase() + key.slice(1)] || "").toLowerCase();
                        const thisSpherePrismes = cards.filter(c => normalizeSphere(c.sphere).toLowerCase() === key && c.prisme).map(c => c.prisme);
                        const tensionPrismes = ['colere', 'peur', 'tristesse', 'degout', 'honte'];
                        let hasTension = sSonge.length > 20 && (sSonge.includes('tension') || sSonge.includes('charge') || sSonge.includes('lourd') || sSonge.includes('pression'));
                        let hasTensionPrisme = thisSpherePrismes.some(p => tensionPrismes.includes(p as string));
                        let hasOpenPrisme = thisSpherePrismes.some(p => ['joie', 'confiance', 'anticipation', 'surprise'].includes(p as string));
                        let obsM = "";
                        if (hasTension && hasTensionPrisme) obsM = "Mots & Prismes : Charge confirmée";
                        else if (hasOpenPrisme && sSonge.includes('clair')) obsM = "Songe lumineux + prisme ouvert";
                        if (obsM) obs.push(`${key.charAt(0).toUpperCase()+key.slice(1)} : ${obsM}`);
                     });
                     if (obs.length > 0) {
                       return (
                         <div className="space-y-3">
                           {obs.map((o, i) => (
                             <div key={i} className="font-serif italic text-[13px] text-beige-faint opacity-80 leading-relaxed border-l border-lien/20 pl-3">
                               Observation : {o}
                             </div>
                           ))}
                         </div>
                       );
                     }
                     return <div className="text-[11px] font-mono italic opacity-40 uppercase">Aucune constellation active</div>;
                   })()
                 ) : isNextLocked('lien_constellation', 'lien') && (
                   <div className="mt-4"><LockedBlock title="Constellation des Prismes" requirements="3 fragments + 2 jours + 3 prismes" /></div>
                 )}
              </div>
            </div>

            {enrichLien && Object.keys(enrichLien).some(k => enrichLien[k] && enrichLien[k] !== "Aucun signal clair" && k !== "rythme") && (
              <div className="pt-8 border-t border-white/5 space-y-4">
                 <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-4">
                    <Network className="w-3 h-3" />
                    Enrichissement du lien
                 </div>
                 <div className="grid md:grid-cols-2 gap-6">
                    {Object.entries(enrichLien)
                      .filter(([k, v]) => k !== "rythme" && v && v !== "Aucun signal clair")
                      .map(([k, v]) => {
                        const labels: Record<string,string> = {
                          recurrences: "Récurrences", tension: "Tension", echo: "Écho",
                          polarite: "Polarité", resonance: "Résonance", reformulation: "Reformulation",
                        };
                        const label = labels[k] || k;
                        return (
                          <div key={k} className="bg-white/[0.02] border border-white/5 p-4 rounded-sm">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-beige/20 mb-2">{label}</div>
                            <div className="font-serif italic text-[13px] text-beige-faint/80 leading-relaxed">{v as string}</div>
                          </div>
                        );
                      })}
                 </div>
              </div>
            )}

            <div className="pt-8 border-t border-white/5">
              {networkData ? (
                <div className="space-y-6">
                  <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2">
                    <Network className="w-3 h-3" />
                    Réseau relationnel
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {["Familiale", "Sociale", "Amoureuse", "Professionnelle"].map((sphere) => (
                      <div key={sphere} className="bg-white/[0.02] border border-white/5 p-4 rounded-sm text-center">
                        <div className="font-mono text-[7px] uppercase tracking-widest text-beige/20 mb-2">{sphere}</div>
                        <div className="font-serif text-lg italic text-beige-faint">
                          {networkData[sphere.toLowerCase()] || networkData[sphere] || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : analysisErrors["network"] ? (
                <AnalysisError onRetry={() => retryAnalysis("network")} />
              ) : (
                <div className="text-center py-8">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-beige/20 italic">
                    Cartographie du réseau en cours…
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : analysisErrors["lien"] ? (
        <AnalysisError onRetry={() => retryAnalysis("lien")} />
      ) : (
        <div className="text-center py-20 font-mono text-[11px] uppercase text-beige/20 tracking-widest italic">
          Mise en lien du vécu en cours…
        </div>
      )}
    </div>
  );
}
