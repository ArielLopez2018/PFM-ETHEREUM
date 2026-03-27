// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ActorRegistry.sol";

// ============================================================
//  ChainTrack — Registro de Productos
//  Archivo: src/ProductRegistry.sol
//
//  Solo los actores con rol Sender (Remitente) pueden crear
//  y gestionar productos. Cada producto queda persistido
//  on-chain con su metadata completa.
// ============================================================

contract ProductRegistry {

    // ── TIPOS ────────────────────────────────────────────────

    struct Product {
        uint256 id;
        address owner;          // Remitente que lo creó
        string  name;
        string  description;
        string  sector;
        bool    requiresColdChain;
        int256  minTemp;        // x10 para decimales (ej: 20 = 2.0°C)
        int256  maxTemp;
        bool    active;
        uint256 createdAt;
    }

    // ── ESTADO ───────────────────────────────────────────────

    address         public admin;
    ActorRegistry   public actorRegistry;
    uint256         public nextProductId;

    mapping(uint256 => Product)          public products;
    mapping(address => uint256[])        private ownerProducts;
    uint256[]                            private allProductIds;

    // ── EVENTOS ──────────────────────────────────────────────

    event ProductCreated(
        uint256 indexed productId,
        address indexed owner,
        string  name,
        string  sector
    );
    event ProductUpdated(uint256 indexed productId, address indexed owner);
    event ProductDeactivated(uint256 indexed productId);

    // ── MODIFICADORES ────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "ProductRegistry: Solo admin");
        _;
    }

    modifier onlySender() {
        require(
            actorRegistry.hasRole(msg.sender, ActorRegistry.ActorRole.Sender),
            "ProductRegistry: Solo remitentes pueden gestionar productos"
        );
        _;
    }

    modifier productExists(uint256 _id) {
        require(products[_id].id != 0, "ProductRegistry: Producto no existe");
        _;
    }

    modifier onlyProductOwner(uint256 _id) {
        require(
            products[_id].owner == msg.sender || msg.sender == admin,
            "ProductRegistry: Solo el dueno o admin"
        );
        _;
    }

    // ── CONSTRUCTOR ──────────────────────────────────────────

    constructor(address _actorRegistry) {
        admin           = msg.sender;
        actorRegistry   = ActorRegistry(_actorRegistry);
        nextProductId   = 1;
    }

    // ── FUNCIONES EXTERNAS ───────────────────────────────────

    /**
     * @notice Crea un nuevo producto. Solo accesible para Remitentes.
     * @param _name             Nombre del producto.
     * @param _description      Descripcion detallada.
     * @param _sector           Sector (Farmaceutico, Alimentario, etc.)
     * @param _requiresColdChain Si requiere control de temperatura.
     * @param _minTemp          Temperatura minima x10 (solo si cold chain).
     * @param _maxTemp          Temperatura maxima x10 (solo si cold chain).
     * @return productId        ID del producto creado.
     */
    function createProduct(
        string  calldata _name,
        string  calldata _description,
        string  calldata _sector,
        bool             _requiresColdChain,
        int256           _minTemp,
        int256           _maxTemp
    ) external onlySender returns (uint256 productId) {
        require(bytes(_name).length > 0,   "ProductRegistry: Nombre requerido");
        require(bytes(_sector).length > 0, "ProductRegistry: Sector requerido");

        if (_requiresColdChain) {
            require(_minTemp < _maxTemp, "ProductRegistry: Rango de temperatura invalido");
        }

        productId = nextProductId++;

        products[productId] = Product({
            id:               productId,
            owner:            msg.sender,
            name:             _name,
            description:      _description,
            sector:           _sector,
            requiresColdChain: _requiresColdChain,
            minTemp:          _requiresColdChain ? _minTemp : int256(0),
            maxTemp:          _requiresColdChain ? _maxTemp : int256(0),
            active:           true,
            createdAt:        block.timestamp
        });

        ownerProducts[msg.sender].push(productId);
        allProductIds.push(productId);

        emit ProductCreated(productId, msg.sender, _name, _sector);
    }

    /**
     * @notice Actualiza un producto existente. Solo el dueño o admin.
     */
    function updateProduct(
        uint256 _id,
        string  calldata _name,
        string  calldata _description,
        string  calldata _sector,
        bool             _requiresColdChain,
        int256           _minTemp,
        int256           _maxTemp
    ) external productExists(_id) onlyProductOwner(_id) {
        require(products[_id].active, "ProductRegistry: Producto inactivo");
        require(bytes(_name).length > 0, "ProductRegistry: Nombre requerido");

        if (_requiresColdChain) {
            require(_minTemp < _maxTemp, "ProductRegistry: Rango de temperatura invalido");
        }

        Product storage p = products[_id];
        p.name              = _name;
        p.description       = _description;
        p.sector            = _sector;
        p.requiresColdChain = _requiresColdChain;
        p.minTemp           = _requiresColdChain ? _minTemp : int256(0);
        p.maxTemp           = _requiresColdChain ? _maxTemp : int256(0);

        emit ProductUpdated(_id, msg.sender);
    }

    /**
     * @notice Desactiva un producto. Solo el dueño o admin.
     */
    function deactivateProduct(uint256 _id)
        external
        productExists(_id)
        onlyProductOwner(_id)
    {
        products[_id].active = false;
        emit ProductDeactivated(_id);
    }

    // ── CONSULTAS ────────────────────────────────────────────

    function getProduct(uint256 _id)
        external
        view
        productExists(_id)
        returns (Product memory)
    {
        return products[_id];
    }

    function getOwnerProducts(address _owner)
        external
        view
        returns (uint256[] memory)
    {
        return ownerProducts[_owner];
    }

    function getTotalProducts() external view returns (uint256) {
        return allProductIds.length;
    }

    /**
     * @notice Devuelve lista paginada de todos los productos.
     */
    function getProductsPaginated(uint256 _offset, uint256 _limit)
        external
        view
        returns (Product[] memory result)
    {
        uint256 total = allProductIds.length;
        if (_offset >= total) return new Product[](0);

        uint256 end = _offset + _limit;
        if (end > total) end = total;

        result = new Product[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = products[allProductIds[i]];
        }
    }

    /**
     * @notice Devuelve los productos del remitente conectado.
     */
    function getMyProducts()
        external
        view
        returns (Product[] memory result)
    {
        uint256[] storage ids = ownerProducts[msg.sender];
        result = new Product[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = products[ids[i]];
        }
    }
}
