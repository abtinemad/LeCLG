import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, BookOpen, Gem, Heart, HelpCircle, X, Mic, Loader2, Waves, Orbit, Fingerprint } from 'lucide-react';
import { sbGet, sbUpdate } from '../lib/worker';

interface GuideStep {
  id: string;
  title: string;
  content: string;
  icon: React.ReactNode;
}

const CLARITES: Record<string, GuideStep[]> = {
  landing: [
    {
      id: 'welcome',
      title: 'Le Sens de l\'Espace',
      content: "Le Collègue n'est pas un outil de productivité, mais un espace de dégrisement. Ici, on cherche la clarté dans le tumulte du vécu.",
      icon: <Sparkles size={14} className="text-beige" />
    }
  ],
  chat: [
    {
      id: 'chat_intro',
      title: 'L\'Intention du Dialogue',
      content: "Démêler n'est pas résoudre. Cette conversation sert à déplier les plis de votre pensée pour que vous puissiez voir ce qui s'y cache.",
      icon: <Brain size={14} className="text-beige" />
    }
  ],
  'carnet-fragments': [
    {
      id: 'gallery_intro',
      title: 'Les Fragments',
      content: "Chaque session laisse un éclat. Ici reposent les fragments de votre vécu, ordonnés par le temps. Observez ce qui revient.",
      icon: <BookOpen size={14} className="text-beige" />
    }
  ],
  'carnet-lien': [
    {
      id: 'rhythm_intro',
      title: 'Le Lien',
      content: "Comment s'organise votre existence ? Le lien montre la sédimentation de vos émotions dans les différentes sphères de votre vie.",
      icon: <Heart size={14} className="text-beige" />
    }
  ],
  'carnet-affect': [
    {
      id: 'affect_intro',
      title: 'Le Climat des Affects',
      content: "Qu'est-ce qui vous pousse, qu'est-ce qui vous freine ? Ici on lit les courants invisibles qui traversent votre semaine.",
      icon: <Waves size={14} className="text-beige" />
    }
  ],
  'carnet-elan': [
    {
      id: 'elan_intro',
      title: 'La Trajectoire',
      content: "Vers quoi tendez-vous ? L'Élan identifie le mouvement global de votre pensée et la question qui travaille votre équilibre actuel.",
      icon: <Orbit size={14} className="text-beige" />
    }
  ],
  'carnet-matrice': [
    {
      id: 'matrice_intro',
      title: 'La Structure du Fond',
      content: "La Matrice est ce dont on vient. Elle révèle les patterns profonds, les angoisses et les valeurs qui génèrent tout le reste.",
      icon: <Fingerprint size={14} className="text-beige" />
    }
  ]
};

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
  
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  
  const [emotion, setEmotion] = useState<SerpentinEmotion>('calm');
  const [intensity, setIntensity] = useState(0.2);
  const [isPermanentUnlock, setIsPermanentUnlock] = useState(false);

  const recognition = useRef<any>(null);

  useEffect(() => {
    const loadState = async () => {
      const personalId = localStorage.getItem('collegue_personal_id');
      if (!personalId) return;
      try {
        const res = await sbGet("carnet", `personal_id=eq.${personalId}`);
        if (res && res.length > 0) {
          const state = res[0].serpentin_state;
          if (state && state.emotion) setEmotion(state.emotion);
          if (state && state.intensity !== undefined) setIntensity(state.intensity);
          
          if (res[0].plan === 'reconnaissance' || res[0].plan === 'gratuit_permanent') {
            setIsPermanentUnlock(true);
            setEmotion('permanent_unlock');
          }
        }
      } catch (e) {
        console.error("Failed to load serpentin state", e);
      }
    };
    loadState();
  }, []);

  const saveState = async (newEmotion: SerpentinEmotion, newIntensity: number) => {
    const personalId = localStorage.getItem('collegue_personal_id');
    if (!personalId) return;
    try {
      const res = await sbGet("carnet", `personal_id=eq.${personalId}`);
      if (res && res.length > 0) {
        await sbUpdate("carnet", res[0].id, {
          serpentin_state: { emotion: newEmotion, intensity: newIntensity }
        });
      }
    } catch (e) {
      console.error("Failed to save serpentin state", e);
    }
  };

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.lang = 'fr-FR';

      recognition.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        handleQuestion(text);
      };

      recognition.current.onend = () => {
        setIsRecording(false);
      };

      recognition.current.onerror = () => {
        setIsRecording(false);
      };
    }
  }, [section]);

  const toggleRecording = () => {
    if (isRecording) {
      recognition.current?.stop();
    } else {
      setAiResponse(null);
      setIsRecording(true);
      recognition.current?.start();
    }
  };

  const handleQuestion = async (text: string) => {
    setIsThinking(true);
    try {
      const res = await fetch('/api/clarte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, section })
      });
      const data = await res.json();
      setAiResponse(data.text);
      const newEmotion = data.emotion || 'calm';
      const newIntensity = data.intensity || 0.5;
      setEmotion(newEmotion);
      setIntensity(newIntensity);
      saveState(newEmotion, newIntensity);
    } catch (e) {
      setAiResponse("Je n'ai pas pu capter votre question. Réessayez.");
      setEmotion('mysterious');
    } finally {
      setIsThinking(false);
    }
  };

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

  const step = steps[currentStep];

  if (!step) return null;

  const sectionColor = SECTION_COLORS[section] || '#E8D5B0';

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="relative mb-4 p-5 md:p-6 rounded-lg border border-white/5 bg-white/[0.015] overflow-hidden group shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] min-h-[100px] flex flex-col justify-center"
    >
      <CometAnimation section={section} emotion={emotion} intensity={intensity} />

      {/* Absolute Header Controls */}
      <div className="absolute top-3 right-3 z-20">
        <button 
          onClick={() => setIsOpen(false)}
          className="p-1.5 sm:p-2 text-red-500/30 hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10"
        >
          <X size={16} />
        </button>
      </div>

      {/* Absolute Bottom Controls */}
      <div className="absolute bottom-4 right-4 md:bottom-5 md:right-5 z-20">
        <button 
          onClick={toggleRecording}
          className={`p-2.5 sm:p-3 rounded-full border transition-all relative shadow-sm ${
            isRecording 
              ? 'bg-red-500/10 border-red-500/40 text-red-500' 
              : 'bg-white/5 border-white/10 hover:border-white/20'
          }`}
          style={{
            color: isRecording ? undefined : `${sectionColor}66`,
            borderColor: isRecording ? undefined : `${sectionColor}22`,
            backgroundColor: isRecording ? undefined : `${sectionColor}05`
          }}
        >
          <Mic className="w-[14px] h-[14px] sm:w-[18px] sm:h-[18px]" />
          {isRecording && (
            <motion.div 
              className="absolute inset-0 rounded-full border border-red-500"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </button>
      </div>

      <div className="relative z-10 w-full flex flex-col min-h-full">
        <div className="w-full pr-8 mb-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="font-mono text-[8px] tracking-[0.2em] uppercase" style={{ color: `${sectionColor}80` }}>Clarté</div>
              <div className="h-px w-4" style={{ backgroundColor: `${sectionColor}20` }} />
            </div>
            <div className="flex items-center gap-2">
              <div className="p-0.5" style={{ color: sectionColor }}>
                {step.icon}
              </div>
              <h4 className="font-mono text-[9px] tracking-widest uppercase" style={{ color: `${sectionColor}CC` }}>{step.title}</h4>
            </div>
          </div>
        </div>

        <div className="w-full relative flex-1">
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
                  <span className="inline-block w-14 h-8 float-right invisible"></span>
                </div>
                <div className="font-mono text-[7px] tracking-[0.3em] uppercase mt-3" style={{ color: `${sectionColor}CC` }}>
                  L'Union des Fées Comètes
                </div>
              </motion.div>
            ) : aiResponse ? (
              <motion.div
                key="ai-res"
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 5 }}
                className="w-full"
              >
                <div className="text-[15px] leading-relaxed font-serif italic text-pretty" style={{ color: sectionColor }}>
                  « {aiResponse} »
                  <span className="inline-block w-14 h-8 float-right invisible"></span>
                </div>
                <button 
                  onClick={() => setAiResponse(null)}
                  className="font-mono text-[7px] tracking-widest uppercase transition-colors mt-3"
                  style={{ color: `${sectionColor}66` }}
                >
                  Revenir au guide
                </button>
              </motion.div>
            ) : isThinking ? (
              <motion.div 
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 w-full"
                style={{ color: `${sectionColor}66` }}
              >
                <Loader2 size={14} className="animate-spin" />
                <span className="font-mono text-[9px] tracking-widest uppercase">Écoute du Serpentin...</span>
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
                  <span className="inline-block w-10 h-8 sm:w-14 float-right invisible"></span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!aiResponse && !isThinking && steps.length > 1 && (
          <div className="flex gap-1.5 pt-4 w-full">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className="w-1 h-1 rounded-full transition-all"
                style={{ 
                  width: idx === currentStep ? '12px' : '4px',
                  backgroundColor: idx === currentStep ? `${sectionColor}99` : `${sectionColor}22`
                }}
              />
            ))}
          </div>
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
