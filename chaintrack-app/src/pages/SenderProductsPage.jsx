// SenderProductsPage — se agrega al final de Pages.jsx
// Página exclusiva del Remitente para crear y gestionar productos on-chain

import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useApp } from '../context/BlockchainContext';

const SECTORS = ['Farmacéutico', 'Alimentario', 'Electrónica', 'Lujo', 'Industrial', 'Otro'];

const EMPTY_FORM = {
  name: '', description: '', sector: 'Farmacéutico',
  requiresColdChain: false, minTemp: 20, maxTemp: 80,
};

export function SenderProductsPage() {
  const { account } = useWallet();
  const { products, createProduct, updateProduct, deactivateProduct, addToast } = useApp();

  const [modal, setModal]         = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [txLoading, setTxLoading] = useState(false);
  const [confirmDeact, setConfirmDeact] = useState(null);

  // Solo los productos del remitente conectado
  const myProducts = products.filter(
    p => p.owner?.toLowerCase() === account?.toLowerCase()
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditProduct(null);
    setModal(true);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name, description: p.description, sector: p.sector,
      requiresColdChain: p.requiresColdChain,
      minTemp: p.minTemp, maxTemp: p.maxTemp,
    });
    setEditProduct(p);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim())   { addToast('El nombre es obligatorio', 'error'); return; }
    if (!form.sector.trim()) { addToast('El sector es obligatorio', 'error'); return; }
    if (form.requiresColdChain && form.minTemp >= form.maxTemp) {
      addToast('Rango de temperatura inválido (min debe ser < max)', 'error'); return;
    }

    setTxLoading(true);
    try {
      if (editProduct) {
        await updateProduct(editProduct.id, form);
        addToast(`Producto "${form.name}" actualizado en blockchain ✓`, 'success');
      } else {
        const { productId } = await createProduct(form);
        addToast(`Producto #${productId} "${form.name}" creado en blockchain ✓`, 'success');
      }
      setModal(false);
      setEditProduct(null);
      setForm(EMPTY_FORM);
    } catch {
      // manejado por BlockchainContext
    } finally {
      setTxLoading(false);
    }
  };

  const handleDeactivate = async (p) => {
    setTxLoading(true);
    try {
      await deactivateProduct(p.id);
      addToast(`Producto "${p.name}" desactivado en blockchain`, 'warn');
      setConfirmDeact(null);
    } catch {} finally { setTxLoading(false); }
  };

  return (
    <div className="ct-fade-in">
      {/* Header */}
      <div className="ct-page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h4 className="mb-1 fw-700">
            Mis <span style={{ color: 'var(--ct-accent)' }}>Productos</span>
          </h4>
          <div className="ct-address" style={{ fontSize: '0.72rem' }}>
            <span className="ct-badge-role sender me-2">
              <i className="bi bi-box-seam me-1" />Remitente
            </span>
            {account?.slice(0,10)}...{account?.slice(-6)}
          </div>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={openCreate}>
          <i className="bi bi-plus-lg" /> Nuevo Producto
        </button>
      </div>

      {/* Info */}
      <div className="alert alert-info d-flex align-items-start gap-2 mb-3" style={{ fontSize: '0.82rem' }}>
        <i className="bi bi-info-circle-fill mt-1" />
        <div>
          Cada producto que creás queda registrado permanentemente en la blockchain.
          Al crear un envío, podés seleccionar uno de tus productos registrados.
        </div>
      </div>

      {/* Grid de productos */}
      {myProducts.length === 0 ? (
        <div className="ct-empty-state card" style={{ padding: '3rem' }}>
          <div className="icon">📦</div>
          <p>No tenés productos registrados aún.</p>
          <button className="btn btn-primary mt-2" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" /> Crear mi primer producto
          </button>
        </div>
      ) : (
        <div className="row g-3">
          {myProducts.map(p => (
            <div key={p.id} className="col-12 col-md-6 col-xl-4">
              <div className="card h-100" style={{
                borderLeft: p.active
                  ? '3px solid var(--ct-accent)'
                  : '3px solid var(--ct-border2)',
                opacity: p.active ? 1 : 0.6,
              }}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <span className="ct-hash" style={{ fontSize: '0.62rem', marginBottom: 4, display: 'block' }}>
                        #{p.id.toString().padStart(3, '0')}
                      </span>
                      <div className="fw-700" style={{ fontSize: '0.95rem' }}>{p.name}</div>
                    </div>
                    <span className="badge" style={{
                      background: 'var(--ct-surface3)',
                      color: 'var(--ct-text2)',
                      border: '1px solid var(--ct-border)',
                      fontSize: '0.7rem',
                    }}>
                      {p.sector}
                    </span>
                  </div>

                  {p.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--ct-text2)', marginBottom: 10 }}>
                      {p.description}
                    </p>
                  )}

                  <div className="d-flex gap-2 flex-wrap mb-3">
                    {p.requiresColdChain ? (
                      <span style={{
                        fontSize: '0.75rem', color: '#7dd3fc',
                        background: 'rgba(125,211,252,0.08)',
                        border: '1px solid rgba(125,211,252,0.2)',
                        padding: '2px 8px', borderRadius: 4,
                      }}>
                        ❄ {(p.minTemp / 10).toFixed(1)}°C – {(p.maxTemp / 10).toFixed(1)}°C
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ct-text3)' }}>Sin cold chain</span>
                    )}
                    {p.active
                      ? <span style={{ fontSize: '0.7rem', color: 'var(--ct-green)' }}><span className="ct-pulse me-1" />Activo</span>
                      : <span style={{ fontSize: '0.7rem', color: 'var(--ct-danger)' }}>● Inactivo</span>
                    }
                  </div>

                  <div style={{ fontSize: '0.65rem', color: 'var(--ct-text3)', fontFamily: 'var(--ct-mono)', marginBottom: 12 }}>
                    Creado: {new Date(p.createdAt).toLocaleDateString('es-ES')}
                  </div>

                  {p.active && (
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-outline-secondary btn-sm flex-fill"
                        onClick={() => openEdit(p)}
                      >
                        <i className="bi bi-pencil me-1" />Editar
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => setConfirmDeact(p)}
                      >
                        <i className="bi bi-archive me-1" />Desactivar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-archive-fill me-2" style={{ color: 'var(--ct-accent)' }} />
                  {editProduct ? 'Editar Producto' : 'Nuevo Producto — Blockchain'}
                </h5>
                <button className="btn-close" onClick={() => setModal(false)} disabled={txLoading} />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label className="form-label">Nombre del Producto *</label>
                      <input className="form-control" placeholder="Ej: Insulina Refrigerada 100UI"
                        value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Sector *</label>
                      <select className="form-select" value={form.sector}
                        onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                        {SECTORS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Descripción</label>
                      <textarea className="form-control" rows={2}
                        placeholder="Descripción detallada del producto..."
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <div className="p-3 rounded" style={{ background: 'var(--ct-surface2)', border: '1px solid var(--ct-border)' }}>
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
                                <span style={{ color: 'var(--ct-text3)', fontWeight: 400, fontSize: '0.72rem', marginLeft: 6 }}>
                                  Ej: 20 = 2.0°C
                                </span>
                              </label>
                              <input type="number" className="form-control" value={form.minTemp}
                                onChange={e => setForm(f => ({ ...f, minTemp: parseInt(e.target.value) || 0 }))} />
                              <div style={{ fontSize: '0.7rem', color: 'var(--ct-accent)', marginTop: 3 }}>
                                = {(form.minTemp / 10).toFixed(1)}°C
                              </div>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">Temp. Máxima (×10)</label>
                              <input type="number" className="form-control" value={form.maxTemp}
                                onChange={e => setForm(f => ({ ...f, maxTemp: parseInt(e.target.value) || 0 }))} />
                              <div style={{ fontSize: '0.7rem', color: 'var(--ct-accent)', marginTop: 3 }}>
                                = {(form.maxTemp / 10).toFixed(1)}°C
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="alert alert-info mb-0" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-link-45deg me-1" />
                        Llama a <code>{editProduct ? 'updateProduct()' : 'createProduct()'}</code> en <code>ProductRegistry</code>. MetaMask pedirá tu firma.
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
                      : <><i className="bi bi-check-lg me-1" />{editProduct ? 'Guardar cambios' : 'Crear Producto'}</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirm deactivate */}
      {confirmDeact && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" style={{ color: 'var(--ct-warn)' }}>
                  <i className="bi bi-archive me-2" />Desactivar Producto
                </h5>
                <button className="btn-close" onClick={() => setConfirmDeact(null)} />
              </div>
              <div className="modal-body" style={{ fontSize: '0.875rem' }}>
                ¿Desactivar <strong>"{confirmDeact.name}"</strong>?
                Quedará registrado en la blockchain pero no podrá usarse en nuevos envíos.
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setConfirmDeact(null)}>Cancelar</button>
                <button className="btn btn-warning" onClick={() => handleDeactivate(confirmDeact)} disabled={txLoading}
                  style={{ color: '#050810', fontWeight: 700 }}>
                  {txLoading
                    ? <span className="spinner-border spinner-border-sm" />
                    : <><i className="bi bi-archive me-1" />Desactivar</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
