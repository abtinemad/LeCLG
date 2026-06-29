import { useState } from "react";
import { DAY_STATES, DAY_GROUPS, FX_CLASS, FOCUS_MS } from "./day-states";

// Sélecteur d'état du jour (day-picker) de l'accueil Chat. Composant
// présentationnel extrait VERBATIM de src/pages/Chat.tsx (refactor pur). Sa seule
// dépendance au moteur de Chat est onStart (ex-startSessionFlow).
export default function DayPicker({
  onStart,
}: {
  onStart: (key: string) => void;
}) {
  // Révélation des effets de pastille : éteints au repos. Allumés au survol/focus
  // (desktop) ou par rotation lente une-à-la-fois (tactile, pas de survol).
  const [activeFx, setActiveFx] = useState<string | null>(null);
  const [canHover] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(hover: hover)").matches
      : true,
  );
  // Sélection en cours (tactile) : gèle la rotation pendant les ~5 s de focus.
  const [picking, setPicking] = useState(false);
  // Classe d'effet appliquée seulement quand la pastille est « éveillée ».
  const fxOf = (key: string) =>
    activeFx === key && FX_CLASS[key] ? " " + FX_CLASS[key] : "";
  // Survol/focus = éveil (desktop uniquement).
  const fxHandlers = (key: string) =>
    canHover
      ? {
          onMouseEnter: () => setActiveFx(key),
          onMouseLeave: () => setActiveFx((p) => (p === key ? null : p)),
          onFocus: () => setActiveFx(key),
          onBlur: () => setActiveFx((p) => (p === key ? null : p)),
        }
      : {};
  // Tactile : aucune animation au repos. L'animation d'une pastille ne se
  // déclenche qu'au tap (via onPick), puis le chat s'ouvre.
  // « Focus » tactile au tap : la pastille choisie garde son animation quelques
  // secondes pendant que toutes les autres se figent, puis le chat s'ouvre.
  // Sur desktop / reduced-motion : entrée directe.
  const [prefersReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const onPick = (key: string) => {
    if (canHover || prefersReduced) {
      onStart(key);
      return;
    }
    if (picking) return;
    setActiveFx(key); // la choisie garde son animation
    setPicking(true); // gèle la rotation -> les autres se figent
    window.setTimeout(() => onStart(key), FOCUS_MS);
  };
  // Contenu interne d'une pastille (l'animation de certaines n'apparaît qu'à l'éveil).
  const pastilleContent = (key: string, label: string, active: boolean) => {
    if (key === "marre") return "Y'EN A MAAAARRE!";
    if (key === "emballe")
      return (
        <>
          {label}
          {active && (
            <svg className="emballe-smile" viewBox="0 0 24 8">
              <path d="M3 2 Q12 9 21 2" />
            </svg>
          )}
        </>
      );
    if (key === "autre")
      return active ? (
        <>
          <span className="autre-dots">
            <span className="autre-size">...</span>
            <span className="autre-step autre-1"></span>
            <span className="autre-step autre-2">.</span>
            <span className="autre-step autre-3">..</span>
            <span className="autre-step autre-4">...</span>
          </span>
          c'est autre chose
        </>
      ) : (
        label
      );
    return label;
  };
  // Rendu d'une pastille à partir de sa clé. Allégée : au repos, texte seul
  // (bord réservé mais transparent, pas de fond) ; au survol, un fond doux,
  // un bord ténu et le texte qui s'éclaire. L'aération des groupes fait le reste.
  const renderChip = (key: string) => {
    const s = DAY_STATES.find((x) => x.key === key);
    if (!s) return null;
    const baseText = key === "rien" ? "text-beige-faint" : "text-beige-dim";
    return (
      <button
        key={s.key}
        onClick={() => onPick(s.key)}
        {...fxHandlers(s.key)}
        className={
          `bg-transparent ${baseText} border border-transparent font-mono text-[11px] tracking-wide px-4 py-2.5 rounded-sm hover:bg-beige/5 hover:text-beige hover:border-beige-faint/30 transition-colors` +
          fxOf(s.key)
        }
      >
        {pastilleContent(s.key, s.label, activeFx === s.key)}
      </button>
    );
  };

  return (
                    <div className="day-picker flex flex-col items-center gap-4 w-full max-w-[520px]">
                      {/* « régler mes comptes » : braise — dégradé rouge→orange SUR
                         le texte + lueur irrégulière qui émane des lettres (pas de
                         halo autour). « non rien » : néon qui grésille. Deux effets
                         CSS purs, coupés si moins d'animations demandé. */}
                      <style>{`
                        /* Deux fréquences superposées pour une braise vacillante :
                           braiseHeat = dérive LENTE de la zone chaude dans les lettres
                           (background-position) ; braiseVacille = grésillement RAPIDE
                           et irrégulier de l'incandescence (filter), avec des micro-
                           chutes suivies de flambées. Propriétés distinctes -> elles se
                           composent. Aucun halo externe. */
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
                          animation: braiseHeat 2.2s ease-in-out infinite, braiseVacille 1.55s linear infinite;
                          will-change: filter, background-position;
                        }
                        @keyframes nonRienFlicker {
                          0% { opacity: .6; filter: brightness(1.12); }
                          4% { opacity: .6; }
                          4.3% { opacity: .12; }
                          4.7% { opacity: .6; }
                          5% { opacity: .28; }
                          5.4% { opacity: .6; }
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
                          36% { opacity: .6; }
                          36.4% { opacity: 1; filter: brightness(2.1); }
                          36.8% { opacity: .6; filter: brightness(1.12); }
                          37% { opacity: .6; }
                          37.4% { opacity: .05; }
                          38% { opacity: 0; filter: brightness(.3); }
                          62% { opacity: 0; filter: brightness(.3); }
                          62.6% { opacity: .04; }
                          63% { opacity: 1; filter: brightness(2.0); }
                          63.4% { opacity: .15; filter: brightness(1.12); }
                          63.9% { opacity: .6; filter: brightness(1.12); }
                          80% { opacity: .6; }
                          80.3% { opacity: .2; }
                          80.7% { opacity: .6; }
                          87% { opacity: .6; }
                          87.5% { opacity: .95; filter: brightness(1.85); }
                          88% { opacity: .6; filter: brightness(1.12); }
                          92% { opacity: .6; }
                          92.4% { opacity: .1; }
                          93.2% { opacity: .12; }
                          93.6% { opacity: .6; }
                          100% { opacity: .6; }
                        }
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
                          animation: nonRienFlicker 2.2s linear infinite, nonRienShake 2.2s linear infinite;
                          filter: brightness(1.12);
                          will-change: opacity, transform, filter;
                        }
                        /* « ça tourne en boucle » : un arc lumineux NET court sur le
                           liseret (anneau conique masqué sur le bord), à vitesse
                           constante. Aussi fin que la bordure. */
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
                        /* « c'est flou » : la pastille floute, vacille (rayon de flou
                           qui varie) et se déforme légèrement (scale + skew). */
                        @keyframes flouVacille {
                          0%   { filter: blur(.8px); transform: scale(1) skewX(0deg); }
                          22%  { filter: blur(1.7px); transform: scale(1.015) skewX(.8deg); }
                          41%  { filter: blur(.6px); transform: scale(.992) skewX(-.6deg); }
                          60%  { filter: blur(1.5px); transform: scale(1.012) skewX(.5deg); }
                          78%  { filter: blur(.9px); transform: scale(.997) skewX(-.4deg); }
                          100% { filter: blur(.8px); transform: scale(1) skewX(0deg); }
                        }
                        .flou-vacille { animation: flouVacille 2.2s ease-in-out infinite; }
                        /* « ça s'éclaire » : une bande claire balaie le texte ET un
                           flash de luminosité synchronisé -> la lumière qui se lève,
                           bien visible. */
                        @keyframes eclaireSweep {
                          0%   { background-position: 140% 0; }
                          100% { background-position: -40% 0; }
                        }
                        @keyframes eclaireFlash {
                          0%, 28% { filter: brightness(1); }
                          50% { filter: brightness(1.55); }
                          72%, 100% { filter: brightness(1); }
                        }
                        .eclaire-fx {
                          background: linear-gradient(100deg, #b3a690 0%, #b3a690 34%, #fffefb 50%, #b3a690 66%, #b3a690 100%);
                          background-size: 300% 100%;
                          -webkit-background-clip: text;
                          background-clip: text;
                          -webkit-text-fill-color: transparent;
                          color: transparent;
                          animation: eclaireSweep 2.2s ease-in-out infinite, eclaireFlash 2.2s ease-in-out infinite;
                        }
                        /* « ça m'emballe » : un sourire qui se dessine sous le texte
                           (arc tracé par stroke-dashoffset), se tient, puis s'efface. */
                        .emballe-fx { position: relative; }
                        .emballe-smile {
                          position: absolute;
                          left: 50%; bottom: 3px;
                          width: 22px; height: 7px;
                          transform: translateX(-50%);
                          overflow: visible;
                          pointer-events: none;
                        }
                        .emballe-smile path {
                          fill: none;
                          stroke: #cfc2b1;
                          stroke-width: 1.6;
                          stroke-linecap: round;
                          stroke-dasharray: 28;
                          stroke-dashoffset: 28;
                          animation: smileDraw 2.2s ease-in-out infinite;
                        }
                        @keyframes smileDraw {
                          0% { stroke-dashoffset: 28; }
                          35%, 70% { stroke-dashoffset: 0; }
                          100% { stroke-dashoffset: 28; }
                        }
                        /* « ça va pas trop » : la pastille dérive et tangue sans jamais
                           se stabiliser (translate + rotate + skew) -> plus de repère
                           fixe. Transform pur, fiable. */
                        @keyframes pastropDerive {
                          0%   { transform: translate(0, 0) rotate(0deg) skewX(0deg); }
                          18%  { transform: translate(1.4px, -1px) rotate(.9deg) skewX(1.4deg); }
                          37%  { transform: translate(-1.2px, 1px) rotate(-.7deg) skewX(-1.2deg); }
                          55%  { transform: translate(1px, 1.3px) rotate(.6deg) skewX(1deg); }
                          74%  { transform: translate(-1.4px, -.8px) rotate(-.9deg) skewX(-1.4deg); }
                          100% { transform: translate(0, 0) rotate(0deg) skewX(0deg); }
                        }
                        .pastrop-fx { animation: pastropDerive 2.2s ease-in-out infinite; }
                        /* « y'en a marre » : la forme finale (capitales + !) qui vibre,
                           comme la rage contenue. */
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
                        /* « juste un truc banal » : un haussement d'épaules nonchalant —
                           l'air de rien, une montée + léger tangage + retour, longue pause. */
                        @keyframes banalShrug {
                          0%, 40% { transform: translateY(0) rotate(0deg); }
                          52% { transform: translateY(-2px) rotate(-1.2deg); }
                          64% { transform: translateY(-2px) rotate(1.2deg); }
                          78%, 100% { transform: translateY(0) rotate(0deg); }
                        }
                        .penser-fx { animation: banalShrug 2.2s ease-in-out infinite; }
                        /* Pas de flash de surbrillance au tap sur mobile. */
                        .day-picker button { -webkit-tap-highlight-color: transparent; }
                        /* « …c'est autre chose » : les points de tête s'égrènent —
                           rien -> . -> .. -> ... */
                        .autre-dots { position: relative; display: inline-block; }
                        .autre-size { visibility: hidden; }
                        .autre-step { position: absolute; left: 0; opacity: 0; }
                        .autre-1 { animation: autreStep 2.2s steps(1) infinite; }
                        .autre-2 { animation: autreStep 2.2s steps(1) -1.65s infinite; }
                        .autre-3 { animation: autreStep 2.2s steps(1) -1.1s infinite; }
                        .autre-4 { animation: autreStep 2.2s steps(1) -0.55s infinite; }
                        @keyframes autreStep {
                          0%, 25% { opacity: 1; }
                          25.01%, 100% { opacity: 0; }
                        }
                        /* « ça coince » : la pastille pousse pour avancer, vibre contre
                           le blocage, puis claque en arrière. Longue pause entre deux
                           tentatives -> ça force et ça cale. */
                        @keyframes coinceCale {
                          0%, 40% { transform: translateX(0); }
                          44% { transform: translateX(2px); }
                          46% { transform: translateX(1.4px); }
                          48% { transform: translateX(2.7px); }
                          50% { transform: translateX(2.1px); }
                          52% { transform: translateX(2.8px); }
                          54% { transform: translateX(2.3px); }
                          58% { transform: translateX(0); }
                          100% { transform: translateX(0); }
                        }
                        .coince-fx { animation: coinceCale 2.2s ease-out infinite; }
                        @media (prefers-reduced-motion: reduce) {
                          .braise-comptes { animation: none; background-position: 50% 50%; filter: brightness(1.06) saturate(1.08); }
                          .non-rien-neon { animation: none; opacity: .6; }
                          .boucle-run::before { animation: none; opacity: .5; }
                          .flou-vacille { animation: none; filter: blur(1px); }
                          .eclaire-fx { animation: none; }
                          .emballe-smile path { animation: none; stroke-dashoffset: 0; }
                          .pastrop-fx { animation: none; }
                          .marre-vibre { animation: none; }
                          .penser-fx { animation: none; }
                          .autre-step { animation: none; }
                          .autre-4 { opacity: 1; }
                          .coince-fx { animation: none; }
                        }
                      `}</style>
                      <p className="font-serif italic text-lg text-beige-dim text-center px-4">
                        C'est quoi, là, maintenant&nbsp;?
                      </p>
                      <div className="flex flex-col items-center gap-5 w-full">
                        {DAY_GROUPS.map((group, gi) => (
                          <div
                            key={gi}
                            className="flex flex-wrap items-center justify-center gap-2"
                          >
                            {group.map((key) => renderChip(key))}
                          </div>
                        ))}
                      </div>
                      {/* « non rien » — seule, tout en bas (néon à l'éveil) */}
                      <div className="mt-1 flex items-center justify-center">
                        {renderChip("rien")}
                      </div>
                    </div>
  );
}
