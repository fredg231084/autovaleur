import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type Role = 'admin' | 'manager' | 'evaluator';

interface AuthState {
  loading: boolean;
  session: Session | null;
  role: Role | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRole(s: Session | null) {
      if (!s) {
        if (active) setRole(null);
        return;
      }
      // The profiles SELECT policy lets any authenticated user read profiles.
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', s.user.id)
        .maybeSingle();
      if (active) setRole((data?.role as Role) ?? null);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadRole(data.session);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      void loadRole(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ loading, session, role, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      {children}
    </div>
  );
}

// Real access control is enforced by RLS on every table the dashboard reads;
// this guard only decides which screen to show (login / denied / dashboard).
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, session, role, signOut } = useAuth();

  if (loading) return <FullScreenMessage>Chargement…</FullScreenMessage>;
  if (!session) return <Navigate to="/login" replace />;

  if (role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">Accès réservé</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ce tableau de bord est réservé aux administrateurs.
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
