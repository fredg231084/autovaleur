# AutoValeur V1 - Implementation Plan

## Project Status

✅ **Completed:**
- Database schema with all tables
- RLS policies for role-based access
- Edge Function for lead creation with email/SMS
- Tracking utilities for source attribution
- Types and shared utilities
- Anti-spam measures (honeypot + rate limiting)
- Deployment guide

🔨 **To Build:**
- Public app (app.autovaleur.ca)
- CRM app (crm.autovaleur.ca)

---

## Architecture Decision: Simplified Approach

### Recommended: Single Repo, Two Separate Deployments

Instead of a complex mono-repo with shared packages, we recommend:

**Option A: Two Independent Vite Projects (Simpler)**
```
/project
├── public-app/           # Deploy to app.autovaleur.ca
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── crm-app/              # Deploy to crm.autovaleur.ca
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── supabase/
│   └── functions/
└── shared/               # Shared types (copy or symlink)
    └── types.ts
```

**Benefits:**
- Each app is independent and simple
- No complex build tooling
- Easy to deploy to Vercel (two projects)
- Shared code is minimal (just types)

**Option B: Current Setup (Already Started)**
- Keep existing structure
- Public app uses current /src
- Build CRM as separate entry

We'll use **Option B** since we've already started with the current structure.

---

## Implementation Steps

### Step 1: Public App (app.autovaleur.ca)

The existing AutoValeurWidget component is already excellent. We need to:

1. **Integrate with tracking system**
2. **Connect to Edge Function**
3. **Add theme loading**
4. **Deploy**

**Key Files:**
- `src/App.tsx` - Already has the widget
- `src/lib/api.ts` - API client (NEW)
- `src/lib/tracking.ts` - Copy from packages/shared
- `src/main.tsx` - Initialize tracking

### Step 2: CRM App (crm.autovaleur.ca)

Build a separate app with:

1. **Authentication**
   - Login/logout
   - Role-based routing
   - Protected routes

2. **Layouts**
   - Sidebar navigation
   - User menu
   - Role-specific nav items

3. **Screens:**
   - Dashboard (KPIs)
   - Leads list + filters
   - Lead detail
   - My Visits (evaluator)
   - Inventory
   - Settings (admin)

**Tech Stack:**
- React Router for routing
- Supabase client for auth + data
- Same Tailwind + Lucide icons

---

## Detailed Build Guide

### Public App Implementation

#### 1. Create API Client

**File: `src/lib/supabase.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### 2. Create Lead Submission Function

**File: `src/lib/api.ts`**
```typescript
import { supabase } from './supabase';
import { getTrackingData } from './tracking';

export async function submitLead(formData: any) {
  const tracking = getTrackingData();

  const payload = {
    ...formData,
    tracking,
  };

  // Call Edge Function
  const { data, error } = await supabase.functions.invoke('create-lead', {
    body: payload,
  });

  if (error) throw error;
  return data;
}
```

#### 3. Update Main App

**File: `src/main.tsx`**
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeTracking } from './lib/tracking';

// Initialize tracking
initializeTracking();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

#### 4. Connect Widget to API

**Update: `src/App.tsx`** - In the submit function:
```typescript
import { submitLead } from './lib/api';

async function submit(e: React.FormEvent) {
  e.preventDefault();
  // ... validation ...

  try {
    setSubmitting(true);

    const leadData = {
      vehicle_year: year,
      vehicle_make: make,
      vehicle_model: model,
      vin: vin,
      km: km,
      drivable: drivable === 'oui',
      up_to: upTo,
      postal_code: postal,
      slot_type: slotType,
      selected_slot_id: selectedSlotId,
      selected_slot_datetime: selectedSlot?.start.toISOString(),
      client_name: name,
      client_phone: phone,
      client_email: email,
      client_address: address,
      payment_preference: payPref,
      terms_accepted: termsAccepted,
      inspection_accepted: inspectionAccepted,
      marketing_opt_in: marketingOptIn,
      honeypot: '', // Anti-spam
    };

    await submitLead(leadData);
    setSubmitted(true);
  } catch (error) {
    console.error('Submission failed:', error);
    alert('Une erreur est survenue. Veuillez réessayer.');
  } finally {
    setSubmitting(false);
  }
}
```

---

### CRM App Implementation

#### Architecture

```
crm-app/
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # Router setup
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   ├── auth.ts                # Auth helpers
│   │   └── hooks.ts               # Custom hooks
│   ├── components/
│   │   ├── Layout.tsx             # Main layout
│   │   ├── Sidebar.tsx            # Navigation
│   │   ├── ProtectedRoute.tsx    # Route guard
│   │   └── ui/                    # Reusable UI components
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Leads/
│   │   │   ├── LeadsList.tsx
│   │   │   └── LeadDetail.tsx
│   │   ├── MyVisits.tsx           # Evaluator view
│   │   ├── Inventory.tsx
│   │   └── Settings/
│   │       ├── ThemeSettings.tsx
│   │       ├── EmailSettings.tsx
│   │       └── SMSSettings.tsx
│   └── types.ts                   # Import from shared
```

#### 1. Setup Routing

**File: `crm-app/src/App.tsx`**
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/hooks';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeadsList from './pages/Leads/LeadsList';
import LeadDetail from './pages/Leads/LeadDetail';
import MyVisits from './pages/MyVisits';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<LeadsList />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/my-visits" element={<MyVisits />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/settings/*" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

#### 2. Auth Hook

**File: `crm-app/src/lib/hooks.ts`**
```typescript
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    setProfile(data);
    setLoading(false);
  }

  return { user, profile, loading };
}
```

#### 3. Protected Route

**File: `crm-app/src/components/ProtectedRoute.tsx`**
```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/hooks';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

#### 4. Layout with Sidebar

**File: `crm-app/src/components/Layout.tsx`**
```typescript
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

#### 5. Sidebar Navigation

**File: `crm-app/src/components/Sidebar.tsx`**
```typescript
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Package, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../lib/hooks';
import { supabase } from '../lib/supabase';

export default function Sidebar() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isEvaluator = profile?.role === 'evaluator';

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold">AutoValeur CRM</h1>
        <p className="text-sm text-slate-400 mt-1">{profile?.full_name}</p>
        <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
      </div>

      <nav className="flex-1 px-3">
        {!isEvaluator && (
          <NavItem to="/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
        )}

        {!isEvaluator && (
          <NavItem to="/leads" icon={Users}>Leads</NavItem>
        )}

        {isEvaluator && (
          <NavItem to="/my-visits" icon={Calendar}>My Visits</NavItem>
        )}

        {!isEvaluator && (
          <NavItem to="/inventory" icon={Package}>Inventory</NavItem>
        )}

        {isAdmin && (
          <NavItem to="/settings" icon={Settings}>Settings</NavItem>
        )}
      </nav>

      <div className="p-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function NavItem({ to, icon: Icon, children }: any) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 ${
          isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'
        }`
      }
    >
      <Icon className="h-5 w-5" />
      <span>{children}</span>
    </NavLink>
  );
}
```

#### 6. Dashboard with KPIs

**File: `crm-app/src/pages/Dashboard.tsx`**
```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Users, CheckCircle, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    // Load all leads
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (!leads) return;

    // Calculate metrics
    const total = leads.length;
    const today = leads.filter(l =>
      new Date(l.created_at).toDateString() === new Date().toDateString()
    ).length;

    const evaluated = leads.filter(l => l.status === 'EVALUATED' || l.status === 'BOUGHT').length;
    const bought = leads.filter(l => l.status === 'BOUGHT').length;

    const avgEstimation = leads.reduce((sum, l) => sum + l.up_to, 0) / leads.length;

    setMetrics({
      total,
      today,
      evaluated,
      bought,
      avgEstimation,
      conversionRate: (bought / total * 100).toFixed(1),
    });
  }

  if (!metrics) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Users}
          label="Total Leads"
          value={metrics.total}
          subtext={`${metrics.today} today`}
          color="blue"
        />
        <MetricCard
          icon={CheckCircle}
          label="Evaluated"
          value={metrics.evaluated}
          subtext={`${((metrics.evaluated / metrics.total) * 100).toFixed(0)}% of total`}
          color="green"
        />
        <MetricCard
          icon={TrendingUp}
          label="Purchased"
          value={metrics.bought}
          subtext={`${metrics.conversionRate}% conversion`}
          color="purple"
        />
        <MetricCard
          icon={DollarSign}
          label="Avg Estimation"
          value={`$${Math.round(metrics.avgEstimation).toLocaleString()}`}
          subtext="Per lead"
          color="amber"
        />
      </div>

      {/* Add charts, tables, etc. */}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, subtext, color }: any) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-lg ${colors[color as keyof typeof colors]} text-white`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm text-slate-600">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </div>
      <div className="text-sm text-slate-500">{subtext}</div>
    </div>
  );
}
```

---

## Next Steps

### Phase 1: Public App (Priority 1)
1. Copy tracking utilities to public app
2. Create API client
3. Connect widget to Edge Function
4. Test full flow
5. Deploy to Vercel (app.autovaleur.ca)

### Phase 2: CRM Foundation (Priority 2)
1. Create crm-app folder structure
2. Setup routing and auth
3. Build layout and sidebar
4. Create login page
5. Deploy to Vercel (crm.autovaleur.ca)

### Phase 3: CRM Features (Priority 3)
1. Dashboard with metrics
2. Leads list with filters
3. Lead detail with timeline
4. Evaluator "My Visits" view
5. Settings pages (theme, email, SMS)

### Phase 4: Advanced Features (Priority 4)
1. Evaluation forms with photos
2. Inventory management
3. Advanced analytics
4. Export functionality

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run public app (development)
npm run dev

# Build public app
npm run build

# For CRM app (after creating it)
cd crm-app
npm install
npm run dev
```

---

## Environment Variables

Both apps need:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Testing Checklist

### Public App
- [ ] Tracking initializes on page load
- [ ] Form validates correctly
- [ ] Honeypot blocks spam
- [ ] Rate limiting works
- [ ] Lead creates successfully
- [ ] Emails sent (client + internal)
- [ ] SMS sent (if configured)
- [ ] Success screen shows

### CRM App
- [ ] Login works
- [ ] Logout works
- [ ] Dashboard shows metrics
- [ ] Leads list loads
- [ ] Lead detail shows all info
- [ ] Evaluator can only see assigned leads
- [ ] Admin can access settings
- [ ] Theme changes apply
- [ ] Email settings save
- [ ] SMS settings save

---

## Support

For questions or issues:
1. Check activity_log table for errors
2. Check Supabase Edge Function logs
3. Verify RLS policies
4. Check browser console for frontend errors

Good luck! 🚀
