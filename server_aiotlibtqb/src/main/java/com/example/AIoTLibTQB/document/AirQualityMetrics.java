package com.example.AIoTLibTQB.document;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AirQualityMetrics {
    Double pm1_0;
    Double pm2_5;
    Double pm4_0;
    Double pm10;
}
