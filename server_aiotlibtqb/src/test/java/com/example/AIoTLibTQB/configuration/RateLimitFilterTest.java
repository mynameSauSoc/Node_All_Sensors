package com.example.AIoTLibTQB.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RateLimitFilterTest {

    private RateLimitFilter rateLimitFilter;

    @BeforeEach
    void setUp() {
        rateLimitFilter = new RateLimitFilter(new ObjectMapper());
    }

    @Test
    @DisplayName("Gửi 10 request login trong 1 phút → đều thành công đi qua filter")
    void login_tenRequests_allSucceed() throws Exception {
        FilterChain filterChain = mock(FilterChain.class);

        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
            request.setServletPath("/api/v1/auth/login");
            request.setRemoteAddr("192.168.1.50");
            MockHttpServletResponse response = new MockHttpServletResponse();

            rateLimitFilter.doFilterInternal(request, response, filterChain);

            assertThat(response.getStatus()).isEqualTo(200);
        }

        verify(filterChain, times(10)).doFilter(any(), any());
    }

    @Test
    @DisplayName("Request thứ 11 vào /api/v1/auth/login → bị chặn với HTTP 429 Too Many Requests")
    void login_eleventhRequest_blockedWith429() throws Exception {
        FilterChain filterChain = mock(FilterChain.class);

        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
            request.setServletPath("/api/v1/auth/login");
            request.setRemoteAddr("10.0.0.99");
            MockHttpServletResponse response = new MockHttpServletResponse();

            rateLimitFilter.doFilterInternal(request, response, filterChain);
        }

        MockHttpServletRequest request11 = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request11.setServletPath("/api/v1/auth/login");
        request11.setRemoteAddr("10.0.0.99");
        MockHttpServletResponse response11 = new MockHttpServletResponse();

        rateLimitFilter.doFilterInternal(request11, response11, filterChain);

        assertThat(response11.getStatus()).isEqualTo(429);
        assertThat(response11.getHeader("Retry-After")).isNotNull();
        assertThat(response11.getContentAsString()).contains("4029");

        verify(filterChain, times(10)).doFilter(any(), any());
    }

    @Test
    @DisplayName("Endpoint login có dấu gạch chéo cuối (/api/v1/auth/login/) vẫn bị áp dụng rate limit")
    void login_withTrailingSlash_isRateLimited() throws Exception {
        FilterChain filterChain = mock(FilterChain.class);

        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login/");
            request.setServletPath("/api/v1/auth/login/");
            request.setRemoteAddr("10.0.0.88");
            MockHttpServletResponse response = new MockHttpServletResponse();

            rateLimitFilter.doFilterInternal(request, response, filterChain);
        }

        MockHttpServletRequest request11 = new MockHttpServletRequest("POST", "/api/v1/auth/login/");
        request11.setServletPath("/api/v1/auth/login/");
        request11.setRemoteAddr("10.0.0.88");
        MockHttpServletResponse response11 = new MockHttpServletResponse();

        rateLimitFilter.doFilterInternal(request11, response11, filterChain);

        assertThat(response11.getStatus()).isEqualTo(429);
        verify(filterChain, times(10)).doFilter(any(), any());
    }

    @Test
    @DisplayName("Hai địa chỉ IP khác nhau có xô hạn ngạch độc lập")
    void login_differentIps_haveSeparateBuckets() throws Exception {
        FilterChain filterChain = mock(FilterChain.class);

        // IP 1 gửi 10 request
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
            request.setServletPath("/api/v1/auth/login");
            request.setRemoteAddr("192.168.1.101");
            MockHttpServletResponse response = new MockHttpServletResponse();
            rateLimitFilter.doFilterInternal(request, response, filterChain);
        }

        // IP 2 gửi request lần đầu → phải thành công dù IP 1 đã hết quota
        MockHttpServletRequest requestIp2 = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        requestIp2.setServletPath("/api/v1/auth/login");
        requestIp2.setRemoteAddr("192.168.1.102");
        MockHttpServletResponse responseIp2 = new MockHttpServletResponse();

        rateLimitFilter.doFilterInternal(requestIp2, responseIp2, filterChain);

        assertThat(responseIp2.getStatus()).isEqualTo(200);
        verify(filterChain, times(11)).doFilter(any(), any());
    }

    @Test
    @DisplayName("Không tin cậy header X-Forwarded-For nếu IP gửi trực tiếp là public untrusted")
    void login_untrustedProxy_ignoresXForwardedFor() throws Exception {
        FilterChain filterChain = mock(FilterChain.class);

        // Kẻ tấn công từ public IP 203.0.113.5 cố tình giả mạo header X-Forwarded-For khác nhau
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
            request.setServletPath("/api/v1/auth/login");
            request.setRemoteAddr("203.0.113.5"); // Public IP, không phải trusted proxy
            request.addHeader("X-Forwarded-For", "1.2.3." + i);
            MockHttpServletResponse response = new MockHttpServletResponse();

            rateLimitFilter.doFilterInternal(request, response, filterChain);
        }

        // Request thứ 11 với header X-Forwarded-For mới vẫn phải bị chặn vì IP thật là 203.0.113.5
        MockHttpServletRequest request11 = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request11.setServletPath("/api/v1/auth/login");
        request11.setRemoteAddr("203.0.113.5");
        request11.addHeader("X-Forwarded-For", "9.9.9.9");
        MockHttpServletResponse response11 = new MockHttpServletResponse();

        rateLimitFilter.doFilterInternal(request11, response11, filterChain);

        assertThat(response11.getStatus()).isEqualTo(429);
    }

    @Test
    @DisplayName("Endpoint khác (GET /api/v1/users) không bị áp rate limit")
    void otherEndpoints_notRateLimited() throws Exception {
        FilterChain filterChain = mock(FilterChain.class);

        for (int i = 0; i < 15; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users");
            request.setServletPath("/api/v1/users");
            request.setRemoteAddr("192.168.1.50");
            MockHttpServletResponse response = new MockHttpServletResponse();

            rateLimitFilter.doFilterInternal(request, response, filterChain);

            assertThat(response.getStatus()).isEqualTo(200);
        }

        verify(filterChain, times(15)).doFilter(any(), any());
    }
}
