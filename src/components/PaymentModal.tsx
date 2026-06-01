import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bitcoin, ExternalLink, Copy, CheckCircle2, ChevronDown } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paypalUrl: string;
  title: string;
  amount?: string;
  color?: string;
}

// Coordonnées de paiement issues de l'environnement (build Vite). Tant qu'une
// valeur n'est pas renseignée, la méthode correspondante ne s'affiche pas :
// impossible de livrer une coordonnée factice ou un bouton « copier » bidon.
const WERO_NUMBER = (import.meta.env.VITE_WERO_NUMBER || "").trim();
const CRYPTOS = [
  { name: "Bitcoin (BTC)", address: (import.meta.env.VITE_BTC_ADDRESS || "").trim() },
  { name: "Ethereum (ERC-20)", address: (import.meta.env.VITE_ETH_ADDRESS || "").trim() },
  { name: "Solana (SOL)", address: (import.meta.env.VITE_SOL_ADDRESS || "").trim() },
].filter((c) => c.address);

export function PaymentModal({ isOpen, onClose, paypalUrl, title, amount, color = "text-beige" }: PaymentModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const hasPayPal = !!(paypalUrl && paypalUrl.trim());
  const hasWero = !!WERO_NUMBER;
  const hasClassic = hasPayPal || hasWero;
  const hasCrypto = CRYPTOS.length > 0;

  // Section ouverte par défaut : la première réellement disponible.
  const [openMethod, setOpenMethod] = useState<"classic" | "crypto" | null>(
    hasClassic ? "classic" : hasCrypto ? "crypto" : null,
  );

  const handleCopy = async (address: string, name: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(name);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Contexte non sécurisé (http) ou permission refusée : on évite la
      // promesse non gérée. Le texte reste sélectionnable manuellement.
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] z-[210] p-6 lg:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-[#0a0a0a] border border-white/10 p-8 shadow-2xl relative`}>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/30 hover:text-white/80 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X size={20} strokeWidth={1.5} />
              </button>

              <div className="mb-8">
                <h3 className={`font-mono text-xs uppercase tracking-widest ${color} mb-2`}>{title}</h3>
                <p className="font-serif italic text-beige-faint text-sm">Choisissez votre méthode de paiement {amount && <span className="not-italic font-mono text-[13px] ml-1 opacity-60">({amount})</span>}</p>
              </div>

              <div className="space-y-3">
                {/* Paiement classique — PayPal & Wero, repliable.
                    Affiché seulement si au moins l'un des deux est renseigné. */}
                {hasClassic && (
                <div className="border border-white/10">
                  <button
                    onClick={() => setOpenMethod(openMethod === "classic" ? null : "classic")}
                    className="w-full flex items-center justify-between p-4 group cursor-pointer"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">
                      Paiement classique
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-white/40 transition-transform ${openMethod === "classic" ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openMethod === "classic" && (
                    <div className="p-4 pt-0 space-y-3">
                      {hasPayPal && (
                      <a
                        href={paypalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose}
                        className="flex items-center justify-between w-full bg-[#003087]/20 border border-[#003087]/40 hover:bg-[#003087]/30 transition-colors p-4 group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#003087] flex items-center justify-center text-white font-bold italic">
                            P
                          </div>
                          <span className="font-sans text-sm text-white group-hover:text-white transition-colors">Payer avec PayPal</span>
                        </div>
                        <ExternalLink size={16} className="text-white/40 group-hover:text-white/80 transition-colors" />
                      </a>
                      )}

                      {hasWero && (
                      <div className="flex items-center justify-between w-full bg-[#3949ab]/10 border border-[#3949ab]/30 p-4 relative group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#3949ab] flex items-center justify-center text-white font-bold text-xs italic">
                            W
                          </div>
                          <div className="flex flex-col">
                            <span className="font-sans text-sm text-white transition-colors">Payer avec Wero</span>
                            <span className="font-mono text-[13px] text-white/50">{WERO_NUMBER}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopy(WERO_NUMBER, "Wero")}
                          className="p-2 bg-black/40 hover:bg-black border border-white/10 text-white/50 hover:text-white transition-all rounded-sm flex items-center justify-center cursor-pointer"
                          title="Copier le numéro"
                        >
                          {copied === "Wero" ? <CheckCircle2 size={14} className="text-green" /> : <Copy size={14} />}
                        </button>
                      </div>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* Cryptomonnaie — BTC / ETH / SOL, repliable.
                    Affiché seulement si au moins une adresse est renseignée. */}
                {hasCrypto && (
                <div className="border border-white/10">
                  <button
                    onClick={() => setOpenMethod(openMethod === "crypto" ? null : "crypto")}
                    className="w-full flex items-center justify-between p-4 group cursor-pointer"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">
                      Cryptomonnaie
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-white/40 transition-transform ${openMethod === "crypto" ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openMethod === "crypto" && (
                    <div className="p-4 pt-0 space-y-3">
                      {CRYPTOS.map((crypto) => (
                        <div key={crypto.name} className="flex flex-col gap-2 p-4 bg-white/5 border border-white/5 hover:border-white/10 transition-colors relative group">
                          <div className="flex items-center gap-2">
                            <Bitcoin size={16} className="text-yellow-500/80" strokeWidth={1.5} />
                            <span className="font-mono text-[13px] text-white/80">{crypto.name}</span>
                          </div>
                          <div className="font-mono text-[13px] text-beige-faint break-all pr-12">
                            {crypto.address}
                          </div>
                          <button
                            onClick={() => handleCopy(crypto.address, crypto.name)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black border border-white/10 text-white/50 hover:text-white transition-all rounded-sm flex items-center justify-center cursor-pointer"
                            title="Copier l'adresse"
                          >
                            {copied === crypto.name ? <CheckCircle2 size={14} className="text-green" /> : <Copy size={14} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {!hasClassic && !hasCrypto && (
                  <p className="font-serif italic text-beige-faint/70 text-sm text-center py-2">
                    Moyens de paiement bientôt disponibles.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}

interface PaymentWrapperProps {
  children: React.ReactNode;
  paypalUrl: string;
  title: string;
  amount?: string;
  color?: string;
  className?: string;
}

export function PaymentWrapper({ children, paypalUrl, title, amount, color, className }: PaymentWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div onClick={() => setIsOpen(true)} className={`cursor-pointer ${className || ''}`}>
        {children}
      </div>
      <PaymentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        paypalUrl={paypalUrl}
        title={title}
        amount={amount}
        color={color}
      />
    </>
  );
}