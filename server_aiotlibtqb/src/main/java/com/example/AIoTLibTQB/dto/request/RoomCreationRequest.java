package com.example.AIoTLibTQB.dto.request;

import com.example.AIoTLibTQB.document.Point2D;
import com.example.AIoTLibTQB.enums.RoomType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomCreationRequest {

    @NotBlank(message = "ROOM_CODE_REQUIRED")
    String code;

    @NotBlank(message = "ROOM_NAME_REQUIRED")
    String name;

    @NotNull(message = "FLOOR_REQUIRED")
    Integer floor;

    Integer capacity;

    String description;

    Double targetComfortScore;

    List<Point2D> boundaryPolygon;

    RoomType type;
}
