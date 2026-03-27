import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from './context/WalletContext';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/ToastContainer';

import {
  ShipmentsPage, TrackingPage, ActorsPage, ProductsPage,
  ProfilePage, CheckpointsPage, IncidentsPage,
  SenderShipmentsPage,
} from './pages/Pages';
import { SenderProductsPage } from './pages/SenderProductsPage';

// ============================================================
//  Páginas permitidas por rol
//  null / 0  = cuenta conectada pero sin rol registrado
//  1         = Remitente
//  2         = Transportista
//  3         = Hub Logístico
//  4         = Destinatario
//  5         = Inspector
//  'admin'   = Administrador
// ============================================================

const ROLE_ALLOWED = {
  null:  new Set(['profile']),
  0:     new Set(['profile']),
  1:     new Set(['sender-envios', 'sender-products', 'tracking', 'profile']),
  2:     new Set(['dashboard', 'shipments', 'tracking', 'checkpoints', 'profile']),
  3:     new Set(['dashboard', 'shipments', 'tracking', 'checkpoints', 'incidents', 'profile']),
  4:     new Set(['tracking', 'profile']),
  5:     new Set(['dashboard', 'shipments', 'tracking', 'checkpoints', 'incidents', 'actors', 'profile']),
  admin: 'all',
};

const ROLE_HOME = {
  null:  'profile',
  0:     'profile',
  1:     'sender-envios',
  2:     'dashboard',
  3:     'dashboard',
  4:     'tracking',
  5:     'dashboard',
  admin: 'dashboard',
};

function AppLayout() {
  const { isConnected, sessionLoaded, isAdmin, actorRole } = useWallet();

  const roleKey  = isAdmin ? 'admin' : (actorRole ?? null);
  const homePage = ROLE_HOME[roleKey] ?? 'profile';

  // Empezamos siempre en 'profile' y dejamos que el efecto
  // de sincronización de rol nos lleve a homePage cuando el
  // rol se resuelve (puede venir del localStorage o de la chain)
  const [page, setPage]             = useState('profile');
  const [trackingId, setTrackingId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ref para saber si ya navegamos al home por rol
  // (evita redirigir cada vez que el componente re-renderiza)
  const roleNavigatedRef = useRef(null);

  // Cuando el rol se resuelve (o cambia), navegar al home del rol
  // Solo lo hacemos una vez por valor de roleKey
  useEffect(() => {
    if (!isConnected) return;
    if (roleNavigatedRef.current === roleKey) return; // ya navegamos a este rol
    roleNavigatedRef.current = roleKey;
    setPage(homePage);
  }, [roleKey, homePage, isConnected]);

  // Resetear cuando se desconecta
  useEffect(() => {
    if (!isConnected) {
      roleNavigatedRef.current = null;
      setPage('profile');
    }
  }, [isConnected]);

  const canAccess = (target) => {
    if (isAdmin) return true;
    const allowed = ROLE_ALLOWED[actorRole ?? null];
    if (!allowed) return target === 'profile';
    if (allowed === 'all') return true;
    return allowed.has(target);
  };

  const navigate = (target, id = null) => {
    if (!canAccess(target)) return; // ignorar clicks a páginas no permitidas
    setPage(target);
    if (target === 'tracking' && id) setTrackingId(id);
    setMobileOpen(false);
  };

  if (!sessionLoaded) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--ct-bg)' }}>
        <div className="text-center">
          <div className="spinner-border" style={{ color:'var(--ct-accent)', width:40, height:40 }} />
          <div style={{ color:'var(--ct-text2)', marginTop:16, fontFamily:'var(--ct-mono)', fontSize:'0.8rem' }}>
            Restaurando sesión...
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) return <LoginPage />;

  const renderPage = () => {
    // Guardia: si la página actual ya no es accesible (p.ej. cambio de rol)
    // redirigir silenciosamente al home
    if (!canAccess(page)) {
      setTimeout(() => setPage(homePage), 0);
      return null;
    }

    switch (page) {
      case 'dashboard':     return <Dashboard onNavigate={navigate} />;
      case 'sender-envios':    return <SenderShipmentsPage onNavigate={navigate} />;
      case 'sender-products': return <SenderProductsPage />;
      case 'shipments':     return <ShipmentsPage onNavigate={navigate} />;
      case 'tracking':      return <TrackingPage selectedId={trackingId} />;
      case 'checkpoints':   return <CheckpointsPage />;
      case 'incidents':     return <IncidentsPage />;
      case 'actors':        return <ActorsPage />;
      case 'products':      return <ProductsPage />;
      case 'profile':       return <ProfilePage />;
      case 'admin':         return <AdminPanel />;
      default:              return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <>
      <Navbar
        activePage={page}
        onNavigate={navigate}
        onMobileMenuToggle={() => setMobileOpen(o => !o)}
      />
      <div className="ct-layout">
        <Sidebar
          activePage={page}
          onNavigate={navigate}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <main className="ct-main">
          {renderPage()}
        </main>
      </div>
      <ToastContainer />
    </>
  );
}

export default function App() {
  return <AppLayout />;
}
