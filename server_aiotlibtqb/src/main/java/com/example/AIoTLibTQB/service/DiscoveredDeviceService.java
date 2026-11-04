package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.response.DiscoveredDeviceResponse;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DiscoveredDeviceService {

    Cache<String, DiscoveredEntry> cache = Caffeine.newBuilder()
            .maximumSize(1_000)
            .expireAfterWrite(Duration.ofMinutes(10))
            .build();

    public void recordDiscovered(String hardwareId, Integer wifiRssi) {
        if (hardwareId == null || hardwareId.isBlank()) {
            return;
        }

        Instant now = Instant.now();
        cache.asMap().compute(hardwareId, (key, existing) -> {
            if (existing == null) {
                log.info("Discovered new unregistered IoT device broadcasting: hardwareId={}, rssi={}",
                        hardwareId, wifiRssi);
                return new DiscoveredEntry(hardwareId, now, now, 1L, wifiRssi);
            } else {
                existing.setLastSeenAt(now);
                existing.setMessageCount(existing.getMessageCount() + 1);
                if (wifiRssi != null) {
                    existing.setLastWifiRssi(wifiRssi);
                }
                return existing;
            }
        });
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    public List<DiscoveredDeviceResponse> getDiscoveredDevices() {
        cleanExpired();
        return cache.asMap().values().stream()
                .sorted(Comparator.comparing(DiscoveredEntry::getLastSeenAt).reversed())
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public void removeDiscovered(String hardwareId) {
        if (hardwareId != null) {
            cache.invalidate(hardwareId);
        }
    }

    private void cleanExpired() {
        cache.cleanUp();
    }

    private DiscoveredDeviceResponse toResponse(DiscoveredEntry entry) {
        return DiscoveredDeviceResponse.builder()
                .hardwareId(entry.getHardwareId())
                .firstSeenAt(entry.getFirstSeenAt())
                .lastSeenAt(entry.getLastSeenAt())
                .messageCount(entry.getMessageCount())
                .lastWifiRssi(entry.getLastWifiRssi())
                .build();
    }

    @Data
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    private static class DiscoveredEntry {
        String hardwareId;
        Instant firstSeenAt;
        Instant lastSeenAt;
        long messageCount;
        Integer lastWifiRssi;
    }
}
