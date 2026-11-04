package com.example.AIoTLibTQB.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserResponse {
    String id;
    String username;
    String phone;
    String email;
    boolean isActive;
    Instant createdAt;
    Instant updatedAt;
    Set<RoleResponse> roles;
    Set<String> assignedZones;
}
