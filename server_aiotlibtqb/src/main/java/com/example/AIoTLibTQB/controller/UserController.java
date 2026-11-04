package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.dto.request.PasswordChangeRequest;
import com.example.AIoTLibTQB.dto.request.UserCreationRequest;
import com.example.AIoTLibTQB.dto.request.UserStatusRequest;
import com.example.AIoTLibTQB.dto.request.UserUpdateRequest;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.dto.response.UserResponse;
import com.example.AIoTLibTQB.service.UserService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserController {

    UserService userService;

    @PostMapping
    public ApiResponse<UserResponse> create(@RequestBody @Valid UserCreationRequest request) {
        return ApiResponse.<UserResponse>builder()
                .result(userService.create(request))
                .build();
    }

    @GetMapping
    public ApiResponse<PageResponse<UserResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        java.util.List<String> allowedSortFields = java.util.List.of("username", "createdAt", "email");
        String safeSortBy = allowedSortFields.contains(sortBy) ? sortBy : "createdAt";

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(safeSortBy).ascending()
                : Sort.by(safeSortBy).descending();
        Pageable pageable = PageRequest.of(safePage, safeSize, sort);

        return ApiResponse.<PageResponse<UserResponse>>builder()
                .result(userService.getAll(pageable))
                .build();
    }

    @GetMapping("/myInfo")
    public ApiResponse<UserResponse> getMyInfo() {
        return ApiResponse.<UserResponse>builder()
                .result(userService.getMyInfo())
                .build();
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@RequestBody @Valid PasswordChangeRequest request) {
        userService.changePassword(request);
        return ApiResponse.<Void>builder()
                .message("Password changed successfully")
                .build();
    }

    @GetMapping("/{userId}")
    public ApiResponse<UserResponse> getById(@PathVariable("userId") String id) {
        return ApiResponse.<UserResponse>builder()
                .result(userService.getByID(id))
                .build();
    }

    @PutMapping("/{userId}")
    public ApiResponse<UserResponse> update(
            @RequestBody @Valid UserUpdateRequest request,
            @PathVariable("userId") String id) {
        return ApiResponse.<UserResponse>builder()
                .result(userService.update(request, id))
                .build();
    }

    @PatchMapping("/{userId}/status")
    public ApiResponse<UserResponse> toggleStatus(
            @PathVariable("userId") String id,
            @RequestBody @Valid UserStatusRequest request) {
        return ApiResponse.<UserResponse>builder()
                .result(userService.toggleStatus(id, request))
                .build();
    }

    @DeleteMapping("/{userId}")
    public ApiResponse<String> deleteById(@PathVariable("userId") String id) {
        userService.deleteById(id);
        return ApiResponse.<String>builder()
                .result("User with id: " + id + " has been deleted")
                .build();
    }
}
