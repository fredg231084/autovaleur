import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, RequireAdmin } from './auth';
import { AdminLayout } from './AdminLayout';
import { LoginScreen } from './screens/LoginScreen';
import { LeadsScreen } from './screens/LeadsScreen';
import { LeadDetailScreen } from './screens/LeadDetailScreen';
import { PrixScreen } from './screens/PrixScreen';

export default function AdminApp() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<LeadsScreen />} />
            <Route path="leads/:id" element={<LeadDetailScreen />} />
            <Route path="prix" element={<PrixScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
