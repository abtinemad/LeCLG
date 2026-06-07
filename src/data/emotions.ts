// Prismes (émotions) & Sphères — palette et libellés PARTAGÉS, source unique.
// Toute couleur d'émotion/sphère vit ICI et nulle part ailleurs : Carnet, Climat
// et Chat importent depuis ce fichier. Les valeurs sont reconciliées sur la
// palette mate du produit (pigment fané), familles écartées pour rester distinctes.
// NB Tailwind : les classes arbitraires bg-[#hex]/15 doivent apparaître en clair
// ici pour que le scanner les génère — ne pas les construire dynamiquement.

export const EMOTIONS = {
  joie: {
    label: "Joie (Prisme)",
    color: "#C6AF53",
    bg: "bg-[#C6AF53]/15",
    border: "border-[#C6AF53]/40",
  },
  tristesse: {
    label: "Tristesse (Prisme)",
    color: "#6B93C7",
    bg: "bg-[#6B93C7]/15",
    border: "border-[#6B93C7]/40",
  },
  colere: {
    label: "Colère (Prisme)",
    color: "#C56459",
    bg: "bg-[#C56459]/15",
    border: "border-[#C56459]/40",
  },
  peur: {
    label: "Peur (Prisme)",
    color: "#7765BD",
    bg: "bg-[#7765BD]/15",
    border: "border-[#7765BD]/40",
  },
  degout: {
    label: "Dégoût (Prisme)",
    color: "#8CB450",
    bg: "bg-[#8CB450]/15",
    border: "border-[#8CB450]/40",
  },
  surprise: {
    label: "Surprise (Prisme)",
    color: "#C5875E",
    bg: "bg-[#C5875E]/15",
    border: "border-[#C5875E]/40",
  },
  confiance: {
    label: "Confiance (Prisme)",
    color: "#56B89B",
    bg: "bg-[#56B89B]/15",
    border: "border-[#56B89B]/40",
  },
  anticipation: {
    label: "Anticipation (Prisme)",
    color: "#CDAA7E",
    bg: "bg-[#CDAA7E]/15",
    border: "border-[#CDAA7E]/40",
  },
  honte: {
    label: "Honte (Prisme)",
    color: "#A59A8D",
    bg: "bg-[#A59A8D]/15",
    border: "border-[#A59A8D]/40",
  },
  melancolie: {
    label: "Mélancolie (Prisme)",
    color: "#669DC2",
    bg: "bg-[#669DC2]/15",
    border: "border-[#669DC2]/40",
  },
  envie: {
    label: "Envie (Prisme)",
    color: "#73BB68",
    bg: "bg-[#73BB68]/15",
    border: "border-[#73BB68]/40",
  },
  soulagement: {
    label: "Soulagement (Prisme)",
    color: "#82C9BE",
    bg: "bg-[#82C9BE]/15",
    border: "border-[#82C9BE]/40",
  },
  gratitude: {
    label: "Gratitude (Prisme)",
    color: "#CEC57E",
    bg: "bg-[#CEC57E]/15",
    border: "border-[#CEC57E]/40",
  },
  jalousie: {
    label: "Jalousie (Prisme)",
    color: "#B6C266",
    bg: "bg-[#B6C266]/15",
    border: "border-[#B6C266]/40",
  },
  amour: {
    label: "Amour (Prisme)",
    color: "#C66C81",
    bg: "bg-[#C66C81]/15",
    border: "border-[#C66C81]/40",
  },
  culpabilite: {
    label: "Culpabilité (Prisme)",
    color: "#B189C8",
    bg: "bg-[#B189C8]/15",
    border: "border-[#B189C8]/40",
  },
} as const;

export const SPHERES = {
  familiale: {
    label: "Familiale",
    color: "#BF9A4F",
    bg: "bg-[#BF9A4F]/15",
    border: "border-[#BF9A4F]/40",
  },
  sociale: {
    label: "Sociale",
    color: "#855DC0",
    bg: "bg-[#855DC0]/15",
    border: "border-[#855DC0]/40",
  },
  amoureuse: {
    label: "Amoureuse",
    color: "#CC75A1",
    bg: "bg-[#CC75A1]/15",
    border: "border-[#CC75A1]/40",
  },
  professionnelle: {
    label: "Professionnelle",
    color: "#909DAD",
    bg: "bg-[#909DAD]/15",
    border: "border-[#909DAD]/40",
  },
} as const;

export type EmotionKey = keyof typeof EMOTIONS;
export type SphereKey = keyof typeof SPHERES;

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
  /** Le reflet de clôture de la conversation (dernier message du Collègue). */
  miroir?: string;
  image_url?: string;
}