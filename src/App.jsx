import React, { lazy, Suspense, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute, { PublicOnlyRoute, LoginRoute, AdminRoute } from '@/components/ProtectedRoute';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';

const Dashboard = lazy(() => import('./page/DashBoard'));
const MapEditor = lazy(() => import('./page/MapEditor'));
const Register = lazy(() => import('./page/Register'));
const VerifyEmail = lazy(() => import('./page/VerifyEmail'));
const PasswordForgot = lazy(() => import('./page/PasswordForgot'));
const PasswordReset = lazy(() => import('./page/PasswordReset'));
const Profile = lazy(() => import('./page/Profile'));
const AdminUsers = lazy(() => import('./page/AdminUsers'));
const AdminAudit = lazy(() => import('./page/AdminAudit'));
const AdminMapIntervention = lazy(() => import('./page/AdminMapIntervention'));
const Gallery = lazy(() => import('./page/Gallery'));
const PublicMapView = lazy(() => import('./page/PublicMapView'));

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

function RouteFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function NativePermissions() {
  useEffect(() => {
    const requestPermissions = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const geoStatus = await Geolocation.checkPermissions();
          if (geoStatus.location !== 'granted') {
            await Geolocation.requestPermissions();
          }
          const camStatus = await Camera.checkPermissions();
          if (camStatus.camera !== 'granted') {
            await Camera.requestPermissions();
          }
        } catch (e) {
          console.warn('Erro ao solicitar permissões:', e);
        }
      }
    };
    requestPermissions();
  }, []);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NativePermissions />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route
                path="/register"
                element={
                  <PublicOnlyRoute>
                    <Register />
                  </PublicOnlyRoute>
                }
              />
              <Route path="/verify" element={<VerifyEmail />} />
              <Route
                path="/forgot-password"
                element={
                  <PublicOnlyRoute>
                    <PasswordForgot />
                  </PublicOnlyRoute>
                }
              />
              <Route path="/reset-password" element={<PasswordReset />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/gallery/:publicId" element={<PublicMapView />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/editor/:mapId" element={<MapEditor />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route element={<AdminRoute />}>
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/maps" element={<AdminMapIntervention />} />
                <Route path="/admin/audit" element={<AdminAudit />} />
              </Route>
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
