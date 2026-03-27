import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useApp } from '../context/BlockchainContext';

// ============================================================
//  Sidebar — Menú lateral con acceso por rol
//
//  Admin (isAdmin)      → todo + panel admin
//  Remitente (rol 1)    → Mis Envíos + Mi Perfil
//  Transportista (2)    → Dashboard, Envíos, Tracking, Checkpoints, Mi Perfil
//  Hub (3)              → igual que transportista + Incidencias
//  Destinatario (4)     → Tracking, Mi Perfil
//  Inspector (5)        → todo excepto Admin
//  Sin rol (null/0)     → solo Mi Perfil
// ============================================================

const ALL_ITEMS = [
  // null/0 = sin rol → solo Mi Perfil
  { key: 'dashboard',      label: 'Dashboard',    icon: 'bi-grid-1x2-fill',             section: null,        roles: [2,3,4,5,'admin'] },
  { key: 'sender-envios',    label: 'Mis Envíos',    icon: 'bi-box-seam-fill',    section: null,        roles: [1] },
  { key: 'sender-products', label: 'Mis Productos', icon: 'bi-archive-fill',     section: null,        roles: [1] },
  { key: 'shipments',      label: 'Envíos',        icon: 'bi-box-seam-fill',             section: null,        roles: [2,3,5,'admin'] },
  { key: 'tracking',       label: 'Tracking',      icon: 'bi-geo-alt-fill',              section: null,        roles: [2,3,4,5,'admin'] },
  { key: 'checkpoints',    label: 'Checkpoints',   icon: 'bi-pin-map-fill',              section: 'Logística', roles: [2,3,5,'admin'] },
  { key: 'incidents',      label: 'Incidencias',   icon: 'bi-exclamation-triangle-fill', section: null,        roles: [3,5,'admin'] },
  { key: 'actors',         label: 'Actores',       icon: 'bi-people-fill',               section: 'Red',       roles: [5,'admin'] },
  { key: 'profile',        label: 'Mi Perfil',     icon: 'bi-person-badge-fill',         section: 'Cuenta',    roles: [null,0,1,2,3,4,5,'admin'] },
  { key: 'admin',          label: 'Admin Panel',   icon: 'bi-shield-lock-fill',          section: 'Admin',     roles: ['admin'] },
];

function getVisibleItems(isAdmin, actorRole) {
  if (isAdmin) return ALL_ITEMS.filter(i => i.roles.includes('admin'));
  // Sin rol registrado: solo Mi Perfil
  if (actorRole === null || actorRole === undefined || actorRole === 0) {
    return ALL_ITEMS.filter(i => i.roles.includes(null) || i.roles.includes(0));
  }
  return ALL_ITEMS.filter(item => item.roles.includes(actorRole));
}

// ── Contenido del sidebar (compartido desktop + drawer mobile) ──
function SidebarContent({ activePage, onNavigate, isAdmin, actorRole, stats, onClose }) {
  const badges = {
    shipments:    stats.inTransit > 0 ? stats.inTransit : null,
    'sender-envios': stats.inTransit > 0 ? stats.inTransit : null,
    incidents:    stats.incidents > 0 ? stats.incidents : null,
  };

  const visibleItems = getVisibleItems(isAdmin, actorRole);
  let currentSection = null;

  return (
    <>
      {visibleItems.map(item => {
        const showSection = item.section && item.section !== currentSection;
        if (showSection) currentSection = item.section;
        const isActive = activePage === item.key;

        return (
          <React.Fragment key={item.key}>
            {showSection && (
              <div className="ct-sidebar-section">{item.section}</div>
            )}
            <button
              className={`ct-sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => { onNavigate(item.key); onClose?.(); }}
            >
              <i className={`bi ${item.icon}`} />
              <span className="flex-grow-1">{item.label}</span>
              {badges[item.key] && (
                <span className="badge rounded-pill" style={{
                  background: item.key === 'incidents' ? 'var(--ct-danger-dim)' : 'var(--ct-accent-dim)',
                  color:      item.key === 'incidents' ? 'var(--ct-danger)'     : 'var(--ct-accent)',
                  border: `1px solid ${item.key === 'incidents' ? 'rgba(255,77,106,0.3)' : 'rgba(0,229,255,0.25)'}`,
                  fontSize: '0.62rem',
                }}>
                  {badges[item.key]}
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}

      <div className="mt-auto pt-3" style={{ borderTop: '1px solid var(--ct-border)' }}>
        <div style={{ padding: '0.5rem 0.85rem', fontSize: '0.65rem', color: 'var(--ct-text3)', fontFamily: 'var(--ct-mono)' }}>
          <div>v1.2.0 · MVP</div>
          <div style={{ marginTop: 2 }}>Anvil Local</div>
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ activePage, onNavigate, mobileOpen, onMobileClose }) {
  const { isAdmin, actorRole } = useWallet();
  const { stats } = useApp();

  return (
    <>
      {/* Desktop */}
      <div className="ct-sidebar d-none d-lg-flex">
        <SidebarContent
          activePage={activePage} onNavigate={onNavigate}
          isAdmin={isAdmin} actorRole={actorRole} stats={stats}
        />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={onMobileClose} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.65)',
          zIndex:1040, backdropFilter:'blur(2px)',
        }} />
      )}

      {/* Mobile drawer */}
      <div className="d-flex d-lg-none flex-column" style={{
        position:'fixed', top:0, left:0, bottom:0, width:260,
        background:'var(--ct-surface)', borderRight:'1px solid var(--ct-border)',
        zIndex:1050, padding:'0.75rem', overflowY:'auto',
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: mobileOpen ? '4px 0 32px rgba(0,0,0,0.5)' : 'none',
      }}>
        <div className="d-flex align-items-center justify-content-between mb-3 pb-2"
          style={{ borderBottom:'1px solid var(--ct-border)' }}>
          <div className="d-flex align-items-center gap-2">
            <div className="ct-logo-icon" style={{ width:28, height:28, fontSize:14 }}>⛓</div>
            <span style={{ fontWeight:800, fontSize:'1rem', letterSpacing:'-0.02em' }}>
              Chain<span style={{ color:'var(--ct-accent)' }}>Track</span>
            </span>
          </div>
          <button onClick={onMobileClose} style={{
            background:'none', border:'none', padding:4,
            color:'var(--ct-text2)', cursor:'pointer', fontSize:'1.1rem',
          }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <SidebarContent
          activePage={activePage} onNavigate={onNavigate}
          isAdmin={isAdmin} actorRole={actorRole} stats={stats}
          onClose={onMobileClose}
        />
      </div>
    </>
  );
}
