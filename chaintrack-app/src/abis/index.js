// ============================================================
//  ABIs exactos extraídos de los contratos compilados
//  Direcciones del último deploy en Anvil (run-latest.json)
// ============================================================

// IMPORTANTE: Después de redesployar, actualizar ProductRegistry con la nueva dirección
export const ADDRESSES = {
  ActorRegistry     : "0xfbC22278A96299D91d41C453234d97b4F5Eb9B2d",
  ShipmentManager   : "0x46b142DD1E924FAb83eCc3c08e4D46E82f005e0E",
  CheckpointTracker : "0xC9a43158891282A2B1475592D5719c001986Aaec",
  IncidentManager   : "0x1c85638e118b37167e9298c2268758e058DdfDA0",
  LogisticsTracker  : "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb",
  ProductRegistry   : "0x4C2F7092C2aE51D986bEFEe378e50BD4dB99C901"
};

// ── ActorRegistry ─────────────────────────────────────────────
// IMPORTANTE: registerActor NO recibe address — el actor se registra a sí mismo
// registerActorFor SÍ recibe address — el admin registra a otro
export const ActorRegistryABI = [
  "function registerActor(string _name, uint8 _role, string _location) external",
  "function registerActorFor(address _actorAddress, string _name, uint8 _role, string _location) external",
  "function updateActor(string _name, string _location) external",
  "function deactivateActor(address _actorAddress) external",
  "function reactivateActor(address _actorAddress) external",
  "function getActor(address _actorAddress) external view returns (tuple(address addr, string name, uint8 role, string location, bool active, uint256 registeredAt))",
  "function isActiveActor(address _actorAddress) external view returns (bool)",
  "function hasRole(address _actorAddress, uint8 _role) external view returns (bool)",
  "function getTotalActors() external view returns (uint256)",
  "function getActorsPaginated(uint256 _offset, uint256 _limit) external view returns (tuple(address addr, string name, uint8 role, string location, bool active, uint256 registeredAt)[])",
  "event ActorRegistered(address indexed actor, uint8 role, string name)",
  "event ActorUpdated(address indexed actor)",
  "event ActorDeactivated(address indexed actor)",
];

// ── ShipmentManager ───────────────────────────────────────────
// IMPORTANTE: createShipment requiere el campo _product
// cancelShipment y initiateReturn requieren _reason string
export const ShipmentManagerABI = [
  "function createShipment(address _recipient, string _product, string _origin, string _destination, bool _requiresColdChain, int256 _minTemp, int256 _maxTemp) external returns (uint256)",
  "function updateShipmentStatus(uint256 _shipmentId, uint8 _newStatus) external",
  "function confirmDelivery(uint256 _shipmentId) external",
  "function cancelShipment(uint256 _shipmentId, string _reason) external",
  "function initiateReturn(uint256 _shipmentId, string _reason) external",
  "function getShipment(uint256 _shipmentId) external view returns (tuple(uint256 id, address sender, address recipient, string product, string origin, string destination, uint256 dateCreated, uint256 dateDelivered, uint8 status, uint256[] checkpointIds, uint256[] incidentIds, bool requiresColdChain, int256 minTemp, int256 maxTemp, bool isCancelled))",
  "function getTotalShipments() external view returns (uint256)",
  "function getSenderShipments(address _sender) external view returns (uint256[])",
  "function getRecipientShipments(address _recipient) external view returns (uint256[])",
  "function getActorShipments(address _actor) external view returns (uint256[])",
  "event ShipmentCreated(uint256 indexed shipmentId, address indexed sender, address indexed recipient, string product)",
  "event ShipmentStatusUpdated(uint256 indexed shipmentId, uint8 newStatus)",
  "event ShipmentDelivered(uint256 indexed shipmentId)",
];

// ── CheckpointTracker ─────────────────────────────────────────
// IMPORTANTE: orden de parámetros: (shipmentId, location, checkpointType, notes, temperature)
// notes va ANTES que temperature
export const CheckpointTrackerABI = [
  "function recordCheckpoint(uint256 _shipmentId, string _location, string _checkpointType, string _notes, int256 _temperature) external returns (uint256)",
  "function getCheckpoint(uint256 _checkpointId) external view returns (tuple(uint256 id, uint256 shipmentId, address actor, string location, string checkpointType, uint256 timestamp, string notes, int256 temperature, bool tempViolation, bytes32 dataHash))",
  "function getShipmentCheckpoints(uint256 _shipmentId) external view returns (uint256[])",
  "function getLatestCheckpoint(uint256 _shipmentId) external view returns (tuple(uint256 id, uint256 shipmentId, address actor, string location, string checkpointType, uint256 timestamp, string notes, int256 temperature, bool tempViolation, bytes32 dataHash))",
  "function verifyTemperatureCompliance(uint256 _shipmentId) external view returns (bool ok, uint256 violations)",
  "event CheckpointRecorded(uint256 indexed checkpointId, uint256 indexed shipmentId, address indexed actor)",
  "event TemperatureViolation(uint256 indexed checkpointId, uint256 indexed shipmentId, int256 temperature)",
];

// ── IncidentManager ───────────────────────────────────────────
export const IncidentManagerABI = [
  "function reportIncident(uint256 _shipmentId, uint8 _incidentType, uint8 _severity, string _description) external returns (uint256)",
  "function resolveIncident(uint256 _incidentId, string _resolution) external",
  "function updateSeverity(uint256 _incidentId, uint8 _newSeverity) external",
  "function getIncident(uint256 _incidentId) external view returns (tuple(uint256 id, uint256 shipmentId, uint8 incidentType, uint8 severity, address reporter, string description, uint256 timestamp, bool resolved, address resolvedBy, uint256 resolvedAt, string resolution, bool requiresInspection))",
  "function getShipmentIncidents(uint256 _shipmentId) external view returns (uint256[])",
  "function getOpenIncidents(uint256 _shipmentId) external view returns (uint256[])",
  "function hasOpenIncidents(uint256 _shipmentId) external view returns (bool)",
  "function getTotalIncidents() external view returns (uint256)",
  "event IncidentReported(uint256 indexed incidentId, uint256 indexed shipmentId, address indexed reporter)",
  "event IncidentResolved(uint256 indexed incidentId, address resolvedBy)",
];

// ── LogisticsTracker (facade) ─────────────────────────────────
// IMPORTANTE: retorna (shipment, cps, incs, coldChainOk, cpCount, tempViolations)
// también expone registerActor y registerActorFor directamente
export const LogisticsTrackerABI = [
  "function createShipment(address _recipient, string _product, string _origin, string _destination, bool _requiresColdChain, int256 _minTemp, int256 _maxTemp) external returns (uint256)",
  "function registerActor(string _name, uint8 _role, string _location) external",
  "function registerActorFor(address _actorAddress, string _name, uint8 _role, string _location) external",
  "function recordCheckpoint(uint256 _shipmentId, string _location, string _checkpointType, string _notes, int256 _temperature) external returns (uint256)",
  "function reportIncident(uint256 _shipmentId, uint8 _incidentType, uint8 _severity, string _description) external returns (uint256)",
  "function resolveIncident(uint256 _incidentId, string _resolution) external",
  "function confirmDelivery(uint256 _shipmentId) external",
  "function cancelShipment(uint256 _shipmentId, string _reason) external",
  "function updateShipmentStatus(uint256 _shipmentId, uint8 _newStatus) external",
  "function deactivateActor(address _actorAddress) external",
  "function getFullShipmentTracking(uint256 _shipmentId) external view returns (tuple(uint256 id, address sender, address recipient, string product, string origin, string destination, uint256 dateCreated, uint256 dateDelivered, uint8 status, uint256[] checkpointIds, uint256[] incidentIds, bool requiresColdChain, int256 minTemp, int256 maxTemp, bool isCancelled) shipment, tuple(uint256 id, uint256 shipmentId, address actor, string location, string checkpointType, uint256 timestamp, string notes, int256 temperature, bool tempViolation, bytes32 dataHash)[] cps, tuple(uint256 id, uint256 shipmentId, uint8 incidentType, uint8 severity, address reporter, string description, uint256 timestamp, bool resolved, address resolvedBy, uint256 resolvedAt, string resolution, bool requiresInspection)[] incs, bool coldChainOk, uint256 cpCount, uint256 tempViolations)",
  "function getSystemStats() external view returns (uint256 totalShipments, uint256 totalCheckpoints, uint256 totalIncidents, uint256 totalActors, string version)",
  "function getActor(address _actorAddress) external view returns (tuple(address addr, string name, uint8 role, string location, bool active, uint256 registeredAt))",
  "function getTotalShipments() external view returns (uint256)",
];

// ── ProductRegistry ───────────────────────────────────────────
// Solo Remitentes (rol Sender) pueden crear/gestionar productos
export const ProductRegistryABI = [
  "function createProduct(string _name, string _description, string _sector, bool _requiresColdChain, int256 _minTemp, int256 _maxTemp) external returns (uint256)",
  "function updateProduct(uint256 _id, string _name, string _description, string _sector, bool _requiresColdChain, int256 _minTemp, int256 _maxTemp) external",
  "function deactivateProduct(uint256 _id) external",
  "function getProduct(uint256 _id) external view returns (tuple(uint256 id, address owner, string name, string description, string sector, bool requiresColdChain, int256 minTemp, int256 maxTemp, bool active, uint256 createdAt))",
  "function getOwnerProducts(address _owner) external view returns (uint256[])",
  "function getMyProducts() external view returns (tuple(uint256 id, address owner, string name, string description, string sector, bool requiresColdChain, int256 minTemp, int256 maxTemp, bool active, uint256 createdAt)[])",
  "function getTotalProducts() external view returns (uint256)",
  "function getProductsPaginated(uint256 _offset, uint256 _limit) external view returns (tuple(uint256 id, address owner, string name, string description, string sector, bool requiresColdChain, int256 minTemp, int256 maxTemp, bool active, uint256 createdAt)[])",
  "event ProductCreated(uint256 indexed productId, address indexed owner, string name, string sector)",
  "event ProductUpdated(uint256 indexed productId, address indexed owner)",
  "event ProductDeactivated(uint256 indexed productId)",
];
