package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service to periodically scan for inactive/stale devices and mark them OFFLINE.
 * Maintains an in-memory set of offline devices to enable instant recovery to ONLINE
 * upon receiving new telemetry, without querying MongoDB for status checks on normal packets.
 */
@Slf4j
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DeviceWatchdogService {

    DeviceRepository deviceRepository;
    MongoTemplate mongoTemplate;
    AlertService alertService;
    DeviceMetadataCache deviceMetadataCache;

    @lombok.experimental.NonFinal
    Clock clock;

    Set<String> offlineDeviceHardwareIds = ConcurrentHashMap.newKeySet();

    @Autowired
    public DeviceWatchdogService(
            DeviceRepository deviceRepository,
            MongoTemplate mongoTemplate,
            AlertService alertService,
            DeviceMetadataCache deviceMetadataCache,
            @Autowired(required = false) Clock clock) {
        this.deviceRepository = deviceRepository;
        this.mongoTemplate = mongoTemplate;
        this.alertService = alertService;
        this.deviceMetadataCache = deviceMetadataCache;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public DeviceWatchdogService(
            DeviceRepository deviceRepository,
            MongoTemplate mongoTemplate,
            AlertService alertService,
            DeviceMetadataCache deviceMetadataCache) {
        this(deviceRepository, mongoTemplate, alertService, deviceMetadataCache, Clock.systemUTC());
    }

    /**
     * Periodic background watchdog job running every 15 seconds.
     * Checks for active devices with lastSeenAt older than 2 minutes (or null).
     */
    @Scheduled(fixedRate = 15000)
    public void scanOfflineDevices() {
        Instant threshold = clock.instant().minus(2, ChronoUnit.MINUTES);
        scanOfflineDevices(threshold);
    }

    /**
     * Scans for active devices whose lastSeenAt is before the specified threshold
     * (or null), transitions them to OFFLINE, triggers alerts, and invalidates metadata cache.
     *
     * @param threshold the threshold cutoff instant
     * @return list of hardware IDs that were newly transitioned to OFFLINE
     */
    public List<String> scanOfflineDevices(Instant threshold) {
        log.debug("Starting watchdog offline scan with threshold={}", threshold);
        List<Device> staleDevices = new ArrayList<>();

        List<Device> pastThreshold = deviceRepository.findByIsActiveTrueAndLastSeenAtBefore(threshold);
        if (pastThreshold != null) {
            staleDevices.addAll(pastThreshold);
        }

        List<Device> nullLastSeen = deviceRepository.findByIsActiveTrueAndLastSeenAtIsNull();
        if (nullLastSeen != null) {
            for (Device dev : nullLastSeen) {
                if (dev != null && dev.getHardwareId() != null
                        && staleDevices.stream().noneMatch(d -> dev.getHardwareId().equals(d.getHardwareId()))) {
                    staleDevices.add(dev);
                }
            }
        }

        List<String> newlyOfflineHardwareIds = new ArrayList<>();

        for (Device device : staleDevices) {
            if (device == null || device.getHardwareId() == null) {
                continue;
            }

            // Safe check: if lastSeenAt is present, ensure it is truly before threshold
            if (device.getLastSeenAt() != null && !device.getLastSeenAt().isBefore(threshold)) {
                continue;
            }

            String hardwareId = device.getHardwareId();
            String deviceId = device.getId();
            String roomId = device.getRoomId();

            boolean alreadyOffline = "OFFLINE".equalsIgnoreCase(device.getConnectionState())
                    || offlineDeviceHardwareIds.contains(hardwareId);

            if (!alreadyOffline) {
                // Targeted update in MongoDB ($set connectionState = OFFLINE, lastOfflineAt = now)
                Query query = Query.query(Criteria.where("hardwareId").is(hardwareId));
                Update update = new Update()
                        .set("connectionState", "OFFLINE")
                        .set("lastOfflineAt", clock.instant());
                mongoTemplate.updateFirst(query, update, Device.class);

                // Track in-memory
                offlineDeviceHardwareIds.add(hardwareId);

                // Trigger DEVICE_OFFLINE alert
                alertService.triggerDeviceOfflineAlert(deviceId, hardwareId, roomId);

                // Invalidate device metadata cache
                deviceMetadataCache.invalidate(hardwareId);

                newlyOfflineHardwareIds.add(hardwareId);
                log.warn("Watchdog transitioned device to OFFLINE: hardwareId={}, deviceId={}, roomId={}",
                        hardwareId, deviceId, roomId);
            } else {
                // Keep tracked in memory set
                offlineDeviceHardwareIds.add(hardwareId);
            }
        }

        return newlyOfflineHardwareIds;
    }

    /**
     * Checks whether the device is currently tracked as OFFLINE in the in-memory set.
     * This requires ZERO database queries.
     *
     * @param hardwareId the hardware ID of the device
     * @return true if device is in offline set; false otherwise
     */
    public boolean isOffline(String hardwareId) {
        if (hardwareId == null) {
            return false;
        }
        return offlineDeviceHardwareIds.contains(hardwareId);
    }

    public void recordOfflineDevice(String hardwareId) {
        if (hardwareId != null) {
            offlineDeviceHardwareIds.add(hardwareId);
        }
    }

    /**
     * Handles incoming telemetry packets in the ingestion pipeline.
     * If and ONLY if the device is present in the in-memory OFFLINE set:
     * 1. Removes device from in-memory offline set
     * 2. Targeted update in MongoDB ($set connectionState = ONLINE, lastSeenAt = now)
     * 3. Resolves DEVICE_OFFLINE alert
     * 4. Invalidates device metadata cache
     *
     * If the device is NOT in the offline set, this method makes ZERO database queries.
     *
     * @param hardwareId the hardware ID of the device
     * @return true if the device was restored from OFFLINE to ONLINE; false otherwise
     */
    public boolean handleIncomingTelemetry(String hardwareId) {
        if (hardwareId == null) {
            return false;
        }

        if (offlineDeviceHardwareIds.remove(hardwareId)) {
            // Targeted update in MongoDB ($set connectionState = ONLINE, lastSeenAt = now)
            Query query = Query.query(Criteria.where("hardwareId").is(hardwareId));
            Update update = new Update()
                    .set("connectionState", "ONLINE")
                    .set("lastSeenAt", clock.instant());
            mongoTemplate.updateFirst(query, update, Device.class);

            // Resolve DEVICE_OFFLINE alert
            alertService.resolveDeviceOfflineAlert(hardwareId);

            // Invalidate device metadata cache
            deviceMetadataCache.invalidate(hardwareId);

            log.info("Device restored from OFFLINE to ONLINE: hardwareId={}", hardwareId);
            return true;
        }

        return false;
    }

    /**
     * Alias for handleIncomingTelemetry for explicit restoration calls.
     */
    public boolean restoreOnline(String hardwareId) {
        return handleIncomingTelemetry(hardwareId);
    }

    /**
     * Returns an unmodifiable view of the in-memory offline hardware IDs.
     */
    public Set<String> getOfflineDeviceHardwareIds() {
        return Collections.unmodifiableSet(offlineDeviceHardwareIds);
    }

    /**
     * Manually records a device as offline in the in-memory set.
     */
    public void markOfflineInMemory(String hardwareId) {
        if (hardwareId != null) {
            offlineDeviceHardwareIds.add(hardwareId);
        }
    }

    /**
     * Manually removes a device from the in-memory offline set.
     */
    public void removeOfflineDevice(String hardwareId) {
        if (hardwareId != null) {
            offlineDeviceHardwareIds.remove(hardwareId);
        }
    }

    /**
     * Clears all in-memory offline hardware IDs.
     */
    public void clearOfflineInMemory() {
        offlineDeviceHardwareIds.clear();
    }

    /**
     * Sets the Clock instance for time-deterministic testing.
     */
    public void setClock(Clock clock) {
        this.clock = clock != null ? clock : Clock.systemUTC();
    }
}
