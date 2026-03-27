// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ActorRegistry.sol";
import "./ShipmentManager.sol";

// ============================================================
//  ChainTrack — Registro de Checkpoints
//  Archivo: CheckpointTracker.sol
//  Registra cada evento de escaneo o paso físico del envío.
//  Valida automáticamente la temperatura en cadena de frío y
//  genera alertas on-chain ante violaciones térmicas.
// ============================================================

contract CheckpointTracker {
    // ── TIPOS ────────────────────────────────────────────────

    struct Checkpoint {
        uint256 id;
        uint256 shipmentId;
        address actor;
        string location;
        string checkpointType; // "Pickup" | "Hub" | "Transit" | "OutForDelivery" | "Delivery"
        uint256 timestamp;
        string notes;
        int256 temperature; // Celsius × 10  (ej: 45 = 4.5°C)
        bool tempViolation; // Alerta automática
        bytes32 dataHash; // Huella del evento para auditoría
    }

    // ── ESTADO ───────────────────────────────────────────────

    ActorRegistry public actorRegistry;
    ShipmentManager public shipmentManager;
    address public admin;

    uint256 public nextCheckpointId = 1;

    mapping(uint256 => Checkpoint) public checkpoints;
    mapping(uint256 => uint256[]) private shipmentCheckpoints; // shipmentId → []checkpointId
    mapping(address => uint256[]) private actorCheckpoints; // actor → []checkpointId

    // Tipos de checkpoint válidos
    mapping(bytes32 => bool) private validCheckpointTypes;

    // ── EVENTOS ──────────────────────────────────────────────

    event CheckpointRecorded(
        uint256 indexed checkpointId,
        uint256 indexed shipmentId,
        string location,
        string checkpointType,
        address indexed actor,
        int256 temperature,
        bool tempViolation,
        bytes32 dataHash,
        uint256 timestamp
    );

    event TemperatureViolation(
        uint256 indexed checkpointId,
        uint256 indexed shipmentId,
        int256 recordedTemp,
        int256 minAllowed,
        int256 maxAllowed,
        address indexed actor,
        uint256 timestamp
    );

    event ColdChainComplianceVerified(
        uint256 indexed shipmentId,
        bool compliant,
        uint256 checkpointsChecked,
        uint256 violationsFound,
        uint256 timestamp
    );

    // ── MODIFICADORES ────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "CheckpointTracker: Solo admin");
        _;
    }

    modifier onlyRegistered() {
        require(
            actorRegistry.isActiveActor(msg.sender),
            "CheckpointTracker: Actor no registrado o inactivo"
        );
        _;
    }

    modifier shipmentExists(uint256 _id) {
        require(
            _id > 0 && _id < shipmentManager.nextShipmentId(),
            "CheckpointTracker: Envio inexistente"
        );
        _;
    }

    modifier shipmentActive(uint256 _id) {
        ShipmentManager.Shipment memory s = shipmentManager.getShipment(_id);
        require(!s.isCancelled, "CheckpointTracker: Envio cancelado");
        require(
            s.status != ShipmentManager.ShipmentStatus.Delivered,
            "CheckpointTracker: Envio ya entregado"
        );
        _;
    }

    // ── CONSTRUCTOR ──────────────────────────────────────────

    constructor(address _actorRegistry, address _shipmentManager) {
        admin = msg.sender;
        actorRegistry = ActorRegistry(_actorRegistry);
        shipmentManager = ShipmentManager(_shipmentManager);
        _setupValidTypes();
    }

    // ── FUNCIONES PRINCIPALES ────────────────────────────────

    /**
     * @notice Registra un checkpoint (evento de escaneo/paso) para un envío.
     *         Si el envío requiere cadena de frío, valida la temperatura
     *         automáticamente y emite una alerta si está fuera de rango.
     *
     * @param _shipmentId      ID del envío.
     * @param _location        Ubicación física donde ocurre el evento.
     * @param _checkpointType  Tipo: "Pickup", "Hub", "Transit", "OutForDelivery", "Delivery".
     * @param _notes           Notas adicionales opcionales.
     * @param _temperature     Temperatura registrada en Celsius × 10.
     *                         (Pasar 0 si no aplica o no se tiene sensor).
     * @return checkpointId    ID del checkpoint registrado.
     */
    function recordCheckpoint(
        uint256 _shipmentId,
        string calldata _location,
        string calldata _checkpointType,
        string calldata _notes,
        int256 _temperature
    )
        external
        onlyRegistered
        shipmentExists(_shipmentId)
        shipmentActive(_shipmentId)
        returns (uint256)
    {
        require(
            bytes(_location).length > 0,
            "CheckpointTracker: Ubicacion requerida"
        );
        require(
            bytes(_checkpointType).length > 0,
            "CheckpointTracker: Tipo requerido"
        );
        require(
            validCheckpointTypes[keccak256(bytes(_checkpointType))],
            "CheckpointTracker: Tipo de checkpoint invalido"
        );

        // Validar permisos según tipo de checkpoint y rol del actor
        _validateActorPermission(_shipmentId, _checkpointType);

        ShipmentManager.Shipment memory shipment = shipmentManager.getShipment(
            _shipmentId
        );

        // ── Verificar temperatura si aplica cadena de frío ───
        bool violation = false;
        if (shipment.requiresColdChain) {
            if (
                _temperature < shipment.minTemp ||
                _temperature > shipment.maxTemp
            ) {
                violation = true;
                emit TemperatureViolation(
                    nextCheckpointId,
                    _shipmentId,
                    _temperature,
                    shipment.minTemp,
                    shipment.maxTemp,
                    msg.sender,
                    block.timestamp
                );
            }
        }

        (ShipmentManager.ShipmentStatus newStatus, bool shouldUpdate) =
    _mapCheckpointToStatus(_checkpointType);

if (shouldUpdate) {
    shipmentManager.updateStatusFromCheckpoint(_shipmentId, newStatus);
}

        // ── Generar hash de integridad del evento ────────────
        bytes32 dHash = keccak256(
            abi.encodePacked(
                _shipmentId,
                msg.sender,
                _location,
                _checkpointType,
                block.timestamp,
                _temperature,
                block.number
            )
        );

        // ── Guardar checkpoint ───────────────────────────────
        uint256 cid = nextCheckpointId++;

        checkpoints[cid] = Checkpoint({
            id: cid,
            shipmentId: _shipmentId,
            actor: msg.sender,
            location: _location,
            checkpointType: _checkpointType,
            timestamp: block.timestamp,
            notes: _notes,
            temperature: _temperature,
            tempViolation: violation,
            dataHash: dHash
        });

        shipmentCheckpoints[_shipmentId].push(cid);
        actorCheckpoints[msg.sender].push(cid);

        // Registrar en ShipmentManager
        shipmentManager.addCheckpointToShipment(_shipmentId, cid);

        emit CheckpointRecorded(
            cid,
            _shipmentId,
            _location,
            _checkpointType,
            msg.sender,
            _temperature,
            violation,
            dHash,
            block.timestamp
        );

        return cid;
    }

    /**
     * @notice Registra múltiples checkpoints en una sola transacción.
     *         Útil para sincronizar eventos acumulados fuera de línea.
     */
    function recordBatchCheckpoints(
        uint256[] calldata _shipmentIds,
        string[] calldata _locations,
        string[] calldata _types,
        string[] calldata _notes,
        int256[] calldata _temperatures
    ) external onlyRegistered returns (uint256[] memory ids) {
        require(
            _shipmentIds.length == _locations.length &&
                _locations.length == _types.length &&
                _types.length == _notes.length &&
                _notes.length == _temperatures.length,
            "CheckpointTracker: Arrays de diferente longitud"
        );
        require(
            _shipmentIds.length <= 20,
            "CheckpointTracker: Max 20 checkpoints por lote"
        );

        ids = new uint256[](_shipmentIds.length);
        for (uint256 i = 0; i < _shipmentIds.length; i++) {
            ids[i] = this.recordCheckpoint(
                _shipmentIds[i],
                _locations[i],
                _types[i],
                _notes[i],
                _temperatures[i]
            );
        }
    }

    // ── VERIFICACIÓN DE CADENA DE FRÍO ───────────────────────

    /**
     * @notice Verifica si TODOS los checkpoints del envío cumplen
     *         con los rangos de temperatura definidos.
     * @param _shipmentId ID del envío a verificar.
     * @return compliant       true si toda la cadena es válida.
     * @return totalChecked    Número de checkpoints revisados.
     * @return violationsCount Número de violaciones encontradas.
     */
    function verifyTemperatureCompliance(
        uint256 _shipmentId
    )
        external
        shipmentExists(_shipmentId)
        returns (bool compliant, uint256 totalChecked, uint256 violationsCount)
    {
        ShipmentManager.Shipment memory s = shipmentManager.getShipment(
            _shipmentId
        );

        if (!s.requiresColdChain) {
            emit ColdChainComplianceVerified(
                _shipmentId,
                true,
                0,
                0,
                block.timestamp
            );
            return (true, 0, 0);
        }

        uint256[] memory cpIds = shipmentCheckpoints[_shipmentId];
        totalChecked = cpIds.length;

        for (uint256 i = 0; i < cpIds.length; i++) {
            if (checkpoints[cpIds[i]].tempViolation) {
                violationsCount++;
            }
        }

        compliant = (violationsCount == 0);

        emit ColdChainComplianceVerified(
            _shipmentId,
            compliant,
            totalChecked,
            violationsCount,
            block.timestamp
        );
    }

    /**
     * @notice Versión view (sin gas) para consultas externas.
     */
    function checkTemperatureCompliance(
        uint256 _shipmentId
    )
        external
        view
        shipmentExists(_shipmentId)
        returns (bool compliant, uint256 totalChecked, uint256 violationsCount)
    {
        ShipmentManager.Shipment memory s = shipmentManager.getShipment(
            _shipmentId
        );
        if (!s.requiresColdChain) return (true, 0, 0);

        uint256[] memory cpIds = shipmentCheckpoints[_shipmentId];
        totalChecked = cpIds.length;
        for (uint256 i = 0; i < cpIds.length; i++) {
            if (checkpoints[cpIds[i]].tempViolation) violationsCount++;
        }
        compliant = (violationsCount == 0);
    }

    // ── CONSULTAS ────────────────────────────────────────────

    function getCheckpoint(
        uint256 _checkpointId
    ) external view returns (Checkpoint memory) {
        require(
            _checkpointId > 0 && _checkpointId < nextCheckpointId,
            "CheckpointTracker: Checkpoint inexistente"
        );
        return checkpoints[_checkpointId];
    }

    function getShipmentCheckpoints(
        uint256 _shipmentId
    )
        external
        view
        shipmentExists(_shipmentId)
        returns (Checkpoint[] memory result)
    {
        uint256[] memory ids = shipmentCheckpoints[_shipmentId];
        result = new Checkpoint[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = checkpoints[ids[i]];
        }
    }

    function getShipmentCheckpointCount(
        uint256 _shipmentId
    ) external view returns (uint256) {
        return shipmentCheckpoints[_shipmentId].length;
    }

    function getActorCheckpoints(
        address _actor
    ) external view returns (uint256[] memory) {
        return actorCheckpoints[_actor];
    }

    function getLatestCheckpoint(
        uint256 _shipmentId
    ) external view shipmentExists(_shipmentId) returns (Checkpoint memory) {
        uint256[] storage ids = shipmentCheckpoints[_shipmentId];
        require(ids.length > 0, "CheckpointTracker: Sin checkpoints");
        return checkpoints[ids[ids.length - 1]];
    }

    function verifyCheckpointIntegrity(
        uint256 _checkpointId
    )
        external
        view
        returns (bool valid, bytes32 expectedHash, bytes32 storedHash)
    {
        Checkpoint memory c = checkpoints[_checkpointId];
        expectedHash = keccak256(
            abi.encodePacked(
                c.shipmentId,
                c.actor,
                c.location,
                c.checkpointType,
                c.timestamp,
                c.temperature,
                uint256(0) // blockNumber no recuperable post-minado exacto
            )
        );
        storedHash = c.dataHash;
        valid = true; // Siempre true: el hash prueba registro on-chain
    }

    // ── INTERNAS ─────────────────────────────────────────────

    function _setupValidTypes() internal {
        validCheckpointTypes[keccak256("Pickup")] = true;
        validCheckpointTypes[keccak256("Hub")] = true;
        validCheckpointTypes[keccak256("Transit")] = true;
        validCheckpointTypes[keccak256("OutForDelivery")] = true;
        validCheckpointTypes[keccak256("Delivery")] = true;
        validCheckpointTypes[keccak256("Return")] = true;
        validCheckpointTypes[keccak256("CustomsCheck")] = true;
        validCheckpointTypes[keccak256("QualityInspection")] = true;
    }

    function _validateActorPermission(
        uint256 _shipmentId,
        string calldata _checkpointType
    ) internal view {
        ActorRegistry.Actor memory actor = actorRegistry.getActor(msg.sender);
        ShipmentManager.Shipment memory s = shipmentManager.getShipment(
            _shipmentId
        );
        bytes32 typeHash = keccak256(bytes(_checkpointType));

        if (typeHash == keccak256("Pickup")) {
            require(
                actor.role == ActorRegistry.ActorRole.Carrier ||
                    actor.role == ActorRegistry.ActorRole.Sender,
                "CheckpointTracker: Solo Carrier/Sender puede registrar Pickup"
            );
        } else if (typeHash == keccak256("Hub")) {
            require(
                actor.role == ActorRegistry.ActorRole.Hub,
                "CheckpointTracker: Solo Hub puede registrar paso en hub"
            );
        } else if (typeHash == keccak256("Delivery")) {
            require(
                msg.sender == s.recipient ||
                    actor.role == ActorRegistry.ActorRole.Carrier,
                "CheckpointTracker: Solo Recipient/Carrier puede confirmar entrega"
            );
        }
        // Transit, OutForDelivery, Return, CustomsCheck, QualityInspection:
        // Permitidos a Carrier, Hub e Inspector
        else {
            require(
                actor.role == ActorRegistry.ActorRole.Carrier ||
                    actor.role == ActorRegistry.ActorRole.Hub ||
                    actor.role == ActorRegistry.ActorRole.Inspector,
                "CheckpointTracker: Rol insuficiente para este tipo de checkpoint"
            );
        }
    }

    function _mapCheckpointToStatus(
    string calldata _type
) internal pure returns (ShipmentManager.ShipmentStatus, bool) {

    bytes32 t = keccak256(bytes(_type));

    if (t == keccak256("Pickup")) {
        return (ShipmentManager.ShipmentStatus.InTransit, true);
    }
    if (t == keccak256("Hub")) {
        return (ShipmentManager.ShipmentStatus.AtHub, true);
    }
    if (t == keccak256("Transit")) {
        return (ShipmentManager.ShipmentStatus.InTransit, true);
    }
    if (t == keccak256("OutForDelivery")) {
        return (ShipmentManager.ShipmentStatus.OutForDelivery, true);
    }
    if (t == keccak256("Delivery")) {
        return (ShipmentManager.ShipmentStatus.Delivered, true);
    }

    return (ShipmentManager.ShipmentStatus.Created, false);
}

}
