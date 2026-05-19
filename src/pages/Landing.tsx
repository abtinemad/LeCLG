import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'motion/react';
import { Link } from 'react-router-dom';
import { BookOpen, Brain, Users, Cloud, Sun, Wind, Umbrella, Heart, Trees, Fingerprint, History, Calendar, Sparkles, Zap, Gem, Waves, Orbit, Network, Diamond, Grid3X3, Feather } from 'lucide-react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import { ClarteSection } from '../components/SerpentinGuide';
import { PaymentWrapper } from '../components/PaymentModal';

const ClimateViz = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/climate')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data || data.error || !data.emotions || data.totalSessions < 3) return null;

  const emotionEntries = Object.entries(data.emotions);
  if (emotionEntries.length === 0) return null;

  const maxVal = Math.max(...Object.values(data.emotions) as number[]);
  const fullMark = maxVal > 0 ? maxVal : 1;

  const radarData = emotionEntries.map(([subject, value]) => ({
    subject: subject.charAt(0).toUpperCase() + subject.slice(1),
    A: value as number,
    fullMark: fullMark
  }));

  const sortedEmotions = [...emotionEntries].sort((a,b) => (b[1] as number) - (a[1] as number));
  const mainEmotion = sortedEmotions[0] ? sortedEmotions[0][0] : '...';

  const EMOTIONS_CONFIG: Record<string, { color: string; border: string; label: string }> = {
    joie: { color: "#EA580C", border: "border-[#EA580C]/30", label: "Joie" },
    tristesse: { color: "#60A5FA", border: "border-[#60A5FA]/30", label: "Tristesse" },
    colere: { color: "#F87171", border: "border-[#F87171]/30", label: "Colère" },
    peur: { color: "#C084FC", border: "border-[#C084FC]/30", label: "Peur" },
    surprise: { color: "#34D399", border: "border-[#34D399]/30", label: "Surprise" },
    degoût: { color: "#A8A29E", border: "border-[#A8A29E]/30", label: "Dégoût" }
  };

  const em = EMOTIONS_CONFIG[mainEmotion] || null;

  const getClimateIcon = () => {
    switch(mainEmotion) {
      case 'joie': return <Sun className="text-yellow-500/40" size={32} />;
      case 'tristesse': return <Cloud className="text-blue-400/40" size={32} />;
      case 'colere': return <Wind className="text-red-400/40" size={32} />;
      case 'peur': return <Umbrella className="text-purple-400/40" size={32} />;
      default: return <Wind className="text-beige-faint/40" size={32} />;
    }
  };

  return (
    <section className="mb-32 space-y-16">
      <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8 flex items-center gap-2">
        <Users size={10} />
        Climat affectif global
      </div>

      <div className={`bg-[#0d110d]/40 border-l-2 ${em ? '' : 'border-green/30'} p-8 rounded-r-lg backdrop-blur-sm`} style={em ? { borderLeftColor: em.color } : {}}>
        <div className="flex items-center gap-4 mb-8">
          <Heart className={`w-5 h-5 ${em ? '' : 'text-green'}`} style={em ? { color: em.color } : {}} />
          <h3 className={`font-mono text-[11px] tracking-widest uppercase ${em ? '' : 'text-green'}`} style={em ? { color: em.color } : {}}>Résonance commune</h3>
        </div>
        
        <div className="mb-6">{getClimateIcon()}</div>
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
  );
};

const Step = ({ number, title, desc, note, index }: { number: string; title: string; desc: string; note: string; index: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, translateY: 20 }}
      animate={isInView ? { opacity: 1, translateY: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
      className="grid grid-cols-[48px_1fr] gap-x-6 py-8 border-t border-border last:border-b"
    >
      <div className="font-mono text-[11px] tracking-widest text-beige-faint pt-1">{number}</div>
      <div>
        <h3 className="font-serif text-lg font-medium text-beige mb-2">{title}</h3>
        <p className="text-sm leading-relaxed text-beige-dim">{desc}</p>
        <span className="inline-block mt-2 font-mono text-[8px] tracking-widest uppercase text-green opacity-70">{note}</span>
      </div>
    </motion.div>
  );
};

export default function Landing() {
  return (
    <div className="relative min-h-screen">
      {/* Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9999] opacity-60 mix-blend-soft-light" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>

      <nav className="fixed top-0 left-0 right-0 z-[999] flex justify-between items-center px-4 md:px-12 py-3 md:py-4 bg-bg/90 backdrop-blur-md border-b border-white/5">
        <Link to="/" className="flex items-center group">
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-beige-faint group-hover:text-beige-dim transition-colors">Le collègue</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/chat" className="font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-beige-faint hover:text-beige ring-1 ring-beige-faint/20 hover:bg-white/5">
            <Brain size={10} strokeWidth={1.5} />
            <span>penser</span>
          </Link>
          <Link to="/carnet" className="font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-beige-faint hover:text-beige ring-1 ring-beige-faint/20 hover:bg-white/5">
            <BookOpen size={10} strokeWidth={1.5} />
            <span>carnet</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-[720px] mx-auto px-6 md:px-8">
        {/* Hero */}
        <section className="min-h-screen flex flex-col justify-center pt-32 pb-12 md:pt-48 md:pb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="font-serif italic text-[clamp(40px,8vw,64px)] font-medium text-beige leading-[1.1] tracking-tight mb-8 mt-12 md:mt-24"
          >
            Quelque chose à démêler ?
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-[18px] md:text-[20px] leading-[1.8] text-beige-dim max-w-[540px] mb-12 antialiased"
          >
            Une pause au milieu du bruit. Le temps d'une conversation
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="flex flex-wrap items-center gap-6"
          >
            <Link to="/chat" className="font-mono text-[11px] tracking-widest uppercase text-bg bg-beige px-8 py-3.5 rounded-sm hover:opacity-85 transition-opacity">Penser maintenant</Link>
            <span className="font-mono text-[8px] tracking-widest text-beige-faint italic">Anonyme et confidentiel</span>
          </motion.div>
        </section>

        <ClarteSection section="landing" />

        <hr className="border-none border-t border-border my-20" />

        {/* Intro */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">Le problème</div>
          <p className="text-[18px] leading-[1.85] text-beige-dim mb-4">Penser, c'est se retrouver seul. Parfois sous pression, sans structure. Le bon réflexe est d'en parler à quelqu'un — un proche, un ami, quelqu'un de confiance. Mais ce quelqu'un n'est pas toujours disponible.</p>
          <p className="text-[18px] leading-[1.85] text-beige-dim mb-4">Et même quand il l'est, la conversation suit rarement un chemin qui permet de vraiment décomposer ce qu'on porte.</p>
          <blockquote className="italic text-[17px] text-beige-faint border-l border-green-dim pl-5 mt-6 leading-relaxed">
            Le collègue est là pour ça. Une présence disponible, une structure qui tient, un espace pour penser à voix haute.
          </blockquote>
        </section>

        <hr className="border-none border-t border-border my-20" />

        {/* Climate */}
        <ClimateViz />

        {/* Steps */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">Comment ça fonctionne</div>
          <div className="mb-12">
            <p className="text-[17px] leading-[1.85] text-beige-dim mb-4">Le collègue vous aide à décomposer ce que vous portez — pas pour trouver la bonne réponse, mais pour mettre des mots sur ce que vous traversez et cheminer vers un équilibre différent.</p>
            <p className="text-[17px] leading-[1.85] text-beige-dim">Il n'y a pas de chemin idéal — l'ordre s'ajuste à ce que vous portez et à ce que vous êtes.</p>
            <p className="italic text-[15px] text-beige-faint mt-4">L'IA comme vecteur. L'expérience humaine comme boussole.</p>
          </div>

          <div className="flex flex-col">
            <Step 
              index={0}
              number="01"
              title="La situation"
              desc="Vous décrivez ce qui se passe — les faits, le contexte, ce qui pose problème. Le collègue écoute et pose quelques questions pour comprendre ce qui est en jeu."
              note="Ce qui s'est passé"
            />
            <Step 
              index={1}
              number="02"
              title="Le ressenti"
              desc="Ce que la situation vous fait ressentir — une émotion, une intuition, un blocage, une tension physique. Pas une analyse, une donnée brute. Ce qui vient avant les mots."
              note="Ce que ça fait"
            />
            <Step 
              index={2}
              number="03"
              title="La diffraction"
              desc="Le regard des autres — collègues, proches, personnes impliquées. Voir la situation depuis d'autres angles, ou reconnaître qu'on est seul avec elle et ce que ça implique."
              note="Les autres regards"
            />
            <Step 
              index={3}
              number="04"
              title="La demande"
              desc="Ce qui est réellement demandé — pas la demande de surface, mais ce qui est au fond. Le collègue aide à formuler ce qu'on veut vraiment, une fois le ressenti digéré."
              note="Ce qu'on cherche vraiment"
            />
            <Step 
              index={4}
              number="05"
              title="L'équilibre"
              desc="Une direction qui émerge — pas forcément une décision tranchée, parfois un relâchement, une clarté partielle, une piste. Quelque chose de construit, pas subi. Vous le formulez vous-même."
              note="Ce qui se dégage"
            />
          </div>
          <div className="mt-12">
            <p className="italic text-[17px] text-beige-faint leading-relaxed">Accorder l'intérieur et l'extérieur pour chercher un équilibre</p>
          </div>
        </section>

        <hr className="border-none border-t border-border my-20" />

        {/* Le Carnet */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">La Sédimentation</div>
          <h2 className="font-serif italic text-[clamp(32px,5vw,42px)] font-medium text-beige leading-tight mb-8">Le Carnet</h2>
          
          <div className="space-y-6 max-w-[640px] mb-16">
            <p className="text-[18px] leading-[1.8] text-beige-dim antialiased">
              C'est la mémoire de votre trajectoire. Pas une simple archive, mais un lieu de continuité où chaque session laisse une trace, un fragment, un signal.
            </p>
            <p className="text-[18px] leading-[1.8] text-beige-dim antialiased">
              Conserver la mémoire de son cheminement, c'est se donner la chance d'en voir la cohérence. Chaque section du carnet extrait un niveau de sens différent de vos sessions.
            </p>
          </div>

          <div className="space-y-12">
            {/* Fragments */}
            <div className="gap-6 md:gap-8 items-start">
              <div>
                 <div className="flex items-center gap-2 mb-3">
                   <History className="w-4 h-4 text-white" />
                   <h3 className="font-mono text-[11px] uppercase tracking-widest text-white">Fragments</h3>
                 </div>
                 <p className="text-[14px] leading-relaxed text-beige-faint italic">L'empreinte brute de chaque session. Ce qui a été dit, le regard perçu et la direction prise.</p>
              </div>
            </div>

            {/* Lien */}
            <div className="gap-6 md:gap-8 items-start">
              <div>
                 <div className="flex items-center gap-2 mb-3">
                   <Heart className="w-4 h-4 text-[#EA580C]" />
                   <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#EA580C]">Lien</h3>
                 </div>
                 <p className="text-[14px] leading-relaxed text-beige-faint italic">L'état de vos relations, décanté par sphères (Amoureuse, Familiale, Sociale, Professionnelle).</p>
              </div>
            </div>

            {/* Affect */}
            <div className="gap-6 md:gap-8 items-start">
              <div>
                 <div className="flex items-center gap-2 mb-3">
                   <Waves className="w-4 h-4 text-[#7BA7D7]" />
                   <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#7BA7D7]">Affect</h3>
                 </div>
                 <p className="text-[14px] leading-relaxed text-beige-faint italic">La météo émotionnelle de fond, telle qu'elle ressort au-delà des mots et des circonstances.</p>
              </div>
            </div>

            {/* Elan */}
            <div className="gap-6 md:gap-8 items-start">
              <div>
                 <div className="flex items-center gap-2 mb-3">
                   <Orbit className="w-4 h-4 text-white" />
                   <h3 className="font-mono text-[11px] uppercase tracking-widest text-white">Élan</h3>
                 </div>
                 <p className="text-[14px] leading-relaxed text-beige-faint italic">La direction de vos mouvements profonds. Si vous êtes dans un cycle d'ouverture ou de reconstruction.</p>
              </div>
            </div>

            {/* Matrice */}
            <div className="gap-6 md:gap-8 items-start">
              <div>
                 <div className="flex items-center gap-2 mb-3">
                   <Fingerprint className="w-4 h-4 text-[#8B5CF6]" />
                   <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#8B5CF6]">Matrice</h3>
                 </div>
                 <p className="text-[14px] leading-relaxed text-beige-faint italic">Le code source. Les angoisses de fond, le système de défense et l'exigence centrale qui vous anime.</p>
              </div>
            </div>
            
            {/* Lueurs */}
            <div className="gap-6 md:gap-8 items-start">
              <div>
                 <div className="flex items-center gap-2 mb-3">
                   <Sparkles className="w-4 h-4 text-[#FACC15]" />
                   <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#FACC15]">Lueurs</h3>
                 </div>
                 <p className="text-[14px] leading-relaxed text-beige-faint italic">L'aboutissement mensuel. Une condensation visuelle et poétique de tout ce qui a été documenté.</p>
              </div>
            </div>
          </div>
          
          <div className="pt-16 pb-4">
            <Link to="/carnet" className="font-mono text-[11px] tracking-widest uppercase text-beige bg-white/5 hover:bg-white/10 px-8 py-3 rounded-sm border border-white/10 flex items-center gap-3 transition-all group w-fit">
              <span>Explorer le carnet</span>
              <BookOpen size={12} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>

        <hr className="border-none border-t border-border my-20" />

        {/* Diff */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">Ce qui le rend différent</div>
          <div className="grid md:grid-cols-2 gap-[1px] bg-border border border-border mt-4 overflow-hidden rounded-sm">
            <div className="bg-bg p-7 self-stretch h-full">
              <div className="font-mono text-[8px] tracking-widest uppercase text-beige-faint mb-2.5">Les autres outils</div>
              <div className="text-[15px] leading-[1.75] text-beige-dim">Standardisent. Scorent. Recommandent. Donnent une réponse. Accélèrent.</div>
            </div>
            <div className="bg-bg p-7 self-stretch h-full">
              <div className="font-mono text-[8px] tracking-widest uppercase text-beige-faint mb-2.5">Le collègue</div>
              <div className="text-[15px] leading-[1.75] text-beige-dim">Ralentit. Ouvre. Déplace.</div>
            </div>
            <div className="bg-bg p-7 self-stretch h-full">
              <div className="font-mono text-[8px] tracking-widest uppercase text-beige-faint mb-2.5">Intelligence artificielle</div>
              <div className="text-[15px] leading-[1.75] text-beige-dim">L'IA comme vecteur — traite, génère, répond.</div>
            </div>
            <div className="bg-bg p-7 self-stretch h-full">
              <div className="font-mono text-[8px] tracking-widest uppercase text-beige-faint mb-2.5">Expérience humaine</div>
              <div className="text-[15px] leading-[1.75] text-beige-dim">Une posture clinique réelle, infusée et traduite en conversation. Pas un protocole.</div>
            </div>
          </div>
          
          <div className="mt-16 mb-20 text-center">
            <p className="text-xl md:text-2xl leading-[1.6] text-beige tracking-tight font-serif italic">Le moteur de recherche intérieur.</p>
            <p className="italic text-[16px] text-beige-faint mt-2 font-serif">Pas pour trouver des réponses sur le monde — pour chercher en soi.</p>
            <div className="mt-6 italic text-[13px] text-beige-faint">Conçu par Abtine, psychiatre de secteur</div>
          </div>

          <div className="mt-12 text-center border-t border-border/30 pt-10">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 border border-border/20 rounded-full mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40"></div>
              <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-beige-faint">Confidentialité totale</span>
            </div>
            <p className="text-[16px] leading-[1.8] text-beige-dim antialiased italic px-4 max-w-xl mx-auto">
              Vos échanges ne sont jamais utilisés pour entraîner des modèles. Votre conversation est éphémère et disparaît dès la fin de session, tandis que votre carnet cristallise votre cheminement de manière pérenne et privée.
            </p>
          </div>

        </section>

        {/* Le Système / Structure */}
        <section className="py-20 border-t border-border">
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-16 text-center">La Structure</div>
          
          <div className="space-y-32">
            {/* Gratuit */}
            <div className="flex flex-col items-center gap-16">
              <div className="text-center space-y-4 max-w-md">
                <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige">Gratuit — Le Socle</h3>
                <p className="text-[15px] text-beige-faint antialiased leading-relaxed italic">
                  Conversation, carte de réflexion, Prismes, Lien, Affect, Élan, Matrice. Tout ce qui aide à se connaître, dans un espace anonyme et confidentiel sans engagement.
                </p>
                <div className="font-mono text-[9px] text-green/60 uppercase tracking-widest pt-2">Accès Libre</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-20 gap-x-16 md:gap-x-24 place-items-center w-full">
                {[
                  { icon: <History size={80} strokeWidth={1} />, label: "Fragments", color: "text-beige-faint", sub: "Analyse des fragments" },
                  { icon: <Gem size={80} strokeWidth={1} />, label: "Prismes", color: "text-[#FACC15]", sub: "Décryptage du signal émotionnel" },
                  { icon: <Heart size={80} strokeWidth={1} />, label: "Liens", color: "text-[#EA580C]", sub: "Sédimentation sociale" },
                  { icon: <Waves size={80} strokeWidth={1} />, label: "Affects", color: "text-[#7BA7D7]", sub: "Climat affectif" },
                  { icon: <Orbit size={80} strokeWidth={1} />, label: "Élan", color: "text-white", sub: "Vecteur de mouvement" },
                  { icon: <Fingerprint size={80} strokeWidth={1} />, label: "Matrice", color: "text-[#8B5CF6]", sub: "Structure du fond" }
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-6 group">
                    <div className={`${item.color} ${item.label === 'Matrice' ? 'opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.05)]' : 'opacity-80 group-hover:opacity-100'} transition-all duration-500 scale-100 group-hover:scale-110`}>{item.icon}</div>
                    <div className="flex flex-col items-center gap-2">
                      <div className={`font-mono text-[11px] uppercase tracking-[0.4em] ${item.color} ${item.label === 'Matrice' ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'} transition-all text-center font-medium`}>{item.label}</div>
                      <div className={`font-serif text-[9px] italic ${item.color} ${item.label === 'Matrice' ? 'opacity-80' : 'opacity-50'} group-hover:opacity-70 transition-opacity tracking-wider text-center`}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Évolution */}
            <div className="grid md:grid-cols-[1fr_2fr] gap-12 md:gap-20 border-t border-border/30 pt-16">
              <div className="space-y-4">
                <div className="flex items-center gap-2 group">
                  <Sparkles size={24} className="text-[#f59e0b] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.2} />
                  <PaymentWrapper
                    paypalUrl="https://www.paypal.com/donate/?business=REDACTED&no_recurring=0&currency_code=EUR"
                    title="Évolution"
                    amount="5€ / mois ou soutient libre"
                    color="text-[#f59e0b]"
                  >
                    <h3 className="font-mono text-[11px] tracking-widest uppercase text-[#f59e0b] cursor-pointer">Évolution</h3>
                  </PaymentWrapper>
                </div>
                <p className="text-[15px] text-beige-faint antialiased leading-relaxed italic">
                  Le financement d'un mouvement. « Évolution » porte le cheminement ; « Reconnaissance » en désigne l'aboutissement : le passage d'une recherche à une posture d'équilibre.
                </p>
                <div className="font-mono text-[9px] text-[#f59e0b]/50 uppercase tracking-widest pt-2">5€ / mois</div>
              </div>
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Sparkles size={20} className="text-[#f59e0b]/40" strokeWidth={1.5} />
                  <h4 className="font-serif text-lg italic text-beige">La Mémoire Évolutive</h4>
                </div>
                <div className="flex items-start gap-4">
                  <Sparkles size={32} className="text-[#f59e0b] opacity-20 mt-1 shrink-0" strokeWidth={1} />
                  <p className="text-[16px] text-beige-dim leading-relaxed">
                    Accès illimité aux Analyses Évolutives. Le système mémorise la progression de vos structures (Lien, Affect, Élan, Matrice) et l'empreinte émotionnelle de vos signaux vocaux d'une session à l'autre pour une compréhension sur le long terme.
                  </p>
                </div>
                <div className="p-5 bg-green/5 border border-green/20 rounded-xl space-y-3">
                  <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-green flex items-center gap-2">
                    <Sparkles size={10} className="animate-pulse" />
                    <span>Mode Reconnaissance — L'Aboutissement</span>
                  </div>
                  <p className="text-[14px] text-beige leading-relaxed italic border-l border-green/30 pl-4 py-1">
                    « L'abonnement Évolution finance la continuité — la mémoire, les Lueurs, le Carnet complet, et les coûts d'API. Après un an de pratique régulière, quand les 10 Prismes sont découverts et toutes les sections du Carnet actives, l'abonnement se transforme en <strong>mode Reconnaissance</strong>. L'accès devient gratuit et permanent. Pas une récompense — une reconnaissance du passage d'un mouvement à une posture d'équilibre. »
                  </p>
                </div>
              </div>
            </div>

            {/* Éclat */}
            <div className="grid md:grid-cols-[1fr_2fr] gap-12 md:gap-20 border-t border-border/30 pt-16">
              <div className="space-y-4">
                <div className="flex items-center gap-2 group">
                  <Zap size={24} className="text-white opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.2} />
                  <PaymentWrapper
                    paypalUrl="https://www.paypal.com/donate/?business=REDACTED&no_recurring=0&currency_code=EUR"
                    title="L'Éclat"
                    amount="Don libre"
                    color="text-white"
                  >
                    <h3 className="font-mono text-[11px] tracking-widest uppercase text-white cursor-pointer">L'Éclat</h3>
                  </PaymentWrapper>
                </div>
                <p className="text-[15px] text-beige-faint antialiased leading-relaxed italic">
                  Invocation ponctuelle. Vous recevez votre lueur, puis donnez ce que l'expérience valait pour vous.
                </p>
              </div>
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Zap size={20} className="text-white/40" strokeWidth={1.5} />
                  <h4 className="font-serif text-lg italic text-beige">Lecture collaborative</h4>
                </div>
                <p className="text-[16px] text-beige-dim leading-relaxed">
                  Une lecture approfondie qui nécessite de mener une réflexion sur la demande formulée par la personne. Accompagné par une analyse humaine visant à apporter un regard extérieur visionnaire sur votre situation. Don libre à faire (ou pas) après avoir reçu sa lueur.
                </p>
              </div>
            </div>

            {/* Early Access */}
            <div className="grid md:grid-cols-[1fr_2fr] gap-12 md:gap-20 border-t border-border/30 pt-16">
              <div className="space-y-4">
                <div className="flex items-center gap-2 group">
                  <Gem size={24} className="text-green opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.2} />
                  <PaymentWrapper
                    paypalUrl="https://www.paypal.com/donate/?business=REDACTED&no_recurring=0&currency_code=EUR"
                    title="Early Access"
                    amount="50€"
                    color="text-green"
                  >
                    <h3 className="font-mono text-[11px] tracking-widest uppercase text-green cursor-pointer">Early Access</h3>
                  </PaymentWrapper>
                </div>
                <p className="text-[15px] text-beige-faint antialiased leading-relaxed italic">
                  Évolution permanent. Pour ceux qui croient dans le projet dès le début.
                </p>
                <div className="font-mono text-[9px] text-green/60 uppercase tracking-widest pt-2">50€ · Une fois</div>
              </div>
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Gem size={20} className="text-green/40" strokeWidth={1.5} />
                  <h4 className="font-serif text-lg italic text-beige">Évolution Permanent</h4>
                </div>
                <p className="text-[16px] text-beige-dim leading-relaxed">
                  Accès définitif à toutes les fonctionnalités actuelles et futures (incluant les Analyses Évolutives). Soutien majeur au développement indépendant du Collègue.
                </p>
              </div>
            </div>

            {/* Soutien Libre */}
            <div className="grid md:grid-cols-[1fr_2fr] gap-12 md:gap-20 border-t border-border/30 pt-16">
              <div className="space-y-4">
                <div className="flex items-center gap-2 group">
                  <Heart size={24} className="text-red-400 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.2} />
                  <PaymentWrapper
                    paypalUrl="https://www.paypal.com/donate/?business=REDACTED&no_recurring=0&currency_code=EUR"
                    title="Don libre"
                    color="text-red-400"
                  >
                    <h3 className="font-mono text-[11px] tracking-widest uppercase text-beige hover:text-white transition-colors cursor-pointer">Don libre</h3>
                  </PaymentWrapper>
                </div>
                <p className="text-[15px] text-beige-faint antialiased leading-relaxed italic">
                  Un projet indépendant, une seule personne derrière. Votre don va directement ici.
                </p>
                <div className="font-mono text-[9px] text-beige-faint/40 uppercase tracking-widest pt-2">À tout moment</div>
              </div>
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Heart size={20} className="text-red-400/40" strokeWidth={1.5} />
                  <h4 className="font-serif text-lg italic text-beige">Soutien</h4>
                </div>
                <p className="text-[16px] text-beige-dim leading-relaxed">
                  Le collègue est un projet indépendant, conçu et maintenu par une seule personne. Si cet outil vous a apporté quelque chose, un don libre contribue directement à la poursuite de son développement.
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-none border-t border-border my-20" />
        <section className="py-12">
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-12">La posture</div>
          
          <div className="grid md:grid-cols-2 gap-16">
            <div className="space-y-4">
              <h3 className="font-serif text-xl text-beige italic">Anonymat</h3>
              <p className="text-[16px] leading-relaxed text-beige-dim antialiased">
                Pas d'adresse mail, pas de nom. Seule votre Clé-LCLG permet de relier vos sessions entre elles. C'est votre unique identité, conservée sur votre appareil.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-serif text-xl text-beige italic">Confidentialité</h3>
              <p className="text-[16px] leading-relaxed text-beige-dim antialiased">
                Vos conversations s'effacent dès la fin de session. Ce qui reste, ce sont vos propres fragments et votre structure. L'essentiel est mémorisé, le superflu disparaît.
              </p>
            </div>
          </div>
        </section>

        <hr className="border-none border-t border-border my-20" />

        {/* CTA */}
        <section className="py-28 text-center relative overflow-hidden">
          <div className="relative group mx-auto mb-14 inline-block">
            <div className="w-24 h-24 rounded-full border border-beige-faint/10 p-1 flex items-center justify-center transition-all duration-700">
              <div className="w-full h-full rounded-full border border-border flex items-center justify-center bg-bg/50 backdrop-blur-sm shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
                <img src="/logo.png" alt="" className="w-2/3 h-2/3 object-contain opacity-20 group-hover:opacity-100 transition-all duration-700 grayscale group-hover:grayscale-0" />
              </div>
            </div>
          </div>

          <h2 className="font-serif italic text-[clamp(28px,5vw,38px)] font-medium text-beige leading-tight mb-5 max-w-[500px] mx-auto">Quelque chose à démêler ?</h2>
          <p className="italic text-[16px] text-beige-faint mb-12">Anonyme et confidentiel, sans enregistrement.</p>
          <Link to="/chat" className="font-mono text-[13px] tracking-widest uppercase text-bg bg-beige px-12 py-4 rounded-sm hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] inline-block shadow-lg shadow-black/10">Penser maintenant</Link>
        </section>

        <footer className="border-t border-border/30 pt-16 pb-12 mt-8">
          <div className="font-mono text-[8px] tracking-widest text-beige-faint uppercase">Le collègue n'est pas un outil de soin.<br />3114 disponible 24h/24 en cas de besoin</div>
        </footer>
      </main>
    </div>
  );
}
