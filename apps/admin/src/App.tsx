import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MuseumsPage = lazy(() => import('./pages/MuseumsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));

export default function App() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/museums" element={<MuseumsPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
