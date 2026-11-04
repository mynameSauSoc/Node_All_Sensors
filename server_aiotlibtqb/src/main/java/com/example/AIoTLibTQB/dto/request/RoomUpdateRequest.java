package com.example.AIoTLibTQB.dto.request;

import com.example.AIoTLibTQB.document.Point2D;
import com.example.AIoTLibTQB.enums.RoomType;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomUpdateRequest {

    String name;

    Integer floor;

    Integer capacity;

    String description;

    Double targetComfortScore;

    List<Point2D> boundaryPolygon;

    RoomType type;
}
