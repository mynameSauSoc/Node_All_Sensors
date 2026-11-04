package com.example.AIoTLibTQB.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TelemetryBucketResponse {

    String roomId;
    String interval;
    List<BucketDataPoint> dataPoints;

    @JsonIgnore
    public List<BucketDataPoint> getBuckets() {
        return dataPoints;
    }
}
