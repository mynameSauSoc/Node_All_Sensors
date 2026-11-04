package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.dto.request.DeviceAuthRequest;
import com.example.AIoTLibTQB.dto.request.DeviceRegistrationRequest;
import com.example.AIoTLibTQB.dto.request.DeviceUpdateRequest;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.AuthenticationResponse;
import com.example.AIoTLibTQB.dto.response.DeviceRegistrationResponse;
import com.example.AIoTLibTQB.dto.response.DeviceResponse;
import com.example.AIoTLibTQB.dto.response.DiscoveredDeviceResponse;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.service.DeviceService;
import com.example.AIoTLibTQB.service.DiscoveredDeviceService;
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
@RequestMapping("/api/v1/devices")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class DeviceController {

    DeviceService deviceService;
    DiscoveredDeviceService discoveredDeviceService;

    @PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN')")
    @GetMapping("/discovered")
    public ApiResponse<List<DiscoveredDeviceResponse>> getDiscovered() {
        return ApiResponse.<List<DiscoveredDeviceResponse>>builder()
                .result(discoveredDeviceService.getDiscoveredDevices())
                .build();
    }

    @PostMapping({"", "/register"})
    public ApiResponse<DeviceRegistrationResponse> register(
            @RequestBody @Valid DeviceRegistrationRequest request) {
        return ApiResponse.<DeviceRegistrationResponse>builder()
                .result(deviceService.register(request))
                .build();
    }

    @PutMapping("/{id}")
    public ApiResponse<DeviceResponse> update(
            @PathVariable String id,
            @RequestBody @Valid DeviceUpdateRequest request) {
        return ApiResponse.<DeviceResponse>builder()
                .result(deviceService.update(id, request))
                .build();
    }

    @PreAuthorize("hasAnyAuthority('ADMIN', 'DEVICE')")
    @PostMapping("/{id}/heartbeat")
    public ApiResponse<Void> heartbeat(@PathVariable String id) {
        deviceService.updateLastSeen(id);
        return ApiResponse.<Void>builder().build();
    }

    @PostMapping("/authenticate")
    public ApiResponse<AuthenticationResponse> authenticate(
            @RequestBody @Valid DeviceAuthRequest request) {
        return ApiResponse.<AuthenticationResponse>builder()
                .result(deviceService.authenticateDevice(request))
                .build();
    }

    @GetMapping
    public ApiResponse<PageResponse<DeviceResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String zoneId,
            @RequestParam(required = false) String roomId) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        Pageable pageable = PageRequest.of(safePage, safeSize);
        return ApiResponse.<PageResponse<DeviceResponse>>builder()
                .result(deviceService.getAll(pageable, zoneId, roomId))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<DeviceResponse> getById(@PathVariable String id) {
        return ApiResponse.<DeviceResponse>builder()
                .result(deviceService.getById(id))
                .build();
    }

    @GetMapping("/zone/{zoneId}")
    public ApiResponse<List<DeviceResponse>> getByZone(@PathVariable String zoneId) {
        return ApiResponse.<List<DeviceResponse>>builder()
                .result(deviceService.getByZone(zoneId))
                .build();
    }

    @PostMapping("/{id}/regenerate-key")
    public ApiResponse<DeviceRegistrationResponse> regenerateKey(@PathVariable String id) {
        return ApiResponse.<DeviceRegistrationResponse>builder()
                .result(deviceService.regenerateApiKey(id))
                .build();
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<DeviceResponse> toggleStatus(
            @PathVariable String id,
            @RequestParam boolean active) {
        return ApiResponse.<DeviceResponse>builder()
                .result(deviceService.toggleStatus(id, active))
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        deviceService.delete(id);
        return ApiResponse.<Void>builder().build();
    }
}
