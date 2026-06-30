import { useState, useMemo } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { GalaxyCanvas } from "../components/carnet/GalaxyCanvas";
import { CONSTELLATION_DEFAULTS } from "../lib/personalConstellation";
import { readSeedCards, densifyFromSeed } from "../lib/galaxySimData";

const DEV_TOKEN = "galaxie";
const WEEKS_PER_MONTH = 30.44 / 7; // ≈ 4.35

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
// ?dev=galaxie. On raisonne en USAGE RÉEL : « mois de pratique » × « fréquence »
// (cartes/semaine) dérivent N et l'étalement, pour juger σ/τ sur ce que les vrais
// usagers verront — du déverrouillage à la maturité — pas sur des N arbitraires.
// Hooks tous appelés avant le gate. Lecture seule des cartes du visiteur.
export default function GalaxySim() {
  const [params] = useSearchParams();
  const allowed = params.get("dev") === DEV_TOKEN;

  const seed = useMemo(() => readSeedCards(), []);
  const [months, setMonths] = useState(3);
  const [freqPerWeek, setFreqPerWeek] = useState(3);
  const [sigmaDeg, setSigmaDeg] = useState(
    Math.round((CONSTELLATION_DEFAULTS.armSigmaRad * 180) / Math.PI),
  );
  const [tauDays, setTauDays] = useState<number>(CONSTELLATION_DEFAULTS.tauDays);

  // Régime d'usage → corpus. N = mois × (semaines/mois) × cartes/semaine.
  const count = Math.max(1, Math.round(months * WEEKS_PER_MONTH * freqPerWeek));
  const spanYears = months / 12;

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
        <Slider label={`Mois de pratique : ${months}`} min={1} max={24} value={months} onChange={setMonths} />
        <Slider label={`Fréquence : ${freqPerWeek} carte(s)/semaine`} min={1} max={7} value={freqPerWeek} onChange={setFreqPerWeek} />
        <Slider label={`σ bras : ${sigmaDeg}°`} min={0} max={90} value={sigmaDeg} onChange={setSigmaDeg} />
        <Slider label={`τ récent : ${tauDays} j`} min={10} max={365} value={tauDays} onChange={setTauDays} />
        <div className="text-[9px] text-beige-faint/40 italic mt-2">
          ≈ {count} cartes sur {months} mois ({spanYears.toFixed(2)} an). σ/τ = le réglage ; mois/fréquence = le régime d'usage reconstitué.{" "}
          {seed.length > 0
            ? `Teintes amorcées sur tes ${seed.length} cartes réelles (lecture seule).`
            : "Aucune carte réelle → teintes synthétiques."}
        </div>
      </div>
    </div>
  );
}
