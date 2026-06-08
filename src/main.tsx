import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// Code-split by route at the entry point. The public funnel and the admin
// dashboard are each their own dynamic chunk, so the funnel never downloads
// react-router or any dashboard JS, and /admin never downloads the funnel.
if (window.location.pathname.startsWith('/admin')) {
  const AdminApp = lazy(() => import('./admin/AdminApp'));
  root.render(
    <StrictMode>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
            Chargement…
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    </StrictMode>
  );
} else {
  // Public funnel — unchanged behaviour (tracking initialised before render).
  Promise.all([import('./App'), import('./lib/tracking')]).then(
    ([{ default: App }, { initializeTracking }]) => {
      initializeTracking();
      root.render(
        <StrictMode>
          <App />
        </StrictMode>
      );
    }
  );
}
