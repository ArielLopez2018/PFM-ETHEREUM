import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useApp } from '../context/BlockchainContext';

// ============================================================
//  LoginPage — Dos flujos:
//  1. INGRESAR  → conectar wallet existente (MetaMask)
//  2. REGISTRARSE → crear cuenta nueva como Destinatario
//     · Si la dirección ya existe en actors → avisa que debe ingresar
//     · Si es nueva → la registra con rol Destinatario (4)
// ============================================================

const TAB_LOGIN    = 'login';
const TAB_REGISTER = 'register';

export default function LoginPage() {
  const { connect, connecting } = useWallet();
  const { actors } = useApp();

  const [tab, setTab] = useState(TAB_LOGIN);

  // ── Estado login ─────────────────────────────────────────
  const [loginError, setLoginError] = useState('');

  // ── Estado registro ──────────────────────────────────────
  const [regStep, setRegStep]       = useState(1); // 1=form, 2=conectar wallet, 3=éxito
  const [regForm, setRegForm]       = useState({ name: '', email: '', location: '' });
  const [regError, setRegError]     = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regAddress, setRegAddress] = useState('');
  const [alreadyExists, setAlreadyExists] = useState(false);

  // ── Handler: Login con MetaMask ──────────────────────────
  const handleConnect = async () => {
    setLoginError('');
    try {
      await connect();
    } catch (err) {
      setLoginError(err.message || 'Error al conectar la wallet');
    }
  };

  // ── Handler: Paso 1 → validar form de registro ───────────
  const handleRegFormSubmit = (e) => {
    e.preventDefault();
    setRegError('');
    if (!regForm.name.trim())     { setRegError('El nombre es obligatorio.');     return; }
    if (!regForm.location.trim()) { setRegError('La ubicación es obligatoria.'); return; }
    setRegStep(2);
  };

  // ── Handler: Paso 2 → conectar wallet para registrarse ───
  // Flujo correcto:
  // 1. Conectar wallet (esto loguea al usuario)
  // 2. Guardar datos en sessionStorage como "registro pendiente"
  // 3. ProfilePage detecta el pendingRegistration y ejecuta registerActor
  //    una vez que los contratos ya están disponibles
  const handleRegConnect = async () => {
    setRegError('');
    setRegLoading(true);
    try {
      const addr = await connect(); // abre MetaMask y conecta → login automático

      // Verificar si ya está registrado en el cache local
      const existing = actors.find(
        a => a.address?.toLowerCase() === addr.toLowerCase()
      );

      if (existing) {
        // Ya tiene cuenta → el login ya lo llevó al panel
        setRegAddress(addr);
        setAlreadyExists(true);
        setRegStep(3);
        return;
      }

      // Guardar registro pendiente — ProfilePage lo procesa al montar
      sessionStorage.setItem('chaintrack_pending_reg', JSON.stringify({
        name:     regForm.name.trim(),
        location: regForm.location.trim(),
        role:     4, // Destinatario
      }));

      setRegAddress(addr);
      setAlreadyExists(false);
      setRegStep(3);
      // El usuario ya está logueado, App.jsx lo redirige automáticamente
    } catch (err) {
      setRegError(err.message || 'Error al conectar la wallet. Intentá de nuevo.');
    } finally {
      setRegLoading(false);
    }
  };

  // ── Reiniciar registro ───────────────────────────────────
  const resetRegister = () => {
    setRegStep(1);
    setRegForm({ name: '', email: '', location: '' });
    setRegError('');
    setRegAddress('');
    setAlreadyExists(false);
  };

  return (
    <div className="ct-login-wrap">
      <div className="ct-login-card ct-fade-in" style={{ maxWidth: 460 }}>

        {/* ── Logo ── */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="ct-logo-icon" style={{ width: 48, height: 48, fontSize: 22 }}>⛓</div>
          <div>
            <h1 className="mb-0 fw-800" style={{ fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
              Chain<span style={{ color: 'var(--ct-accent)' }}>Track</span>
            </h1>
            <p className="mb-0" style={{ fontSize: '0.75rem', color: 'var(--ct-text3)', fontFamily: 'var(--ct-mono)' }}>
              TRAZABILIDAD LOGÍSTICA BLOCKCHAIN
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div
          className="d-flex mb-4 p-1 rounded"
          style={{ background: 'var(--ct-surface2)', border: '1px solid var(--ct-border)' }}
        >
          {[
            { key: TAB_LOGIN,    label: 'Ingresar',     icon: 'bi-box-arrow-in-right' },
            { key: TAB_REGISTER, label: 'Crear cuenta', icon: 'bi-person-plus'        },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setLoginError(''); resetRegister(); }}
              className="flex-fill border-0 d-flex align-items-center justify-content-center gap-2 py-2 rounded"
              style={{
                background: tab === t.key ? 'var(--ct-surface3)' : 'transparent',
                color:      tab === t.key ? 'var(--ct-accent)'   : 'var(--ct-text2)',
                fontFamily: 'var(--ct-sans)',
                fontWeight: 600,
                fontSize:   '0.875rem',
                cursor:     'pointer',
                transition: 'all 0.2s',
                boxShadow:  tab === t.key ? '0 0 0 1px var(--ct-border2)' : 'none',
              }}
            >
              <i className={`bi ${t.icon}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB: INGRESAR
        ══════════════════════════════════════════ */}
        {tab === TAB_LOGIN && (
          <div className="ct-fade-in">
            <p style={{ color: 'var(--ct-text2)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Conectá tu wallet para acceder al sistema. Si no tenés cuenta,
              <button
                onClick={() => setTab(TAB_REGISTER)}
                style={{ background: 'none', border: 'none', padding: '0 4px', color: 'var(--ct-accent)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
              >
                creá una nueva
              </button>
              gratuitamente.
            </p>

            <button
              className="ct-wallet-btn mb-3"
              onClick={handleConnect}
              disabled={connecting || !window.ethereum}
            >
              <div className="ct-wallet-icon" style={{ background: 'rgba(245,130,32,0.15)', border: '1px solid rgba(245,130,32,0.3)' }}>
                🦊
              </div>
              <div className="flex-grow-1">
                <div className="fw-600">MetaMask</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ct-text3)' }}>
                  {window.ethereum ? 'Extensión detectada · elige tu cuenta' : 'No instalado'}
                </div>
              </div>
              {connecting
                ? <div className="spinner-border spinner-border-sm" style={{ color: 'var(--ct-accent)' }} />
                : <i className="bi bi-arrow-right" style={{ color: 'var(--ct-text3)' }} />
              }
            </button>

            <button
              className="ct-wallet-btn"
              disabled
              style={{ opacity: 0.4, cursor: 'not-allowed' }}
            >
              <div className="ct-wallet-icon" style={{ background: 'rgba(59,153,252,0.15)', border: '1px solid rgba(59,153,252,0.3)' }}>🔵</div>
              <div className="flex-grow-1">
                <div className="fw-600">WalletConnect</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--ct-text3)' }}>Próximamente</div>
              </div>
            </button>

            {loginError && (
              <div className="alert alert-danger mt-3 mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.8rem' }}>
                <i className="bi bi-exclamation-triangle-fill" />
                {loginError}
              </div>
            )}

            <div className="mt-4 p-3 rounded" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)' }}>
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-info-circle" style={{ color: 'var(--ct-accent)', marginTop: 2 }} />
                <div style={{ fontSize: '0.78rem', color: 'var(--ct-text2)', lineHeight: 1.5 }}>
                  Tu sesión se mantiene activa hasta que hagas logout. Podés recargar la página sin perder el acceso.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: CREAR CUENTA
        ══════════════════════════════════════════ */}
        {tab === TAB_REGISTER && (
          <div className="ct-fade-in">

            {/* ── PASO 1: Formulario de datos ── */}
            {regStep === 1 && (
              <>
                <div className="alert alert-info d-flex align-items-start gap-2 py-2 mb-3" style={{ fontSize: '0.8rem' }}>
                  <i className="bi bi-person-check-fill" style={{ marginTop: 1 }} />
                  <div>
                    Las cuentas nuevas se registran como <strong>Destinatario</strong>.
                    Podrás recibir y hacer seguimiento de tus envíos.
                  </div>
                </div>

                <form onSubmit={handleRegFormSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Nombre completo / Empresa *</label>
                    <input
                      className="form-control"
                      placeholder="Ej: Juan García"
                      value={regForm.name}
                      onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email <span style={{ color: 'var(--ct-text3)', textTransform: 'none', fontSize: '0.72rem', fontWeight: 400 }}>(opcional)</span></label>
                    <input
                      className="form-control"
                      type="email"
                      placeholder="tu@email.com"
                      value={regForm.email}
                      onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Ubicación / Ciudad *</label>
                    <input
                      className="form-control"
                      placeholder="Ej: Buenos Aires, Argentina"
                      value={regForm.location}
                      onChange={e => setRegForm(f => ({ ...f, location: e.target.value }))}
                    />
                  </div>

                  {regError && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3" style={{ fontSize: '0.8rem' }}>
                      <i className="bi bi-exclamation-triangle-fill" />{regError}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2">
                    <i className="bi bi-arrow-right-circle" />
                    Continuar
                  </button>
                </form>

                <div className="mt-3 text-center" style={{ fontSize: '0.78rem', color: 'var(--ct-text2)' }}>
                  ¿Ya tenés cuenta?{' '}
                  <button
                    onClick={() => setTab(TAB_LOGIN)}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ct-accent)', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}
                  >
                    Ingresá acá
                  </button>
                </div>
              </>
            )}

            {/* ── PASO 2: Conectar wallet ── */}
            {regStep === 2 && (
              <>
                {/* Breadcrumb visual */}
                <div className="d-flex align-items-center gap-2 mb-4">
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--ct-green-dim)', border: '2px solid var(--ct-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--ct-green)' }}>
                    ✓
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'var(--ct-border2)' }} />
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--ct-accent-dim)', border: '2px solid var(--ct-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--ct-accent)' }}>
                    2
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'var(--ct-border)' }} />
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--ct-surface2)', border: '2px solid var(--ct-border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--ct-text3)' }}>
                    3
                  </div>
                </div>

                {/* Resumen de datos */}
                <div className="p-3 rounded mb-3" style={{ background: 'var(--ct-surface2)', border: '1px solid var(--ct-border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--ct-text3)', fontFamily: 'var(--ct-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Tu perfil</div>
                  <div className="fw-600">{regForm.name}</div>
                  {regForm.email && <div style={{ fontSize: '0.8rem', color: 'var(--ct-text2)' }}>{regForm.email}</div>}
                  <div style={{ fontSize: '0.8rem', color: 'var(--ct-text2)' }}>
                    <i className="bi bi-geo-alt me-1" />{regForm.location}
                  </div>
                  <div className="mt-2">
                    <span className="ct-badge-role recipient">
                      <i className="bi bi-house-door me-1" />Destinatario
                    </span>
                  </div>
                </div>

                <p style={{ color: 'var(--ct-text2)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Ahora conectá tu wallet para vincular esta cuenta a tu dirección Ethereum.
                </p>

                <button
                  className="ct-wallet-btn mb-3"
                  onClick={handleRegConnect}
                  disabled={regLoading || !window.ethereum}
                >
                  <div className="ct-wallet-icon" style={{ background: 'rgba(245,130,32,0.15)', border: '1px solid rgba(245,130,32,0.3)' }}>
                    🦊
                  </div>
                  <div className="flex-grow-1">
                    <div className="fw-600">Conectar MetaMask</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--ct-text3)' }}>
                      {window.ethereum ? 'Elegí la cuenta a vincular' : 'No instalado'}
                    </div>
                  </div>
                  {regLoading
                    ? <div className="spinner-border spinner-border-sm" style={{ color: 'var(--ct-accent)' }} />
                    : <i className="bi bi-link-45deg" style={{ color: 'var(--ct-text3)', fontSize: '1.1rem' }} />
                  }
                </button>

                {regError && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-3" style={{ fontSize: '0.8rem' }}>
                    <i className="bi bi-exclamation-triangle-fill" />{regError}
                  </div>
                )}

                <button
                  onClick={() => { setRegStep(1); setRegError(''); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ct-text2)', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  <i className="bi bi-arrow-left me-1" />Volver
                </button>
              </>
            )}

            {/* ── PASO 3: Resultado ── */}
            {regStep === 3 && (
              <>
                {alreadyExists ? (
                  /* ─ La dirección ya tiene cuenta ─ */
                  <div className="ct-fade-in text-center">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔑</div>
                    <h5 className="fw-700 mb-2" style={{ color: 'var(--ct-warn)' }}>
                      Esta dirección ya está registrada
                    </h5>
                    <div
                      className="ct-hash d-inline-block mb-3"
                      style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}
                    >
                      {regAddress}
                    </div>
                    <p style={{ color: 'var(--ct-text2)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                      Ya tenés una cuenta activa con esta wallet. Usá la pestaña
                      <strong> Ingresar</strong> para acceder a tu sesión.
                    </p>
                    <button
                      className="btn btn-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2"
                      onClick={() => {
                        resetRegister();
                        setTab(TAB_LOGIN);
                      }}
                    >
                      <i className="bi bi-box-arrow-in-right" />
                      Ir a Ingresar
                    </button>
                    <button
                      onClick={resetRegister}
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ct-text2)', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      <i className="bi bi-arrow-left me-1" />Usar otra wallet
                    </button>
                  </div>
                ) : (
                  /* ─ Cuenta creada exitosamente ─ */
                  <div className="ct-fade-in text-center">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                    <h5 className="fw-700 mb-2" style={{ color: 'var(--ct-green)' }}>
                      ¡Cuenta creada con éxito!
                    </h5>
                    <div
                      className="ct-hash d-inline-block mb-3"
                      style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}
                    >
                      {regAddress}
                    </div>
                    <div className="p-3 rounded mb-3 text-start" style={{ background: 'var(--ct-green-dim)', border: '1px solid rgba(0,214,143,0.3)' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--ct-green)', marginBottom: 4, fontWeight: 600 }}>
                        <i className="bi bi-check2-circle me-2" />Tu perfil on-chain
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ct-text2)' }}>
                        <div><strong>{regForm.name}</strong></div>
                        <div>{regForm.location}</div>
                        <div className="mt-1">
                          <span className="ct-badge-role recipient">
                            <i className="bi bi-house-door me-1" />Destinatario
                          </span>
                        </div>
                      </div>
                    </div>
                    <p style={{ color: 'var(--ct-text2)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                      Tu sesión ya está activa. Podés ver y hacer seguimiento de tus envíos desde el panel.
                    </p>
                    {/* La sesión ya está activa (connect() hizo login automáticamente) */}
                    <div className="alert alert-success d-flex align-items-center gap-2 py-2" style={{ fontSize: '0.8rem' }}>
                      <i className="bi bi-shield-check-fill" />
                      Sesión iniciada. Redirigiendo al panel…
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-4 text-center">
          <span style={{ fontSize: '0.7rem', color: 'var(--ct-text3)', fontFamily: 'var(--ct-mono)' }}>
            ChainTrack MVP v1.2.0 · Sepolia Testnet
          </span>
        </div>

      </div>
    </div>
  );
}
