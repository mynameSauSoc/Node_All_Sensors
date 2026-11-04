package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DeviceMetadataCacheImpl implements DeviceMetadataCache {

    DeviceRepository deviceRepository;

    @lombok.experimental.PackagePrivate
    Cache<String, DeviceMetadata> cache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofMinutes(30))
            .build();

    @Override
    public Optional<DeviceMetadata> get(String hardwareId) {
        if (hardwareId == null || hardwareId.isBlank()) {
            return Optional.empty();
        }

        DeviceMetadata cached = cache.getIfPresent(hardwareId);
        if (cached != null) {
            log.trace("DeviceMetadata cache hit: hardwareId={}", hardwareId);
            return Optional.of(cached);
        }

        log.debug("DeviceMetadata cache miss: hardwareId={}, loading from database", hardwareId);
        return deviceRepository.findByHardwareId(hardwareId)
                .map(this::mapAndCache);
    }

    @Override
    public void put(String hardwareId, DeviceMetadata metadata) {
        if (hardwareId != null && metadata != null) {
            cache.put(hardwareId, metadata);
            log.debug("DeviceMetadata explicitly cached: hardwareId={}", hardwareId);
        }
    }

    @Override
    public void invalidate(String hardwareId) {
        if (hardwareId != null) {
            cache.invalidate(hardwareId);
            log.debug("DeviceMetadata cache invalidated: hardwareId={}", hardwareId);
        }
    }

    private DeviceMetadata mapAndCache(Device device) {
        DeviceMetadata metadata = DeviceMetadata.builder()
                .id(device.getId())
                .hardwareId(device.getHardwareId())
                .roomId(device.getRoomId())
                .zoneId(device.getZoneId())
                .deviceType(device.getDeviceType())
                .isActive(device.isActive())
                .build();
        cache.put(device.getHardwareId(), metadata);
        return metadata;
    }
}
