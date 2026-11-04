package com.example.AIoTLibTQB.document;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "devices")
@CompoundIndexes({
        @CompoundIndex(name = "idx_active_lastseen", def = "{'isActive': 1, 'lastSeenAt': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Device {

    @Id
    String id;

    String name;

    @Indexed(unique = true)
    String hardwareId;

    String apiKeyHash;

    @Indexed
    String zoneId;

    @Indexed
    String roomId;

    Double posX;

    Double posY;

    String deviceType;

    String location;

    String firmwareVersion;

    @Builder.Default
    boolean isActive = true;

    Instant lastSeenAt;

    String connectionState;

    Instant lastOfflineAt;

    @CreatedDate
    Instant createdAt;

    @LastModifiedDate
    Instant updatedAt;
}
