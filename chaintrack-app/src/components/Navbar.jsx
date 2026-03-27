import React from 'react';
import { useWallet, ACTOR_ROLES } from '../context/WalletContext';
import { useApp } from '../context/BlockchainContext';

export default function Navbar({ activePage, onNavigate, onMobileMenuToggle }) {
  const { account, shortAddress, networkName, chainId, isAdmin, actorRole, logout } = useWallet();
  const { stats } = useApp();
  const roleInfo = actorRole !== null ? ACTOR_ROLES[actorRole] : null;

  return (
    <nav className="navbar navbar-expand-lg sticky-top" style={{ zIndex: 1000 }}>
      <div className="container-fluid gap-2">

        {/* Hamburger — solo en mobile */}
        <button
          onClick={onMobileMenuToggle}
          className="d-flex d-lg-none align-items-center justify-content-center"
          style={{
            background: 'var(--ct-surface2)', border: '1px solid var(--ct-border2)',
            borderRadius: 8, width: 36, height: 36,
            color: 'var(--ct-text)', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <i className="bi bi-list" style={{ fontSize: '1.3rem' }} />
        </button>

        {/* Brand */}
        <button className="navbar-brand border-0 bg-transparent p-0" onClick={() => onNavigate('dashboard')}>
          <div className="ct-logo-icon" style={{ width: 28, height: 28, fontSize: 14 }}>⛓</div>
          <span>Chain<span style={{ color: 'var(--ct-accent)' }}>Track</span></span>
        </button>

        {/* Network badge */}
        <span
          className="d-flex align-items-center gap-1 px-2 py-1 rounded ms-1"
          style={{
            background: chainId === 31337 ? 'rgba(0,214,143,0.1)' : 'rgba(0,229,255,0.08)',
            border: `1px solid ${chainId === 31337 ? 'rgba(0,214,143,0.2)' : 'rgba(0,229,255,0.15)'}`,
            fontSize: '0.62rem', fontFamily: 'var(--ct-mono)', whiteSpace: 'nowrap',
            color: chainId === 31337 ? 'var(--ct-green)' : 'var(--ct-accent)',
          }}
        >
          <span className="ct-pulse" style={{
            background: chainId === 31337 ? 'var(--ct-green)' : 'var(--ct-accent)',
            boxShadow: `0 0 5px ${chainId === 31337 ? 'var(--ct-green)' : 'var(--ct-accent)'}`,
          }} />
          <span className="d-none d-sm-inline">{networkName}</span>
        </span>

        {/* Nav links + wallet — desktop */}
        <div className="collapse navbar-collapse">
          <ul className="navbar-nav ms-auto me-3 d-flex flex-row gap-1">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2' },
              { key: 'shipments', label: 'Envíos',     icon: 'bi-box-seam' },
              { key: 'tracking',  label: 'Tracking',   icon: 'bi-geo-alt'  },
            ].map(item => (
              <li key={item.key} className="nav-item">
                <button
                  className={`nav-link border-0 bg-transparent d-flex align-items-center gap-1 ${activePage === item.key ? 'active' : ''}`}
                  onClick={() => onNavigate(item.key)}
                >
                  <i className={`bi ${item.icon}`} />{item.label}
                </button>
              </li>
            ))}
            {isAdmin && (
              <li className="nav-item">
                <button
                  className={`nav-link border-0 bg-transparent d-flex align-items-center gap-1 ${activePage === 'admin' ? 'active' : ''}`}
                  onClick={() => onNavigate('admin')}
                >
                  <i className="bi bi-shield-lock" />Admin
                  <span className="badge ms-1" style={{ background:'rgba(255,77,106,0.2)', color:'var(--ct-danger)', fontSize:'0.58rem', border:'1px solid rgba(255,77,106,0.3)' }}>ADMIN</span>
                </button>
              </li>
            )}
          </ul>
          <div className="dropdown">
            <button
              className="btn btn-sm d-flex align-items-center gap-2 dropdown-toggle"
              data-bs-toggle="dropdown"
              style={{ background:'var(--ct-surface2)', border:'1px solid var(--ct-border2)', color:'var(--ct-text)', borderRadius:8, padding:'6px 12px', fontSize:'0.82rem' }}
            >
              <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg, var(--ct-accent), var(--ct-accent2))', flexShrink:0 }} />
              <span className="ct-address" style={{ fontSize:'0.78rem' }}>{shortAddress}</span>
              {isAdmin && <i className="bi bi-shield-lock-fill" style={{ color:'var(--ct-danger)', fontSize:'0.7rem' }} />}
              {roleInfo && <span className={`ct-badge-role ${roleInfo.key}`} style={{ padding:'1px 6px' }}>{roleInfo.label}</span>}
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li><div className="px-3 py-2" style={{ fontSize:'0.75rem' }}>
                <div style={{ color:'var(--ct-text2)', marginBottom:2 }}>Conectado como</div>
                <div className="ct-address" style={{ fontSize:'0.7rem', wordBreak:'break-all' }}>{account}</div>
              </div></li>
              <li><hr className="dropdown-divider" /></li>
              {isAdmin && <li><button className="dropdown-item d-flex align-items-center gap-2" onClick={() => onNavigate('admin')}><i className="bi bi-shield-lock" />Panel Admin</button></li>}
              <li><button className="dropdown-item d-flex align-items-center gap-2" onClick={() => onNavigate('profile')}><i className="bi bi-person-badge" />Mi Perfil</button></li>
              <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item d-flex align-items-center gap-2" style={{ color:'var(--ct-danger)' }} onClick={logout}><i className="bi bi-box-arrow-right" />Desconectar Wallet</button></li>
            </ul>
          </div>
        </div>

        {/* Wallet mini — mobile (fuera del collapse) */}
        <div className="d-flex d-lg-none align-items-center ms-auto">
          <div className="dropdown">
            <button
              className="btn btn-sm d-flex align-items-center gap-1 dropdown-toggle"
              data-bs-toggle="dropdown"
              style={{ background:'var(--ct-surface2)', border:'1px solid var(--ct-border2)', color:'var(--ct-text)', borderRadius:8, padding:'5px 8px', fontSize:'0.75rem' }}
            >
              <div style={{ width:18, height:18, borderRadius:'50%', background:'linear-gradient(135deg, var(--ct-accent), var(--ct-accent2))', flexShrink:0 }} />
              <span className="ct-address" style={{ fontSize:'0.72rem' }}>{shortAddress}</span>
              {isAdmin && <i className="bi bi-shield-lock-fill" style={{ color:'var(--ct-danger)', fontSize:'0.65rem' }} />}
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li><div className="px-3 py-2" style={{ fontSize:'0.75rem' }}>
                <div style={{ color:'var(--ct-text2)', marginBottom:2 }}>Conectado como</div>
                <div className="ct-address" style={{ fontSize:'0.65rem', wordBreak:'break-all' }}>{account}</div>
              </div></li>
              <li><hr className="dropdown-divider" /></li>
              {isAdmin && <li><button className="dropdown-item d-flex align-items-center gap-2" onClick={() => onNavigate('admin')}><i className="bi bi-shield-lock" />Admin Panel</button></li>}
              <li><button className="dropdown-item d-flex align-items-center gap-2" onClick={() => onNavigate('profile')}><i className="bi bi-person-badge" />Mi Perfil</button></li>
              <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item d-flex align-items-center gap-2" style={{ color:'var(--ct-danger)' }} onClick={logout}><i className="bi bi-box-arrow-right" />Desconectar</button></li>
            </ul>
          </div>
        </div>

      </div>
    </nav>
  );
}
