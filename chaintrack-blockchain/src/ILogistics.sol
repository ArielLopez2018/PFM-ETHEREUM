// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ============================================================
//  ChainTrack — Interfaces y Tipos Compartidos
//  Archivo: ILogistics.sol
// ============================================================

interface IActorRegistry {
    enum ActorRole {
        None,
        Sender,
        Carrier,
        Hub,
        Recipient,
        Inspector
    }

    struct Actor {
        address actorAddress;
        string name;
        ActorRole role;
        string location;
        bool isActive;
        uint256 registeredAt;
    }

    function registerActor(
        string calldata _name,
        ActorRole _role,
        string calldata _location
    ) external;
    function deactivateActor(address _actorAddress) external;
    function getActor(
        address _actorAddress
    ) external view returns (Actor memory);
    function isActiveActor(address _actorAddress) external view returns (bool);
    function hasRole(
        address _actorAddress,
        ActorRole _role
    ) external view returns (bool);

    event ActorRegistered(
        address indexed actorAddress,
        string name,
        ActorRole role,
        uint256 timestamp
    );
    event ActorDeactivated(address indexed actorAddress, uint256 timestamp);
}

interface IShipmentManager {
    enum ShipmentStatus {
        Created, // 0 — Creado, pendiente de recogida
        InTransit, // 1 — En tránsito hacia hub o destino
        AtHub, // 2 — En centro de distribución
        OutForDelivery, // 3 — En reparto final
        Delivered, // 4 — Entregado y confirmado
        Returned, // 5 — Devuelto al origen
        Cancelled // 6 — Cancelado
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
        int256 minTemp; // Temperatura mínima permitida (×10)
        int256 maxTemp; // Temperatura máxima permitida (×10)
        bool isCancelled;
    }

    function createShipment(
        address _recipient,
        string calldata _product,
        string calldata _origin,
        string calldata _destination,
        bool _requiresColdChain,
        int256 _minTemp,
        int256 _maxTemp
    ) external returns (uint256);

    function updateShipmentStatus(
        uint256 _shipmentId,
        ShipmentStatus _newStatus
    ) external;
    function confirmDelivery(uint256 _shipmentId) external;
    function cancelShipment(uint256 _shipmentId) external;
    function getShipment(
        uint256 _shipmentId
    ) external view returns (Shipment memory);
    function getActorShipments(
        address _actor
    ) external view returns (uint256[] memory);

    event ShipmentCreated(
        uint256 indexed shipmentId,
        address indexed sender,
        address indexed recipient,
        string product,
        uint256 timestamp
    );
    event ShipmentStatusChanged(
        uint256 indexed shipmentId,
        ShipmentStatus oldStatus,
        ShipmentStatus newStatus,
        address changedBy,
        uint256 timestamp
    );
    event DeliveryConfirmed(
        uint256 indexed shipmentId,
        address indexed recipient,
        uint256 timestamp
    );
    event ShipmentCancelled(
        uint256 indexed shipmentId,
        address cancelledBy,
        uint256 timestamp
    );
}

interface ICheckpointTracker {
    struct Checkpoint {
        uint256 id;
        uint256 shipmentId;
        address actor;
        string location;
        string checkpointType; // "Pickup" | "Hub" | "Transit" | "Delivery"
        uint256 timestamp;
        string notes;
        int256 temperature; // Celsius × 10
        bool tempViolation; // Alerta automática de temperatura
        bytes32 dataHash; // Hash de verificación del evento
    }

    function recordCheckpoint(
        uint256 _shipmentId,
        string calldata _location,
        string calldata _checkpointType,
        string calldata _notes,
        int256 _temperature
    ) external returns (uint256);

    function getCheckpoint(
        uint256 _checkpointId
    ) external view returns (Checkpoint memory);
    function getShipmentCheckpoints(
        uint256 _shipmentId
    ) external view returns (Checkpoint[] memory);

    event CheckpointRecorded(
        uint256 indexed checkpointId,
        uint256 indexed shipmentId,
        string location,
        address indexed actor,
        int256 temperature,
        bool tempViolation,
        uint256 timestamp
    );
}

interface IIncidentManager {
    enum IncidentType {
        Delay, // 0 — Retraso en el envío
        Damage, // 1 — Daño físico al producto
        Lost, // 2 — Paquete perdido
        TempViolation, // 3 — Temperatura fuera de rango
        Unauthorized, // 4 — Apertura o acceso no autorizado
        CustomsHold, // 5 — Retención aduanera
        Other // 6 — Otro tipo de incidencia
    }

    struct Incident {
        uint256 id;
        uint256 shipmentId;
        IncidentType incidentType;
        address reporter;
        string description;
        uint256 timestamp;
        bool resolved;
        address resolvedBy;
        uint256 resolvedAt;
        string resolution;
    }

    function reportIncident(
        uint256 _shipmentId,
        IncidentType _incidentType,
        string calldata _description
    ) external returns (uint256);

    function resolveIncident(
        uint256 _incidentId,
        string calldata _resolution
    ) external;

    function getIncident(
        uint256 _incidentId
    ) external view returns (Incident memory);
    function getShipmentIncidents(
        uint256 _shipmentId
    ) external view returns (Incident[] memory);

    event IncidentReported(
        uint256 indexed incidentId,
        uint256 indexed shipmentId,
        IncidentType incidentType,
        address indexed reporter,
        uint256 timestamp
    );
    event IncidentResolved(
        uint256 indexed incidentId,
        address indexed resolvedBy,
        string resolution,
        uint256 timestamp
    );
}
