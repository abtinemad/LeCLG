import { motion } from "motion/react";
import { Heart, Network, Feather, Orbit, Waves } from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  EMOTIONS,
  SPHERES as SPHERE_PALETTE,
  type ReflectionCard,
} from "../../data/emotions";
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
          {/* Lien Graphique */}
          <div className="mb-8 h-[220px] w-full max-w-sm mx-auto relative group flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-lien/5 blur-2xl rounded-full -z-10 group-hover:bg-lien/10 transition-colors" />
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
            <div className="flex flex-col md:flex-row gap-12">
               {(unlockedBlocks.lien_texture || unlockedBlocks.lien_correlation || isNextLocked('lien_texture', 'lien') || isNextLocked('lien_correlation', 'lien')) && (
                  <div className="flex-1 space-y-8">
                     {/* DISSOCIATION DETECTION */}
                     {unlockedBlocks.lien_texture && (

                   <>
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-8">
                       <Network className="w-3 h-3" />
                       Texture & Dissociation
                     </div>
                     {(() => {
                        const spherePrismes = { familiale:0, sociale:0, amoureuse:0, professionnelle:0 };
                        const sphereSongesCount = { familiale:0, sociale:0, amoureuse:0, professionnelle:0 };
                        
                        cards.forEach(c => {
                           const normSp = normalizeSphere(c.sphere);
                            if (c.prisme && normSp) {
                              const s = normalizeSphere(c.sphere).toLowerCase() as keyof typeof spherePrismes;
                              if (spherePrismes[s] !== undefined) spherePrismes[s]++;
                           }
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
                               <div className="p-4 bg-clay/5 border border-clay/10 rounded-sm">
                                  <div className="font-serif italic text-[14px] text-beige-faint">
                                    Observation : Déplacement de l'attention. Sédimentation affective focalisée sur la sphère <span className="text-beige/80">{maxPrismeSphere}</span>, mais élaboration de fond orientée vers la sphère <span className="text-beige/80">{maxSongeSphere}</span>.
                                  </div>
                               </div>
                            );
                        }
                        return <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas de dissociation majeure détectée</div>;
                     })()}
                   </>
                 )}
                 {!unlockedBlocks.lien_texture && isNextLocked('lien_texture', 'lien') && (
                   <div className="mb-8">
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-8">
                       <Network className="w-3 h-3" />
                       Texture & Dissociation
                     </div>
                     <LockedBlock title="Texture & Dissociation" requirements="3 fragments + 2 jours" />
                   </div>
                 )}

                 {/* CORRELATION TEXTURE / SPHERE & MOTS / PRISMES */}
                 {unlockedBlocks.lien_correlation ? (() => {
                   const correlationItems = ["familiale", "sociale", "amoureuse", "professionnelle"].map(key => {
                         const textureCount = { tendu: 0, calme: 0 };
                         cards.filter(c => normalizeSphere(c.sphere).toLowerCase() === key).forEach(c => {
                             const t = (c.texture_relationnelle||'').toLowerCase();
                             if(t.includes('tendu') || t.includes('pression') || t.includes('bloqué') || t.includes('lourd') || t.includes('peur') || t.includes('difficile') || t.includes('dur')) textureCount.tendu++;
                             if(t.includes('calme') || t.includes('apaisé') || t.includes('doux') || t.includes('fluide') || t.includes('léger') || t.includes('bien')) textureCount.calme++;
                         });
                         
                         let obsT = null;
                         if (textureCount.tendu > textureCount.calme + 1) obsT = "Texture y est tendue";
                         if (textureCount.calme > textureCount.tendu + 1) obsT = "Texture majoritairement apaisée";
                         
                         const sSonge = (sphereSonges[key] || sphereSonges[key.charAt(0).toUpperCase() + key.slice(1)] || "").toLowerCase();
                         const tensionWords = ['coincé', 'bloqué', 'pression', 'peur', 'fatigue', 'lourd', 'seul', 'dur', 'sombre', 'impossible'];
                         let hasTension = tensionWords.some(w => sSonge.includes(w));
                         
                         const thisSpherePrismes = cards.filter(c => normalizeSphere(c.sphere).toLowerCase() === key && c.prisme).map(c => c.prisme);
                         const tensionPrismes = ['colere', 'peur', 'tristesse', 'degout', 'honte'];
                         
                         let hasTensionPrisme = thisSpherePrismes.some(p => tensionPrismes.includes(p as string));
                         let hasOpenPrisme = thisSpherePrismes.some(p => ['joie', 'confiance', 'anticipation', 'surprise'].includes(p as string));
                         
                         let obsM = null;
                         if (hasTension && hasTensionPrisme) obsM = "Mots & Prismes : Charge confirmée";
                         if (hasTension && hasOpenPrisme) obsM = "Lourdeur résiduelle vs affect ouvert";

                         if (!obsT && !obsM) return null;
                         
                         return (
                           <div key={key} className="space-y-1">
                             <div className="font-mono text-[8px] uppercase text-lien/50 tracking-widest">{key}</div>
                             <div className="font-serif italic text-beige-faint text-[12px] opacity-80 leading-snug">
                               {obsT && <div>• {obsT}</div>}
                               {obsM && <div>• {obsM}</div>}
                             </div>
                           </div>
                         );
                     }).filter(Boolean);

                   if (correlationItems.length === 0) return null;

                   return (
                     <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5 mt-4">
                       {correlationItems}
                     </div>
                   );
                 })() : isNextLocked('lien_correlation', 'lien') && (
                   <div className="mt-4"><LockedBlock title="Corrélation Texture / Prismes" requirements="3 fragments + 2 jours + 2 prismes" /></div>
                 )}
              </div>
              )}
              
              {(unlockedBlocks.lien_constellation || isNextLocked('lien_constellation', 'lien')) && (
              <div className={`flex-1 space-y-8 ${(unlockedBlocks.lien_texture || unlockedBlocks.lien_correlation || isNextLocked('lien_texture', 'lien') || isNextLocked('lien_correlation', 'lien')) ? "md:border-l border-white/5 md:pl-12" : ""}`}>
                 {/* CONSTELLATION DES PRISMES - SVG */}
                 {unlockedBlocks.lien_constellation && (

                   <>
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-8">
                       <Orbit className="w-3 h-3" />
                       Constellation des Prismes
                     </div>
                     {(() => {
                        const validCards = cards.filter(c => c.prisme && c.sphere);
                        if (validCards.length < 5) return <div className="text-[11px] font-mono italic opacity-40 uppercase">Pas assez de données sédimentées</div>;

                        // Couleurs + libellés depuis la source unique (emotions.ts).
                        // Seuls les angles (géométrie de la constellation) restent locaux.
                        const SPHERES = ([
                        { id: 'familiale', angle: 225 },
                        { id: 'sociale', angle: 315 },
                        { id: 'amoureuse', angle: 45 },
                        { id: 'professionnelle', angle: 135 },
                      ] as const).map((s) => ({ ...s, color: SPHERE_PALETTE[s.id].color, label: SPHERE_PALETTE[s.id].label }));

                      const EMOTION_LAYOUT: Record<string, {rOffset: number, aOffset: number}> = {
                        joie: { rOffset: -20, aOffset: -30 }, tristesse: { rOffset: 10, aOffset: -25 }, colere: { rOffset: -5, aOffset: -15 },
                        peur: { rOffset: 25, aOffset: -5 }, degout: { rOffset: -30, aOffset: 5 }, surprise: { rOffset: 15, aOffset: 15 },
                        confiance: { rOffset: -10, aOffset: 25 }, anticipation: { rOffset: 20, aOffset: 35 }, honte: { rOffset: 0, aOffset: -40 },
                        melancolie: { rOffset: 0, aOffset: 40 }, envie: { rOffset: -15, aOffset: 45 }, soulagement: { rOffset: -25, aOffset: 20 },
                        gratitude: { rOffset: 5, aOffset: 50 }, jalousie: { rOffset: 10, aOffset: -35 }, amour: { rOffset: 30, aOffset: -20 },
                        culpabilite: { rOffset: 20, aOffset: -50 }
                      };

                      // EMOTION_COLORS supprimée : les couleurs viennent désormais
                      // de la source unique (EMOTIONS[clé].color).

                      const grouped = validCards.reduce((acc, card) => {
                         const normSp = normalizeSphere(card.sphere);
                         const key = `${normSp}-${card.prisme}`;
                         if (!acc[key]) acc[key] = { sphere: normSp, prisme: card.prisme, count: 0 };
                         acc[key].count++;
                         return acc;
                      }, {} as Record<string, any>);

                      const cx = 150, cy = 150, baseRadius = 80;
                      const points: any[] = [];
                      const lines: any[] = [];
                      
                      Object.values(grouped).forEach((g: any) => {
                         const sp = SPHERES.find(s => s.id === g.sphere?.toLowerCase());
                         if (!sp) return;
                         const el = EMOTION_LAYOUT[g.prisme?.toLowerCase()] || { rOffset: (Math.random()-0.5)*40, aOffset: (Math.random()-0.5)*40 };
                         
                         const r = baseRadius + el.rOffset;
                         const a = (sp.angle + el.aOffset) * (Math.PI / 180);
                         
                         const px = cx + r * Math.cos(a);
                         const py = cy + r * Math.sin(a);
                         const size = Math.max(3, Math.min(10, g.count * 1.5));
                         const eCol = EMOTIONS[g.prisme?.toLowerCase() as keyof typeof EMOTIONS]?.color || '#ffffff';
                         
                         points.push({ x: px, y: py, size, color: eCol, label: g.prisme, count: g.count });
                         lines.push({ x1: cx, y1: cy, x2: px, y2: py, color: sp.color });
                      });

                      return (
                        <div className="w-full flex justify-center">
                          <svg width="300" height="300" viewBox="0 0 300 300" className="overflow-visible">
                             <circle cx={cx} cy={cy} r="2" fill="#fff" opacity="0.5" />
                             <circle cx={cx} cy={cy} r={baseRadius} fill="none" stroke="#ffffff10" strokeDasharray="2 4" />
                             <circle cx={cx} cy={cy} r={baseRadius+40} fill="none" stroke="#ffffff05" strokeDasharray="1 6" />
                             
                             {SPHERES.map(s => {
                                const tx = cx + (baseRadius + 60) * Math.cos(s.angle * Math.PI/180);
                                const ty = cy + (baseRadius + 60) * Math.sin(s.angle * Math.PI/180);
                                return (
                                  <text key={s.id} x={tx} y={ty} fill={s.color} className="font-mono text-[7px] uppercase" textAnchor="middle" alignmentBaseline="middle" opacity="0.8">
                                    {s.label}
                                  </text>
                                )
                             })}

                             {lines.map((l, idx) => (
                                <motion.line key={`l-${idx}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth="1" strokeOpacity="0.15" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.5 }} />
                             ))}

                             {points.map((p, idx) => (
                                <motion.g key={`p-${idx}`} className="group cursor-default" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", delay: 0.2 + idx * 0.05 }}>
                                   <circle cx={p.x} cy={p.y} r={p.size} fill={p.color} />
                                   <circle cx={p.x} cy={p.y} r={p.size * 2} fill="transparent" />
                                   <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                      <text x={p.x + 8} y={p.y - 8} fill={p.color} className="font-mono text-[8px] uppercase" style={{ textShadow: "0px 1px 3px rgba(0,0,0,1)" }}>
                                        {p.label} <tspan fill="#fff">×{p.count}</tspan>
                                      </text>
                                   </g>
                                </motion.g>
                             ))}
                          </svg>
                        </div>
                      );
                   })()}
                   </>
                 )}
                 {!unlockedBlocks.lien_constellation && isNextLocked('lien_constellation', 'lien') && (
                   <div className="mt-4">
                     <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien inline-flex items-center gap-2 mb-8">
                       <Orbit className="w-3 h-3" />
                       Constellation des Prismes
                     </div>
                     <LockedBlock title="Constellation des Prismes" requirements="3 fragments + 2 jours + 3 prismes" />
                   </div>
                 )}
              </div>
              )}
            </div>
            
            {unlockedBlocks.lien_fragilite ? (
              enrichLien && Object.keys(enrichLien).some(k => enrichLien[k] && enrichLien[k] !== "Aucun signal clair" && k !== "rythme") && (
                <div className="pt-8 border-t border-white/5">
                  <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien mb-6 inline-flex items-center gap-2">
                    <Waves className="w-3 h-3" />
                    Points de fragilité & Ressources (Topographie)
                  </div>
                  <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                    {["Familiale", "Sociale", "Amoureuse", "Professionnelle"].map((s, i) => {
                       const key = s.toLowerCase();
                       const val = enrichLien[s] || enrichLien[key];
                       if (!val || val === "Aucun signal clair") return null;
                       return (
                         <div key={i} className="space-y-2">
                           <div className="text-[9px] font-mono uppercase opacity-70" style={{ color: "var(--color-lien)" }}>
                             {s}
                           </div>
                           <div className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                             {val}
                           </div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              )
            ) : isNextLocked('lien_fragilite', 'lien') && (
              <div className="pt-8 border-t border-white/5 flex items-center justify-center">
                 <div className="w-full max-w-sm"><LockedBlock title="Points de fragilité & Ressources" requirements="5 fragments + 3 prismes" /></div>
              </div>
            )}

            {/* Climat de sphère — relogé depuis son ancienne fenêtre :
                le climat collectif appartient à la lecture du Lien. */}
            <div className="pt-8 border-t border-white/5">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-lien mb-6 inline-flex items-center gap-2">
                <Network className="w-3 h-3" />
                Climat de sphère
              </div>
              {networkData ? (
                <>
                  <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                    {["Familiale", "Sociale", "Amoureuse", "Professionnelle"].map(
                      (sphere) => (
                        <div key={sphere} className="space-y-2">
                          <div className="text-[9px] font-mono uppercase opacity-70 text-lien">
                            {sphere}
                          </div>
                          <p className="text-[13px] font-serif italic text-beige-faint leading-relaxed">
                            {networkData[sphere.toLowerCase()] ||
                              "Aucune sédimentation collective détectée dans cette sphère."}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                  <p className="mt-6 text-[11px] font-mono leading-relaxed text-beige-faint/40 italic">
                    Le climat de sphère reflète les sentiments qui
                    habitent vos sphères de vie.
                  </p>
                </>
              ) : analysisErrors["network"] ? (
                <AnalysisError onRetry={() => retryAnalysis("network")} />
              ) : (
                <div className="py-10 text-center font-mono text-[11px] uppercase text-beige/20 tracking-widest italic">
                  Analyse du climat collectif en cours…
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
