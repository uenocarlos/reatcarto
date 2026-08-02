import React, { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute, { PublicOnlyRoute, LoginRoute, AdminRoute } from '@/components/ProtectedRoute';
import Dashboard from './page/DashBoard';
import MapEditor from './page/MapEditor';
import Register from './page/Register';
import VerifyEmail from './page/VerifyEmail';
import PasswordForgot from './page/PasswordForgot';
import PasswordReset from './page/PasswordReset';
import Profile from './page/Profile';
import AdminUsers from './page/AdminUsers';
import AdminAudit from './page/AdminAudit';
import AdminMapIntervention from './page/AdminMapIntervention';
import Gallery from './page/Gallery';
import PublicMapView from './page/PublicMapView';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';

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
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
