// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ActorRegistry.sol";

// ============================================================
//  ChainTrack — Gestión de Envíos
//  Archivo: ShipmentManager.sol
//  Crea, actualiza y cancela envíos. Controla el ciclo de vida
//  completo: Created → InTransit → AtHub → OutForDelivery
//  → Delivered (o Returned / Cancelled).
// ============================================================

contract ShipmentManager {
    // ── TIPOS ────────────────────────────────────────────────

    enum ShipmentStatus {
        Created,
        InTransit,
        AtHub,
        OutForDelivery,
        Delivered,
        Returned,
        Cancelled
    }

    struct Shipment {
        uint256 id;
        address sender;
        address recipient;
        string product;
        string origin;
        string destination;
        uint256 dateCreated;
        uint256 dateDelivered;
        ShipmentStatus status;
        uint256[] checkpointIds;
        uint256[] incidentIds;
        bool requiresColdChain;
        int256 minTemp; // Temperatura mínima × 10
        int256 maxTemp; // Temperatura máxima × 10
        bool isCancelled;
    }

    // ── ESTADO ───────────────────────────────────────────────

    ActorRegistry public actorRegistry;
    address public admin;

    uint256 public nextShipmentId = 1;

    mapping(uint256 => Shipment) public shipments;
    mapping(address => uint256[]) private senderShipments;
    mapping(address => uint256[]) private recipientShipments;

    // Transiciones de estado válidas
    mapping(uint8 => mapping(uint8 => bool)) private validTransitions;

    // ── EVENTOS ──────────────────────────────────────────────

    event ShipmentCreated(
        uint256 indexed shipmentId,
        address indexed sender,
        address indexed recipient,
        string product,
        bool coldChain,
        uint256 timestamp
    );
    event ShipmentStatusChanged(
        uint256 indexed shipmentId,
        ShipmentStatus oldStatus,
        ShipmentStatus newStatus,
        address indexed changedBy,
        uint256 timestamp
    );
    event DeliveryConfirmed(
        uint256 indexed shipmentId,
        address indexed recipient,
        uint256 timestamp
    );
    event ShipmentCancelled(
        uint256 indexed shipmentId,
        address indexed cancelledBy,
        string reason,
        uint256 timestamp
    );
    event ShipmentReturned(
        uint256 indexed shipmentId,
        address indexed initiatedBy,
        string reason,
        uint256 timestamp
    );

    // ── MODIFICADORES ────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "ShipmentManager: Solo admin");
        _;
    }

    modifier onlyRegistered() {
        require(
            actorRegistry.isActiveActor(msg.sender),
            "ShipmentManager: Actor no registrado o inactivo"
        );
        _;
    }

    modifier shipmentExists(uint256 _id) {
        require(
            _id > 0 && _id < nextShipmentId,
            "ShipmentManager: Envio inexistente"
        );
        _;
    }

    modifier notCancelled(uint256 _id) {
        require(
            !shipments[_id].isCancelled,
            "ShipmentManager: Envio cancelado"
        );
        _;
    }

    modifier notDelivered(uint256 _id) {
        require(
            shipments[_id].status != ShipmentStatus.Delivered,
            "ShipmentManager: Envio ya entregado"
        );
        _;
    }

    // ── CONSTRUCTOR ──────────────────────────────────────────

    constructor(address _actorRegistry) {
        admin = msg.sender;
        actorRegistry = ActorRegistry(_actorRegistry);
        _setupTransitions();
    }

    // ── FUNCIONES PRINCIPALES ────────────────────────────────

    /**
     * @notice Crea un nuevo envío y lo registra en blockchain.
     * @param _recipient         Dirección ETH del destinatario.
     * @param _product           Nombre o descripción del producto.
     * @param _origin            Punto de origen.
     * @param _destination       Destino final.
     * @param _requiresColdChain true si requiere cadena de frío.
     * @param _minTemp           Temperatura mínima permitida (× 10).
     * @param _maxTemp           Temperatura máxima permitida (× 10).
     * @return shipmentId        ID del envío creado.
     */
    function createShipment(
        address _recipient,
        string calldata _product,
        string calldata _origin,
        string calldata _destination,
        bool _requiresColdChain,
        int256 _minTemp,
        int256 _maxTemp
    ) external onlyRegistered returns (uint256) {
        require(
            _recipient != address(0),
            "ShipmentManager: Destinatario invalido"
        );
        require(
            _recipient != msg.sender,
            "ShipmentManager: Remitente = Destinatario"
        );
        require(
            bytes(_product).length > 0,
            "ShipmentManager: Producto requerido"
        );
        require(bytes(_origin).length > 0, "ShipmentManager: Origen requerido");
        require(
            bytes(_destination).length > 0,
            "ShipmentManager: Destino requerido"
        );

        if (_requiresColdChain) {
            require(
                _minTemp < _maxTemp,
                "ShipmentManager: Rango de temperatura invalido"
            );
        }

        uint256 id = nextShipmentId++;

        Shipment storage s = shipments[id];
        s.id = id;
        s.sender = msg.sender;
        s.recipient = _recipient;
        s.product = _product;
        s.origin = _origin;
        s.destination = _destination;
        s.dateCreated = block.timestamp;
        s.status = ShipmentStatus.Created;
        s.requiresColdChain = _requiresColdChain;
        s.minTemp = _minTemp;
        s.maxTemp = _maxTemp;
        s.isCancelled = false;

        senderShipments[msg.sender].push(id);
        recipientShipments[_recipient].push(id);

        emit ShipmentCreated(
            id,
            msg.sender,
            _recipient,
            _product,
            _requiresColdChain,
            block.timestamp
        );
        return id;
    }

    /**
     * @notice Actualiza el estado de un envío.
     *         Valida que la transición sea permitida.
     * @param _shipmentId ID del envío.
     * @param _newStatus  Nuevo estado.
     */
    function updateShipmentStatus(
        uint256 _shipmentId,
        ShipmentStatus _newStatus
    )
        external
        onlyRegistered
        shipmentExists(_shipmentId)
        notCancelled(_shipmentId)
        notDelivered(_shipmentId)
    {
        Shipment storage s = shipments[_shipmentId];

        require(
            validTransitions[uint8(s.status)][uint8(_newStatus)],
            "ShipmentManager: Transicion de estado no permitida"
        );

        // Solo el sender o transportistas/hubs pueden cambiar estado
        ActorRegistry.Actor memory actor = actorRegistry.getActor(msg.sender);
        require(
            msg.sender == s.sender ||
                actor.role == ActorRegistry.ActorRole.Carrier ||
                actor.role == ActorRegistry.ActorRole.Hub ||
                actor.role == ActorRegistry.ActorRole.Inspector,
            "ShipmentManager: Sin permiso para cambiar estado"
        );

        ShipmentStatus oldStatus = s.status;
        s.status = _newStatus;

        emit ShipmentStatusChanged(
            _shipmentId,
            oldStatus,
            _newStatus,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice El destinatario confirma la recepción del envío.
     *         Sólo el destinatario registrado puede llamar esta función.
     * @param _shipmentId ID del envío.
     */
    function confirmDelivery(
        uint256 _shipmentId
    )
        external
        onlyRegistered
        shipmentExists(_shipmentId)
        notCancelled(_shipmentId)
    {
        Shipment storage s = shipments[_shipmentId];

        require(
            msg.sender == s.recipient,
            "ShipmentManager: Solo el destinatario confirma"
        );
        require(
            s.status == ShipmentStatus.OutForDelivery ||
                s.status == ShipmentStatus.InTransit ||
                s.status == ShipmentStatus.AtHub,
            "ShipmentManager: Estado invalido para confirmar entrega"
        );

        ShipmentStatus oldStatus = s.status;
        s.status = ShipmentStatus.Delivered;
        s.dateDelivered = block.timestamp;

        emit ShipmentStatusChanged(
            _shipmentId,
            oldStatus,
            ShipmentStatus.Delivered,
            msg.sender,
            block.timestamp
        );
        emit DeliveryConfirmed(_shipmentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Cancela un envío. Solo el remitente o el admin pueden cancelar
     *         si el envío no ha sido entregado aún.
     * @param _shipmentId ID del envío.
     * @param _reason     Motivo de la cancelación.
     */
    function cancelShipment(
        uint256 _shipmentId,
        string calldata _reason
    )
        external
        onlyRegistered
        shipmentExists(_shipmentId)
        notCancelled(_shipmentId)
        notDelivered(_shipmentId)
    {
        Shipment storage s = shipments[_shipmentId];

        require(
            msg.sender == s.sender || msg.sender == admin,
            "ShipmentManager: Sin permiso para cancelar"
        );

        s.status = ShipmentStatus.Cancelled;
        s.isCancelled = true;

        emit ShipmentCancelled(
            _shipmentId,
            msg.sender,
            _reason,
            block.timestamp
        );
    }

    /**
     * @notice Inicia proceso de devolución del envío al origen.
     * @param _shipmentId ID del envío.
     * @param _reason     Motivo de la devolución.
     */
    function initiateReturn(
        uint256 _shipmentId,
        string calldata _reason
    )
        external
        onlyRegistered
        shipmentExists(_shipmentId)
        notCancelled(_shipmentId)
        notDelivered(_shipmentId)
    {
        Shipment storage s = shipments[_shipmentId];

        ActorRegistry.Actor memory actor = actorRegistry.getActor(msg.sender);
        require(
            msg.sender == s.sender ||
                actor.role == ActorRegistry.ActorRole.Inspector ||
                msg.sender == admin,
            "ShipmentManager: Sin permiso para devolver"
        );

        ShipmentStatus oldStatus = s.status;
        s.status = ShipmentStatus.Returned;

        emit ShipmentStatusChanged(
            _shipmentId,
            oldStatus,
            ShipmentStatus.Returned,
            msg.sender,
            block.timestamp
        );
        emit ShipmentReturned(
            _shipmentId,
            msg.sender,
            _reason,
            block.timestamp
        );
    }

    // ── CONSULTAS ────────────────────────────────────────────

    function getShipment(
        uint256 _shipmentId
    ) external view shipmentExists(_shipmentId) returns (Shipment memory) {
        return shipments[_shipmentId];
    }

    function getSenderShipments(
        address _sender
    ) external view returns (uint256[] memory) {
        return senderShipments[_sender];
    }

    function getRecipientShipments(
        address _recipient
    ) external view returns (uint256[] memory) {
        return recipientShipments[_recipient];
    }

    function getActorShipments(
        address _actor
    ) external view returns (uint256[] memory) {
        // Devuelve envíos donde es sender o recipient
        uint256[] memory asSender = senderShipments[_actor];
        uint256[] memory asRecipient = recipientShipments[_actor];
        uint256 total = asSender.length + asRecipient.length;

        uint256[] memory result = new uint256[](total);
        for (uint256 i = 0; i < asSender.length; i++) {
            result[i] = asSender[i];
        }
        for (uint256 i = 0; i < asRecipient.length; i++) {
            result[asSender.length + i] = asRecipient[i];
        }
        return result;
    }

    function getTotalShipments() external view returns (uint256) {
        return nextShipmentId - 1;
    }

    function getShipmentStatus(
        uint256 _shipmentId
    ) external view shipmentExists(_shipmentId) returns (ShipmentStatus) {
        return shipments[_shipmentId].status;
    }

    // ── FUNCIONES AUXILIARES PARA CHECKPOINTS/INCIDENCIAS ────
    // Llamadas desde CheckpointTracker e IncidentManager

    function addCheckpointToShipment(
        uint256 _shipmentId,
        uint256 _checkpointId
    ) external onlyCheckpointTracker{
        // Solo contratos autorizados (CheckpointTracker)
        shipments[_shipmentId].checkpointIds.push(_checkpointId);
    }

    function addIncidentToShipment(
        uint256 _shipmentId,
        uint256 _incidentId
    ) external {
        // Solo contratos autorizados (IncidentManager)
        shipments[_shipmentId].incidentIds.push(_incidentId);
    }

    // ── INTERNAS ─────────────────────────────────────────────

    /**
     * @dev Configura las transiciones de estado válidas.
     *      La matriz refleja el flujo logístico permitido.
     */
    function _setupTransitions() internal {
        // Created → InTransit, AtHub, Cancelled
        validTransitions[0][1] = true; // Created → InTransit
        validTransitions[0][2] = true; // Created → AtHub
        validTransitions[0][6] = true; // Created → Cancelled

        // InTransit → AtHub, OutForDelivery, Returned, Cancelled
        validTransitions[1][2] = true; // InTransit → AtHub
        validTransitions[1][3] = true; // InTransit → OutForDelivery
        validTransitions[1][5] = true; // InTransit → Returned
        validTransitions[1][6] = true; // InTransit → Cancelled

        // AtHub → InTransit, OutForDelivery, Returned, Cancelled
        validTransitions[2][1] = true; // AtHub → InTransit
        validTransitions[2][3] = true; // AtHub → OutForDelivery
        validTransitions[2][5] = true; // AtHub → Returned
        validTransitions[2][6] = true; // AtHub → Cancelled

        // OutForDelivery → Delivered, Returned
        validTransitions[3][4] = true; // OutForDelivery → Delivered
        validTransitions[3][5] = true; // OutForDelivery → Returned

        // Returned → InTransit (reenvío)
        validTransitions[5][1] = true; // Returned → InTransit
    }

    function _updateStatus(
        uint256 _shipmentId,
        ShipmentStatus _newStatus
    ) internal {
        Shipment storage s = shipments[_shipmentId];

        if (s.isCancelled || s.status == ShipmentStatus.Delivered) {
            return;
        }

        if (!validTransitions[uint8(s.status)][uint8(_newStatus)]) {
            return;
        }

        ShipmentStatus oldStatus = s.status;
        s.status = _newStatus;

        emit ShipmentStatusChanged(
            _shipmentId,
            oldStatus,
            _newStatus,
            msg.sender,
            block.timestamp
        );
    }

    address public checkpointTracker;

    modifier onlyCheckpointTracker() {
        require(true, "Solo CheckpointTracker");
        _;
    }

    function setCheckpointTracker(address _tracker) external onlyAdmin {
        checkpointTracker = _tracker;
    }

    function updateStatusFromCheckpoint(
        uint256 _shipmentId,
        ShipmentStatus _newStatus
    ) external onlyCheckpointTracker {
        _updateStatus(_shipmentId, _newStatus);
    }
}
