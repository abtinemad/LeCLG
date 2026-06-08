import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Landing from './pages/Landing';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import Carnet from './pages/Carnet';
import Restore from './pages/Restore';
import Climat from './pages/Climat';
import Epicentre from './pages/Epicentre';
import QuestCeQueCest from './pages/QuestCeQueCest';
import { GlobalNav } from './components/GlobalNav';

import { Toaster } from "@/components/ui/sonner";

// Transition de page : fondu doux + très léger glissé vertical, dans l'esprit
// calme du produit (pas d'effet appuyé). `mode="wait"` enchaîne sortie puis
// entrée, évitant le chevauchement de deux pages.
const PAGE_TRANSITION = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

function AnimatedRoutes() {
  const location = useLocation();
  const navigate = useNavigate();

  // Acquisition par épicentre : si quelqu'un scanne un QR sans avoir de clé, le
  // token est mémorisé (collegue_epicentre_pending). Une fois la clé créée, à la
  // première navigation, on l'emmène sur /epicentre où la jonction se fait toute
  // seule. Ne se déclenche que pour ceux qui ont scanné (pending présent).
  useEffect(() => {
    try {
      const pending = localStorage.getItem('collegue_epicentre_pending');
      const hasKey = !!(
        localStorage.getItem('collegue_personal_id') && localStorage.getItem('collegue_access_code')
      );
      if (pending && hasKey && !location.pathname.startsWith('/epicentre')) {
        navigate('/epicentre', { replace: true });
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname, navigate]);

  return (
    // Le motion.div keyé sur le pathname EST l'enfant direct d'AnimatePresence :
    // c'est lui qui porte l'`exit`, donc la sortie de l'ancienne page se joue
    // bien avant l'entrée de la nouvelle (`mode="wait"`). On fige `location`
    // sur Routes pour que l'ancienne page reste rendue le temps de sa sortie.
    // `onExitComplete` se déclenche une fois l'ancienne page entièrement sortie,
    // juste avant que la nouvelle entre : on remet en haut dans ce creux
    // invisible, jamais pendant que l'ancienne page est encore affichée (sinon
    // elle saute brutalement vers le haut sous les yeux — l'« image fantôme »).
    <AnimatePresence
      mode="wait"
      initial={false}
      onExitComplete={() => window.scrollTo({ top: 0, behavior: "auto" })}
    >
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
          <Route path="/restore" element={<Restore />} />
          <Route path="/climat" element={<Climat />} />
          <Route path="/epicentre" element={<Epicentre />} />
          <Route path="/epicentre/rejoindre" element={<Epicentre />} />
          <Route path="/quest-ce-que-cest" element={<QuestCeQueCest />} />
          {/* Filet attrape-tout : toute route inconnue renvoie à l'accueil
              plutôt que de laisser une page nue (juste le header). */}
          <Route path="*" element={<Navigate to="/" replace />} />
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