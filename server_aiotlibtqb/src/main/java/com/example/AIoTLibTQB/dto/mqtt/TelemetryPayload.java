package com.example.AIoTLibTQB.dto.mqtt;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TelemetryPayload {

    @JsonProperty("hardware_id")
    @JsonAlias({"hardwareId", "device_id", "deviceId"})
    String hardwareId;

    Long timestamp;

    @JsonProperty("is_replay")
    @JsonAlias({"isReplay", "replay"})
    Boolean isReplay;

    @JsonProperty("wifi_rssi")
    @JsonAlias("wifiRssi")
    Integer wifiRssi;

    TelemetryData data;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class TelemetryData {
        AcousticsData acoustics;

        @JsonProperty("air_quality")
        @JsonAlias("airQuality")
        AirQualityData airQuality;

        EnvironmentData environment;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class AcousticsData {
        @JsonProperty("noise_avg")
        @JsonAlias("noiseAvg")
        Double noiseAvg;

        @JsonProperty("noise_peak")
        @JsonAlias("noisePeak")
        Double noisePeak;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class AirQualityData {
        @JsonProperty("pm1_0")
        @JsonAlias({"pm1_0", "pm1"})
        Double pm1_0;

        @JsonProperty("pm2_5")
        @JsonAlias({"pm2_5", "pm25"})
        Double pm2_5;

        @JsonProperty("pm4_0")
        @JsonAlias({"pm4_0", "pm4"})
        Double pm4_0;

        Double pm10;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class EnvironmentData {
        Double temperature;
        Double humidity;
        Double lux;
        Double co2;
    }
}
