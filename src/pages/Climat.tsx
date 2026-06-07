import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useGoBack } from '../lib/useGoBack';
import { EMOTIONS } from '../data/emotions';
import { 
  ArrowLeft,
  Cloud, 
  Sun, 
  Wind, 
  Umbrella, 
  Heart, 
  Trees, 
  History,
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

function CryptLabel({ text, revealed, animate, className }: { text: string; revealed: boolean; animate: boolean; className?: string }) {
  const display = useDecrypt(text, revealed, animate);
  return (
    <span className={className} style={{ color: revealed ? "#cfc2b1" : "#6a6258" }}>
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

export default function Climat() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const goBack = useGoBack();

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

  // Icône météo par émotion ; la teinte vient de la source (EMOTIONS), à 40 %.
  const CLIMATE_ICONS: Record<string, typeof Sun> = {
    joie: Sun, tristesse: Cloud, colere: Wind, peur: Umbrella,
  };
  const getClimateIcon = (mainEmotion: string) => {
    const Icon = CLIMATE_ICONS[mainEmotion] ?? Wind;
    const c = EMOTIONS[mainEmotion as keyof typeof EMOTIONS]?.color;
    return <Icon size={32} className={c ? "" : "text-beige-faint/40"} style={c ? { color: c, opacity: 0.4 } : {}} />;
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
        <main className="max-w-[720px] mx-auto px-6 md:px-8 pt-24 pb-32">
          <button onClick={goBack} className="inline-flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors mb-12">
            <ArrowLeft size={10} />
            <span>Retour</span>
          </button>
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

  const radarData = Object.entries(EMOTIONS).map(([key, emItem]) => ({
    subject: emItem.label.replace(/\s*\(Prisme\)/, ""),
    A: (data.emotions[key] as number) || 0,
    fullMark,
    color: emItem.color,
    key,
    revealed: unlockedPrismes.has(key),
    animate: unlockedPrismes.has(key) && !seenPrismes.has(key),
  }));

  const sortedEmotions = [...emotionEntries].sort((a,b) => (b[1] as number) - (a[1] as number));
  const mainEmotion = sortedEmotions[0] ? sortedEmotions[0][0] : '...';
  const em = EMOTIONS[mainEmotion as keyof typeof EMOTIONS] || null;

  // Arc-en-ciel Plutchik : chaque axe et chaque sommet porte la couleur de son Prisme,
  // mais seulement s'il est débloqué ; sinon le label grésille et le point reste neutre.
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
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={payload.revealed ? payload.color : '#3a3420'} stroke="#0a0a0a" strokeWidth={1} />;
  };

  return (
    <div className="relative min-h-screen">
      {/* Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9999] opacity-60 mix-blend-soft-light" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>
      <ClarteSection section="climat" />

      <main className="max-w-[720px] mx-auto px-6 md:px-8 pt-24 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <button onClick={goBack} className="inline-flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors mb-12">
            <ArrowLeft size={10} />
            <span>Retour</span>
          </button>

          {/* Page Title & description */}
          <div className="mb-16">
            <h1 className="font-serif italic text-[36px] md:text-[44px] font-medium text-beige leading-tight mb-4">
              Climat ambiant
            </h1>
            <p className="text-[15px] text-beige-faint leading-relaxed font-mono tracking-wide">
              Une représentation anonymisée des affects qui circulent sous la surface de la communauté. Des teintes singulières, une résonance commune.
            </p>
          </div>

          <section className="space-y-16">
            <div className={`bg-[#0d110d]/40 border-l-2 ${em ? '' : 'border-green/30'} p-8 rounded-r-lg backdrop-blur-sm`} style={em ? { borderLeftColor: em.color } : {}}>
              <div className="flex items-center gap-4 mb-8">
                <Heart className={`w-5 h-5 ${em ? '' : 'text-green'}`} style={em ? { color: em.color } : {}} />
                <h3 className={`font-mono text-[11px] tracking-widest uppercase ${em ? '' : 'text-green'}`} style={em ? { color: em.color } : {}}>Résonance commune</h3>
              </div>
              
              <div className="mb-6">{getClimateIcon(mainEmotion)}</div>
              <p className="text-[18px] md:text-[20px] leading-[1.8] text-beige-faint italic antialiased max-w-3xl">
                En ce moment, la communauté chemine principalement à travers la <span className="text-beige not-italic underline decoration-beige/20 underline-offset-4">{mainEmotion}</span>. 
                Aucun mot n'est partagé, mais la résonance est là. Vous n'êtes pas seul à décomposer le présent.
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Trees className="w-4 h-4 text-beige-faint/60" />
                  <h4 className="font-mono text-[9px] tracking-widest uppercase text-beige-faint/60">Topographie des émotions</h4>
                </div>
                <div className="flex items-baseline gap-2 bg-[#0e0d08] border border-[#3a3420] rounded-sm px-3 py-1.5 shrink-0">
                  <span className="text-lg text-beige font-mono leading-none">{data.totalSessions}</span>
                  <span className="font-mono text-[8px] uppercase tracking-widest text-beige-faint">interactions</span>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <Lock className="w-3 h-3 text-beige-faint/50 shrink-0 mt-0.5" />
                  <p className="font-mono text-[9px] tracking-wide text-beige-faint/60 leading-relaxed">
                    Chaque émotion traversée jusqu'à l'équilibre vous donne un Prisme, symbole de clairvoyance. Savoir les lire, les accueillir et les rendre sans les déformer, en soi comme chez les autres : ainsi l'émotion relie au lieu de diviser, et rapproche la communauté de son harmonie.
                  </p>
                </div>
                <div className="space-y-1.5 max-h-[252px] overflow-y-auto pr-1">
                {Object.entries(EMOTIONS)
                  .map(([key, emItem]) => ({ key, emItem, value: data.emotions[key] || 0 }))
                  .sort((a, b) => b.value - a.value)
                  .map(({ key, emItem, value }) => {
                    const hasData = value > 0;
                    const revealed = unlockedPrismes.has(key);
                    const animate = revealed && !seenPrismes.has(key);
                    return (
                      <div key={key} className={`flex items-center justify-between gap-3 bg-[#0e0d08] border ${hasData ? (revealed ? emItem.border : 'border-[#3a3420]') : 'border-[#3a3420] opacity-30'} px-3 py-2 rounded-sm transition-opacity`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: revealed && hasData ? emItem.color : '#3a3420' }} />
                          <CryptLabel text={emItem.label.replace(/\s*\(Prisme\)/, "")} revealed={revealed} animate={animate} className="font-mono text-[10px] uppercase tracking-wide truncate" />
                        </div>
                        <span className="font-mono text-sm tabular-nums shrink-0" style={{ color: revealed && hasData ? emItem.color : '#988e80' }}>{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <History className="w-4 h-4 text-beige-faint/60" />
                <h4 className="font-mono text-[9px] tracking-widest uppercase text-beige-faint/60">Géométrie de la communauté</h4>
              </div>
              <div className="h-[340px] md:h-[400px] w-full bg-[#0d110d]/20 rounded-lg p-6 md:p-12 border border-white/5 relative group">
                <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#2a2820" />
                    <PolarAngleAxis dataKey="subject" tick={renderAngleTick} />
                    <Radar
                      name="Climat"
                      dataKey="A"
                      stroke={em ? em.color : '#6BA368'}
                      fill={em ? em.color : '#6BA368'}
                      fillOpacity={0.15}
                      dot={renderRadarDot}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
}