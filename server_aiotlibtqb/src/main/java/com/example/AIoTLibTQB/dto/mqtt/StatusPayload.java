package com.example.AIoTLibTQB.dto.mqtt;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StatusPayload {

    @JsonProperty("hardware_id")
    @JsonAlias({"hardwareId", "device_id", "deviceId"})
    String hardwareId;

    String status;

    String reason;

    @JsonProperty("firmware_version")
    @JsonAlias("firmwareVersion")
    String firmwareVersion;

    @JsonProperty("uptime_seconds")
    @JsonAlias("uptimeSeconds")
    Long uptimeSeconds;

    Long timestamp;
}
