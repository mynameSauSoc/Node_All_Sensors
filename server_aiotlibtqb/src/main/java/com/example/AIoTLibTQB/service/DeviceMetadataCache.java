package com.example.AIoTLibTQB.service;

import java.util.Optional;

public interface DeviceMetadataCache {
    Optional<DeviceMetadata> get(String hardwareId);
    void put(String hardwareId, DeviceMetadata metadata);
    void invalidate(String hardwareId);
}
