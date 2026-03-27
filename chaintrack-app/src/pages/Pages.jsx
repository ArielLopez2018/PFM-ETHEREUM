import React, { useState } from 'react';
import { useWallet, ACTOR_ROLES } from '../context/WalletContext';
import { useApp } from '../context/BlockchainContext';

const STATUS_LABELS = ['Creado','En Transito','En Hub','En Reparto','Entregado','Devuelto','Cancelado'];
const STATUS_CSS    = ['created','intransit','athub','outfordelivery','delivered','returned','cancelled'];
const INCIDENT_TYPES = ['Retraso','Dano Fisico','Perdido','Violacion Temp.','No Autorizado','Retencion Aduana','Otro'];
const CHECKPOINT_TYPES = ['Pickup','Hub','Transit','OutForDelivery','Delivery','Return','CustomsCheck','QualityInspection'];
const SECTORS = ['Farmaceutico','Alimentario','Electronica','Lujo','Industrial','Otro'];

function fmtDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtTemp(t) {
  if (t === null || t === undefined) return null;
  return (t / 10).toFixed(1) + 'C';
}

// ════════════════════════════════════════════════════════════
//  SHIPMENTS PAGE
// ════════════════════════════════════════════════════════════
export function ShipmentsPage({ onNavigate }) {
  const { account } = useWallet();
  const { shipments, addToast, createShipment } = useApp();

  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [form, setForm] = useState({
    recipient: '', product: '', origin: '', destination: '',
    requiresColdChain: false, minTemp: 20, maxTemp: 80,
  });

  const filtered = shipments.filter(s => {
    const matchFilter = filter === 'all' || STATUS_CSS[s.status] === filter;
    const matchSearch = !search
      || s.origin?.toLowerCase().includes(search.toLowerCase())
      || s.destination?.toLowerCase().includes(search.toLowerCase())
      || s.sender?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.recipient || !form.product || !form.origin || !form.destination) {
      addToast('Completa todos los campos requeridos', 'error'); return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.recipient)) {
      addToast('Direccion de destinatario invalida', 'error'); return;
    }
    if (form.requiresColdChain && form.minTemp >= form.maxTemp) {
      addToast('Rango de temperatura invalido (min debe ser < max)', 'error'); return;
    }
    setTxLoading(true);
    try {
      const { shipmentId } = await createShipment({
        recipient:         form.recipient,
        product:           form.product,
        origin:            form.origin,
        destination:       form.destination,
        requiresColdChain: form.requiresColdChain,
        minTemp:           form.requiresColdChain ? form.minTemp : 0,
        maxTemp:           form.requiresColdChain ? form.maxTemp : 0,
      });
      addToast(`Envio #${shipmentId} creado en blockchain`, 'success');
      setModal(false);
      setForm({ recipient:'', product:'', origin:'', destination:'', requiresColdChain:false, minTemp:20, maxTemp:80 });
    } catch {
      // manejado por BlockchainContext
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <div className="ct-fade-in">
      <div className="ct-page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h4 className="mb-0 fw-700">Envios <span style={{ color:'var(--ct-accent)' }}>Blockchain</span></h4>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setModal(true)}>
          <i className="bi bi-plus-lg" /> Nuevo Envio
        </button>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <div className="position-relative">
          <i className="bi bi-search position-absolute" style={{ left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ct-text3)', fontSize:'0.85rem' }} />
          <input className="form-control" style={{ paddingLeft:32, width:220 }}
            placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all','created','intransit','athub','delivered'].map(f => (
          <button key={f} className={`btn btn-sm ${filter===f ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setFilter(f)}>
            {f==='all' ? 'Todos' : STATUS_LABELS[STATUS_CSS.indexOf(f)]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead><tr><th>ID</th><th>Origen / Destino</th><th>Sender</th><th>Estado</th><th>Cold</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} style={{ cursor:'pointer' }} onClick={() => onNavigate('tracking', s.id)}>
                    <td><span className="ct-hash">#{s.id.toString().padStart(3,'0')}</span></td>
                    <td>
                      <div className="fw-600" style={{ fontSize:'0.82rem' }}>{s.product || '—'}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--ct-text2)' }}>{s.origin?.split(',')[0]} → {s.destination?.split(',')[0]}</div>
                    </td>
                    <td><span className="ct-address" style={{ fontSize:'0.68rem' }}>{s.sender?.slice(0,8)}...</span></td>
                    <td><span className={`ct-badge-status ${STATUS_CSS[s.status]}`}>{STATUS_LABELS[s.status]}</span></td>
                    <td>{s.requiresColdChain ? <span style={{ color:'#7dd3fc', fontSize:'0.8rem' }}>❄</span> : '-'}</td>
                    <td style={{ fontSize:'0.75rem', color:'var(--ct-text2)' }}>{fmtDate(s.createdAt)?.split(',')[0]}</td>
                    <td><i className="bi bi-chevron-right" style={{ color:'var(--ct-text3)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="ct-empty-state"><div className="icon">📦</div><p>No se encontraron envios</p></div>}
        </div>
      </div>

      {modal && (
        <div className="modal show d-block" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-box-seam-fill me-2" style={{ color:'var(--ct-accent)' }} />Nuevo Envio — Blockchain</h5>
                <button className="btn-close" onClick={() => setModal(false)} disabled={txLoading} />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Direccion Destinatario (ETH) *</label>
                      <input className="form-control" placeholder="0x..." style={{ fontFamily:'var(--ct-mono)', fontSize:'0.85rem' }}
                        value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Producto / Descripción *</label>
                      <input className="form-control" placeholder="Ej: Insulina Refrigerada"
                        value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Origen *</label>
                      <input className="form-control" placeholder="Ej: Lab FarmaTech, Madrid"
                        value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Destino *</label>
                      <input className="form-control" placeholder="Ej: Hospital Central, Barcelona"
                        value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <div className="p-3 rounded" style={{ background:'var(--ct-surface2)', border:'1px solid var(--ct-border)' }}>
                        <div className="d-flex align-items-center gap-3 mb-3">
                          <div className="form-check form-switch mb-0">
                            <input className="form-check-input" type="checkbox" role="switch"
                              checked={form.requiresColdChain}
                              onChange={e => setForm(f => ({ ...f, requiresColdChain: e.target.checked }))} />
                          </div>
                          <label className="form-label mb-0">❄ Requiere Cadena de Frio</label>
                        </div>
                        {form.requiresColdChain && (
                          <div className="row g-3">
                            <div className="col-md-6">
                              <label className="form-label">Temp. Minima (x10) <span style={{ color:'var(--ct-text3)', fontWeight:400, fontSize:'0.72rem' }}>Ej: 20 = 2.0C</span></label>
                              <input type="number" className="form-control" value={form.minTemp}
                                onChange={e => setForm(f => ({ ...f, minTemp: parseInt(e.target.value)||0 }))} />
                              <div style={{ fontSize:'0.7rem', color:'var(--ct-accent)', marginTop:3 }}>= {(form.minTemp/10).toFixed(1)}C</div>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">Temp. Maxima (x10)</label>
                              <input type="number" className="form-control" value={form.maxTemp}
                                onChange={e => setForm(f => ({ ...f, maxTemp: parseInt(e.target.value)||0 }))} />
                              <div style={{ fontSize:'0.7rem', color:'var(--ct-accent)', marginTop:3 }}>= {(form.maxTemp/10).toFixed(1)}C</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="alert alert-info mb-0" style={{ fontSize:'0.78rem' }}>
                        <i className="bi bi-link-45deg me-1" />
                        Se ejecutara <code>createShipment()</code> en <code>ShipmentManager</code>. MetaMask pedira tu firma.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setModal(false)} disabled={txLoading}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={txLoading}>
                    {txLoading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Confirmando...</>
                      : <><i className="bi bi-check-lg me-1" />Crear Envio</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  TRACKING PAGE
// ════════════════════════════════════════════════════════════
export function TrackingPage({ selectedId }) {
  const { account } = useWallet();
  const { shipments, addToast, recordCheckpoint, reportIncident, resolveIncident, confirmDelivery, updateShipmentStatus } = useApp();

  const [activeId, setActiveId] = useState(selectedId || shipments[0]?.id);
  const [cpModal, setCpModal]   = useState(false);
  const [incModal, setIncModal] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [cpForm, setCpForm]     = useState({ type:'Pickup', location:'', notes:'', temp:0 });
  const [incForm, setIncForm]   = useState({ type:0, severity:1, description:'' });

  const shipment = shipments.find(s => s.id === activeId);

  const submitCheckpoint = async (e) => {
    e.preventDefault();
    if (!cpForm.location) { addToast('La ubicacion es requerida', 'error'); return; }
    setTxLoading(true);
    try {
      await recordCheckpoint(activeId, {
        location:    cpForm.location,
        type:        cpForm.type,
        temperature: shipment?.requiresColdChain ? cpForm.temp : 0,
        notes:       cpForm.notes,
      });
      addToast('Checkpoint registrado en blockchain', 'success');
      setCpModal(false);
      setCpForm({ type:'Pickup', location:'', notes:'', temp:0 });
    } catch {} finally { setTxLoading(false); }
  };

  const submitIncident = async (e) => {
    e.preventDefault();
    if (!incForm.description) { addToast('La descripcion es requerida', 'error'); return; }
    setTxLoading(true);
    try {
      await reportIncident(activeId, { type: incForm.type, severity: incForm.severity, description: incForm.description });
      addToast('Incidencia reportada en blockchain', incForm.severity >= 3 ? 'error' : 'warn');
      setIncModal(false);
      setIncForm({ type:0, severity:1, description:'' });
    } catch {} finally { setTxLoading(false); }
  };

  const handleConfirmDelivery = async () => {
    setTxLoading(true);
    try {
      await confirmDelivery(activeId);
      addToast('Entrega confirmada en blockchain', 'success');
    } catch {} finally { setTxLoading(false); }
  };

  const handleResolveIncident = async (inc) => {
    setTxLoading(true);
    try {
      await resolveIncident(inc.id, 'Resuelto por operador', activeId);
      addToast('Incidencia resuelta en blockchain', 'success');
    } catch {} finally { setTxLoading(false); }
  };

  const dotClass = (type, violation) => {
    if (violation) return 'alert';
    if (type === 'Delivery') return 'ok';
    if (type === 'Hub') return 'hub';
    return 'transit';
  };

  return (
    <div className="ct-fade-in">
      <div className="ct-page-header">
        <h4 className="mb-0 fw-700">Tracking <span style={{ color:'var(--ct-accent)' }}>On-Chain</span></h4>
      </div>
      <div className="row g-3">
        {/* Selector */}
        <div className="col-12 col-md-3">
          <div className="card">
            <div className="card-header fw-600" style={{ fontSize:'0.82rem' }}>Seleccionar Envio</div>
            <div className="card-body p-0">
              {shipments.map(s => (
                <button key={s.id} className="w-100 text-start border-0 px-3 py-2"
                  style={{
                    background: activeId===s.id ? 'var(--ct-accent-dim)' : 'transparent',
                    borderLeft: activeId===s.id ? '3px solid var(--ct-accent)' : '3px solid transparent',
                    color: activeId===s.id ? 'var(--ct-accent)' : 'var(--ct-text2)',
                    fontSize:'0.82rem', cursor:'pointer', borderBottom:'1px solid var(--ct-border)',
                  }}
                  onClick={() => setActiveId(s.id)}>
                  <div className="fw-600">#{s.id.toString().padStart(3,'0')} Envio</div>
                  <div style={{ fontSize:'0.7rem', marginTop:1 }}>{s.origin?.split(',')[0]} → {s.destination?.split(',')[0]}</div>
                  <span className={`ct-badge-status ${STATUS_CSS[s.status]}`} style={{ fontSize:'0.58rem' }}>{STATUS_LABELS[s.status]}</span>
                </button>
              ))}
              {shipments.length === 0 && <div className="ct-empty-state" style={{ padding:'1.5rem' }}><p style={{ fontSize:'0.8rem' }}>Sin envios</p></div>}
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="col-12 col-md-9">
          {!shipment ? (
            <div className="ct-empty-state card"><div className="icon">🔍</div><p>Selecciona un envio</p></div>
          ) : (
            <>
              {/* Hero */}
              <div className="card mb-3">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                    <div>
                      <div className="ct-address" style={{ marginBottom:4 }}>
                        Sender: {shipment.sender?.slice(0,10)}...{shipment.sender?.slice(-6)}
                      </div>
                      <h5 className="fw-700 mb-2">Envio #{shipment.id.toString().padStart(3,'0')}</h5>
                      <div className="d-flex gap-2 flex-wrap">
                        {shipment.requiresColdChain && <span style={{ color:'#7dd3fc', fontSize:'0.78rem' }}>❄ Cold Chain</span>}
                        <span className="badge" style={{ background:'var(--ct-green-dim)', color:'var(--ct-green)', border:'1px solid rgba(0,214,143,0.2)' }}>✓ On-Chain</span>
                      </div>
                    </div>
                    <span className={`ct-badge-status ${STATUS_CSS[shipment.status]}`} style={{ fontSize:'0.7rem', padding:'4px 12px' }}>{STATUS_LABELS[shipment.status]}</span>
                  </div>

                  {/* Ruta */}
                  <div className="d-flex align-items-center p-2 rounded gap-2 mb-3" style={{ background:'var(--ct-surface2)', border:'1px solid var(--ct-border)' }}>
                    <div className="text-center flex-fill">
                      <div style={{ fontSize:'0.62rem', color:'var(--ct-text3)', fontFamily:'var(--ct-mono)', textTransform:'uppercase' }}>Origen</div>
                      <div className="fw-600" style={{ fontSize:'0.82rem' }}>{shipment.origin?.split(',')[0]}</div>
                    </div>
                    <div style={{ color:'var(--ct-accent)', fontSize:'1.2rem' }}>→</div>
                    <div className="text-center flex-fill">
                      <div style={{ fontSize:'0.62rem', color:'var(--ct-text3)', fontFamily:'var(--ct-mono)', textTransform:'uppercase' }}>Destino</div>
                      <div className="fw-600" style={{ fontSize:'0.82rem' }}>{shipment.destination?.split(',')[0]}</div>
                    </div>
                  </div>

                  {shipment.requiresColdChain && (
                    <div className="mb-3 p-2 rounded d-flex align-items-center gap-2" style={{ background:'rgba(125,211,252,0.06)', border:'1px solid rgba(125,211,252,0.2)', fontSize:'0.78rem' }}>
                      <span style={{ color:'#7dd3fc' }}>❄ Rango: {fmtTemp(shipment.minTemp)} – {fmtTemp(shipment.maxTemp)}</span>
                      {shipment.coldChainOk === false
                        ? <span style={{ color:'var(--ct-danger)' }}>⚠ {shipment.tempViolations} violaciones</span>
                        : <span style={{ color:'var(--ct-green)' }}>✓ Cumplimiento OK</span>
                      }
                    </div>
                  )}

                  {/* Progress */}
                  <div className="mb-3">
                    <div style={{ height:6, background:'var(--ct-border)', borderRadius:6, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:6, background:'linear-gradient(90deg, var(--ct-accent2), var(--ct-accent))', width:`${[0,14,28,60,100,50,0][shipment.status] || 0}%`, transition:'width 0.8s ease' }} />
                    </div>
                  </div>

                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-outline-primary btn-sm" onClick={() => setCpModal(true)} disabled={txLoading}>
                      <i className="bi bi-pin-map me-1" />Checkpoint
                    </button>
                    <button className="btn btn-sm" style={{ borderColor:'var(--ct-warn)', color:'var(--ct-warn)', background:'transparent' }}
                      onClick={() => setIncModal(true)} disabled={txLoading}>
                      <i className="bi bi-exclamation-triangle me-1" />Incidencia
                    </button>
                    {shipment.status !== 4 && (
                      <button className="btn btn-success btn-sm" onClick={handleConfirmDelivery} disabled={txLoading}>
                        {txLoading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check2-circle me-1" />Confirmar Entrega</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="card">
                <div className="card-header fw-600 d-flex align-items-center justify-content-between">
                  <span><i className="bi bi-clock-history me-2" style={{ color:'var(--ct-accent)' }} />Historial On-Chain</span>
                  <span className="badge" style={{ background:'var(--ct-accent-dim)', color:'var(--ct-accent)', border:'1px solid rgba(0,229,255,0.2)' }}>
                    {shipment.checkpoints?.length || 0} checkpoints
                  </span>
                </div>
                <div className="card-body">
                  {(!shipment.checkpoints || shipment.checkpoints.length === 0) ? (
                    <div className="ct-empty-state" style={{ padding:'1.5rem' }}><div className="icon" style={{ fontSize:'1.5rem' }}>📍</div><p>Sin checkpoints registrados</p></div>
                  ) : (
                    <div style={{ position:'relative' }}>
                      <div style={{ position:'absolute', left:8, top:0, bottom:0, width:1, background:'linear-gradient(to bottom, var(--ct-accent), transparent)', opacity:0.25 }} />
                      {shipment.checkpoints.map((cp, i) => (
                        <div key={cp.id || i} className="d-flex gap-3 mb-3" style={{ paddingLeft:4 }}>
                          <div style={{ flexShrink:0 }}>
                            <div className={`ct-timeline-dot ${dotClass(cp.type, cp.tempViolation)}`}>
                              {cp.tempViolation ? '!' : cp.type==='Delivery' ? '✓' : cp.type==='Hub' ? '⬡' : '↑'}
                            </div>
                          </div>
                          <div className="flex-grow-1" style={{ paddingBottom: i < shipment.checkpoints.length-1 ? '0.75rem' : 0, borderBottom: i < shipment.checkpoints.length-1 ? '1px solid var(--ct-border)' : 'none' }}>
                            <div className="d-flex justify-content-between align-items-start flex-wrap gap-1 mb-1">
                              <div className="fw-600" style={{ fontSize:'0.875rem' }}>{cp.type}</div>
                              <div style={{ fontSize:'0.65rem', color:'var(--ct-text3)', fontFamily:'var(--ct-mono)' }}>{fmtDate(cp.timestamp)}</div>
                            </div>
                            <div style={{ fontSize:'0.78rem', color:'var(--ct-text2)', marginBottom:2 }}>
                              <i className="bi bi-geo-alt me-1" style={{ color:'var(--ct-text3)' }} />{cp.location}
                            </div>
                            <div style={{ fontSize:'0.7rem', color:'var(--ct-accent2)', marginBottom:4 }}>
                              <i className="bi bi-person me-1" />{cp.actor?.slice(0,10)}...{cp.actor?.slice(-4)}
                            </div>
                            {cp.temperature !== 0 && (
                              <span style={{ fontSize:'0.68rem', color: cp.tempViolation ? 'var(--ct-danger)' : '#7dd3fc', background: cp.tempViolation ? 'var(--ct-danger-dim)' : 'rgba(125,211,252,0.08)', border:`1px solid ${cp.tempViolation ? 'rgba(255,77,106,0.3)' : 'rgba(125,211,252,0.2)'}`, padding:'1px 7px', borderRadius:4 }}>
                                🌡 {fmtTemp(cp.temperature)} {cp.tempViolation && '⚠ VIOLACION'}
                              </span>
                            )}
                            {cp.notes && <div style={{ fontSize:'0.72rem', color:'var(--ct-text3)', marginTop:4 }}>{cp.notes}</div>}
                            <div style={{ fontSize:'0.62rem', color:'var(--ct-text3)', fontFamily:'var(--ct-mono)', marginTop:4 }}>
                              Hash: {cp.dataHash?.slice(0,16)}...
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Incidents */}
                  {shipment.incidents?.length > 0 && (
                    <div className="mt-3">
                      <div style={{ fontSize:'0.72rem', color:'var(--ct-text3)', fontFamily:'var(--ct-mono)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'0.75rem' }}>Incidencias</div>
                      {shipment.incidents.map((inc, i) => (
                        <div key={inc.id || i} className="p-3 rounded mb-2" style={{ background:'rgba(255,77,106,0.05)', border:'1px solid rgba(255,77,106,0.2)' }}>
                          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
                            <div className="d-flex align-items-center gap-2">
                              <i className="bi bi-exclamation-triangle-fill" style={{ color:'var(--ct-danger)' }} />
                              <span className="fw-600" style={{ fontSize:'0.82rem' }}>{INCIDENT_TYPES[inc.type] || 'Incidencia'}</span>
                              <span className="badge" style={{ background:['var(--ct-green-dim)','var(--ct-warn-dim)','rgba(255,170,0,0.15)','var(--ct-danger-dim)'][inc.severity], color:['var(--ct-green)','var(--ct-warn)','var(--ct-warn)','var(--ct-danger)'][inc.severity], fontSize:'0.6rem' }}>
                                {['Baja','Media','Alta','Critica'][inc.severity]}
                              </span>
                            </div>
                            {!inc.resolved && (
                              <button className="btn btn-outline-secondary btn-sm" style={{ fontSize:'0.7rem', padding:'2px 8px' }}
                                onClick={() => handleResolveIncident(inc)} disabled={txLoading}>
                                {txLoading ? <span className="spinner-border spinner-border-sm" style={{ width:10, height:10 }} /> : 'Resolver'}
                              </button>
                            )}
                            {inc.resolved && <span style={{ fontSize:'0.7rem', color:'var(--ct-green)' }}>✓ Resuelta</span>}
                          </div>
                          <div style={{ fontSize:'0.78rem', color:'var(--ct-text2)' }}>{inc.description}</div>
                          {inc.resolution && <div style={{ fontSize:'0.72rem', color:'var(--ct-green)', marginTop:4 }}>Resolucion: {inc.resolution}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Checkpoint modal */}
      {cpModal && (
        <div className="modal show d-block" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-pin-map-fill me-2" style={{ color:'var(--ct-accent)' }} />Nuevo Checkpoint — Blockchain</h5>
                <button className="btn-close" onClick={() => setCpModal(false)} disabled={txLoading} />
              </div>
              <form onSubmit={submitCheckpoint}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" value={cpForm.type} onChange={e => setCpForm(f => ({ ...f, type: e.target.value }))}>
                      {CHECKPOINT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Ubicacion *</label>
                    <input className="form-control" placeholder="Ej: Hub Madrid-Sur"
                      value={cpForm.location} onChange={e => setCpForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  {shipment?.requiresColdChain && (
                    <div className="mb-3">
                      <label className="form-label">Temperatura (x10) <span style={{ color:'#7dd3fc', fontSize:'0.75rem' }}>❄ Rango: {fmtTemp(shipment.minTemp)} – {fmtTemp(shipment.maxTemp)}</span></label>
                      <input type="number" className="form-control" value={cpForm.temp}
                        onChange={e => setCpForm(f => ({ ...f, temp: parseInt(e.target.value)||0 }))} />
                      <div style={{ fontSize:'0.7rem', color:'var(--ct-accent)', marginTop:3 }}>= {(cpForm.temp/10).toFixed(1)}C</div>
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label">Notas</label>
                    <textarea className="form-control" rows={2} value={cpForm.notes}
                      onChange={e => setCpForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <div className="alert alert-info mb-0" style={{ fontSize:'0.75rem' }}>
                    <i className="bi bi-link-45deg me-1" />
                    Llama a <code>recordCheckpoint()</code> en <code>CheckpointTracker</code>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setCpModal(false)} disabled={txLoading}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={txLoading}>
                    {txLoading ? <><span className="spinner-border spinner-border-sm me-2" />Confirmando...</> : <><i className="bi bi-check-lg me-1" />Registrar</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Incident modal */}
      {incModal && (
        <div className="modal show d-block" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" style={{ color:'var(--ct-warn)' }}><i className="bi bi-exclamation-triangle-fill me-2" />Reportar Incidencia — Blockchain</h5>
                <button className="btn-close" onClick={() => setIncModal(false)} disabled={txLoading} />
              </div>
              <form onSubmit={submitIncident}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" value={incForm.type} onChange={e => setIncForm(f => ({ ...f, type: parseInt(e.target.value) }))}>
                      {INCIDENT_TYPES.map((t,i) => <option key={i} value={i}>{t}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Severidad</label>
                    <select className="form-select" value={incForm.severity} onChange={e => setIncForm(f => ({ ...f, severity: parseInt(e.target.value) }))}>
                      {['Baja','Media','Alta','Critica'].map((s,i) => <option key={i} value={i}>{s}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Descripcion *</label>
                    <textarea className="form-control" rows={3} value={incForm.description}
                      onChange={e => setIncForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Describe la incidencia detalladamente..." />
                  </div>
                  <div className="alert alert-info mb-0" style={{ fontSize:'0.75rem' }}>
                    <i className="bi bi-link-45deg me-1" />
                    Llama a <code>reportIncident()</code> en <code>IncidentManager</code>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setIncModal(false)} disabled={txLoading}>Cancelar</button>
                  <button type="submit" className="btn" style={{ background:'var(--ct-warn)', color:'#050810', fontWeight:700 }} disabled={txLoading}>
                    {txLoading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-exclamation-triangle me-1" />Reportar</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ACTORS PAGE
// ════════════════════════════════════════════════════════════
export function ActorsPage() {
  const { actors } = useApp();
  const [search, setSearch] = useState('');

  const filtered = actors.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ct-fade-in">
      <div className="ct-page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h4 className="mb-0 fw-700">Actores <span style={{ color:'var(--ct-accent)' }}>Registrados</span></h4>
        <input className="form-control" style={{ width:220 }} placeholder="Buscar actores..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="row g-3">
        {filtered.map((a, i) => {
          const role = ACTOR_ROLES[a.role];
          return (
            <div key={i} className="col-12 col-md-6 col-xl-4">
              <div className="card h-100">
                <div className="card-body d-flex gap-3 align-items-start">
                  <div style={{ width:44, height:44, borderRadius:10, background:'var(--ct-surface3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                    <i className={`bi ${role?.icon || 'bi-person'}`} style={{ color:'var(--ct-accent)' }} />
                  </div>
                  <div className="flex-grow-1 min-width-0">
                    <div className="fw-700 mb-1">{a.name}</div>
                    <div className="ct-address" style={{ fontSize:'0.68rem', marginBottom:8, wordBreak:'break-all' }}>{a.address}</div>
                    <div className="d-flex gap-2 align-items-center flex-wrap">
                      <span className={`ct-badge-role ${role?.key || 'none'}`}><i className={`bi ${role?.icon} me-1`} />{role?.label}</span>
                      {a.active
                        ? <span style={{ fontSize:'0.65rem', color:'var(--ct-green)' }}><span className="ct-pulse me-1" />Activo</span>
                        : <span style={{ fontSize:'0.65rem', color:'var(--ct-danger)' }}>● Inactivo</span>
                      }
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'var(--ct-text3)', marginTop:6 }}>
                      <i className="bi bi-geo-alt me-1" />{a.location}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-12"><div className="ct-empty-state card"><div className="icon">👥</div><p>No se encontraron actores en la blockchain</p></div></div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PRODUCTS PAGE (stub - en blockchain no hay productos separados)
// ════════════════════════════════════════════════════════════
export function ProductsPage() {
  return (
    <div className="ct-fade-in">
      <div className="ct-page-header">
        <h4 className="mb-0 fw-700">Productos</h4>
      </div>
      <div className="alert alert-info">
        <i className="bi bi-info-circle me-2" />
        En esta version, los productos se definen directamente al crear un envio. No existe un registro separado de productos en los contratos actuales.
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PROFILE PAGE
// ════════════════════════════════════════════════════════════
export function ProfilePage() {
  const { account, actorRole, updateActorRole, isAdmin, networkName, chainId } = useWallet();
  const { actors, registerActor, addToast } = useApp();

  const [form, setForm]     = useState({ name:'', role:1, location:'' });
  const [editing, setEditing] = useState(false);
  const [txLoading, setTxLoading] = useState(false);

  const myActor = actors.find(a => a.address?.toLowerCase() === account?.toLowerCase());
  const isSender = actorRole === 1; // Remitente: perfil de solo lectura

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name || !form.location) { addToast('Completa todos los campos', 'error'); return; }
    setTxLoading(true);
    try {
      await registerActor(account, form.name, parseInt(form.role), form.location);
      updateActorRole(parseInt(form.role), { name: form.name, location: form.location });
      addToast('Perfil registrado en blockchain', 'success');
      setEditing(false);
    } catch {} finally { setTxLoading(false); }
  };

  return (
    <div className="ct-fade-in">
      <div className="ct-page-header">
        <h4 className="mb-0 fw-700">Mi <span style={{ color:'var(--ct-accent)' }}>Perfil</span></h4>
      </div>
      <div className="row g-3">
        <div className="col-12 col-md-5">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center gap-3 mb-4">
                <div style={{ width:56, height:56, borderRadius:14, background:'linear-gradient(135deg, var(--ct-accent), var(--ct-accent2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>
                  {isAdmin ? '🛡' : myActor ? <i className={`bi ${ACTOR_ROLES[myActor.role]?.icon}`} style={{ color:'#050810' }} /> : '👤'}
                </div>
                <div>
                  <div className="fw-700 mb-1">{myActor?.name || 'Sin nombre'}</div>
                  <div className="ct-address" style={{ fontSize:'0.7rem', wordBreak:'break-all' }}>{account}</div>
                </div>
              </div>
              <div className="d-flex flex-column gap-2">
                {[
                  { label:'Red',       value: networkName,                   icon:'bi-hdd-network' },
                  { label:'Chain ID',  value: chainId,                       icon:'bi-link-45deg' },
                  { label:'Rol',       value: isAdmin ? 'Admin' : ACTOR_ROLES[myActor?.role]?.label || 'Sin rol', icon:'bi-person-badge' },
                  { label:'Ubicacion', value: myActor?.location || '-',      icon:'bi-geo-alt' },
                ].map((r,i) => (
                  <div key={i} className="d-flex justify-content-between align-items-center p-2 rounded"
                    style={{ background:'var(--ct-surface2)', border:'1px solid var(--ct-border)', fontSize:'0.82rem' }}>
                    <span style={{ color:'var(--ct-text2)' }}><i className={`bi ${r.icon} me-2`} />{r.label}</span>
                    <span className="fw-600">{r.value || '-'}</span>
                  </div>
                ))}
              </div>
              {myActor && (
                <span className={`ct-badge-role ${ACTOR_ROLES[myActor.role]?.key} mt-3 d-inline-block`}>
                  <i className={`bi ${ACTOR_ROLES[myActor.role]?.icon} me-1`} />
                  {ACTOR_ROLES[myActor.role]?.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-md-7">
          {(!myActor || editing) && !isSender ? (
            <div className="card">
              <div className="card-header fw-600">{editing ? 'Editar Perfil' : 'Registrarse en la Red Blockchain'}</div>
              <div className="card-body">
                <form onSubmit={handleRegister}>
                  <div className="mb-3">
                    <label className="form-label">Nombre / Empresa *</label>
                    <input className="form-control" placeholder="Ej: Mi Empresa S.A."
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Rol en la Red *</label>
                    <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      {/* Solo roles básicos — Inspector y Admin los asigna el administrador */}
                      {Object.entries(ACTOR_ROLES).filter(([k]) => ['1','2','3','4'].includes(k)).map(([k,v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <div style={{ fontSize:'0.72rem', color:'var(--ct-text3)', marginTop:4 }}>
                      <i className="bi bi-info-circle me-1" />
                      Los roles Inspector y Admin son asignados por el administrador.
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Ubicacion *</label>
                    <input className="form-control" placeholder="Ej: Madrid, Espana"
                      value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div className="alert alert-info mb-3" style={{ fontSize:'0.78rem' }}>
                    <i className="bi bi-link-45deg me-1" />
                    Ejecuta <code>registerActor()</code> en <code>ActorRegistry</code>. MetaMask pedira tu firma.
                  </div>
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary flex-fill" disabled={txLoading}>
                      {txLoading
                        ? <><span className="spinner-border spinner-border-sm me-2" />Confirmando...</>
                        : <><i className="bi bi-check-lg me-1" />Registrar en Blockchain</>
                      }
                    </button>
                    {editing && <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(false)}>Cancelar</button>}
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header fw-600 d-flex align-items-center justify-content-between">
                <span>Estado On-Chain</span>
                {!isSender && (
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => { setForm({ name:myActor.name, role:myActor.role, location:myActor.location }); setEditing(true); }}>
                    <i className="bi bi-pencil me-1" />Editar
                  </button>
                )}
              </div>
              <div className="card-body">
                <div className="alert alert-success d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-shield-check-fill" />Actor verificado en blockchain
                </div>
                {isAdmin && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 mb-3" style={{ fontSize:'0.82rem' }}>
                    <i className="bi bi-shield-lock-fill" />Tienes permisos de administrador
                  </div>
                )}
                {isSender && (
                  <div className="alert alert-warning d-flex align-items-center gap-2 mb-3" style={{ fontSize:'0.82rem' }}>
                    <i className="bi bi-lock-fill" />Como Remitente, tu perfil es de solo lectura. Contacta al administrador para modificarlo.
                  </div>
                )}
                <div className="p-2 rounded" style={{ background:'var(--ct-surface2)', border:'1px solid var(--ct-border)', fontSize:'0.8rem' }}>
                  <div style={{ color:'var(--ct-text2)', fontSize:'0.68rem', fontFamily:'var(--ct-mono)', marginBottom:4 }}>REGISTRADO EN BLOQUE</div>
                  <div className="fw-600">{myActor?.registeredAt? new Date(myActor.registeredAt).toLocaleDateString('es-ES') : '-' }</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  CHECKPOINTS PAGE
// ════════════════════════════════════════════════════════════
export function CheckpointsPage() {
  const { shipments } = useApp();
  const allCps = shipments.flatMap(s =>
    (s.checkpoints || []).map(cp => ({ ...cp, shipmentId: s.id }))
  );

  return (
    <div className="ct-fade-in">
      <div className="ct-page-header">
        <h4 className="mb-0 fw-700">Checkpoints <span style={{ color:'var(--ct-accent)' }}>On-Chain</span></h4>
      </div>
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <span className="fw-600">Todos los Checkpoints</span>
          <span className="badge" style={{ background:'var(--ct-accent-dim)', color:'var(--ct-accent)', border:'1px solid rgba(0,229,255,0.2)' }}>{allCps.length} registros</span>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead><tr><th>Envio</th><th>Tipo</th><th>Ubicacion</th><th>Actor</th><th>Temperatura</th><th>Data Hash</th><th>Fecha</th></tr></thead>
              <tbody>
                {allCps.map((cp, i) => (
                  <tr key={i}>
                    <td><span className="ct-hash">#{cp.shipmentId.toString().padStart(3,'0')}</span></td>
                    <td><span className="badge" style={{ background:'var(--ct-surface3)', color:'var(--ct-text)', border:'1px solid var(--ct-border)' }}>{cp.type}</span></td>
                    <td style={{ fontSize:'0.82rem', color:'var(--ct-text2)' }}>{cp.location}</td>
                    <td className="ct-address" style={{ fontSize:'0.68rem' }}>{cp.actor?.slice(0,10)}...{cp.actor?.slice(-4)}</td>
                    <td>{cp.temperature !== 0 ? <span style={{ color: cp.tempViolation ? 'var(--ct-danger)' : '#7dd3fc', fontSize:'0.8rem' }}>🌡 {fmtTemp(cp.temperature)} {cp.tempViolation && '⚠'}</span> : '-'}</td>
                    <td><span className="ct-hash" style={{ fontSize:'0.6rem' }}>{cp.dataHash?.slice(0,12)}...</span></td>
                    <td style={{ fontSize:'0.75rem', color:'var(--ct-text2)' }}>{fmtDate(cp.timestamp)?.split(',')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allCps.length === 0 && <div className="ct-empty-state"><div className="icon">📍</div><p>Sin checkpoints en la blockchain</p></div>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  INCIDENTS PAGE
// ════════════════════════════════════════════════════════════
export function IncidentsPage() {
  const { shipments, resolveIncident, addToast } = useApp();
  const [txLoading, setTxLoading] = useState(false);

  const allInc = shipments.flatMap(s =>
    (s.incidents || []).map(i => ({ ...i, shipmentId: s.id }))
  );

  const handleResolve = async (inc) => {
    setTxLoading(inc.id);
    try {
      await resolveIncident(inc.id, 'Resuelto manualmente', inc.shipmentId);
      addToast('Incidencia resuelta en blockchain', 'success');
    } catch {} finally { setTxLoading(false); }
  };

  return (
    <div className="ct-fade-in">
      <div className="ct-page-header">
        <h4 className="mb-0 fw-700">Incidencias <span style={{ color:'var(--ct-danger)' }}>On-Chain</span></h4>
      </div>
      <div className="card">
        <div className="card-header fw-600 d-flex align-items-center justify-content-between">
          <span>Todas las Incidencias</span>
          <span className="badge" style={{ background:'var(--ct-danger-dim)', color:'var(--ct-danger)', border:'1px solid rgba(255,77,106,0.3)' }}>
            {allInc.filter(i => !i.resolved).length} abiertas
          </span>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead><tr><th>Envio</th><th>Tipo</th><th>Severidad</th><th>Descripcion</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {allInc.map((inc, i) => (
                  <tr key={i}>
                    <td><span className="ct-hash">#{inc.shipmentId.toString().padStart(3,'0')}</span></td>
                    <td style={{ fontSize:'0.82rem' }}>{INCIDENT_TYPES[inc.type] || 'Incidencia'}</td>
                    <td>
                      <span className="badge" style={{ background:['var(--ct-green-dim)','var(--ct-warn-dim)','rgba(255,170,0,0.15)','var(--ct-danger-dim)'][inc.severity] || 'var(--ct-surface3)', color:['var(--ct-green)','var(--ct-warn)','var(--ct-warn)','var(--ct-danger)'][inc.severity] || 'var(--ct-text2)', fontSize:'0.65rem' }}>
                        {['Baja','Media','Alta','Critica'][inc.severity]}
                      </span>
                    </td>
                    <td style={{ fontSize:'0.78rem', color:'var(--ct-text2)', maxWidth:200 }}><div className="text-truncate">{inc.description}</div></td>
                    <td>{inc.resolved ? <span style={{ color:'var(--ct-green)', fontSize:'0.78rem' }}>✓ Resuelta</span> : <span style={{ color:'var(--ct-danger)', fontSize:'0.78rem' }}>● Abierta</span>}</td>
                    <td style={{ fontSize:'0.72rem', color:'var(--ct-text2)' }}>{fmtDate(inc.reportedAt)?.split(',')[0]}</td>
                    <td>
                      {!inc.resolved && (
                        <button className="btn btn-outline-secondary btn-sm" style={{ fontSize:'0.7rem' }}
                          onClick={() => handleResolve(inc)} disabled={txLoading === inc.id}>
                          {txLoading === inc.id ? <span className="spinner-border spinner-border-sm" style={{ width:10, height:10 }} /> : 'Resolver'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allInc.length === 0 && <div className="ct-empty-state"><div className="icon">✅</div><p>Sin incidencias en la blockchain</p></div>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SENDER SHIPMENTS PAGE
//  Vista exclusiva para el rol Remitente (rol 1).
//  Muestra:
//   - Sus envíos (sender === account)
//   - Todos los envíos donde hay un destinatario como recipient
//  Puede crear nuevos envíos (= crear producto).
//  NO puede modificar actores ni ver Admin.
// ════════════════════════════════════════════════════════════
export function SenderShipmentsPage({ onNavigate }) {
  const { account } = useWallet();
  const { shipments, products, addToast, createShipment, actors } = useApp();

  const [tab, setTab]         = useState('mine');   // 'mine' | 'recipients'
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [form, setForm] = useState({
    recipient: '', product: '', origin: '', destination: '',
    requiresColdChain: false, minTemp: 20, maxTemp: 80,
  });

  // Mis envíos: donde yo soy el sender
  const myShipments = shipments.filter(s =>
    s.sender?.toLowerCase() === account?.toLowerCase()
  );

  // Envíos comprados por destinatarios: cualquier shipment
  // donde el recipient es un actor con rol 4 (Destinatario)
  const recipientAddresses = new Set(
    actors.filter(a => a.role === 4).map(a => a.address?.toLowerCase())
  );
  const recipientShipments = shipments.filter(s =>
    recipientAddresses.has(s.recipient?.toLowerCase())
  );

  const activeList = tab === 'mine' ? myShipments : recipientShipments;

  const filtered = activeList.filter(s => {
    const matchFilter = filter === 'all' || STATUS_CSS[s.status] === filter;
    const matchSearch = !search
      || s.origin?.toLowerCase().includes(search.toLowerCase())
      || s.destination?.toLowerCase().includes(search.toLowerCase())
      || s.recipient?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.recipient || !form.origin || !form.destination) {
      addToast('Completa todos los campos requeridos', 'error'); return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.recipient)) {
      addToast('Dirección de destinatario inválida', 'error'); return;
    }
    if (form.requiresColdChain && form.minTemp >= form.maxTemp) {
      addToast('Rango de temperatura inválido (min debe ser < max)', 'error'); return;
    }
    setTxLoading(true);
    try {
      const { shipmentId } = await createShipment({
        recipient:         form.recipient,
        product:           form.product,
        origin:            form.origin,
        destination:       form.destination,
        requiresColdChain: form.requiresColdChain,
        minTemp:           form.requiresColdChain ? form.minTemp : 0,
        maxTemp:           form.requiresColdChain ? form.maxTemp : 0,
      });
      addToast(`Envío #${shipmentId} creado en blockchain`, 'success');
      setModal(false);
      setForm({ recipient:'', product:'', origin:'', destination:'', requiresColdChain:false, minTemp:20, maxTemp:80 });
    } catch {} finally { setTxLoading(false); }
  };

  return (
    <div className="ct-fade-in">
      {/* Header */}
      <div className="ct-page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-700">
            Mis <span style={{ color:'var(--ct-accent)' }}>Envíos</span>
          </h4>
          <div className="ct-address" style={{ fontSize:'0.72rem' }}>
            <span className="ct-badge-role sender me-2">
              <i className="bi bi-box-seam me-1" />Remitente
            </span>
            {account?.slice(0,10)}...{account?.slice(-6)}
          </div>
        </div>
        <button
          className="btn btn-primary d-flex align-items-center gap-2"
          onClick={() => setModal(true)}
        >
          <i className="bi bi-plus-lg" /> Crear Envío
        </button>
      </div>

      {/* Info banner */}
      <div className="alert alert-info d-flex align-items-start gap-2 mb-3" style={{ fontSize:'0.82rem' }}>
        <i className="bi bi-info-circle-fill mt-1" />
        <div>
          Como <strong>Remitente</strong> podés crear envíos y ver el estado de los productos que tus destinatarios recibieron.
          Cada envío creado queda registrado permanentemente en la blockchain.
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link d-flex align-items-center gap-2 ${tab === 'mine' ? 'active' : ''}`}
            onClick={() => setTab('mine')}
          >
            <i className="bi bi-box-seam" />
            Mis Envíos
            <span className="badge rounded-pill ms-1" style={{ background:'var(--ct-surface3)', color:'var(--ct-text2)', fontSize:'0.6rem' }}>
              {myShipments.length}
            </span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link d-flex align-items-center gap-2 ${tab === 'recipients' ? 'active' : ''}`}
            onClick={() => setTab('recipients')}
          >
            <i className="bi bi-house-door" />
            Compras de Destinatarios
            <span className="badge rounded-pill ms-1" style={{ background:'var(--ct-surface3)', color:'var(--ct-text2)', fontSize:'0.6rem' }}>
              {recipientShipments.length}
            </span>
          </button>
        </li>
      </ul>

      {/* Filtros */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <div className="position-relative">
          <i className="bi bi-search position-absolute" style={{ left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ct-text3)', fontSize:'0.85rem' }} />
          <input className="form-control" style={{ paddingLeft:32, width:220 }}
            placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all','created','intransit','athub','delivered'].map(f => (
          <button key={f}
            className={`btn btn-sm ${filter===f ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f==='all' ? 'Todos' : STATUS_LABELS[STATUS_CSS.indexOf(f)]}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Origen → Destino</th>
                  <th>{tab === 'mine' ? 'Destinatario' : 'Remitente'}</th>
                  <th>Estado</th>
                  <th>Cold</th>
                  <th>Checkpoints</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} style={{ cursor:'pointer' }} onClick={() => onNavigate('tracking', s.id)}>
                    <td><span className="ct-hash">#{s.id.toString().padStart(3,'0')}</span></td>
                    <td>
                      <div className="fw-600" style={{ fontSize:'0.82rem' }}>{s.product || '—'}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--ct-text2)' }}>{s.origin?.split(',')[0]} → {s.destination?.split(',')[0]}</div>
                    </td>
                    <td>
                      {/* Buscar el actor correspondiente para mostrar su nombre */}
                      {(() => {
                        const addr = tab === 'mine' ? s.recipient : s.sender;
                        const actor = actors.find(a => a.address?.toLowerCase() === addr?.toLowerCase());
                        return (
                          <div>
                            <div className="fw-600" style={{ fontSize:'0.8rem' }}>{actor?.name || '—'}</div>
                            <div className="ct-address" style={{ fontSize:'0.65rem' }}>{addr?.slice(0,8)}...{addr?.slice(-4)}</div>
                          </div>
                        );
                      })()}
                    </td>
                    <td><span className={`ct-badge-status ${STATUS_CSS[s.status]}`}>{STATUS_LABELS[s.status]}</span></td>
                    <td>{s.requiresColdChain ? <span style={{ color:'#7dd3fc', fontSize:'0.8rem' }}>❄</span> : <span style={{ color:'var(--ct-text3)' }}>—</span>}</td>
                    <td>
                      <span className="badge" style={{ background:'var(--ct-accent-dim)', color:'var(--ct-accent)' }}>
                        {s.checkpoints?.length || 0}
                      </span>
                    </td>
                    <td style={{ fontSize:'0.75rem', color:'var(--ct-text2)' }}>{fmtDate(s.createdAt)?.split(',')[0]}</td>
                    <td><i className="bi bi-chevron-right" style={{ color:'var(--ct-text3)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="ct-empty-state">
              <div className="icon">{tab === 'mine' ? '📦' : '🏠'}</div>
              <p>
                {tab === 'mine'
                  ? 'No creaste envíos todavía. ¡Crea el primero!'
                  : 'Ningún destinatario ha recibido envíos aún.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal crear envío */}
      {modal && (
        <div className="modal show d-block" style={{ background:'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-box-seam-fill me-2" style={{ color:'var(--ct-accent)' }} />
                  Crear Envío — Blockchain
                </h5>
                <button className="btn-close" onClick={() => setModal(false)} disabled={txLoading} />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Producto / Descripción *</label>
                      <input className="form-control" placeholder="Ej: Insulina Refrigerada 100UI"
                        value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Dirección del Destinatario (ETH) *</label>
                      <input className="form-control" placeholder="0x..."
                        style={{ fontFamily:'var(--ct-mono)', fontSize:'0.85rem' }}
                        value={form.recipient}
                        onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} />
                      {/* Autocompletar desde actores con rol Destinatario */}
                      {actors.filter(a => a.role === 4 && a.active).length > 0 && (
                        <div className="mt-2">
                          <div style={{ fontSize:'0.7rem', color:'var(--ct-text3)', marginBottom:4 }}>Destinatarios registrados:</div>
                          <div className="d-flex flex-wrap gap-1">
                            {actors.filter(a => a.role === 4 && a.active).map(a => (
                              <button key={a.address} type="button"
                                className="btn btn-sm"
                                style={{ background:'var(--ct-surface3)', border:'1px solid var(--ct-border)', color:'var(--ct-text2)', fontSize:'0.68rem', padding:'2px 8px' }}
                                onClick={() => setForm(f => ({ ...f, recipient: a.address }))}>
                                <i className="bi bi-house-door me-1" style={{ color:'var(--ct-green)' }} />
                                {a.name} — {a.address.slice(0,8)}...
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Origen *</label>
                      <input className="form-control" placeholder="Ej: Depósito Central, Madrid"
                        value={form.origin}
                        onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Destino *</label>
                      <input className="form-control" placeholder="Ej: Hospital Central, Barcelona"
                        value={form.destination}
                        onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} />
                    </div>

                    {/* Cold chain */}
                    <div className="col-12">
                      <div className="p-3 rounded" style={{ background:'var(--ct-surface2)', border:'1px solid var(--ct-border)' }}>
                        <div className="d-flex align-items-center gap-3 mb-2">
                          <div className="form-check form-switch mb-0">
                            <input className="form-check-input" type="checkbox" role="switch"
                              checked={form.requiresColdChain}
                              onChange={e => setForm(f => ({ ...f, requiresColdChain: e.target.checked }))} />
                          </div>
                          <label className="form-label mb-0">❄ Requiere Cadena de Frío</label>
                        </div>
                        {form.requiresColdChain && (
                          <div className="row g-3 mt-1">
                            <div className="col-md-6">
                              <label className="form-label">
                                Temp. Mínima (×10)
                                <span style={{ color:'var(--ct-text3)', fontWeight:400, fontSize:'0.72rem', marginLeft:6 }}>Ej: 20 = 2.0°C</span>
                              </label>
                              <input type="number" className="form-control" value={form.minTemp}
                                onChange={e => setForm(f => ({ ...f, minTemp: parseInt(e.target.value)||0 }))} />
                              <div style={{ fontSize:'0.7rem', color:'var(--ct-accent)', marginTop:3 }}>= {(form.minTemp/10).toFixed(1)}°C</div>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">Temp. Máxima (×10)</label>
                              <input type="number" className="form-control" value={form.maxTemp}
                                onChange={e => setForm(f => ({ ...f, maxTemp: parseInt(e.target.value)||0 }))} />
                              <div style={{ fontSize:'0.7rem', color:'var(--ct-accent)', marginTop:3 }}>= {(form.maxTemp/10).toFixed(1)}°C</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="alert alert-info mb-0" style={{ fontSize:'0.78rem' }}>
                        <i className="bi bi-link-45deg me-1" />
                        Llama a <code>createShipment()</code> en <code>ShipmentManager</code>. MetaMask pedirá tu firma.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setModal(false)} disabled={txLoading}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={txLoading}>
                    {txLoading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Confirmando en blockchain...</>
                      : <><i className="bi bi-check-lg me-1" />Crear Envío</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
