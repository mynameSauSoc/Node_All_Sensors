package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.dto.response.AlertResponse;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.enums.AlertStatus;
import com.example.AIoTLibTQB.enums.AlertType;
import com.example.AIoTLibTQB.service.AlertService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/alerts")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AlertController {

    AlertService alertService;

    @GetMapping
    @PreAuthorize("hasAuthority('VIEW_ALERTS')")
    public ApiResponse<PageResponse<AlertResponse>> getAlerts(
            @RequestParam(required = false) String roomId,
            @RequestParam(required = false) AlertType type,
            @RequestParam(required = false) AlertStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "startedAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String direction
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        java.util.List<String> allowedSortFields = java.util.List.of("startedAt", "severity", "status", "type", "createdAt");
        String safeSortBy = allowedSortFields.contains(sortBy) ? sortBy : "startedAt";
        Sort.Direction sortDirection = "ASC".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(sortDirection, safeSortBy));

        return ApiResponse.<PageResponse<AlertResponse>>builder()
                .result(alertService.getAlerts(roomId, type, status, pageable))
                .build();
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasAuthority('VIEW_ALERTS')")
    public ApiResponse<Long> getUnreadCount() {
        return ApiResponse.<Long>builder()
                .result(alertService.getUnreadCount())
                .build();
    }

    @RequestMapping(value = "/{id}/acknowledge", method = {RequestMethod.POST, RequestMethod.PATCH})
    @PreAuthorize("hasAuthority('ACKNOWLEDGE_ALERT')")
    public ApiResponse<AlertResponse> acknowledgeAlert(@PathVariable String id) {
        String username = extractUsername();
        return ApiResponse.<AlertResponse>builder()
                .result(alertService.acknowledgeAlert(id, username))
                .build();
    }

    @RequestMapping(value = "/{id}/resolve", method = {RequestMethod.POST, RequestMethod.PATCH})
    @PreAuthorize("hasAuthority('MANAGE_ALERT_CONFIG')")
    public ApiResponse<AlertResponse> resolveAlert(@PathVariable String id) {
        String username = extractUsername();
        return ApiResponse.<AlertResponse>builder()
                .result(alertService.resolveAlert(id, username))
                .build();
    }

    private String extractUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getName() != null && !authentication.getName().isBlank()) {
            return authentication.getName();
        }
        return "system";
    }
}
