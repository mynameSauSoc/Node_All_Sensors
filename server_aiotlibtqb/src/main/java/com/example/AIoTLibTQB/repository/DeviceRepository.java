package com.example.AIoTLibTQB.repository;

import com.example.AIoTLibTQB.document.Device;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface DeviceRepository extends MongoRepository<Device, String> {

    Optional<Device> findByHardwareId(String hardwareId);

    boolean existsByHardwareId(String hardwareId);

    List<Device> findByZoneId(String zoneId);

    List<Device> findByZoneIdAndIsActiveTrue(String zoneId);

    List<Device> findByRoomId(String roomId);

    List<Device> findByIsActiveTrueAndLastSeenAtBefore(Instant threshold);

    List<Device> findByIsActiveTrueAndLastSeenAtIsNull();
}

