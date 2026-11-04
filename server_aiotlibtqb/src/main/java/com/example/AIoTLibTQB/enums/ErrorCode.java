package com.example.AIoTLibTQB.enums;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public enum ErrorCode {

    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized exception", HttpStatus.INTERNAL_SERVER_ERROR),

    USER_EXISTED(1001, "User already existed", HttpStatus.BAD_REQUEST),
    USERNAME_INVALID(1002, "Username must be at least 6 characters", HttpStatus.BAD_REQUEST),
    PASSWORD_INVALID(1003, "Password must be at least 8 characters", HttpStatus.BAD_REQUEST),
    INVALID_MESSAGE_KEY(1004, "Validation key is invalid", HttpStatus.BAD_REQUEST),
    USER_DID_NOT_EXIST(1005, "User does not exist", HttpStatus.NOT_FOUND),
    USER_INACTIVE(1008, "Account is disabled. Please contact administrator", HttpStatus.FORBIDDEN),
    USERNAME_REQUIRED(1009, "Username is required", HttpStatus.BAD_REQUEST),
    PASSWORD_REQUIRED(1010, "Password is required", HttpStatus.BAD_REQUEST),
    OLD_PASSWORD_INCORRECT(1011, "Current password does not match", HttpStatus.BAD_REQUEST),
    PASSWORD_SAME_AS_OLD(1012, "New password must be different from current password", HttpStatus.BAD_REQUEST),
    CANNOT_DEACTIVATE_SELF(1013, "Cannot deactivate your own account", HttpStatus.BAD_REQUEST),
    CANNOT_DELETE_SELF(1014, "Cannot delete your own account", HttpStatus.BAD_REQUEST),
    TOKEN_REQUIRED(1015, "Token is required", HttpStatus.BAD_REQUEST),

    UNAUTHENTICATED(1006, "Unauthenticated", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(1007, "You do not have permission", HttpStatus.FORBIDDEN),

    ROLE_EXISTED(2001, "Role already existed", HttpStatus.BAD_REQUEST),
    ROLE_NOT_EXISTED(2002, "Role does not exist", HttpStatus.NOT_FOUND),
    CANNOT_DELETE_SYSTEM_ROLE(2006, "Cannot delete system default role", HttpStatus.BAD_REQUEST),
    ROLE_NAME_REQUIRED(2007, "Role name is required", HttpStatus.BAD_REQUEST),

    PERMISSION_EXISTED(2003, "Permission already existed", HttpStatus.BAD_REQUEST),
    PERMISSION_NOT_EXISTED(2004, "Permission does not exist", HttpStatus.NOT_FOUND),
    PERMISSION_IN_USE(2005, "Permission is currently in use by one or more roles", HttpStatus.BAD_REQUEST),
    PERMISSION_NAME_REQUIRED(2008, "Permission name is required", HttpStatus.BAD_REQUEST),

    DEVICE_NOT_EXISTED(3001, "Device does not exist", HttpStatus.NOT_FOUND),
    DEVICE_INACTIVE(3002, "Device is disabled", HttpStatus.FORBIDDEN),
    INVALID_API_KEY(3003, "Invalid API key", HttpStatus.UNAUTHORIZED),
    DEVICE_NAME_REQUIRED(3004, "Device name is required", HttpStatus.BAD_REQUEST),
    HARDWARE_ID_REQUIRED(3005, "Hardware ID is required", HttpStatus.BAD_REQUEST),
    ZONE_ID_REQUIRED(3006, "Zone ID is required", HttpStatus.BAD_REQUEST),
    DEVICE_TYPE_REQUIRED(3007, "Device type is required", HttpStatus.BAD_REQUEST),
    API_KEY_REQUIRED(3008, "API key is required", HttpStatus.BAD_REQUEST),
    TOO_MANY_REQUESTS(4029, "Too many requests. Please try again later", HttpStatus.TOO_MANY_REQUESTS),
    ZONE_ACCESS_DENIED(4031, "You do not have access to this zone", HttpStatus.FORBIDDEN),

    ROOM_EXISTED(5001, "Room already existed", HttpStatus.BAD_REQUEST),
    ROOM_NOT_EXISTED(5002, "Room does not exist", HttpStatus.NOT_FOUND),
    ROOM_CODE_REQUIRED(5003, "Room code is required", HttpStatus.BAD_REQUEST),
    ROOM_NAME_REQUIRED(5004, "Room name is required", HttpStatus.BAD_REQUEST),
    FLOOR_REQUIRED(5005, "Floor is required", HttpStatus.BAD_REQUEST),
    ROOM_HAS_DEVICES(5006, "Cannot delete room with associated devices", HttpStatus.BAD_REQUEST),

    ALERT_NOT_EXISTED(6001, "Alert does not exist", HttpStatus.NOT_FOUND),

    INVALID_TIME_RANGE(7001, "Invalid time range: start must be before end", HttpStatus.BAD_REQUEST),
    TOO_MANY_BUCKETS(7002, "Too many buckets requested: maximum allowed is 1000", HttpStatus.BAD_REQUEST),
    INVALID_INTERVAL(7003, "Invalid interval: supported intervals are 15m, 1h, 1d", HttpStatus.BAD_REQUEST),

    INVALID_REQUEST_PAYLOAD(9001, "Invalid request payload", HttpStatus.BAD_REQUEST),
    INVALID_PARAMETER(9002, "Invalid request parameter", HttpStatus.BAD_REQUEST),
    ;

    int code;
    String message;
    HttpStatusCode statusCode;

    ErrorCode(int code, String message, HttpStatusCode statusCode) {
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
    }
}
