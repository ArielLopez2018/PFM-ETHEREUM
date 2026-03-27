// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ActorRegistry.sol";
import "./ShipmentManager.sol";
import "./CheckpointTracker.sol";
import "./IncidentManager.sol";

// ============================================================
//  ChainTrack — Contrato Principal (Facade / Orquestador)
//  Archivo: LogisticsTracker.sol
//
//  Punto de entrada único para el frontend y sistemas externos.
//  Agrega y coordina los 4 contratos del sistema.
//
//  ARQUITECTURA:
//  ┌─────────────────────────────────────────┐
//  │          LogisticsTracker (Facade)      │
//  │                                         │
//  │  ┌───────────────┐  ┌────────────────┐  │
//  │  │ ActorRegistry │  │ShipmentManager │  │
//  │  └───────────────┘  └────────────────┘  │
//  │  ┌──────────────────┐  ┌─────────────┐  │
//  │  │CheckpointTracker │  │IncidentMgr  │  │
//  │  └──────────────────┘  └─────────────┘  │
//  └─────────────────────────────────────────┘
// ============================================================

contract LogisticsTracker {
    // ── CONTRATOS DESPLEGADOS ────────────────────────────────

    ActorRegistry public actorRegistry;
    ShipmentManager public shipmentManager;
    CheckpointTracker public checkpointTracker;
    IncidentManager public incidentManager;

    address public admin;
    string public constant VERSION = "1.2.0";
    uint256 public deployedAt;

    // ── EVENTOS DEL FACADE ───────────────────────────────────

    event SystemInitialized(
        address actorRegistry,
        address shipmentManager,
        address checkpointTracker,
        address incidentManager,
        uint256 timestamp
    );

    event AdminTransferred(
        address indexed oldAdmin,
        address indexed newAdmin,
        uint256 timestamp
    );

    // ── MODIFICADORES ────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "LogisticsTracker: Solo admin");
        _;
    }

    // ── CONSTRUCTOR ──────────────────────────────────────────

    constructor(
        address _actorRegistry,
        address _shipmentManager,
        address _checkpointTracker,
        address _incidentManager
    ) {
        admin = msg.sender;
        deployedAt = block.timestamp;
        actorRegistry = ActorRegistry(_actorRegistry);
        shipmentManager = ShipmentManager(_shipmentManager);
        checkpointTracker = CheckpointTracker(_checkpointTracker);
        incidentManager = IncidentManager(_incidentManager);

        emit SystemInitialized(
            _actorRegistry,
            _shipmentManager,
            _checkpointTracker,
            _incidentManager,
            block.timestamp
        );
    }

    // ══════════════════════════════════════════════════════════
    //  SECCIÓN 1 — ACTORES
    // ══════════════════════════════════════════════════════════

    /**
     * @notice Registra al caller como actor en la red logística.
     */
    function registerActor(
        string calldata _name,
        ActorRegistry.ActorRole _role,
        string calldata _location
    ) external {
        actorRegistry.registerActor(_name, _role, _location);
    }

    /**
     * @notice Admin registra un actor para una dirección específica.
     */
    function registerActorFor(
        address _actorAddress,
        string calldata _name,
        ActorRegistry.ActorRole _role,
        string calldata _location
    ) external onlyAdmin {
        actorRegistry.registerActorFor(_actorAddress, _name, _role, _location);
    }

    function deactivateActor(address _actorAddress) external onlyAdmin {
        actorRegistry.deactivateActor(_actorAddress);
    }

    function getActor(
        address _actorAddress
    ) external view returns (ActorRegistry.Actor memory) {
        return actorRegistry.getActor(_actorAddress);
    }

    function isActiveActor(address _actorAddress) external view returns (bool) {
        return actorRegistry.isActiveActor(_actorAddress);
    }

    // ══════════════════════════════════════════════════════════
    //  SECCIÓN 2 — ENVÍOS
    // ══════════════════════════════════════════════════════════

    /**
     * @notice Crea un nuevo envío en la blockchain.
     *
     * Ejemplo de uso para medicamento refrigerado (2°C – 8°C):
     *   createShipment(recipientAddr, "Insulina", "Madrid", "Barcelona",
     *                  true, 20, 80)
     *   → minTemp=20 (2.0°C × 10), maxTemp=80 (8.0°C × 10)
     */
    function createShipment(
        address _recipient,
        string calldata _product,
        string calldata _origin,
        string calldata _destination,
        bool _requiresColdChain,
        int256 _minTemp,
        int256 _maxTemp
    ) external returns (uint256) {
        return
            shipmentManager.createShipment(
                _recipient,
                _product,
                _origin,
                _destination,
                _requiresColdChain,
                _minTemp,
                _maxTemp
            );
    }

    function updateShipmentStatus(
        uint256 _shipmentId,
        ShipmentManager.ShipmentStatus _newStatus
    ) external {
        shipmentManager.updateShipmentStatus(_shipmentId, _newStatus);
    }

    function confirmDelivery(uint256 _shipmentId) external {
        shipmentManager.confirmDelivery(_shipmentId);
    }

    function cancelShipment(
        uint256 _shipmentId,
        string calldata _reason
    ) external {
        shipmentManager.cancelShipment(_shipmentId, _reason);
    }

    function initiateReturn(
        uint256 _shipmentId,
        string calldata _reason
    ) external {
        shipmentManager.initiateReturn(_shipmentId, _reason);
    }

    function getShipment(
        uint256 _shipmentId
    ) external view returns (ShipmentManager.Shipment memory) {
        return shipmentManager.getShipment(_shipmentId);
    }

    function getActorShipments(
        address _actor
    ) external view returns (uint256[] memory) {
        return shipmentManager.getActorShipments(_actor);
    }

    function getTotalShipments() external view returns (uint256) {
        return shipmentManager.getTotalShipments();
    }

    // ══════════════════════════════════════════════════════════
    //  SECCIÓN 3 — CHECKPOINTS
    // ══════════════════════════════════════════════════════════

    /**
     * @notice Registra un checkpoint de trazabilidad.
     *         Tipos válidos: "Pickup" | "Hub" | "Transit" |
     *                        "OutForDelivery" | "Delivery" |
     *                        "Return" | "CustomsCheck" | "QualityInspection"
     */
    function recordCheckpoint(
        uint256 _shipmentId,
        string calldata _location,
        string calldata _checkpointType,
        string calldata _notes,
        int256 _temperature
    ) external returns (uint256) {
        return
            checkpointTracker.recordCheckpoint(
                _shipmentId,
                _location,
                _checkpointType,
                _notes,
                _temperature
            );
    }

    function getCheckpoint(
        uint256 _checkpointId
    ) external view returns (CheckpointTracker.Checkpoint memory) {
        return checkpointTracker.getCheckpoint(_checkpointId);
    }

    function getShipmentCheckpoints(
        uint256 _shipmentId
    ) external view returns (CheckpointTracker.Checkpoint[] memory) {
        return checkpointTracker.getShipmentCheckpoints(_shipmentId);
    }

    function getLatestCheckpoint(
        uint256 _shipmentId
    ) external view returns (CheckpointTracker.Checkpoint memory) {
        return checkpointTracker.getLatestCheckpoint(_shipmentId);
    }

    /**
     * @notice Verifica cumplimiento de cadena de frío.
     * @return compliant       true = sin violaciones.
     * @return totalChecked    checkpoints evaluados.
     * @return violationsCount alertas de temperatura registradas.
     */
    function checkTemperatureCompliance(
        uint256 _shipmentId
    )
        external
        view
        returns (bool compliant, uint256 totalChecked, uint256 violationsCount)
    {
        return checkpointTracker.checkTemperatureCompliance(_shipmentId);
    }

    // ══════════════════════════════════════════════════════════
    //  SECCIÓN 4 — INCIDENCIAS
    // ══════════════════════════════════════════════════════════

    /**
     * @notice Reporta una incidencia en un envío.
     *         Tipos: Delay | Damage | Lost | TempViolation |
     *                Unauthorized | CustomsHold | Other
     *         Severidad: Low | Medium | High | Critical
     */
    function reportIncident(
        uint256 _shipmentId,
        IncidentManager.IncidentType _incidentType,
        IncidentManager.IncidentSeverity _severity,
        string calldata _description
    ) external returns (uint256) {
        return
            incidentManager.reportIncident(
                _shipmentId,
                _incidentType,
                _severity,
                _description
            );
    }

    function resolveIncident(
        uint256 _incidentId,
        string calldata _resolution
    ) external {
        incidentManager.resolveIncident(_incidentId, _resolution);
    }

    function getIncident(
        uint256 _incidentId
    ) external view returns (IncidentManager.Incident memory) {
        return incidentManager.getIncident(_incidentId);
    }

    function getShipmentIncidents(
        uint256 _shipmentId
    ) external view returns (IncidentManager.Incident[] memory) {
        return incidentManager.getShipmentIncidents(_shipmentId);
    }

    function getOpenIncidents(
        uint256 _shipmentId
    ) external view returns (IncidentManager.Incident[] memory) {
        return incidentManager.getOpenIncidents(_shipmentId);
    }

    function hasOpenIncidents(
        uint256 _shipmentId
    ) external view returns (bool) {
        return incidentManager.hasOpenIncidents(_shipmentId);
    }

    // ══════════════════════════════════════════════════════════
    //  SECCIÓN 5 — CONSULTAS AGREGADAS (FULL TRACKING VIEW)
    // ══════════════════════════════════════════════════════════

    /**
     * @notice Devuelve el estado completo de un envío:
     *         datos del envío + todos sus checkpoints + todas sus incidencias.
     *         Función ideal para el panel de tracking del frontend.
     */
    function getFullShipmentTracking(
        uint256 _shipmentId
    )
        external
        view
        returns (
            ShipmentManager.Shipment memory shipment,
            CheckpointTracker.Checkpoint[] memory cps,
            IncidentManager.Incident[] memory incs,
            bool coldChainOk,
            uint256 cpCount,
            uint256 tempViolations
        )
    {
        shipment = shipmentManager.getShipment(_shipmentId);
        cps = checkpointTracker.getShipmentCheckpoints(_shipmentId);
        incs = incidentManager.getShipmentIncidents(_shipmentId);

        (coldChainOk, cpCount, tempViolations) = checkpointTracker
            .checkTemperatureCompliance(_shipmentId);
    }

    /**
     * @notice Resumen del sistema: totales de envíos, checkpoints e incidencias.
     */
    function getSystemStats()
        external
        view
        returns (
            uint256 totalShipments,
            uint256 totalCheckpoints,
            uint256 totalIncidents,
            uint256 totalActors,
            string memory version
        )
    {
        totalShipments = shipmentManager.getTotalShipments();
        totalCheckpoints = checkpointTracker.nextCheckpointId() - 1;
        totalIncidents = incidentManager.getTotalIncidents();
        totalActors = actorRegistry.getTotalActors();
        version = VERSION;
    }

    // ── ADMIN ────────────────────────────────────────────────

    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(
            _newAdmin != address(0),
            "LogisticsTracker: Direccion invalida"
        );
        emit AdminTransferred(admin, _newAdmin, block.timestamp);
        admin = _newAdmin;
    }
}
