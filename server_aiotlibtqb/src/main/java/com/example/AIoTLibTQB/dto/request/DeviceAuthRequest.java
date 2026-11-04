package com.example.AIoTLibTQB.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DeviceAuthRequest {

    @NotBlank(message = "HARDWARE_ID_REQUIRED")
    String hardwareId;

    @NotBlank(message = "API_KEY_REQUIRED")
    String apiKey;
}
