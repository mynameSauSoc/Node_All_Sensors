package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceMetadataCacheTest {

    @Mock
    DeviceRepository deviceRepository;

    @InjectMocks
    DeviceMetadataCacheImpl deviceMetadataCache;

    Device mockDevice;

    @BeforeEach
    void setUp() {
        mockDevice = Device.builder()
                .id("dev-001")
                .hardwareId("ESP32_ROOM_101")
                .roomId("room-101")
                .zoneId("zone-A")
                .deviceType("ESP32_S3")
                .isActive(true)
                .build();
        deviceMetadataCache.cache.invalidateAll();
    }

    @Test
    @DisplayName("get() - Cache miss: Nạp từ DeviceRepository và lưu vào Caffeine Cache")
    void get_cacheMiss_loadsFromRepository() {
        when(deviceRepository.findByHardwareId("ESP32_ROOM_101")).thenReturn(Optional.of(mockDevice));

        Optional<DeviceMetadata> result = deviceMetadataCache.get("ESP32_ROOM_101");

        assertThat(result).isPresent();
        DeviceMetadata meta = result.get();
        assertThat(meta.getId()).isEqualTo("dev-001");
        assertThat(meta.getHardwareId()).isEqualTo("ESP32_ROOM_101");
        assertThat(meta.getRoomId()).isEqualTo("room-101");
        assertThat(meta.getZoneId()).isEqualTo("zone-A");
        assertThat(meta.getDeviceType()).isEqualTo("ESP32_S3");
        assertThat(meta.isActive()).isTrue();

        verify(deviceRepository, times(1)).findByHardwareId("ESP32_ROOM_101");
    }

    @Test
    @DisplayName("get() - Cache hit: Không truy vấn lại DeviceRepository ở lần gọi thứ hai")
    void get_cacheHit_doesNotQueryRepositoryAgain() {
        when(deviceRepository.findByHardwareId("ESP32_ROOM_101")).thenReturn(Optional.of(mockDevice));

        Optional<DeviceMetadata> firstCall = deviceMetadataCache.get("ESP32_ROOM_101");
        Optional<DeviceMetadata> secondCall = deviceMetadataCache.get("ESP32_ROOM_101");

        assertThat(firstCall).isPresent();
        assertThat(secondCall).isPresent();
        assertThat(secondCall.get().getId()).isEqualTo("dev-001");

        // Repository chỉ bị gọi duy nhất 1 lần
        verify(deviceRepository, times(1)).findByHardwareId("ESP32_ROOM_101");
    }

    @Test
    @DisplayName("invalidate() - Xóa entry trong cache -> Lần gọi tiếp theo phải truy vấn lại DB")
    void invalidate_evictsEntryFromCache() {
        when(deviceRepository.findByHardwareId("ESP32_ROOM_101")).thenReturn(Optional.of(mockDevice));

        // Lần 1: Cache miss -> gọi DB
        deviceMetadataCache.get("ESP32_ROOM_101");
        verify(deviceRepository, times(1)).findByHardwareId("ESP32_ROOM_101");

        // Invalidate entry
        deviceMetadataCache.invalidate("ESP32_ROOM_101");

        // Lần 2: Phải gọi DB lại
        deviceMetadataCache.get("ESP32_ROOM_101");
        verify(deviceRepository, times(2)).findByHardwareId("ESP32_ROOM_101");
    }

    @Test
    @DisplayName("put() - Ghi đè hoặc thêm trước metadata -> get() trả về ngay không gọi DB")
    void put_storesDirectlyIntoCache() {
        DeviceMetadata manualMeta = DeviceMetadata.builder()
                .id("dev-custom")
                .hardwareId("ESP32_MANUAL")
                .roomId("room-202")
                .zoneId("zone-B")
                .deviceType("ESP32_S3")
                .isActive(true)
                .build();

        deviceMetadataCache.put("ESP32_MANUAL", manualMeta);

        Optional<DeviceMetadata> result = deviceMetadataCache.get("ESP32_MANUAL");
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo("dev-custom");
        assertThat(result.get().getRoomId()).isEqualTo("room-202");

        verify(deviceRepository, never()).findByHardwareId(any());
    }

    @Test
    @DisplayName("get() - Thiết bị không tồn tại trong DB -> Trả về Optional.empty()")
    void get_nonExistentDevice_returnsEmpty() {
        when(deviceRepository.findByHardwareId("ESP32_NOT_FOUND")).thenReturn(Optional.empty());

        Optional<DeviceMetadata> result = deviceMetadataCache.get("ESP32_NOT_FOUND");
        assertThat(result).isEmpty();

        verify(deviceRepository, times(1)).findByHardwareId("ESP32_NOT_FOUND");
    }

    @Test
    @DisplayName("get() - HardwareId rỗng hoặc null -> Trả về Optional.empty() không gọi DB")
    void get_nullOrBlank_returnsEmptyWithoutDb() {
        assertThat(deviceMetadataCache.get(null)).isEmpty();
        assertThat(deviceMetadataCache.get("")).isEmpty();
        assertThat(deviceMetadataCache.get("   ")).isEmpty();

        verify(deviceRepository, never()).findByHardwareId(any());
    }
}
