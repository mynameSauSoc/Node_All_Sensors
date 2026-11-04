package com.example.AIoTLibTQB.document;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.TimeSeries;
import org.springframework.data.mongodb.core.timeseries.Granularity;

import java.time.Instant;

@Document(collection = "telemetry_records")
@TimeSeries(
        collection = "telemetry_records",
        timeField = "timestamp",
        metaField = "metadata",
        granularity = Granularity.SECONDS,
        expireAfter = "7776000s"
)
@CompoundIndexes({
        @CompoundIndex(name = "telemetry_device_time_idx", def = "{'metadata.deviceId': 1, 'timestamp': -1}"),
        @CompoundIndex(name = "telemetry_room_time_idx", def = "{'metadata.roomId': 1, 'timestamp': -1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TelemetryRecord {

    public static final long RETENTION_SECONDS = 7_776_000L; // 90 days (90 * 24 * 3600)

    @Id
    String id;

    Instant timestamp;

    TelemetryMetadata metadata;

    AcousticMetrics acoustics;

    AirQualityMetrics airQuality;

    EnvironmentMetrics environment;

    ComfortScoreRecord comfortScore;

    Integer wifiRssi;
}
