package com.example.AIoTLibTQB.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DeviceRegistrationResponse {

    String id;
    String name;
    String hardwareId;
    String zoneId;
    String roomId;
    Double posX;
    Double posY;
    String deviceType;
    String location;
    String firmwareVersion;
    boolean isActive;
    Instant createdAt;

    String rawApiKey;

    boolean alreadyExisted;
}
