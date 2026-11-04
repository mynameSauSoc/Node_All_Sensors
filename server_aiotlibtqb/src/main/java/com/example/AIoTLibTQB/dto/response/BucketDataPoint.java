package com.example.AIoTLibTQB.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BucketDataPoint {

    Instant bucketTime;
    Long sampleCount;

    Double comfortScoreAvg;
    Double comfortScoreMin;
    Double comfortScoreMax;

    Double tempAvg;
    Double tempMin;
    Double tempMax;

    Double humidityAvg;
    Double humidityMin;
    Double humidityMax;

    Double noiseAvg;
    Double noiseMin;
    Double noiseMax;

    Double pm25Avg;
    Double pm25Min;
    Double pm25Max;

    Double luxAvg;
    Double luxMin;
    Double luxMax;

    @JsonIgnore
    public Instant getTimestamp() {
        return bucketTime;
    }

    @JsonIgnore
    public Double getTemperatureAvg() {
        return tempAvg;
    }

    @JsonIgnore
    public Double getTemperatureMin() {
        return tempMin;
    }

    @JsonIgnore
    public Double getTemperatureMax() {
        return tempMax;
    }

    @JsonIgnore
    public Double getPm2_5Avg() {
        return pm25Avg;
    }

    @JsonIgnore
    public Double getPm2_5Min() {
        return pm25Min;
    }

    @JsonIgnore
    public Double getPm2_5Max() {
        return pm25Max;
    }
}
