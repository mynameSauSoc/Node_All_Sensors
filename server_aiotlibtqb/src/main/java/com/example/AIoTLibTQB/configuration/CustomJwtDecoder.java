package com.example.AIoTLibTQB.configuration;

import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.repository.InvalidatedTokenRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;

@Component
public class CustomJwtDecoder implements JwtDecoder {

    private final NimbusJwtDecoder nimbusJwtDecoder;

    public CustomJwtDecoder(
            @Value("${jwt.secret-key}") String secretKey,
            InvalidatedTokenRepository invalidatedTokenRepository) {
        this(secretKey, invalidatedTokenRepository, null);
    }

    @Autowired
    public CustomJwtDecoder(
            @Value("${jwt.secret-key}") String secretKey,
            InvalidatedTokenRepository invalidatedTokenRepository,
            @Autowired(required = false) UserRepository userRepository) {

        SecretKeySpec secretKeySpec = new SecretKeySpec(secretKey.getBytes(), "HS512");
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKeySpec)
                .macAlgorithm(MacAlgorithm.HS512)
                .build();

        OAuth2TokenValidator<Jwt> blacklistValidator = jwt -> {
            String jwtId = jwt.getId();
            if (jwtId == null || invalidatedTokenRepository.existsById(jwtId)) {
                return OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "Token has been invalidated or missing ID", null)
                );
            }
            return OAuth2TokenValidatorResult.success();
        };

        OAuth2TokenValidator<Jwt> tokenTypeValidator = jwt -> {
            String tokenType = jwt.getClaimAsString("tokenType");
            if ("REFRESH".equalsIgnoreCase(tokenType)) {
                return OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "Refresh token cannot be used as an access token", null)
                );
            }
            if (tokenType != null && !"ACCESS".equalsIgnoreCase(tokenType) && !"DEVICE".equalsIgnoreCase(tokenType)) {
                return OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "Invalid token type: " + tokenType, null)
                );
            }
            return OAuth2TokenValidatorResult.success();
        };

        OAuth2TokenValidator<Jwt> userRevocationValidator = jwt -> {
            if (userRepository == null) {
                return OAuth2TokenValidatorResult.success();
            }
            String tokenType = jwt.getClaimAsString("tokenType");
            if (tokenType == null || "ACCESS".equalsIgnoreCase(tokenType)) {
                String username = jwt.getSubject();
                if (username != null) {
                    var userOpt = userRepository.findByUsername(username);
                    if (userOpt.isPresent()) {
                        User user = userOpt.get();
                        if (!user.isActive()) {
                            return OAuth2TokenValidatorResult.failure(
                                    new OAuth2Error("invalid_token", "User account is disabled", null)
                            );
                        }
                        if (user.getCredentialsUpdatedAt() != null && jwt.getIssuedAt() != null) {
                            if (jwt.getIssuedAt().isBefore(user.getCredentialsUpdatedAt())) {
                                return OAuth2TokenValidatorResult.failure(
                                        new OAuth2Error("invalid_token", "Token revoked due to credentials update", null)
                                );
                            }
                        }
                    }
                }
            }
            return OAuth2TokenValidatorResult.success();
        };

        decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(
                blacklistValidator, tokenTypeValidator, userRevocationValidator));
        this.nimbusJwtDecoder = decoder;
    }

    @Override
    public Jwt decode(String token) throws JwtException {
        return nimbusJwtDecoder.decode(token);
    }
}
