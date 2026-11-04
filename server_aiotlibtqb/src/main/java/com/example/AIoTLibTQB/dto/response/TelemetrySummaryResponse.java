package com.example.AIoTLibTQB.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TelemetrySummaryResponse {

    Integer totalRooms;
    Integer optimalRoomsCount;
    Double averageComfortScore;
    String overallGrade;
    RoomSummaryInfo bestRoom;
    RoomSummaryInfo attentionRoom;
    RoomSummaryInfo worstRoom;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class RoomSummaryInfo {
        String roomId;
        String roomName;
        Double comfortScore;
        String grade;
        Double temperature;
        Double humidity;
        Double noiseAvg;
        Double pm25;
        String bottleneckReason;
    }
}
