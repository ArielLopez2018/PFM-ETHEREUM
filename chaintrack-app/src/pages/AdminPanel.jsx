import React, { useState } from 'react';
import { useWallet, ACTOR_ROLES } from '../context/WalletContext';
import { useApp } from '../context/BlockchainContext';

const EMPTY_ACTOR = { address: '', name: '', role: 1, location: '' };

export default function AdminPanel() {
  const { isAdmin, account } = useWallet();
  const {
    actors, shipments, stats, addToast,
    registerActor, updateActor, deactivateActor, reactivateActor,
  } = useApp();

  const [tab, setTab] = useState('actors');
  const [actorForm, setActorForm]   = useState(EMPTY_ACTOR);
  const [actorModal, setActorModal] = useState(false);
  const [editActor, setEditActor]   = useState(null);
  const [txLoading, setTxLoading]   = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  const STATUS_LABELS = ['Creado','En Transito','En Hub','En Reparto','Entregado','Devuelto','Cancelado'];
  const STATUS_CSS    = ['created','intransit','athub','outfordelivery','delivered','returned','cancelled'];

  if (!isAdmin) {
    return (
      <div className="ct-fade-in">
        <div className="alert alert-danger d-flex align-items-center gap-2 mt-3">
          <i className="bi bi-shield-lock-fill" />
          Acceso denegado. Solo el administrador puede acceder a este panel.
        </div>
      </div>
    );
  }

  const openActorModal = (actor = null) => {
    if (actor) {
      setActorForm({ address: actor.address, name: actor.name, role: actor.role, location: actor.location });
      setEditActor(actor);
    } else {
      setActorForm(EMPTY_ACTOR);
      setEditActor(null);
    }
    setActorModal(true);
  };

  const submitActor = async (e) => {
    e.preventDefault();
    if (!actorForm.address || !actorForm.name || !actorForm.location) {
      addToast('Completa todos los campos requeridos', 'error'); return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(actorForm.address)) {
      addToast('Direccion Ethereum invalida', 'error'); return;
    }
    setTxLoading(true);
    try {
      if (editActor) {
        await updateActor(actorForm.address, actorForm.name, parseInt(actorForm.role), actorForm.location);
        addToast(`Actor "${actorForm.name}" actualizado en blockchain`, 'success');
      } else {
        await registerActor(actorForm.address, actorForm.name, parseInt(actorForm.role), actorForm.location);
        addToast(`Actor "${actorForm.name}" registrado en blockchain`, 'success');
      }
      setActorModal(false);
      setActorForm(EMPTY_ACTOR);
      setEditActor(null);
    } catch {
      // error ya manejado por handleTxError en BlockchainContext
    } finally {
      setTxLoading(false);
    }
  };

  const handleDeactivate = async (actor) => {
    setTxLoading(true);
    try {
      await deactivateActor(actor.address);
      addToast(`Actor "${actor.name}" desactivado en blockchain`, 'warn');
      setConfirmDeactivate(null);
    } catch {} finally { setTxLoading(false); }
  };

  const handleReactivate = async (actor) => {
    setTxLoading(true);
    try {
      await reactivateActor(actor.address);
      addToast(`Actor "${actor.name}" reactivado en blockchain`, 'success');
    } catch {} finally { setTxLoading(false); }
  };

  return (
    <div className="ct-fade-in">
      {/* Header */}
      <div className="ct-page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-700 d-flex align-items-center gap-2">
            <i className="bi bi-shield-lock-fill" style={{ color: 'var(--ct-danger)' }} />
            Panel de <span style={{ color: 'var(--ct-accent)' }}>Administracion</span>
          </h4>
          <div className="ct-address">{account}</div>
        </div>
        <span className="badge px-3 py-2" style={{ background: 'var(--ct-danger-dim)', color: 'var(--ct-danger)', border: '1px solid rgba(255,77,106,0.3)', fontSize: '0.7rem' }}>
          ACCESO ADMIN · ANVIL LOCAL
        </span>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Actores Activos',  value: actors.filter(a => a.active).length, color: 'var(--ct-accent)' },
          { label: 'Envios Totales',   value: shipments.length,                    color: 'var(--ct-green)' },
          { label: 'Checkpoints',      value: stats.totalCheckpoints,              color: 'var(--ct-warn)' },
          { label: 'Incidencias Open', value: stats.incidents,                     color: 'var(--ct-danger)' },
        ].map((s, i) => (
          <div key={i} className="col-6 col-md-3">
            <div className="ct-stat-card" style={{ borderLeft: `3px solid ${s.color}` }}>
              <div className="ct-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="ct-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        {[
          { key: 'actors',   label: 'Actores',  icon: 'bi-people-fill',   count: actors.length },
          { key: 'shipments-admin', label: 'Envios', icon: 'bi-box-seam-fill', count: shipments.length },
        ].map(t => (
          <li key={t.key} className="nav-item">
            <button className={`nav-link d-flex align-items-center gap-2 ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              <i className={`bi ${t.icon}`} />{t.label}
              <span className="badge rounded-pill ms-1" style={{ background: 'var(--ct-surface3)', color: 'var(--ct-text2)', fontSize: '0.62rem' }}>{t.count}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* ACTORS TAB */}
      {tab === 'actors' && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <span className="fw-600">Gestion de Actores — Blockchain</span>
            <button className="btn btn-primary btn-sm d-flex align-items-center gap-2" onClick={() => openActorModal()}>
              <i className="bi bi-plus-lg" /> Nuevo Actor
            </button>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>Nombre</th><th>Direccion</th><th>Rol</th><th>Ubicacion</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {actors.map((actor, i) => {
                    const role = ACTOR_ROLES[actor.role];
                    return (
                      <tr key={i}>
                        <td>
                          <div className="fw-600" style={{ fontSize: '0.875rem' }}>{actor.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--ct-text3)' }}>
                            {new Date(actor.registeredAt).toLocaleDateString('es-ES')}
                          </div>
                        </td>
                        <td><span className="ct-address" style={{ fontSize: '0.7rem' }}>{actor.address.slice(0,10)}...{actor.address.slice(-6)}</span></td>
                        <td>
                          <span className={`ct-badge-role ${role?.key || 'none'}`}>
                            <i className={`bi ${role?.icon || 'bi-dash'} me-1`} />{role?.label || 'Sin rol'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--ct-text2)' }}>{actor.location}</td>
                        <td>
                          {actor.active
                            ? <span className="badge" style={{ background: 'var(--ct-green-dim)', color: 'var(--ct-green)', border: '1px solid rgba(0,214,143,0.3)' }}>Activo</span>
                            : <span className="badge" style={{ background: 'var(--ct-danger-dim)', color: 'var(--ct-danger)', border: '1px solid rgba(255,77,106,0.3)' }}>Inactivo</span>
                          }
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => openActorModal(actor)} title="Editar">
                              <i className="bi bi-pencil" />
                            </button>
                            {actor.active
                              ? <button className="btn btn-outline-danger btn-sm" onClick={() => setConfirmDeactivate(actor)} title="Desactivar">
                                  <i className="bi bi-person-x" />
                                </button>
                              : <button className="btn btn-outline-secondary btn-sm" onClick={() => handleReactivate(actor)} title="Reactivar" style={{ color: 'var(--ct-green)', borderColor: 'var(--ct-green)' }}>
                                  <i className="bi bi-person-check" />
                                </button>
                            }
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {actors.length === 0 && (
              <div className="ct-empty-state">
                <div className="icon">👥</div>
                <p>No hay actores registrados en la blockchain</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SHIPMENTS TAB */}
      {tab === 'shipments-admin' && (
        <div className="card">
          <div className="card-header"><span className="fw-600">Todos los Envios — Blockchain</span></div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>ID / TxHash</th><th>Ruta</th><th>Estado</th><th>Checkpoints</th><th>Incidencias</th></tr></thead>
                <tbody>
                  {shipments.map(s => {
                    const openInc = s.incidents?.filter(i => !i.resolved).length || 0;
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="ct-hash">#{s.id.toString().padStart(3,'0')}</span>
                          <div style={{ fontSize: '0.65rem', color: 'var(--ct-text3)', fontFamily: 'var(--ct-mono)', marginTop: 2 }}>
                            {s.sender?.slice(0,10)}...
                          </div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--ct-text2)' }}>
                          {s.origin?.split(',')[0]} <span style={{ color: 'var(--ct-accent)' }}>→</span> {s.destination?.split(',')[0]}
                        </td>
                        <td><span className={`ct-badge-status ${STATUS_CSS[s.status]}`}>{STATUS_LABELS[s.status]}</span></td>
                        <td><span className="badge" style={{ background: 'var(--ct-accent-dim)', color: 'var(--ct-accent)' }}>{s.checkpoints?.length || 0}</span></td>
                        <td>
                          {openInc > 0
                            ? <span className="badge" style={{ background: 'var(--ct-danger-dim)', color: 'var(--ct-danger)' }}>{openInc} abiertas</span>
                            : <span style={{ color: 'var(--ct-text3)', fontSize: '0.78rem' }}>-</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACTOR */}
      {actorModal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-person-plus-fill me-2" style={{ color: 'var(--ct-accent)' }} />
                  {editActor ? 'Editar Actor' : 'Registrar Actor en Blockchain'}
                </h5>
                <button className="btn-close" onClick={() => setActorModal(false)} disabled={txLoading} />
              </div>
              <form onSubmit={submitActor}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Direccion Ethereum *</label>
                    <input className="form-control" placeholder="0x..."
                      value={actorForm.address}
                      onChange={e => setActorForm(f => ({ ...f, address: e.target.value }))}
                      style={{ fontFamily: 'var(--ct-mono)', fontSize: '0.85rem' }}
                      disabled={!!editActor} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nombre / Empresa *</label>
                    <input className="form-control" placeholder="Ej: Lab FarmaTech S.A."
                      value={actorForm.name}
                      onChange={e => setActorForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Rol *</label>
                    <select className="form-select" value={actorForm.role}
                      onChange={e => setActorForm(f => ({ ...f, role: parseInt(e.target.value) }))}>
                      {Object.entries(ACTOR_ROLES).filter(([k]) => k !== '0').map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <div className="mt-2">
                      <span className={`ct-badge-role ${ACTOR_ROLES[actorForm.role]?.key}`}>
                        <i className={`bi ${ACTOR_ROLES[actorForm.role]?.icon} me-1`} />
                        {ACTOR_ROLES[actorForm.role]?.label}
                      </span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Ubicacion / Sede *</label>
                    <input className="form-control" placeholder="Ej: Madrid, Espana"
                      value={actorForm.location}
                      onChange={e => setActorForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div className="alert alert-info mb-0" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-link-45deg me-1" />
                    Se ejecutara <code>{editActor ? 'updateActor()' : 'registerActorFor()'}</code> en el contrato <code>ActorRegistry</code>. MetaMask pedira tu firma.
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setActorModal(false)} disabled={txLoading}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={txLoading}>
                    {txLoading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Esperando confirmacion...</>
                      : <><i className="bi bi-check-lg me-1" />{editActor ? 'Guardar cambios' : 'Registrar Actor'}</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DEACTIVATE */}
      {confirmDeactivate && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" style={{ color: 'var(--ct-danger)' }}>
                  <i className="bi bi-person-x-fill me-2" />Desactivar Actor
                </h5>
                <button className="btn-close" onClick={() => setConfirmDeactivate(null)} />
              </div>
              <div className="modal-body" style={{ fontSize: '0.875rem' }}>
                Desactivar a <strong>"{confirmDeactivate.name}"</strong> en la blockchain. Podra ser reactivado luego.
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setConfirmDeactivate(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={() => handleDeactivate(confirmDeactivate)} disabled={txLoading}>
                  {txLoading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-person-x me-1" />Desactivar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
