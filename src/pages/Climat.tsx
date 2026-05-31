import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Cloud, 
  Sun, 
  Wind, 
  Umbrella, 
  Heart, 
  Trees, 
  Calendar, 
  History 
} from 'lucide-react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import { ClarteSection } from '../components/SerpentinGuide';

export default function Climat() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/climate')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getClimateIcon = (mainEmotion: string) => {
    switch(mainEmotion) {
      case 'joie': return <Sun className="text-yellow-500/40" size={32} />;
      case 'tristesse': return <Cloud className="text-blue-400/40" size={32} />;
      case 'colere': return <Wind className="text-red-400/40" size={32} />;
      case 'peur': return <Umbrella className="text-purple-400/40" size={32} />;
      default: return <Wind className="text-beige-faint/40" size={32} />;
    }
  };

  const EMOTIONS_CONFIG: Record<string, { color: string; border: string; label: string }> = {
    joie: { color: "#EA580C", border: "border-[#EA580C]/30", label: "Joie" },
    tristesse: { color: "#60A5FA", border: "border-[#60A5FA]/30", label: "Tristesse" },
    colere: { color: "#F87171", border: "border-[#F87171]/30", label: "Colère" },
    peur: { color: "#C084FC", border: "border-[#C084FC]/30", label: "Peur" },
    surprise: { color: "#34D399", border: "border-[#34D399]/30", label: "Surprise" },
    degoût: { color: "#A8A29E", border: "border-[#A8A29E]/30", label: "Dégoût" }
  };

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
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="inline-flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors mb-12">
            <ArrowLeft size={10} />
            <span>Retour</span>
          </button>
          <div className="text-center py-20">
            <h1 className="font-serif italic text-3xl font-medium text-beige mb-4">Climat en formation</h1>
            <p className="text-beige-dim text-sm max-w-md mx-auto leading-relaxed">
              Le climat affectif global nécessite qu'au moins 3 sessions distinctes soient enregistrées au sein du collectif pour se cristalliser de manière totalement anonyme. Reviens un peu plus tard.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const emotionEntries = Object.entries(data.emotions);
  const maxVal = Math.max(...Object.values(data.emotions) as number[]);
  const fullMark = maxVal > 0 ? maxVal : 1;

  const radarData = emotionEntries.map(([subject, value]) => ({
    subject: subject.charAt(0).toUpperCase() + subject.slice(1),
    A: value as number,
    fullMark: fullMark
  }));

  const sortedEmotions = [...emotionEntries].sort((a,b) => (b[1] as number) - (a[1] as number));
  const mainEmotion = sortedEmotions[0] ? sortedEmotions[0][0] : '...';
  const em = EMOTIONS_CONFIG[mainEmotion] || null;

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
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="inline-flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-beige-faint hover:text-beige transition-colors mb-12">
            <ArrowLeft size={10} />
            <span>Retour</span>
          </button>

          {/* Page Title & description */}
          <div className="mb-16">
            <h1 className="font-serif italic text-[36px] md:text-[44px] font-medium text-beige leading-tight mb-4">
              Climat affectif global
            </h1>
            <p className="text-[15px] text-beige-faint leading-relaxed font-mono tracking-wide">
              Une représentation poétique et anonymisée des affects qui circulent dans les coulisses du collectif.
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
              
              <div className="mt-10 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse"></div>
                <span className="font-mono text-[9px] tracking-widest text-beige-faint uppercase">
                  {data.totalSessions} sessions actives en ce moment
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <Trees className="w-4 h-4 text-beige-faint/60" />
                  <h4 className="font-mono text-[9px] tracking-widest uppercase text-beige-faint/60">Topographie des affects</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(EMOTIONS_CONFIG).slice(0, 4).map(([key, emItem]) => {
                    const value = data.emotions[key] || 0;
                    const hasData = value > 0;
                    return (
                      <div key={key} className={`bg-[#0e0d08] border ${hasData ? emItem.border : 'border-[#3a3420] opacity-30'} p-4 rounded-sm transition-opacity`}>
                        <div className="font-mono text-[8px] uppercase text-beige-faint mb-1">{emItem.label}</div>
                        <div className="text-xl" style={{ color: hasData ? emItem.color : 'inherit' }}>{value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <Calendar className="w-4 h-4 text-beige-faint/60" />
                  <h4 className="font-mono text-[9px] tracking-widest uppercase text-beige-faint/60">Volume des dépôts</h4>
                </div>
                <div className="bg-[#0e0d08] border border-[#3a3420] p-6 rounded-sm h-[130px] flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-green/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="text-center relative z-10">
                    <div className="text-3xl text-beige font-mono leading-none mb-2">{data.totalSessions}</div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-beige-faint">Interactions totales</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <History className="w-4 h-4 text-beige-faint/60" />
                <h4 className="font-mono text-[9px] tracking-widest uppercase text-beige-faint/60">Géométrie du collectif</h4>
              </div>
              <div className="h-[340px] md:h-[400px] w-full bg-[#0d110d]/20 rounded-lg p-6 md:p-12 border border-white/5 relative group">
                <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#2a2820" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6a6258', fontSize: 10, fontFamily: 'monospace' }} />
                    <Radar
                      name="Climat"
                      dataKey="A"
                      stroke={em ? em.color : '#6BA368'}
                      fill={em ? em.color : '#6BA368'}
                      fillOpacity={0.15}
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