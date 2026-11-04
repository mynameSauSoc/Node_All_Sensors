package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.request.IntrospectRequest;
import com.example.AIoTLibTQB.dto.response.IntrospectResponse;
import com.example.AIoTLibTQB.repository.InvalidatedTokenRepository;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.SignedJWT;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.text.ParseException;
import java.util.Date;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class IntrospectService {

    InvalidatedTokenRepository invalidatedTokenRepository;

    @NonFinal
    @Value("${jwt.secret-key}")
    String secretKey;

    public IntrospectResponse introspect(IntrospectRequest request) throws ParseException, JOSEException {
        boolean isValid = true;
        try {
            verifyToken(request.getToken());
        } catch (Exception e) {
            isValid = false;
        }
        return IntrospectResponse.builder().valid(isValid).build();
    }

    public SignedJWT verifyToken(String token) throws JOSEException, ParseException {
        SignedJWT signedJWT = SignedJWT.parse(token);

        boolean verified = signedJWT.verify(new MACVerifier(secretKey.getBytes()));
        if (!verified) {
            throw new RuntimeException("Invalid token signature");
        }

        Date expiryTime = signedJWT.getJWTClaimsSet().getExpirationTime();
        if (expiryTime == null || expiryTime.before(new Date())) {
            throw new RuntimeException("Token expired or missing expiration");
        }

        String jwtId = signedJWT.getJWTClaimsSet().getJWTID();
        if (jwtId == null || jwtId.isBlank() || invalidatedTokenRepository.existsById(jwtId)) {
            throw new RuntimeException("Token missing ID or has been invalidated");
        }

        return signedJWT;
    }
}
