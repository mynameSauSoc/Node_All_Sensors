package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.ZoneResponse;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/zones")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE', 'VIEWER', 'USER')")
public class ZoneController {

    DeviceRepository deviceRepository;

    private static final List<ZoneResponse> STATIC_ZONES = List.of(
            ZoneResponse.builder()
                    .id("ZONE_A")
                    .name("Khu Vực Học Tập Yên Tĩnh & Phòng Đọc Chính")
                    .description("Các phòng đọc lớn, phòng Multimedia và kho sách cánh Tây")
                    .build(),
            ZoneResponse.builder()
                    .id("ZONE_B")
                    .name("Khu Vực Thảo Luận Nhóm & Phòng Đọc Cánh Đông")
                    .description("Cụm phòng làm việc nhóm Tầng 5 và phòng đọc cánh Đông")
                    .build(),
            ZoneResponse.builder()
                    .id("ZONE_C")
                    .name("Khu Lưu Trữ Đặc Biệt & Phòng Truyền Thống")
                    .description("Kho bảo quản tư liệu quý hiếm và Phòng Truyền thống TQB")
                    .build(),
            ZoneResponse.builder()
                    .id("ZONE_HALL")
                    .name("Khu Vực Sảnh Lưu Thông & Dịch Vụ Bạn Đọc")
                    .description("Sảnh trung tâm Tầng 1, cửa từ kiểm soát và dịch vụ sao chụp/mượn")
                    .build()
    );

    @GetMapping
    public ApiResponse<List<ZoneResponse>> getAllZones() {
        List<ZoneResponse> zones = STATIC_ZONES.stream()
                .map(z -> {
                    int count = deviceRepository.findByZoneId(z.getId()).size();
                    return ZoneResponse.builder()
                            .id(z.getId())
                            .name(z.getName())
                            .description(z.getDescription())
                            .deviceCount(count)
                            .build();
                })
                .toList();
        return ApiResponse.<List<ZoneResponse>>builder().result(zones).build();
    }

    @GetMapping("/{id}")
    public ApiResponse<ZoneResponse> getZoneById(@PathVariable String id) {
        ZoneResponse found = STATIC_ZONES.stream()
                .filter(z -> z.getId().equalsIgnoreCase(id))
                .findFirst()
                .map(z -> ZoneResponse.builder()
                        .id(z.getId())
                        .name(z.getName())
                        .description(z.getDescription())
                        .deviceCount(deviceRepository.findByZoneId(z.getId()).size())
                        .build())
                .orElse(ZoneResponse.builder()
                        .id(id)
                        .name("Khu Vực " + id)
                        .description("")
                        .deviceCount(deviceRepository.findByZoneId(id).size())
                        .build());
        return ApiResponse.<ZoneResponse>builder().result(found).build();
    }

    @GetMapping("/{id}/devices")
    public ApiResponse<List<Device>> getDevicesByZone(@PathVariable String id) {
        return ApiResponse.<List<Device>>builder().result(deviceRepository.findByZoneId(id)).build();
    }
}
