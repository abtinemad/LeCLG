import { useState, useMemo } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { GalaxyCanvas } from "../components/carnet/GalaxyCanvas";
import { CONSTELLATION_DEFAULTS } from "../lib/personalConstellation";
import { readSeedCards, densifyFromSeed } from "../lib/galaxySimData";

const DEV_TOKEN = "galaxie";
const WEEKS_PER_MONTH = 30.44 / 7;

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

// Simulateur de réglage de la Galaxie — outil DEV, route non listée, ?dev=galaxie.
// Curseurs : usage (mois × fréquence → N, étalement) · géométrie (σ, τ) ·
// lumière (éclat/flou des points, densité additive). Lecture seule des cartes.
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
  const [pointAlphaPct, setPointAlphaPct] = useState(100);
  const [pointGlow, setPointGlow] = useState(5);
  const [edgeBlur, setEdgeBlur] = useState(3);
  const [concavityPct, setConcavityPct] = useState(60); // /100 → concavité
  const [coreScale, setCoreScale] = useState(22);
  const [rotationS, setRotationS] = useState(120);
  const [spiralPct, setSpiralPct] = useState(100); // /100 → tours de spirale
  const [replayKey, setReplayKey] = useState(0);
  const [armThreadPct, setArmThreadPct] = useState(100);
  const [tiltDeg, setTiltDeg] = useState(55);
  const [twistPct, setTwistPct] = useState(50); // /100 → tours de torsion
  const [trailDeg, setTrailDeg] = useState(0); // recul angulaire (°) de la traînée des astéroïdes
  const [goldForced, setGoldForced] = useState(false);
  const [divPct, setDivPct] = useState(100); // diversité simulée → module la torsion

  const count = Math.max(1, Math.round(months * WEEKS_PER_MONTH * freqPerWeek));
  const spanYears = months / 12;

  const cards = useMemo(
    () => densifyFromSeed(seed, { count, spanYears }),
    [seed, count, spanYears],
  );
  const opts = useMemo(
    () => ({ armSigmaRad: (sigmaDeg * Math.PI) / 180, tauDays, radianceConcavity: 1 - 0.7 * (concavityPct / 100) }),
    [sigmaDeg, tauDays, concavityPct],
  );
  const render = useMemo(
    () => ({
      pointAlpha: pointAlphaPct / 100,
      pointGlow,
      edgeBlur,
      coreScale,
      rotationPeriodS: rotationS,
      spiralTurns: spiralPct / 100,
      armThread: armThreadPct / 100,
      tiltDeg,
      twistTurns: twistPct / 100,
      trailTurns: trailDeg / 360,
      goldOverride: goldForced,
      diversityOverride: divPct / 100,
    }),
    [pointAlphaPct, pointGlow, edgeBlur, coreScale, rotationS, spiralPct, armThreadPct, tiltDeg, twistPct, trailDeg, goldForced, divPct],
  );

  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[#070707] text-beige p-4 pt-16">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-matrice/80 mb-3">
        Galaxie — simulateur de réglage (dev)
      </div>
      <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
        <div className="sticky top-16 z-10 -mx-4 px-4 pb-2 bg-[#070707] lg:flex-1 lg:top-16 lg:mx-0 lg:px-0 lg:pb-0 lg:bg-transparent">
          <div key={replayKey} className="relative w-full max-w-[42vh] lg:max-w-md aspect-square mx-auto">
            <GalaxyCanvas cards={cards} opts={opts} render={render} />
          </div>
        </div>
        <div className="lg:flex-1 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[11px]">
        <Slider label={`Mois de pratique : ${months}`} min={1} max={24} value={months} onChange={setMonths} />
        <Slider label={`Fréquence : ${freqPerWeek} carte(s)/semaine`} min={1} max={7} value={freqPerWeek} onChange={setFreqPerWeek} />
        <Slider label={`σ bras : ${sigmaDeg}°`} min={0} max={90} value={sigmaDeg} onChange={setSigmaDeg} />
        <Slider label={`τ récent : ${tauDays} j`} min={10} max={365} value={tauDays} onChange={setTauDays} />
        <Slider label={`Éclat point : ${pointAlphaPct}%`} min={20} max={300} value={pointAlphaPct} onChange={setPointAlphaPct} />
        <Slider label={`Flou point : ${pointGlow} px`} min={1} max={20} value={pointGlow} onChange={setPointGlow} />
        <Slider label={`Flou bord : ${edgeBlur}×`} min={0} max={8} value={edgeBlur} onChange={setEdgeBlur} />
        <Slider label={`Récompense précoce : ${concavityPct}%`} min={0} max={100} value={concavityPct} onChange={setConcavityPct} />
        <Slider label={`Rayonnement max : ${coreScale} px`} min={5} max={50} value={coreScale} onChange={setCoreScale} />
        <Slider label={`Rotation : ${rotationS === 0 ? "figé" : `${rotationS}s/tour`}`} min={0} max={240} value={rotationS} onChange={setRotationS} />
        <Slider label={`Spirale naissance : ${spiralPct}%`} min={0} max={300} value={spiralPct} onChange={setSpiralPct} />
        <Slider label={`Fils sphères : ${armThreadPct}%`} min={0} max={100} value={armThreadPct} onChange={setArmThreadPct} />
        <Slider label={`Inclinaison : ${tiltDeg}°`} min={0} max={75} value={tiltDeg} onChange={setTiltDeg} />
        <Slider label={`Torsion bras : ${twistPct}%`} min={0} max={300} value={twistPct} onChange={setTwistPct} />
        <Slider label={`Traînée : ${trailDeg}°`} min={0} max={30} value={trailDeg} onChange={setTrailDeg} />
        <Slider label={`Diversité simulée : ${divPct}%`} min={0} max={100} value={divPct} onChange={setDivPct} />
        <button
          onClick={() => setGoldForced((v) => !v)}
          className={`mt-1 py-2 px-4 self-start border rounded-md text-[10px] uppercase tracking-[0.2em] transition-colors ${
            goldForced
              ? "bg-amber-400/20 border-amber-300/50 text-amber-200"
              : "bg-white/5 border-white/15 text-beige-faint/60"
          }`}
        >
          Or (16 prismes) : {goldForced ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          className="mt-1 py-2 px-4 self-start bg-matrice/10 hover:bg-matrice/20 border border-matrice/30 text-matrice/90 rounded-md text-[10px] uppercase tracking-[0.2em] transition-colors"
        >
          Rejouer la naissance
        </button>
        <div className="col-span-2 text-[9px] text-beige-faint/40 italic mt-2">
          ≈ {count} cartes sur {months} mois ({spanYears.toFixed(2)} an). σ/τ = géométrie ; éclat/flou = lumière (densité additive).{" "}
          {seed.length > 0
            ? `Teintes amorcées sur tes ${seed.length} cartes réelles (lecture seule).`
            : "Aucune carte réelle → teintes synthétiques."}
        </div>
      </div>
      </div>
    </div>
  );
}
