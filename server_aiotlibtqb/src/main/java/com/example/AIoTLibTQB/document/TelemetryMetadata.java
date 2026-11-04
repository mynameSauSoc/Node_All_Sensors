package com.example.AIoTLibTQB.document;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TelemetryMetadata {
    String deviceId;
    String hardwareId;
    String roomId;
}
