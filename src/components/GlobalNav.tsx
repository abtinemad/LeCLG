import { Link, useLocation } from 'react-router-dom';
import { Brain, BookOpen, Cloud } from 'lucide-react';
import { KeyEntry } from './KeyEntry';

export function GlobalNav() {
  const location = useLocation();

  if (location.pathname === '/admin') return null;

  const isLanding = location.pathname === '/';
  const isClimat = location.pathname === '/climat';

  return (
    <nav className="fixed top-0 left-0 right-0 z-[9999] flex justify-between items-center px-4 md:px-6 py-3 bg-bg/90 backdrop-blur-md border-b border-white/5" id="global-nav">
      <Link to="/" className="flex items-center group" id="global-nav-logo-link">
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-beige-faint group-hover:text-beige-dim transition-colors">Le collègue</span>
      </Link>
      
      {isLanding ? (
        <div className="flex items-center gap-3" id="global-nav-landing-links">
          <Link to="/climat" className="transition-colors flex items-center p-1.5 text-beige-faint hover:text-beige" title="Climat collectif" id="nav-link-climat-landing">
            <Cloud size={13} strokeWidth={1.5} />
          </Link>
          <Link to="/chat" className="transition-colors flex items-center p-1.5 text-beige-faint hover:text-beige" title="Converser" id="nav-link-penser-landing">
            <Brain size={13} strokeWidth={1.5} />
          </Link>
          <KeyEntry className="flex items-center" hideLabel />
        </div>
      ) : isClimat ? (
        <div className="flex items-center gap-3" id="global-nav-links">
          <Link to="/climat" className="transition-colors flex items-center p-1.5 text-beige" title="Climat collectif" id="nav-link-climat">
            <Cloud size={13} strokeWidth={1.5} />
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3" id="global-nav-links">
          <Link to="/climat" className={`transition-colors flex items-center p-1.5 ${location.pathname === '/climat' ? 'text-beige' : 'text-beige-faint hover:text-beige'}`} title="Climat collectif" id="nav-link-climat">
            <Cloud size={13} strokeWidth={1.5} />
          </Link>
          <Link to="/chat" className={`transition-colors flex items-center p-1.5 ${location.pathname === '/chat' ? 'text-beige' : 'text-beige-faint hover:text-beige'}`} title="Penser" id="nav-link-penser">
            <Brain size={13} strokeWidth={1.5} />
          </Link>
          <Link to="/carnet" className={`transition-colors flex items-center p-1.5 ${location.pathname === '/carnet' ? 'text-beige' : 'text-beige-faint hover:text-beige'}`} title="Carnet" id="nav-link-carnet">
            <BookOpen size={13} strokeWidth={1.5} />
          </Link>
        </div>
      )}
    </nav>
  );
}