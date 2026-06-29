import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useGoBack } from "../lib/useGoBack";
import { useCarnetIdentity } from "../lib/useCarnetIdentity";
import { useCarnetAnalyses } from "../lib/useCarnetAnalyses";
import { useEclat } from "../lib/useEclat";
import { useCarnetUnlocks } from "../lib/useCarnetUnlocks";
import { useCollegueVoice } from "../lib/useCollegueVoice";
import { useCarnetSync } from "../lib/useCarnetSync";
import { useCarnetData } from "../lib/useCarnetData";
import { personalSignature } from "../lib/personalSignature";
import {
  AnalysisError,
  LienSphereDeck,
  LockedSection,
  LockedBlock,
} from "../components/carnet/CarnetPrimitives";
import { AffectView } from "../components/carnet/AffectView";
import { ElanView } from "../components/carnet/ElanView";
import { ResumeModal } from "../components/carnet/ResumeModal";
import { LueurReaderModal } from "../components/carnet/LueurReaderModal";
import { EclatModal } from "../components/carnet/EclatModal";
import { LueursEclatsModal } from "../components/carnet/LueursEclatsModal";
import { PrismesModal } from "../components/carnet/PrismesModal";
import { MatriceView } from "../components/carnet/MatriceView";
import { LienView } from "../components/carnet/LienView";
import { FragmentsView } from "../components/carnet/FragmentsView";
import { CarnetShell } from "../components/carnet/CarnetShell";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  History,
  Heart,
  Waves,
  Orbit,
  Trees,
  Fingerprint,
  Users,
  Copy,
  Check,
  BookOpen,
  Cloud,
  Zap,
  Download,
  Network,
  Sparkles,
  Star,
  X,
  Feather,
  Activity,
  MessagesSquare,
  Smartphone,
  RotateCw,
  LogOut,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { ClarteSection, PrismeExplainer } from "../components/SerpentinGuide";
import PrismeIcon from "../components/PrismeIcon";
import CollegueMark from "../components/CollegueMark";
import { PaymentWrapper } from "../components/PaymentModal";
import { LueurVisual } from "../components/LueurVisual";
import { RetourModal } from "../components/RetourModal";
import { EMOTIONS, SPHERES as SPHERE_PALETTE, type ReflectionCard } from "../data/emotions";
import { PRISME_DESCRIPTIONS } from "../data/prismes";
import { getEmotionTheme, prismeKey } from "../lib/carnet-helpers";

// Réexport conservé pour compatibilité d'éventuels imports externes.
export { EMOTIONS } from "../data/emotions";


export default function Carnet() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useGoBack();
  const {
    personalId,
    showKey,
    setShowKey,
    keyCopied,
    copyKey,
    showQr,
    setShowQr,
    confirmLogout,
    setConfirmLogout,
    handleLogout,
  } = useCarnetIdentity();
  const {
    cards,
    loading,
    currentPlan,
    sessionsData,
    lueurs,
    setLueurs,
    sphereSonges,
    carnatCreatedAt,
    persistMiroir,
    updateCardNote,
    updateSphereSonge,
    load,
  } = useCarnetData(personalId);
  const [view, setView] = useState<
    "fragments" | "lien" | "affect" | "elan" | "matrice"
  >("fragments");
  // Index de la carte affichée par semaine (feuilletage des piles).
  const [weekFlip, setWeekFlip] = useState<Record<string, number>>({});
  // Lentille : teinte émotionnelle active filtrant le flux Fragments (clé
  // EMOTIONS, null = aucun filtre). Axe orthogonal au temps. DISTINCT de
  // `selectedPrisme` (qui, lui, monte la modale-explainer).
  const [lensFilter, setLensFilter] = useState<string | null>(null);
  // Fragment dont la fenêtre « reprendre la réflexion » est ouverte (null = fermée).
  const [resumeConfirm, setResumeConfirm] = useState<ReflectionCard | null>(null);
  // Reprend un fragment : on le mémorise (localStorage survit au reload/re-render,
  // contrairement à location.state) puis on ouvre le chat dessus.
  const resumeFragment = (card: ReflectionCard) => {
    try {
      localStorage.setItem("collegue_resume_fragment", JSON.stringify(card));
    } catch (err) {
      console.warn("resume fragment store failed", err);
    }
    navigate("/chat", { state: { resumeFragment: card } });
  };
  // Voix du Collègue (texte courant, cache de session, trace « déjà lu »).
  const { collegueVoice, setCollegueVoice, voiceRead, openVoice } =
    useCollegueVoice(persistMiroir);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isPrismesModalOpen, setIsPrismesModalOpen] = useState(false);
  const [isLueursModalOpen, setIsLueursModalOpen] = useState(false);

  const [selectedPrisme, setSelectedPrisme] = useState<string | null>(null);


  const exportMatriceToPDF = () => {
    window.print();
  };

  const [readingLueur, setReadingLueur] = useState<any | null>(null);

  // Retour : ouverture de la modale partagée (état interne géré par le
  // composant RetourModal).
  const [isRetourModalOpen, setIsRetourModalOpen] = useState(false);

  const {
    networkData,
    lienData,
    affectData,
    elanDataAnalysis,
    matriceDataAnalysis,
    enrichFragments,
    enrichLien,
    enrichAffect,
    enrichElan,
    enrichMatrice,
    analysisErrors,
    retryAnalysis,
    hydrateAnalyses,
  } = useCarnetAnalyses({
    cards,
    sphereSonges,
    sessionsData,
    view,
    setLueurs,
  });

  const {
    eclatList,
    setEclatList,
    isEclatModalOpen,
    setIsEclatModalOpen,
    readingEclat,
    setReadingEclat,
    replyDraft,
    setReplyDraft,
    replySending,
    replyError,
    eclatRequest,
    setEclatRequest,
    eclatStatus,
    setEclatStatus,
    sendEclatRequest,
    handleEclatSubmit,
    sendReply,
  } = useEclat({
    personalId,
    matriceDataAnalysis,
    elanDataAnalysis,
    affectData,
    lienData,
  });

  const { prismesCount, unlockedSections, unlockedBlocks, isNextLocked } =
    useCarnetUnlocks({ cards, sessionsData, enrichFragments });

  useCarnetSync({
    personalId,
    cards,
    lienData,
    affectData,
    elanDataAnalysis,
    matriceDataAnalysis,
    lueurs,
    sphereSonges,
    carnatCreatedAt,
  });




  const copyToClipboard = (text: string, section: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };




  useEffect(() => {
    load({ hydrateAnalyses, setEclatList });
  }, []);






  // Lien (Analysis)







  return (
    <div className="min-h-screen bg-bg text-beige-dim font-serif pt-[48px]" style={{ paddingTop: "calc(48px + env(safe-area-inset-top))" }}>
      <div className="max-w-4xl mx-auto pt-5 pb-12 px-6">
        <CarnetShell
          goBack={goBack}
          currentPlan={currentPlan}
          currentPath={location.pathname}
          showKey={showKey}
          setShowKey={setShowKey}
          personalId={personalId}
          copyKey={copyKey}
          keyCopied={keyCopied}
          showQr={showQr}
          setShowQr={setShowQr}
          confirmLogout={confirmLogout}
          setConfirmLogout={setConfirmLogout}
          handleLogout={handleLogout}
          view={view}
          setView={setView}
          prismesCount={prismesCount}
          setIsPrismesModalOpen={setIsPrismesModalOpen}
          lueurs={lueurs}
          setIsLueursModalOpen={setIsLueursModalOpen}
          setIsRetourModalOpen={setIsRetourModalOpen}
        />

        <ClarteSection section={`carnet-${view}`} voix={collegueVoice} onVoixClose={() => setCollegueVoice(null)} />

        {view === "fragments" ? (
          <FragmentsView
            loading={loading}
            cards={cards}
            sessionsData={sessionsData}
            affectData={affectData}
            enrichFragments={enrichFragments}
            unlockedBlocks={unlockedBlocks}
            isNextLocked={isNextLocked}
            weekFlip={weekFlip}
            setWeekFlip={setWeekFlip}
            lensFilter={lensFilter}
            setLensFilter={setLensFilter}
            voiceRead={voiceRead}
            openVoice={openVoice}
            copyToClipboard={copyToClipboard}
            copiedSection={copiedSection}
            setSelectedPrisme={setSelectedPrisme}
            prismeKey={prismeKey}
            updateCardNote={updateCardNote}
            setResumeConfirm={setResumeConfirm}
          />
        ) : view === "lien" ? (
          <LienView
            lienData={lienData}
            networkData={networkData}
            cards={cards}
            sphereSonges={sphereSonges}
            updateSphereSonge={updateSphereSonge}
            unlockedBlocks={unlockedBlocks}
            unlockedSections={unlockedSections}
            isNextLocked={isNextLocked}
            prismeKey={prismeKey}
            enrichLien={enrichLien}
            retryAnalysis={retryAnalysis}
            analysisErrors={analysisErrors}
            getEmotionTheme={getEmotionTheme}
          />
        ) : view === "affect" ? (
          <AffectView
            affectData={affectData}
            enrichAffect={enrichAffect}
            analysisErrors={analysisErrors}
            unlockedBlocks={unlockedBlocks}
            unlockedSections={unlockedSections}
            cards={cards}
            isNextLocked={isNextLocked}
            retryAnalysis={retryAnalysis}
            prismeKey={prismeKey}
          />
        ) : view === "elan" ? (
          <ElanView
            elanDataAnalysis={elanDataAnalysis}
            enrichElan={enrichElan}
            analysisErrors={analysisErrors}
            unlockedBlocks={unlockedBlocks}
            unlockedSections={unlockedSections}
            cards={cards}
            isNextLocked={isNextLocked}
            retryAnalysis={retryAnalysis}
          />
        ) : (
          <MatriceView
            matriceDataAnalysis={matriceDataAnalysis}
            cards={cards}
            lueurs={lueurs}
            unlockedBlocks={unlockedBlocks}
            unlockedSections={unlockedSections}
            isNextLocked={isNextLocked}
            enrichMatrice={enrichMatrice}
            analysisErrors={analysisErrors}
            retryAnalysis={retryAnalysis}
            setIsEclatModalOpen={setIsEclatModalOpen}
            exportMatriceToPDF={exportMatriceToPDF}
          />
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        <PrismesModal
          isPrismesModalOpen={isPrismesModalOpen}
          setIsPrismesModalOpen={setIsPrismesModalOpen}
          prismesCount={prismesCount}
          cards={cards}
          selectedPrisme={selectedPrisme}
          setSelectedPrisme={setSelectedPrisme}
          prismeKey={prismeKey}
        />

        {selectedPrisme && (
          <PrismeExplainer
            isOpen={!!selectedPrisme}
            onClose={() => setSelectedPrisme(null)}
            title={
              EMOTIONS[selectedPrisme as keyof typeof EMOTIONS].label.split(
                " ",
              )[0]
            }
            content={PRISME_DESCRIPTIONS[selectedPrisme]}
            color={EMOTIONS[selectedPrisme as keyof typeof EMOTIONS].color}
            intensity={personalSignature(cards).intensity}
          />
        )}

        <LueursEclatsModal
          isLueursModalOpen={isLueursModalOpen}
          setIsLueursModalOpen={setIsLueursModalOpen}
          lueurs={lueurs}
          eclatList={eclatList}
          setReadingLueur={setReadingLueur}
          setReadingEclat={setReadingEclat}
          setIsEclatModalOpen={setIsEclatModalOpen}
        />

        <EclatModal
          isEclatModalOpen={isEclatModalOpen}
          setIsEclatModalOpen={setIsEclatModalOpen}
          eclatRequest={eclatRequest}
          setEclatRequest={setEclatRequest}
          eclatStatus={eclatStatus}
          setEclatStatus={setEclatStatus}
          handleEclatSubmit={handleEclatSubmit}
        />

        {/* Lecture d'un Éclat — le retour humain s'affiche en entier, dans
            le Carnet de la personne. Pas de fichier : la réponse vit ici. */}
        {readingEclat && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReadingEclat(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#0a0a0a] border border-evolution/20 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-red/50" />
              <button
                onClick={() => setReadingEclat(null)}
                className="absolute top-4 right-4 p-1 hover:bg-white/5 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5 text-beige-faint/40" />
              </button>
              <div className="px-10 pt-10 pb-5 flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-evolution/50">
                    <CollegueMark className="w-7 h-7 text-red/70" />
                    <span>L'Éclat</span>
                  </div>
                  {readingEclat.answered_at && (
                    <span className="font-mono text-[9px] tracking-wider text-beige/30">
                      {new Date(readingEclat.answered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-10 pb-10 overflow-y-auto custom-scrollbar">
                {readingEclat.request_text && (
                  <div className="mb-6 pb-6 border-b border-white/5">
                    <div className="font-mono text-[7px] uppercase tracking-[0.25em] text-beige/25 mb-2">
                      Votre demande
                    </div>
                    <p className="text-[12px] font-serif italic text-beige/45 leading-relaxed whitespace-pre-wrap">
                      "{readingEclat.request_text}"
                    </p>
                  </div>
                )}
                <p className="text-[15px] font-serif italic text-beige/85 leading-loose whitespace-pre-wrap">
                  {readingEclat.response_text}
                </p>

                {/* Réponses de la personne — elle peut répondre tant que
                    l'admin n'a pas clôturé. Ce n'est pas un fil symétrique :
                    le collègue lit, et clôture quand il le décide. */}
                {(((readingEclat.replies && readingEclat.replies.length > 0)) ||
                  !readingEclat.replies_closed) && (
                  <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                    {readingEclat.replies && readingEclat.replies.length > 0 && (
                      <div className="space-y-3">
                        {readingEclat.replies.map((r: any, i: number) => (
                          <div
                            key={i}
                            className="p-4 rounded-lg bg-white/[0.03] border border-white/5"
                          >
                            <div className="font-mono text-[7px] uppercase tracking-[0.25em] text-beige/25 mb-2">
                              Votre réponse
                              {r.at
                                ? " · " +
                                  new Date(r.at).toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "short",
                                  })
                                : ""}
                            </div>
                            <p className="text-[13px] font-serif text-beige/70 leading-relaxed whitespace-pre-wrap">
                              {r.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {readingEclat.replies_closed ? (
                      <div className="text-center font-mono text-[7px] uppercase tracking-[0.3em] text-beige/20 italic py-2">
                        Échange clôturé
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Répondre à cet Éclat…"
                          rows={4}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-beige italic focus:border-evolution/30 outline-none transition-colors resize-none custom-scrollbar"
                        />
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-mono text-[8px] text-beige/25 italic leading-relaxed">
                            {replyError ? (
                              <span className="text-soutien">
                                Échec de l'envoi — réessayer.
                              </span>
                            ) : (
                              "Votre réponse sera lue par le collègue."
                            )}
                          </span>
                          <button
                            onClick={sendReply}
                            disabled={!replyDraft.trim() || replySending}
                            className="flex-shrink-0 px-5 py-2 bg-evolution/90 text-black font-mono text-[8px] uppercase tracking-[0.2em] rounded-full hover:bg-evolution transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                          >
                            {replySending ? "Envoi…" : "Envoyer"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
        <LueurReaderModal
          readingLueur={readingLueur}
          setReadingLueur={setReadingLueur}
        />
        <ResumeModal
          resumeConfirm={resumeConfirm}
          setResumeConfirm={setResumeConfirm}
          resumeFragment={resumeFragment}
        />

      </AnimatePresence>

      <RetourModal
        open={isRetourModalOpen}
        onClose={() => setIsRetourModalOpen(false)}
        personalId={personalId}
      />
    </div>
  );
}