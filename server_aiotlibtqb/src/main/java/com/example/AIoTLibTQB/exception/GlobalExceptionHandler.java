package com.example.AIoTLibTQB.exception;

import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(value = Exception.class)
    ResponseEntity<ApiResponse<?>> handleGenericException(Exception e) {
        log.error("Unhandled internal server exception caught: ", e);

        ErrorCode errorCode = ErrorCode.UNCATEGORIZED_EXCEPTION;
        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(api);
    }

    @ExceptionHandler(value = AppException.class)
    ResponseEntity<ApiResponse<?>> handleAppException(AppException e) {
        ErrorCode errorCode = e.getErrorCode();
        log.warn("AppException occurred: code={}, message={}", errorCode.getCode(), errorCode.getMessage());

        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(api);
    }

    @ExceptionHandler(value = AccessDeniedException.class)
    ResponseEntity<ApiResponse<?>> handleAccessDeniedException(AccessDeniedException e) {
        log.warn("AccessDeniedException: {}", e.getMessage());

        ErrorCode errorCode = ErrorCode.UNAUTHORIZED;
        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(api);
    }

    @ExceptionHandler(value = MethodArgumentNotValidException.class)
    ResponseEntity<ApiResponse<?>> handleValidationException(MethodArgumentNotValidException e) {
        var fieldError = e.getFieldError();
        String message = (fieldError != null && fieldError.getDefaultMessage() != null)
                ? fieldError.getDefaultMessage()
                : e.getMessage();

        log.warn("Validation failure: {}", message);

        ErrorCode errorCode = ErrorCode.INVALID_MESSAGE_KEY;
        try {
            errorCode = ErrorCode.valueOf(message);
        } catch (IllegalArgumentException ignored) {

        }

        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(errorCode != ErrorCode.INVALID_MESSAGE_KEY
                        ? errorCode.getMessage()
                        : message)
                .build();
        return ResponseEntity.status(errorCode.getStatusCode()).body(api);
    }

    @ExceptionHandler(value = HttpMessageNotReadableException.class)
    ResponseEntity<ApiResponse<?>> handleHttpMessageNotReadableException(HttpMessageNotReadableException e) {
        log.warn("Malformed or unreadable request payload: {}", e.getMessage());
        ErrorCode errorCode = ErrorCode.INVALID_REQUEST_PAYLOAD;
        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message("Malformed or unreadable request body: " + (e.getRootCause() != null ? e.getRootCause().getMessage() : e.getMessage()))
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(api);
    }

    @ExceptionHandler(value = MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiResponse<?>> handleMethodArgumentTypeMismatchException(MethodArgumentTypeMismatchException e) {
        log.warn("Method argument type mismatch: param={}, error={}", e.getName(), e.getMessage());
        ErrorCode errorCode = ErrorCode.INVALID_PARAMETER;
        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message("Invalid parameter type for '" + e.getName() + "': " + e.getValue())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(api);
    }

    @ExceptionHandler(value = MissingServletRequestParameterException.class)
    ResponseEntity<ApiResponse<?>> handleMissingServletRequestParameterException(MissingServletRequestParameterException e) {
        log.warn("Missing servlet request parameter: {}", e.getParameterName());
        ErrorCode errorCode = ErrorCode.INVALID_PARAMETER;
        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message("Missing required query parameter: " + e.getParameterName())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(api);
    }

    @ExceptionHandler(value = IllegalArgumentException.class)
    ResponseEntity<ApiResponse<?>> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("Illegal argument exception: {}", e.getMessage());
        ErrorCode errorCode = ErrorCode.INVALID_PARAMETER;
        ApiResponse<?> api = ApiResponse.builder()
                .code(errorCode.getCode())
                .message(e.getMessage() != null ? e.getMessage() : "Invalid parameter supplied")
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(api);
    }
}
