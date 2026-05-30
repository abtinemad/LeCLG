import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Fingerprint, BookOpen, LogOut } from 'lucide-react';

interface KeyEntryProps {
  className?: string;
  hideLabel?: boolean;
}

export const KeyEntry = ({ className = "", hideLabel = false }: KeyEntryProps) => {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [code, setCode] = useState('');
  const [forceReconnect, setForceReconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  // Une lecture a été refusée (clé réclamée, mais code absent sur cet appareil) :
  // on ouvre l'entrée en forçant la saisie du code, la clé déjà pré-remplie.
  useEffect(() => {
    const onCodeRequired = () => {
      const k = localStorage.getItem('collegue_personal_id') || '';
      setKey(k);
      setForceReconnect(true);
      setOpen(true);
    };
    window.addEventListener('collegue:code-required', onCodeRequired);
    return () => window.removeEventListener('collegue:code-required', onCodeRequired);
  }, []);

  const restore = async () => {
    const k = key.trim();
    if (!k) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Code à 6 chiffres requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'verify', data: { personal_id: k, code } }),
      });
      if (res.status === 200) {
        localStorage.setItem('collegue_personal_id', k);
        localStorage.setItem('collegue_access_code', code);
        setHasKey(true);
        setSubmitting(false);
        if (forceReconnect) {
          window.location.reload();
          return;
        }
        navigate('/carnet');
        return;
      }
      if (res.status === 423) {
        setError('Trop d\'essais. Réessayez dans quelques minutes.');
      } else {
        setError('Clé ou code incorrect.');
      }
    } catch (e) {
      setError('Erreur réseau. Réessayez.');
    }
    setSubmitting(false);
  };

  const logout = () => {
    localStorage.removeItem('collegue_personal_id');
    localStorage.removeItem('collegue_access_code');
    setHasKey(false);
    setKey('');
    setCode('');
    setError(null);
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
    if (open && (!hasKey || forceReconnect)) {
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
        (hasKey && !forceReconnect) ? (
          <div ref={containerRef} className="flex items-center gap-2 bg-bg/95 backdrop-blur-sm border border-border rounded-sm px-2.5 py-1" id="key-entry-logout-box">
            <Link
              to="/carnet"
              onClick={() => setOpen(false)}
              className="p-1 flex items-center text-beige-faint hover:text-beige transition-colors"
              id="key-entry-carnet-link"
              title="Carnet"
            >
              <BookOpen size={13} strokeWidth={1.5} />
            </Link>
            <span className="text-white/10 text-[9px] font-mono select-none">|</span>
            <button
              onClick={logout}
              className="p-1 flex items-center text-red-400 hover:text-red-300 transition-colors"
              id="key-entry-logout-btn"
              title="Déconnexion"
            >
              <LogOut size={13} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div ref={containerRef} className="flex flex-col gap-1.5 bg-bg/95 backdrop-blur-sm border border-border rounded-sm p-2 w-[200px]" id="key-entry-input-box">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={key}
              onChange={(e) => { setKey(e.target.value); if (error) setError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') restore();
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Clé-LCLG"
              className="bg-transparent text-base md:text-[12px] text-beige placeholder:text-beige-faint font-mono tracking-wide focus:outline-none w-full px-1"
              id="key-entry-input"
            />
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); if (error) setError(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') restore();
                  if (e.key === 'Escape') setOpen(false);
                }}
                placeholder="Code (6 chiffres)"
                className="flex-1 bg-transparent text-base md:text-[12px] text-beige placeholder:text-beige-faint font-mono tracking-wide focus:outline-none w-full px-1"
                id="key-entry-code"
              />
              <button
                onClick={restore}
                disabled={submitting}
                aria-label="Retrouver mon carnet"
                className="text-beige-faint hover:text-beige transition-colors p-2.5 md:p-1.5 disabled:opacity-40"
                id="key-entry-submit-btn"
              >
                <ArrowRight size={14} />
              </button>
            </div>
            {error && <p className="text-[10px] text-red-400/80 px-1">{error}</p>}
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