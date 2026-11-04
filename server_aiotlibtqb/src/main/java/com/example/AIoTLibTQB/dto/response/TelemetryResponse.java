package com.example.AIoTLibTQB.dto.response;

import com.example.AIoTLibTQB.document.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TelemetryResponse {

    String id;
    Instant timestamp;
    TelemetryMetadata metadata;
    AcousticMetrics acoustics;
    AirQualityMetrics airQuality;
    EnvironmentMetrics environment;
    ComfortScoreRecord comfortScore;
    Integer wifiRssi;
}
