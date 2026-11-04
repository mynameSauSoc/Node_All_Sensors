package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.AcousticMetrics;
import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.dto.mqtt.TelemetryPayload;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import com.example.AIoTLibTQB.repository.TelemetryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.support.MessageBuilder;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceWatchdogServiceTest {

    @Mock
    DeviceRepository deviceRepository;

    @Mock
    MongoTemplate mongoTemplate;

    @Mock
    AlertService alertService;

    @Mock
    DeviceMetadataCache deviceMetadataCache;

    @Mock
    TelemetryRepository telemetryRepository;

    @Mock
    TelemetrySanitizerService telemetrySanitizerService;

    @Mock
    DiscoveredDeviceService discoveredDeviceService;

    @Mock
    ComfortScoreService comfortScoreService;

    @Spy
    ObjectMapper objectMapper = new ObjectMapper();

    MutableClock clock;
    DeviceWatchdogService watchdogService;

    static class MutableClock extends Clock {
        private Instant currentInstant;
        private final ZoneId zone;

        public MutableClock(Instant initial) {
            this.currentInstant = initial;
            this.zone = ZoneId.of("UTC");
        }

        public void advance(Duration duration) {
            this.currentInstant = this.currentInstant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return currentInstant;
        }
    }

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-10-22T12:00:00Z"));
        watchdogService = new DeviceWatchdogService(
                deviceRepository,
                mongoTemplate,
                alertService,
                deviceMetadataCache,
                clock
        );
        watchdogService.clearOfflineInMemory();
    }

    @Nested
    @DisplayName("Watchdog Periodic Scan Tests (T3)")
    class WatchdogScanTests {

        @Test
        @DisplayName("scanOfflineDevices() - Chuyển thiết bị quá hạn 2 phút sang OFFLINE, cập nhật targeted $set, phát alert và invalidate cache")
        void scanOfflineDevices_transitionsActiveStaleDeviceToOffline() {
            Instant staleTime = clock.instant().minus(3, ChronoUnit.MINUTES);
            Device staleDevice = Device.builder()
                    .id("dev-stale-1")
                    .hardwareId("ESP32_STALE_1")
                    .roomId("room-101")
                    .zoneId("zone-A")
                    .isActive(true)
                    .lastSeenAt(staleTime)
                    .connectionState("ONLINE")
                    .build();

            when(deviceRepository.findByIsActiveTrueAndLastSeenAtBefore(any(Instant.class)))
                    .thenReturn(List.of(staleDevice));
            when(deviceRepository.findByIsActiveTrueAndLastSeenAtIsNull())
                    .thenReturn(Collections.emptyList());

            // Thực thi quét định kỳ
            watchdogService.scanOfflineDevices();

            // 1. Kiểm tra cập nhật có mục tiêu qua MongoTemplate ($set connectionState = OFFLINE, lastOfflineAt = now)
            ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
            ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
            verify(mongoTemplate).updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(Device.class));

            Document queryObj = queryCaptor.getValue().getQueryObject();
            assertThat(queryObj.get("hardwareId")).isEqualTo("ESP32_STALE_1");

            Document updateObj = updateCaptor.getValue().getUpdateObject();
            Document setClause = (Document) updateObj.get("$set");
            assertThat(setClause.getString("connectionState")).isEqualTo("OFFLINE");
            assertThat(setClause.get("lastOfflineAt")).isNotNull();

            // Tuyệt đối KHÔNG gọi save() trên toàn bộ Device entity
            verify(deviceRepository, never()).save(any());

            // 2. Kích hoạt cảnh báo DEVICE_OFFLINE qua AlertService
            verify(alertService).triggerDeviceOfflineAlert(
                    eq("dev-stale-1"),
                    eq("ESP32_STALE_1"),
                    eq("room-101")
            );

            // 3. Invalidate DeviceMetadataCache
            verify(deviceMetadataCache).invalidate("ESP32_STALE_1");

            // 4. Ghi nhận vào tập OFFLINE in-memory
            assertThat(watchdogService.isOffline("ESP32_STALE_1")).isTrue();
            assertThat(watchdogService.getOfflineDeviceHardwareIds()).contains("ESP32_STALE_1");
        }

        @Test
        @DisplayName("scanOfflineDevices() - Xử lý an toàn khi lastSeenAt == null mà không gây NullPointerException")
        void scanOfflineDevices_handlesNullLastSeenAtSafely() {
            Device nullLastSeenDevice = Device.builder()
                    .id("dev-null-1")
                    .hardwareId("ESP32_NULL_1")
                    .roomId("room-102")
                    .zoneId("zone-B")
                    .isActive(true)
                    .lastSeenAt(null)
                    .connectionState(null)
                    .build();

            when(deviceRepository.findByIsActiveTrueAndLastSeenAtBefore(any(Instant.class)))
                    .thenReturn(Collections.emptyList());
            when(deviceRepository.findByIsActiveTrueAndLastSeenAtIsNull())
                    .thenReturn(List.of(nullLastSeenDevice));

            List<String> offlineIds = watchdogService.scanOfflineDevices(clock.instant().minus(2, ChronoUnit.MINUTES));

            assertThat(offlineIds).containsExactly("ESP32_NULL_1");
            assertThat(watchdogService.isOffline("ESP32_NULL_1")).isTrue();

            verify(mongoTemplate).updateFirst(any(), any(), eq(Device.class));
            verify(alertService).triggerDeviceOfflineAlert("dev-null-1", "ESP32_NULL_1", "room-102");
            verify(deviceMetadataCache).invalidate("ESP32_NULL_1");
            verify(deviceRepository, never()).save(any());
        }

        @Test
        @DisplayName("scanOfflineDevices() - Bỏ qua thiết bị đang hoạt động bình thường (lastSeenAt chưa quá hạn)")
        void scanOfflineDevices_skipsRecentOnlineDevice() {
            Instant recentTime = clock.instant().minus(30, ChronoUnit.SECONDS);
            Device recentDevice = Device.builder()
                    .id("dev-recent-1")
                    .hardwareId("ESP32_RECENT_1")
                    .roomId("room-103")
                    .isActive(true)
                    .lastSeenAt(recentTime)
                    .connectionState("ONLINE")
                    .build();

            // Trả về thiết bị chưa quá hạn
            when(deviceRepository.findByIsActiveTrueAndLastSeenAtBefore(any(Instant.class)))
                    .thenReturn(List.of(recentDevice));

            watchdogService.scanOfflineDevices();

            verify(mongoTemplate, never()).updateFirst(any(), any(), eq(Device.class));
            verify(alertService, never()).triggerDeviceOfflineAlert(any(), any(), any());
            verify(deviceMetadataCache, never()).invalidate(any());
            assertThat(watchdogService.isOffline("ESP32_RECENT_1")).isFalse();
        }

        @Test
        @DisplayName("scanOfflineDevices() - Thiết bị đã ở trạng thái OFFLINE không kích hoạt lại cảnh báo hoặc cập nhật DB")
        void scanOfflineDevices_alreadyOfflineDoesNotRetriggerAlertOrUpdateDb() {
            Device alreadyOfflineDevice = Device.builder()
                    .id("dev-already-offline")
                    .hardwareId("ESP32_ALREADY_OFFLINE")
                    .roomId("room-104")
                    .isActive(true)
                    .lastSeenAt(clock.instant().minus(10, ChronoUnit.MINUTES))
                    .connectionState("OFFLINE")
                    .build();

            when(deviceRepository.findByIsActiveTrueAndLastSeenAtBefore(any(Instant.class)))
                    .thenReturn(List.of(alreadyOfflineDevice));

            watchdogService.scanOfflineDevices();

            // Không ghi lại DB và không trigger alert lại
            verify(mongoTemplate, never()).updateFirst(any(), any(), eq(Device.class));
            verify(alertService, never()).triggerDeviceOfflineAlert(any(), any(), any());
            verify(deviceMetadataCache, never()).invalidate(any());

            // Vẫn đảm bảo có mặt trong tập in-memory
            assertThat(watchdogService.isOffline("ESP32_ALREADY_OFFLINE")).isTrue();
        }
    }

    @Nested
    @DisplayName("Fast ONLINE Restoration Without DB Queries (ĐC3)")
    class FastOnlineRestorationTests {

        @Test
        @DisplayName("handleIncomingTelemetry() - Khi thiết bị có trong tập OFFLINE in-memory -> Chuyển ONLINE, đóng cảnh báo và invalidate cache")
        void handleIncomingTelemetry_whenDeviceInOfflineSet_restoresOnline() {
            watchdogService.markOfflineInMemory("ESP32_RECOVER_1");
            assertThat(watchdogService.isOffline("ESP32_RECOVER_1")).isTrue();

            boolean restored = watchdogService.handleIncomingTelemetry("ESP32_RECOVER_1");

            assertThat(restored).isTrue();
            assertThat(watchdogService.isOffline("ESP32_RECOVER_1")).isFalse();

            // Targeted update: $set connectionState = ONLINE, lastSeenAt = now
            ArgumentCaptor<Query> queryCaptor = ArgumentCaptor.forClass(Query.class);
            ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
            verify(mongoTemplate).updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(Device.class));

            assertThat(queryCaptor.getValue().getQueryObject().get("hardwareId")).isEqualTo("ESP32_RECOVER_1");
            Document setClause = (Document) updateCaptor.getValue().getUpdateObject().get("$set");
            assertThat(setClause.getString("connectionState")).isEqualTo("ONLINE");
            assertThat(setClause.get("lastSeenAt")).isNotNull();

            // Đóng (RESOLVED) cảnh báo DEVICE_OFFLINE
            verify(alertService).resolveDeviceOfflineAlert("ESP32_RECOVER_1");

            // Invalidate cache
            verify(deviceMetadataCache).invalidate("ESP32_RECOVER_1");

            // Không gọi save toàn entity
            verify(deviceRepository, never()).save(any());
        }

        @Test
        @DisplayName("handleIncomingTelemetry() - Khi thiết bị KHÔNG có trong tập OFFLINE in-memory -> Tuyệt đối KHÔNG truy vấn DB hay gọi alert")
        void handleIncomingTelemetry_whenDeviceNotInOfflineSet_doesZeroDbQueries() {
            assertThat(watchdogService.isOffline("ESP32_NORMAL_1")).isFalse();

            boolean restored = watchdogService.handleIncomingTelemetry("ESP32_NORMAL_1");

            assertThat(restored).isFalse();

            // Tuyệt đối không chạm vào MongoTemplate, AlertService hay DeviceMetadataCache
            verify(mongoTemplate, never()).updateFirst(any(), any(), eq(Device.class));
            verify(alertService, never()).resolveDeviceOfflineAlert(any());
            verify(deviceMetadataCache, never()).invalidate(any());
            verify(deviceRepository, never()).findByHardwareId(any());
            verify(deviceRepository, never()).findById(any());
        }

        @Test
        @DisplayName("Null safety: isOffline và handleIncomingTelemetry với null hardwareId an toàn trả về false")
        void nullSafety_returnsFalseSafely() {
            assertThat(watchdogService.isOffline(null)).isFalse();
            assertThat(watchdogService.handleIncomingTelemetry(null)).isFalse();
            assertThat(watchdogService.restoreOnline(null)).isFalse();
        }
    }

    @Nested
    @DisplayName("Integration Ingestion Hook with MqttMessageDispatcherService")
    class IngestionIntegrationTests {

        MqttMessageDispatcherService dispatcherService;

        @BeforeEach
        void initDispatcher() {
            dispatcherService = new MqttMessageDispatcherService(
                    objectMapper,
                    deviceMetadataCache,
                    alertService,
                    telemetryRepository,
                    telemetrySanitizerService,
                    discoveredDeviceService,
                    comfortScoreService,
                    mongoTemplate
            );
            dispatcherService.setDeviceWatchdogService(watchdogService);
            dispatcherService.lastSeenThrottleCache.invalidateAll();
        }

        @Test
        @DisplayName("Ingestion Hook - Thiết bị đang OFFLINE gửi telemetry -> Tự động chuyển lại ONLINE qua Watchdog hook")
        void ingestion_offlineDeviceRecoversOnTelemetry() {
            String hwId = "ESP32_OFFLINE_HOOK";
            watchdogService.markOfflineInMemory(hwId);
            assertThat(watchdogService.isOffline(hwId)).isTrue();

            DeviceMetadata mockMeta = DeviceMetadata.builder()
                    .id("dev-hook-1")
                    .hardwareId(hwId)
                    .roomId("room-hook")
                    .isActive(true)
                    .build();

            when(deviceMetadataCache.get(hwId)).thenReturn(Optional.of(mockMeta));
            when(telemetrySanitizerService.sanitize(eq("dev-hook-1"), any())).thenReturn(
                    new TelemetrySanitizerService.SanitizedMetrics(
                            AcousticMetrics.builder().noiseAvg(45.0).build(), null, null)
            );

            String json = """
            {
              "hardware_id": "%s",
              "timestamp": %d,
              "wifi_rssi": -60,
              "data": { "acoustics": { "noise_avg": 45.0 } }
            }
            """.formatted(hwId, Instant.now().getEpochSecond());

            var msg = MessageBuilder.withPayload(json)
                    .setHeader(MqttHeaders.RECEIVED_TOPIC, "devices/" + hwId + "/telemetry")
                    .build();

            dispatcherService.dispatch(msg);

            // Kiểm tra: Đã chuyển lại ONLINE và đóng cảnh báo
            assertThat(watchdogService.isOffline(hwId)).isFalse();
            verify(alertService).resolveDeviceOfflineAlert(hwId);
            verify(deviceMetadataCache, atLeastOnce()).invalidate(hwId);

            // Xác nhận cập nhật ONLINE qua MongoTemplate
            ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
            verify(mongoTemplate, atLeastOnce()).updateFirst(any(), updateCaptor.capture(), eq(Device.class));
            Document setClause = (Document) updateCaptor.getValue().getUpdateObject().get("$set");
            assertThat(setClause.getString("connectionState")).isEqualTo("ONLINE");
        }
    }
}
