package com.tnl.logistics.config;

import com.tnl.logistics.repository.AppUserRepository;
import com.tnl.logistics.repository.ClientRepository;
import com.tnl.logistics.model.LabelStatus;
import com.tnl.logistics.model.ParcelStatus;
import com.tnl.logistics.model.WaybillStatus;
import com.tnl.logistics.repository.ParcelUnitRepository;
import com.tnl.logistics.repository.PaymentRepository;
import com.tnl.logistics.repository.TrackingEventRepository;
import com.tnl.logistics.repository.VehicleRepository;
import com.tnl.logistics.repository.WaybillRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

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

    @Test
    void seedsProductionShapedWorkflowFixturesWithConsistentLifecycleHistory() {
        assertTrue(environment.acceptsProfiles(Profiles.of("test")));
        assertTrue(environment.getProperty("app.seed.workflow-fixtures", Boolean.class, false));
        assertTrue(environment.getProperty("app.seed.sample-data", Boolean.class, false));
        assertTrue(appUserRepository.findById("U-003").isPresent());
        assertTrue(clientRepository.findById("CL-001").isPresent());

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
    }
}
