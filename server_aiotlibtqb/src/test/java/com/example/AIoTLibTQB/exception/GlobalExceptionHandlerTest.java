package com.example.AIoTLibTQB.exception;

import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;

    @BeforeEach
    void setUp() {
        exceptionHandler = new GlobalExceptionHandler();
    }

    @Test
    @DisplayName("Bắt lỗi generic Exception -> trả về HTTP 500 và mã UNCATEGORIZED_EXCEPTION (9999)")
    void handleGenericException_returns500AndCode9999() {
        Exception ex = new RuntimeException("Unexpected database failure");

        ResponseEntity<ApiResponse<?>> response = exceptionHandler.handleGenericException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.UNCATEGORIZED_EXCEPTION.getCode());
        assertThat(response.getBody().getMessage()).isEqualTo(ErrorCode.UNCATEGORIZED_EXCEPTION.getMessage());
    }

    @Test
    @DisplayName("Bắt lỗi AppException -> trả về đúng HTTP status và ErrorCode")
    void handleAppException_returnsConfiguredStatusAndCode() {
        AppException ex = new AppException(ErrorCode.USER_DID_NOT_EXIST);

        ResponseEntity<ApiResponse<?>> response = exceptionHandler.handleAppException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.USER_DID_NOT_EXIST.getCode());
        assertThat(response.getBody().getMessage()).isEqualTo(ErrorCode.USER_DID_NOT_EXIST.getMessage());
    }

    @Test
    @DisplayName("Bắt lỗi AccessDeniedException -> trả về HTTP 403 và mã UNAUTHORIZED (1007)")
    void handleAccessDeniedException_returns403AndCode1007() {
        AccessDeniedException ex = new AccessDeniedException("Access is denied");

        ResponseEntity<ApiResponse<?>> response = exceptionHandler.handleAccessDeniedException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.UNAUTHORIZED.getCode());
        assertThat(response.getBody().getMessage()).isEqualTo(ErrorCode.UNAUTHORIZED.getMessage());
    }

    @Test
    @DisplayName("Bắt lỗi validation có field error -> phân giải enum ErrorCode tương ứng")
    void handleValidationException_withValidFieldError_resolvesErrorCode() throws NoSuchMethodException {
        BindingResult bindingResult = mock(BindingResult.class);
        FieldError fieldError = new FieldError("objectName", "username", "USERNAME_INVALID");
        when(bindingResult.getFieldError()).thenReturn(fieldError);

        Method dummyMethod = this.getClass().getDeclaredMethod("setUp");
        MethodParameter methodParameter = new MethodParameter(dummyMethod, -1);
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter, bindingResult);

        ResponseEntity<ApiResponse<?>> response = exceptionHandler.handleValidationException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.USERNAME_INVALID.getCode());
        assertThat(response.getBody().getMessage()).isEqualTo(ErrorCode.USERNAME_INVALID.getMessage());
    }

    @Test
    @DisplayName("Bắt lỗi validation khi field error là null (class-level validation) -> không bị NullPointerException")
    void handleValidationException_withNullFieldError_doesNotThrowNpe() throws NoSuchMethodException {
        BindingResult bindingResult = mock(BindingResult.class);
        when(bindingResult.getFieldError()).thenReturn(null);

        Method dummyMethod = this.getClass().getDeclaredMethod("setUp");
        MethodParameter methodParameter = new MethodParameter(dummyMethod, -1);
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter, bindingResult);

        ResponseEntity<ApiResponse<?>> response = exceptionHandler.handleValidationException(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.INVALID_MESSAGE_KEY.getCode());
    }
}
