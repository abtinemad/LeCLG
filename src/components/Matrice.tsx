import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface Angoisse {
  label: string;
  intensity: number;
}

interface Defense {
  label: string;
  type: 'active' | 'passive';
  source: string;
  target: string;
  intensity: number;
}

interface MatriceData {
  angoisses: Angoisse[];
  valeurs: string[];
  aspirations: string[];
  defenses: Defense[];
  schema_central: string;
}

export default function Matrice({ data }: { data: MatriceData }) {
  if (!data) return null;

  // Simple deterministic random based on string seed
  const seededRandom = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const x = Math.sin(hash) * 10000;
    return x - Math.floor(x);
  };

  const nodes = useMemo(() => {
    return [
      ...data.valeurs.map((v) => ({ 
        label: v, 
        type: 'valeur' as const, 
        x: 150 + seededRandom(v + 'val') * 300, 
        y: 100 + seededRandom(v + 'y') * 300 
      })),
      ...data.aspirations.map((a) => ({ 
        label: a, 
        type: 'aspiration' as const, 
        x: 350 + seededRandom(a + 'asp') * 300, 
        y: 100 + seededRandom(a + 'y2') * 300 
      }))
    ];
  }, [data.valeurs, data.aspirations]);

  return (
    <div className="space-y-32 py-12">
      {/* 1. Les angoisses — cercles concentriques */}
      <section className="space-y-12">
        <div className="flex items-center gap-4 border-b border-white/5 pb-4">
          <div className="w-1 h-1 rounded-full bg-beige-faint" />
          <h3 className="font-mono text-[10px] tracking-widest uppercase text-beige-faint">Architecture du fond</h3>
        </div>
        
        <div className="relative h-[400px] w-full flex items-center justify-center bg-black overflow-hidden rounded-lg">
          <svg width="100%" height="100%" viewBox="0 0 400 400" className="max-w-[400px]">
            {data.angoisses.sort((a,b) => b.intensity - a.intensity).map((angoisse, i) => {
              const radius = 40 + (i * 35);
              const strokeWidth = angoisse.intensity * 8;
              return (
                <g key={i}>
                  <motion.circle
                    cx="200"
                    cy="200"
                    r={radius}
                    fill="none"
                    stroke={i % 2 === 0 ? "#dbcbb0" : "#6ba368"}
                    strokeWidth={strokeWidth}
                    strokeOpacity={0.1 + (angoisse.intensity * 0.4)}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 2, delay: i * 0.3 }}
                  />
                  <motion.text
                    x={200}
                    y={200 - radius - 5}
                    textAnchor="middle"
                    className="font-mono text-[8px] fill-beige-faint/60 uppercase tracking-widest"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 + i * 0.3 }}
                  >
                    {angoisse.label}
                  </motion.text>
                </g>
              );
            })}
          </svg>
          <div className="absolute inset-0 bg-radial-gradient(circle, transparent 40%, black 100%) pointer-events-none" />
        </div>
      </section>

      {/* 2. Les valeurs et aspirations — constellation */}
      <section className="space-y-12">
        <div className="flex items-center gap-4 border-b border-white/5 pb-4">
          <div className="w-1 h-1 rounded-full bg-green" />
          <h3 className="font-mono text-[10px] tracking-widest uppercase text-beige-faint">Constellation du sens</h3>
        </div>

        <div className="relative h-[500px] w-full bg-black overflow-hidden rounded-lg border border-white/5">
          <svg width="100%" height="100%" viewBox="0 0 800 500">
            {/* Background stars */}
            {[...Array(50)].map((_, i) => (
              <circle 
                key={`star-${i}`}
                cx={seededRandom(`star-x-${i}`) * 800}
                cy={seededRandom(`star-y-${i}`) * 500}
                r={seededRandom(`star-r-${i}`) * 0.5}
                fill="white"
                className="opacity-20 animate-pulse"
              />
            ))}

            <g>
              {/* Lines */}
              {nodes.map((node, i) => (
                nodes.slice(i + 1).map((other, j) => {
                  const dist = Math.sqrt(Math.pow(node.x - other.x, 2) + Math.pow(node.y - other.y, 2));
                  if (dist < 250) {
                    return (
                      <motion.line
                        key={`line-${i}-${j}`}
                        x1={node.x}
                        y1={node.y}
                        x2={other.x}
                        y2={other.y}
                        stroke="white"
                        strokeWidth={0.5}
                        strokeOpacity={0.05}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 3, delay: 0.5 }}
                      />
                    );
                  }
                  return null;
                })
              ))}

              {/* Nodes */}
              {nodes.map((node, i) => (
                <g key={`node-${i}`}>
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={node.type === 'valeur' ? 3 : 2}
                    fill={node.type === 'valeur' ? "#dbcbb0" : "#6ba368"}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.8 }}
                    transition={{ delay: i * 0.1 }}
                    className="filter blur-[1px]"
                  />
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r={node.type === 'valeur' ? 1 : 0.5}
                    fill="white"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                  />
                  <motion.text
                    x={node.x}
                    y={node.y + 15}
                    textAnchor="middle"
                    className="font-mono text-[7px] md:text-[8px] fill-beige-faint uppercase tracking-widest pointer-events-none"
                    style={{ textShadow: "0 0 10px rgba(0,0,0,0.8)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                  >
                    {node.label}
                  </motion.text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </section>

      {/* 3. Les mécanismes de défense — carte de flux */}
      <section className="space-y-12">
        <div className="flex items-center gap-4 border-b border-white/5 pb-4">
          <div className="w-1 h-1 rounded-full bg-beige-faint" />
          <h3 className="font-mono text-[10px] tracking-widest uppercase text-beige-faint">Dynamique des défenses</h3>
        </div>

        <div className="relative h-[450px] w-full bg-black overflow-hidden rounded-lg">
          <svg width="100%" height="100%" viewBox="0 0 800 450">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" opacity="0.3" />
              </marker>
            </defs>

            {data.defenses.map((def, i) => {
              const startX = 150 + (i % 2) * 400;
              const startY = 100 + i * 80;
              const endX = startX + 250;
              const endY = startY + (seededRandom(def.label + 'def-y') - 0.5) * 100;

              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2 + 50;

              const path = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
              const color = def.type === 'active' ? '#60a5fa' : '#f87171'; // Colder for active, warmer for passive (wait user said cold for active, warm for passive)

              return (
                <g key={i}>
                  <motion.path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={1 + def.intensity * 2}
                    strokeOpacity={0.2}
                    markerEnd="url(#arrowhead)"
                    className={color === '#60a5fa' ? 'text-blue-400' : 'text-red-400'}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: i * 0.4 }}
                  />
                  
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 + i * 0.4 }}
                  >
                    <text x={startX - 10} y={startY} textAnchor="end" className="font-mono text-[7px] fill-beige-faint/40 uppercase tracking-widest">{def.source}</text>
                    <text x={endX + 10} y={endY} textAnchor="start" className="font-mono text-[7px] fill-beige-faint/40 uppercase tracking-widest">{def.target}</text>
                    <text x={midX} y={midY + 15} textAnchor="middle" className="font-mono text-[9px] fill-beige uppercase tracking-[0.2em]" style={{ fill: color }}>{def.label}</text>
                  </motion.g>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Le schéma central */}
      <section className="pt-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 1.5 }}
          className="max-w-xl mx-auto"
        >
          <div className="w-12 h-[1px] bg-white/10 mx-auto mb-8" />
          <p className="text-xl md:text-2xl text-beige leading-relaxed italic antialiased font-serif">
            "{data.schema_central}"
          </p>
          <div className="w-12 h-[1px] bg-white/10 mx-auto mt-8" />
        </motion.div>
      </section>
    </div>
  );
}
