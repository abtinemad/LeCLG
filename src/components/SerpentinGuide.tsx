import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BookOpen, Brain, Gem, Heart, HelpCircle, X, Waves, Orbit, Fingerprint, ChevronLeft, ChevronRight } from 'lucide-react';
import { sbGet } from '../lib/worker';
import { SECTION_GUIDE, CONCEPTS } from '../data/clarte-socle';
import { SerpentinCanvas } from './SerpentinCanvas';

interface GuideStep {
  id: string;
  title: string;
  content: string;
  icon: React.ReactNode;
}


/**
 * Le guide de Clarté est dérivé du socle (clarte-socle.ts) : source de vérité
 * unique, contenu 100 % statique, aucun appel d'API.
 * Chaque page expose une carte d'intro puis une carte par concept pertinent —
 * le carrousel (les points en bas du composant) les fait défiler.
 */
const SECTION_ICONS: Record<string, React.ReactNode> = {
  landing: <Sparkles size={14} className="text-beige" />,
  chat: <Brain size={14} className="text-beige" />,
  'carnet-fragments': <BookOpen size={14} className="text-beige" />,
  'carnet-lien': <Heart size={14} className="text-beige" />,
  'carnet-affect': <Waves size={14} className="text-beige" />,
  'carnet-elan': <Orbit size={14} className="text-beige" />,
  'carnet-matrice': <Fingerprint size={14} className="text-beige" />,
};

const CLARITES: Record<string, GuideStep[]> = Object.fromEntries(
  Object.entries(SECTION_GUIDE).map(([section, guide]): [string, GuideStep[]] => {
    const intro: GuideStep = {
      id: `${section}-intro`,
      title: guide.titre,
      content: guide.intro,
      icon: SECTION_ICONS[section] ?? <Sparkles size={14} className="text-beige" />,
    };
    const glossaire: GuideStep[] = guide.concepts
      .map((key) => CONCEPTS[key])
      .filter(Boolean)
      .map((c) => ({
        id: `${section}-${c.terme}`,
        title: c.terme,
        content: c.definition,
        icon: <Gem size={14} className="text-beige" />,
      }));
    return [section, [intro, ...glossaire]];
  })
);

const SECTION_COLORS: Record<string, string> = {
  landing: '#E8D5B0',
  chat: '#E8D5B0',
  'carnet-fragments': '#6ba368',
  'carnet-lien': '#EA580C',
  'carnet-affect': '#7BA7D7',
  'carnet-elan': '#FAF9F6',
  'carnet-matrice': '#8B5CF6',
};

export type SerpentinEmotion = 'calm' | 'agitated' | 'heavy' | 'bright' | 'mysterious' | 'permanent_unlock';

interface EmotionParams {
  speed: number;
  amplitude: number;
  glow: number;
  opacity: number;
  radius: number;
}

const EMOTIONS: Record<SerpentinEmotion, EmotionParams> = {
  calm: { speed: 1, amplitude: 1, glow: 1, opacity: 0.4, radius: 3.5 },
  agitated: { speed: 0.4, amplitude: 2.5, glow: 3, opacity: 0.8, radius: 6 },
  heavy: { speed: 2, amplitude: 0.3, glow: 0.5, opacity: 0.2, radius: 2 },
  bright: { speed: 0.7, amplitude: 1.5, glow: 2, opacity: 0.7, radius: 5 },
  mysterious: { speed: 1.5, amplitude: 2, glow: 1.5, opacity: 0.5, radius: 4 },
  permanent_unlock: { speed: 0.5, amplitude: 3, glow: 4, opacity: 1, radius: 8 },
};

const CometAnimation = ({ 
  section, 
  isPrisme = false, 
  prismeColor = '#f5f5f4',
  emotion = 'calm',
  intensity = 0.5
}: { 
  section?: string, 
  isPrisme?: boolean, 
  prismeColor?: string,
  emotion?: SerpentinEmotion,
  intensity?: number
}) => {
  const params = EMOTIONS[emotion] || EMOTIONS.calm;
  const baseSection = section?.split('-')[0] || section || 'default';
  
  useEffect(() => {
    if (emotion === 'permanent_unlock') {
      import('canvas-confetti').then((confetti) => {
        const end = Date.now() + (3 * 1000);
        const colors = ['#6ba368', '#f5f5f4', '#EA580C', '#7BA7D7'];

        (function frame() {
          confetti.default({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
          });
          confetti.default({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        }());
      });
    }
  }, [emotion]);

  const config = useMemo(() => {
    if (emotion === 'permanent_unlock') {
      return {
        path: "M 0 100 Q 250 50 500 100 T 1000 100",
        d: [
          "M 0 100 Q 250 50 500 100 T 1000 100",
          "M 0 120 Q 500 200 1000 120",
          "M 0 100 Q 250 50 500 100 T 1000 100",
        ],
        duration: 2,
        viewBox: "0 0 1000 200"
      };
    }

    const amp = params.amplitude * (1 + intensity);
    
    switch (baseSection) {
      case 'landing':
        return {
          path: `M 0 100 C 150 ${100 - 80 * amp} 350 ${100 + 80 * amp} 500 100 S 850 ${100 - 80 * amp} 1000 100`,
          d: [
            `M 0 100 C 150 ${100 - 80 * amp} 350 ${100 + 80 * amp} 500 100 S 850 ${100 - 80 * amp} 1000 100`,
            `M 0 100 C 150 ${100 + 80 * amp} 350 ${100 - 80 * amp} 500 100 S 850 ${100 + 80 * amp} 1000 100`,
            `M 0 100 C 150 ${100 - 80 * amp} 350 ${100 + 80 * amp} 500 100 S 850 ${100 - 80 * amp} 1000 100`,
          ],
          duration: 12 * params.speed,
          viewBox: "0 0 1000 200"
        };
      case 'chat':
        return {
          path: `M 0 100 C 100 ${100 - 70 * amp} 200 ${100 + 70 * amp} 300 100 S 500 ${100 - 70 * amp} 600 100`,
          d: [
            `M 0 100 C 100 ${100 - 70 * amp} 200 ${100 + 70 * amp} 300 100 S 500 ${100 - 70 * amp} 600 100`,
            `M 0 100 C 100 ${100 + 70 * amp} 200 ${100 - 70 * amp} 300 100 S 500 ${100 + 70 * amp} 600 100`,
            `M 0 100 C 100 ${100 - 70 * amp} 200 ${100 + 70 * amp} 300 100 S 500 ${100 - 70 * amp} 600 100`,
          ],
          duration: 7 * params.speed,
          viewBox: "0 0 600 200"
        };
      case 'carnet':
        return {
          path: `M 0 100 Q 250 ${100 - 20 * amp} 500 100 T 1000 100`,
          d: [
            `M 0 100 Q 250 ${100 - 20 * amp} 500 100 T 1000 100`,
            `M 0 100 Q 250 ${100 + 20 * amp} 500 100 T 1000 100`,
            `M 0 100 Q 250 ${100 - 20 * amp} 500 100 T 1000 100`,
          ],
          duration: 15 * params.speed,
          viewBox: "0 0 1000 200"
        };
      default:
        return {
          path: `M 0 100 C 250 ${100 - 50 * amp} 750 ${100 + 50 * amp} 1000 100`,
          d: [
            `M 0 100 C 250 ${100 - 50 * amp} 750 ${100 + 50 * amp} 1000 100`,
            `M 0 100 C 250 ${100 + 50 * amp} 750 ${100 - 50 * amp} 1000 100`,
            `M 0 100 C 250 ${100 - 50 * amp} 750 ${100 + 50 * amp} 1000 100`,
          ],
          duration: 10 * params.speed,
          viewBox: "0 0 1000 200"
        };
    }
  }, [section, isPrisme, emotion, intensity, params]);

  const mainColor = isPrisme ? prismeColor : (section ? (SECTION_COLORS[section] || '#f5f5f4') : '#f5f5f4');
  const colleagueColor = '#f5f5f4'; // Neutral colleague color

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: params.opacity }}>
      <motion.svg className="w-full h-full" viewBox={config.viewBox} preserveAspectRatio="none">
        {/* Background "Rail" - User Wave */}
        <motion.path
          d={config.path}
          fill="none"
          stroke={mainColor}
          strokeWidth="0.8"
          strokeOpacity="0.15"
          animate={{ d: config.d }}
          transition={{ duration: config.duration * 1.5, repeat: Infinity, ease: "linear" }}
        />

        {/* Background "Rail" - Colleague Wave (Offset) */}
        <motion.path
          d={config.path}
          fill="none"
          stroke={colleagueColor}
          strokeWidth="0.6"
          strokeOpacity="0.1"
          animate={{ 
            d: config.d,
            opacity: [0.05, 0.15, 0.05]
          }}
          transition={{ 
            d: { duration: config.duration * (baseSection === 'chat' ? 1.4 : 1.8), repeat: Infinity, ease: "linear" },
            opacity: { duration: config.duration * 0.9, repeat: Infinity, ease: "easeInOut" }
          }}
          style={{ transform: baseSection === 'chat' ? 'translateY(-1px) scaleY(1.1)' : 'translateY(1px) scaleY(1.1)' }}
        />

        {/* User Comet Trail */}
        <motion.path
          d={config.path}
          fill="none"
          stroke={`url(#trail-grad-user-${section}-${isPrisme}-${emotion})`}
          strokeWidth={isPrisme ? "2.5" : 2.2 * (1 + intensity * 0.5)}
          initial={{ pathLength: 0.25, pathOffset: 0 }}
          animate={{ 
            pathOffset: [0, 1],
            d: config.d
          }}
          transition={{ 
            pathOffset: { duration: config.duration, repeat: Infinity, ease: "easeInOut" },
            d: { duration: config.duration * 1.5, repeat: Infinity, ease: "linear" }
          }}
        />

        {/* Colleague Comet Trail */}
        <motion.path
          d={config.path}
          fill="none"
          stroke={`url(#trail-grad-colleague-${section}-${isPrisme}-${emotion})`}
          strokeWidth={1.5 * (1 + intensity * 0.3)}
          initial={{ pathLength: 0.2, pathOffset: baseSection === 'chat' ? 1 : 0.5 }}
          animate={{ 
            pathOffset: baseSection === 'chat' ? [1, 0] : [0.5, 1.5],
            d: config.d
          }}
          transition={{ 
            pathOffset: { duration: config.duration * (baseSection === 'chat' ? 1 : 1.2), repeat: Infinity, ease: "easeInOut" },
            d: { duration: config.duration * 1.5, repeat: Infinity, ease: "linear" }
          }}
        />
        
        {/* The User Glowing Head (Brighter) - Now a path segment to stay on the morphing path */}
        <motion.path
          d={config.path}
          fill="none"
          stroke={mainColor}
          strokeWidth={isPrisme ? "8" : (params.radius * 2 * (1 + intensity * 0.4))}
          strokeLinecap="round"
          initial={{ pathLength: 0.001, pathOffset: 0 }}
          animate={{ 
            pathOffset: [0, 1],
            d: config.d
          }}
          transition={{ 
            pathOffset: { duration: config.duration, repeat: Infinity, ease: "easeInOut" },
            d: { duration: config.duration * 1.5, repeat: Infinity, ease: "linear" }
          }}
          style={{ 
            filter: `blur(2px) drop-shadow(0 0 5px ${mainColor})`,
            strokeDasharray: "0 1"
          }}
        />

        {/* The Colleague Glowing Head (Softer) */}
        <motion.path
          d={config.path}
          fill="none"
          stroke={colleagueColor}
          strokeWidth={(params.radius * 1.2 * (1 + intensity * 0.2))}
          strokeLinecap="round"
          initial={{ pathLength: 0.001, pathOffset: baseSection === 'chat' ? 1 : 0.5 }}
          animate={{ 
            pathOffset: baseSection === 'chat' ? [1, 0] : [0.5, 1.5],
            d: config.d
          }}
          transition={{ 
            pathOffset: { duration: config.duration * (baseSection === 'chat' ? 1 : 1.2), repeat: Infinity, ease: "easeInOut" },
            d: { duration: config.duration * 1.5, repeat: Infinity, ease: "linear" }
          }}
          style={{ 
            filter: `blur(1.5px) drop-shadow(0 0 3px ${colleagueColor})`,
            strokeDasharray: "0 1",
            opacity: 0.6
          }}
        />

        <defs>
          {/* User Gradients */}
          <radialGradient id={`head-glow-user-${section}-${isPrisme}-${emotion}`}>
            <stop offset="0%" stopColor={mainColor} stopOpacity="1" />
            <stop offset="60%" stopColor={mainColor} stopOpacity={0.6 * params.glow} />
            <stop offset="100%" stopColor={mainColor} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`trail-grad-user-${section}-${isPrisme}-${emotion}`} x1="0%" x2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor={mainColor} stopOpacity={0.7 * params.glow} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>

          {/* Colleague Gradients */}
          <radialGradient id={`head-glow-colleague-${section}-${isPrisme}-${emotion}`}>
            <stop offset="0%" stopColor={colleagueColor} stopOpacity="0.8" />
            <stop offset="70%" stopColor={colleagueColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colleagueColor} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`trail-grad-colleague-${section}-${isPrisme}-${emotion}`} x1="0%" x2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor={colleagueColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </motion.svg>
    </div>
  );
};


export const ClarteSection = ({ section, forceClose }: { section: string, forceClose?: boolean }) => {
  const steps = CLARITES[section] || [];
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (forceClose) {
      setIsOpen(false);
    }
  }, [forceClose]);

  const [currentStep, setCurrentStep] = useState(0);

  const [isPermanentUnlock, setIsPermanentUnlock] = useState(false);

  // Changer de page : retour à la première fiche (l'intro).
  useEffect(() => {
    setCurrentStep(0);
  }, [section]);

  // On lit seulement le "plan" du carnet : en mode Reconnaissance, la boîte
  // de Clarté affiche un message particulier et un serpentin plus ample.
  useEffect(() => {
    const loadPlan = async () => {
      const personalId = localStorage.getItem('collegue_personal_id');
      if (!personalId) return;
      try {
        const res = await sbGet("carnet", `personal_id=eq.${personalId}`);
        if (res && res.length > 0) {
          if (res[0].plan === 'reconnaissance' || res[0].plan === 'gratuit_permanent') {
            setIsPermanentUnlock(true);
          }
        }
      } catch (e) {
        console.error("Failed to load carnet plan", e);
      }
    };
    loadPlan();
  }, []);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-20 right-4 md:right-8 z-[100] p-3 rounded-full bg-bg/80 backdrop-blur-md border border-beige/10 text-beige-faint hover:text-beige transition-all shadow-xl group"
      >
        <HelpCircle size={18} className="group-hover:rotate-12 transition-transform opacity-40 group-hover:opacity-100" />
      </button>
    );
  }

  const step = steps[currentStep] ?? steps[0];

  if (!step) return null;

  const sectionColor = SECTION_COLORS[section] || '#E8D5B0';

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="relative mb-4 px-3 py-3 rounded-lg border border-white/5 bg-white/[0.015] overflow-hidden group shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] min-h-[80px] flex flex-col justify-center"
    >
      <SerpentinCanvas color={sectionColor} level={isPermanentUnlock ? 3 : 1} className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-11" />

      {/* Fermer */}
      <button
        onClick={() => setIsOpen(false)}
        aria-label="Fermer"
        className="absolute top-2.5 right-2.5 z-20 p-1.5 text-red-500/30 hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10"
      >
        <X size={15} />
      </button>

      {/* Rangée : flèche gauche · contenu · flèche droite (flèches centrées verticalement) */}
      <div className="relative z-10 w-full flex items-center gap-1">
        {steps.length > 1 && (
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            aria-label="Fiche précédente"
            className="shrink-0 p-2 rounded-full transition-all disabled:opacity-20 hover:bg-white/5"
            style={{ color: `${sectionColor}AA` }}
          >
            <ChevronLeft size={18} />
          </button>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="pr-7 mb-2">
            <div className="flex items-center gap-2">
              <div className="font-mono text-[8px] tracking-[0.2em] uppercase" style={{ color: `${sectionColor}80` }}>Clarté</div>
              <div className="h-px w-4" style={{ backgroundColor: `${sectionColor}20` }} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="p-0.5" style={{ color: sectionColor }}>
                {step.icon}
              </div>
              <h4 className="font-mono text-[9px] tracking-widest uppercase" style={{ color: `${sectionColor}CC` }}>{step.title}</h4>
              {steps.length > 1 && !isPermanentUnlock && (
                <span className="font-mono text-[8px] tracking-widest uppercase ml-auto" style={{ color: `${sectionColor}66` }}>
                  {currentStep + 1} / {steps.length}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              {isPermanentUnlock ? (
                <motion.div
                  key="permanent-unlock"
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full"
                >
                  <div className="text-[15px] leading-relaxed font-serif italic text-pretty" style={{ color: sectionColor }}>
                    « Vous avez traversé suffisamment pour être, à votre tour, le collègue de quelqu'un. Le collègue vous appartient maintenant, sans abonnement, pour toujours. <strong style={{ color: sectionColor }}>Mode Reconnaissance activé.</strong> »
                  </div>
                  <div className="font-mono text-[7px] tracking-[0.3em] uppercase mt-2" style={{ color: `${sectionColor}CC` }}>
                    L'Union des Fées Comètes
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key={step.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  className="w-full"
                  style={{ color: `${sectionColor}EE` }}
                >
                  <div className="text-[15px] leading-relaxed font-serif italic text-pretty">
                    « {step.content} »
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {steps.length > 1 && (
          <button
            onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={currentStep === steps.length - 1}
            aria-label="Fiche suivante"
            className="shrink-0 p-2 rounded-full transition-all disabled:opacity-20 hover:bg-white/5"
            style={{ color: `${sectionColor}AA` }}
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export const PrismeExplainer = ({ 
  title, 
  content, 
  color, 
  isOpen, 
  onClose 
}: { 
  title: string; 
  content: string; 
  color: string; 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-[1px] pointer-events-auto"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm bg-bg/95 border border-white/10 rounded-xl p-8 shadow-2xl pointer-events-auto overflow-hidden"
          >
            <CometAnimation isPrisme prismeColor={color} />

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="mb-6 flex flex-col items-center gap-2">
                <div className="font-mono text-[7px] tracking-[0.4em] uppercase text-beige/40">Clarté du Prisme</div>
                <div className="w-12 h-[1px] bg-white/10" />
              </div>

              <div className="p-3 rounded-full mb-6" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}30` }}>
                <Gem size={22} style={{ color: color }} />
              </div>

              <h3 className="text-xl font-serif italic mb-4" style={{ color: color }}>{title}</h3>
              
              <div className="w-full max-w-[200px] h-[1px] mb-6" style={{ background: `linear-gradient(to right, transparent, ${color}44, transparent)` }} />

              <p className="text-[16px] leading-relaxed font-serif italic mb-8" style={{ color: `${color}E6` }}>
                « {content} »
              </p>

              <button 
                onClick={onClose}
                className="group flex flex-col items-center gap-2 transition-all"
              >
                <div className="w-8 h-8 rounded-full border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/10 transition-colors">
                  <X size={14} className="text-red-500/60" />
                </div>
                <span className="font-mono text-[8px] uppercase tracking-widest text-red-500/40 group-hover:text-red-500/80">Fermer la clarté</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};