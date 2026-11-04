package com.example.AIoTLibTQB.document;

import com.example.AIoTLibTQB.enums.RoomType;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "rooms")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Room {

    @Id
    String id;

    @Indexed(unique = true)
    String code;

    String name;

    Integer floor;

    Integer capacity;

    String description;

    Double targetComfortScore;

    List<Point2D> boundaryPolygon;

    @Builder.Default
    RoomType type = RoomType.STUDY_ROOM;

    @CreatedDate
    Instant createdAt;

    @LastModifiedDate
    Instant updatedAt;
}
