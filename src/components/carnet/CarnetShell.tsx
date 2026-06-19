import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Cloud,
  MessagesSquare,
  BookOpen,
  Fingerprint,
  Check,
  Copy,
  Smartphone,
  LogOut,
  History,
  Heart,
  Waves,
  Orbit,
  Sparkles,
} from "lucide-react";
import PrismeIcon from "../../components/PrismeIcon";

interface CarnetShellProps {
  goBack: () => void;
  currentPlan: string | null;
  currentPath: string;
  showKey: boolean;
  setShowKey: (value: boolean | ((prev: boolean) => boolean)) => void;
  personalId: string | null;
  copyKey: () => void;
  keyCopied: boolean;
  showQr: boolean;
  setShowQr: (value: boolean | ((prev: boolean) => boolean)) => void;
  confirmLogout: boolean;
  setConfirmLogout: (value: boolean) => void;
  handleLogout: () => void;
  view: "fragments" | "lien" | "affect" | "elan" | "matrice";
  setView: (view: "fragments" | "lien" | "affect" | "elan" | "matrice") => void;
  prismesCount: number;
  setIsPrismesModalOpen: (value: boolean) => void;
  lueurs: any[];
  setIsLueursModalOpen: (value: boolean) => void;
  setIsRetourModalOpen: (value: boolean) => void;
}

export function CarnetShell({
  goBack,
  currentPlan,
  currentPath,
  showKey,
  setShowKey,
  personalId,
  copyKey,
  keyCopied,
  showQr,
  setShowQr,
  confirmLogout,
  setConfirmLogout,
  handleLogout,
  view,
  setView,
  prismesCount,
  setIsPrismesModalOpen,
  lueurs,
  setIsLueursModalOpen,
  setIsRetourModalOpen,
}: CarnetShellProps) {
  return (
    <>
      <header className="fixed top-0 left-0 right-0 border-b border-border bg-bg/90 backdrop-blur-md z-[9999]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4 text-beige-faint" />
            </button>
            {currentPlan === "reconnaissance" && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green/10 border border-green/20">
                <div className="w-1 h-1 rounded-full bg-green animate-pulse" />
                <span className="font-mono text-[8px] uppercase tracking-widest text-green">
                  Mode Reconnaissance
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/climat"
              className={`transition-colors flex items-center p-1.5 ${currentPath === "/climat" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Climat de la communauté"
            >
              <Cloud size={13} strokeWidth={1.5} />
            </Link>
            <Link
              to="/chat"
              className={`transition-colors flex items-center p-1.5 ${currentPath === "/chat" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Penser"
            >
              <MessagesSquare size={13} strokeWidth={1.5} />
            </Link>
            <Link
              to="/carnet"
              className={`transition-colors flex items-center p-1.5 ${currentPath === "/carnet" ? "text-beige" : "text-beige-faint hover:text-beige"}`}
              title="Carnet"
            >
              <BookOpen size={13} strokeWidth={1.5} />
            </Link>
            <div className="relative">
              <button
                onClick={() => setShowKey((v) => !v)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-beige-faint hover:text-beige"
                title="Votre clé d'accès"
              >
                <Fingerprint size={13} strokeWidth={1.5} />
              </button>
              {showKey && (
                <div className="absolute right-0 top-full mt-2 w-[270px] bg-[#0e0d08] border border-border rounded-md p-4 shadow-lg shadow-black/40">
                  <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-beige-faint mb-2">
                    Votre Clé-LCLG
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-[12px] text-beige bg-[#161512] border border-border rounded px-2.5 py-1.5 select-all break-all">
                      {personalId || "—"}
                    </code>
                    <button
                      onClick={copyKey}
                      className="shrink-0 text-beige-faint hover:text-beige transition-colors p-1.5"
                      title="Copier"
                    >
                      {keyCopied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-beige-faint italic leading-relaxed mt-2.5">
                    Gardez-la : c'est elle qui vous permet de retrouver ce
                    carnet, ici ou sur un autre appareil.
                  </p>

                  {personalId && (
                    <>
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <button
                        onClick={() => setShowQr((v) => !v)}
                        className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-beige-faint hover:text-beige transition-colors"
                      >
                        <Smartphone size={12} strokeWidth={1.5} />
                        {showQr
                          ? "Masquer le QR"
                          : "Transférer vers un autre appareil"}
                      </button>
                      {showQr && (
                        <div className="mt-3 flex flex-col items-center">
                          <div className="bg-[#f3efe6] rounded-md p-3">
                            <QRCodeSVG
                              value={`${window.location.origin}/restore#k=${encodeURIComponent(personalId)}`}
                              size={168}
                              bgColor="#f3efe6"
                              fgColor="#1a1814"
                              level="M"
                            />
                          </div>
                          <p className="text-[10px] text-beige-faint italic leading-relaxed mt-2.5 text-center">
                            Scannez-le avec l'appareil photo de l'autre
                            téléphone, puis saisissez votre code. Ne le partagez
                            pas.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/60">
                      {!confirmLogout ? (
                        <button
                          onClick={() => setConfirmLogout(true)}
                          className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-beige-faint hover:text-red transition-colors"
                        >
                          <LogOut size={12} strokeWidth={1.5} />
                          Se déconnecter
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-red/80 italic leading-relaxed">
                            Sans votre phrase de clé, vous perdrez l'accès à ce carnet. Confirmer la déconnexion ?
                          </p>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={handleLogout}
                              className="font-mono text-[9px] uppercase tracking-[0.16em] text-red hover:text-heart transition-colors"
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmLogout(false)}
                              className="font-mono text-[9px] uppercase tracking-[0.16em] text-beige-faint hover:text-beige transition-colors"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mb-12 border-b border-border pb-12 print:hidden">
        <div className="flex flex-col items-center gap-y-4 md:gap-y-6 w-full max-w-2xl mx-auto mb-8">
          <div className="flex flex-row justify-center items-center gap-x-3 sm:gap-x-6 md:gap-x-12 w-full flex-nowrap">
            <button
              onClick={() => setView("fragments")}
              className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-colors relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "fragments" ? "text-green" : "text-beige-faint hover:text-beige"}`}
            >
              <History className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Fragments</span>
              {view === "fragments" && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-green/40"
                />
              )}
            </button>

            <button
              onClick={() => setView("lien")}
              className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-colors relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "lien" ? "text-lien" : "text-beige-faint hover:text-beige"}`}
            >
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Lien</span>
              {view === "lien" && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-lien/40"
                />
              )}
            </button>

            <button
              onClick={() => setView("affect")}
              className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-colors relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "affect" ? "text-affect" : "text-beige-faint hover:text-beige"}`}
            >
              <Waves className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Affect</span>
              {view === "affect" && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-affect/40"
                />
              )}
            </button>
          </div>

          <div className="flex flex-row justify-center items-center gap-x-3 sm:gap-x-6 md:gap-x-12 w-full flex-nowrap pt-1">
            <button
              onClick={() => setView("elan")}
              className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-colors relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "elan" ? "text-[#FAF9F6]" : "text-beige-faint hover:text-beige"}`}
            >
              <Orbit className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Élan</span>
              {view === "elan" && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-white/40"
                />
              )}
            </button>

            <button
              onClick={() => setView("matrice")}
              className={`flex items-center gap-1.5 sm:gap-2.5 font-mono text-[11px] sm:text-[14px] tracking-widest uppercase transition-all relative group px-1.5 sm:px-3 py-1.5 rounded-sm whitespace-nowrap shrink-0 ${view === "matrice" ? "text-matrice" : "text-beige-faint hover:text-beige"}`}
            >
              <Fingerprint className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span>Matrice</span>
              {view === "matrice" && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute -bottom-1 left-2 sm:left-3 right-2 sm:right-3 h-px bg-matrice/40"
                />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-center items-center gap-8">
          <button
            onClick={() => setIsPrismesModalOpen(true)}
            className="group flex flex-col items-center gap-2 transition-all"
            title="Prismes"
          >
            <PrismeIcon
              rainbow={prismesCount > 0}
              strokeWidth={1.5}
              className={`w-5 h-5 transition-colors ${prismesCount > 0 ? "" : "text-beige/10"}`}
            />
          </button>

          <button
            onClick={() => setIsLueursModalOpen(true)}
            className="group flex flex-col items-center gap-2 transition-all"
            title="Lueurs"
          >
            <Sparkles
              strokeWidth={1.5}
              className={`w-5 h-5 transition-colors ${lueurs.length > 0 ? "text-beige/40 group-hover:text-beige/80" : "text-beige/10"}`}
            />
          </button>

          <button
            onClick={() => setIsRetourModalOpen(true)}
            className="group flex flex-col items-center gap-2 transition-all"
            title="Faire un retour"
          >
            <MessagesSquare strokeWidth={1.5} className="w-5 h-5 text-beige/10 group-hover:text-beige/60 transition-all" />
          </button>
        </div>
      </div>
    </>
  );
}
