package com.example.AIoTLibTQB.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAuthenticationEntryPointTest {

    private JwtAuthenticationEntryPoint entryPoint;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        entryPoint = new JwtAuthenticationEntryPoint(objectMapper);
    }

    @Test
    @DisplayName("Commence trả về HTTP 401, JSON UTF-8 và WWW-Authenticate header")
    void commence_genericAuthException_returns401Json() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/devices");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticationException authException = new BadCredentialsException("Bad credentials");

        entryPoint.commence(request, response, authException);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getCharacterEncoding()).isEqualTo("UTF-8");
        assertThat(response.getHeader("WWW-Authenticate")).isEqualTo("Bearer error=\"invalid_token\"");

        String json = response.getContentAsString();
        assertThat(json).contains("\"code\":1006");
        assertThat(json).contains("\"message\":\"Unauthenticated\"");
    }

    @Test
    @DisplayName("Commence khi token hết hạn → trả về message hướng dẫn refresh")
    void commence_expiredTokenException_returnsExpiredMessage() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/users/myInfo");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AuthenticationException authException = new BadCredentialsException("Jwt expired at 2026-10-09T00:00:00Z");

        entryPoint.commence(request, response, authException);

        assertThat(response.getStatus()).isEqualTo(401);
        String json = response.getContentAsString();
        assertThat(json).contains("\"code\":1006");
        assertThat(json).contains("Token expired. Please refresh your session.");
    }
}
