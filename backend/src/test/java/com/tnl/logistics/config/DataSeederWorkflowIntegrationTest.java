package com.tnl.logistics.config;

import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.model.LabelStatus;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.WaybillStatus;
import com.tnl.logistics.model.SystemSetting;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.PaymentRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.repository.VehicleRepository;
import com.tnl.logistics.repository.WaybillRepository;
import com.tnl.logistics.repository.SystemSettingRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@SpringBootTest(properties = {
        "app.seed.workflow-fixtures=true",
        "spring.datasource.url=jdbc:mysql://localhost:3306/tnl_workflow_fixture_test?createDatabaseIfNotExist=true"
})
@ActiveProfiles("test")
class DataSeederWorkflowIntegrationTest {

    @Autowired
    private Environment environment;
    @Autowired
    private AppUserRepository appUserRepository;
    @Autowired
    private BCryptPasswordEncoder passwordEncoder;
    @Autowired
    private ClientRepository clientRepository;
    @Autowired
    private ParcelUnitRepository parcelUnitRepository;
    @Autowired
    private TrackingEventRepository trackingEventRepository;
    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private VehicleRepository vehicleRepository;
    @Autowired
    private WaybillRepository waybillRepository;
    @Autowired
    private SystemSettingRepository systemSettingRepository;
    @Autowired
    private DataSeeder dataSeeder;

    @Test
    void seedsProductionShapedWorkflowFixturesWithConsistentLifecycleHistory() {
        assertTrue(environment.acceptsProfiles(Profiles.of("test")));
        assertTrue(environment.getProperty("app.seed.workflow-fixtures", Boolean.class, false));
        assertTrue(environment.getProperty("app.seed.sample-data", Boolean.class, false));
        assertTrue(appUserRepository.findById("U-003").isPresent());
        assertTrue(clientRepository.findById("CL-001").isPresent());

        List<String> staffUserIds = List.of("U-002", "U-003", "U-004", "U-005");
        for (String staffUserId : staffUserIds) {
            String pinHash = appUserRepository.findById(staffUserId).orElseThrow().getPinHash();
            assertTrue(passwordEncoder.matches("1111", pinHash));
        }
        var haulerUser = appUserRepository.findById("U-004").orElseThrow();
        assertEquals("hauler", haulerUser.getUsername());
        assertTrue(passwordEncoder.matches("hauler123", haulerUser.getPasswordHash()));

        int year = LocalDate.now(ZoneOffset.UTC).getYear();
        List<ParcelStatus> expectedFinalStatuses = List.of(
                ParcelStatus.QR_GENERATED,
                ParcelStatus.LOADED_ON_TRUCK,
                ParcelStatus.ARRIVED_AT_TNL,
                ParcelStatus.LOADED_TO_HAULER,
                ParcelStatus.LOADED_TO_HAULER,
                ParcelStatus.COMPLETED
        );

        for (int sequence = 1; sequence <= expectedFinalStatuses.size(); sequence++) {
            String trackingId = String.format("TRK-%d-%06d", year, sequence);
            var parcel = parcelUnitRepository.findById(trackingId).orElseThrow();

            assertEquals(expectedFinalStatuses.get(sequence - 1), parcel.getCurrentStatus());
            assertEquals(expectedFinalStatuses.get(sequence - 1),
                    trackingEventRepository.findByParcelUnit_TrackingIdOrderByEventTimestampAsc(trackingId).getLast().getStatus());
        }

        assertTrue(vehicleRepository.findById("VH-001").isPresent());
        assertEquals(LabelStatus.REPRINTED, parcelUnitRepository.findById(String.format("TRK-%d-000003", year)).orElseThrow().getLabelStatus());
        assertEquals(1, paymentRepository.findByShipment_ShipmentId(String.format("SHP-%d-002", year)).size());
        assertEquals(WaybillStatus.SENT_TO_HAULER, waybillRepository.findByShipment_ShipmentId(String.format("SHP-%d-005", year)).orElseThrow().getStatus());
        assertEquals(WaybillStatus.SIGNED_COMPLETED, waybillRepository.findByShipment_ShipmentId(String.format("SHP-%d-006", year)).orElseThrow().getStatus());

        SystemSetting workflowSettings = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID).orElseThrow();
        workflowSettings.setSoaBankName(null);
        workflowSettings.setSoaAccountName("   ");
        workflowSettings.setSoaAccountNumber(null);
        systemSettingRepository.saveAndFlush(workflowSettings);
        dataSeeder.run();
        workflowSettings = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID).orElseThrow();
        assertEquals("BDO Unibank", workflowSettings.getSoaBankName());
        assertEquals("TNL Workflow Demo", workflowSettings.getSoaAccountName());
        assertEquals("000000000000", workflowSettings.getSoaAccountNumber());

        long settingsCount = systemSettingRepository.count();
        dataSeeder.run();
        assertEquals(settingsCount, systemSettingRepository.count());

        workflowSettings.setSoaBankName("Custom Workflow Bank");
        workflowSettings.setSoaAccountName("Custom Workflow Account");
        workflowSettings.setSoaAccountNumber("001122334455");
        systemSettingRepository.saveAndFlush(workflowSettings);

        dataSeeder.run();
        SystemSetting preservedSettings = systemSettingRepository.findById(SystemSetting.DEFAULT_SETTING_ID).orElseThrow();
        assertEquals("Custom Workflow Bank", preservedSettings.getSoaBankName());
        assertEquals("Custom Workflow Account", preservedSettings.getSoaAccountName());
        assertEquals("001122334455", preservedSettings.getSoaAccountNumber());

        preservedSettings.setSoaBankName("BDO Unibank");
        preservedSettings.setSoaAccountName("TNL Workflow Demo");
        preservedSettings.setSoaAccountNumber("000000000000");
        systemSettingRepository.saveAndFlush(preservedSettings);
    }

    @Test
    void seedsAdvancedWorkflowScenariosForWaybillPrintingLoadingAndSplitLifecycle() {
        int year = LocalDate.now(ZoneOffset.UTC).getYear();

        // 1. Registered VIP Clients and Charge Models
        var client1 = clientRepository.findById("CL-001").orElseThrow();
        assertEquals(com.tnl.logistics.model.ChargeModel.PER_PARCEL, client1.getDefaultRateType());
        assertEquals(new java.math.BigDecimal("35.00"), client1.getRatePerKilo());

        var client5 = clientRepository.findById("CL-005").orElseThrow();
        assertEquals("Cordillera Highlands Produce", client5.getName());
        assertEquals(com.tnl.logistics.model.ChargeModel.PER_PARCEL, client5.getDefaultRateType());
        assertEquals(new java.math.BigDecimal("38.00"), client5.getRatePerKilo());

        // 2. Fixture 7: Multi-unit registered shipment with unprinted labels
        String shp7 = String.format("SHP-%d-007", year);
        var shipment7Units = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shp7);
        assertEquals(3, shipment7Units.size());
        for (var unit : shipment7Units) {
            assertEquals(ParcelStatus.REGISTERED, unit.getCurrentStatus());
            assertEquals(LabelStatus.NOT_PRINTED, unit.getLabelStatus());
            assertNull(unit.getWaybill());
        }

        // 3. Fixture 8: Available loading & generation (3 units loaded to hauler, 2 arrived at TNL)
        String shp8 = String.format("SHP-%d-008", year);
        var shipment8Units = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shp8);
        assertEquals(5, shipment8Units.size());
        long unassignedLoadedCount = shipment8Units.stream()
                .filter(u -> u.getCurrentStatus() == ParcelStatus.LOADED_TO_HAULER && u.getWaybill() == null)
                .count();
        long arrivedCount = shipment8Units.stream()
                .filter(u -> u.getCurrentStatus() == ParcelStatus.ARRIVED_AT_TNL && u.getWaybill() == null)
                .count();
        assertEquals(3, unassignedLoadedCount);
        assertEquals(2, arrivedCount);

        // 4. Fixture 9: Multi-unit GENERATED waybill with vehicle and driver metadata (WYB-YYYY-0007)
        String wyb7 = String.format("WYB-%d-%04d", year, 7);
        var waybill7 = waybillRepository.findById(wyb7).orElseThrow();
        assertEquals(WaybillStatus.GENERATED, waybill7.getStatus());
        assertEquals("Rogelio Aquino", waybill7.getDriverName());
        assertEquals("0917-555-1004", waybill7.getDriverContact());
        assertEquals("NCP-2401", waybill7.getVehiclePlate());
        assertEquals("Fragile hardware items - handle with care. Gate 2 delivery.", waybill7.getRemarks());
        assertEquals(4, parcelUnitRepository.findByWaybill_WaybillIdOrderBySeqAsc(wyb7).size());

        // 5. Fixture 10 & 11: SENT_TO_HAULER waybills for returned waybill rail & recommendations
        String wyb8 = String.format("WYB-%d-%04d", year, 8);
        var waybill8 = waybillRepository.findById(wyb8).orElseThrow();
        assertEquals(WaybillStatus.SENT_TO_HAULER, waybill8.getStatus());
        assertEquals("Cordillera Freight", waybill8.getHaulerName());
        assertEquals(3, parcelUnitRepository.findByWaybill_WaybillIdOrderBySeqAsc(wyb8).size());

        String wyb9 = String.format("WYB-%d-%04d", year, 9);
        var waybill9 = waybillRepository.findById(wyb9).orElseThrow();
        assertEquals(WaybillStatus.SENT_TO_HAULER, waybill9.getStatus());
        assertEquals("Northbound Hauling", waybill9.getHaulerName());
        assertEquals(2, parcelUnitRepository.findByWaybill_WaybillIdOrderBySeqAsc(wyb9).size());

        // 6. Fixture 12: Split waybill partial completion (2 completed, 2 sent to hauler)
        String shp12 = String.format("SHP-%d-012", year);
        var shipment12Units = parcelUnitRepository.findByShipment_ShipmentIdOrderBySeqAsc(shp12);
        assertEquals(4, shipment12Units.size());

        String wyb10 = String.format("WYB-%d-%04d", year, 10);
        var waybill10 = waybillRepository.findById(wyb10).orElseThrow();
        assertEquals(WaybillStatus.SIGNED_COMPLETED, waybill10.getStatus());
        assertEquals("Juan Dela Cruz", waybill10.getSignedBy());
        assertEquals(2, parcelUnitRepository.findByWaybill_WaybillIdOrderBySeqAsc(wyb10).size());

        String wyb11 = String.format("WYB-%d-%04d", year, 11);
        var waybill11 = waybillRepository.findById(wyb11).orElseThrow();
        assertEquals(WaybillStatus.SENT_TO_HAULER, waybill11.getStatus());
        assertEquals(2, parcelUnitRepository.findByWaybill_WaybillIdOrderBySeqAsc(wyb11).size());
    }
}
