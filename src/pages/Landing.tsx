import { useRef, useEffect } from 'react';
import { motion, useInView } from 'motion/react';
import { Link } from 'react-router-dom';
import { Heart, Fingerprint, History, Waves, Orbit, Sparkles, Gem, ArrowDown } from 'lucide-react';
import { ClarteSection } from '../components/SerpentinGuide';
import { PaymentWrapper } from '../components/PaymentModal';
import { LogoEmber } from '../components/LogoEmber';


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
  // Boucle douce, mais en DEUX temps : arriver en bas bloque normalement.
  // Il faut un NOUVEAU geste — lancé alors qu'on est déjà tout en bas — pour
  // réenrouler vers le haut. Le geste qui descend jusqu'au bas ne compte jamais
  // (on mémorise, au début de chaque geste, si on était déjà au bas).
  // Écouteurs passifs → aucun détournement du scroll en cours, aucun à-coup.
  useEffect(() => {
    let wheelAccum = 0;
    let touchStartY = 0;
    let startedAtBottom = false; // était-on déjà au bas au début du geste ?
    let lastWheel = 0;
    let cooling = false;

    const atBottom = () =>
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 3;

    const wrapToTop = () => {
      if (cooling) return;
      cooling = true;
      wheelAccum = 0;
      startedAtBottom = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => {
        cooling = false;
      }, 1300);
    };

    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      // Une pause > 250 ms démarre une nouvelle « rafale » : on regarde alors
      // si elle commence au bas. La rafale qui amène au bas commence plus haut.
      if (now - lastWheel > 250) {
        startedAtBottom = atBottom();
        wheelAccum = 0;
      }
      lastWheel = now;
      if (startedAtBottom && atBottom() && e.deltaY > 0) {
        wheelAccum += e.deltaY;
        if (wheelAccum > 200) wrapToTop();
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      startedAtBottom = atBottom(); // ce geste a-t-il démarré tout en bas ?
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!startedAtBottom || !atBottom()) return;
      // swipe vers le haut (le doigt remonte) = tenter de scroller plus bas
      if (touchStartY - e.touches[0].clientY > 70) wrapToTop();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9999] opacity-60 mix-blend-soft-light" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>

      <main className="max-w-[720px] mx-auto px-6 md:px-8">
        {/* Hero */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center pt-32 pb-12 md:pt-40">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.1, ease: "easeOut" }}
            className="w-32 h-32 md:w-40 md:h-40 mb-12 flex items-center justify-center"
          >
            <LogoEmber className="w-full h-full" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="font-serif italic text-[clamp(40px,8vw,64px)] font-medium text-beige leading-[1.1] tracking-tight mb-8 max-w-[600px]"
          >
            Quelque chose à démêler ?
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-[18px] md:text-[20px] leading-[1.8] text-beige-dim max-w-[520px] mb-12 antialiased"
          >
            Une pause au milieu du bruit, le temps d'une conversation.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            className="flex flex-col items-center gap-5"
          >
            <Link to="/chat" className="font-mono text-[11px] tracking-widest uppercase text-bg bg-beige px-10 py-4 rounded-sm hover:opacity-85 transition-opacity">Penser maintenant</Link>
            <span className="font-mono text-[8px] tracking-widest text-beige-faint italic">Anonyme et confidentiel</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.95 }}
            className="mt-16 font-mono text-[8px] tracking-widest text-beige-faint/60 uppercase leading-[1.9] max-w-[320px]"
          >
            Le collègue n'est pas un outil de soin.<br />3114 disponible 24h/24 en cas de besoin.
          </motion.p>
        </section>

        <hr className="border-none border-t border-border my-14" />

        {/* Intro */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">Le problème</div>
          <p className="text-[18px] leading-[1.85] text-beige-dim mb-4">Penser, c'est se retrouver seul. Parfois sous pression, sans structure. Le bon réflexe est d'en parler à quelqu'un — un proche, un ami, quelqu'un de confiance. Mais ce quelqu'un n'est pas toujours disponible.</p>
          <p className="text-[18px] leading-[1.85] text-beige-dim mb-4">Et seul, il arrive que les pensées tournent en rond et s'emmêlent, sans qu'on sache comment les dénouer.</p>
          <blockquote className="italic text-[17px] text-beige-faint border-l border-green-dim pl-5 mt-6 leading-relaxed">
            Le collègue est là pour ça. Une présence disponible, une structure qui tient, un espace pour penser à voix haute.
            <br /><br />
            Et d'une fois à l'autre, un fil — pour que ces pensées finissent par faire sens.
          </blockquote>
        </section>

        <hr className="border-none border-t border-border my-14" />

        {/* Steps */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">Comment ça fonctionne</div>
          <div className="mb-12">
            <p className="text-[17px] leading-[1.85] text-beige-dim mb-4">Le collègue vous aide à décomposer ce que vous portez — pas pour trouver la bonne réponse, mais pour mettre des mots sur ce que vous traversez et cheminer vers un équilibre différent.</p>
            <p className="text-[17px] leading-[1.85] text-beige-dim">Il n'y a pas de chemin idéal — l'ordre s'ajuste à ce que vous portez et à ce que vous êtes.</p>
          </div>

          <div className="mb-8 font-mono text-[8px] tracking-[0.18em] uppercase text-beige-faint/40">
            Interface de réflexion éphémère
          </div>

          <div className="flex flex-col">
            <Step 
              index={0}
              number="01"
              title="La situation"
              desc="Vous posez ce qui se passe — les faits, le contexte, ce qui pèse."
              note="Ce qui se passe"
            />
            <Step 
              index={1}
              number="02"
              title="Le ressenti"
              desc="Ce que la situation fait remonter — une émotion, une sensation dans le corps, une intuition. Ce qui vient avant les mots."
              note="Ce que ça fait"
            />
            <Step 
              index={2}
              number="03"
              title="La demande"
              desc="Ce qui est vraiment demandé, une fois le ressenti digéré. Pas la demande de départ — celle qui devient pensable, formulable."
              note="Ce qu'on cherche vraiment"
            />
            <Step 
              index={3}
              number="04"
              title="La diffraction"
              desc="Le regard des autres. Un angle qu'on ne peut pas construire seul. Ou le constat qu'on est resté seul avec la situation, et ce que ça change."
              note="Les autres regards"
            />
            <Step 
              index={4}
              number="05"
              title="L'équilibre"
              desc="Une direction qui se dégage — pas forcément une décision, parfois un relâchement, une clarté, une piste. On la reconnaît au fait que ça respire mieux, pas à ce que tout soit résolu."
              note="Ce qui se dégage"
            />
          </div>
        </section>

        <hr className="border-none border-t border-border my-14" />

        {/* Le Carnet */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">Comment ça prend forme</div>
          <h2 className="font-serif italic text-[clamp(32px,5vw,42px)] font-medium text-beige leading-tight mb-8">Le Carnet</h2>
          
          <div className="space-y-6 max-w-[640px] mb-12">
            <p className="text-[18px] leading-[1.8] text-beige-dim antialiased">
              C'est la mémoire de votre trajectoire. Pas une archive figée, mais un sol qui se forme : chaque session y dépose sa couche.
            </p>
            <p className="text-[18px] leading-[1.8] text-beige-dim antialiased">
              Ses sections en lisent chacune une profondeur différente — de la surface encore mouvante jusqu'aux strates les plus profondes.
            </p>
          </div>

          <div className="mb-8 font-mono text-[8px] tracking-[0.18em] uppercase text-beige-faint/40">
            Interface de mémoire pérenne
          </div>

          <div className="space-y-12">
            {/* Fragments */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-green" />
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-green">Fragments</h3>
              </div>
              <p className="text-[14px] leading-relaxed text-beige-faint italic">La trace de chaque session — ce qui s'est dit, ce qui a bougé, et la direction prise en repartant.</p>
            </div>

            {/* Lien */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-[#EA580C]" />
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#EA580C]">Lien</h3>
              </div>
              <p className="text-[14px] leading-relaxed text-beige-faint italic">L'état de vos liens — amoureux, familiaux, sociaux, professionnels : ce qui se tend, ce qui se répare, ce qui tient.</p>
            </div>

            {/* Affect */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Waves className="w-4 h-4 text-[#7BA7D7]" />
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#7BA7D7]">Affect</h3>
              </div>
              <p className="text-[14px] leading-relaxed text-beige-faint italic">La tonalité émotionnelle qui revient d'une session à l'autre, au-delà des hauts et des bas de chaque jour.</p>
            </div>

            {/* Élan */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Orbit className="w-4 h-4 text-white" />
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-white">Élan</h3>
              </div>
              <p className="text-[14px] leading-relaxed text-beige-faint italic">Le sens vers lequel vous allez en ce moment — une période d'ouverture, de repli, ou de reconstruction.</p>
            </div>

            {/* Matrice */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Fingerprint className="w-4 h-4 text-[#8B5CF6]" />
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#8B5CF6]">Matrice</h3>
              </div>
              <p className="text-[14px] leading-relaxed text-beige-faint italic">La couche la plus profonde, ce qui structure tout le reste : la tension de fond, votre manière de tenir, et l'exigence qui vous met en mouvement.</p>
            </div>
          </div>
        </section>

        <hr className="border-none border-t border-border my-14" />

        {/* Ce qui le rend différent */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">Ce qui le rend différent</div>
          <p className="text-[18px] leading-[1.85] text-beige-dim mb-4">La plupart des outils numériques standardisent, scorent, recommandent — ils sont faits pour accélérer. Le collègue fait l'inverse : il ralentit, il ouvre, il déplace.</p>
          <blockquote className="italic text-[17px] text-beige-faint border-l border-green-dim pl-5 mt-6 leading-relaxed">
            L'intelligence artificielle n'est ici qu'un vecteur — elle reçoit, traduit, transmet. Ce qui oriente vraiment, c'est une expérience humaine réelle. Le moyen, pas la source.
          </blockquote>

          <div className="mt-12 space-y-3 max-w-xl">
            <h3 className="font-mono text-[9px] tracking-[0.18em] uppercase text-beige-faint">Anonymat &amp; confidentialité</h3>
            <p className="text-[13px] leading-relaxed text-beige-faint antialiased">
              Pas d'adresse mail, pas de nom. Votre Clé-LCLG est votre unique identité.
            </p>
            <p className="text-[13px] leading-relaxed text-beige-faint antialiased">
              Vos conversations s'effacent dès la fin de session. Seuls les fragments restent.
            </p>
          </div>
        </section>

        <hr className="border-none border-t border-border my-14" />

        {/* Soutenir le projet */}
        <section>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-green mb-8">Soutenir le projet</div>
          <div className="space-y-12">
            {/* Évolution */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 group">
                <Sparkles size={24} className="text-[#f59e0b] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.2} />
                <PaymentWrapper
                  paypalUrl="https://www.paypal.com/donate/?business=REDACTED&no_recurring=0&currency_code=EUR"
                  title="Évolution"
                  amount="5€ / mois ou soutien libre"
                  color="text-[#f59e0b]"
                >
                  <h3 className="font-mono text-[11px] tracking-widest uppercase text-[#f59e0b] cursor-pointer">Évolution</h3>
                </PaymentWrapper>
                <span className="font-mono text-[9px] text-[#f59e0b]/50 uppercase tracking-widest">5€ / mois</span>
              </div>
              <p className="text-[16px] text-beige-dim leading-relaxed">
                Accès illimité aux analyses évolutives.
              </p>
              <div className="p-5 bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-xl space-y-3">
                <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#f59e0b]">
                  L'analyse évolutive
                </div>
                <p className="text-[14px] text-beige-dim leading-relaxed">
                  Une session donne un instantané. L'analyse évolutive lit le mouvement d'une période à l'autre — ce qui se déplace, ce qui tient, ce qui manque ou se dérobe, et la direction que tout ça dessine.
                </p>
              </div>
              <div className="p-5 bg-green/5 border border-green/20 rounded-xl space-y-3">
                <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-green flex items-center gap-2">
                  <Sparkles size={10} className="animate-pulse" />
                  <span>Mode Reconnaissance — L'Aboutissement</span>
                </div>
                <p className="text-[14px] text-beige leading-relaxed italic border-l border-green/30 pl-4 py-1">
                  « L'abonnement Évolution finance le développement et les coûts d'API. Après un an de pratique et les 10 Prismes découverts, l'abonnement se transforme en <strong>mode Reconnaissance</strong>. L'accès devient gratuit et permanent. Pas une récompense — une reconnaissance du passage d'un mouvement à une posture d'équilibre. »
                </p>
              </div>
            </div>

            {/* Early Access */}
            <div className="space-y-3 border-t border-border/30 pt-8">
              <div className="flex items-center gap-2 group">
                <Gem size={18} className="text-green opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.2} />
                <PaymentWrapper
                  paypalUrl="https://www.paypal.com/donate/?business=REDACTED&no_recurring=0&currency_code=EUR"
                  title="Early Access"
                  amount="50€"
                  color="text-green"
                >
                  <h3 className="font-mono text-[11px] tracking-widest uppercase text-green cursor-pointer">Early Access</h3>
                </PaymentWrapper>
                <span className="font-mono text-[9px] text-green/60 uppercase tracking-widest">50€ · Une fois</span>
              </div>
              <p className="text-[13px] text-beige-faint antialiased leading-relaxed italic">
                Évolution permanent. Pour ceux qui croient dans le projet dès le début.
              </p>
            </div>

            {/* Soutien Libre */}
            <div className="space-y-3 border-t border-border/30 pt-8">
              <div className="flex items-center gap-2 group">
                <Heart size={18} className="text-red-400 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.2} />
                <PaymentWrapper
                  paypalUrl="https://www.paypal.com/donate/?business=REDACTED&no_recurring=0&currency_code=EUR"
                  title="Soutien"
                  color="text-red-400"
                >
                  <h3 className="font-mono text-[11px] tracking-widest uppercase text-red-400 cursor-pointer">Soutien</h3>
                </PaymentWrapper>
              </div>
              <p className="text-[13px] text-beige-faint antialiased leading-relaxed italic">
                Un projet indépendant, une seule personne derrière. Votre don contribue directement à la poursuite de son développement.
              </p>
            </div>
          </div>
        </section>

        <hr className="border-none border-t border-border my-14" />

        <ClarteSection section="landing" />

        {/* Clôture — rouleau, compact pour laisser voir la boîte de clarté en entier en bas */}
        <section className="mt-10 pb-12 text-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Revenir au début"
            className="group inline-flex flex-col items-center gap-2 text-beige-faint hover:text-beige transition-colors"
          >
            <span className="font-serif italic text-[14px] md:text-[15px]">Revenir au début</span>
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            >
              <ArrowDown size={13} strokeWidth={1.5} />
            </motion.div>
          </button>
        </section>
      </main>

    </div>
  );
}