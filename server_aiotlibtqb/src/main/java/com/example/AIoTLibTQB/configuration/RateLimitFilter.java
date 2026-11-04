package com.example.AIoTLibTQB.configuration;

import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> RATE_LIMITED_ENDPOINTS = Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/auth/introspect",
            "/api/v1/devices/authenticate",
            "/api/v1/users"
    );

    @NonFinal
    @Value("${security.rate-limit.trusted-proxies:}")
    List<String> trustedProxies;

    Cache<String, Bucket> ipBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10))
            .maximumSize(10_000)
            .build();

    ObjectMapper objectMapper;

    private Bucket createNewBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(10)
                .refillGreedy(10, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getServletPath();
        if (path != null) {
            int semicolon = path.indexOf(';');
            if (semicolon != -1) {
                path = path.substring(0, semicolon);
            }
            path = path.replaceAll("/+", "/");
            if (path.length() > 1 && path.endsWith("/")) {
                path = path.substring(0, path.length() - 1);
            }
        }

        String method = request.getMethod();
        boolean isRateLimitedEndpoint = "POST".equalsIgnoreCase(method) &&
                RATE_LIMITED_ENDPOINTS.contains(path);

        if (isRateLimitedEndpoint) {
            String clientIp = getClientIP(request);
            String bucketKey = clientIp + ":" + path;
            Bucket bucket = ipBuckets.get(bucketKey, k -> createNewBucket());

            ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
            if (!probe.isConsumed()) {
                long waitForRefillSeconds = Math.max(1, probe.getNanosToWaitForRefill() / 1_000_000_000L);

                log.warn("Rate limit exceeded (HTTP 429) for IP [{}] on path [{}] - Retry after {}s",
                        clientIp, path, waitForRefillSeconds);

                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setCharacterEncoding("UTF-8");
                response.setHeader("Retry-After", String.valueOf(waitForRefillSeconds));

                ApiResponse<Void> apiResponse = ApiResponse.<Void>builder()
                        .code(ErrorCode.TOO_MANY_REQUESTS.getCode())
                        .message(ErrorCode.TOO_MANY_REQUESTS.getMessage())
                        .build();

                response.getWriter().write(objectMapper.writeValueAsString(apiResponse));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIP(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        String xf = request.getHeader("X-Forwarded-For");

        if (xf != null && !xf.isBlank() && isTrustedProxy(remoteAddr)) {
            return xf.split(",")[0].trim();
        }
        return remoteAddr != null ? remoteAddr : "unknown";
    }

    private boolean isTrustedProxy(String ip) {
        if (ip == null) return false;
        if (ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1")) {
            return true;
        }
        if (trustedProxies != null && !trustedProxies.isEmpty()) {
            return trustedProxies.contains(ip.trim());
        }
        return false;
    }
}
