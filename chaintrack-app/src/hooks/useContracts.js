import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  ADDRESSES,
  ActorRegistryABI,
  ShipmentManagerABI,
  CheckpointTrackerABI,
  IncidentManagerABI,
  LogisticsTrackerABI,
  ProductRegistryABI,
} from '../abis/index.js';

// ============================================================
//  useContracts(account)
//  Usa JsonRpcProvider directo a Anvil para lecturas,
//  y BrowserProvider solo para obtener el signer en escrituras.
//  Esto evita completamente el problema de INVALID_ARGUMENT
//  con window.ethereum durante la inicialización.
// ============================================================

const ANVIL_RPC = 'http://127.0.0.1:8545';

function buildContracts() {
  try {
    // Para LECTURAS: JsonRpcProvider con network explícita para evitar
    // llamadas async a eth_chainId que causan INVALID_ARGUMENT
    const network = new ethers.Network('anvil', 31337);
    const readProvider = new ethers.JsonRpcProvider(ANVIL_RPC, network, {
      staticNetwork: network,
    });

    const mc = (abi, addr, p) => new ethers.Contract(addr, abi, p);

    const read = {
      actorRegistry:     mc(ActorRegistryABI,     ADDRESSES.ActorRegistry,     readProvider),
      shipmentManager:   mc(ShipmentManagerABI,   ADDRESSES.ShipmentManager,   readProvider),
      checkpointTracker: mc(CheckpointTrackerABI, ADDRESSES.CheckpointTracker, readProvider),
      incidentManager:   mc(IncidentManagerABI,   ADDRESSES.IncidentManager,   readProvider),
      logisticsTracker:  mc(LogisticsTrackerABI,  ADDRESSES.LogisticsTracker,  readProvider),
      productRegistry:   mc(ProductRegistryABI,   ADDRESSES.ProductRegistry,   readProvider),
    };

    // Para ESCRITURAS: BrowserProvider solo cuando se necesita el signer
    // Se llama en el momento de la transacción, no durante la construcción
    const getSigned = async () => {
      if (!window.ethereum) throw new Error('MetaMask no disponible');
      const writeProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await writeProvider.getSigner();
      return {
        actorRegistry:     mc(ActorRegistryABI,     ADDRESSES.ActorRegistry,     signer),
        shipmentManager:   mc(ShipmentManagerABI,   ADDRESSES.ShipmentManager,   signer),
        checkpointTracker: mc(CheckpointTrackerABI, ADDRESSES.CheckpointTracker, signer),
        incidentManager:   mc(IncidentManagerABI,   ADDRESSES.IncidentManager,   signer),
        logisticsTracker:  mc(LogisticsTrackerABI,  ADDRESSES.LogisticsTracker,  signer),
        productRegistry:   mc(ProductRegistryABI,   ADDRESSES.ProductRegistry,   signer),
      };
    };

    console.log('useContracts: contratos construidos ✓ (JsonRpcProvider → Anvil)');
    return { read, getSigned };

  } catch (err) {
    console.error('buildContracts error:', err?.message || err);
    return null;
  }
}

export function useContracts(account) {
  const [contracts, setContracts] = useState(null);

  useEffect(() => {
    if (!account) {
      setContracts(null);
      return;
    }

    // Construir inmediatamente — JsonRpcProvider no depende de MetaMask
    const built = buildContracts();
    setContracts(built);

    // Al cambiar de red en MetaMask, reconstruir
    // Nota: chainChanged pasa el nuevo chainId como argumento — lo ignoramos
    const handleChainChanged = (_newChainId) => {
      // Pequeño delay para que MetaMask termine el cambio de red
      setTimeout(() => {
        const rebuilt = buildContracts();
        if (rebuilt) setContracts(rebuilt);
      }, 300);
    };

    if (window.ethereum) {
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  }, [account]);

  return contracts;
}

// ── Parsers ───────────────────────────────────────────────────

export function parseActor(raw) {
  if (!raw) return null;
  return {
    address:      raw.addr,
    name:         raw.name,
    role:         Number(raw.role),
    location:     raw.location,
    active:       raw.active,
    registeredAt: Number(raw.registeredAt) * 1000,
  };
}

export function parseShipment(raw) {
  if (!raw) return null;
  return {
    id:                Number(raw.id),
    sender:            raw.sender,
    recipient:         raw.recipient,
    product:           raw.product,
    origin:            raw.origin,
    destination:       raw.destination,
    status:            Number(raw.status),
    requiresColdChain: raw.requiresColdChain,
    minTemp:           Number(raw.minTemp),
    maxTemp:           Number(raw.maxTemp),
    isCancelled:       raw.isCancelled,
    createdAt:         Number(raw.dateCreated) * 1000,
    deliveredAt:       Number(raw.dateDelivered) > 0 ? Number(raw.dateDelivered) * 1000 : null,
    checkpointIds:     raw.checkpointIds.map(Number),
    incidentIds:       raw.incidentIds.map(Number),
  };
}

export function parseCheckpoint(raw) {
  if (!raw) return null;
  return {
    id:            Number(raw.id),
    shipmentId:    Number(raw.shipmentId),
    actor:         raw.actor,
    location:      raw.location,
    type:          raw.checkpointType,
    timestamp:     Number(raw.timestamp) * 1000,
    notes:         raw.notes,
    temperature:   Number(raw.temperature),
    tempViolation: raw.tempViolation,
    dataHash:      raw.dataHash,
  };
}

export function parseIncident(raw) {
  if (!raw) return null;
  return {
    id:                 Number(raw.id),
    shipmentId:         Number(raw.shipmentId),
    type:               Number(raw.incidentType),
    severity:           Number(raw.severity),
    reporter:           raw.reporter,
    description:        raw.description,
    reportedAt:         Number(raw.timestamp) * 1000,
    resolved:           raw.resolved,
    resolvedBy:         raw.resolvedBy,
    resolvedAt:         Number(raw.resolvedAt) > 0 ? Number(raw.resolvedAt) * 1000 : null,
    resolution:         raw.resolution,
    requiresInspection: raw.requiresInspection,
  };
}

export function parseProduct(raw) {
  if (!raw) return null;
  return {
    id:                Number(raw.id),
    owner:             raw.owner,
    name:              raw.name,
    description:       raw.description,
    sector:            raw.sector,
    requiresColdChain: raw.requiresColdChain,
    minTemp:           Number(raw.minTemp),
    maxTemp:           Number(raw.maxTemp),
    active:            raw.active,
    createdAt:         Number(raw.createdAt) * 1000,
  };
}
