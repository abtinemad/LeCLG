import { useMemo } from 'react';
import { motion } from 'motion/react';
import { generateLueurVisualParams, LueurDataInput } from '../lib/LueurGenerator';

export function LueurVisual({ context }: { context?: LueurDataInput }) {
  const params = useMemo(() => {
    return generateLueurVisualParams(context || {});
  }, [context]);

  const renderBackgroundFilter = () => {
    if (params.bgPattern === 'noise') {
      return (
        <filter id="lueur-bg-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 0.08 0" />
        </filter>
      );
    } else if (params.bgPattern === 'fluid') {
      return (
        <filter id="lueur-bg-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="1" result="noise" />
          <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 0.1 0" in="noise" />
        </filter>
      );
    } else if (params.bgPattern === 'geometric') {
      return (
        <pattern id="lueur-bg-filter" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M 4 0 L 0 4" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5"/>
        </pattern>
      );
    }
    return null;
  };

  const getGradient = () => {
    switch (params.lightOrigin) {
      case 'center-out':
        return <radialGradient id="lueur-light" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(255,255,255,0.15)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient>;
      case 'edges-in':
        return <radialGradient id="lueur-light" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(255,255,255,0)"/><stop offset="100%" stopColor="rgba(255,255,255,0.15)"/></radialGradient>;
      case 'top-down':
        return <linearGradient id="lueur-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(255,255,255,0.15)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></linearGradient>;
      default:
        return <radialGradient id="lueur-light" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(255,255,255,0.1)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient>;
    }
  };

  return (
    <div className="relative w-full aspect-square md:aspect-video rounded-sm overflow-hidden bg-[#12110e] border border-[#2a2820] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] mb-8">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0">
        <defs>
           {renderBackgroundFilter()}
           {getGradient()}
           <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
               <feGaussianBlur stdDeviation="1.5" result="blur" />
               <feComposite in="SourceGraphic" in2="blur" operator="over" />
           </filter>
        </defs>

        {params.bgPattern === 'geometric' ? (
          <rect width="100%" height="100%" fill="url(#lueur-bg-filter)" />
        ) : params.bgPattern !== 'minimal' ? (
          <rect width="100%" height="100%" style={{ filter: 'url(#lueur-bg-filter)' }} />
        ) : null}
        
        <rect width="100%" height="100%" fill="url(#lueur-light)" />

        {/* Edges */}
        <g opacity={Math.max(0.3, params.densityScore)}>
          {params.edges.map((e, idx) => {
            const source = params.nodes.find(n => n.id === e.source);
            const target = params.nodes.find(n => n.id === e.target);
            if (!source || !target) return null;
            return (
              <motion.line
                key={`edge-${idx}`}
                x1={source.x} y1={source.y}
                x2={target.x} y2={target.y}
                stroke="#fff"
                strokeWidth={0.15}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: e.opacity }}
                transition={{ duration: 3, delay: idx * 0.02, ease: "easeInOut" }}
              />
            );
          })}
        </g>

        {/* Nodes */}
        {params.nodes.map((n, idx) => (
          <motion.g key={`node-${idx}`} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, delay: 1 + idx * 0.02, ease: "easeOut" }}>
             <circle cx={n.x} cy={n.y} r={n.size * (params.densityScore * 0.5 + 0.5)} fill={n.color} filter="url(#glow)" />
             <text x={n.x + n.size + 1} y={n.y + 0.5} fontSize={2} fill="rgba(255,255,255,0.4)" fontFamily="monospace" style={{ pointerEvents: 'none', mixBlendMode: 'plus-lighter' }}>
                {n.word}
             </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
