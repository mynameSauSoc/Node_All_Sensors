package com.example.AIoTLibTQB.dto.response;

import com.example.AIoTLibTQB.document.Point2D;
import com.example.AIoTLibTQB.enums.RoomType;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomResponse {

    String id;

    String code;

    String name;

    Integer floor;

    Integer capacity;

    String description;

    Double targetComfortScore;

    List<Point2D> boundaryPolygon;

    RoomType type;

    Instant createdAt;

    Instant updatedAt;
}
