package com.example.AIoTLibTQB.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LogoutRequest {
    @NotBlank(message = "TOKEN_REQUIRED")
    String token;
    String refreshToken;

    public LogoutRequest(String token) {
        this.token = token;
    }
}
