// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ============================================================
//  ChainTrack — Registro de Actores
//  Archivo: ActorRegistry.sol
//  Gestiona el registro y permisos de todos los participantes
//  en la cadena logística: remitentes, transportistas, hubs,
//  destinatarios e inspectores.
// ============================================================

contract ActorRegistry {
    // ── TIPOS ────────────────────────────────────────────────

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

    // ── ESTADO ───────────────────────────────────────────────

    address public admin;
    address public logisticsContract; // Dirección del contrato principal

    mapping(address => Actor) public actors;
    mapping(address => bool) public authorizedContracts;
    address[] private actorList;

    // ── EVENTOS ──────────────────────────────────────────────

    event ActorRegistered(
        address indexed actorAddress,
        string name,
        ActorRole role,
        uint256 timestamp
    );
    event ActorDeactivated(address indexed actorAddress, uint256 timestamp);
    event ActorUpdated(
        address indexed actorAddress,
        string newName,
        string newLocation,
        uint256 timestamp
    );
    event ContractAuthorized(address indexed contractAddress);
    event ContractRevoked(address indexed contractAddress);

    // ── MODIFICADORES ────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "ActorRegistry: Solo admin");
        _;
    }

    modifier actorExists(address _addr) {
        require(
            actors[_addr].actorAddress != address(0),
            "ActorRegistry: Actor no existe"
        );
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == admin || authorizedContracts[msg.sender],
            "ActorRegistry: No autorizado"
        );
        _;
    }

    // ── CONSTRUCTOR ──────────────────────────────────────────

    constructor() {
        admin = msg.sender;
        // Registrar al deployer como admin/inspector
        _registerActor(
            msg.sender,
            "Admin ChainTrack",
            ActorRole.Inspector,
            "Sistema"
        );
    }

    // ── FUNCIONES EXTERNAS ───────────────────────────────────

    /**
     * @notice Registra un nuevo actor en la red logística.
     * @param _name     Nombre del actor o empresa.
     * @param _role     Rol: Sender, Carrier, Hub, Recipient, Inspector.
     * @param _location Ubicación física o sede principal.
     */
    function registerActor(
        string calldata _name,
        ActorRole _role,
        string calldata _location
    ) external {
        require(_role != ActorRole.None, "ActorRegistry: Rol invalido");
        require(bytes(_name).length > 0, "ActorRegistry: Nombre requerido");
        require(
            actors[msg.sender].actorAddress == address(0),
            "ActorRegistry: Ya registrado"
        );
        _registerActor(msg.sender, _name, _role, _location);
    }

    /**
     * @notice Admin registra un actor en nombre de otro (onboarding).
     */
    function registerActorFor(
        address _actorAddress,
        string calldata _name,
        ActorRole _role,
        string calldata _location
    ) external onlyAdmin {
        require(_role != ActorRole.None, "ActorRegistry: Rol invalido");
        require(
            actors[_actorAddress].actorAddress == address(0),
            "ActorRegistry: Ya registrado"
        );
        _registerActor(_actorAddress, _name, _role, _location);
    }

    /**
     * @notice Actualiza nombre y/o ubicación de un actor existente.
     */
    function updateActor(
        string calldata _name,
        string calldata _location
    ) external actorExists(msg.sender) {
        require(actors[msg.sender].isActive, "ActorRegistry: Actor inactivo");
        actors[msg.sender].name = _name;
        actors[msg.sender].location = _location;
        emit ActorUpdated(msg.sender, _name, _location, block.timestamp);
    }

    /**
     * @notice Desactiva un actor (solo admin). No se puede eliminar
     *         para preservar el historial de trazabilidad.
     */
    function deactivateActor(
        address _actorAddress
    ) external onlyAdmin actorExists(_actorAddress) {
        actors[_actorAddress].isActive = false;
        emit ActorDeactivated(_actorAddress, block.timestamp);
    }

    /**
     * @notice Reactiva un actor previamente desactivado.
     */
    function reactivateActor(
        address _actorAddress
    ) external onlyAdmin actorExists(_actorAddress) {
        actors[_actorAddress].isActive = true;
    }

    /**
     * @notice Autoriza otro contrato para consultar este registro.
     */
    function authorizeContract(address _contract) external onlyAdmin {
        authorizedContracts[_contract] = true;
        emit ContractAuthorized(_contract);
    }

    function revokeContract(address _contract) external onlyAdmin {
        authorizedContracts[_contract] = false;
        emit ContractRevoked(_contract);
    }

    // ── CONSULTAS ────────────────────────────────────────────

    function getActor(
        address _actorAddress
    ) external view actorExists(_actorAddress) returns (Actor memory) {
        return actors[_actorAddress];
    }

    function isActiveActor(address _actorAddress) external view returns (bool) {
        return actors[_actorAddress].isActive;
    }

    function hasRole(
        address _actorAddress,
        ActorRole _role
    ) external view returns (bool) {
        Actor storage a = actors[_actorAddress];
        return a.isActive && a.role == _role;
    }

    function getTotalActors() external view returns (uint256) {
        return actorList.length;
    }

    /**
     * @notice Devuelve lista paginada de actores.
     */
    function getActorsPaginated(
        uint256 _offset,
        uint256 _limit
    ) external view returns (Actor[] memory result) {
        uint256 total = actorList.length;
        if (_offset >= total) return new Actor[](0);

        uint256 end = _offset + _limit;
        if (end > total) end = total;

        result = new Actor[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = actors[actorList[i]];
        }
    }

    // ── INTERNAS ─────────────────────────────────────────────

    function _registerActor(
        address _addr,
        string memory _name,
        ActorRole _role,
        string memory _location
    ) internal {
        actors[_addr] = Actor({
            actorAddress: _addr,
            name: _name,
            role: _role,
            location: _location,
            isActive: true,
            registeredAt: block.timestamp
        });
        actorList.push(_addr);
        emit ActorRegistered(_addr, _name, _role, block.timestamp);
    }
}
