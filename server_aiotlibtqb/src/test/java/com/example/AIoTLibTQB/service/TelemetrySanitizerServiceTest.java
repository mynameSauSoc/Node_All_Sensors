package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.mqtt.TelemetryPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TelemetrySanitizerServiceTest {

    TelemetrySanitizerService sanitizer;

    @BeforeEach
    void setUp() {
        sanitizer = new TelemetrySanitizerService();
    }

    @Test
    @DisplayName("sanitize() - Giữ nguyên các giá trị đo hợp lệ")
    void sanitize_validMetrics() {
        TelemetryPayload.TelemetryData data = TelemetryPayload.TelemetryData.builder()
                .acoustics(TelemetryPayload.AcousticsData.builder().noiseAvg(45.5).noisePeak(62.0).build())
                .airQuality(TelemetryPayload.AirQualityData.builder().pm1_0(8.5).pm2_5(15.2).pm4_0(20.0).pm10(25.0).build())
                .environment(TelemetryPayload.EnvironmentData.builder().temperature(24.5).humidity(55.0).lux(450.0).build())
                .build();

        TelemetrySanitizerService.SanitizedMetrics result = sanitizer.sanitize("device-1", data);

        assertThat(result.getAcoustics().getNoiseAvg()).isEqualTo(45.5);
        assertThat(result.getAirQuality().getPm2_5()).isEqualTo(15.2);
        assertThat(result.getEnvironment().getTemperature()).isEqualTo(24.5);
    }

    @Test
    @DisplayName("sanitize() - Lọc bỏ giá trị ngoại lai out-of-bounds")
    void sanitize_outOfBounds() {
        TelemetryPayload.TelemetryData data = TelemetryPayload.TelemetryData.builder()
                .acoustics(TelemetryPayload.AcousticsData.builder().noiseAvg(150.0).noisePeak(180.0).build()) // > 110 & > 130
                .environment(TelemetryPayload.EnvironmentData.builder().temperature(95.0).humidity(150.0).build()) // > 60 & > 100
                .build();

        TelemetrySanitizerService.SanitizedMetrics result = sanitizer.sanitize("device-1", data);

        assertThat(result.getAcoustics()).isNull();
        assertThat(result.getEnvironment()).isNull();
    }

    @Test
    @DisplayName("sanitize() - Áp dụng cơ chế Forward-Fill khi cảm biến bị null tạm thời trong 30s")
    void sanitize_forwardFill() {
        // Lần 1: Có đầy đủ nhiệt ẩm
        TelemetryPayload.TelemetryData data1 = TelemetryPayload.TelemetryData.builder()
                .environment(TelemetryPayload.EnvironmentData.builder().temperature(25.0).humidity(50.0).lux(400.0).build())
                .build();
        sanitizer.sanitize("device-1", data1);

        // Lần 2: SHT30 kẹt I2C trả về null nhiệt ẩm, nhưng có ánh sáng
        TelemetryPayload.TelemetryData data2 = TelemetryPayload.TelemetryData.builder()
                .environment(TelemetryPayload.EnvironmentData.builder().temperature(null).humidity(null).lux(500.0).build())
                .build();
        TelemetrySanitizerService.SanitizedMetrics result2 = sanitizer.sanitize("device-1", data2);

        // Nhiệt độ và độ ẩm được điền từ lần 1 (Forward-fill), Lux lấy giá trị mới
        assertThat(result2.getEnvironment().getTemperature()).isEqualTo(25.0);
        assertThat(result2.getEnvironment().getHumidity()).isEqualTo(50.0);
        assertThat(result2.getEnvironment().getLux()).isEqualTo(500.0);
    }

    @Test
    @DisplayName("sanitize() - Ngừng Forward-Fill và trả về null khi cảm biến chết quá 30s")
    void sanitize_forwardFill_expiresAfter30s() {
        // Lần 1: Có nhiệt ẩm hợp lệ
        TelemetryPayload.TelemetryData data1 = TelemetryPayload.TelemetryData.builder()
                .environment(TelemetryPayload.EnvironmentData.builder().temperature(25.0).humidity(50.0).lux(400.0).build())
                .build();
        sanitizer.sanitize("device-1", data1);

        // Giả lập cảm biến nhiệt độ đã không gửi dữ liệu quá 35s (> 30s)
        sanitizer.putCacheEntry("device-1", "env.temperature",
                new TelemetrySanitizerService.TimestampedValue(25.0, java.time.Instant.now().minusSeconds(35)));

        // Lần 2: Cảm biến nhiệt độ vẫn null
        TelemetryPayload.TelemetryData data2 = TelemetryPayload.TelemetryData.builder()
                .environment(TelemetryPayload.EnvironmentData.builder().temperature(null).humidity(52.0).lux(400.0).build())
                .build();
        TelemetrySanitizerService.SanitizedMetrics result2 = sanitizer.sanitize("device-1", data2);

        // Nhiệt độ không được forward-fill vì đã hết hạn 30s -> null
        assertThat(result2.getEnvironment().getTemperature()).isNull();
        // Độ ẩm có giá trị mới -> 52.0
        assertThat(result2.getEnvironment().getHumidity()).isEqualTo(52.0);
    }

    @Test
    @DisplayName("sanitize() - R2 Peak Acoustic: noisePeak TUYỆT ĐỐI KHÔNG được forward-fill khi null")
    void sanitize_noisePeak_notForwardFilledWhenNull() {
        // Lần 1: Có xung âm thanh noisePeak = 85.0 và noiseAvg = 45.0
        TelemetryPayload.TelemetryData data1 = TelemetryPayload.TelemetryData.builder()
                .acoustics(TelemetryPayload.AcousticsData.builder().noiseAvg(45.0).noisePeak(85.0).build())
                .build();
        TelemetrySanitizerService.SanitizedMetrics result1 = sanitizer.sanitize("device-1", data1);
        assertThat(result1.getAcoustics().getNoiseAvg()).isEqualTo(45.0);
        assertThat(result1.getAcoustics().getNoisePeak()).isEqualTo(85.0);

        // Lần 2: 5 giây sau, noiseAvg bị null (kẹt sensor) và noisePeak là null (không có xung âm mới)
        TelemetryPayload.TelemetryData data2 = TelemetryPayload.TelemetryData.builder()
                .acoustics(TelemetryPayload.AcousticsData.builder().noiseAvg(null).noisePeak(null).build())
                .build();
        TelemetrySanitizerService.SanitizedMetrics result2 = sanitizer.sanitize("device-1", data2);

        // noiseAvg ĐƯỢC forward-fill (45.0), nhưng noisePeak PHẢI LÀ NULL (không duy trì xung giả tạo)
        assertThat(result2.getAcoustics().getNoiseAvg()).isEqualTo(45.0);
        assertThat(result2.getAcoustics().getNoisePeak()).isNull();
    }

    @Test
    @DisplayName("Caffeine Cache - Kiểm tra bộ đệm giới hạn dung lượng và truy xuất key phẳng")
    void caffeineCache_boundedMemoryAndLookup() {
        TelemetryPayload.TelemetryData data = TelemetryPayload.TelemetryData.builder()
                .environment(TelemetryPayload.EnvironmentData.builder().temperature(26.0).build())
                .build();
        sanitizer.sanitize("test-node-101", data);

        // Kiểm tra entry được lưu vào Caffeine Cache với key phẳng "deviceId:fieldKey"
        TelemetrySanitizerService.TimestampedValue cached =
                sanitizer.getCacheEntry("test-node-101", "env.temperature");

        assertThat(cached).isNotNull();
        assertThat(cached.value()).isEqualTo(26.0);
        assertThat(sanitizer.fieldCache.estimatedSize()).isGreaterThanOrEqualTo(1);
    }
}
