package com.example.AIoTLibTQB.configuration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;

import java.security.Principal;
import java.time.Instant;
import java.util.Collections;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StompChannelInterceptorTest {

    @Mock
    CustomJwtDecoder customJwtDecoder;

    @Mock
    JwtAuthenticationConverter jwtAuthenticationConverter;

    @Mock
    MessageChannel messageChannel;

    @InjectMocks
    StompChannelInterceptor interceptor;

    Jwt mockJwt;
    AbstractAuthenticationToken mockAuth;

    @BeforeEach
    void setUp() {
        mockJwt = new Jwt(
                "mock.token.value",
                Instant.now(),
                Instant.now().plusSeconds(3600),
                Map.of("alg", "HS512"),
                Map.of("sub", "john_doe", "roles", Collections.singletonList("USER"))
        );
        mockAuth = new TestingAuthenticationToken("john_doe", "credentials", "ROLE_USER");
    }

    @Test
    @DisplayName("CONNECT with valid Bearer token sets authenticated Principal in simpUser")
    void connect_validBearerToken_authenticatesUser() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        accessor.setNativeHeader("Authorization", "Bearer valid.jwt.token");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        when(customJwtDecoder.decode("valid.jwt.token")).thenReturn(mockJwt);
        when(jwtAuthenticationConverter.convert(mockJwt)).thenReturn(mockAuth);

        Message<?> result = interceptor.preSend(message, messageChannel);

        assertThat(result).isNotNull();
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        Principal simpUser = resultAccessor.getUser();
        assertThat(simpUser).isNotNull();
        assertThat(simpUser.getName()).isEqualTo("john_doe");
        verify(customJwtDecoder, times(1)).decode("valid.jwt.token");
        verify(jwtAuthenticationConverter, times(1)).convert(mockJwt);
    }

    @Test
    @DisplayName("CONNECT with raw token without Bearer prefix still extracts and validates token")
    void connect_validRawToken_authenticatesUser() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        accessor.setNativeHeader("Authorization", "valid.raw.token");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        when(customJwtDecoder.decode("valid.raw.token")).thenReturn(mockJwt);
        when(jwtAuthenticationConverter.convert(mockJwt)).thenReturn(mockAuth);

        Message<?> result = interceptor.preSend(message, messageChannel);

        assertThat(result).isNotNull();
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        assertThat(resultAccessor.getUser()).isNotNull();
        assertThat(resultAccessor.getUser().getName()).isEqualTo("john_doe");
    }

    @Test
    @DisplayName("CONNECT with token in 'token' header extracts and authenticates")
    void connect_tokenInTokenHeader_authenticatesUser() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        accessor.setNativeHeader("token", "header.token.value");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        when(customJwtDecoder.decode("header.token.value")).thenReturn(mockJwt);
        when(jwtAuthenticationConverter.convert(mockJwt)).thenReturn(mockAuth);

        Message<?> result = interceptor.preSend(message, messageChannel);

        assertThat(result).isNotNull();
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        assertThat(resultAccessor.getUser()).isNotNull();
    }

    @Test
    @DisplayName("CONNECT with missing Authorization header throws MessageDeliveryException")
    void connect_missingToken_throwsException() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatThrownBy(() -> interceptor.preSend(message, messageChannel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Missing or empty Authorization token");

        verify(customJwtDecoder, never()).decode(anyString());
    }

    @Test
    @DisplayName("CONNECT with invalid JWT throws MessageDeliveryException")
    void connect_invalidToken_throwsException() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        accessor.setNativeHeader("Authorization", "Bearer invalid.token");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        when(customJwtDecoder.decode("invalid.token")).thenThrow(new BadJwtException("Invalid signature"));

        assertThatThrownBy(() -> interceptor.preSend(message, messageChannel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Invalid JWT token");
    }

    @Test
    @DisplayName("SUBSCRIBE with authenticated user passes through successfully")
    void subscribe_authenticatedUser_success() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setLeaveMutable(true);
        accessor.setDestination("/topic/rooms/room-101/telemetry");
        accessor.setUser(new TestingAuthenticationToken("alice", "pass"));
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, messageChannel);

        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("SUBSCRIBE with unauthenticated user (null Principal) throws MessageDeliveryException")
    void subscribe_unauthenticatedUser_throwsException() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setLeaveMutable(true);
        accessor.setDestination("/topic/rooms/room-101/telemetry");
        accessor.setUser(null);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatThrownBy(() -> interceptor.preSend(message, messageChannel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Access denied: user must be authenticated to subscribe");
    }

    @Test
    @DisplayName("SEND frame to /topic destination throws MessageDeliveryException")
    void send_toTopicDestination_throwsMessageDeliveryException() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setLeaveMutable(true);
        accessor.setDestination("/topic/rooms/room-101/telemetry");
        accessor.setUser(new TestingAuthenticationToken("attacker", "pass"));
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatThrownBy(() -> interceptor.preSend(message, messageChannel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Client SEND to broker topics is forbidden");
    }

    @Test
    @DisplayName("SUBSCRIBE to /topic/alerts by user without alert permissions throws MessageDeliveryException")
    void subscribe_alerts_unauthorizedUser_throwsMessageDeliveryException() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setLeaveMutable(true);
        accessor.setDestination("/topic/alerts");
        // User with only VIEW_DEVICE_STATUS, without VIEW_ALERTS or admin roles
        accessor.setUser(new TestingAuthenticationToken("alice", "pass", "VIEW_DEVICE_STATUS"));
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatThrownBy(() -> interceptor.preSend(message, messageChannel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Access denied: VIEW_ALERTS permission required for /topic/alerts");
    }

    @Test
    @DisplayName("SUBSCRIBE to /topic/rooms by DEVICE role throws MessageDeliveryException")
    void subscribe_rooms_deviceRole_throwsMessageDeliveryException() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setLeaveMutable(true);
        accessor.setDestination("/topic/rooms/room-101/telemetry");
        accessor.setUser(new TestingAuthenticationToken("esp32", "pass", "ROLE_DEVICE"));
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatThrownBy(() -> interceptor.preSend(message, messageChannel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Access denied: DEVICE role cannot subscribe to room telemetry");
    }

    @Test
    @DisplayName("SEND frame passes through unchanged without blocking")
    void send_command_passesThrough() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setLeaveMutable(true);
        accessor.setDestination("/app/chat");
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, messageChannel);

        assertThat(result).isNotNull();
    }
}
