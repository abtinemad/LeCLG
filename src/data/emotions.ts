// Prismes (émotions) — palette et libellés partagés du Carnet.
// Extrait de Carnet.tsx pour alléger le composant et centraliser la donnée.
export const EMOTIONS = {
  joie: {
    label: "Joie (Prisme)",
    color: "#FACC15",
    bg: "bg-[#FACC15]/15",
    border: "border-[#FACC15]/40",
  },
  tristesse: {
    label: "Tristesse (Prisme)",
    color: "#60A5FA",
    bg: "bg-[#60A5FA]/15",
    border: "border-[#60A5FA]/40",
  },
  colere: {
    label: "Colère (Prisme)",
    color: "#F87171",
    bg: "bg-[#F87171]/15",
    border: "border-[#F87171]/40",
  },
  peur: {
    label: "Peur (Prisme)",
    color: "#A78BFA",
    bg: "bg-[#A78BFA]/15",
    border: "border-[#A78BFA]/40",
  },
  degout: {
    label: "Dégoût (Prisme)",
    color: "#4ADE80",
    bg: "bg-[#4ADE80]/15",
    border: "border-[#4ADE80]/40",
  },
  surprise: {
    label: "Surprise (Prisme)",
    color: "#FB923C",
    bg: "bg-[#FB923C]/15",
    border: "border-[#FB923C]/40",
  },
  confiance: {
    label: "Confiance (Prisme)",
    color: "#22D3EE",
    bg: "bg-[#22D3EE]/15",
    border: "border-[#22D3EE]/40",
  },
  anticipation: {
    label: "Anticipation (Prisme)",
    color: "#F472B6",
    bg: "bg-[#F472B6]/15",
    border: "border-[#F472B6]/40",
  },
  honte: {
    label: "Honte (Prisme)",
    color: "#94A3B8",
    bg: "bg-[#94A3B8]/15",
    border: "border-[#94A3B8]/40",
  },
  melancolie: {
    label: "Mélancolie (Prisme)",
    color: "#8B5CF6",
    bg: "bg-[#8B5CF6]/15",
    border: "border-[#8B5CF6]/40",
  },
} as const;

export interface ReflectionCard {
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