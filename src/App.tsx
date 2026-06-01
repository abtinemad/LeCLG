import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Landing from './pages/Landing';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import Carnet from './pages/Carnet';
import Climat from './pages/Climat';
import QuestCeQueCest from './pages/QuestCeQueCest';
import { GlobalNav } from './components/GlobalNav';

import { Toaster } from "@/components/ui/sonner";

// Transition de page : fondu doux + très léger glissé vertical, dans l'esprit
// calme du produit (pas d'effet appuyé). `mode="wait"` enchaîne sortie puis
// entrée, évitant le chevauchement de deux pages.
const PAGE_TRANSITION = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

function AnimatedRoutes() {
  const location = useLocation();

  // Au changement de route, on repart en haut de page (sinon une nouvelle page
  // peut s'afficher déjà scrollée). Le chat gère son propre défilement interne.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    // Le motion.div keyé sur le pathname EST l'enfant direct d'AnimatePresence :
    // c'est lui qui porte l'`exit`, donc la sortie de l'ancienne page se joue
    // bien avant l'entrée de la nouvelle (`mode="wait"`). On fige `location`
    // sur Routes pour que l'ancienne page reste rendue le temps de sa sortie.
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={PAGE_TRANSITION}
      >
        <Routes location={location}>
          <Route path="/" element={<Landing />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/carnet" element={<Carnet />} />
          <Route path="/climat" element={<Climat />} />
          <Route path="/quest-ce-que-cest" element={<QuestCeQueCest />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GlobalNav />
      <AnimatedRoutes />
      <Toaster />
    </BrowserRouter>
  );
}