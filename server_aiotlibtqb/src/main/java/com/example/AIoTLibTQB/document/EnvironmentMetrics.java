package com.example.AIoTLibTQB.document;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EnvironmentMetrics {
    Double temperature;
    Double humidity;
    Double lux;
    Double co2;
}
