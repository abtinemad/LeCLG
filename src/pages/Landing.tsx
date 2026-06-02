import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ClarteSection } from '../components/SerpentinGuide';
import { LogoEmber } from '../components/LogoEmber';

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

  return (
    <div className="relative min-h-[100dvh]">
      {/* Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[9999] opacity-60 mix-blend-soft-light" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")` }}></div>

      {/* pt-[56px] réserve la hauteur de la nav fixe (GlobalNav : py-3 + icônes
          + bordure ≈ 50px) pour que le contenu ne passe pas dessous. En box-border
          ce padding reste DANS le 100dvh → pas de scroll. À ajuster si la nav change. */}
      <main className="min-h-[100dvh] max-w-[720px] mx-auto px-6 md:px-8 flex flex-col pt-[56px]">
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
              {/* Flicker « néon en fin de vie » réservé à la pastille "non rien" :
                  ratés brefs + une quasi-extinction, léger halo, coupé si l'utilisateur
                  a demandé moins d'animations. */}
              <style>{`
                @keyframes nonRienFlicker {
                  0%, 100% { opacity: .6; }
                  6%, 6.4% { opacity: .6; }
                  6.6% { opacity: .15; }
                  6.9% { opacity: .6; }
                  30% { opacity: .6; }
                  30.3% { opacity: .3; }
                  30.6% { opacity: .6; }
                  30.9% { opacity: .2; }
                  31.4% { opacity: .6; }
                  62% { opacity: .6; }
                  62.5% { opacity: .08; }
                  63.7% { opacity: .1; }
                  64.1% { opacity: .6; }
                  85% { opacity: .6; }
                  85.3% { opacity: .35; }
                  85.6% { opacity: .6; }
                }
                .non-rien-neon {
                  animation: nonRienFlicker 5.2s linear infinite;
                  text-shadow: 0 0 5px rgba(253, 245, 230, 0.15);
                }
                @media (prefers-reduced-motion: reduce) {
                  .non-rien-neon { animation: none; opacity: .6; }
                }
              `}</style>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.575 }}
                className="flex flex-wrap items-center justify-center gap-2.5 mb-6 md:mb-9 max-w-[520px]"
              >
                <Link to="/chat" state={{ dayStateKey: "boucle" }} className="font-mono text-[12px] tracking-wide px-4 py-2 rounded-full border border-beige-faint/20 text-beige-dim hover:text-beige hover:border-beige-faint/40 transition-colors">ça tourne en boucle</Link>
                <Link to="/chat" state={{ dayStateKey: "emballe" }} className="font-mono text-[12px] tracking-wide px-4 py-2 rounded-full border border-beige-faint/20 text-beige-dim hover:text-beige hover:border-beige-faint/40 transition-colors">ça m'emballe</Link>
                <Link to="/chat" state={{ dayStateKey: "marre" }} className="font-mono text-[12px] tracking-wide px-4 py-2 rounded-full border border-beige-faint/20 text-beige-dim hover:text-beige hover:border-beige-faint/40 transition-colors">y'en a marre</Link>
                <Link to="/chat" state={{ dayStateKey: "rien" }} className="font-mono text-[12px] tracking-wide px-4 py-2 rounded-full border border-beige-faint/10 text-beige-faint hover:text-beige-dim hover:border-beige-faint/25 transition-colors ml-4 non-rien-neon">non rien</Link>
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
            Le collègue n'est pas un outil de soin. En cas de crise, le{" "}
            <a
              href="tel:3114"
              className="underline decoration-dotted underline-offset-2 hover:text-beige-faint transition-colors"
            >
              3114
            </a>{" "}
            est disponible 24h/24.
          </p>
        </footer>
      </main>

    </div>
  );
}