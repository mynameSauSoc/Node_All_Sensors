package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.request.DeviceAuthRequest;
import com.example.AIoTLibTQB.dto.request.DeviceRegistrationRequest;
import com.example.AIoTLibTQB.dto.request.DeviceUpdateRequest;
import com.example.AIoTLibTQB.dto.response.AuthenticationResponse;
import com.example.AIoTLibTQB.dto.response.DeviceRegistrationResponse;
import com.example.AIoTLibTQB.dto.response.DeviceResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.example.AIoTLibTQB.dto.response.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {

    @Mock DeviceRepository deviceRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock AuthenticationService authenticationService;
    @Mock UserRepository userRepository;
    @Mock DiscoveredDeviceService discoveredDeviceService;
    @Mock DeviceMetadataCache deviceMetadataCache;

    @InjectMocks DeviceService deviceService;

    private Device buildDevice(String id, String hardwareId, String zoneId) {
        return Device.builder()
                .id(id)
                .name("Node Test")
                .hardwareId(hardwareId)
                .zoneId(zoneId)
                .deviceType("SENSOR_NODE")
                .apiKeyHash("hashed-key")
                .isActive(true)
                .lastSeenAt(Instant.now())
                .build();
    }

    @Nested
    @DisplayName("register()")
    class RegisterTests {

        @Test
        @DisplayName("Đăng ký mới thành công → trả về rawApiKey")
        void register_newDevice_returnsRawKey() {
            DeviceRegistrationRequest request = DeviceRegistrationRequest.builder()
                    .name("Node P411")
                    .hardwareId("EC:DA:3B:11:22:33")
                    .zoneId("P411")
                    .deviceType("SENSOR_NODE")
                    .build();

            when(deviceRepository.findByHardwareId("EC:DA:3B:11:22:33")).thenReturn(Optional.empty());
            when(passwordEncoder.encode(anyString())).thenReturn("hashed-key");
            when(deviceRepository.save(any(Device.class))).thenAnswer(inv -> {
                Device d = inv.getArgument(0);
                d.setId("dev-001");
                return d;
            });

            DeviceRegistrationResponse res = deviceService.register(request);

            assertThat(res.getId()).isEqualTo("dev-001");
            assertThat(res.getHardwareId()).isEqualTo("EC:DA:3B:11:22:33");
            assertThat(res.getRawApiKey()).isNotBlank();
            assertThat(res.isAlreadyExisted()).isFalse();
            verify(deviceRepository).save(any(Device.class));
        }

        @Test
        @DisplayName("Thiết bị đã tồn tại → trả về device cũ, rawApiKey null")
        void register_existingDevice_returnsNullKey() {
            Device existing = buildDevice("dev-001", "EC:DA:3B:11:22:33", "P411");
            DeviceRegistrationRequest request = DeviceRegistrationRequest.builder()
                    .hardwareId("EC:DA:3B:11:22:33")
                    .build();

            when(deviceRepository.findByHardwareId("EC:DA:3B:11:22:33")).thenReturn(Optional.of(existing));

            DeviceRegistrationResponse res = deviceService.register(request);

            assertThat(res.getId()).isEqualTo("dev-001");
            assertThat(res.getRawApiKey()).isNull();
            assertThat(res.isAlreadyExisted()).isTrue();
            verify(deviceRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("update()")
    class UpdateTests {

        @Test
        @DisplayName("Cập nhật thông tin thiết bị (tên, zoneId) thành công")
        void update_success() {
            Device existing = buildDevice("dev-001", "EC:DA:3B:11:22:33", "P411");
            DeviceUpdateRequest request = DeviceUpdateRequest.builder()
                    .name("Node Cửa sổ P124")
                    .zoneId("P124")
                    .location("Cửa sổ hướng Đông")
                    .deviceType("NOISE_MONITOR")
                    .build();

            when(deviceRepository.findById("dev-001")).thenReturn(Optional.of(existing));
            when(deviceRepository.save(any(Device.class))).thenAnswer(inv -> inv.getArgument(0));

            DeviceResponse res = deviceService.update("dev-001", request);

            assertThat(res.getName()).isEqualTo("Node Cửa sổ P124");
            assertThat(res.getZoneId()).isEqualTo("P124");
            assertThat(res.getLocation()).isEqualTo("Cửa sổ hướng Đông");
            assertThat(res.getDeviceType()).isEqualTo("NOISE_MONITOR");
            verify(deviceRepository).save(existing);
        }
    }

    @Nested
    @DisplayName("getByZone() — Zone Scoping")
    class GetByZoneTests {

        @Test
        @DisplayName("Admin hoặc Librarian được xem bất kỳ zone nào")
        void getByZone_admin_success() {
            Device d = buildDevice("dev-001", "EC:DA:3B:11:22:33", "P411");
            when(deviceRepository.findByZoneId("P411")).thenReturn(List.of(d));

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            doReturn(List.of(new SimpleGrantedAuthority("ADMIN"))).when(auth).getAuthorities();
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);

                List<DeviceResponse> list = deviceService.getByZone("P411");
                assertThat(list).hasSize(1);
                assertThat(list.get(0).getZoneId()).isEqualTo("P411");
                verify(userRepository, never()).findByUsername(any());
            }
        }

        @Test
        @DisplayName("ZONE_MANAGER có assignedZones chứa zoneId → được xem")
        void getByZone_zoneManagerAllowed_success() {
            Device d = buildDevice("dev-001", "EC:DA:3B:11:22:33", "P411");
            User manager = User.builder()
                    .username("zm_user")
                    .assignedZones(Set.of("P411", "P111"))
                    .build();

            when(deviceRepository.findByZoneId("P411")).thenReturn(List.of(d));

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            doReturn(List.of(new SimpleGrantedAuthority("ZONE_MANAGER"))).when(auth).getAuthorities();
            when(auth.getName()).thenReturn("zm_user");
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
                when(userRepository.findByUsername("zm_user")).thenReturn(Optional.of(manager));

                List<DeviceResponse> list = deviceService.getByZone("P411");
                assertThat(list).hasSize(1);
            }
        }

        @Test
        @DisplayName("ZONE_MANAGER không được phân công zoneId → ZONE_ACCESS_DENIED")
        void getByZone_zoneManagerDenied_throwsException() {
            User manager = User.builder()
                    .username("zm_user")
                    .assignedZones(Set.of("P111"))
                    .build();

            Authentication auth = mock(Authentication.class);
            SecurityContext ctx = mock(SecurityContext.class);
            doReturn(List.of(new SimpleGrantedAuthority("ZONE_MANAGER"))).when(auth).getAuthorities();
            when(auth.getName()).thenReturn("zm_user");
            when(ctx.getAuthentication()).thenReturn(auth);

            try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
                holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
                when(userRepository.findByUsername("zm_user")).thenReturn(Optional.of(manager));

                assertThatThrownBy(() -> deviceService.getByZone("P411"))
                        .isInstanceOf(AppException.class)
                        .extracting(e -> ((AppException) e).getErrorCode())
                        .isEqualTo(ErrorCode.ZONE_ACCESS_DENIED);
            }
        }
    }

    @Nested
    @DisplayName("updateLastSeen()")
    class HeartbeatTests {

        @Test
        @DisplayName("Cập nhật lastSeenAt thành công")
        void updateLastSeen_updatesTimestamp() {
            Device d = buildDevice("dev-001", "EC:DA:3B:11:22:33", "P411");
            when(deviceRepository.findById("dev-001")).thenReturn(Optional.of(d));

            deviceService.updateLastSeen("dev-001");

            verify(deviceRepository).save(d);
            assertThat(d.getLastSeenAt()).isNotNull();
        }

        @Test
        @DisplayName("getById() - Thiết bị có connectionState=OFFLINE thì online luôn là false (H1)")
        void getById_offlineDevice_returnsOnlineFalse() {
            Device d = buildDevice("dev-offline", "EC:DA:3B:11:22:33", "P411");
            d.setConnectionState("OFFLINE");
            d.setLastSeenAt(Instant.now());
            when(deviceRepository.findById("dev-offline")).thenReturn(Optional.of(d));

            DeviceResponse response = deviceService.getById("dev-offline");
            assertThat(response.isOnline()).isFalse();
            assertThat(response.getConnectionState()).isEqualTo("OFFLINE");
        }
    }

    @Nested
    @DisplayName("Cache Invalidation & Pagination")
    class OperationAndCacheTests {

        @Test
        @DisplayName("update() - Thành công và gọi deviceMetadataCache.invalidate")
        void update_success_invalidatesCache() {
            Device d = buildDevice("dev-001", "HW-001", "Z1");
            when(deviceRepository.findById("dev-001")).thenReturn(Optional.of(d));
            when(deviceRepository.save(any(Device.class))).thenAnswer(inv -> inv.getArgument(0));

            DeviceUpdateRequest req = DeviceUpdateRequest.builder()
                    .name("New Name")
                    .roomId("room-123")
                    .build();

            DeviceResponse res = deviceService.update("dev-001", req);

            assertThat(res.getName()).isEqualTo("New Name");
            assertThat(res.getRoomId()).isEqualTo("room-123");
            verify(deviceMetadataCache).invalidate("HW-001");
        }

        @Test
        @DisplayName("toggleStatus() - Thành công và gọi deviceMetadataCache.invalidate")
        void toggleStatus_success_invalidatesCache() {
            Device d = buildDevice("dev-001", "HW-001", "Z1");
            when(deviceRepository.findById("dev-001")).thenReturn(Optional.of(d));
            when(deviceRepository.save(any(Device.class))).thenAnswer(inv -> inv.getArgument(0));

            DeviceResponse res = deviceService.toggleStatus("dev-001", false);

            assertThat(res.isActive()).isFalse();
            verify(deviceMetadataCache).invalidate("HW-001");
        }

        @Test
        @DisplayName("delete() - Thành công và gọi deviceMetadataCache.invalidate")
        void delete_success_invalidatesCache() {
            Device d = buildDevice("dev-001", "HW-001", "Z1");
            when(deviceRepository.findById("dev-001")).thenReturn(Optional.of(d));

            deviceService.delete("dev-001");

            verify(deviceRepository).deleteById("dev-001");
            verify(deviceMetadataCache).invalidate("HW-001");
        }

        @Test
        @DisplayName("getAll() - Phân trang PageResponse chuẩn")
        void getAll_paginated_success() {
            Device d1 = buildDevice("dev-1", "HW-1", "Z1");
            Device d2 = buildDevice("dev-2", "HW-2", "Z1");
            Pageable pageable = PageRequest.of(0, 10);
            Page<Device> page = new PageImpl<>(List.of(d1, d2), pageable, 2);

            when(deviceRepository.findAll(pageable)).thenReturn(page);

            PageResponse<DeviceResponse> res = deviceService.getAll(pageable, null, null);

            assertThat(res.getContent()).hasSize(2);
            assertThat(res.getTotalElements()).isEqualTo(2);
            assertThat(res.getPage()).isEqualTo(0);
            assertThat(res.getSize()).isEqualTo(10);
        }
    }
}
