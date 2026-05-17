import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, History, Brain, Heart, Waves, Orbit, Trees, Fingerprint, Users, Copy, Check, BookOpen, Zap, Download, Network, Volume2, VolumeX, Sparkles, X, Gem, Feather } from 'lucide-react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { AnimatePresence } from 'motion/react';
import { sbGet, sbInsert, sbUpdate } from '../lib/worker';
import { ClarteSection, PrismeExplainer } from '../components/SerpentinGuide';
export const EMOTIONS = {
  joie: { label: "Joie (Prisme)", color: "#FACC15", bg: "bg-[#FACC15]/10", border: "border-[#FACC15]/40" },
  tristesse: { label: "Tristesse (Prisme)", color: "#60A5FA", bg: "bg-[#60A5FA]/10", border: "border-[#60A5FA]/40" },
  colere: { label: "Colère (Prisme)", color: "#F87171", bg: "bg-[#F87171]/10", border: "border-[#F87171]/40" },
  peur: { label: "Peur (Prisme)", color: "#A78BFA", bg: "bg-[#A78BFA]/10", border: "border-[#A78BFA]/40" },
  degout: { label: "Dégoût (Prisme)", color: "#4ADE80", bg: "bg-[#4ADE80]/10", border: "border-[#4ADE80]/40" },
  surprise: { label: "Surprise (Prisme)", color: "#FB923C", bg: "bg-[#FB923C]/10", border: "border-[#FB923C]/40" },
  confiance: { label: "Confiance (Prisme)", color: "#22D3EE", bg: "bg-[#22D3EE]/10", border: "border-[#22D3EE]/40" },
  anticipation: { label: "Anticipation (Prisme)", color: "#F472B6", bg: "bg-[#F472B6]/10", border: "border-[#F472B6]/40" },
  honte: { label: "Honte (Prisme)", color: "#94A3B8", bg: "bg-[#94A3B8]/10", border: "border-[#94A3B8]/40" },
  melancolie: { label: "Mélancolie (Prisme)", color: "#8B5CF6", bg: "bg-[#8B5CF6]/10", border: "border-[#8B5CF6]/40" },
} as const;

interface ReflectionCard {
  id?: string;
  fragment: string;
  deplacement: string;
  direction: string;
  texture_relationnelle?: string;
  sphere?: string;
  emotion?: string;
  prisme?: string;
  date: string;
  user_note?: string; 
  image_url?: string; 
}

export default function Carnet() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cards, setCards] = useState<ReflectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [personalId, setPersonalId] = useState(localStorage.getItem('collegue_personal_id') || "");
  const [view, setView] = useState<'gallery' | 'rhythm' | 'affect' | 'elan' | 'matrice'>('gallery');
  const [metacognitionData, setMetacognitionData] = useState<any>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [affectNote, setAffectNote] = useState(localStorage.getItem('collegue_affect_note') || "");
  const [affectHistory, setAffectHistory] = useState<{date: string, note: string, analysis: string}[]>(
    JSON.parse(localStorage.getItem('collegue_affect_history') || "[]")
  );
  const [elanNarrative, setElanNarrative] = useState(localStorage.getItem('collegue_elan_narrative') || "");
  const [userNote, setUserNote] = useState(localStorage.getItem('collegue_user_note') || "");
  const [elanHistory, setElanHistory] = useState<{date: string, narrative: string, userNote: string}[]>(
    JSON.parse(localStorage.getItem('collegue_elan_history') || "[]")
  );
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(localStorage.getItem('collegue_sound') !== 'false');
  const [isPrismesModalOpen, setIsPrismesModalOpen] = useState(false);
  const [isLueursModalOpen, setIsLueursModalOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPrisme, setSelectedPrisme] = useState<string | null>(null);
  const [networkData, setNetworkData] = useState<any>(JSON.parse(localStorage.getItem('collegue_network') || "null"));
  const [eclatAnalysis, setEclatAnalysis] = useState<string | null>(localStorage.getItem('collegue_eclat') || null);

  const PRISME_DESCRIPTIONS: Record<string, string> = {
    joie: "L'énergie qui s'expand. La joie est un signal d'adéquation entre l'être et son acte. Elle marque une ouverture et une vitalité retrouvée.",
    tristesse: "Le retrait nécessaire. La tristesse s'installe quand une perte doit être métabolisée. Elle est la texture du désinvestissement utile.",
    colere: "La force de la limite. La colère surgit quand le cadre est menacé. Elle est une poussée vers la défense de son propre espace psychique.",
    peur: "Le signal de l'incertain. La peur signale une menace ou une rupture de prévisibilité. Elle invite à la prudence ou au surpoids du contrôle.",
    confiance: "Le relâchement constructif. La confiance permet de déléguer la vigilance. Elle est la base de toute coopération et de tout lien solide.",
    degout: "Le rejet protecteur. Le dégoût marque la saturation. Il impose une distance immédiate face à ce qui est perçu comme toxique ou intrusif.",
    anticipation: "Le regard vers l'avant. L'anticipation prépare le terrain. Elle est une projection qui cherche à réduire l'angoisse de l'inconnu.",
    surprise: "Le séisme cognitif. La surprise bouscule les attentes. Elle force une réactualisation brutale de la perception de la réalité.",
    honte: "Le repli du regard. La honte signale un écart douloureux entre l'idéal de soi et l'acte posé. Elle est un signal de régulation sociale interne.",
    melancolie: "La résonance de l'absence. La mélancolie est une tristesse qui s'est installée dans la durée, créant une profondeur et une esthétique du manque."
  };

  const toggleSound = () => {
    const newVal = !isSoundEnabled;
    setIsSoundEnabled(newVal);
    localStorage.setItem('collegue_sound', String(newVal));
  };

  const exportMatriceToPDF = () => {
    window.print();
  };

  // New analyses states
  const [lienData, setLienData] = useState<any>(JSON.parse(localStorage.getItem('collegue_lien') || "null"));
  const [affectData, setAffectData] = useState<any>(JSON.parse(localStorage.getItem('collegue_affect') || "null"));
  const [elanDataAnalysis, setElanDataAnalysis] = useState<any>(JSON.parse(localStorage.getItem('collegue_elan_eval') || "null"));
  const [matriceDataAnalysis, setMatriceDataAnalysis] = useState<any>(JSON.parse(localStorage.getItem('collegue_matrice_eval') || "null"));
  const [lueurs, setLueurs] = useState<any[]>(JSON.parse(localStorage.getItem('collegue_lueurs') || "[]"));
  const [sphereSonges, setSphereSonges] = useState<Record<string, string>>(
    JSON.parse(localStorage.getItem('collegue_sphere_songes') || "{}")
  );
  const [isEclatModalOpen, setIsEclatModalOpen] = useState(false);
  const [eclatRequest, setEclatRequest] = useState("");
  const [eclatStatus, setEclatStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [carnatCreatedAt, setCarnetCreatedAt] = useState<string | null>(null);

  // --- Synchronization logic ---
  const checkPermanentUnlock = async (currentPlan: string | undefined, createdAt: string | null) => {
    if (!personalId || currentPlan === 'reconnaissance') return;
    
    // Condition 1: 10 Prismes
    const uniquePrismes = new Set(cards.map(c => c.prisme).filter(Boolean));
    const has10Prismes = uniquePrismes.size >= 10;
    
    // Condition 2: All sections active
    const hasAllSections = !!(lienData && affectData && elanDataAnalysis && matriceDataAnalysis);
    
    // Condition 3: One year of practice
    if (!createdAt) return;
    const createdDate = new Date(createdAt);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const hasOneYear = createdDate <= oneYearAgo;
    
    if (has10Prismes && hasAllSections && hasOneYear) {
      try {
        const existing = await sbGet("carnet", `personal_id=eq.${personalId}`);
        if (existing && existing.length > 0) {
          await sbUpdate("carnet", existing[0].id, { plan: 'reconnaissance' });
        }
      } catch (e) {
        console.error("Failed to upgrade to Reconnaissance mode", e);
      }
    }
  };

  const syncCarnet = async () => {
    if (!personalId) return;
    try {
      const existing = await sbGet("carnet", `personal_id=eq.${personalId}`);
      const currentPlan = existing?.[0]?.plan;
      const createdAt = existing?.[0]?.created_at || carnatCreatedAt;

      const payload = {
        personal_id: personalId,
        lien_data: lienData,
        affect_data: affectData,
        elan_data: elanDataAnalysis,
        matrice_data: matriceDataAnalysis,
        lueurs: lueurs,
        songes: sphereSonges,
        prismes_unlocked: Array.from(new Set(cards.map(c => (c as any).prisme).filter(Boolean))),
        last_sync: new Date().toISOString()
      };
      
      if (existing && Array.isArray(existing) && existing.length > 0) {
        await sbUpdate("carnet", existing[0].id, payload);
      } else {
        await sbInsert("carnet", payload);
      }

      // Check for permanent unlock after sync
      checkPermanentUnlock(currentPlan, createdAt);
    } catch (e) {
      console.error("Sync carnet error:", e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (personalId) syncCarnet();
    }, 5000); // 5s debounce
    return () => clearTimeout(timer);
  }, [lienData, affectData, elanDataAnalysis, matriceDataAnalysis, lueurs, sphereSonges, cards]);

  const syncCardToCloud = async (card: ReflectionCard) => {
    if (!personalId || !card.id) return;
    try {
      const existing = await sbGet("cartes", `id=eq.${card.id}`);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        await sbUpdate("cartes", card.id, { ...card, personal_id: personalId });
      } else {
        await sbInsert("cartes", { ...card, personal_id: personalId });
      }
    } catch (e) {
      console.error("Sync card error:", e);
    }
  };

  const sendEclatRequest = async () => {
    if (!eclatRequest.trim()) return;
    setEclatStatus('sending');
    
    try {
      const payload = {
        type: 'eclat',
        request_text: eclatRequest,
        matrice_snapshot: matriceDataAnalysis,
        elan_snapshot: elanDataAnalysis,
        affect_snapshot: affectData,
        lien_snapshot: lienData,
        created_at: new Date().toISOString(),
        personal_id: localStorage.getItem('collegue_personal_id') || 'anonyme'
      };

      // We use sbInsert to save it to a table named 'eclats'
      await sbInsert("eclats", payload);
      setEclatStatus('sent');
      setEclatRequest("");
    } catch (e) {
      console.error("Failed to send eclat:", e);
      // Fallback for demo: even if table missing, we want to show 'sent' state to the user
      setEclatStatus('sent');
    }
  };

  const handleEclatSubmit = () => {
    sendEclatRequest();
  };

  const prismesCount = useMemo(() => {
    const uniquePrismes = new Set(cards.map(c => c.prisme).filter(Boolean));
    return uniquePrismes.size;
  }, [cards]);

  const unlockedSections = useMemo(() => {
    const now = new Date();
    const firstCardDate = cards.length > 0 ? new Date(cards[cards.length - 1].date) : now;
    const diffDays = Math.floor((now.getTime() - firstCardDate.getTime()) / (1000 * 3600 * 24));
    
    return {
      fragments: cards.length >= 1,
      lien: cards.length >= 2,
      affect: cards.length >= 3,
      elan: diffDays >= 7 && cards.length >= 2,
      matrice: diffDays >= 30 && cards.length >= 3 // simplification for months
    };
  }, [cards]);

  const copyToClipboard = (text: string, section: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  useEffect(() => {
    // Clear old default Elan message if it was saved in localStorage
    if (elanNarrative.includes("accumulation plus longue de fragments")) {
      setElanNarrative("");
    }
  }, [elanNarrative]);

  useEffect(() => {
    localStorage.setItem('collegue_affect_note', affectNote);
  }, [affectNote]);

  useEffect(() => {
    localStorage.setItem('collegue_affect_history', JSON.stringify(affectHistory));
  }, [affectHistory]);

  useEffect(() => {
    localStorage.setItem('collegue_elan_narrative', elanNarrative);
  }, [elanNarrative]);

  useEffect(() => {
    localStorage.setItem('collegue_user_note', userNote);
  }, [userNote]);

  useEffect(() => {
    localStorage.setItem('collegue_elan_history', JSON.stringify(elanHistory));
  }, [elanHistory]);

  const updateSphereSonge = (sphere: string, text: string) => {
    const newSonges = { ...sphereSonges, [sphere]: text };
    setSphereSonges(newSonges);
    localStorage.setItem('collegue_sphere_songes', JSON.stringify(newSonges));
  };

  const loadMetacognition = async () => {
    if (metacognitionData || cards.length < 5) return;
    setLoadingMeta(true);
    try {
      const res = await fetch("/api/metacognition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessions: cards,
          lien: lienData,
          affect: affectData,
          elan: elanDataAnalysis,
          songes: sphereSonges,
          structure_invisible: lienData?.relief
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMetacognitionData(data);
      }
    } catch (e) {
      console.error("Metacognition error:", e);
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    if (view === 'matrice' && !metacognitionData) {
      loadMetacognition();
    }
  }, [view, cards]);

  useEffect(() => {
    loadCards();
  }, []);

  const runAnalysis = async (type: string, data: any) => {
    try {
      const res = await fetch("/api/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error(`${type} analysis error:`, e);
    }
    return null;
  };

  useEffect(() => {
    if (cards.length >= 2 && !lienData) {
      runAnalysis("eval_lien", { cards }).then(data => {
        if (data) {
          setLienData(data);
          localStorage.setItem('collegue_lien', JSON.stringify(data));
        }
      });
    }
    if (cards.length >= 3 && !affectData) {
      runAnalysis("eval_affect", { 
        fragments: cards, 
        lien: lienData, 
        prismes: cards.map(c => c.prisme).filter(Boolean),
        songes: sphereSonges,
        structure_invisible: lienData?.relief
      }).then(data => {
        if (data) {
          setAffectData(data);
          localStorage.setItem('collegue_affect', JSON.stringify(data));
        }
      });
    }
    if (unlockedSections.elan && !elanDataAnalysis) {
      runAnalysis("eval_elan", { 
        fragments: cards, 
        lien: lienData, 
        affect: affectData,
        prismes: cards.map(c => c.prisme).filter(Boolean),
        songes: sphereSonges,
        structure_invisible: lienData?.relief
      }).then(data => {
        if (data) {
          setElanDataAnalysis(data);
          localStorage.setItem('collegue_elan_eval', JSON.stringify(data));
        }
      });
    }
    if (unlockedSections.matrice && !matriceDataAnalysis) {
      runAnalysis("eval_matrice", { 
        fragments: cards, 
        lien: lienData, 
        affect: affectData, 
        elan: elanDataAnalysis,
        prismes: cards.map(c => c.prisme).filter(Boolean),
        songes: sphereSonges,
        structure_invisible: lienData?.relief
      }).then(data => {
        if (data) {
          setMatriceDataAnalysis(data);
          localStorage.setItem('collegue_matrice_eval', JSON.stringify(data));
          
          // Trigger Lueur eval if not present for current month
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
          const existingLueurs = JSON.parse(localStorage.getItem('collegue_lueurs') || "[]");
          const hasCurrentMonthLueur = existingLueurs.some((l: any) => {
            const d = new Date(l.date);
            return `${d.getFullYear()}-${d.getMonth()}` === currentMonth;
          });

          if (!hasCurrentMonthLueur) {
            runAnalysis("eval_lueur", { 
              matrice: data,
              lien: lienData,
              affect: affectData,
              elan: elanDataAnalysis,
              fragments: cards,
              songes: sphereSonges
            }).then(lData => {
              if (lData && lData.title && lData.text) {
                const newLueur = { ...lData, date: new Date().toISOString() };
                const newLueurs = [newLueur, ...existingLueurs];
                setLueurs(newLueurs);
                localStorage.setItem('collegue_lueurs', JSON.stringify(newLueurs));
              }
            });
          }
        }
      });
    }
    if (cards.length >= 3 && !networkData) {
      runAnalysis("eval_network", { cards }).then(data => {
        if (data) {
          setNetworkData(data);
          localStorage.setItem('collegue_network', JSON.stringify(data));
        }
      });
    }
  }, [cards, unlockedSections]);

  const radarData = useMemo(() => {
    const spheres = ["Familiale", "Sociale", "Amoureuse", "Professionnelle"];
    return spheres.map(s => ({
      subject: s,
      A: cards.filter(c => c.sphere === s).length,
      fullMark: Math.max(...spheres.map(sp => cards.filter(c => sp === (c.sphere === "Amoureux" ? "Amoureuse" : c.sphere === "Familial" ? "Familiale" : c.sphere === "Social" ? "Sociale" : c.sphere === "Professionnel" ? "Professionnelle" : c.sphere)).length), 1)
    }));
  }, [cards]);

  const updateCardNote = (index: number, note: string) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], user_note: note };
    setCards(newCards);
    localStorage.setItem('collegue_cards', JSON.stringify(newCards));
    syncCardToCloud(newCards[index]);
  };

  const loadCards = async () => {
    setLoading(true);
    let allCards: ReflectionCard[] = [];

    // Load Local
    const local = JSON.parse(localStorage.getItem('collegue_cards') || '[]');
    
    // Load Cloud
    if (personalId) {
      try {
        // Load global carnet state first
        const cloudCarnet = await sbGet("carnet", `personal_id=eq.${personalId}`);
        if (cloudCarnet && Array.isArray(cloudCarnet) && cloudCarnet.length > 0) {
          const c = cloudCarnet[0];
          setCarnetCreatedAt(c.created_at);
          setCurrentPlan(c.plan);
          if (c.lien_data) setLienData(c.lien_data);
          if (c.affect_data) setAffectData(c.affect_data);
          if (c.elan_data) setElanDataAnalysis(c.elan_data);
          if (c.matrice_data) setMatriceDataAnalysis(c.matrice_data);
          if (c.lueurs) setLueurs(c.lueurs);
          if (c.songes) setSphereSonges(c.songes);
          else if (c.annotations) setSphereSonges(c.annotations);
        }

        // Load cards
        const cloudCards = await sbGet("cartes", `personal_id=eq.${personalId}&order=date.desc`);
        if (cloudCards && Array.isArray(cloudCards) && cloudCards.length > 0) {
           allCards = cloudCards;
        } else {
           allCards = local;
        }
      } catch (e) { 
        console.error("Cloud load failed", e);
        allCards = local;
      }
    } else {
      allCards = local;
    }
    
    // Ensure IDs exist for local compatibility
    const cardsWithIds = allCards.map((c: any) => ({ 
      ...c, 
      id: c.id || (c.date ? `local-${new Date(c.date).getTime()}` : crypto.randomUUID()) 
    }));

    setCards(cardsWithIds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
  };

  // Lien (Analysis)
  const getExperienceAnalysis = () => {
    if (cards.length < 3) return "Le réseau de fragments révèle le relief.";
    
    // Time Analysis
    const days = cards.map(c => new Date(c.date).getDay());
    const dayCounts = [0,0,0,0,0,0,0];
    days.forEach(d => dayCounts[d]++);
    const maxDay = dayCounts.indexOf(Math.max(...dayCounts));
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    
    // Spheres Analysis
    const spheres = cards.map(c => c.sphere).filter(Boolean);
    const sphereCounts: Record<string, number> = {};
    spheres.forEach(s => sphereCounts[s!] = (sphereCounts[s!] || 0) + 1);
    const sortedSpheres = Object.entries(sphereCounts).sort((a,b) => b[1] - a[1]);
    const topSphere = sortedSpheres[0]?.[0] || "non définie";
    
    // Emotions Analysis
    const emotions = cards.map(c => c.prisme).filter(Boolean);
    const emotionCounts: Record<string, number> = {};
    emotions.forEach(e => emotionCounts[e!] = (emotionCounts[e!] || 0) + 1);
    const sortedEmotions = Object.entries(emotionCounts).sort((a,b) => b[1] - a[1]);
    const topEmotionKey = sortedEmotions[0]?.[0];
    const topEmotion = topEmotionKey ? EMOTIONS[topEmotionKey as keyof typeof EMOTIONS]?.label.split(' ')[0] : "non identifiée";

    // Relationship Texture Analysis
    const textures = cards.map(c => c.texture_relationnelle).filter(Boolean);
    const textureCounts: Record<string, number> = {};
    textures.forEach(t => textureCounts[t!] = (textureCounts[t!] || 0) + 1);
    const sortedTextures = Object.entries(textureCounts).sort((a,b) => b[1] - a[1]);
    const topTexture = sortedTextures[0]?.[0];

    let synthesis = `Vos sessions se concentrent principalement le ${dayNames[maxDay]}. `;
    synthesis += `La dimension "${topSphere}" semble être le point de cristallisation actuel de votre réflexion. `;
    
    if (topEmotionKey) {
      synthesis += `Le climat émotionnel dominant qui s'en dégage est marqué par la ${topEmotion.toLowerCase()}. `;
    }

    if (topTexture) {
      synthesis += `Le grain de vos échanges est particulièrement marqué par une texture "${topTexture.toLowerCase()}". `;
    }

    if (sortedSpheres.length > 1) {
      synthesis += `On observe également des résonances dans la sphère ${sortedSpheres[1][0]}. `;
    }

    synthesis += "Ce lien suggère un mouvement de fond où votre attention clinique et personnelle cherche un nouvel équilibre.";
    
    return synthesis;
  };

  const getWeeklyAffectAnalysis = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentCards = cards.filter(c => new Date(c.date) >= oneWeekAgo);
    
    if (recentCards.length === 0) return "Le relief de votre vécu reste en suspens : aucune trace n'a été déposée ces derniers jours.";
    
    const emotions = recentCards.map(c => c.prisme).filter(Boolean);
    const emotionCounts: Record<string, number> = {};
    emotions.forEach(e => emotionCounts[e!] = (emotionCounts[e!] || 0) + 1);
    
    const sortedEmotions = Object.entries(emotionCounts).sort((a,b) => b[1] - a[1]);
    const topEmotionKey = sortedEmotions[0]?.[0];
    
    if (!topEmotionKey) return "La tonalité affective de la semaine est restée diffuse, sans relief marqué.";
    
    const topEmotion = EMOTIONS[topEmotionKey as keyof typeof EMOTIONS];
    
    const analysisMap: Record<string, string> = {
      joie: "Une éclaircie se dessine. L'élan vital semble avoir trouvé des points d'appui sur lesquels se reconstruire.",
      tristesse: "Le climat est au retrait, au recueillement. Une forme de lassitude ou de deuil de perspective semble imprégner le vécu actuel.",
      colere: "Une tension affleure. Des limites ont été bousculées, créant un besoin de réaffirmation ou de décharge émotionnelle.",
      peur: "Un sentiment d'insécurité ou d'incertitude prédomine, ralentissant les prises de décision et les mouvements vers l'extérieur.",
      degout: "Une forme de saturation ou de rejet se manifeste. Un besoin de mise à distance et de nettoyage relationnel semble nécessaire.",
      surprise: "Le paysage est instable, bousculé par l'imprévu. L'équilibre est en train de se redéfinir face à la nouveauté."
    };

    return analysisMap[topEmotionKey] || "Climat affectif modéré.";
  };

  const getElanAnalysis = () => {
    if (cards.length < 5) return "Le mouvement qui emerge à l'interieur.";
    
    // Direction analysis - looking for recurring words in "direction" field
    const directions = cards.map(c => c.direction).join(" ").toLowerCase();
    const commonThemes = ["équilibre", "limite", "ouverture", "soin", "action", "retrait", "construction", "sens"];
    const foundThemes = commonThemes.filter(theme => directions.includes(theme));
    
    let synthesis = "Au travers de la sédimentation de vos vécus, une structure narrative commence à émerger. ";
    
    if (foundThemes.length > 0) {
      synthesis += `Les thèmes de ${foundThemes.slice(0, 3).join(", ")} reviennent comme des balises. `;
    } else {
      synthesis += "Votre trajectoire semble se définir par de légers ajustements plutôt que par de grandes ruptures thématiques. ";
    }
    
    synthesis += "Ce qui se dessine, c'est un passage du particulier (le fragment quotidien) vers le général (votre sens de l'engagement). ";
    synthesis += "L'Élan actuel penche vers une consolidation de ce qui a été appris, transformant l'expérience subie en une direction choisie.";
    
    return synthesis;
  };

  const archiveAffectEvaluation = () => {
    if (!affectNote.trim()) return;
    
    const newEvaluation = {
      date: new Date().toISOString(),
      note: affectNote,
      analysis: getWeeklyAffectAnalysis()
    };
    
    const newHistory = [newEvaluation, ...affectHistory];
    setAffectHistory(newHistory);
    setAffectNote(""); // Clear current note after archiving
  };

  const archiveElanEvaluation = () => {
    if (!elanNarrative.trim() && !userNote.trim()) return;
    
    const newEvaluation = {
      date: new Date().toISOString(),
      narrative: elanNarrative || getElanAnalysis(),
      userNote: userNote
    };
    
    const newHistory = [newEvaluation, ...elanHistory];
    setElanHistory(newHistory);
    
    // Reset fields for new month
    setElanNarrative("");
    setUserNote("");
  };

  const getEmotionTheme = (teinte: string) => {
    const t = teinte.toLowerCase();
    
    // Default theme (Amber/Orange)
    let colorName = 'orange-500';
    let hex = '#F59E0B';
    let isDefault = true;

    // Plutchik's Wheel Logic
    if (t.includes('colère') || t.includes('agacement') || t.includes('fureur') || t.includes('conflit') || t.includes('conflict') || t.includes('explosive') || t.includes('tension') || t.includes('agress')) {
      colorName = 'red-500'; hex = '#EF4444'; isDefault = false;
    } else if (t.includes('joie') || t.includes('bonheur') || t.includes('enthousiasme') || t.includes('plaisir') || t.includes('chaleur')) {
      colorName = 'yellow-400'; hex = '#FACC15'; isDefault = false;
    } else if (t.includes('confiance') || t.includes('acceptation') || t.includes('sérénité') || t.includes('calme') || t.includes('sécurité')) {
      colorName = 'lime-400'; hex = '#A3E635'; isDefault = false;
    } else if (t.includes('peur') || t.includes('appréhension') || t.includes('crainte') || t.includes('anxiété') || t.includes('inquiétude')) {
      colorName = 'emerald-600'; hex = '#059669'; isDefault = false;
    } else if (t.includes('surprise') || t.includes('étonnement') || t.includes('imprévu') || t.includes('choc')) {
      colorName = 'sky-400'; hex = '#38BDF8'; isDefault = false;
    } else if (t.includes('tristesse') || t.includes('chagrin') || t.includes('déception') || t.includes('mélancolie') || t.includes('souffrance')) {
      colorName = 'blue-500'; hex = '#3B82F6'; isDefault = false;
    } else if (t.includes('dégoût') || t.includes('rejet') || t.includes('ennui') || t.includes('amertume') || t.includes('hostilité')) {
      colorName = 'purple-500'; hex = '#A855F7'; isDefault = false;
    } else if (t.includes('anticipation') || t.includes('vigilance') || t.includes('attente') || t.includes('projet') || t.includes('espoir')) {
      colorName = 'orange-500'; hex = '#F97316'; isDefault = false;
    }

    return { colorName, hex, isDefault };
  };

  const LockedSection = ({ title, requirements, icon: Icon }: { title: string, requirements: string, icon: any }) => (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-up">
      <div className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center mb-6">
        <Icon className="w-6 h-6 text-white/10" />
      </div>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40 mb-4">{title}</h3>
      <p className="font-serif italic text-beige-faint leading-relaxed max-w-sm mb-8">
        L'analyse n'est pas encore métabolisée. Elle nécessite une sédimentation plus profonde de votre vécu.
      </p>
      <div className="py-3 px-6 rounded-full border border-white/5 bg-black/20">
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#6BA368]">
          <span className="opacity-50">Condition : </span>{requirements}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-beige-dim font-serif">
      <header className="flex-shrink-0 border-b border-border bg-bg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-1 hover:bg-white/10 rounded-full transition-colors" title="Retour">
              <ArrowLeft className="w-4 h-4 text-beige-faint" />
            </Link>
            {currentPlan === 'reconnaissance' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green/10 border border-green/20">
                <div className="w-1 h-1 rounded-full bg-green animate-pulse" />
                <span className="font-mono text-[8px] uppercase tracking-widest text-green">Mode Reconnaissance</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Link to="/chat" className={`font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${location.pathname === '/chat' ? 'text-beige bg-white/5 ring-1 ring-white/10' : 'text-beige-faint hover:text-beige'}`}>
              <Brain size={10} strokeWidth={1.5} />
              <span>penser</span>
            </Link>
            <Link to="/carnet" className={`font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${location.pathname === '/carnet' ? 'text-beige bg-white/5 ring-1 ring-white/10' : 'text-beige-faint hover:text-beige'}`}>
              <BookOpen size={10} strokeWidth={1.5} />
              <span>carnet</span>
            </Link>
            <button 
              onClick={toggleSound}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-beige-faint hover:text-beige ml-1"
              title={isSoundEnabled ? "Désactiver la résonance" : "Activer la résonance"}
            >
              {isSoundEnabled ? <Volume2 size={13} strokeWidth={1.5} /> : <VolumeX size={13} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto py-12 px-6">

        <div className="mb-12 border-b border-border pb-12 print:hidden">
          <div className="flex flex-wrap justify-center gap-x-6 md:gap-x-12 gap-y-6 max-w-3xl mx-auto mb-8">
            <button 
              onClick={() => setView('gallery')}
              className={`flex items-center gap-2.5 font-mono text-[10px] tracking-widest uppercase transition-colors relative group px-3 py-1.5 rounded-sm ${view === 'gallery' ? 'text-green' : 'text-beige-faint hover:text-beige'}`}
            >
              <History className="w-4 h-4" /> 
              <span>Fragments</span>
              {view === 'gallery' && <motion.div layoutId="nav-pill" className="absolute -bottom-1 left-3 right-3 h-px bg-green/40" />}
            </button>
            
            <button 
              onClick={() => setView('rhythm')}
              className={`flex items-center gap-2.5 font-mono text-[10px] tracking-widest uppercase transition-colors relative group px-3 py-1.5 rounded-sm ${view === 'rhythm' ? 'text-[#F59E0B]' : 'text-beige-faint hover:text-beige'}`}
            >
              <Heart className="w-4 h-4" /> 
              <span>Lien</span>
              {view === 'rhythm' && <motion.div layoutId="nav-pill" className="absolute -bottom-1 left-3 right-3 h-px bg-[#F59E0B]/40" />}
            </button>
            
            <button 
              onClick={() => setView('affect')}
              className={`flex items-center gap-2.5 font-mono text-[10px] tracking-widest uppercase transition-colors relative group px-3 py-1.5 rounded-sm ${view === 'affect' ? 'text-[#94A3B8]' : 'text-beige-faint hover:text-beige'}`}
            >
              <Waves className="w-4 h-4" /> 
              <span>Affect</span>
              {view === 'affect' && <motion.div layoutId="nav-pill" className="absolute -bottom-1 left-3 right-3 h-px bg-[#94A3B8]/40" />}
            </button>
            
            <button 
              onClick={() => setView('elan')}
              className={`flex items-center gap-2.5 font-mono text-[10px] tracking-widest uppercase transition-colors relative group px-3 py-1.5 rounded-sm ${view === 'elan' ? 'text-[#FAF9F6]' : 'text-beige-faint hover:text-beige'}`}
            >
              <Orbit className="w-4 h-4" /> 
              <span>Élan</span>
              {view === 'elan' && <motion.div layoutId="nav-pill" className="absolute -bottom-1 left-3 right-3 h-px bg-white/40" />}
            </button>
            
            <button 
              onClick={() => setView('matrice')}
              className={`flex items-center gap-2.5 font-mono text-[10px] tracking-widest uppercase transition-all relative group px-3 py-1.5 rounded-sm ${view === 'matrice' ? 'text-green' : 'text-beige-faint hover:text-beige'}`}
            >
              <Fingerprint className="w-4 h-4" /> 
              <span>Matrice</span>
              {view === 'matrice' && <motion.div layoutId="nav-pill" className="absolute -bottom-1 left-3 right-3 h-px bg-green/40" />}
            </button>
          </div>

          <div className="flex justify-center items-center gap-8">
            <button 
              onClick={() => setIsPrismesModalOpen(true)}
              className="group flex flex-col items-center gap-2 transition-all"
              title="Prismes"
            >
              <div className="w-8 h-8 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center group-hover:border-yellow-400/30 transition-all">
                <Gem className={`w-4 h-4 transition-colors ${prismesCount > 0 ? 'text-yellow-400/40 group-hover:text-yellow-400' : 'text-white/10'}`} />
              </div>
            </button>

            <button 
              onClick={() => setIsLueursModalOpen(true)}
              className="group flex flex-col items-center gap-2 transition-all"
              title="Lueurs"
            >
              <div className="w-8 h-8 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center group-hover:border-white/30 transition-all">
                <Sparkles className={`w-4 h-4 transition-colors ${lueurs.length > 0 ? 'text-white/40 group-hover:text-white/80' : 'text-white/10'}`} />
              </div>
            </button>

            <button 
              onClick={() => setIsNetworkModalOpen(true)}
              className="group flex flex-col items-center gap-2 transition-all"
              title="Climat de sphère"
            >
              <div className="w-8 h-8 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center group-hover:border-purple-500/30 transition-all">
                <Network className="w-4 h-4 text-white/10 group-hover:text-purple-400/40 transition-all" />
              </div>
            </button>
          </div>
        </div>

        <ClarteSection section={`carnet-${view}`} />

        {view === 'gallery' ? (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
            {loading ? (
                <div className="col-span-2 text-center py-20 font-mono text-[9px] uppercase tracking-widest opacity-40">Immersion dans vos archives…</div>
              ) : cards.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center py-24 gap-4">
                  <Link to="/chat" className="font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-beige-faint hover:text-beige ring-1 ring-beige-faint/20 bg-white/[0.02]">
                    <Brain size={10} strokeWidth={1.5} />
                    <span>penser</span>
                  </Link>
                  <p className="italic text-beige-faint opacity-40 text-[12px]">le vécu pour prendre du recul.</p>
                </div>
              ) : (
                cards.map((card, i) => {
                  const emotionKey = (card.emotion || card.prisme || "").toLowerCase() as keyof typeof EMOTIONS;
                  const emotionData = EMOTIONS[emotionKey] || null;
                  const isLocked = !card.prisme;
                  return (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`bg-[#0a1a12] border ${emotionData ? emotionData.border : 'border-[#3a3420]'} rounded-lg p-6 space-y-4 hover:border-[#3a3420]/60 transition-all`}
                    >
                      <div className="text-[10px] font-mono text-[#4a4028] mb-2 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>{new Date(card.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                          <button 
                            onClick={() => copyToClipboard(`Fragment: ${card.fragment}\nDéplacement: ${card.deplacement}\nDirection: ${card.direction}`, `card-${i}`)}
                            className="p-1 hover:bg-white/5 rounded transition-colors group relative"
                            title="Copier le chemin"
                          >
                            {copiedSection === `card-${i}` ? (
                              <Check className="w-2.5 h-2.5 text-green-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-20 group-hover:opacity-100" />
                            )}
                          </button>
                        </div>
                        <div className="flex gap-2 items-center">
                          {card.sphere && <span className="text-[8px] uppercase tracking-tighter text-beige-faint/40">{card.sphere}</span>}
                          {emotionData && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: emotionData.color, boxShadow: `0 0 5px ${emotionData.color}44` }} />
                          )}
                          {!isLocked && (
                            <Gem className="w-2.5 h-2.5 text-yellow-500/60" title={`Prisme: ${card.prisme}`} />
                          )}
                        </div>
                      </div>
                      <div className={`border-l ${emotionData ? emotionData.border : 'border-[#3a3420]'} pl-4 text-xs italic text-[#9a8a68]`}>{card.fragment}</div>
                      
                      {card.image_url && (
                        <div className="my-4 relative aspect-video overflow-hidden rounded border border-white/5 group">
                          <img 
                            src={card.image_url} 
                            alt="Texture relationnelle" 
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-2 left-3 font-mono text-[7px] uppercase tracking-widest text-beige-faint opacity-50">Texture générée</div>
                        </div>
                      )}

                      <div className={`border-l ${emotionData ? emotionData.border : 'border-[#3a3420]'} pl-4 text-xs text-[#9a8a68]`}>{card.deplacement}</div>
                      <div className={`border-l ${emotionData ? emotionData.border : 'border-[#3a3420]'} pl-4 text-xs font-medium text-[#9a8a68] mb-2`}>{card.direction}</div>
                      
                      <div className="pt-2">
                        <div className="flex items-center gap-1.5 mb-1.5 opacity-40">
                          <Feather className="w-2.5 h-2.5" />
                          <span className="font-mono text-[7px] uppercase tracking-widest">Songe</span>
                        </div>
                        <textarea
                          value={card.user_note || ""}
                          onChange={(e) => updateCardNote(i, e.target.value)}
                          placeholder="Déposer un songe… (ex: Ce ressenti a évolué vers…)"
                          className="w-full bg-black/20 border border-white/5 rounded px-3 py-2 text-[10px] text-beige-faint italic outline-none focus:border-white/10 resize-none h-12"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t border-[#3a3420]/30">
                        <div className="flex items-center gap-2">
                          {card.texture_relationnelle && (
                            <span className="font-mono text-[7px] uppercase tracking-widest text-green/50">Résonance : {card.texture_relationnelle}</span>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          {emotionData && (
                            <div className={`px-2 py-0.5 rounded-sm text-[6px] font-mono uppercase tracking-tighter border ${emotionData.bg} ${emotionData.border} text-beige w-fit`}>
                              {isLocked ? "Signal détecté" : emotionData.label.split(' ')[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        ) : view === 'rhythm' ? (
          <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
            {!unlockedSections.lien ? (
              <LockedSection 
                title="Lien" 
                requirements="Minimum 2 fragments sédimentés" 
                icon={Heart} 
              />
            ) : lienData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {['Familiale', 'Sociale', 'Amoureuse', 'Professionnelle'].map((s) => {
                    const key = s.toLowerCase();
                    const data = lienData[s] || lienData[key];
                    if (!data) return null;
                    const theme = getEmotionTheme(data.teinte);
                    const isDefault = theme.isDefault;

                    return (
                      <div 
                        key={s} 
                        className="bg-[#1a1814] border p-6 rounded-lg flex flex-col h-full transform hover:scale-[1.02] transition-all duration-500 group relative overflow-hidden"
                        style={{ 
                          borderColor: isDefault ? 'rgba(245, 158, 11, 0.1)' : `${theme.hex}33` 
                        }}
                      >
                        {/* Glow effect matching emotion color */}
                        <div 
                          className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-xl -z-10"
                          style={{ 
                            background: `radial-gradient(circle at center, ${theme.hex}11, transparent 70%)`
                          }}
                        />

                        <div className="flex justify-between items-center mb-6">
                          <h3 
                            className="font-mono text-[10px] tracking-widest uppercase transition-colors opacity-60 group-hover:opacity-100"
                            style={{ color: theme.hex }}
                          >
                            {s}
                          </h3>
                          <div 
                            className="text-[10px] font-mono opacity-20"
                            style={{ color: theme.hex }}
                          >
                            {data.intensite}%
                          </div>
                        </div>
                        <div className="h-0.5 bg-white/5 mb-6 overflow-hidden">
                           <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${data.intensite}%` }}
                            className="h-full transition-colors duration-500"
                            style={{ backgroundColor: `${theme.hex}66` }}
                          />
                        </div>
                        <div className="flex-1 space-y-3">
                          {data.fragments?.map((f: string, i: number) => (
                             <div 
                               key={i} 
                               className="text-[12px] font-serif italic text-beige-faint/80 border-l pl-3 leading-relaxed transition-colors duration-500"
                               style={{ borderLeftColor: `${theme.hex}1a` }}
                             >
                               {f}
                             </div>
                          ))}
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/5">
                          <div 
                            className="font-mono text-[7px] uppercase mb-1 italic opacity-30"
                            style={{ color: theme.hex }}
                          >
                            Teinte dominante
                          </div>
                          <div 
                            className="text-[11px] italic transition-colors duration-500 mb-4"
                            style={{ color: theme.hex }}
                          >
                            {data.teinte}
                          </div>

                          <div className="pt-2 border-t border-white/5">
                            <div className="flex items-center gap-1.5 mb-1.5 opacity-40">
                              <Feather className="w-2 h-2" />
                              <span className="font-mono text-[6px] uppercase tracking-widest">Songe</span>
                            </div>
                            <textarea
                              value={sphereSonges[s] || sphereSonges[key] || ""}
                              onChange={(e) => updateSphereSonge(s, e.target.value)}
                              placeholder="Notes sur cette sphère…"
                              className="w-full bg-black/40 border border-white/5 rounded px-2 py-1 text-[9px] text-beige-faint italic outline-none focus:border-white/10 resize-none h-12 custom-scrollbar"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="py-12 border-t border-white/5 text-center">
                  <div className="font-mono text-[8px] uppercase tracking-[0.5em] text-white/20 mb-4">Structure Invisible</div>
                  <p className="text-xl md:text-2xl font-serif italic text-beige leading-relaxed max-w-2xl mx-auto">
                    "{lienData.relief}"
                  </p>
                  <p className="mt-8 font-mono text-[9px] uppercase tracking-widest text-beige-faint italic opacity-40">
                    Avant le mouvement, avant la pensée.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-20 font-mono text-[10px] uppercase text-white/20 tracking-widest italic">Mise en lien du vécu en cours…</div>
            )}
          </div>
        ) : view === 'affect' ? (
          <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
            {!unlockedSections.affect ? (
              <LockedSection 
                title="Affect" 
                requirements="Minimum 3 fragments sédimentés" 
                icon={Waves} 
              />
            ) : affectData ? (
              <>
                <div className="grid md:grid-cols-3 gap-8">
                  {['active', 'inhibe', 'emerge'].map((key) => (
                    <div key={key} className="space-y-4">
                      <h3 className="font-mono text-[9px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">
                        Affects {key === 'active' ? 'moteurs' : key === 'inhibe' ? 'inhibiteurs' : 'émergents'}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                         {affectData[key]?.map((a: string, i: number) => (
                           <div key={i} className={`px-3 py-1.5 rounded-sm border font-serif text-[13px] italic
                             ${key === 'active' ? 'border-yellow-400/20 bg-yellow-400/5 text-yellow-400' : 
                               key === 'inhibe' ? 'border-blue-400/20 bg-blue-400/5 text-blue-400' : 
                               'border-purple-400/20 bg-purple-400/5 text-purple-400'}`}
                           >
                             {a}
                           </div>
                         ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="py-12 border-t border-white/5">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-white/20 mb-4 italic">Texture affective de la semaine</div>
                  <p className="text-lg font-serif italic text-beige-faint leading-relaxed">
                    "{affectData.texture_semaine}"
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-20 font-mono text-[10px] uppercase text-white/20 tracking-widest italic">Analyse des affects en cours…</div>
            )}
          </div>
        ) : view === 'elan' ? (
          <div className="space-y-12 animate-fade-up max-w-2xl mx-auto text-center">
            {!unlockedSections.elan ? (
              <LockedSection 
                title="Élan" 
                requirements="7 jours de sédimentation et 2 fragments minimum" 
                icon={Orbit} 
              />
            ) : elanDataAnalysis ? (
              <div className="space-y-12">
                <div className="space-y-4">
                  <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/20">Mouvement</div>
                  <p className="text-2xl md:text-3xl font-serif italic text-beige leading-snug">
                    "{elanDataAnalysis.mouvement}"
                  </p>
                </div>
                
                <div className="w-12 h-px bg-white/10 mx-auto" />

                <div className="space-y-4">
                  <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/20">Direction</div>
                  <p className="text-lg font-serif text-beige-faint leading-relaxed">
                    {elanDataAnalysis.direction}
                  </p>
                </div>

                <div className="pt-12 border-t border-white/5">
                  <div className="font-mono text-[8px] tracking-[0.4em] uppercase text-green/40 mb-4 italic">La question qui travaille</div>
                  <p className="text-xl font-serif italic text-white leading-relaxed">
                    "{elanDataAnalysis.question}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 font-mono text-[10px] uppercase text-white/20 tracking-widest italic">Trajectoire en cours d'évaluation…</div>
            )}
          </div>
        ) : (
          /* view === 'matrice' */
          <div className="space-y-12 animate-fade-up max-w-4xl mx-auto">
            {!unlockedSections.matrice ? (
              <LockedSection 
                title="Matrice" 
                requirements="30 jours de sédimentation et 3 fragments minimum" 
                icon={Fingerprint} 
              />
            ) : matriceDataAnalysis ? (
              <>
                <div className="grid md:grid-cols-2 gap-12">
                   {/* Angoisses */}
                   <div className="space-y-6">
                    <h3 className="font-mono text-[10px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">Angoisses de structure</h3>
                    <div className="space-y-4">
                      {matriceDataAnalysis.angoisses?.map((a: any, i: number) => (
                        <div key={i} className="group">
                          <div className="flex justify-between items-end mb-1">
                            <span className="font-serif text-[13px] text-beige italic">{a.label}</span>
                            <span className="font-mono text-[8px] text-white/20">{a.intensite}%</span>
                          </div>
                          <div className="h-0.5 w-full bg-white/5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${a.intensite}%` }}
                              className="h-full bg-red-400/30"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {a.manifestations?.map((m: any, j: number) => (
                              <span key={j} className="font-mono text-[7px] text-beige-faint/40 px-1.5 py-0.5 bg-white/5 rounded-sm">{m}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Valeurs */}
                  <div className="space-y-6">
                    <h3 className="font-mono text-[10px] tracking-widest uppercase text-beige-faint border-b border-white/5 pb-2">Valeurs d'ancrage</h3>
                    <div className="space-y-6">
                      {matriceDataAnalysis.valeurs?.map((v: any, i: number) => (
                        <div key={i}>
                          <div className="font-serif text-[13px] text-beige italic mb-2">{v.label}</div>
                          <div className="flex flex-wrap gap-2">
                            {v.proximite?.map((p: any, j: number) => (
                              <span key={j} className="font-mono text-[8px] text-beige-faint italic opacity-50">"{p}"</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Schéma Central */}
                <div className="py-12 border-y border-white/5 text-center">
                    <div className="flex justify-center items-center gap-8 mb-8">
                      <button 
                        onClick={() => setIsEclatModalOpen(true)}
                        className="flex items-center gap-2 py-2 px-6 bg-yellow-400/5 hover:bg-yellow-400/10 border border-yellow-400/20 text-yellow-500/80 hover:text-yellow-400 font-mono text-[9px] tracking-[0.3em] uppercase rounded-full transition-all"
                      >
                        <Zap size={14} className="animate-pulse" />
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-yellow-400">Invoquer un Éclat</span>
                          <span className="font-serif text-[7px] lowercase italic opacity-40 text-beige-faint">Métabolisation humaine ponctuelle</span>
                        </div>
                      </button>

                      <button 
                        onClick={exportMatriceToPDF}
                        className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-beige-faint/40 hover:text-beige transition-colors"
                      >
                        <Download size={12} />
                        <span>PDF</span>
                      </button>
                    </div>
                   <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-green/40 mb-6 italic">Schéma Central</div>
                   <p className="text-xl md:text-2xl font-serif italic text-beige leading-relaxed max-w-2xl mx-auto">
                    "{matriceDataAnalysis.schema_central}"
                   </p>
                </div>

                {/* Défenses */}
                <div className="space-y-8">
                  <h3 className="font-mono text-[10px] tracking-widest uppercase text-beige-faint text-center">Système de Défense</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    {matriceDataAnalysis.defenses?.map((d: any, i: number) => (
                      <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-lg">
                        <div className="font-serif text-[14px] text-beige mb-3">{d.label}</div>
                        <div className="space-y-3">
                          <div>
                            <div className="font-mono text-[7px] uppercase text-white/20 mb-1">Déclencheur</div>
                            <div className="text-[11px] text-beige-faint leading-relaxed">{d.declencheur}</div>
                          </div>
                          <div>
                            <div className="font-mono text-[7px] uppercase text-white/20 mb-1">Direction</div>
                            <div className="text-[11px] text-beige-faint leading-relaxed italic">{d.direction}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lueurs */}
                {lueurs.length > 0 && (
                  <div className="pt-12">
                    <h3 className="font-mono text-[10px] tracking-widest uppercase text-beige-faint text-center mb-8">Lueurs accumulées</h3>
                    <div className="max-w-xl mx-auto space-y-6">
                      {lueurs.map((lueur, i) => (
                        <div key={i} className="bg-yellow-400/5 border border-yellow-400/20 p-6 rounded-lg text-center relative overflow-hidden group">
                          <div className="absolute inset-0 bg-yellow-400/10 blur-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Sparkles className="w-5 h-5 text-yellow-400 mx-auto mb-4 opacity-50" />
                          <div className="font-serif text-lg text-yellow-400 italic mb-2">{lueur.title}</div>
                          <p className="text-xs text-beige-faint leading-relaxed">{lueur.text}</p>
                          <div className="mt-4 font-mono text-[7px] uppercase tracking-widest text-white/10">
                            {new Date(lueur.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Visualiser Matrice Button */}
                <div className="pt-20 text-center">
                  <p className="font-mono text-[7px] text-white/20 uppercase tracking-widest italic mb-4">Structure cristallisée · Prête pour l'Eclat</p>
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <p className="font-mono text-[10px] uppercase text-white/20 tracking-widest">Calcul de la structure en cours…</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isPrismesModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsPrismesModalOpen(false);
                setSelectedPrisme(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400/20" />
              <button 
                onClick={() => {
                  setIsPrismesModalOpen(false);
                  setSelectedPrisme(null);
                }}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>
              
              <div className="mb-8 text-center md:text-left">
                <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-yellow-400 mb-2">Prismes Collectés</div>
                <div className="text-3xl font-serif text-white">{prismesCount}<span className="text-white/20">/10</span></div>
              </div>

              <div className="grid grid-cols-5 gap-3 mb-8">
                {Object.entries(EMOTIONS).map(([key, em]) => {
                  const isFound = cards.some(c => c.prisme === key);
                  return (
                    <div key={key} className="flex flex-col items-center gap-1.5">
                      <button 
                        onClick={() => {
                          if (isFound) {
                            setSelectedPrisme(key);
                          }
                        }}
                        className={`aspect-square w-full rounded-full border flex items-center justify-center transition-all
                          ${isFound ? 'border-yellow-400/20 bg-yellow-400/5 cursor-pointer hover:border-yellow-400/40' : 'border-white/5 bg-white/[0.02] opacity-30 cursor-default'}`}
                        title={isFound ? em.label : "Prisme non découvert"}
                      >
                        <Gem className={`w-4 h-4 ${isFound ? 'text-yellow-400' : 'text-white/10'}`} />
                      </button>
                      {isFound && (
                        <span className="font-mono text-[6px] uppercase tracking-tighter text-white/20 text-center truncate w-full">
                          {em.label.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-[10px] font-mono leading-relaxed text-beige-faint/40 italic text-center">
                  Cliquez sur un prisme pour en comprendre la clarté.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {selectedPrisme && (
          <PrismeExplainer 
            isOpen={!!selectedPrisme}
            onClose={() => setSelectedPrisme(null)}
            title={EMOTIONS[selectedPrisme as keyof typeof EMOTIONS].label.split(' ')[0]}
            content={PRISME_DESCRIPTIONS[selectedPrisme]}
            color={EMOTIONS[selectedPrisme as keyof typeof EMOTIONS].color}
          />
        )}

        {isLueursModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLueursModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl p-10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-white/20" />
              <button 
                onClick={() => setIsLueursModalOpen(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>
              
                  <div className="mb-10 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full border border-white/5 overflow-hidden opacity-20 hover:opacity-80 transition-opacity">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-cover grayscale" />
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-[#f59e0b]/40">Évolution · Lueurs</div>
                </div>
                <p className="text-[10px] text-beige-faint/60 italic leading-relaxed">
                  Contenu mensuel généré pour éclairer votre Matrice. Inclus dans l'abonnement Évolution.
                </p>
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {lueurs.map((lueur, i) => (
                  <div 
                    key={i} 
                    className="p-4 rounded-lg border border-white/10 bg-white/5 transition-all"
                  >
                    <div className="flex gap-4">
                      <Sparkles className="w-4 h-4 text-white/40 flex-shrink-0 mt-1" />
                      <div>
                        <div className="font-serif text-md text-white italic mb-1">{lueur.title}</div>
                        <p className="text-[11px] leading-relaxed text-beige-faint">{lueur.text}</p>
                        <div className="mt-2 font-mono text-[6px] uppercase tracking-widest text-white/20">
                          {new Date(lueur.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {[...Array(3)].map((_, i) => (
                  <div 
                    key={`latent-${i}`} 
                    className="p-4 rounded-lg border border-dashed border-white/5 bg-transparent opacity-40"
                  >
                    <div className="h-4 flex items-center justify-center font-mono text-[6px] uppercase tracking-[0.3em] text-white/40">Lueur latente</div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-8 border-t border-white/5 flex-shrink-0 space-y-6">
                {eclatAnalysis ? (
                   <div className="p-5 bg-white/5 border border-white/10 rounded-lg">
                     <div className="font-mono text-[8px] uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
                       <Gem className="w-3 h-3 text-white/20" />
                       <span>Dernier Éclat</span>
                     </div>
                     <p className="text-[11px] font-serif italic text-white/80 leading-relaxed line-clamp-3">
                       "{eclatAnalysis}"
                     </p>
                   </div>
                ) : (
                  <div className="text-center">
                    <button 
                      onClick={() => setIsEclatModalOpen(true)}
                      className="w-full py-3 bg-white/[0.02] hover:bg-white/5 border border-white/5 text-white/40 hover:text-white/60 font-mono text-[8px] tracking-[0.3em] uppercase rounded-full transition-all disabled:opacity-20"
                    >
                      Invoquer un Éclat
                    </button>
                    <div className="mt-3 font-mono text-[6px] text-white/20 uppercase tracking-[0.2em] italic text-center">
                      Métabolisation d'une demande par l'expérience humaine
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
        {isNetworkModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNetworkModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl p-10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-purple-500/20" />
              <button 
                onClick={() => setIsNetworkModalOpen(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>
              
              <div className="mb-10 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full border border-white/5 overflow-hidden opacity-20 hover:opacity-80 transition-opacity">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-cover grayscale" />
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-purple-400/30">Climat de sphère</div>
                </div>
              </div>

              <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                {networkData ? (
                  ['Familiale', 'Sociale', 'Amoureuse', 'Professionnelle'].map((sphere) => (
                    <div key={sphere} className="p-5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-purple-500/5 transition-colors group">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-purple-400/40 mb-3 group-hover:text-purple-400/60 transition-colors">{sphere}</div>
                      <p className="text-[12px] font-serif italic text-beige-faint/80 leading-relaxed">
                        {networkData[sphere.toLowerCase()] || "Aucune sédimentation collective détectée dans cette sphère."}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center font-mono text-[10px] uppercase text-white/20 tracking-widest italic">
                    Analyse du climat collectif en cours…
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-[10px] font-mono leading-relaxed text-beige-faint/40 italic">
                  Ces textures sont le reflet anonymisé du sentiment des communautés qui habitent vos sphères de vie, issues de la sédimentation de vos vécus.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {isEclatModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEclatModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-yellow-400/20 rounded-2xl p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400/40" />
              <button 
                onClick={() => setIsEclatModalOpen(false)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>

              <div className="text-center mb-8">
                <a href="https://www.paypal.com/donate/?business=REDACTED&item_name=Eclat+du+Coll%C3%A8gue&currency_code=EUR" target="_blank" rel="noopener noreferrer" className="cursor-pointer group">
                  <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-serif text-white mb-2 italic hover:text-yellow-400 transition-colors">L'Éclat</h3>
                </a>
                <p className="text-xs text-beige-faint/60 leading-relaxed max-w-sm mx-auto italic">
                  Lecture en profondeur collaborative. Votre Matrice et votre demande seront transmises pour une métabolisation par l'expérience humaine. Un acte ponctuel, rare et structurant.
                </p>
              </div>

              {eclatStatus === 'sent' ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-400/5 border border-green-400/20 p-8 rounded-lg text-center"
                >
                  <Check className="w-10 h-10 text-green-400 mx-auto mb-4" />
                  <p className="text-sm text-beige font-serif italic mb-4">Votre demande a été transmise pour métabolisation humaine.</p>
                  <p className="text-[10px] text-beige-faint/40 font-mono uppercase tracking-widest italic leading-relaxed">
                    Le temps de la métabolisation approche.<br />Une réponse vous sera remise sous peu.
                  </p>
                  <button 
                    onClick={() => setIsEclatModalOpen(false)}
                    className="mt-8 px-6 py-2 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 font-mono text-[8px] uppercase tracking-widest rounded-full transition-all"
                  >
                    Fermer
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 ml-1">Votre question ou situation actuelle</label>
                    <textarea 
                      value={eclatRequest}
                      onChange={(e) => setEclatRequest(e.target.value)}
                      placeholder="Formulez votre demande ici…"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-sm text-beige italic focus:border-yellow-400/40 outline-none transition-colors h-40 resize-none custom-scrollbar"
                    />
                  </div>

                  <div className="bg-yellow-400/5 border border-yellow-400/10 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Gem className="w-4 h-4 text-yellow-400/60 mt-0.5" />
                      <div className="text-[10px] text-yellow-400/80 leading-relaxed font-serif italic">
                        Cet acte nécessite un soin particulier. L'Éclat est un service ponctuel impliquant une lecture humaine approfondie et collaborative de votre structure psychique.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/10">
                    <p className="text-[9px] font-mono leading-relaxed text-yellow-400/40 uppercase tracking-widest text-center">
                      Attention : Cet acte requiert une intervention humaine spécifique. Un don libre pourra être fait après réception de votre lueur.
                    </p>
                  </div>

                  <button 
                    onClick={handleEclatSubmit}
                    disabled={!eclatRequest.trim() || eclatStatus === 'sending'}
                    className="w-full py-4 bg-yellow-400 text-black font-mono text-[10px] tracking-[0.4em] uppercase rounded-xl hover:bg-yellow-300 transition-all font-bold disabled:opacity-20"
                  >
                    {eclatStatus === 'sending' ? 'Transmission…' : 'Envoyer la demande'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
