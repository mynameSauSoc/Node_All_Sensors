package com.example.AIoTLibTQB.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DeviceRegistrationRequest {

    @NotBlank(message = "DEVICE_NAME_REQUIRED")
    String name;

    @NotBlank(message = "HARDWARE_ID_REQUIRED")
    String hardwareId;

    @NotBlank(message = "ZONE_ID_REQUIRED")
    String zoneId;

    String roomId;

    Double posX;

    Double posY;

    @NotBlank(message = "DEVICE_TYPE_REQUIRED")
    String deviceType;

    String location;

    String firmwareVersion;
}
