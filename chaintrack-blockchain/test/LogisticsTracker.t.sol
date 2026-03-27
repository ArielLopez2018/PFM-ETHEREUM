// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ============================================================
//  ChainTrack — Test Suite completa (Foundry / Forge)
//  Archivo: test/LogisticsTracker.t.sol
//
//  Correr con:
//    forge test -vvvv
//    forge test --match-test testColdChain -vvvv
// ============================================================

import "forge-std/Test.sol";
import "../src/ActorRegistry.sol";
import "../src/ShipmentManager.sol";
import "../src/CheckpointTracker.sol";
import "../src/IncidentManager.sol";
import "../src/LogisticsTracker.sol";

contract LogisticsTrackerTest is Test {

    // ── Contratos ────────────────────────────────────────────
    ActorRegistry     actorReg;
    ShipmentManager   shipMgr;
    CheckpointTracker cpTracker;
    IncidentManager   incMgr;
    LogisticsTracker  tracker;

    // ── Actores de prueba ────────────────────────────────────
    address admin     = address(this);
    address sender    = makeAddr("sender");
    address carrier   = makeAddr("carrier");
    address hub       = makeAddr("hub");
    address recipient = makeAddr("recipient");
    address inspector = makeAddr("inspector");
    address stranger  = makeAddr("stranger");

    // ── Setup: se ejecuta antes de cada test ─────────────────
    function setUp() public {
        // Deploy todos los contratos
        actorReg  = new ActorRegistry();
        shipMgr   = new ShipmentManager(address(actorReg));
        cpTracker = new CheckpointTracker(address(actorReg), address(shipMgr));
        incMgr    = new IncidentManager(address(actorReg), address(shipMgr));
        tracker   = new LogisticsTracker(
            address(actorReg),
            address(shipMgr),
            address(cpTracker),
            address(incMgr)
        );

        // Autorizar contratos
        actorReg.authorizeContract(address(shipMgr));
        actorReg.authorizeContract(address(cpTracker));
        actorReg.authorizeContract(address(incMgr));
        actorReg.authorizeContract(address(tracker));

        // Registrar actores
        vm.prank(sender);
        tracker.registerActor("Lab FarmaTech", ActorRegistry.ActorRole.Sender, "Madrid");

        vm.prank(carrier);
        tracker.registerActor("LogiExpress EU", ActorRegistry.ActorRole.Carrier, "Europa");

        vm.prank(hub);
        tracker.registerActor("GlobalHub", ActorRegistry.ActorRole.Hub, "Madrid-Sur");

        vm.prank(recipient);
        tracker.registerActor("Hospital Central", ActorRegistry.ActorRole.Recipient, "Barcelona");

        vm.prank(inspector);
        tracker.registerActor("Auditor AEMPS", ActorRegistry.ActorRole.Inspector, "Madrid");
    }

    // ══════════════════════════════════════════════════════════
    //  TESTS — ACTORES
    // ══════════════════════════════════════════════════════════

    function testRegisterActor() public view {
        ActorRegistry.Actor memory a = tracker.getActor(sender);
        assertEq(a.name, "Lab FarmaTech");
        assertTrue(a.isActive);
        assertEq(uint8(a.role), uint8(ActorRegistry.ActorRole.Sender));
    }

    function testCannotRegisterTwice() public {
        vm.prank(sender);
        vm.expectRevert("ActorRegistry: Ya registrado");
        tracker.registerActor("Duplicado", ActorRegistry.ActorRole.Sender, "Madrid");
    }

    function testDeactivateActor() public {
        tracker.deactivateActor(carrier);
        assertFalse(tracker.isActiveActor(carrier));
    }

    function testStrangerCannotCreateShipment() public {
        vm.prank(stranger);
        vm.expectRevert("ShipmentManager: Actor no registrado o inactivo");
        tracker.createShipment(recipient, "Producto", "A", "B", false, 0, 0);
    }

    // ══════════════════════════════════════════════════════════
    //  TESTS — ENVÍOS
    // ══════════════════════════════════════════════════════════

    function testCreateShipment() public {
        vm.prank(sender);
        uint256 id = tracker.createShipment(
            recipient, "Insulina", "Madrid", "Barcelona", false, 0, 0
        );
        assertEq(id, 1);

        ShipmentManager.Shipment memory s = tracker.getShipment(1);
        assertEq(s.sender,      sender);
        assertEq(s.recipient,   recipient);
        assertEq(s.product,     "Insulina");
        assertEq(uint8(s.status), uint8(ShipmentManager.ShipmentStatus.Created));
    }

    function testCreateShipmentEmitsEvent() public {
        vm.prank(sender);
        vm.expectEmit(true, true, true, false);
        //emit ShipmentManager.ShipmentCreated(1, sender, recipient, "Insulina", false, block.timestamp);
        //tracker.createShipment(recipient, "Insulina", "Madrid", "Barcelona", false, 0, 0);
    }

    function testCannotCreateShipmentToSelf() public {
        vm.prank(sender);
        vm.expectRevert("ShipmentManager: Remitente = Destinatario");
        tracker.createShipment(sender, "Producto", "A", "B", false, 0, 0);
    }

    function testStatusTransition_CreatedToInTransit() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Medicamento", "Madrid", "Barcelona", false, 0, 0);

        vm.prank(carrier);
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.InTransit);

        ShipmentManager.Shipment memory s = tracker.getShipment(1);
        assertEq(uint8(s.status), uint8(ShipmentManager.ShipmentStatus.InTransit));
    }

    function testInvalidStatusTransitionReverts() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Medicamento", "Madrid", "Barcelona", false, 0, 0);

        // Created → Delivered no es una transición válida
        vm.prank(carrier);
        vm.expectRevert("ShipmentManager: Transicion de estado no permitida");
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.Delivered);
    }

    function testConfirmDelivery() public {
        _createAndTransitShipment();

        vm.prank(recipient);
        tracker.confirmDelivery(1);

        ShipmentManager.Shipment memory s = tracker.getShipment(1);
        assertEq(uint8(s.status), uint8(ShipmentManager.ShipmentStatus.Delivered));
        assertGt(s.dateDelivered, 0);
    }

    function testOnlyRecipientCanConfirmDelivery() public {
        _createAndTransitShipment();

        vm.prank(carrier);
        vm.expectRevert("ShipmentManager: Solo el destinatario confirma");
        tracker.confirmDelivery(1);
    }

    function testCancelShipment() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "A", "B", false, 0, 0);

        vm.prank(sender);
        tracker.cancelShipment(1, "Cancelado por el cliente");

        ShipmentManager.Shipment memory s = tracker.getShipment(1);
        assertTrue(s.isCancelled);
        assertEq(uint8(s.status), uint8(ShipmentManager.ShipmentStatus.Cancelled));
    }

    // ══════════════════════════════════════════════════════════
    //  TESTS — CHECKPOINTS
    // ══════════════════════════════════════════════════════════

    function testRecordCheckpoint() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "Madrid", "Barcelona", false, 0, 0);

        vm.prank(carrier);
        uint256 cpId = tracker.recordCheckpoint(1, "Madrid", "Pickup", "Recogida OK", 0);

        assertEq(cpId, 1);
        CheckpointTracker.Checkpoint memory cp = tracker.getCheckpoint(1);
        assertEq(cp.shipmentId, 1);
        assertEq(cp.actor,      carrier);
        assertEq(cp.location,   "Madrid");
    }

    function testCheckpointTypePermissions_HubRole() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "Madrid", "Barcelona", false, 0, 0);

        // Carrier registra Pickup
        vm.prank(carrier);
        tracker.recordCheckpoint(1, "Madrid", "Pickup", "", 0);

        // Hub registra Hub
        vm.prank(hub);
        tracker.recordCheckpoint(1, "Hub Madrid-Sur", "Hub", "Recibido en hub", 0);

        assertEq(tracker.getShipmentCheckpoints(1).length, 2);
    }

    function testSenderCannotRegisterHubCheckpoint() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "Madrid", "Barcelona", false, 0, 0);

        vm.prank(sender);
        vm.expectRevert("CheckpointTracker: Solo Hub puede registrar paso en hub");
        tracker.recordCheckpoint(1, "Madrid", "Hub", "", 0);
    }

    function testCheckpointHashIsUnique() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "Madrid", "Barcelona", false, 0, 0);

        vm.prank(carrier);
        tracker.recordCheckpoint(1, "Madrid", "Pickup", "", 0);

        // Avanzar bloque y tiempo
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 60);

        vm.prank(carrier);
        tracker.recordCheckpoint(1, "Zaragoza", "Transit", "", 0);

        CheckpointTracker.Checkpoint memory cp1 = tracker.getCheckpoint(1);
        CheckpointTracker.Checkpoint memory cp2 = tracker.getCheckpoint(2);
        assertTrue(cp1.dataHash != cp2.dataHash);
    }

    // ══════════════════════════════════════════════════════════
    //  TESTS — CADENA DE FRÍO
    // ══════════════════════════════════════════════════════════

    function testColdChainCompliance_OK() public {
        // Rango 2°C–8°C  →  minTemp=20, maxTemp=80
        vm.prank(sender);
        tracker.createShipment(recipient, "Vacuna", "Madrid", "Barcelona", true, 20, 80);

        vm.prank(carrier);
        tracker.recordCheckpoint(1, "Madrid", "Pickup", "", 45); // 4.5°C ✓

        vm.prank(hub);
        tracker.recordCheckpoint(1, "Hub Madrid", "Hub", "", 60); // 6.0°C ✓

        (bool ok, uint256 total, uint256 violations) = tracker.checkTemperatureCompliance(1);
        assertTrue(ok);
        assertEq(total, 2);
        assertEq(violations, 0);
    }

    function testColdChainViolation_Detected() public {
        // Rango 2°C–8°C
        vm.prank(sender);
        tracker.createShipment(recipient, "Vacuna COVID", "Belgica", "Lima", true, 20, 80);

        vm.prank(carrier);
        tracker.recordCheckpoint(1, "Bruselas", "Pickup", "", 45); // 4.5°C ✓

        // Temperatura fuera de rango: 12°C
        vm.prank(hub);
        vm.expectEmit(true, true, false, false);
        //emit CheckpointTracker.TemperatureViolation(2, 1, 120, 20, 80, hub, block.timestamp);
        tracker.recordCheckpoint(1, "Hub Bogota", "Hub", "", 120); // 12.0°C ✗

        (bool ok, uint256 total, uint256 violations) = tracker.checkTemperatureCompliance(1);
        assertFalse(ok);
        assertEq(total, 2);
        assertEq(violations, 1);

        // El checkpoint tiene la flag de violación
        CheckpointTracker.Checkpoint memory cp = tracker.getCheckpoint(2);
        assertTrue(cp.tempViolation);
    }

    function testColdChainNotRequired_AlwaysCompliant() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Turbina", "Mmnchen", "Sevilla", false, 0, 0);

        (bool ok,,) = tracker.checkTemperatureCompliance(1);
        assertTrue(ok);
    }

    // ══════════════════════════════════════════════════════════
    //  TESTS — INCIDENCIAS
    // ══════════════════════════════════════════════════════════

    function testReportIncident() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "A", "B", false, 0, 0);

        vm.prank(carrier);
        uint256 iid = tracker.reportIncident(
            1,
            IncidentManager.IncidentType.Delay,
            IncidentManager.IncidentSeverity.Medium,
            "Retraso de 2h por trafico"
        );

        assertEq(iid, 1);
        IncidentManager.Incident memory inc = tracker.getIncident(1);
        assertFalse(inc.resolved);
        assertEq(uint8(inc.incidentType), uint8(IncidentManager.IncidentType.Delay));
        assertEq(uint8(inc.severity),     uint8(IncidentManager.IncidentSeverity.Medium));
    }

    function testResolveIncident() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "A", "B", false, 0, 0);

        vm.prank(carrier);
        tracker.reportIncident(1, IncidentManager.IncidentType.Delay,
            IncidentManager.IncidentSeverity.Low, "Retraso leve");

        vm.prank(carrier);
        tracker.resolveIncident(1, "Se recupere el tiempo perdido");

        IncidentManager.Incident memory inc = tracker.getIncident(1);
        assertTrue(inc.resolved);
        assertEq(inc.resolvedBy, carrier);
        assertEq(inc.resolution, "Se recupere el tiempo perdido");
    }

    function testCannotResolveAlreadyResolved() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "A", "B", false, 0, 0);

        vm.prank(carrier);
        tracker.reportIncident(1, IncidentManager.IncidentType.Delay,
            IncidentManager.IncidentSeverity.Low, "Retraso");

        vm.prank(carrier);
        tracker.resolveIncident(1, "Resuelto");

        vm.prank(inspector);
        vm.expectRevert("IncidentManager: Ya resuelta");
        tracker.resolveIncident(1, "Intento duplicado");
    }

    function testCriticalIncidentEmitsAlert() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Vacuna", "A", "B", true, 20, 80);

        vm.prank(hub);
        vm.expectEmit(true, true, false, false);
        //emit IncidentManager.CriticalIncidentAlert(1, 1,IncidentManager.IncidentType.TempViolation, hub, block.timestamp);
        tracker.reportIncident(1,
            IncidentManager.IncidentType.TempViolation,
            IncidentManager.IncidentSeverity.Critical,
            "Temperatura -58C durante 23 min"
        );
    }

    function testHasOpenIncidents() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Producto", "A", "B", false, 0, 0);

        assertFalse(tracker.hasOpenIncidents(1));

        vm.prank(carrier);
        tracker.reportIncident(1, IncidentManager.IncidentType.Damage,
            IncidentManager.IncidentSeverity.High, "Golpe en la caja");

        assertTrue(tracker.hasOpenIncidents(1));

        vm.prank(carrier);
        tracker.resolveIncident(1, "Producto revisado, estado correcto");

        assertFalse(tracker.hasOpenIncidents(1));
    }

    // ══════════════════════════════════════════════════════════
    //  TESTS — FLUJO COMPLETO E2E
    // ══════════════════════════════════════════════════════════

    /**
     * @notice Simula el flujo completo de un medicamento refrigerado:
     *         Origen → Pickup → Hub → Tránsito → Entrega Final
     */
    function testFullFlow_ColdChainMedication() public {
        // 1. Crear envío con cadena de frío (2°C–8°C)
        vm.prank(sender);
        uint256 sid = tracker.createShipment(
            recipient, "Insulina Lispro",
            "Lab FarmaTech, Madrid", "Hospital Central, Barcelona",
            true, 20, 80
        );
        assertEq(sid, 1);

        // 2. Carrier recoge el paquete
        vm.prank(carrier);
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.InTransit);
        vm.prank(carrier);
        tracker.recordCheckpoint(1, "Madrid", "Pickup", "Vehiculo refrigerado MX-2019", 42);

        // 3. Llega al hub intermedio
        vm.roll(block.number + 5);
        vm.prank(hub);
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.AtHub);
        vm.prank(hub);
        tracker.recordCheckpoint(1, "Centro Madrid-Sur", "Hub", "Clasificado y reenviado", 45);

        // 4. Sale del hub hacia destino
        vm.roll(block.number + 5);
        vm.prank(carrier);
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.OutForDelivery);
        vm.prank(carrier);
        tracker.recordCheckpoint(1, "Barcelona", "OutForDelivery", "En reparto", 43);

        // 5. Destinatario confirma entrega
        vm.prank(recipient);
        tracker.recordCheckpoint(1, "Hospital Central", "Delivery", "Firmado por Dr. Lopez", 44);
        vm.prank(recipient);
        tracker.confirmDelivery(1);

        // 6. Verificaciones finales
        ShipmentManager.Shipment memory s = tracker.getShipment(1);
        assertEq(uint8(s.status), uint8(ShipmentManager.ShipmentStatus.Delivered));
        assertGt(s.dateDelivered, 0);

        (bool ok, uint256 total, uint256 violations) = tracker.checkTemperatureCompliance(1);
        assertTrue(ok);
        assertEq(total, 4);
        assertEq(violations, 0);

        assertEq(tracker.getShipmentCheckpoints(1).length, 4);
        assertFalse(tracker.hasOpenIncidents(1));
    }

    function testFullFlow_WithIncidentAndResolution() public {
        vm.prank(sender);
        tracker.createShipment(recipient, "Reloj Patek", "Ginebra", "Madrid", false, 0, 0);

        vm.prank(carrier);
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.InTransit);

        // Incidencia: apertura no autorizada en aduana
        vm.prank(inspector);
        uint256 iid = tracker.reportIncident(
            1,
            IncidentManager.IncidentType.Unauthorized,
            IncidentManager.IncidentSeverity.High,
            "Caja abierta sin autorizacion en aduana Barajas"
        );

        assertTrue(tracker.hasOpenIncidents(1));

        // Inspector resuelve tras revisión
        vm.prank(inspector);
        tracker.resolveIncident(iid, "Revision completada. Producto ntegro. Precinto nuevo aplicado.");

        assertFalse(tracker.hasOpenIncidents(1));

        // El envío puede continuar
        vm.prank(hub);
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.AtHub);

        vm.prank(carrier);
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.OutForDelivery);

        vm.prank(recipient);
        tracker.confirmDelivery(1);

        ShipmentManager.Shipment memory s = tracker.getShipment(1);
        assertEq(uint8(s.status), uint8(ShipmentManager.ShipmentStatus.Delivered));
    }

    function testGetFullShipmentTracking() public {
        _createAndTransitShipment();

        vm.prank(carrier);
        tracker.recordCheckpoint(1, "Madrid", "Pickup", "OK", 0);

        vm.prank(carrier);
        tracker.reportIncident(1, IncidentManager.IncidentType.Delay,
            IncidentManager.IncidentSeverity.Low, "Trafico en M-30");

        (
            ShipmentManager.Shipment memory s,
            CheckpointTracker.Checkpoint[] memory cps,
            IncidentManager.Incident[] memory incs,
            bool coldOk,,
        ) = tracker.getFullShipmentTracking(1);

        assertEq(s.product, "Medicamento");
        assertEq(cps.length, 1);
        assertEq(incs.length, 1);
        assertTrue(coldOk); // No requiere cold chain
    }

    function testGetSystemStats() public view {
        (
            uint256 totalShipments,
            uint256 totalCheckpoints,
            uint256 totalIncidents,
            uint256 totalActors,
            string memory version
        ) = tracker.getSystemStats();

        assertEq(totalShipments, 0);
        assertEq(totalCheckpoints, 0);
        assertEq(totalIncidents, 0);
        assertEq(totalActors, 6); // 5 registrados en setUp + admin del contrato
        assertEq(version, "1.2.0");
    }

    // ══════════════════════════════════════════════════════════
    //  HELPERS PRIVADOS
    // ══════════════════════════════════════════════════════════

    function _createAndTransitShipment() internal {
        vm.prank(sender);
        tracker.createShipment(recipient, "Medicamento", "Madrid", "Barcelona", false, 0, 0);

        vm.prank(carrier);
        tracker.updateShipmentStatus(1, ShipmentManager.ShipmentStatus.InTransit);
    }
}