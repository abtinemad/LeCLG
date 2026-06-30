import { useState, useMemo } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { GalaxyCanvas } from "../components/carnet/GalaxyCanvas";
import { CONSTELLATION_DEFAULTS } from "../lib/personalConstellation";
import { readSeedCards, densifyFromSeed } from "../lib/galaxySimData";

const DEV_TOKEN = "galaxie";

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-beige-faint/70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-matrice"
      />
    </label>
  );
}

// Simulateur de réglage de la Galaxie — outil DEV, route non listée, gatée par
// ?dev=galaxie. Tous les hooks sont appelés AVANT le gate (règles des hooks) ;
// le early-return ne se fait qu'ensuite. Lecture seule des cartes du visiteur.
export default function GalaxySim() {
  const [params] = useSearchParams();
  const allowed = params.get("dev") === DEV_TOKEN;

  const seed = useMemo(() => readSeedCards(), []);
  const [count, setCount] = useState(120);
  const [spanYears, setSpanYears] = useState(3);
  const [sigmaDeg, setSigmaDeg] = useState(35);
  const [tauDays, setTauDays] = useState<number>(CONSTELLATION_DEFAULTS.tauDays);

  const cards = useMemo(
    () => densifyFromSeed(seed, { count, spanYears }),
    [seed, count, spanYears],
  );
  const opts = useMemo(
    () => ({ armSigmaRad: (sigmaDeg * Math.PI) / 180, tauDays }),
    [sigmaDeg, tauDays],
  );

  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[#070707] text-beige p-4 flex flex-col gap-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-matrice/80">
        Galaxie — simulateur de réglage (dev)
      </div>
      <div className="relative w-full aspect-square max-w-xl mx-auto">
        <GalaxyCanvas cards={cards} opts={opts} />
      </div>
      <div className="max-w-xl mx-auto w-full flex flex-col gap-3 font-mono text-[11px]">
        <Slider label={`N cartes : ${count}`} min={3} max={400} value={count} onChange={setCount} />
        <Slider label={`Étalement : ${spanYears} an(s)`} min={1} max={10} value={spanYears} onChange={setSpanYears} />
        <Slider label={`σ bras : ${sigmaDeg}°`} min={0} max={90} value={sigmaDeg} onChange={setSigmaDeg} />
        <Slider label={`τ récent : ${tauDays} j`} min={10} max={365} value={tauDays} onChange={setTauDays} />
        <div className="text-[9px] text-beige-faint/40 italic mt-2">
          {seed.length > 0
            ? `Teintes amorcées sur tes ${seed.length} cartes réelles (lecture seule). Structure : 4 bras peuplés pour juger σ/τ.`
            : "Aucune carte réelle trouvée → teintes synthétiques uniformes."}
        </div>
      </div>
    </div>
  );
}
