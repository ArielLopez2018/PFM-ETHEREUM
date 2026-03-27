import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useContracts, parseActor, parseShipment, parseCheckpoint, parseIncident, parseProduct } from '../hooks/useContracts';
import { useWallet } from './WalletContext';

// ============================================================
//  BlockchainContext — todas las operaciones van a la chain
//  ABIs corregidos para coincidir con los contratos reales
// ============================================================

const BlockchainContext = createContext(null);

export function BlockchainProvider({ children }) {
  const { account, isConnected, actorRole, updateActorRole, chainId } = useWallet();
  const contracts = useContracts(account); // solo se construye cuando hay cuenta
  const contractsRef = useRef(null); // ref siempre actualizado para los callbacks

  // Mantener contractsRef sincronizado con contracts
  useEffect(() => {
    contractsRef.current = contracts;
  }, [contracts]);

  const [actors,    setActors]    = useState([]);
  const [shipments, setShipments] = useState([]);
  const [products,  setProducts]  = useState([]);
  const [stats,     setStats]     = useState({
    totalShipments: 0, totalCheckpoints: 0,
    totalIncidents: 0, totalActors: 0,
    delivered: 0, inTransit: 0, incidents: 0,
  });
  const [loading,  setLoading]  = useState(false);
  const [toasts,   setToasts]   = useState([]);
  const loadedRef = useRef(false);

  // ── Obtener contratos con espera si aún no están listos ──
  // Espera hasta 3 segundos a que los contratos estén disponibles
  const getContracts = useCallback(async () => {
    if (contractsRef.current) return contractsRef.current;
    // Esperar hasta 3s en intervalos de 100ms
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (contractsRef.current) return contractsRef.current;
    }
    throw new Error('Contratos no disponibles. Verificá que MetaMask esté en Anvil Local.');
  }, []);

  // ── Toasts ───────────────────────────────────────────────
  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Error handler ────────────────────────────────────────
  const handleTxError = useCallback((err) => {
    if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') {
      addToast('Transacción rechazada por el usuario', 'warn');
    } else if (err?.reason) {
      addToast(`Error del contrato: ${err.reason}`, 'error');
    } else if (err?.data?.message) {
      addToast(`Error: ${err.data.message}`, 'error');
    } else {
      addToast(`Error: ${err?.shortMessage || err?.message || 'Error desconocido'}`, 'error');
    }
    console.error('TX Error:', err);
  }, [addToast]);

  // ── Cargar actores ────────────────────────────────────────
  const loadActors = useCallback(async () => {
    if (!contractsRef.current) return;
    const contracts = contractsRef.current;
    try {
      const total = await contracts.read.actorRegistry.getTotalActors();
      const n = Number(total);
      if (n === 0) { setActors([]); return; }
      const raw = await contracts.read.actorRegistry.getActorsPaginated(0, n);
      setActors(raw.map(parseActor));
    } catch (err) {
      console.error('loadActors:', err);
    }
  }, [contracts]);

  // ── Cargar un envío completo ──────────────────────────────
  const loadShipment = useCallback(async (id) => {
    if (!contractsRef.current) return null;
    const contracts = contractsRef.current;
    try {
      // getFullShipmentTracking retorna: (shipment, cps, incs, coldChainOk, cpCount, tempViolations)
      const result = await contracts.read.logisticsTracker.getFullShipmentTracking(id);
      const shipment = parseShipment(result.shipment);
      shipment.checkpoints    = result.cps.map(parseCheckpoint);   // campo: cps
      shipment.incidents      = result.incs.map(parseIncident);    // campo: incs
      shipment.coldChainOk    = result.coldChainOk;
      shipment.tempViolations = Number(result.tempViolations);
      return shipment;
    } catch (err) {
      console.error(`loadShipment(${id}):`, err);
      return null;
    }
  }, [contracts]);

  // ── Cargar todos los envíos ───────────────────────────────
  const loadAllShipments = useCallback(async () => {
    if (!contractsRef.current) return;
    const contracts = contractsRef.current;
    try {
      const total = await contracts.read.logisticsTracker.getTotalShipments();
      const count = Number(total);
      if (count === 0) { setShipments([]); return; }
      const promises = Array.from({ length: count }, (_, i) => loadShipment(i + 1));
      const results = await Promise.all(promises);
      setShipments(results.filter(Boolean));
    } catch (err) {
      console.error('loadAllShipments:', err);
    }
  }, [contracts, loadShipment]);

  // ── Stats del sistema ─────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!contractsRef.current) return;
    const contracts = contractsRef.current;
    try {
      const raw = await contracts.read.logisticsTracker.getSystemStats();
      setStats(prev => ({
        ...prev,
        totalShipments:   Number(raw.totalShipments),
        totalCheckpoints: Number(raw.totalCheckpoints),
        totalIncidents:   Number(raw.totalIncidents),
        totalActors:      Number(raw.totalActors),
      }));
    } catch (err) {
      console.error('loadStats:', err);
    }
  }, [contracts]);

  // ── Cargar productos ─────────────────────────────────────
  const loadProducts = useCallback(async () => {
    if (!contractsRef.current) return;
    const contracts = contractsRef.current;
    try {
      const total = await contracts.read.productRegistry.getTotalProducts();
      const n = Number(total);
      if (n === 0) { setProducts([]); return; }
      const raw = await contracts.read.productRegistry.getProductsPaginated(0, n);
      setProducts(raw.map(parseProduct));
    } catch (err) {
      console.error('loadProducts:', err);
    }
  }, []);

  // ── Resetear al cambiar de red ────────────────────────────
  useEffect(() => {
    if (!chainId) return;
    setActors([]);
    setShipments([]);
    setProducts([]);
    setStats({ totalShipments:0, totalCheckpoints:0, totalIncidents:0, totalActors:0, delivered:0, inTransit:0, incidents:0 });
    loadedRef.current = false;
  }, [chainId]);

  // ── Sincronizar rol desde la chain ────────────────────────
  useEffect(() => {
    if (!account || actors.length === 0) return;
    const myActor = actors.find(a => a.address?.toLowerCase() === account.toLowerCase());
    if (myActor && myActor.role !== actorRole) {
      updateActorRole(myActor.role, { name: myActor.name, location: myActor.location });
    }
  }, [actors, account, actorRole, updateActorRole]);

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => {
    if (!isConnected || !contracts || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    Promise.all([loadActors(), loadAllShipments(), loadStats(), loadProducts()])
      .finally(() => setLoading(false));
  }, [isConnected, contracts, loadActors, loadAllShipments, loadStats]);

  // ── Stats derivados ───────────────────────────────────────
  useEffect(() => {
    const delivered = shipments.filter(s => s.status === 4).length;
    const inTransit = shipments.filter(s => s.status === 1 || s.status === 3).length;
    const incidents = shipments.reduce((acc, s) =>
      acc + (s.incidents?.filter(i => !i.resolved).length || 0), 0);
    setStats(prev => ({ ...prev, delivered, inTransit, incidents }));
  }, [shipments]);

  // ── Refrescar un envío ────────────────────────────────────
  const refreshShipment = useCallback(async (id) => {
    const updated = await loadShipment(id);
    if (!updated) return;
    setShipments(prev => {
      const exists = prev.find(s => s.id === id);
      return exists ? prev.map(s => s.id === id ? updated : s) : [...prev, updated];
    });
    return updated;
  }, [loadShipment]);

  // ────────────────────────────────────────────────────────
  //  ESCRITURAS — signaturas exactas de los contratos reales
  // ────────────────────────────────────────────────────────

  // registerActor: el actor se registra a sí mismo (sin address)
  // registerActorFor: admin registra a otro (con address)
  const registerActor = useCallback(async (address, name, role, location) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const isOwn = address.toLowerCase() === account?.toLowerCase();
    let tx;
    if (isOwn) {
      // registerActor(string _name, uint8 _role, string _location)
      tx = await signed.actorRegistry.registerActor(name, role, location);
    } else {
      // registerActorFor(address _actorAddress, string _name, uint8 _role, string _location)
      tx = await signed.actorRegistry.registerActorFor(address, name, role, location);
    }
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await loadActors();
    await loadStats();
    return tx;
  }, [contracts, account, addToast, loadActors, loadStats]);

  // updateActor: solo (name, location) — el contrato no permite cambiar el rol
  const updateActor = useCallback(async (address, name, _role, location) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    // updateActor(string _name, string _location) — sin address ni role
    const tx = await signed.actorRegistry.updateActor(name, location);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await loadActors();
    return tx;
  }, [contracts, addToast, loadActors]);

  const deactivateActor = useCallback(async (address) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.actorRegistry.deactivateActor(address);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await loadActors();
    return tx;
  }, [contracts, addToast, loadActors]);

  const reactivateActor = useCallback(async (address) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.actorRegistry.reactivateActor(address);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await loadActors();
    return tx;
  }, [contracts, addToast, loadActors]);

  // createShipment: requiere _product como segundo parámetro
  const createShipment = useCallback(async ({ recipient, product, origin, destination, requiresColdChain, minTemp, maxTemp }) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    // createShipment(address _recipient, string _product, string _origin, string _destination, bool _requiresColdChain, int256 _minTemp, int256 _maxTemp)
    const tx = await signed.shipmentManager.createShipment(
      recipient,
      product || 'Sin descripción',
      origin,
      destination,
      requiresColdChain,
      BigInt(minTemp || 0),
      BigInt(maxTemp || 0)
    );
    addToast('Transacción enviada — esperando confirmación...', 'info');
    const receipt = await tx.wait();

    // Extraer shipmentId del evento ShipmentCreated
    let newId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = c.shipmentManager?.interface?.parseLog(log) ?? signed.shipmentManager.interface.parseLog(log);
        if (parsed?.name === 'ShipmentCreated') {
          newId = Number(parsed.args.shipmentId);
          break;
        }
      } catch {}
    }
    if (newId) await refreshShipment(newId);
    await loadStats();
    return { tx, shipmentId: newId };
  }, [contracts, addToast, refreshShipment, loadStats]);

  const updateShipmentStatus = useCallback(async (shipmentId, newStatus) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.shipmentManager.updateShipmentStatus(shipmentId, newStatus);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await refreshShipment(shipmentId);
    return tx;
  }, [contracts, addToast, refreshShipment]);

  const confirmDelivery = useCallback(async (shipmentId) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.shipmentManager.confirmDelivery(shipmentId);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await refreshShipment(shipmentId);
    return tx;
  }, [contracts, addToast, refreshShipment]);

  const cancelShipment = useCallback(async (shipmentId, reason = 'Cancelado por operador') => {
    const c = await getContracts();
    const signed = await c.getSigned();
    // cancelShipment(uint256 _shipmentId, string _reason)
    const tx = await signed.shipmentManager.cancelShipment(shipmentId, reason);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await refreshShipment(shipmentId);
    return tx;
  }, [contracts, addToast, refreshShipment]);

  // recordCheckpoint: orden correcto → (shipmentId, location, checkpointType, notes, temperature)
  const recordCheckpoint = useCallback(async (shipmentId, { location, type, temperature, notes }) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    // recordCheckpoint(uint256 _shipmentId, string _location, string _checkpointType, string _notes, int256 _temperature)
    const tx = await signed.checkpointTracker.recordCheckpoint(
      shipmentId,
      location,
      type,
      notes || '',
      BigInt(temperature || 0)
    );
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await refreshShipment(shipmentId);
    await loadStats();
    return tx;
  }, [contracts, addToast, refreshShipment, loadStats]);

  const reportIncident = useCallback(async (shipmentId, { type, severity, description }) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.incidentManager.reportIncident(shipmentId, type, severity, description);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await refreshShipment(shipmentId);
    await loadStats();
    return tx;
  }, [contracts, addToast, refreshShipment, loadStats]);

  const resolveIncident = useCallback(async (incidentId, resolution, shipmentId) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.incidentManager.resolveIncident(incidentId, resolution);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    if (shipmentId) await refreshShipment(shipmentId);
    await loadStats();
    return tx;
  }, [contracts, addToast, refreshShipment, loadStats]);

  // ── Crear producto (solo Remitente) ──────────────────────
  const createProduct = useCallback(async ({ name, description, sector, requiresColdChain, minTemp, maxTemp }) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.productRegistry.createProduct(
      name,
      description || '',
      sector,
      requiresColdChain,
      BigInt(requiresColdChain ? minTemp : 0),
      BigInt(requiresColdChain ? maxTemp : 0)
    );
    addToast('Transacción enviada — esperando confirmación...', 'info');
    const receipt = await tx.wait();

    // Extraer productId del evento ProductCreated
    let newId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = signed.productRegistry.interface.parseLog(log);
        if (parsed?.name === 'ProductCreated') {
          newId = Number(parsed.args.productId);
          break;
        }
      } catch {}
    }

    await loadProducts();
    return { tx, productId: newId };
  }, [addToast, loadProducts]);

  // ── Actualizar producto ───────────────────────────────────
  const updateProduct = useCallback(async (id, { name, description, sector, requiresColdChain, minTemp, maxTemp }) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.productRegistry.updateProduct(
      id, name, description || '', sector, requiresColdChain,
      BigInt(requiresColdChain ? minTemp : 0),
      BigInt(requiresColdChain ? maxTemp : 0)
    );
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await loadProducts();
    return tx;
  }, [addToast, loadProducts]);

  // ── Desactivar producto ───────────────────────────────────
  const deactivateProduct = useCallback(async (id) => {
    const c = await getContracts();
    const signed = await c.getSigned();
    const tx = await signed.productRegistry.deactivateProduct(id);
    addToast('Transacción enviada — esperando confirmación...', 'info');
    await tx.wait();
    await loadProducts();
    return tx;
  }, [addToast, loadProducts]);

  const getActorByAddress = useCallback((address) => {
    return actors.find(a => a.address?.toLowerCase() === address?.toLowerCase()) || null;
  }, [actors]);

  const refreshAll = useCallback(async () => {
    loadedRef.current = false;
    setLoading(true);
    await Promise.all([loadActors(), loadAllShipments(), loadStats(), loadProducts()]);
    setLoading(false);
    addToast('Datos sincronizados desde la blockchain ✓', 'success');
  }, [loadActors, loadAllShipments, loadStats, addToast]);

  // Wrap con handleTxError
  const wrap = (fn) => async (...args) => {
    try { return await fn(...args); }
    catch (e) { handleTxError(e); throw e; }
  };

  const value = {
    actors, shipments, products, stats, loading,
    toasts, addToast, removeToast,
    contractsReady: !!contracts,
    getActorByAddress, refreshShipment, refreshAll,
    registerActor:        wrap(registerActor),
    updateActor:          wrap(updateActor),
    deactivateActor:      wrap(deactivateActor),
    reactivateActor:      wrap(reactivateActor),
    createShipment:       wrap(createShipment),
    updateShipmentStatus: wrap(updateShipmentStatus),
    confirmDelivery:      wrap(confirmDelivery),
    cancelShipment:       wrap(cancelShipment),
    recordCheckpoint:     wrap(recordCheckpoint),
    reportIncident:       wrap(reportIncident),
    resolveIncident:      wrap(resolveIncident),
    products,
    createProduct:    wrap(createProduct),
    updateProduct:    wrap(updateProduct),
    deactivateProduct: wrap(deactivateProduct),
  };

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(BlockchainContext);
  if (!ctx) throw new Error('useApp must be used inside BlockchainProvider');
  return ctx;
}
