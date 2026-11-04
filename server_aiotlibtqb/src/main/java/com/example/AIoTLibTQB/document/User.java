package com.example.AIoTLibTQB.document;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Document(collection = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class User {

    @Id
    String id;

    @Indexed(unique = true)
    String username;

    String password;
    String phone;
    String email;

    @Builder.Default
    boolean isActive = true;

    @CreatedDate
    Instant createdAt;

    @LastModifiedDate
    Instant updatedAt;

    Instant credentialsUpdatedAt;

    @Builder.Default
    Set<Role> roles = new HashSet<>();

    @Builder.Default
    Set<String> assignedZones = new HashSet<>();
}
