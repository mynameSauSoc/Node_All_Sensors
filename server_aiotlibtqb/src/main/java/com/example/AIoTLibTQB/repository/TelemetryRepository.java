package com.example.AIoTLibTQB.repository;

import com.example.AIoTLibTQB.document.TelemetryRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface TelemetryRepository extends MongoRepository<TelemetryRecord, String> {

    List<TelemetryRecord> findByMetadataDeviceIdAndTimestampBetweenOrderByTimestampDesc(
            String deviceId, Instant start, Instant end);

    List<TelemetryRecord> findByMetadataRoomIdAndTimestampBetweenOrderByTimestampDesc(
            String roomId, Instant start, Instant end);

    Optional<TelemetryRecord> findTopByMetadataDeviceIdOrderByTimestampDesc(String deviceId);

    Optional<TelemetryRecord> findTopByMetadataRoomIdOrderByTimestampDesc(String roomId);
}
