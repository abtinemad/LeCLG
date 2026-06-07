import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { EMOTIONS, SPHERES } from '../data/emotions';
import { 
  Cloud, 
  Sun, 
  Wind, 
  Umbrella, 
  Gauge,
  Compass,
  Activity,
  Tornado,
  CloudFog,
  CalendarRange,
  LayoutGrid,
  Lock
} from 'lucide-react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import { ClarteSection } from '../components/SerpentinGuide';

// ── Décryptage des labels ──────────────────────────────────────────────
// Tant qu'un Prisme n'est pas débloqué, son nom reste un grésillement pixelisé.
// Le déverrouillage agit comme la clé qui décrypte (résolution rapide à l'entrée).
const GLYPHS = "░▒▓█▚▞▌▐";
const scrambleString = (text: string) =>
  Array.from(text, (ch) => (ch === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");

function useDecrypt(text: string, revealed: boolean, animate: boolean) {
  const [display, setDisplay] = useState(() =>
    revealed ? (animate ? scrambleString(text) : text) : scrambleString(text),
  );
  useEffect(() => {
    if (!revealed) {
      // Verrouillé : grésillement doux — on ne fait scintiller qu'une fraction
      // des glyphes à chaque tick, à cadence lente (pas de friture violente).
      const current = scrambleString(text).split("");
      setDisplay(current.join(""));
      const positions = current.map((_, i) => i).filter((i) => text[i] !== " ");
      const id = setInterval(() => {
        const n = Math.max(1, Math.round(positions.length * 0.22));
        for (let k = 0; k < n; k++) {
          const i = positions[(Math.random() * positions.length) | 0];
          current[i] = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        setDisplay(current.join(""));
      }, 220);
      return () => clearInterval(id);
    }
    if (!animate) {
      // Déjà révélé une fois : on l'affiche directement, sans rejouer.
      setDisplay(text);
      return;
    }
    // Première révélation : les glyphes se figent vers le mot, de gauche à droite.
    let raf = 0;
    let start = 0;
    const duration = 650;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const n = Math.floor(p * text.length);
      setDisplay(
        Array.from(text, (ch, i) =>
          i < n || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0],
        ).join(""),
      );
      if (p < 1) raf = requestAnimationFrame(step);
      else setDisplay(text);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, revealed, animate]);
  return display;
}

function CryptLabel({ text, revealed, animate, className, color, colorHidden }: { text: string; revealed: boolean; animate: boolean; className?: string; color?: string; colorHidden?: string }) {
  const display = useDecrypt(text, revealed, animate);
  return (
    <span className={className} style={{ color: revealed ? (color ?? "#cfc2b1") : (colorHidden ?? "#6a6258") }}>
      {display}
    </span>
  );
}

function CryptTick({ x, y, textAnchor, text, revealed, animate, color }: any) {
  const display = useDecrypt(text, revealed, !!animate);
  return (
    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fill={revealed ? color : "#6a6258"} fontSize={10} fontFamily="monospace">
      {display}
    </text>
  );
}

// Normalise une valeur de Prisme (carte) vers une clé EMOTIONS (sans accent, minuscule).
const normPrisme = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\(prisme\)/i, "")
    .toLowerCase()
    .trim();

// Normalise une valeur de sphère (stockage hétérogène : "amoureux"/"Amoureuse"…)
// vers la clé canonique de SPHERES (familiale/sociale/amoureuse/professionnelle).
const normSphereKey = (sphere?: string): string => {
  const lower = (sphere || "").trim().toLowerCase();
  if (lower.startsWith("amoureu")) return "amoureuse";
  if (lower.startsWith("famil")) return "familiale";
  if (lower.startsWith("soci")) return "sociale";
  if (lower.startsWith("profession")) return "professionnelle";
  return "";
};

export default function Climat() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'maintenant' | 'variations'>('maintenant');

  // Prismes débloqués par la personne = clés distinctes présentes dans ses cartes
  // (cache local, lecture synchrone, zéro API). Sert de clé de décryptage des labels.
  const unlockedPrismes = useMemo(() => {
    try {
      const raw = localStorage.getItem("collegue_cards");
      const cards = raw ? JSON.parse(raw) : [];
      return new Set<string>(
        cards.map((c: any) => normPrisme(c?.prisme)).filter(Boolean),
      );
    } catch {
      return new Set<string>();
    }
  }, []);

  // Prismes déjà « révélés » lors d'une visite précédente : pour eux, pas de
  // rejouer le décryptage — il ne se joue qu'à la première fois après déblocage.
  const seenPrismes = useMemo(() => {
    try {
      const raw = localStorage.getItem("collegue_prismes_vus");
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  }, []);

  // Au montage, on marque tous les Prismes débloqués comme vus → la prochaine
  // visite les affichera directement en clair, sans rejouer l'animation.
  // On n'écrit que lorsque le climat est réellement affiché (sinon on griller­ait
  // la première révélation derrière l'écran « Climat en formation »).
  useEffect(() => {
    const climateReady =
      !loading && data && !data.error && data.emotions && data.totalSessions >= 3;
    if (!climateReady) return;
    try {
      const merged = new Set<string>(seenPrismes);
      unlockedPrismes.forEach((k) => merged.add(k));
      localStorage.setItem("collegue_prismes_vus", JSON.stringify(Array.from(merged)));
    } catch {
      /* ignore */
    }
  }, [loading, data, seenPrismes, unlockedPrismes]);

  useEffect(() => {
    fetch('/api/climate')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Icône météo par émotion (soleil / nuage / vent / parapluie) : sert d'icône
  // de titre au bloc Résonance commune, teintée par l'émotion dominante.
  const CLIMATE_ICONS: Record<string, typeof Sun> = {
    joie: Sun, tristesse: Cloud, colere: Wind, peur: Umbrella,
  };

  // EMOTIONS_CONFIG supprimé : couleurs/bordures/labels viennent de la source
  // unique (EMOTIONS). Au passage, la clé accentuée « degoût » — qui ne matchait
  // jamais la clé « degout » du reste du système — disparaît.

  if (loading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="font-mono text-[11px] uppercase tracking-widest text-beige-faint animate-pulse">
          Lecture du climat...
        </div>
      </div>
    );
  }

  if (!data || data.error || !data.emotions || data.totalSessions < 3) {
    return (
      <div className="relative min-h-screen">
        {/* Grain Overlay */}
        <div className="fixed inset-0 pointer-events-none z-[9999] opacity-60 mix-blend-soft-light" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>
      <ClarteSection section="climat" />
        <main className="max-w-[720px] mx-auto px-6 md:px-8 pt-16 pb-32">
          <div className="text-center py-20">
            <h1 className="font-serif italic text-3xl font-medium text-beige mb-4">Climat en formation</h1>
            <p className="text-beige-dim text-sm max-w-md mx-auto leading-relaxed">
              Le climat affectif global nécessite qu'au moins 3 sessions distinctes soient enregistrées au sein de la communauté pour se cristalliser de manière totalement anonyme. Reviens un peu plus tard.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const emotionEntries = Object.entries(data.emotions);
  const maxVal = Math.max(...Object.values(data.emotions) as number[]);
  const fullMark = maxVal > 0 ? maxVal : 1;

  // L'émotion la plus déposée (première du classement) est rendue claire pour
  // tout le monde, même sans le Prisme : c'est la teinte commune, le repère
  // partagé de la communauté. Les autres restent gated par les Prismes.
  const sortedEmotions = [...emotionEntries].sort((a,b) => (b[1] as number) - (a[1] as number));
  const mainEmotion = sortedEmotions[0] ? sortedEmotions[0][0] : '...';
  const em = EMOTIONS[mainEmotion as keyof typeof EMOTIONS] || null;
  const ClimateIcon = CLIMATE_ICONS[mainEmotion] ?? Wind;

  // Mélange de pigments pour l'aire du radar : on prend les émotions les plus
  // présentes de la communauté (cœur = dominante, puis les suivantes en fondu).
  // Données agrégées et anonymisées — aucun rapport avec le gating des Prismes.
  const blendColors = sortedEmotions
    .slice(0, 4)
    .map(([k]) => (EMOTIONS as any)[k]?.color)
    .filter(Boolean) as string[];
  if (blendColors.length === 0) blendColors.push(em ? em.color : '#6BA368');
  const radarFillId = 'climat-radar-fill';

  const radarData = Object.entries(EMOTIONS).map(([key, emItem]) => {
    const forced = key === mainEmotion;
    const owned = unlockedPrismes.has(key);
    return {
      subject: emItem.label.replace(/\s*\(Prisme\)/, ""),
      A: (data.emotions[key] as number) || 0,
      fullMark,
      color: emItem.color,
      key,
      revealed: owned || forced,
      animate: owned && !forced && !seenPrismes.has(key),
    };
  });

  // Dynamiques de la communauté : on partitionne les 16 émotions en trois
  // reliefs — accumulations (ce qui s'intensifie), creux (ce qui se raréfie),
  // nappes diffuses (ce qui ondule en fond). La dominante est toujours un
  // relief. La moyenne est calculée sur les émotions présentes pour que les
  // absences (creux) ne l'écrasent pas.
  const allEmo = Object.entries(EMOTIONS).map(([key, emItem]) => ({
    key,
    color: emItem.color,
    label: emItem.label.replace(/\s*\(Prisme\)/, ""),
    value: (data.emotions[key] as number) || 0,
    revealed: unlockedPrismes.has(key) || key === mainEmotion,
    animate: unlockedPrismes.has(key) && key !== mainEmotion && !seenPrismes.has(key),
  }));
  const present = allEmo.map((e) => e.value).filter((v) => v > 0);
  const moyenne = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0;
  const accKeys = new Set<string>([mainEmotion]);
  allEmo.forEach((e) => { if (e.value > 0 && e.value >= moyenne * 1.3) accKeys.add(e.key); });
  const accumulations = allEmo.filter((e) => accKeys.has(e.key)).sort((a, b) => b.value - a.value).slice(0, 4);
  const creux = allEmo.filter((e) => !accKeys.has(e.key) && e.value <= moyenne * 0.4).sort((a, b) => a.value - b.value).slice(0, 4);
  const diffuses = allEmo.filter((e) => !accKeys.has(e.key) && e.value > moyenne * 0.4).sort((a, b) => b.value - a.value).slice(0, 5);
  const dynamiques = [
    { titre: 'Rafales', sous: 'ce qui souffle fort', items: accumulations, Icon: Wind },
    { titre: 'Dépressions', sous: 'ce qui se creuse', items: creux, Icon: Tornado },
    { titre: 'Brises', sous: 'ce qui effleure', items: diffuses, Icon: CloudFog },
  ];
  const renderAngleTick = ({ x, y, textAnchor, payload }: any) => {
    const item = radarData.find((d) => d.subject === payload.value);
    return (
      <CryptTick
        key={payload.value}
        x={x}
        y={y}
        textAnchor={textAnchor}
        text={payload.value}
        revealed={!!item?.revealed}
        animate={!!item?.animate}
        color={item?.color || '#6a6258'}
      />
    );
  };
  const renderRadarDot = ({ cx, cy, payload, index }: any) => {
    if (!payload || (payload.A as number) <= 0) return <g key={`dot-${index}`} />;
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={payload.color} stroke="#0a0a0a" strokeWidth={1} />;
  };

  // ── Variations · Microclimat (émotion × sphère) ──────────────────────────
  // emotionsBySphere peut arriver avec des clés hétérogènes : on re-normalise
  // et on fusionne, puis on classe les émotions de chaque sphère.
  const ebs = (data.emotionsBySphere || {}) as Record<string, Record<string, number>>;
  const sphereAgg: Record<string, Record<string, number>> = {};
  Object.keys(ebs).forEach((rawSphere) => {
    const k = normSphereKey(rawSphere);
    if (!k) return;
    if (!sphereAgg[k]) sphereAgg[k] = {};
    const emos = ebs[rawSphere] || {};
    Object.keys(emos).forEach((emo) => {
      sphereAgg[k][emo] = (sphereAgg[k][emo] || 0) + (emos[emo] || 0);
    });
  });
  const microclimats = (Object.entries(SPHERES) as [string, any][]).map(([skey, sval]) => {
    const counts = sphereAgg[skey] || {};
    const sorted = Object.entries(counts).sort((a, b) => (b[1] as number) - (a[1] as number));
    const total = sorted.reduce((s, [, c]) => s + (c as number), 0);
    const top = sorted.slice(0, 3).map(([k, c]) => {
      const emItem = (EMOTIONS as any)[k];
      return {
        key: k,
        color: emItem?.color || '#3a3420',
        label: emItem ? emItem.label.replace(/\s*\(Prisme\)/, '') : k,
        value: c as number,
        revealed: unlockedPrismes.has(k) || k === mainEmotion,
        animate: unlockedPrismes.has(k) && k !== mainEmotion && !seenPrismes.has(k),
      };
    });
    return { skey, label: sval.label, color: sval.color, total, top };
  });

  // ── Variations · Saisons (timeline hebdomadaire) ─────────────────────────
  const timeline = (Array.isArray(data.timeline) ? data.timeline : []) as any[];
  const maxWeekTotal = timeline.reduce((m, b) => Math.max(m, b.total || 0), 0) || 1;
  const fmtWeek = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen">
      {/* Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9999] opacity-60 mix-blend-soft-light" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>
      <ClarteSection section="climat" />

      <main className="max-w-[720px] mx-auto px-6 md:px-8 pt-16 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >

          {/* Page Title & description */}
          <div className="mb-16">
            <h1 className="font-serif italic text-[36px] md:text-[44px] font-medium text-beige leading-tight mb-4">
              Climat
            </h1>
            <p className="text-[15px] text-beige-faint leading-relaxed font-mono tracking-wide">
              Une représentation anonymisée des courants qui circulent au travers de la communauté. Des teintes singulières, une résonance commune.
            </p>
          </div>

          {/* Onglets : Maintenant (snapshot) / Variations (Saisons + Microclimat) */}
          <div className="flex items-center gap-6 mb-12">
            <button onClick={() => setView('maintenant')} className={`relative font-mono text-[11px] tracking-widest uppercase transition-colors pb-1 ${view === 'maintenant' ? 'text-beige' : 'text-beige-faint hover:text-beige'}`}>
              Maintenant
              {view === 'maintenant' && <motion.div layoutId="climat-tab-pill" className="absolute -bottom-0.5 left-0 right-0 h-px bg-beige/50" />}
            </button>
            <button onClick={() => setView('variations')} className={`relative font-mono text-[11px] tracking-widest uppercase transition-colors pb-1 ${view === 'variations' ? 'text-beige' : 'text-beige-faint hover:text-beige'}`}>
              Variations
              {view === 'variations' && <motion.div layoutId="climat-tab-pill" className="absolute -bottom-0.5 left-0 right-0 h-px bg-beige/50" />}
            </button>
          </div>

          {view === 'maintenant' && (
          <section className="space-y-16">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ClimateIcon className={`w-12 h-12 ${em ? '' : 'text-green'}`} strokeWidth={1.5} style={em ? { color: em.color } : {}} />
                <h3 className={`font-mono text-[11px] tracking-widest uppercase ${em ? '' : 'text-green'}`} style={em ? { color: em.color } : {}}>Résonance commune</h3>
              </div>
              <p className="font-mono text-[9px] tracking-wide text-beige-faint/60 leading-relaxed max-w-3xl">
                Celle qui prédomine et fait écho au plus de monde dans la communauté.
              </p>
              <div className={`bg-[#0d110d]/40 border-l-2 ${em ? '' : 'border-green/30'} p-8 rounded-r-lg backdrop-blur-sm`} style={em ? { borderLeftColor: em.color } : {}}>
              
              <p className="text-[18px] md:text-[20px] leading-[1.8] text-beige-faint italic antialiased max-w-3xl">
                En ce moment, la communauté chemine principalement à travers la <span className="not-italic underline underline-offset-4" style={em ? { color: em.color, textDecorationColor: `${em.color}40` } : { color: '#fdf5e6', textDecorationColor: 'rgba(253,245,230,0.25)' }}>{mainEmotion}</span>. 
                Aucun mot n'est partagé, mais la résonance est là. Vous n'êtes pas seul à décomposer le présent.
              </p>
            </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-2.5 max-w-2xl">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#C6AF53' }} />
                <p className="font-mono text-[10px] tracking-wide leading-relaxed italic text-beige-faint/70">
                  Les Prismes permettent de décrypter les émotions en vous, mais aussi de mieux lire le climat ambiant.
                </p>
              </div>
              <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col w-fit gap-1.5">
                  <div className="flex items-center gap-4">
                    <Gauge className="w-4 h-4 text-green" />
                    <h4 className="font-mono text-[9px] tracking-widest uppercase text-green">Relevé des courants</h4>
                  </div>
                  <div className="h-px bg-green/40" />
                </div>
                <div className="flex items-baseline gap-2 bg-[#0e0d08] border border-[#3a3420] rounded-sm px-3 py-1.5 shrink-0">
                  <span className="text-lg text-beige font-mono leading-none">{data.totalSessions}</span>
                  <span className="font-mono text-[8px] uppercase tracking-widest text-beige-faint">interactions</span>
                </div>
              </div>
              <p className="font-mono text-[9px] tracking-wide text-beige-faint/60 leading-relaxed max-w-2xl">
                Les courants qui circulent en ce moment, du plus dense au plus ténu.
              </p>
              </div>
              <div className="space-y-2.5">
                <div className="space-y-1.5 max-h-[252px] overflow-y-auto pr-1">
                {Object.entries(EMOTIONS)
                  .map(([key, emItem]) => ({ key, emItem, value: data.emotions[key] || 0 }))
                  .sort((a, b) => b.value - a.value)
                  .map(({ key, emItem, value }) => {
                    const hasData = value > 0;
                    const forced = key === mainEmotion;
                    const owned = unlockedPrismes.has(key);
                    const revealed = owned || forced;
                    const animate = owned && !forced && !seenPrismes.has(key);
                    return (
                      <div key={key} className={`flex items-center justify-between gap-3 bg-[#0e0d08] border ${hasData ? emItem.border : 'border-[#3a3420] opacity-30'} px-3 py-2 rounded-sm transition-opacity`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hasData ? emItem.color : '#3a3420' }} />
                          <CryptLabel text={emItem.label.replace(/\s*\(Prisme\)/, "")} revealed={revealed} animate={animate} className="font-mono text-[10px] uppercase tracking-wide truncate" />
                        </div>
                        <span className="font-mono text-sm tabular-nums shrink-0" style={{ color: hasData ? emItem.color : '#988e80' }}>{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
              <div className="flex flex-col w-fit gap-1.5">
                <div className="flex items-center gap-4">
                  <Compass className="w-4 h-4 text-lien" />
                  <h4 className="font-mono text-[9px] tracking-widest uppercase text-lien">Rose des vents</h4>
                </div>
                <div className="h-px bg-lien/40" />
              </div>
              <p className="font-mono text-[9px] tracking-wide text-beige-faint/60 leading-relaxed max-w-2xl">
                Elle se teinte selon l'intensité et la diversité des émotions qui traversent la communauté.
              </p>
              </div>
              <div className="h-[340px] md:h-[400px] w-full bg-[#0d110d]/20 rounded-lg p-6 md:p-12 border border-white/5 relative group">
                <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <defs>
                      <radialGradient id={radarFillId} cx="50%" cy="50%" r="75%">
                        {blendColors.map((c, i) => {
                          const n = blendColors.length;
                          const offset = n > 1 ? (i / (n - 1)) * 0.85 : 0;
                          const op = 0.42 - i * (0.30 / Math.max(1, n - 1));
                          return (
                            <stop
                              key={i}
                              offset={`${(offset * 100).toFixed(1)}%`}
                              stopColor={c}
                              stopOpacity={Math.max(0.1, op)}
                            />
                          );
                        })}
                        <stop offset="100%" stopColor={blendColors[blendColors.length - 1]} stopOpacity={0} />
                      </radialGradient>
                    </defs>
                    <PolarGrid stroke="#2a2820" />
                    <PolarAngleAxis dataKey="subject" tick={renderAngleTick} />
                    <Radar
                      name="Climat"
                      dataKey="A"
                      stroke={em ? em.color : '#6BA368'}
                      fill={`url(#${radarFillId})`}
                      fillOpacity={1}
                      dot={renderRadarDot}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
              <div className="flex flex-col w-fit gap-1.5">
                <div className="flex items-center gap-4">
                  <Activity className="w-4 h-4 text-affect" />
                  <h4 className="font-mono text-[9px] tracking-widest uppercase text-affect">Mouvement d'ensemble</h4>
                </div>
                <div className="h-px bg-affect/40" />
              </div>
              <p className="font-mono text-[9px] tracking-wide text-beige-faint/60 leading-relaxed max-w-2xl">
                Pas seulement ce qui gronde, mais aussi ce qui murmure, et ce qui manque — une accalmie dit autant qu'une tempête.
              </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {dynamiques.map((grp) => {
                  const lead = grp.items[0];
                  const borderColor = lead ? lead.color : '#3a3420';
                  const iconColor = lead ? lead.color : '#988e80';
                  const Icon = grp.Icon;
                  return (
                  <div key={grp.titre} className="bg-[#0e0d08] border border-[#3a3420] border-l-2 rounded-sm p-4 space-y-3" style={{ borderLeftColor: borderColor }}>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-5 h-5 shrink-0" style={{ color: iconColor }} />
                        <h5 className="font-mono text-xs tracking-widest uppercase text-beige-dim">{grp.titre}</h5>
                      </div>
                      <p className="font-mono text-[9px] tracking-wide text-beige-faint/50 italic mt-0.5">{grp.sous}</p>
                    </div>
                    {grp.items.length === 0 ? (
                      <p className="font-mono text-[10px] text-beige-faint/30">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {grp.items.map((e) => (
                          <span key={e.key} className="inline-flex items-center gap-1.5 bg-[#0a0a0a] border border-white/5 rounded-sm px-2 py-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                            <CryptLabel text={e.label} revealed={e.revealed} animate={e.animate} className="font-mono text-[9px] uppercase tracking-wide" />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          </section>
          )}

          {view === 'variations' && (
          <section className="space-y-16">
            {/* Saisons — évolution dans le temps (couleur Élan / blanc) */}
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex flex-col w-fit gap-1.5">
                  <div className="flex items-center gap-4">
                    <CalendarRange className="w-4 h-4 text-[#FAF9F6]" />
                    <h4 className="font-mono text-[9px] tracking-widest uppercase text-[#FAF9F6]">Saisons</h4>
                  </div>
                  <div className="h-px bg-[#FAF9F6]/40" />
                </div>
                <p className="font-mono text-[9px] tracking-wide text-beige-faint/60 leading-relaxed max-w-2xl">
                  Comment l'humeur de la communauté se déplace, semaine après semaine.
                </p>
              </div>
              {timeline.length < 2 ? (
                <p className="font-mono text-[10px] text-beige-faint/40 italic">
                  Pas encore assez de recul pour lire une évolution — reviens dans quelque temps.
                </p>
              ) : (
                <div>
                  <div className="flex items-end gap-1 h-28">
                    {timeline.map((b) => {
                      const c = (EMOTIONS as any)[b.dominant]?.color || '#3a3420';
                      const ratio = (b.total || 0) / maxWeekTotal;
                      const emItem = (EMOTIONS as any)[b.dominant];
                      const label = emItem ? emItem.label.replace(/\s*\(Prisme\)/, '') : (b.dominant || '');
                      const revealed = unlockedPrismes.has(b.dominant) || b.dominant === mainEmotion;
                      const animate = unlockedPrismes.has(b.dominant) && b.dominant !== mainEmotion && !seenPrismes.has(b.dominant);
                      return (
                        <div
                          key={b.period}
                          className="flex-1 rounded-sm transition-all flex items-end justify-center overflow-hidden"
                          style={{ backgroundColor: c, height: `${30 + 70 * ratio}%` }}
                          title={`${fmtWeek(b.period)} · ${b.total}`}
                        >
                          <CryptLabel text={label} revealed={revealed} animate={animate} color="rgba(10,10,10,0.8)" colorHidden="rgba(10,10,10,0.55)" className="font-mono text-[8px] uppercase tracking-wide [writing-mode:vertical-rl] rotate-180 py-1.5" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 font-mono text-[8px] uppercase tracking-widest text-beige-faint/40">
                    <span>{fmtWeek(timeline[0].period)}</span>
                    <span>{fmtWeek(timeline[timeline.length - 1].period)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Microclimat — émotion × sphère (couleur Matrice / mauve) */}
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex flex-col w-fit gap-1.5">
                  <div className="flex items-center gap-4">
                    <LayoutGrid className="w-4 h-4 text-matrice" />
                    <h4 className="font-mono text-[9px] tracking-widest uppercase text-matrice">Microclimat</h4>
                  </div>
                  <div className="h-px bg-matrice/40" />
                </div>
                <p className="font-mono text-[9px] tracking-wide text-beige-faint/60 leading-relaxed max-w-2xl">
                  Comment les différentes sphères de vie sont vécues par la communauté.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {microclimats.map((mc) => (
                  <div key={mc.skey} className="bg-[#0e0d08] border border-[#3a3420] border-l-2 rounded-sm p-4 space-y-3" style={{ borderLeftColor: mc.color }}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: mc.color }} />
                      <h5 className="font-mono text-xs tracking-widest uppercase" style={{ color: mc.color }}>{mc.label}</h5>
                    </div>
                    {mc.top.length === 0 ? (
                      <p className="font-mono text-[10px] text-beige-faint/30">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {mc.top.map((e) => (
                          <span key={e.key} className="inline-flex items-center gap-1.5 bg-[#0a0a0a] border border-white/5 rounded-sm px-2 py-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                            <CryptLabel text={e.label} revealed={e.revealed} animate={e.animate} className="font-mono text-[9px] uppercase tracking-wide" />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}
        </motion.div>
      </main>
    </div>
  );
}