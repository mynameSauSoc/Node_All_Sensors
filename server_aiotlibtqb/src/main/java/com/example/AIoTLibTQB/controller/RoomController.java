package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.dto.request.RoomCreationRequest;
import com.example.AIoTLibTQB.dto.request.RoomUpdateRequest;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.dto.response.RoomResponse;
import com.example.AIoTLibTQB.service.RoomService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoomController {

    RoomService roomService;

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    @PostMapping
    public ApiResponse<RoomResponse> create(@RequestBody @Valid RoomCreationRequest request) {
        return ApiResponse.<RoomResponse>builder()
                .result(roomService.create(request))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE', 'VIEWER', 'USER')")
    @GetMapping
    public ApiResponse<PageResponse<RoomResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) Integer floor) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        Pageable pageable = PageRequest.of(safePage, safeSize);
        return ApiResponse.<PageResponse<RoomResponse>>builder()
                .result(roomService.getAll(pageable, floor))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE', 'VIEWER', 'USER')")
    @GetMapping("/{id}")
    public ApiResponse<RoomResponse> getById(@PathVariable String id) {
        return ApiResponse.<RoomResponse>builder()
                .result(roomService.getById(id))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE', 'VIEWER', 'USER')")
    @GetMapping("/code/{code}")
    public ApiResponse<RoomResponse> getByCode(@PathVariable String code) {
        return ApiResponse.<RoomResponse>builder()
                .result(roomService.getByCode(code))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    @PutMapping("/{id}")
    public ApiResponse<RoomResponse> update(
            @PathVariable String id,
            @RequestBody @Valid RoomUpdateRequest request) {
        return ApiResponse.<RoomResponse>builder()
                .result(roomService.update(id, request))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        roomService.delete(id);
        return ApiResponse.<Void>builder().build();
    }
}
