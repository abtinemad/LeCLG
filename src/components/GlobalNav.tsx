import { Link, useLocation } from 'react-router-dom';
import { Brain, BookOpen } from 'lucide-react';

export function GlobalNav() {
  const location = useLocation();

  if (location.pathname === '/admin') return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-[9999] flex justify-between items-center px-4 md:px-6 py-3 bg-bg/90 backdrop-blur-md border-b border-white/5">
      <Link to="/" className="flex items-center group">
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-beige-faint group-hover:text-beige-dim transition-colors">Le collègue</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link to="/chat" className={`font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${location.pathname === '/chat' ? 'text-beige bg-white/5 ring-1 ring-white/10' : 'text-beige-faint hover:text-beige'}`}>
          <Brain size={10} strokeWidth={1.5} />
          <span>penser</span>
        </Link>
        <Link to="/carnet" className={`font-mono text-[9px] tracking-widest uppercase transition-colors flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${location.pathname === '/carnet' ? 'text-beige bg-white/5 ring-1 ring-white/10' : 'text-beige-faint hover:text-beige'}`}>
          <BookOpen size={10} strokeWidth={1.5} />
          <span>carnet</span>
        </Link>
      </div>
    </nav>
  );
}
