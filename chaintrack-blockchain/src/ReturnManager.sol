// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ActorRegistry.sol";
import "./ShipmentManager.sol";

// ============================================================
//  ChainTrack — Gestión de Devoluciones
//  Archivo: src/ReturnManager.sol
//
//  - El destinatario tiene 24hs desde la entrega para devolver
//  - Completa un formulario con motivo predefinido + descripcion
//  - El transportista (Carrier) puede aceptar/rechazar la devolucion
//  - Si se acepta, el envio pasa a estado Returned
// ============================================================

contract ReturnManager {

    // ── CONSTANTES ───────────────────────────────────────────

    uint256 public constant RETURN_WINDOW = 24 hours;

    // ── TIPOS ────────────────────────────────────────────────

    enum ReturnReason {
        DamagedProduct,     // 0 - Producto dañado
        WrongProduct,       // 1 - Producto incorrecto
        WrongQuantity,      // 2 - Cantidad incorrecta
        NotAsExpected,      // 3 - No era lo esperado
        QualityIssue,       // 4 - Problema de calidad
        LateDelivery,       // 5 - Entrega fuera de plazo
        Other               // 6 - Otro (descripcion obligatoria)
    }

    enum ReturnStatus {
        Pending,    // 0 - Solicitud enviada, esperando respuesta
        Accepted,   // 1 - Aceptada por transportista/remitente
        Rejected    // 2 - Rechazada
    }

    struct ReturnRequest {
        uint256 id;
        uint256 shipmentId;
        address requestedBy;    // Destinatario
        ReturnReason reason;
        string  description;    // Descripcion libre (obligatoria si reason == Other)
        ReturnStatus status;
        uint256 requestedAt;
        address resolvedBy;
        uint256 resolvedAt;
        string  rejectionReason; // Por que se rechazo (si aplica)
    }

    // ── ESTADO ───────────────────────────────────────────────

    address           public admin;
    ActorRegistry     public actorRegistry;
    ShipmentManager   public shipmentManager;

    uint256 public nextReturnId;

    mapping(uint256 => ReturnRequest) public returnRequests;
    mapping(uint256 => uint256)       public shipmentReturn;   // shipmentId → returnId
    mapping(address => uint256[])     private recipientReturns;

    // ── EVENTOS ──────────────────────────────────────────────

    event ReturnRequested(
        uint256 indexed returnId,
        uint256 indexed shipmentId,
        address indexed requestedBy,
        ReturnReason reason,
        uint256 timestamp
    );
    event ReturnAccepted(
        uint256 indexed returnId,
        uint256 indexed shipmentId,
        address indexed acceptedBy,
        uint256 timestamp
    );
    event ReturnRejected(
        uint256 indexed returnId,
        uint256 indexed shipmentId,
        address indexed rejectedBy,
        string reason,
        uint256 timestamp
    );
    event ReturnWindowExpired(uint256 indexed shipmentId, uint256 timestamp);

    // ── MODIFICADORES ────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "ReturnManager: Solo admin");
        _;
    }

    modifier onlyRegistered() {
        require(actorRegistry.isActiveActor(msg.sender), "ReturnManager: Actor no registrado");
        _;
    }

    modifier returnExists(uint256 _id) {
        require(returnRequests[_id].id != 0, "ReturnManager: Solicitud no existe");
        _;
    }

    // ── CONSTRUCTOR ──────────────────────────────────────────

    constructor(address _actorRegistry, address _shipmentManager) {
        admin           = msg.sender;
        actorRegistry   = ActorRegistry(_actorRegistry);
        shipmentManager = ShipmentManager(_shipmentManager);
        nextReturnId    = 1;
    }

    // ── FUNCIONES PRINCIPALES ────────────────────────────────

    /**
     * @notice El destinatario solicita devolucion dentro de las 24hs.
     * @param _shipmentId  ID del envio a devolver.
     * @param _reason      Motivo predefinido de la devolucion.
     * @param _description Descripcion libre (obligatoria si reason == Other).
     */
    function requestReturn(
        uint256      _shipmentId,
        ReturnReason _reason,
        string calldata _description
    ) external onlyRegistered returns (uint256 returnId) {

        ShipmentManager.Shipment memory s = shipmentManager.getShipment(_shipmentId);

        // Solo el destinatario del envio puede solicitar devolucion
        require(msg.sender == s.recipient, "ReturnManager: Solo el destinatario");

        // El envio debe estar entregado
        require(
            s.status == ShipmentManager.ShipmentStatus.Delivered,
            "ReturnManager: El envio no esta entregado"
        );

        // Verificar ventana de 24 horas
        require(
            block.timestamp <= s.dateDelivered + RETURN_WINDOW,
            "ReturnManager: Ventana de devolucion expirada (24hs)"
        );

        // No puede haber una devolucion previa para este envio
        require(
            shipmentReturn[_shipmentId] == 0,
            "ReturnManager: Ya existe una solicitud de devolucion"
        );

        // Si el motivo es "Otro", la descripcion es obligatoria
        if (_reason == ReturnReason.Other) {
            require(
                bytes(_description).length > 0,
                "ReturnManager: Descripcion obligatoria cuando el motivo es 'Otro'"
            );
        }

        returnId = nextReturnId++;

        returnRequests[returnId] = ReturnRequest({
            id:              returnId,
            shipmentId:      _shipmentId,
            requestedBy:     msg.sender,
            reason:          _reason,
            description:     _description,
            status:          ReturnStatus.Pending,
            requestedAt:     block.timestamp,
            resolvedBy:      address(0),
            resolvedAt:      0,
            rejectionReason: ""
        });

        shipmentReturn[_shipmentId] = returnId;
        recipientReturns[msg.sender].push(returnId);

        emit ReturnRequested(returnId, _shipmentId, msg.sender, _reason, block.timestamp);
    }

    /**
     * @notice El transportista o remitente acepta la devolucion.
     *         Cambia el estado del envio a Returned.
     */
    function acceptReturn(uint256 _returnId)
        external
        onlyRegistered
        returnExists(_returnId)
    {
        ReturnRequest storage r = returnRequests[_returnId];
        require(r.status == ReturnStatus.Pending, "ReturnManager: Solicitud ya resuelta");

        // Solo Carrier, sender del envio, Inspector o admin pueden aceptar
        ShipmentManager.Shipment memory s = shipmentManager.getShipment(r.shipmentId);
        ActorRegistry.Actor memory actor  = actorRegistry.getActor(msg.sender);

        require(
            msg.sender == s.sender ||
            actor.role == ActorRegistry.ActorRole.Carrier ||
            actor.role == ActorRegistry.ActorRole.Inspector ||
            msg.sender == admin,
            "ReturnManager: Sin permiso para aceptar"
        );

        r.status     = ReturnStatus.Accepted;
        r.resolvedBy = msg.sender;
        r.resolvedAt = block.timestamp;

        emit ReturnAccepted(_returnId, r.shipmentId, msg.sender, block.timestamp);
    }

    /**
     * @notice El remitente o admin rechaza la devolucion.
     */
    function rejectReturn(uint256 _returnId, string calldata _rejectionReason)
        external
        onlyRegistered
        returnExists(_returnId)
    {
        ReturnRequest storage r = returnRequests[_returnId];
        require(r.status == ReturnStatus.Pending, "ReturnManager: Solicitud ya resuelta");
        require(bytes(_rejectionReason).length > 0, "ReturnManager: Motivo de rechazo requerido");

        ShipmentManager.Shipment memory s = shipmentManager.getShipment(r.shipmentId);
        ActorRegistry.Actor memory actor  = actorRegistry.getActor(msg.sender);

        require(
            msg.sender == s.sender ||
            actor.role == ActorRegistry.ActorRole.Inspector ||
            msg.sender == admin,
            "ReturnManager: Sin permiso para rechazar"
        );

        r.status          = ReturnStatus.Rejected;
        r.resolvedBy      = msg.sender;
        r.resolvedAt      = block.timestamp;
        r.rejectionReason = _rejectionReason;

        emit ReturnRejected(_returnId, r.shipmentId, msg.sender, _rejectionReason, block.timestamp);
    }

    // ── CONSULTAS ────────────────────────────────────────────

    function getReturn(uint256 _returnId) external view returnExists(_returnId) returns (ReturnRequest memory) {
        return returnRequests[_returnId];
    }

    function getShipmentReturn(uint256 _shipmentId) external view returns (ReturnRequest memory) {
        uint256 returnId = shipmentReturn[_shipmentId];
        require(returnId != 0, "ReturnManager: No hay devolucion para este envio");
        return returnRequests[returnId];
    }

    function hasReturnRequest(uint256 _shipmentId) external view returns (bool) {
        return shipmentReturn[_shipmentId] != 0;
    }

    /**
     * @notice Verifica si el envio sigue dentro de la ventana de 24hs.
     */
    function isReturnWindowOpen(uint256 _shipmentId) external view returns (bool) {
        ShipmentManager.Shipment memory s = shipmentManager.getShipment(_shipmentId);
        if (s.status != ShipmentManager.ShipmentStatus.Delivered) return false;
        if (s.dateDelivered == 0) return false;
        return block.timestamp <= s.dateDelivered + RETURN_WINDOW;
    }

    /**
     * @notice Tiempo restante en la ventana de devolucion (en segundos).
     *         Devuelve 0 si ya expiró.
     */
    function getRemainingReturnTime(uint256 _shipmentId) external view returns (uint256) {
        ShipmentManager.Shipment memory s = shipmentManager.getShipment(_shipmentId);
        if (s.status != ShipmentManager.ShipmentStatus.Delivered) return 0;
        if (s.dateDelivered == 0) return 0;
        uint256 deadline = s.dateDelivered + RETURN_WINDOW;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    function getRecipientReturns(address _recipient) external view returns (uint256[] memory) {
        return recipientReturns[_recipient];
    }
}
