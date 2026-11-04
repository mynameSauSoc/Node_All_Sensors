package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.request.AuthenticationRequest;
import com.example.AIoTLibTQB.dto.request.LogoutRequest;
import com.example.AIoTLibTQB.dto.request.RefreshRequest;
import com.example.AIoTLibTQB.dto.response.AuthenticationResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.InvalidatedTokenRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.text.ParseException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashSet;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {

    private static final String SECRET_KEY =
            "Nfs1Gek09tLDLYg2bvUp7xgze89R1HILTVfe6beqFvEkSk9C68mtqE0xkFxrPrCi";
    private static final String ISSUER   = "AIoTLibTQB.com";
    private static final long   EXP_HRS  = 1L;
    private static final long   REFRESH_HRS = 24L;

    @Mock UserRepository            userRepository;
    @Mock PasswordEncoder           passwordEncoder;
    @Mock InvalidatedTokenRepository invalidatedTokenRepository;
    @Mock IntrospectService         introspectService;

    @InjectMocks AuthenticationService authenticationService;

    private User buildUser(String username, boolean isActive) {
        return User.builder()
                .id("user-id-001")
                .username(username)
                .password("encoded-password")
                .isActive(isActive)
                .roles(new HashSet<>())
                .build();
    }

    private String buildSignedToken(Date exp, Date iat, String jti) throws JOSEException {
        return buildSignedToken(exp, iat, jti, "REFRESH");
    }

    private String buildSignedToken(Date exp, Date iat, String jti, String tokenType) throws JOSEException {
        if (exp == null) exp = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        if (iat == null) iat = new Date();
        if (jti == null) jti = UUID.randomUUID().toString();

        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .subject("testuser")
                .issuer(ISSUER)
                .issueTime(iat)
                .expirationTime(exp)
                .jwtID(jti)
                .claim("scope", "USER")
                .claim("userId", "user-id-001");
        if (tokenType != null) {
            builder.claim("tokenType", tokenType);
        }
        SignedJWT jwt = new SignedJWT(header, builder.build());
        jwt.sign(new MACSigner(SECRET_KEY.getBytes()));
        return jwt.serialize();
    }

    @BeforeEach
    void injectConfigValues() {

        ReflectionTestUtils.setField(authenticationService, "secretKey", SECRET_KEY);
        ReflectionTestUtils.setField(authenticationService, "expirationHours", EXP_HRS);
        ReflectionTestUtils.setField(authenticationService, "refreshableHours", REFRESH_HRS);
        ReflectionTestUtils.setField(authenticationService, "issuer", ISSUER);
    }

    @Nested
    @DisplayName("authenticate()")
    class AuthenticateTests {

        @Test
        @DisplayName("Đăng nhập thành công → trả về cả access token và refresh token")
        void login_success_returnsToken() {

            User user = buildUser("alice", true);
            when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("rawpass", user.getPassword())).thenReturn(true);

            AuthenticationRequest request = new AuthenticationRequest("alice", "rawpass");

            AuthenticationResponse response = authenticationService.authenticate(request);

            assertThat(response.getToken()).isNotBlank();
            assertThat(response.getRefreshToken()).isNotBlank();
        }

        @Test
        @DisplayName("User không tồn tại → USER_DID_NOT_EXIST")
        void login_userNotFound_throwsException() {
            when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());
            AuthenticationRequest request = new AuthenticationRequest("ghost", "pass");

            assertThatThrownBy(() -> authenticationService.authenticate(request))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.USER_DID_NOT_EXIST);
        }

        @Test
        @DisplayName("Sai password → UNAUTHENTICATED")
        void login_wrongPassword_throwsUnauthenticated() {
            User user = buildUser("alice", true);
            when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("wrong", user.getPassword())).thenReturn(false);

            assertThatThrownBy(() -> authenticationService.authenticate(
                    new AuthenticationRequest("alice", "wrong")))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.UNAUTHENTICATED);
        }

        @Test
        @DisplayName("Tài khoản bị vô hiệu hóa → USER_INACTIVE")
        void login_inactiveAccount_throwsUserInactive() {
            User user = buildUser("alice", false);
            when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("rawpass", user.getPassword())).thenReturn(true);

            assertThatThrownBy(() -> authenticationService.authenticate(
                    new AuthenticationRequest("alice", "rawpass")))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.USER_INACTIVE);
        }
    }

    @Nested
    @DisplayName("logout()")
    class LogoutTests {

        @Test
        @DisplayName("Token hợp lệ → lưu vào blacklist")
        void logout_validToken_blacklisted() throws Exception {
            String token = buildSignedToken(null, null, null);
            when(invalidatedTokenRepository.existsById(anyString())).thenReturn(false);

            authenticationService.logout(new LogoutRequest(token));

            verify(invalidatedTokenRepository).save(any());
        }

        @Test
        @DisplayName("Token đã hết hạn và qua refresh window → không ném exception, bỏ qua silently")
        void logout_expiredAndOutsideRefreshWindow_silent() throws Exception {

            Date iat = Date.from(Instant.now().minus(25, ChronoUnit.HOURS));
            Date exp = Date.from(Instant.now().minus(24, ChronoUnit.HOURS));
            String token = buildSignedToken(exp, iat, null);

            authenticationService.logout(new LogoutRequest(token));

            verify(invalidatedTokenRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("refreshToken()")
    class RefreshTokenTests {

        @Test
        @DisplayName("Refresh thành công → trả về token mới, token cũ bị blacklist")
        void refresh_validToken_returnsNewToken() throws Exception {
            String oldJti   = UUID.randomUUID().toString();
            String oldToken = buildSignedToken(null, null, oldJti, "REFRESH");

            User user = buildUser("testuser", true);
            when(invalidatedTokenRepository.existsById(oldJti)).thenReturn(false);
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(user));

            AuthenticationResponse response =
                    authenticationService.refreshToken(new RefreshRequest(oldToken));

            assertThat(response.getToken()).isNotBlank();
            assertThat(response.getRefreshToken()).isNotBlank();
            assertThat(response.getToken()).isNotEqualTo(oldToken);
            assertThat(response.getRefreshToken()).isNotEqualTo(oldToken);

            verify(invalidatedTokenRepository).save(any());
        }

        @Test
        @DisplayName("AUTH-01: Gửi nhầm Access Token vào endpoint refresh → bị từ chối UNAUTHENTICATED")
        void refresh_withAccessToken_throwsUnauthenticated() throws Exception {
            String jti = UUID.randomUUID().toString();
            String accessToken = buildSignedToken(null, null, jti, "ACCESS");

            when(invalidatedTokenRepository.existsById(jti)).thenReturn(false);

            assertThatThrownBy(() -> authenticationService.refreshToken(new RefreshRequest(accessToken)))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.UNAUTHENTICATED);

            verify(invalidatedTokenRepository, never()).save(any());
        }

        @Test
        @DisplayName("Token đã bị blacklist → UNAUTHENTICATED")
        void refresh_blacklistedToken_throwsException() throws Exception {
            String jti   = UUID.randomUUID().toString();
            String token = buildSignedToken(null, null, jti);

            when(invalidatedTokenRepository.existsById(jti)).thenReturn(true);

            assertThatThrownBy(() -> authenticationService.refreshToken(new RefreshRequest(token)))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.UNAUTHENTICATED);
        }

        @Test
        @DisplayName("Token qua cửa sổ refresh 24h → UNAUTHENTICATED")
        void refresh_outsideRefreshWindow_throwsException() throws Exception {
            Date iat   = Date.from(Instant.now().minus(25, ChronoUnit.HOURS));
            Date exp   = Date.from(Instant.now().minus(24, ChronoUnit.HOURS));
            String token = buildSignedToken(exp, iat, null);

            assertThatThrownBy(() -> authenticationService.refreshToken(new RefreshRequest(token)))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.UNAUTHENTICATED);
        }
    }
}
