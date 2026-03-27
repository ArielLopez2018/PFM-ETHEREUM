import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const WalletContext = createContext(null);
const STORAGE_KEY = 'chaintrack_wallet_session';

export const ACTOR_ROLES = {
  0: { label: 'Sin Rol',       key: 'none',      icon: 'bi-dash-circle' },
  1: { label: 'Remitente',     key: 'sender',    icon: 'bi-box-seam' },
  2: { label: 'Transportista', key: 'carrier',   icon: 'bi-truck' },
  3: { label: 'Hub Logistico', key: 'hub',       icon: 'bi-building' },
  4: { label: 'Destinatario',  key: 'recipient', icon: 'bi-house-door' },
  5: { label: 'Inspector',     key: 'inspector', icon: 'bi-shield-check' },
};

// Admin hardcodeado para demo
const ADMIN_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

export function WalletProvider({ children }) {
  const [account, setAccount]       = useState(null);
  const [chainId, setChainId]       = useState(null);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [actorRole, setActorRole]   = useState(null);
  const [actorInfo, setActorInfo]   = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Restaurar sesion desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const session = JSON.parse(saved);
        if (session.account) {
          setAccount(session.account);
          setChainId(session.chainId);
          setActorRole(session.actorRole ?? null);
          setActorInfo(session.actorInfo ?? null);
          setIsAdmin(session.account.toLowerCase() === ADMIN_ADDRESS.toLowerCase());
        }
      } catch { /* sesion corrupta, ignorar */ }
    }
    setSessionLoaded(true);
  }, []);

  // Guardar sesion en localStorage cuando cambia
  useEffect(() => {
    if (!sessionLoaded) return;
    if (account) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ account, chainId, actorRole, actorInfo }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [account, chainId, actorRole, actorInfo, sessionLoaded]);

  // Escuchar cambios en MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) logout();
    };
    const handleChainChanged = (newChainId) => {
      setChainId(parseInt(newChainId, 16));
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [account]);

  // Conectar wallet
  // Usa wallet_requestPermissions para forzar el selector de cuentas de MetaMask.
  // Esto permite elegir una cuenta distinta cada vez, incluso si ya habia una conectada.
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask no detectado. Por favor instala MetaMask.');
    }
    setConnecting(true);
    try {
      // Fuerza abrir el selector de cuentas de MetaMask
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });

      // Obtener la cuenta que el usuario eligio
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error('No se selecciono ninguna cuenta.');
      }

      const rawChainId = await window.ethereum.request({ method: 'eth_chainId' });
      const addr = accounts[0];

      setAccount(addr);
      setChainId(parseInt(rawChainId, 16));
      setIsAdmin(addr.toLowerCase() === ADMIN_ADDRESS.toLowerCase());
      setActorRole(null);
      setActorInfo(null);

      return addr;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Logout explicito: limpia TODO el estado y el localStorage
  const logout = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setIsAdmin(false);
    setActorRole(null);
    setActorInfo(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Actualizar rol del actor (llamado tras registro)
  const updateActorRole = useCallback((roleId, info) => {
    setActorRole(roleId);
    setActorInfo(info);
  }, []);

  const shortAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  const networkName = (() => {
    switch (chainId) {
      case 1:        return 'Ethereum Mainnet';
      case 11155111: return 'Sepolia';
      case 80001:    return 'Mumbai';
      case 31337:    return 'Anvil Local';
      default:       return chainId ? `Red ${chainId}` : 'Desconocida';
    }
  })();

  const value = {
    account, shortAddress, chainId, networkName,
    isAdmin, actorRole, actorInfo,
    connecting, sessionLoaded,
    isConnected: !!account,
    connect, logout, updateActorRole,
    ACTOR_ROLES,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}