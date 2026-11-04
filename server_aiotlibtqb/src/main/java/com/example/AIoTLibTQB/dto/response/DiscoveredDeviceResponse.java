package com.example.AIoTLibTQB.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DiscoveredDeviceResponse {

    String hardwareId;
    Instant firstSeenAt;
    Instant lastSeenAt;
    long messageCount;
    Integer lastWifiRssi;
}
