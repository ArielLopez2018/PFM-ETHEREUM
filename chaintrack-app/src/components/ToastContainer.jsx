import React from 'react';
import { useApp } from '../context/BlockchainContext';

const ICONS = {
  success: 'bi-check-circle-fill',
  error:   'bi-x-circle-fill',
  info:    'bi-info-circle-fill',
  warn:    'bi-exclamation-triangle-fill',
};
const COLORS = {
  success: 'var(--ct-green)',
  error:   'var(--ct-danger)',
  info:    'var(--ct-accent)',
  warn:    'var(--ct-warn)',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  return (
    <div className="ct-toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`ct-toast ${toast.type}`}>
          <i
            className={`bi ${ICONS[toast.type] || ICONS.info}`}
            style={{ color: COLORS[toast.type], fontSize: '1rem', flexShrink: 0, marginTop: 1 }}
          />
          <span className="flex-grow-1" style={{ lineHeight: 1.4 }}>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--ct-text3)', cursor: 'pointer', fontSize: '0.75rem',
              lineHeight: 1, flexShrink: 0,
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
      ))}
    </div>
  );
}
