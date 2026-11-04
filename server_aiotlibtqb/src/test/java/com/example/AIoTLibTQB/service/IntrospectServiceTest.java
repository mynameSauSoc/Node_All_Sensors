package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.request.IntrospectRequest;
import com.example.AIoTLibTQB.dto.response.IntrospectResponse;
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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntrospectServiceTest {

    private static final String SECRET_KEY =
            "Nfs1Gek09tLDLYg2bvUp7xgze89R1HILTVfe6beqFvEkSk9C68mtqE0xkFxrPrCi";

    @Mock InvalidatedTokenRepository invalidatedTokenRepository;

    @InjectMocks IntrospectService introspectService;

    @BeforeEach
    void injectSecretKey() {
        ReflectionTestUtils.setField(introspectService, "secretKey", SECRET_KEY);
    }

    private String buildToken(Date exp, String jti) throws Exception {
        if (jti == null) jti = UUID.randomUUID().toString();
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("alice")
                .issueTime(new Date())
                .expirationTime(exp)
                .jwtID(jti)
                .build();
        SignedJWT jwt = new SignedJWT(header, claims);
        jwt.sign(new MACSigner(SECRET_KEY.getBytes()));
        return jwt.serialize();
    }

    @Test
    @DisplayName("Token hợp lệ → valid = true")
    void introspect_validToken_returnsTrue() throws Exception {
        Date exp   = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String jti = UUID.randomUUID().toString();
        String token = buildToken(exp, jti);

        when(invalidatedTokenRepository.existsById(jti)).thenReturn(false);

        IntrospectResponse response = introspectService.introspect(
                new IntrospectRequest(token));

        assertThat(response.isValid()).isTrue();
    }

    @Test
    @DisplayName("Token hết hạn → valid = false")
    void introspect_expiredToken_returnsFalse() throws Exception {
        Date exp = Date.from(Instant.now().minus(1, ChronoUnit.HOURS));
        String token = buildToken(exp, null);

        IntrospectResponse response = introspectService.introspect(
                new IntrospectRequest(token));

        assertThat(response.isValid()).isFalse();
    }

    @Test
    @DisplayName("Token bị blacklist → valid = false")
    void introspect_blacklistedToken_returnsFalse() throws Exception {
        Date exp   = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String jti = UUID.randomUUID().toString();
        String token = buildToken(exp, jti);

        when(invalidatedTokenRepository.existsById(jti)).thenReturn(true);

        IntrospectResponse response = introspectService.introspect(
                new IntrospectRequest(token));

        assertThat(response.isValid()).isFalse();
    }

    @Test
    @DisplayName("Token bị giả mạo (sai signature) → valid = false")
    void introspect_tamperedToken_returnsFalse() throws Exception {
        Date exp   = Date.from(Instant.now().plus(1, ChronoUnit.HOURS));
        String jti = UUID.randomUUID().toString();

        String wrongKey = "WrongKey111111111111111111111111111111111111111111111111111111111111";
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("alice")
                .issueTime(new Date())
                .expirationTime(exp)
                .jwtID(jti)
                .build();
        SignedJWT jwt = new SignedJWT(header, claims);
        jwt.sign(new MACSigner(wrongKey.getBytes()));
        String tamperedToken = jwt.serialize();

        IntrospectResponse response = introspectService.introspect(
                new IntrospectRequest(tamperedToken));

        assertThat(response.isValid()).isFalse();
    }
}
