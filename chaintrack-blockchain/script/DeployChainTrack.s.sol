// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ============================================================
//  ChainTrack — Foundry Deploy Script (con ProductRegistry)
//  Archivo: script/DeployChainTrack.s.sol
// ============================================================

import "forge-std/Script.sol";
import "../src/ActorRegistry.sol";
import "../src/ShipmentManager.sol";
import "../src/CheckpointTracker.sol";
import "../src/IncidentManager.sol";
import "../src/LogisticsTracker.sol";
import "../src/ProductRegistry.sol";

contract DeployChainTrack is Script {

    ActorRegistry     public actorRegistry;
    ShipmentManager   public shipmentManager;
    CheckpointTracker public checkpointTracker;
    IncidentManager   public incidentManager;
    LogisticsTracker  public logisticsTracker;
    ProductRegistry   public productRegistry;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("==============================================");
        console.log(" ChainTrack - Foundry Deploy");
        console.log("==============================================");
        console.log("Deployer :", deployer);
        console.log("Balance  :", deployer.balance / 1e18, "ETH");
        console.log("Chain ID :", block.chainid);
        console.log("----------------------------------------------");

        vm.startBroadcast(deployerKey);

        // ── 1. ActorRegistry ─────────────────────────────────
        actorRegistry = new ActorRegistry();
        console.log("ActorRegistry     :", address(actorRegistry));

        // ── 2. ShipmentManager ───────────────────────────────
        shipmentManager = new ShipmentManager(address(actorRegistry));
        console.log("ShipmentManager   :", address(shipmentManager));

        // ── 3. CheckpointTracker ─────────────────────────────
        checkpointTracker = new CheckpointTracker(
            address(actorRegistry),
            address(shipmentManager)
        );
        console.log("CheckpointTracker :", address(checkpointTracker));

        // ── 4. IncidentManager ───────────────────────────────
        incidentManager = new IncidentManager(
            address(actorRegistry),
            address(shipmentManager)
        );
        console.log("IncidentManager   :", address(incidentManager));

        // ── 5. LogisticsTracker (Facade) ─────────────────────
        logisticsTracker = new LogisticsTracker(
            address(actorRegistry),
            address(shipmentManager),
            address(checkpointTracker),
            address(incidentManager)
        );
        console.log("LogisticsTracker  :", address(logisticsTracker));

        // ── 6. ProductRegistry ───────────────────────────────
        productRegistry = new ProductRegistry(address(actorRegistry));
        console.log("ProductRegistry   :", address(productRegistry));

        // ── 7. Autorizar contratos en ActorRegistry ───────────
        actorRegistry.authorizeContract(address(shipmentManager));
        actorRegistry.authorizeContract(address(checkpointTracker));
        actorRegistry.authorizeContract(address(incidentManager));
        actorRegistry.authorizeContract(address(logisticsTracker));
        actorRegistry.authorizeContract(address(productRegistry));
        console.log("Contratos autorizados en ActorRegistry");

        vm.stopBroadcast();

        console.log("==============================================");
        console.log(" DEPLOY COMPLETADO");
        console.log("==============================================");
        console.log("ActorRegistry     :", address(actorRegistry));
        console.log("ShipmentManager   :", address(shipmentManager));
        console.log("CheckpointTracker :", address(checkpointTracker));
        console.log("IncidentManager   :", address(incidentManager));
        console.log("LogisticsTracker  :", address(logisticsTracker));
        console.log("ProductRegistry   :", address(productRegistry));
        console.log("==============================================");
    }

    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == 1)        return "mainnet";
        if (block.chainid == 11155111) return "sepolia";
        if (block.chainid == 80001)    return "mumbai";
        if (block.chainid == 31337)    return "anvil";
        return "unknown";
    }
}
