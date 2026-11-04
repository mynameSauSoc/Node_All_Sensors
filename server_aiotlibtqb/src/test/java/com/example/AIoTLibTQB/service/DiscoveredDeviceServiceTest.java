package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.response.DiscoveredDeviceResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DiscoveredDeviceServiceTest {

    DiscoveredDeviceService service;

    @BeforeEach
    void setUp() {
        service = new DiscoveredDeviceService();
    }

    @Test
    @DisplayName("recordDiscovered() - Ghi nhận thiết bị mới lần đầu")
    void recordDiscovered_newDevice() {
        service.recordDiscovered("ESP32_NEW_001", -65);

        List<DiscoveredDeviceResponse> list = service.getDiscoveredDevices();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getHardwareId()).isEqualTo("ESP32_NEW_001");
        assertThat(list.get(0).getMessageCount()).isEqualTo(1L);
        assertThat(list.get(0).getLastWifiRssi()).isEqualTo(-65);
    }

    @Test
    @DisplayName("recordDiscovered() - Tăng số lượng tin và cập nhật RSSI khi nhận nhiều lần")
    void recordDiscovered_multiple() {
        service.recordDiscovered("ESP32_NEW_001", -70);
        service.recordDiscovered("ESP32_NEW_001", -60);

        List<DiscoveredDeviceResponse> list = service.getDiscoveredDevices();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getMessageCount()).isEqualTo(2L);
        assertThat(list.get(0).getLastWifiRssi()).isEqualTo(-60);
    }

    @Test
    @DisplayName("removeDiscovered() - Gỡ bỏ thiết bị khi đã được đăng ký phê duyệt")
    void removeDiscovered() {
        service.recordDiscovered("ESP32_NEW_001", -65);
        assertThat(service.getDiscoveredDevices()).hasSize(1);

        service.removeDiscovered("ESP32_NEW_001");
        assertThat(service.getDiscoveredDevices()).isEmpty();
    }
}
