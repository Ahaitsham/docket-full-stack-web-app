import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { SheetProvider } from './components/sheets.jsx';
import AppShell from './components/AppShell.jsx';
import AuthPage from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import Tasks from './pages/Tasks.jsx';
import Track from './pages/Track.jsx';
import Settings from './pages/Settings.jsx';

// Charts are the heaviest part of the app, so they load only when Progress is opened.
const Progress = lazy(() => import('./pages/Progress.jsx'));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-app">
      <img src="/icons/icon-192.png" alt="Docket" className="size-16 animate-pulse rounded-2xl" />
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <SheetProvider>
      <AppShell />
    </SheetProvider>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <Splash />;
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<Protected />}>
        <Route index element={<Home />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="track/*" element={<Track />} />
        <Route path="progress" element={<Suspense fallback={<div className="h-64" />}><Progress /></Suspense>} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
