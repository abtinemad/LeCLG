import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Fingerprint } from 'lucide-react';

interface KeyEntryProps {
  className?: string;
  hideLabel?: boolean;
}

export const KeyEntry = ({ className = "", hideLabel = false }: KeyEntryProps) => {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state with localStorage
  useEffect(() => {
    const checkKey = () => {
      setHasKey(!!localStorage.getItem('collegue_personal_id'));
    };
    checkKey();
    window.addEventListener('storage', checkKey);
    return () => window.removeEventListener('storage', checkKey);
  }, []);

  const restore = () => {
    const k = key.trim();
    if (!k) return;
    localStorage.setItem('collegue_personal_id', k);
    setHasKey(true);
    navigate('/carnet');
  };

  const logout = () => {
    localStorage.removeItem('collegue_personal_id');
    setHasKey(false);
    setKey('');
    setOpen(false);
    navigate('/');
  };

  // Close when tapping outside on phone or desktop
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  // Robust programmatic focus for mobile soft keyboard activation
  useEffect(() => {
    if (open && !hasKey) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.click(); // Some browsers require interaction to pop up the keyboard
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [open, hasKey]);

  return (
    <div className={className} id="key-entry-container">
      {open ? (
        hasKey ? (
          <div ref={containerRef} className="flex items-center gap-2 bg-bg/95 backdrop-blur-sm border border-border rounded-sm px-2.5 py-1" id="key-entry-logout-box">
            <Link
              to="/carnet"
              onClick={() => setOpen(false)}
              className="text-[11px] font-mono tracking-wider uppercase text-beige-faint hover:text-beige transition-colors"
              id="key-entry-carnet-link"
            >
              Carnet
            </Link>
            <span className="text-white/10 text-[9px] font-mono select-none">|</span>
            <button
              onClick={logout}
              className="text-[11px] font-mono tracking-wider uppercase text-red-400 hover:text-red-300 transition-colors"
              id="key-entry-logout-btn"
            >
              Déconnecter
            </button>
          </div>
        ) : (
          <div ref={containerRef} className="flex items-center gap-1 bg-bg/95 backdrop-blur-sm border border-border rounded-sm pl-3 pr-1 py-1" id="key-entry-input-box">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') restore();
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Clé-LCLG"
              className="bg-transparent text-base md:text-[12px] text-beige placeholder:text-beige-faint font-mono tracking-wide focus:outline-none w-[130px]"
              id="key-entry-input"
            />
            <button
              onClick={restore}
              aria-label="Retrouver mon carnet"
              className="text-beige-faint hover:text-beige transition-colors p-2.5 md:p-1.5"
              id="key-entry-submit-btn"
            >
              <ArrowRight size={14} />
            </button>
          </div>
        )
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center text-beige-faint hover:text-beige transition-colors ${hideLabel ? 'p-3 md:p-1.5' : 'gap-1.5 font-mono text-[9px] tracking-widest uppercase'}`}
          id="key-entry-trigger-btn"
          title={hasKey ? "Déconnexion" : "Retrouver mon carnet"}
        >
          <Fingerprint size={hideLabel ? 14 : 11} strokeWidth={hideLabel ? 1.5 : 2} className={hasKey ? "text-green/80" : ""} />
          {!hideLabel && (hasKey ? "Déconnexion" : "Retrouver mon carnet")}
        </button>
      )}
    </div>
  );
};
