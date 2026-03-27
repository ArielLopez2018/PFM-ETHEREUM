import React from 'react';
import { useWallet, ACTOR_ROLES } from '../context/WalletContext';
import { useApp } from '../context/BlockchainContext';

const STATUS_LABELS = ['Creado','En Transito','En Hub','En Reparto','Entregado','Devuelto','Cancelado'];
const STATUS_CSS    = ['created','intransit','athub','outfordelivery','delivered','returned','cancelled'];

export default function Dashboard({ onNavigate }) {
  const { account, shortAddress, isAdmin, actorRole } = useWallet();
  const { stats, shipments, actors, loading, refreshAll } = useApp();

  const recentShipments = [...shipments].reverse().slice(0, 5);
  const openIncidents   = shipments.flatMap(s => (s.incidents || []).filter(i => !i.resolved));

  return (
    <div className="ct-fade-in">
      <div className="ct-page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-700">
            Dashboard <span style={{ color: 'var(--ct-accent)' }}>On-Chain</span>
          </h4>
          <div className="ct-address">
            {account} · {isAdmin ? 'Admin' : actorRole !== null ? ACTOR_ROLES[actorRole]?.label : 'Sin rol'}
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" onClick={refreshAll} disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-arrow-clockwise" />}
            Sincronizar
          </button>
          <div className="d-flex align-items-center gap-2">
            <span className="ct-pulse" />
            <span style={{ fontSize: '0.75rem', color: 'var(--ct-text2)', fontFamily: 'var(--ct-mono)' }}>
              Anvil Local
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Envios Totales',   value: stats.totalShipments,   variant: 'accent',  icon: 'bi-box-seam' },
          { label: 'Entregados',       value: stats.delivered,        variant: 'green',   icon: 'bi-check2-circle' },
          { label: 'En Transito',      value: stats.inTransit,        variant: 'warn',    icon: 'bi-truck' },
          { label: 'Incidencias',      value: stats.incidents,        variant: 'danger',  icon: 'bi-exclamation-triangle' },
          { label: 'Actores',          value: stats.totalActors,      variant: 'accent',  icon: 'bi-people' },
          { label: 'Checkpoints',      value: stats.totalCheckpoints, variant: 'green',   icon: 'bi-pin-map' },
          { label: 'Inc. Reportadas',  value: stats.totalIncidents,   variant: 'warn',    icon: 'bi-flag' },
          { label: 'Confirmados',      value: stats.delivered,        variant: 'green',   icon: 'bi-shield-check' },
        ].map((s, i) => (
          <div key={i} className="col-6 col-sm-4 col-xl-3">
            <div className={`ct-stat-card ${s.variant}`}>
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <div className="ct-stat-value" style={{ color: s.variant === 'accent' ? 'var(--ct-accent)' : s.variant === 'green' ? 'var(--ct-green)' : s.variant === 'warn' ? 'var(--ct-warn)' : 'var(--ct-danger)' }}>
                    {loading ? <span className="spinner-border spinner-border-sm" style={{ width:18, height:18 }} /> : s.value}
                  </div>
                  <div className="ct-stat-label">{s.label}</div>
                </div>
                <i className={`bi ${s.icon}`} style={{ fontSize: '1.4rem', opacity: 0.3, color: s.variant === 'accent' ? 'var(--ct-accent)' : s.variant === 'green' ? 'var(--ct-green)' : s.variant === 'warn' ? 'var(--ct-warn)' : 'var(--ct-danger)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        {/* Recent Shipments */}
        <div className="col-12 col-xl-8">
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span className="fw-600 d-flex align-items-center gap-2">
                <i className="bi bi-box-seam" style={{ color: 'var(--ct-accent)' }} />Envios Recientes
              </span>
              <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('shipments')}>
                Ver todos <i className="bi bi-arrow-right ms-1" />
              </button>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead><tr><th>ID</th><th>Origen → Destino</th><th>Estado</th><th>Cold</th><th>Checkpoints</th></tr></thead>
                  <tbody>
                    {recentShipments.map(s => (
                      <tr key={s.id} style={{ cursor:'pointer' }} onClick={() => onNavigate('tracking', s.id)}>
                        <td><span className="ct-hash">#{s.id.toString().padStart(3,'0')}</span></td>
                        <td style={{ fontSize:'0.8rem', color:'var(--ct-text2)' }}>
                          {s.origin?.split(',')[0]} <span style={{ color:'var(--ct-accent)' }}>→</span> {s.destination?.split(',')[0]}
                        </td>
                        <td><span className={`ct-badge-status ${STATUS_CSS[s.status]}`}>{STATUS_LABELS[s.status]}</span></td>
                        <td>{s.requiresColdChain ? <span style={{ color:'#7dd3fc', fontSize:'0.8rem' }}>❄</span> : <span style={{ color:'var(--ct-text3)' }}>-</span>}</td>
                        <td><span className="badge" style={{ background:'var(--ct-accent-dim)', color:'var(--ct-accent)' }}>{s.checkpoints?.length || 0}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recentShipments.length === 0 && !loading && (
                <div className="ct-empty-state"><div className="icon">📦</div><p>No hay envios en la blockchain</p></div>
              )}
              {loading && (
                <div className="text-center p-4" style={{ color:'var(--ct-text3)' }}>
                  <span className="spinner-border spinner-border-sm me-2" style={{ color:'var(--ct-accent)' }} />
                  Leyendo desde la blockchain...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side panels */}
        <div className="col-12 col-xl-4 d-flex flex-column gap-3">
          {/* Open Incidents */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span className="fw-600 d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle" style={{ color:'var(--ct-danger)' }} />Incidencias Abiertas
              </span>
              <span className="badge" style={{ background:'var(--ct-danger-dim)', color:'var(--ct-danger)', border:'1px solid rgba(255,77,106,0.3)' }}>{openIncidents.length}</span>
            </div>
            <div className="card-body p-0">
              {openIncidents.length === 0 ? (
                <div className="ct-empty-state" style={{ padding:'1.5rem' }}>
                  <div className="icon" style={{ fontSize:'1.5rem' }}>✅</div>
                  <p style={{ fontSize:'0.8rem' }}>Sin incidencias activas</p>
                </div>
              ) : (
                <div style={{ maxHeight:200, overflowY:'auto' }}>
                  {openIncidents.map((inc, idx) => (
                    <div key={idx} className="px-3 py-2" style={{ borderBottom:'1px solid var(--ct-border)', fontSize:'0.8rem' }}>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <i className="bi bi-exclamation-circle-fill" style={{ color:'var(--ct-danger)' }} />
                        <span className="fw-600">{['Retraso','Dano','Perdido','Temp.','No Autorizad','Aduana','Otro'][inc.type] || 'Incidencia'}</span>
                        <span className="badge" style={{ fontSize:'0.58rem', background:['','var(--ct-warn-dim)','rgba(255,170,0,0.15)','var(--ct-danger-dim)'][inc.severity] || '', color:['','var(--ct-warn)','var(--ct-warn)','var(--ct-danger)'][inc.severity] || 'var(--ct-text2)' }}>
                          {['Baja','Media','Alta','Critica'][inc.severity]}
                        </span>
                      </div>
                      <div style={{ color:'var(--ct-text2)', fontSize:'0.72rem' }}>{inc.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actors */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span className="fw-600 d-flex align-items-center gap-2">
                <i className="bi bi-people" style={{ color:'var(--ct-accent)' }} />Actores Registrados
              </span>
              <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('actors')}>
                Ver <i className="bi bi-arrow-right ms-1" />
              </button>
            </div>
            <div className="card-body p-0">
              {actors.slice(0, 4).map((a, idx) => {
                const role = ACTOR_ROLES[a.role];
                return (
                  <div key={idx} className="d-flex align-items-center gap-2 px-3 py-2" style={{ borderBottom:'1px solid var(--ct-border)', fontSize:'0.8rem' }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:'var(--ct-surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>
                      <i className={`bi ${role?.icon || 'bi-person'}`} style={{ color:'var(--ct-accent)' }} />
                    </div>
                    <div className="flex-grow-1 min-width-0">
                      <div className="fw-600 text-truncate">{a.name}</div>
                      <div className="ct-address" style={{ fontSize:'0.65rem' }}>{a.address?.slice(0,10)}...{a.address?.slice(-4)}</div>
                    </div>
                    <span className={`ct-badge-role ${role?.key || 'none'}`}>{role?.label || '-'}</span>
                  </div>
                );
              })}
              {actors.length === 0 && !loading && (
                <div className="ct-empty-state" style={{ padding:'1.5rem' }}>
                  <div className="icon" style={{ fontSize:'1.5rem' }}>👥</div>
                  <p style={{ fontSize:'0.8rem' }}>Sin actores en la blockchain</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
