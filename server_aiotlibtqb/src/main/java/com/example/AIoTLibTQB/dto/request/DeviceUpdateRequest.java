package com.example.AIoTLibTQB.dto.request;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DeviceUpdateRequest {

    String name;

    String zoneId;

    String roomId;

    Double posX;

    Double posY;

    String deviceType;

    String location;

    String firmwareVersion;
}
