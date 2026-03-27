// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ActorRegistry.sol";
import "./ShipmentManager.sol";

// ============================================================
//  ChainTrack — Gestión de Incidencias
//  Archivo: IncidentManager.sol
//  Registra, gestiona y resuelve incidencias durante el
//  transporte: daños, retrasos, pérdidas, violaciones de
//  temperatura, accesos no autorizados y retenciones.
// ============================================================

contract IncidentManager {
    // ── TIPOS ────────────────────────────────────────────────

    enum IncidentType {
        Delay, // 0 — Retraso
        Damage, // 1 — Daño físico
        Lost, // 2 — Paquete perdido
        TempViolation, // 3 — Temperatura fuera de rango
        Unauthorized, // 4 — Acceso no autorizado
        CustomsHold, // 5 — Retención aduanera
        Other // 6 — Otro
    }

    enum IncidentSeverity {
        Low, // 0 — Baja
        Medium, // 1 — Media
        High, // 2 — Alta
        Critical // 3 — Crítica (requiere acción inmediata)
    }

    struct Incident {
        uint256 id;
        uint256 shipmentId;
        IncidentType incidentType;
        IncidentSeverity severity;
        address reporter;
        string description;
        uint256 timestamp;
        bool resolved;
        address resolvedBy;
        uint256 resolvedAt;
        string resolution;
        bool requiresInspection;
    }

    // ── ESTADO ───────────────────────────────────────────────

    ActorRegistry public actorRegistry;
    ShipmentManager public shipmentManager;
    address public admin;

    uint256 public nextIncidentId = 1;

    mapping(uint256 => Incident) public incidents;
    mapping(uint256 => uint256[]) private shipmentIncidents; // shipmentId → []incidentId
    mapping(address => uint256[]) private reporterIncidents; // reporter  → []incidentId
    mapping(uint256 => uint256) public openIncidentCount; // shipmentId → open count

    // ── EVENTOS ──────────────────────────────────────────────

    event IncidentReported(
        uint256 indexed incidentId,
        uint256 indexed shipmentId,
        IncidentType incidentType,
        IncidentSeverity severity,
        address indexed reporter,
        bool requiresInspection,
        uint256 timestamp
    );

    event IncidentResolved(
        uint256 indexed incidentId,
        uint256 indexed shipmentId,
        address indexed resolvedBy,
        string resolution,
        uint256 timestamp
    );

    event CriticalIncidentAlert(
        uint256 indexed incidentId,
        uint256 indexed shipmentId,
        IncidentType incidentType,
        address reporter,
        uint256 timestamp
    );

    event InspectionRequested(
        uint256 indexed incidentId,
        uint256 indexed shipmentId,
        uint256 timestamp
    );

    // ── MODIFICADORES ────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "IncidentManager: Solo admin");
        _;
    }

    modifier onlyRegistered() {
        require(
            actorRegistry.isActiveActor(msg.sender),
            "IncidentManager: Actor no registrado o inactivo"
        );
        _;
    }

    modifier incidentExists(uint256 _id) {
        require(
            _id > 0 && _id < nextIncidentId,
            "IncidentManager: Incidencia inexistente"
        );
        _;
    }

    modifier shipmentExists(uint256 _id) {
        require(
            _id > 0 && _id < shipmentManager.nextShipmentId(),
            "IncidentManager: Envio inexistente"
        );
        _;
    }

    // ── CONSTRUCTOR ──────────────────────────────────────────

    constructor(address _actorRegistry, address _shipmentManager) {
        admin = msg.sender;
        actorRegistry = ActorRegistry(_actorRegistry);
        shipmentManager = ShipmentManager(_shipmentManager);
    }

    // ── FUNCIONES PRINCIPALES ────────────────────────────────

    /**
     * @notice Reporta una incidencia en un envío.
     *         Las incidencias Critical emiten una alerta adicional.
     *         Los tipos Damage, Lost y Unauthorized requieren inspección.
     *
     * @param _shipmentId    ID del envío afectado.
     * @param _incidentType  Tipo de incidencia.
     * @param _severity      Severidad: Low, Medium, High, Critical.
     * @param _description   Descripción detallada del problema.
     * @return incidentId    ID de la incidencia creada.
     */
    function reportIncident(
        uint256 _shipmentId,
        IncidentType _incidentType,
        IncidentSeverity _severity,
        string calldata _description
    ) external onlyRegistered shipmentExists(_shipmentId) returns (uint256) {
        require(
            bytes(_description).length > 0,
            "IncidentManager: Descripcion requerida"
        );

        ShipmentManager.Shipment memory s = shipmentManager.getShipment(
            _shipmentId
        );
        require(!s.isCancelled, "IncidentManager: Envio cancelado");

        // Determinar si requiere inspección física
        bool requiresInspection = (_incidentType == IncidentType.Damage ||
            _incidentType == IncidentType.Lost ||
            _incidentType == IncidentType.Unauthorized);

        uint256 iid = nextIncidentId++;

        incidents[iid] = Incident({
            id: iid,
            shipmentId: _shipmentId,
            incidentType: _incidentType,
            severity: _severity,
            reporter: msg.sender,
            description: _description,
            timestamp: block.timestamp,
            resolved: false,
            resolvedBy: address(0),
            resolvedAt: 0,
            resolution: "",
            requiresInspection: requiresInspection
        });

        shipmentIncidents[_shipmentId].push(iid);
        reporterIncidents[msg.sender].push(iid);
        openIncidentCount[_shipmentId]++;

        // Registrar en ShipmentManager
        shipmentManager.addIncidentToShipment(_shipmentId, iid);

        emit IncidentReported(
            iid,
            _shipmentId,
            _incidentType,
            _severity,
            msg.sender,
            requiresInspection,
            block.timestamp
        );

        // Alerta adicional si es crítica
        if (_severity == IncidentSeverity.Critical) {
            emit CriticalIncidentAlert(
                iid,
                _shipmentId,
                _incidentType,
                msg.sender,
                block.timestamp
            );
        }

        if (requiresInspection) {
            emit InspectionRequested(iid, _shipmentId, block.timestamp);
        }

        return iid;
    }

    /**
     * @notice Resuelve una incidencia abierta.
     *         Solo puede resolver: admin, inspector, o el reporter original.
     *
     * @param _incidentId  ID de la incidencia.
     * @param _resolution  Descripción de cómo fue resuelta.
     */
    function resolveIncident(
        uint256 _incidentId,
        string calldata _resolution
    ) external onlyRegistered incidentExists(_incidentId) {
        Incident storage inc = incidents[_incidentId];
        require(!inc.resolved, "IncidentManager: Ya resuelta");
        require(
            bytes(_resolution).length > 0,
            "IncidentManager: Resolucion requerida"
        );

        ActorRegistry.Actor memory actor = actorRegistry.getActor(msg.sender);

        require(
            msg.sender == inc.reporter ||
                msg.sender == admin ||
                actor.role == ActorRegistry.ActorRole.Inspector,
            "IncidentManager: Sin permiso para resolver"
        );

        inc.resolved = true;
        inc.resolvedBy = msg.sender;
        inc.resolvedAt = block.timestamp;
        inc.resolution = _resolution;

        if (openIncidentCount[inc.shipmentId] > 0) {
            openIncidentCount[inc.shipmentId]--;
        }

        emit IncidentResolved(
            _incidentId,
            inc.shipmentId,
            msg.sender,
            _resolution,
            block.timestamp
        );
    }

    /**
     * @notice Actualiza la severidad de una incidencia abierta.
     *         Solo admin o inspector.
     */
    function updateSeverity(
        uint256 _incidentId,
        IncidentSeverity _newSeverity
    ) external incidentExists(_incidentId) {
        ActorRegistry.Actor memory actor = actorRegistry.getActor(msg.sender);
        require(
            msg.sender == admin ||
                actor.role == ActorRegistry.ActorRole.Inspector,
            "IncidentManager: Sin permiso"
        );
        require(
            !incidents[_incidentId].resolved,
            "IncidentManager: Incidencia ya resuelta"
        );

        incidents[_incidentId].severity = _newSeverity;

        if (_newSeverity == IncidentSeverity.Critical) {
            Incident memory inc = incidents[_incidentId];
            emit CriticalIncidentAlert(
                _incidentId,
                inc.shipmentId,
                inc.incidentType,
                inc.reporter,
                block.timestamp
            );
        }
    }

    // ── CONSULTAS ────────────────────────────────────────────

    function getIncident(
        uint256 _incidentId
    ) external view incidentExists(_incidentId) returns (Incident memory) {
        return incidents[_incidentId];
    }

    function getShipmentIncidents(
        uint256 _shipmentId
    )
        external
        view
        shipmentExists(_shipmentId)
        returns (Incident[] memory result)
    {
        uint256[] memory ids = shipmentIncidents[_shipmentId];
        result = new Incident[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = incidents[ids[i]];
        }
    }

    function getOpenIncidents(
        uint256 _shipmentId
    ) external view returns (Incident[] memory result) {
        uint256[] memory ids = shipmentIncidents[_shipmentId];
        uint256 count = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (!incidents[ids[i]].resolved) count++;
        }
        result = new Incident[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (!incidents[ids[i]].resolved) {
                result[idx++] = incidents[ids[i]];
            }
        }
    }

    function hasOpenIncidents(
        uint256 _shipmentId
    ) external view returns (bool) {
        return openIncidentCount[_shipmentId] > 0;
    }

    function getReporterIncidents(
        address _reporter
    ) external view returns (uint256[] memory) {
        return reporterIncidents[_reporter];
    }

    function getTotalIncidents() external view returns (uint256) {
        return nextIncidentId - 1;
    }
}
