import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Fingerprint } from 'lucide-react';

interface KeyEntryProps {
  className?: string;
  hideLabel?: boolean;
}

export const KeyEntry = ({ className = "", hideLabel = false }: KeyEntryProps) => {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const navigate = useNavigate();

  const restore = () => {
    const k = key.trim();
    if (!k) return;
    localStorage.setItem('collegue_personal_id', k);
    navigate('/carnet');
  };

  return (
    <div className={className} id="key-entry-container">
      {open ? (
        <div className="flex items-center gap-1 bg-bg/80 backdrop-blur-sm border border-border rounded-sm pl-3 pr-1 py-1" id="key-entry-input-box">
          <input
            autoFocus
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') restore();
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Clé-LCLG"
            className="bg-transparent text-[12px] text-beige placeholder:text-beige-faint font-mono tracking-wide focus:outline-none w-[130px]"
            id="key-entry-input"
          />
          <button
            onClick={restore}
            aria-label="Retrouver mon carnet"
            className="text-beige-faint hover:text-beige transition-colors p-1.5"
            id="key-entry-submit-btn"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center text-beige-faint hover:text-beige transition-colors ${hideLabel ? 'p-1.5' : 'gap-1.5 font-mono text-[9px] tracking-widest uppercase'}`}
          id="key-entry-trigger-btn"
          title="Retrouver mon carnet"
        >
          <Fingerprint size={hideLabel ? 13 : 11} strokeWidth={hideLabel ? 1.5 : 2} />
          {!hideLabel && "Retrouver mon carnet"}
        </button>
      )}
    </div>
  );
};
