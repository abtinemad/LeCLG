import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ClarteSection } from '../components/SerpentinGuide';
import { LogoEmber } from '../components/LogoEmber';

// Effet par pastille du landing — éteint au repos, révélé au survol/focus
// (desktop) ou par rotation lente (tactile).
const FX_CLASS: Record<string, string> = {
  marre: 'marre-vibre',
  flou: 'flou-vacille',
  boucle: 'boucle-run',
};
// Durée pendant laquelle la pastille choisie continue son animation (les autres
// figées) avant l'ouverture du chat.
const FOCUS_MS = 2200;

export default function Landing() {
  // Une conversation est en cours dès qu'une session est ouverte (l'ouverture
  // du bot suffit — pas besoin d'avoir déjà répondu) et qu'elle n'est ni
  // terminée ni clôturée. `saveState` persiste `sessionActive` en localStorage,
  // donc ça vaut que la fenêtre ait été fermée ou non. En state (pas en mémo)
  // pour pouvoir repasser au hero de départ après « Laisser de côté ».
  const [openConversation, setOpenConversation] = useState(() => {
    try {
      const raw = localStorage.getItem('collegue_chat_state');
      if (!raw) return false;
      const s = JSON.parse(raw);
      return s.sessionActive === true && !s.showEnded && s.closingPhase !== 'closed';
    } catch {
      return false;
    }
  });

  // Laisser de côté : on ferme la conversation en cours (on vide l'état local —
  // aucune carte, « déposer » reste réservé au dépôt dans le carnet) et on
  // retombe sur la page de départ, prêt à repartir sur autre chose.
  const setAside = () => {
    localStorage.removeItem('collegue_chat_state');
    setOpenConversation(false);
  };

  // Effets de pastille éteints au repos. Allumés au survol/focus (desktop) ou
  // par rotation lente une-à-la-fois (tactile, pas de survol).
  const [activeFx, setActiveFx] = useState<string | null>(null);
  const [canHover] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(hover: hover)').matches
      : true,
  );
  // Sélection en cours (tactile) : gèle la rotation pendant les ~5 s de focus.
  const [picking, setPicking] = useState(false);
  const fxOf = (key: string) =>
    activeFx === key && FX_CLASS[key] ? ' ' + FX_CLASS[key] : '';
  const fxHandlers = (key: string) =>
    canHover
      ? {
          onMouseEnter: () => setActiveFx(key),
          onMouseLeave: () => setActiveFx((p) => (p === key ? null : p)),
          onFocus: () => setActiveFx(key),
          onBlur: () => setActiveFx((p) => (p === key ? null : p)),
        }
      : {};
  // Tactile : aucune animation au repos. L'animation ne joue qu'au tap.
  const navigate = useNavigate();
  const [prefersReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  const onPick = (key: string, e: { preventDefault: () => void }) => {
    if (canHover || prefersReduced) return; // desktop : le Link navigue normalement
    e.preventDefault();
    if (picking) return;
    setActiveFx(key); // la choisie garde son animation
    setPicking(true); // gèle la rotation -> les autres se figent
    window.setTimeout(
      () => navigate('/chat', { state: { dayStateKey: key } }),
      FOCUS_MS,
    );
  };

  return (
    <div className="relative min-h-[100dvh]">
      {/* Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9999] opacity-60 mix-blend-soft-light" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>

      {/* pt-[56px] réserve la hauteur de la nav fixe (GlobalNav : py-3 + icônes
          + bordure ≈ 50px) pour que le contenu ne passe pas dessous. En box-border
          ce padding reste DANS le 100dvh → pas de scroll. À ajuster si la nav change. */}
      <main className="min-h-[100dvh] max-w-[720px] mx-auto px-6 md:px-8 flex flex-col pt-[56px]" style={{ paddingTop: "calc(56px + env(safe-area-inset-top))" }}>
        {/* Hero — centré verticalement dans l'espace disponible (flex-1) : le
            regard respire sans être collé en haut, et le filet de pied reste en
            bas. Tout tient sur un écran de téléphone sans scroll. */}
        <section className="flex-1 flex flex-col items-center justify-center text-center py-8 md:py-12">
          {/* Cluster d'adresse (regard + question + promesse + action). */}
          <div className="flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.1, ease: "easeOut" }}
            className="w-28 h-28 md:w-44 md:h-44 mb-5 md:mb-7 flex items-center justify-center"
          >
            <LogoEmber className="w-full h-full" autonomous />
          </motion.div>
          {openConversation ? (
            <>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.35 }}
                className="font-serif italic text-[clamp(32px,7vw,56px)] font-medium text-beige leading-[1.1] tracking-tight mb-4 md:mb-6 max-w-[600px]"
              >
                Une conversation est restée ouverte.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="text-[17px] md:text-[20px] leading-[1.6] md:leading-[1.8] text-beige-dim max-w-[520px] mb-6 md:mb-9 antialiased"
              >
                Vous pouvez la reprendre là où vous l'aviez laissée, ou la laisser de côté.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.65 }}
                className="flex flex-col items-center gap-3 md:gap-4 w-full max-w-xs"
              >
                <Link
                  to="/chat"
                  state={{ resume: true }}
                  className="w-full text-center font-mono text-[11px] tracking-widest uppercase text-bg bg-beige px-10 py-4 rounded-sm hover:opacity-85 transition-opacity"
                >
                  Reprendre
                </Link>
                <button
                  onClick={setAside}
                  className="w-full text-center font-mono text-[11px] tracking-widest uppercase text-beige border border-beige/20 px-10 py-3.5 rounded-sm hover:bg-beige/5 transition-colors"
                >
                  Laisser de côté
                </button>
                <span className="font-mono text-[8px] tracking-widest text-beige-faint italic">Anonyme et confidentiel</span>
              </motion.div>
            </>
          ) : (
            <>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.35 }}
                className="font-serif italic text-[clamp(36px,8vw,64px)] font-medium text-beige leading-[1.1] tracking-tight mb-4 md:mb-6 max-w-[600px]"
              >
                Quelque chose à démêler ?
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="text-[17px] md:text-[20px] leading-[1.6] md:leading-[1.8] text-beige-dim max-w-[520px] mb-6 md:mb-9 antialiased"
              >
                Une pause au milieu du bruit, le temps d'une conversation.
              </motion.p>
              {/* Néon « en fin de vie » réservé à la pastille "non rien" : grésillement
                  irrégulier, une extinction COMPLÈTE d'environ 2 s, et une micro-vibration
                  synchronisée sur les ratés. Halo qui faiblit avec l'opacité. Deux
                  animations parallèles (opacité + tremblement). Coupé si l'utilisateur
                  a demandé moins d'animations. Cycle de 8 s. */}
              <style>{`
                @keyframes nonRienFlicker {
                  0% { opacity: .6; filter: brightness(1.12); }
                  4% { opacity: .6; }
                  4.3% { opacity: .12; }
                  4.7% { opacity: .6; }
                  5% { opacity: .28; }
                  5.4% { opacity: .6; }
                  /* sursaut de surtension */
                  11.5% { opacity: .6; }
                  12% { opacity: 1; filter: brightness(2.0); }
                  12.6% { opacity: .55; filter: brightness(1.12); }
                  13% { opacity: .6; }
                  19% { opacity: .6; }
                  19.3% { opacity: .08; }
                  20.2% { opacity: .1; }
                  20.6% { opacity: .6; }
                  20.9% { opacity: .3; }
                  21.3% { opacity: .6; }
                  /* flash bref avant l'extinction (claque) */
                  36% { opacity: .6; }
                  36.4% { opacity: 1; filter: brightness(2.1); }
                  36.8% { opacity: .6; filter: brightness(1.12); }
                  /* extinction complète ~2 s (38% -> 62% sur 8 s ≈ 2 s) */
                  37% { opacity: .6; }
                  37.4% { opacity: .05; }
                  38% { opacity: 0; filter: brightness(.3); }
                  62% { opacity: 0; filter: brightness(.3); }
                  62.6% { opacity: .04; }
                  /* rallumage en surtension puis stabilisation */
                  63% { opacity: 1; filter: brightness(2.0); }
                  63.4% { opacity: .15; filter: brightness(1.12); }
                  63.9% { opacity: .6; filter: brightness(1.12); }
                  80% { opacity: .6; }
                  80.3% { opacity: .2; }
                  80.7% { opacity: .6; }
                  /* dernier sursaut fort */
                  87% { opacity: .6; }
                  87.5% { opacity: .95; filter: brightness(1.85); }
                  88% { opacity: .6; filter: brightness(1.12); }
                  92% { opacity: .6; }
                  92.4% { opacity: .1; }
                  93.2% { opacity: .12; }
                  93.6% { opacity: .6; }
                  100% { opacity: .6; }
                }
                /* tremblement seulement pendant les phases de grésillement,
                   immobile le reste du temps (et pendant l'extinction). */
                @keyframes nonRienShake {
                  0%, 3.9%, 5.5%, 18.9%, 21.4%, 36.9%, 63.9%, 79.9%, 80.8%, 91.9%, 93.7%, 100% {
                    transform: translate(0, 0);
                  }
                  4.2% { transform: translate(-0.6px, 0.4px); }
                  4.9% { transform: translate(0.5px, -0.5px); }
                  19.2% { transform: translate(0.6px, 0.3px); }
                  19.8% { transform: translate(-0.5px, -0.4px); }
                  20.7% { transform: translate(0.4px, 0.5px); }
                  63.2% { transform: translate(-0.5px, 0.5px); }
                  63.6% { transform: translate(0.4px, -0.3px); }
                  80.5% { transform: translate(0.5px, 0.4px); }
                  92.6% { transform: translate(-0.4px, -0.5px); }
                  93.3% { transform: translate(0.5px, 0.3px); }
                }
                .non-rien-neon {
                  animation: nonRienFlicker 8s linear infinite, nonRienShake 8s linear infinite;
                  filter: brightness(1.12);
                  will-change: opacity, transform, filter;
                }
                /* Deux fréquences superposées pour une braise vacillante :
                   braiseHeat = dérive LENTE de la zone chaude (background-position) ;
                   braiseVacille = grésillement RAPIDE et irrégulier de l'incandescence
                   (filter), micro-chutes suivies de flambées. Propriétés distinctes
                   -> elles se composent. Aucun halo externe. */
                @keyframes braiseHeat {
                  0%   { background-position: 50% 16%; }
                  20%  { background-position: 50% 40%; }
                  38%  { background-position: 50% 30%; }
                  55%  { background-position: 50% 62%; }
                  72%  { background-position: 50% 44%; }
                  88%  { background-position: 50% 72%; }
                  100% { background-position: 50% 16%; }
                }
                @keyframes braiseVacille {
                  0%   { filter: brightness(1) saturate(1.04); }
                  7%   { filter: brightness(1.24) saturate(1.2); }
                  11%  { filter: brightness(.9) saturate(.97); }
                  16%  { filter: brightness(1.14) saturate(1.12); }
                  23%  { filter: brightness(.85) saturate(.93); }
                  26%  { filter: brightness(1.31) saturate(1.27); }
                  34%  { filter: brightness(1.02) saturate(1.05); }
                  44%  { filter: brightness(1.2) saturate(1.16); }
                  50%  { filter: brightness(.89) saturate(.96); }
                  58%  { filter: brightness(1.17) saturate(1.12); }
                  64%  { filter: brightness(.95) saturate(1); }
                  71%  { filter: brightness(1.29) saturate(1.24); }
                  77%  { filter: brightness(.87) saturate(.94); }
                  82%  { filter: brightness(1.19) saturate(1.14); }
                  90%  { filter: brightness(1.01) saturate(1.05); }
                  95%  { filter: brightness(1.23) saturate(1.18); }
                  100% { filter: brightness(1) saturate(1.04); }
                }
                .braise-comptes {
                  background: linear-gradient(180deg, #d98a3e 0%, #b85a37 28%, #9c4338 52%, #b34a2c 74%, #d97b34 100%);
                  background-size: 100% 240%;
                  -webkit-background-clip: text;
                  background-clip: text;
                  -webkit-text-fill-color: transparent;
                  color: transparent;
                  animation: braiseHeat 7s ease-in-out infinite, braiseVacille 1.55s linear infinite;
                  will-change: filter, background-position;
                }
                /* « ça tourne en boucle » : un arc lumineux NET court sur le liseret
                   (anneau conique masqué sur le bord), à vitesse constante. Aussi fin
                   que la bordure. */
                @property --boucle-a {
                  syntax: "<angle>";
                  inherits: false;
                  initial-value: 0deg;
                }
                .boucle-run { position: relative; }
                .boucle-run::before {
                  content: "";
                  position: absolute;
                  inset: 0;
                  border-radius: inherit;
                  padding: 1px;
                  background: conic-gradient(from var(--boucle-a), transparent 0 70%, rgba(207,194,177,.85) 82%, #fff8ea 90%, transparent 97% 100%);
                  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
                  -webkit-mask-composite: xor;
                  mask-composite: exclude;
                  pointer-events: none;
                  animation: boucleSpin 1.5s linear infinite;
                }
                @keyframes boucleSpin { to { --boucle-a: 360deg; } }
                /* « c'est flou » : la pastille floute, vacille et se déforme. */
                @keyframes flouVacille {
                  0%   { filter: blur(.8px); transform: scale(1) skewX(0deg); }
                  22%  { filter: blur(1.7px); transform: scale(1.015) skewX(.8deg); }
                  41%  { filter: blur(.6px); transform: scale(.992) skewX(-.6deg); }
                  60%  { filter: blur(1.5px); transform: scale(1.012) skewX(.5deg); }
                  78%  { filter: blur(.9px); transform: scale(.997) skewX(-.4deg); }
                  100% { filter: blur(.8px); transform: scale(1) skewX(0deg); }
                }
                .flou-vacille { animation: flouVacille 2.2s ease-in-out infinite; }
                /* « y'en a marre » : la forme finale (capitales + !) qui vibre. */
                @keyframes marreVibre {
                  0%, 100% { transform: translate(0, 0) rotate(0deg); }
                  10% { transform: translate(-.6px, .5px) rotate(-.4deg); }
                  20% { transform: translate(.6px, -.5px) rotate(.4deg); }
                  30% { transform: translate(-.5px, -.4px) rotate(-.3deg); }
                  40% { transform: translate(.5px, .5px) rotate(.3deg); }
                  50% { transform: translate(-.6px, .3px) rotate(-.4deg); }
                  60% { transform: translate(.6px, -.4px) rotate(.4deg); }
                  70% { transform: translate(-.4px, .5px) rotate(-.3deg); }
                  80% { transform: translate(.5px, -.5px) rotate(.3deg); }
                  90% { transform: translate(-.5px, .4px) rotate(-.4deg); }
                }
                .marre-vibre { animation: marreVibre .35s linear infinite; }
                /* Pas de flash de surbrillance au tap sur mobile. */
                .day-picker a { -webkit-tap-highlight-color: transparent; }
                @media (prefers-reduced-motion: reduce) {
                  .non-rien-neon { animation: none; opacity: .6; }
                  .braise-comptes { animation: none; background-position: 50% 50%; filter: brightness(1.06) saturate(1.08); }
                  .boucle-run::before { animation: none; opacity: .5; }
                  .flou-vacille { animation: none; filter: blur(1px); }
                  .marre-vibre { animation: none; }
                }
              `}</style>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.575 }}
                className="flex flex-col items-center gap-3 mb-6 md:mb-9"
              >
                <div className="day-picker flex flex-wrap items-center justify-center gap-2.5 max-w-[520px]">
                  <Link to="/chat" state={{ dayStateKey: "marre" }} onClick={(e) => onPick("marre", e)} {...fxHandlers("marre")} className={"font-mono text-[11px] tracking-wide px-4 py-2.5 rounded-full border border-beige-faint/15 text-beige-dim hover:text-beige hover:border-beige-faint/40 transition-colors" + fxOf("marre")}>Y'EN A MAAAARRE!</Link>
                  <Link to="/chat" state={{ dayStateKey: "flou" }} onClick={(e) => onPick("flou", e)} {...fxHandlers("flou")} className={"font-mono text-[11px] tracking-wide px-4 py-2.5 rounded-full border border-beige-faint/15 text-beige-dim hover:text-beige hover:border-beige-faint/40 transition-colors" + fxOf("flou")}>c'est flou</Link>
                  <Link to="/chat" state={{ dayStateKey: "boucle" }} onClick={(e) => onPick("boucle", e)} {...fxHandlers("boucle")} className={"font-mono text-[11px] tracking-wide px-4 py-2.5 rounded-full border border-beige-faint/15 text-beige-dim hover:text-beige hover:border-beige-faint/40 transition-colors" + fxOf("boucle")}>ça tourne en boucle</Link>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.65 }}
                className="flex flex-col items-center gap-3 md:gap-4"
              >
                <Link to="/chat" className="font-mono text-[11px] tracking-widest uppercase text-bg bg-beige px-10 py-4 rounded-sm hover:opacity-85 transition-opacity">Déposer un truc</Link>
                <span className="font-mono text-[8px] tracking-widest text-beige-faint italic">Anonyme et confidentiel</span>
              </motion.div>
            </>
          )}
          </div>
        </section>

        <ClarteSection section="landing" />

        {/* Lien discret — qu'est-ce que c'est */}
        <div className="text-center pt-6 pb-2">
          <Link to="/quest-ce-que-cest" className="font-mono text-[8px] tracking-widest uppercase text-beige-faint/30 hover:text-beige-faint transition-colors">
            Qu'est-ce que c'est ?
          </Link>
        </div>

        {/* Filet — discret, en pied de page */}
        <footer className="mt-4 pb-6 text-center">
          <p className="font-mono text-[8px] tracking-widest text-beige-faint/40 uppercase leading-[1.9] max-w-[340px] mx-auto">
            Le collègue n'est pas un outil de soin.
            <br />
            En cas de crise&nbsp;:{" "}
            <a
              href="tel:3114"
              className="underline decoration-dotted underline-offset-2 hover:text-beige-faint transition-colors"
            >
              3114
            </a>, 24h/24.
          </p>
        </footer>
      </main>

    </div>
  );
}