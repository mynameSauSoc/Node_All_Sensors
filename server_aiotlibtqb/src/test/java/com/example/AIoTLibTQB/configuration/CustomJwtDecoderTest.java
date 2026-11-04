package com.example.AIoTLibTQB.configuration;

import com.example.AIoTLibTQB.repository.InvalidatedTokenRepository;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomJwtDecoderTest {

    private static final String SECRET_KEY =
            "Nfs1Gek09tLDLYg2bvUp7xgze89R1HILTVfe6beqFvEkSk9C68mtqE0xkFxrPrCi";

    @Mock
    InvalidatedTokenRepository invalidatedTokenRepository;

    CustomJwtDecoder customJwtDecoder;

    @BeforeEach
    void setUp() {
        customJwtDecoder = new CustomJwtDecoder(SECRET_KEY, invalidatedTokenRepository);
    }

    private String buildToken(Date exp, String jti, String secret) throws Exception {
        if (jti == null) jti = UUID.randomUUID().toString();
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("alice")
                .issueTime(new Date())
                .expirationTime(exp)
                .jwtID(jti)
                .claim("userId", "user-123")
                .build();
        SignedJWT jwt = new SignedJWT(header, claims);
        jwt.sign(new MACSigner(secret.getBytes()));
        return jwt.serialize();
    }

    @Test
    @DisplayName("Token hợp lệ và không nằm trong blacklist → decode thành công")
    void decode_validToken_success() throws Exception {
        Date exp = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String jti = UUID.randomUUID().toString();
        String token = buildToken(exp, jti, SECRET_KEY);

        when(invalidatedTokenRepository.existsById(jti)).thenReturn(false);

        Jwt jwt = customJwtDecoder.decode(token);

        assertThat(jwt).isNotNull();
        assertThat(jwt.getSubject()).isEqualTo("alice");
        assertThat(jwt.getId()).isEqualTo(jti);
        assertThat(jwt.getClaimAsString("userId")).isEqualTo("user-123");
    }

    @Test
    @DisplayName("Token nằm trong blacklist → ném JwtException")
    void decode_blacklistedToken_throwsJwtException() throws Exception {
        Date exp = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String jti = UUID.randomUUID().toString();
        String token = buildToken(exp, jti, SECRET_KEY);

        when(invalidatedTokenRepository.existsById(jti)).thenReturn(true);

        assertThatThrownBy(() -> customJwtDecoder.decode(token))
                .isInstanceOf(JwtException.class)
                .hasMessageContaining("Token has been invalidated");
    }

    @Test
    @DisplayName("Token sai chữ ký → ném JwtException")
    void decode_invalidSignature_throwsJwtException() throws Exception {
        Date exp = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String jti = UUID.randomUUID().toString();
        String wrongSecret = "WrongSecretKey1111111111111111111111111111111111111111111111111111111";
        String token = buildToken(exp, jti, wrongSecret);

        assertThatThrownBy(() -> customJwtDecoder.decode(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("Token đã hết hạn → ném JwtException")
    void decode_expiredToken_throwsJwtException() throws Exception {
        Date exp = Date.from(Instant.now().minus(1, ChronoUnit.HOURS));
        String jti = UUID.randomUUID().toString();
        String token = buildToken(exp, jti, SECRET_KEY);

        assertThatThrownBy(() -> customJwtDecoder.decode(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("AUTH-01: Token có tokenType=REFRESH khi gọi API tài nguyên → ném JwtException")
    void decode_refreshTokenUsedAsAccessToken_throwsJwtException() throws Exception {
        Date exp = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String jti = UUID.randomUUID().toString();

        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("alice")
                .issueTime(new Date())
                .expirationTime(exp)
                .jwtID(jti)
                .claim("userId", "user-123")
                .claim("tokenType", "REFRESH")
                .build();
        SignedJWT jwt = new SignedJWT(header, claims);
        jwt.sign(new MACSigner(SECRET_KEY.getBytes()));
        String refreshToken = jwt.serialize();

        when(invalidatedTokenRepository.existsById(jti)).thenReturn(false);

        assertThatThrownBy(() -> customJwtDecoder.decode(refreshToken))
                .isInstanceOf(JwtException.class)
                .hasMessageContaining("Refresh token cannot be used as an access token");
    }
}
