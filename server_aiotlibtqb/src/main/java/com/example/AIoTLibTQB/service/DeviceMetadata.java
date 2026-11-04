package com.example.AIoTLibTQB.service;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DeviceMetadata {
    String id;
    String hardwareId;
    String roomId;
    String zoneId;
    String deviceType;
    boolean isActive;
}
