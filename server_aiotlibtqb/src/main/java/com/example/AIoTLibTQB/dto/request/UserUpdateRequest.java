package com.example.AIoTLibTQB.dto.request;

import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserUpdateRequest {

    @Size(min = 8, max = 72, message = "PASSWORD_INVALID")
    String password;

    String phone;
    String email;

    List<String> roles;
    java.util.Set<String> assignedZones;
}
