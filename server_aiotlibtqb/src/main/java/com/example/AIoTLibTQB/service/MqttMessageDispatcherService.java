package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.ComfortScoreRecord;
import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.document.TelemetryMetadata;
import com.example.AIoTLibTQB.document.TelemetryRecord;
import com.example.AIoTLibTQB.dto.mqtt.StatusPayload;
import com.example.AIoTLibTQB.dto.mqtt.TelemetryPayload;
import com.example.AIoTLibTQB.dto.response.TelemetryResponse;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import com.example.AIoTLibTQB.repository.TelemetryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.mongodb.client.result.UpdateResult;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class MqttMessageDispatcherService {

    ObjectMapper objectMapper;
    DeviceMetadataCache deviceMetadataCache;
    AlertService alertService;
    TelemetryRepository telemetryRepository;
    TelemetrySanitizerService telemetrySanitizerService;
    DiscoveredDeviceService discoveredDeviceService;
    ComfortScoreService comfortScoreService;
    MongoTemplate mongoTemplate;

    @Autowired(required = false)
    @lombok.experimental.NonFinal
    DeviceWatchdogService deviceWatchdogService;

    public void setDeviceWatchdogService(DeviceWatchdogService deviceWatchdogService) {
        this.deviceWatchdogService = deviceWatchdogService;
    }

    @Autowired(required = false)
    @lombok.experimental.NonFinal
    LatestTelemetryCache latestTelemetryCache;

    public void setLatestTelemetryCache(LatestTelemetryCache latestTelemetryCache) {
        this.latestTelemetryCache = latestTelemetryCache;
    }

    private static final Duration LAST_SEEN_THROTTLE_WINDOW = Duration.ofSeconds(30);
    private static final int MONGO_WRITE_PERMITS = 30;
    private static final long MONGO_ACQUIRE_TIMEOUT_MS = 3000;

    @lombok.experimental.PackagePrivate
    Cache<String, Instant> lastSeenThrottleCache = Caffeine.newBuilder()
            .expireAfterWrite(LAST_SEEN_THROTTLE_WINDOW)
            .maximumSize(10_000)
            .build();

    @lombok.experimental.PackagePrivate
    final Semaphore mongoWriteSemaphore = new Semaphore(MONGO_WRITE_PERMITS, true);

    private static final Pattern STATUS_TOPIC_PATTERN = Pattern.compile("^devices/([^/]+)/status$");
    private static final Pattern TELEMETRY_TOPIC_PATTERN = Pattern.compile("^devices/([^/]+)/telemetry$");

    @ServiceActivator(inputChannel = "mqttInboundChannel")
    public void dispatch(Message<?> message) {
        String topic = (String) message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC);
        Object rawPayload = message.getPayload();

        if (topic == null || rawPayload == null) {
            log.warn("Received MQTT message without topic or payload: {}", message);
            return;
        }

        String payloadStr = (rawPayload instanceof byte[])
                ? new String((byte[]) rawPayload, StandardCharsets.UTF_8)
                : rawPayload.toString();

        try {
            Matcher statusMatcher = STATUS_TOPIC_PATTERN.matcher(topic);
            if (statusMatcher.matches()) {
                String topicHardwareId = statusMatcher.group(1);
                handleStatusMessage(topicHardwareId, payloadStr);
                return;
            }

            Matcher telemetryMatcher = TELEMETRY_TOPIC_PATTERN.matcher(topic);
            if (telemetryMatcher.matches()) {
                String topicHardwareId = telemetryMatcher.group(1);
                handleTelemetryMessage(topicHardwareId, payloadStr);
                return;
            }

            log.debug("Ignored unrecognized MQTT topic: {}", topic);

        } catch (Exception e) {
            log.error("Failed to parse/process MQTT message from topic '{}': payload='{}', error: {}",
                    topic, payloadStr, e.getMessage(), e);
        }
    }

    private void handleStatusMessage(String topicHardwareId, String payloadStr) {
        try {
            StatusPayload statusPayload = objectMapper.readValue(payloadStr, StatusPayload.class);
            String hardwareId = topicHardwareId;

            if (statusPayload.getHardwareId() != null && !statusPayload.getHardwareId().isBlank()
                    && !statusPayload.getHardwareId().equals(topicHardwareId)) {
                log.warn("Hardware ID spoofing/mismatch detected in status payload: topic='{}', payload='{}'",
                        topicHardwareId, statusPayload.getHardwareId());
                return;
            }

            boolean isOffline = "offline".equalsIgnoreCase(statusPayload.getStatus());
            Query query = Query.query(Criteria.where("hardwareId").is(hardwareId));
            Update update = new Update();

            if (isOffline) {
                update.set("connectionState", "OFFLINE");
                update.set("lastOfflineAt", Instant.now());
                lastSeenThrottleCache.invalidate(hardwareId);
            } else {
                update.set("connectionState", "ONLINE");
                update.set("lastSeenAt", Instant.now());
                lastSeenThrottleCache.put(hardwareId, Instant.now());
            }

            if (statusPayload.getFirmwareVersion() != null && !statusPayload.getFirmwareVersion().isBlank()) {
                update.set("firmwareVersion", statusPayload.getFirmwareVersion());
            }

            UpdateResult result = mongoTemplate.updateFirst(query, update, Device.class);
            if (result.getMatchedCount() > 0) {
                deviceMetadataCache.invalidate(hardwareId);
                log.info("Device status updated: hardwareId={}, status={}, reason={}",
                        hardwareId, statusPayload.getStatus(), statusPayload.getReason());

                if (alertService != null) {
                    DeviceMetadata metadata = deviceMetadataCache.get(hardwareId).orElse(null);
                    if (metadata != null && metadata.isActive()) {
                        if (isOffline) {
                            alertService.triggerDeviceOfflineAlert(metadata.getId(), metadata.getHardwareId(), metadata.getRoomId());
                            if (deviceWatchdogService != null) {
                                deviceWatchdogService.recordOfflineDevice(hardwareId);
                            }
                        } else {
                            alertService.resolveDeviceOfflineAlert(hardwareId);
                        }
                    }
                }
            } else {
                log.info("Status received from unregistered device: hardwareId={}, status={}",
                        hardwareId, statusPayload.getStatus());
                discoveredDeviceService.recordDiscovered(hardwareId, null);
            }

        } catch (Exception e) {
            log.error("Error handling status message for hardwareId={}: {}", topicHardwareId, e.getMessage(), e);
        }
    }

    private void handleTelemetryMessage(String topicHardwareId, String payloadStr) {
        try {
            TelemetryPayload telemetryPayload = objectMapper.readValue(payloadStr, TelemetryPayload.class);
            String hardwareId = topicHardwareId;

            if (telemetryPayload.getHardwareId() != null && !telemetryPayload.getHardwareId().isBlank()
                    && !telemetryPayload.getHardwareId().equals(topicHardwareId)) {
                log.warn("Hardware ID spoofing/mismatch detected in telemetry payload: topic='{}', payload='{}'",
                        topicHardwareId, telemetryPayload.getHardwareId());
                return;
            }

            DeviceMetadata device = deviceMetadataCache.get(hardwareId).orElse(null);

            if (device == null) {
                discoveredDeviceService.recordDiscovered(hardwareId, telemetryPayload.getWifiRssi());
                log.debug("Telemetry dropped & recorded into discovery queue: hardwareId={}", hardwareId);
                return;
            }

            if (!device.isActive()) {
                log.warn("Telemetry rejected from inactive device: id={}, hardwareId={}", device.getId(), hardwareId);
                return;
            }

            // Hook Ingestion: Phục hồi ONLINE nhanh không truy vấn DB nếu thiết bị thuộc tập OFFLINE in-memory
            boolean restoredOnline = false;
            if (deviceWatchdogService != null) {
                restoredOnline = deviceWatchdogService.handleIncomingTelemetry(hardwareId);
            }

            if (restoredOnline) {
                lastSeenThrottleCache.put(hardwareId, Instant.now());
            } else {
                // Cập nhật nguyên tử lastSeenAt có throttling (30s) để giảm Write Amplification
                Instant lastSeenUpdate = lastSeenThrottleCache.getIfPresent(hardwareId);
                if (lastSeenUpdate == null) {
                    Update update = new Update().set("lastSeenAt", Instant.now());
                    if (deviceWatchdogService == null) {
                        update.set("connectionState", "ONLINE");
                    }
                    mongoTemplate.updateFirst(
                            Query.query(Criteria.where("hardwareId").is(hardwareId)),
                            update,
                            Device.class
                    );
                    lastSeenThrottleCache.put(hardwareId, Instant.now());
                }
            }


            // Lọc và làm sạch dữ liệu cảm biến
            TelemetrySanitizerService.SanitizedMetrics sanitized =
                    telemetrySanitizerService.sanitize(device.getId(), telemetryPayload.getData());

            // R3: Bỏ qua bản tin telemetry không chứa bất kỳ số liệu cảm biến hợp lệ nào (empty record)
            if (isEmptyMetrics(sanitized)) {
                log.debug("Discarded empty telemetry record with no valid metrics: hardwareId={}", hardwareId);
                return;
            }

            // Đánh giá cảnh báo FSM theo thời gian thực (in-memory, không query DB) với dữ liệu đã lọc sạch
            if (alertService != null) {
                TelemetryPayload.TelemetryData cleanData = toTelemetryData(sanitized);
                alertService.evaluateTelemetry(device.getId(), device.getHardwareId(), device.getRoomId(), cleanData);
            }

            // Chuẩn hóa thời gian đo (hỗ trợ cả millis/seconds, bảo toàn lịch sử buffered, kẹp lệch tương lai/pre-2020)
            Instant now = Instant.now();
            Instant timestamp = parseAndNormalizeTimestamp(telemetryPayload.getTimestamp(), now, hardwareId);

            ComfortScoreRecord comfortScore = comfortScoreService.calculateForRoom(sanitized, device.getRoomId());

            TelemetryRecord record = TelemetryRecord.builder()
                    .timestamp(timestamp)
                    .metadata(TelemetryMetadata.builder()
                            .deviceId(device.getId())
                            .hardwareId(device.getHardwareId())
                            .roomId(device.getRoomId())
                            .build())
                    .acoustics(sanitized.getAcoustics())
                    .airQuality(sanitized.getAirQuality())
                    .environment(sanitized.getEnvironment())
                    .comfortScore(comfortScore)
                    .wifiRssi(telemetryPayload.getWifiRssi())
                    .build();

            // Bảo vệ tải ghi đồng thời vào MongoDB bằng Semaphore
            boolean acquired = false;
            try {
                acquired = mongoWriteSemaphore.tryAcquire(MONGO_ACQUIRE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
                if (!acquired) {
                    log.warn("MongoDB write throttled: semaphore acquisition timed out after {}ms for hardwareId={}",
                            MONGO_ACQUIRE_TIMEOUT_MS, hardwareId);
                    return;
                }
                telemetryRepository.save(record);
                if (latestTelemetryCache != null && device.getRoomId() != null) {
                    boolean isReplay = Boolean.TRUE.equals(telemetryPayload.getIsReplay());
                    java.util.Optional<TelemetryResponse> optLatest = latestTelemetryCache.getRoomTelemetry(device.getRoomId());
                    boolean isNewerOrEqual = !isReplay && (optLatest.isEmpty() || optLatest.get().getTimestamp() == null || !timestamp.isBefore(optLatest.get().getTimestamp()));
                    if (isNewerOrEqual) {
                        TelemetryResponse response = TelemetryResponse.builder()
                                .id(record.getId())
                                .timestamp(record.getTimestamp())
                                .metadata(record.getMetadata())
                                .acoustics(record.getAcoustics())
                                .airQuality(record.getAirQuality())
                                .environment(record.getEnvironment())
                                .comfortScore(record.getComfortScore())
                                .wifiRssi(record.getWifiRssi())
                                .build();
                        latestTelemetryCache.putRoomTelemetry(device.getRoomId(), response);
                    } else {
                        log.debug("Skipped latest telemetry cache update for historical/replay packet: hardwareId={}, ts={}", hardwareId, timestamp);
                    }
                }
                log.debug("Saved telemetry record for device: hardwareId={}, roomId={}, ts={}",
                        hardwareId, device.getRoomId(), timestamp);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted while waiting for MongoDB write semaphore for hardwareId={}: {}", hardwareId, e.getMessage());
            } finally {
                if (acquired) {
                    mongoWriteSemaphore.release();
                }
            }

        } catch (Exception e) {
            log.error("Error handling telemetry message for hardwareId={}: {}", topicHardwareId, e.getMessage(), e);
        }
    }

    private Instant parseAndNormalizeTimestamp(Long rawTimestamp, Instant now, String hardwareId) {
        if (rawTimestamp == null || rawTimestamp <= 0) {
            return now;
        }

        Instant parsed;
        if (rawTimestamp >= 100_000_000_000L) {
            parsed = Instant.ofEpochMilli(rawTimestamp);
        } else {
            parsed = Instant.ofEpochSecond(rawTimestamp);
        }

        if (parsed.isBefore(Instant.parse("2020-01-01T00:00:00Z"))) {
            log.warn("Telemetry timestamp out of bounds ({}), clamping to current server time for hardwareId={}",
                    parsed, hardwareId);
            return now;
        }

        if (parsed.isAfter(now.plusSeconds(60))) {
            log.warn("Telemetry timestamp out of bounds in future ({}), clamping to current server time for hardwareId={}",
                    parsed, hardwareId);
            return now;
        }

        return parsed;
    }

    private TelemetryPayload.TelemetryData toTelemetryData(TelemetrySanitizerService.SanitizedMetrics sanitized) {
        if (sanitized == null) return null;
        TelemetryPayload.AcousticsData acoustics = null;
        if (sanitized.getAcoustics() != null) {
            acoustics = TelemetryPayload.AcousticsData.builder()
                    .noiseAvg(sanitized.getAcoustics().getNoiseAvg())
                    .noisePeak(sanitized.getAcoustics().getNoisePeak())
                    .build();
        }
        TelemetryPayload.EnvironmentData env = null;
        if (sanitized.getEnvironment() != null) {
            env = TelemetryPayload.EnvironmentData.builder()
                    .temperature(sanitized.getEnvironment().getTemperature())
                    .humidity(sanitized.getEnvironment().getHumidity())
                    .lux(sanitized.getEnvironment().getLux())
                    .co2(sanitized.getEnvironment().getCo2())
                    .build();
        }
        TelemetryPayload.AirQualityData airQuality = null;
        if (sanitized.getAirQuality() != null) {
            airQuality = TelemetryPayload.AirQualityData.builder()
                    .pm1_0(sanitized.getAirQuality().getPm1_0())
                    .pm2_5(sanitized.getAirQuality().getPm2_5())
                    .pm4_0(sanitized.getAirQuality().getPm4_0())
                    .pm10(sanitized.getAirQuality().getPm10())
                    .build();
        }
        return TelemetryPayload.TelemetryData.builder()
                .acoustics(acoustics)
                .environment(env)
                .airQuality(airQuality)
                .build();
    }

    private boolean isEmptyMetrics(TelemetrySanitizerService.SanitizedMetrics sanitized) {
        if (sanitized == null) {
            return true;
        }
        return sanitized.getAcoustics() == null
                && sanitized.getAirQuality() == null
                && sanitized.getEnvironment() == null;
    }
}
