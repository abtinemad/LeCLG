export interface LueurDataInput {
  songes?: Record<string, string>;
  fragments?: any[];
  prismes?: string[];
  elan?: any;
  affect?: any;
  matrice?: any;
}

export interface LueurNode {
  id: string;
  word: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface LueurEdge {
  source: string;
  target: string;
  opacity: number;
}

export interface LueurVisualParams {
  nodes: LueurNode[];
  edges: LueurEdge[];
  lightOrigin: 'center-out' | 'edges-in' | 'top-down' | 'center';
  densityScore: number; 
  bgPattern: 'noise' | 'geometric' | 'fluid' | 'minimal';
}

function extractWords(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^a-záàâäéèêëíìîïóòôöúùûüç]/gi, ' ');
  return cleaned.split(/\s+/).filter(w => w.length > 3);
}

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
  }
  return hash;
}

export function generateLueurVisualParams(context: LueurDataInput): LueurVisualParams {
  // 1. Songes -> Nodes
  const wordsMap = new Map<string, number>();
  
  if (context.songes) {
    Object.values(context.songes).forEach((s: any) => {
      if (typeof s === 'string') {
        const words = extractWords(s);
        words.forEach(w => {
          wordsMap.set(w, (wordsMap.get(w) || 0) + 1);
        });
      }
    });
  }

  if (context.fragments) {
      context.fragments.forEach((f: any) => {
         const words = extractWords(f.fragment || '');
         words.forEach(w => {
             wordsMap.set(w, (wordsMap.get(w) || 0) + 1);
         });
      });
  }

  if (wordsMap.size === 0) {
      wordsMap.set("présence", 1);
      wordsMap.set("temps", 1);
      wordsMap.set("espace", 1);
      wordsMap.set("vide", 1);
  }
  
  const sortedWords = Array.from(wordsMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 50);

  // 2. Prismes -> Colours
  const baseColors: Record<string, string> = {
    "Joie": "#EA580C",
    "Tristesse": "#60A5FA",
    "Colère": "#EF4444",
    "Peur": "#8B5CF6",
    "Confiance": "#10B981",
    "Dégoût": "#65A30D",
    "Anticipation": "#F97316",
    "Surprise": "#2DD4BF",
    "Honte": "#7C3AED",
    "Mélancolie": "#94A3B8"
  };

  const activePrisms = context.prismes || [];
  const activeColors = activePrisms.map((p: string) => baseColors[p]).filter(Boolean);
  const defaultColor = 'rgba(255,255,255,0.05)';

  const nodes = sortedWords.map((entry, i) => {
      const word = entry[0];
      const freq = entry[1];
      const hash = hashCode(word);
      
      const x = 10 + Math.abs(hash % 80);
      const y = 10 + Math.abs((hash >> 4) % 80);
      
      let color = defaultColor;
      if (activeColors.length > 0) {
           color = activeColors[Math.abs(hash) % activeColors.length];
      }

      return {
          id: word,
          word,
          x,
          y,
          size: 1.5 + Math.min(freq, 8),
          color
      };
  });

  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < 30) { 
              edges.push({
                  source: nodes[i].id,
                  target: nodes[j].id,
                  opacity: 0.8 * (1 - (dist / 30))
              });
          }
      }
  }

  // 3. Elan -> Direction
  let lightOrigin: 'center-out' | 'edges-in' | 'top-down' | 'center' = 'center';
  const elan = context.elan;
  if (elan) {
     const txt = JSON.stringify(elan).toLowerCase();
     if (txt.includes('extérieur') || txt.includes('ouverture')) lightOrigin = 'center-out';
     else if (txt.includes('soi') || txt.includes('intérieur')) lightOrigin = 'edges-in';
     else if (txt.includes('futur') || txt.includes('élan')) lightOrigin = 'top-down';
  }

  // 4. Affect -> Densité
  let densityScore = 0.5;
  if (context.affect) {
     const txt = JSON.stringify(context.affect).toLowerCase();
     if (txt.includes('intense') || txt.includes('saturation')) densityScore = 0.8;
     else if (txt.includes('vide') || txt.includes('apaisé')) densityScore = 0.2;
  }

  // 5. Matrice -> background
  let bgPattern: 'noise' | 'geometric' | 'fluid' | 'minimal' = 'minimal';
  if (context.matrice) {
     const mTxt = JSON.stringify(context.matrice).toLowerCase();
     if (mTxt.includes('angoisse') || mTxt.includes('obsession')) bgPattern = 'noise';
     else if (mTxt.includes('structure') || mTxt.includes('ordre')) bgPattern = 'geometric';
     else if (mTxt.includes('flux') || mTxt.includes('mouvement')) bgPattern = 'fluid';
  }

  return { nodes, edges, lightOrigin, densityScore, bgPattern };
}
