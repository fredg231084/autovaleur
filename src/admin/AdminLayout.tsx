import { NavLink, Outlet } from 'react-router-dom';
import { Car, Tag, LogOut } from 'lucide-react';
import { useAuth } from './auth';

const linkBase =
  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors';

function navClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? `${linkBase} bg-slate-900 text-white`
    : `${linkBase} text-slate-600 hover:bg-slate-100`;
}

export function AdminLayout() {
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="text-sm font-extrabold tracking-tight text-slate-900">
              AutoValeur <span className="text-slate-400">Admin</span>
            </span>
            <nav className="flex items-center gap-1">
              {/* `end` so the Leads tab isn't active on /prix or /leads/:id */}
              <NavLink to="/" end className={navClass}>
                <Car className="h-4 w-4" /> Leads
              </NavLink>
              <NavLink to="/prix" className={navClass}>
                <Tag className="h-4 w-4" /> Prix
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">
              {session?.user.email}
            </span>
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" /> Sortir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
