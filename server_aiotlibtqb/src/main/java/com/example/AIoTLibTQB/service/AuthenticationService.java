package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.document.InvalidatedToken;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.request.AuthenticationRequest;
import com.example.AIoTLibTQB.dto.request.LogoutRequest;
import com.example.AIoTLibTQB.dto.request.RefreshRequest;
import com.example.AIoTLibTQB.dto.response.AuthenticationResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.InvalidatedTokenRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.text.ParseException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.StringJoiner;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuthenticationService {

    UserRepository userRepository;
    PasswordEncoder passwordEncoder;
    InvalidatedTokenRepository invalidatedTokenRepository;
    IntrospectService introspectService;

    @NonFinal
    @Value("${jwt.secret-key}")
    String secretKey;

    @NonFinal
    @Value("${jwt.expiration-hours}")
    long expirationHours;

    @NonFinal
    @Value("${jwt.refreshable-hours:24}")
    long refreshableHours;

    @NonFinal
    @Value("${jwt.issuer}")
    String issuer;

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.USER_DID_NOT_EXIST));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        if (!user.isActive()) {
            throw new AppException(ErrorCode.USER_INACTIVE);
        }

        return AuthenticationResponse.builder()
                .token(generateAccessToken(user))
                .refreshToken(generateRefreshToken(user))
                .build();
    }

    public void logout(LogoutRequest request) throws ParseException, JOSEException {
        try {
            if (request.getToken() != null && !request.getToken().isBlank()) {
                SignedJWT signedJWT = verifyTokenForRefreshOrLogout(request.getToken());
                blacklistToken(signedJWT);
            }
        } catch (AppException e) {
            log.info("Token already expired or invalid — skip invalidation");
        }
        try {
            if (request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
                SignedJWT signedRefresh = verifyTokenForRefreshOrLogout(request.getRefreshToken());
                blacklistToken(signedRefresh);
            }
        } catch (AppException e) {
            log.info("Refresh token already expired or invalid — skip invalidation");
        }
    }

    public AuthenticationResponse refreshToken(RefreshRequest request) throws ParseException, JOSEException {
        SignedJWT signedJWT = verifyTokenForRefreshOrLogout(request.getToken());

        String tokenType = signedJWT.getJWTClaimsSet().getStringClaim("tokenType");
        if (!"REFRESH".equalsIgnoreCase(tokenType)) {
            log.warn("Rejected refresh request with non-refresh token type: '{}'", tokenType);
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        blacklistToken(signedJWT);

        String username = signedJWT.getJWTClaimsSet().getSubject();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));

        if (!user.isActive()) {
            throw new AppException(ErrorCode.USER_INACTIVE);
        }

        Date issueTime = signedJWT.getJWTClaimsSet().getIssueTime();
        if (issueTime != null && user.getCredentialsUpdatedAt() != null) {
            if (issueTime.toInstant().isBefore(user.getCredentialsUpdatedAt())) {
                log.warn("Refresh token issued before credentials update for user: {}", username);
                throw new AppException(ErrorCode.UNAUTHENTICATED);
            }
        }

        return AuthenticationResponse.builder()
                .token(generateAccessToken(user))
                .refreshToken(generateRefreshToken(user))
                .build();
    }

    private String generateAccessToken(User user) {
        JWSHeader jwsHeader = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(user.getUsername())
                .issuer(issuer)
                .issueTime(new Date())
                .expirationTime(Date.from(Instant.now().plus(expirationHours, ChronoUnit.HOURS)))
                .jwtID(UUID.randomUUID().toString())
                .claim("scope", buildScope(user))
                .claim("userId", user.getId())
                .claim("tokenType", "ACCESS")
                .build();

        JWSObject jwsObject = new JWSObject(jwsHeader, new Payload(claimsSet.toJSONObject()));

        try {
            jwsObject.sign(new MACSigner(secretKey.getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Failed to sign access JWT token", e);
            throw new RuntimeException("Failed to generate access token", e);
        }
    }

    private String generateRefreshToken(User user) {
        JWSHeader jwsHeader = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(user.getUsername())
                .issuer(issuer)
                .issueTime(new Date())
                .expirationTime(Date.from(Instant.now().plus(refreshableHours, ChronoUnit.HOURS)))
                .jwtID(UUID.randomUUID().toString())
                .claim("userId", user.getId())
                .claim("tokenType", "REFRESH")
                .build();

        JWSObject jwsObject = new JWSObject(jwsHeader, new Payload(claimsSet.toJSONObject()));

        try {
            jwsObject.sign(new MACSigner(secretKey.getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Failed to sign refresh JWT token", e);
            throw new RuntimeException("Failed to generate refresh token", e);
        }
    }

    private String generateToken(User user) {
        return generateAccessToken(user);
    }

    public String generateDeviceToken(Device device) {
        JWSHeader jwsHeader = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(device.getHardwareId())
                .issuer(issuer)
                .issueTime(new Date())

                .expirationTime(Date.from(Instant.now().plus(8, ChronoUnit.HOURS)))
                .jwtID(UUID.randomUUID().toString())
                .claim("scope", "DEVICE WRITE_SENSOR_DATA")
                .claim("deviceId",   device.getId())
                .claim("zoneId",     device.getZoneId())
                .claim("deviceType", device.getDeviceType())
                .claim("tokenType",  "DEVICE")
                .build();

        JWSObject jwsObject = new JWSObject(jwsHeader, new Payload(claimsSet.toJSONObject()));

        try {
            jwsObject.sign(new MACSigner(secretKey.getBytes()));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Failed to sign device JWT token for device '{}'", device.getHardwareId(), e);
            throw new RuntimeException("Failed to generate device token", e);
        }
    }

    private String buildScope(User user) {
        StringJoiner joiner = new StringJoiner(" ");
        if (!CollectionUtils.isEmpty(user.getRoles())) {
            user.getRoles().forEach(role -> {
                joiner.add(role.getName());
                if (!CollectionUtils.isEmpty(role.getPermissions())) {
                    role.getPermissions().forEach(p -> joiner.add(p.getName()));
                }
            });
        }
        return joiner.toString();
    }

    private SignedJWT verifyTokenForRefreshOrLogout(String token) throws JOSEException, ParseException {
        SignedJWT signedJWT = SignedJWT.parse(token);

        if (!signedJWT.verify(new com.nimbusds.jose.crypto.MACVerifier(secretKey.getBytes()))) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        String jwtId = signedJWT.getJWTClaimsSet().getJWTID();
        if (jwtId == null || jwtId.isBlank()) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        Date issueTime = signedJWT.getJWTClaimsSet().getIssueTime();
        if (issueTime == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        Date expirationTime = signedJWT.getJWTClaimsSet().getExpirationTime();
        if (expirationTime == null) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        Instant refreshExpiry = Instant.ofEpochMilli(issueTime.getTime())
                .plus(refreshableHours, ChronoUnit.HOURS);
        if (Instant.now().isAfter(refreshExpiry)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        if (invalidatedTokenRepository.existsById(jwtId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }

        return signedJWT;
    }

    private void blacklistToken(SignedJWT signedJWT) throws ParseException {
        InvalidatedToken invalidatedToken = InvalidatedToken.builder()
                .id(signedJWT.getJWTClaimsSet().getJWTID())
                .expiryTime(signedJWT.getJWTClaimsSet().getExpirationTime())
                .build();
        invalidatedTokenRepository.save(invalidatedToken);
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanExpiredTokens() {
        invalidatedTokenRepository.deleteByExpiryTimeBefore(new Date());
        log.info("Cleaned up expired invalidated tokens");
    }
}
