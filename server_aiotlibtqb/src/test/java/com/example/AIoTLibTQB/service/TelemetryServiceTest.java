package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.AcousticMetrics;
import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.document.TelemetryMetadata;
import com.example.AIoTLibTQB.document.TelemetryRecord;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.response.BucketDataPoint;
import com.example.AIoTLibTQB.dto.response.TelemetryBucketResponse;
import com.example.AIoTLibTQB.dto.response.TelemetryResponse;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import com.example.AIoTLibTQB.repository.TelemetryRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TelemetryServiceTest {

    @Mock TelemetryRepository telemetryRepository;
    @Mock DeviceRepository deviceRepository;
    @Mock UserRepository userRepository;
    @Mock MongoTemplate mongoTemplate;

    @InjectMocks TelemetryService telemetryService;

    @Test
    @DisplayName("getLatestByDeviceId() - Trả về bản ghi mới nhất của thiết bị")
    void getLatestByDeviceId() {
        TelemetryRecord record = TelemetryRecord.builder()
                .id("rec-1")
                .timestamp(Instant.now())
                .metadata(TelemetryMetadata.builder().deviceId("dev-1").roomId("room-1").build())
                .acoustics(AcousticMetrics.builder().noiseAvg(45.0).build())
                .build();

        when(telemetryRepository.findTopByMetadataDeviceIdOrderByTimestampDesc("dev-1"))
                .thenReturn(Optional.of(record));

        TelemetryResponse res = telemetryService.getLatestByDeviceId("dev-1");
        assertThat(res).isNotNull();
        assertThat(res.getId()).isEqualTo("rec-1");
        assertThat(res.getAcoustics().getNoiseAvg()).isEqualTo(45.0);
    }

    @Test
    @DisplayName("getHistoryByRoomId() - Trả về danh sách chuỗi thời gian trong phòng")
    void getHistoryByRoomId() {
        TelemetryRecord record1 = TelemetryRecord.builder().id("rec-1").timestamp(Instant.now()).build();
        TelemetryRecord record2 = TelemetryRecord.builder().id("rec-2").timestamp(Instant.now().minusSeconds(10)).build();

        when(telemetryRepository.findByMetadataRoomIdAndTimestampBetweenOrderByTimestampDesc(eq("room-1"), any(), any()))
                .thenReturn(List.of(record1, record2));

        List<TelemetryResponse> list = telemetryService.getHistoryByRoomId("room-1", null, null);
        assertThat(list).hasSize(2);
    }

    @Test
    @DisplayName("getLatestByDeviceId() - ZONE_MANAGER bị từ chối khi thiết bị không thuộc assignedZones (C1)")
    void getLatestByDeviceId_zoneManagerDenied() {
        Authentication auth = mock(Authentication.class);
        SecurityContext ctx = mock(SecurityContext.class);
        doReturn(List.of(new SimpleGrantedAuthority("ZONE_MANAGER"))).when(auth).getAuthorities();
        when(auth.getName()).thenReturn("zm_user");
        when(ctx.getAuthentication()).thenReturn(auth);

        Device device = Device.builder().id("dev-1").zoneId("ZONE_SECRET").build();
        User manager = User.builder().username("zm_user").assignedZones(Set.of("ZONE_PUBLIC")).build();

        try (MockedStatic<SecurityContextHolder> holder = mockStatic(SecurityContextHolder.class)) {
            holder.when(SecurityContextHolder::getContext).thenReturn(ctx);
            when(deviceRepository.findById("dev-1")).thenReturn(Optional.of(device));
            when(userRepository.findByUsername("zm_user")).thenReturn(Optional.of(manager));

            assertThatThrownBy(() -> telemetryService.getLatestByDeviceId("dev-1"))
                    .isInstanceOf(AppException.class)
                    .extracting(e -> ((AppException) e).getErrorCode())
                    .isEqualTo(ErrorCode.ZONE_ACCESS_DENIED);
        }
    }

    @Test
    @DisplayName("Interval mapping - 15m, 1h, 1d ánh xạ chính xác sang unit, binSize và intervalSeconds")
    void testIntervalMapping_validIntervals() {
        TelemetryService.IntervalConfig config15m = telemetryService.resolveIntervalConfig("15m");
        assertThat(config15m.unit()).isEqualTo("minute");
        assertThat(config15m.binSize()).isEqualTo(15);
        assertThat(config15m.intervalSeconds()).isEqualTo(900L);

        TelemetryService.IntervalConfig config1h = telemetryService.resolveIntervalConfig("1h");
        assertThat(config1h.unit()).isEqualTo("hour");
        assertThat(config1h.binSize()).isEqualTo(1);
        assertThat(config1h.intervalSeconds()).isEqualTo(3600L);

        TelemetryService.IntervalConfig config1d = telemetryService.resolveIntervalConfig("1d");
        assertThat(config1d.unit()).isEqualTo("day");
        assertThat(config1d.binSize()).isEqualTo(1);
        assertThat(config1d.intervalSeconds()).isEqualTo(86400L);

        // Case-insensitivity check
        assertThat(telemetryService.resolveIntervalConfig("15M")).isEqualTo(config15m);
        assertThat(telemetryService.resolveIntervalConfig(" 1H ")).isEqualTo(config1h);
        assertThat(telemetryService.resolveIntervalConfig("1D")).isEqualTo(config1d);
    }

    @Test
    @DisplayName("Interval mapping - Pipeline aggregation chứa đúng $dateTrunc cho 15m, 1h, 1d")
    void testIntervalMapping_buildBucketAggregation() {
        Instant start = Instant.parse("2026-10-01T00:00:00Z");
        Instant end = Instant.parse("2026-10-02T00:00:00Z");

        Aggregation agg15m = telemetryService.buildBucketAggregation("room-1", telemetryService.resolveIntervalConfig("15m"), start, end);
        Document doc15m = agg15m.toDocument("telemetry_records", Aggregation.DEFAULT_CONTEXT);
        assertThat(doc15m.toString()).contains("$dateTrunc");
        assertThat(doc15m.toString()).contains("minute");
        assertThat(doc15m.toString()).contains("15");

        Aggregation agg1h = telemetryService.buildBucketAggregation("room-1", telemetryService.resolveIntervalConfig("1h"), start, end);
        Document doc1h = agg1h.toDocument("telemetry_records", Aggregation.DEFAULT_CONTEXT);
        assertThat(doc1h.toString()).contains("hour");
        assertThat(doc1h.toString()).contains("1");

        Aggregation agg1d = telemetryService.buildBucketAggregation("room-1", telemetryService.resolveIntervalConfig("1d"), start, end);
        Document doc1d = agg1d.toDocument("telemetry_records", Aggregation.DEFAULT_CONTEXT);
        assertThat(doc1d.toString()).contains("day");
        assertThat(doc1d.toString()).contains("1");
    }

    @Test
    @DisplayName("Interval mapping - Bị từ chối khi interval không hợp lệ")
    void testIntervalMapping_invalidInterval_throwsException() {
        assertThatThrownBy(() -> telemetryService.resolveIntervalConfig("30m"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_INTERVAL);

        assertThatThrownBy(() -> telemetryService.resolveIntervalConfig("2h"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_INTERVAL);

        assertThatThrownBy(() -> telemetryService.resolveIntervalConfig(null))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_INTERVAL);

        assertThatThrownBy(() -> telemetryService.resolveIntervalConfig(" "))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_INTERVAL);
    }

    @Test
    @DisplayName("Time range validation - Bị từ chối khi start >= end hoặc start/end null (INVALID_TIME_RANGE)")
    void testTimeRangeValidation_startGreaterOrEqualEnd_throwsException() {
        Instant now = Instant.parse("2026-10-22T10:00:00Z");

        // start > end
        assertThatThrownBy(() -> telemetryService.getBucketsByRoomId("room-1", "1h", now, now.minusSeconds(3600)))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_TIME_RANGE);

        // start == end
        assertThatThrownBy(() -> telemetryService.getBucketsByRoomId("room-1", "1h", now, now))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_TIME_RANGE);

        // start == null
        assertThatThrownBy(() -> telemetryService.getBucketsByRoomId("room-1", "1h", null, now))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_TIME_RANGE);

        // end == null
        assertThatThrownBy(() -> telemetryService.getBucketsByRoomId("room-1", "1h", now, null))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_TIME_RANGE);
    }

    @Test
    @DisplayName("Bucket count validation - Bị từ chối khi số lượng bucket vượt quá 1000 (TOO_MANY_BUCKETS)")
    void testBucketCountValidation_exceeds1000_throwsException() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");

        // 1h interval: 1001 hours > 1000 buckets
        Instant end1001Hours = start.plus(1001, ChronoUnit.HOURS);
        assertThatThrownBy(() -> telemetryService.getBucketsByRoomId("room-1", "1h", start, end1001Hours))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.TOO_MANY_BUCKETS);

        // 15m interval: 1001 * 15 minutes > 1000 buckets
        Instant end1001_15m = start.plus(1001 * 15, ChronoUnit.MINUTES);
        assertThatThrownBy(() -> telemetryService.getBucketsByRoomId("room-1", "15m", start, end1001_15m))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.TOO_MANY_BUCKETS);

        // 1d interval: 1001 days > 1000 buckets
        Instant end1001Days = start.plus(1001, ChronoUnit.DAYS);
        assertThatThrownBy(() -> telemetryService.getBucketsByRoomId("room-1", "1d", start, end1001Days))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.TOO_MANY_BUCKETS);
    }

    @Test
    @DisplayName("Rounding - Làm tròn chính xác đến 2 chữ số thập phân (HALF_UP)")
    void testRounding_to2DecimalPlaces() {
        assertThat(telemetryService.roundTo2Decimals(24.2345)).isEqualTo(24.23);
        assertThat(telemetryService.roundTo2Decimals(24.235)).isEqualTo(24.24);
        assertThat(telemetryService.roundTo2Decimals(24.236)).isEqualTo(24.24);
        assertThat(telemetryService.roundTo2Decimals(88.5)).isEqualTo(88.5);
        assertThat(telemetryService.roundTo2Decimals(12.3456789)).isEqualTo(12.35);
        assertThat(telemetryService.roundTo2Decimals(null)).isNull();
        assertThat(telemetryService.roundTo2Decimals(Double.NaN)).isNull();
        assertThat(telemetryService.roundTo2Decimals(Double.POSITIVE_INFINITY)).isNull();
    }

    @Test
    @DisplayName("getBucketsByRoomId() - Thực thi aggregation thành công, trả về danh sách điểm gom cụm đã làm tròn")
    void testGetBucketsByRoomId_success() {
        Instant start = Instant.parse("2026-10-21T00:00:00Z");
        Instant end = start.plus(24, ChronoUnit.HOURS);
        Date bucketTime = Date.from(Instant.parse("2026-10-21T08:00:00Z"));

        Document aggDoc = new Document("_id", bucketTime)
                .append("sampleCount", 120L)
                .append("comfortScoreAvg", 88.523)
                .append("comfortScoreMin", 72.0)
                .append("comfortScoreMax", 95.126)
                .append("tempAvg", 24.214)
                .append("tempMin", 23.8)
                .append("tempMax", 24.9)
                .append("humidityAvg", 52.148)
                .append("humidityMin", 48.2)
                .append("humidityMax", 55.6)
                .append("noiseAvg", 38.456)
                .append("noiseMin", 32.1)
                .append("noiseMax", 64.2)
                .append("pm25Avg", 12.341)
                .append("pm25Min", 8.0)
                .append("pm25Max", 18.5)
                .append("luxAvg", 345.678)
                .append("luxMin", 300.0)
                .append("luxMax", 400.0);

        @SuppressWarnings("unchecked")
        AggregationResults<Document> mockResults = mock(AggregationResults.class);
        when(mockResults.getMappedResults()).thenReturn(List.of(aggDoc));
        when(mongoTemplate.aggregate(any(Aggregation.class), eq("telemetry_records"), eq(Document.class)))
                .thenReturn(mockResults);

        TelemetryBucketResponse response = telemetryService.getBucketsByRoomId("room-1", "1h", start, end);

        assertThat(response).isNotNull();
        assertThat(response.getRoomId()).isEqualTo("room-1");
        assertThat(response.getInterval()).isEqualTo("1h");
        assertThat(response.getDataPoints()).hasSize(1);
        assertThat(response.getBuckets()).hasSize(1); // Alias method

        BucketDataPoint point = response.getDataPoints().get(0);
        assertThat(point.getBucketTime()).isEqualTo(Instant.parse("2026-10-21T08:00:00Z"));
        assertThat(point.getTimestamp()).isEqualTo(Instant.parse("2026-10-21T08:00:00Z")); // Alias
        assertThat(point.getSampleCount()).isEqualTo(120L);

        // Verification of 2-decimal rounding
        assertThat(point.getComfortScoreAvg()).isEqualTo(88.52);
        assertThat(point.getComfortScoreMin()).isEqualTo(72.0);
        assertThat(point.getComfortScoreMax()).isEqualTo(95.13);

        assertThat(point.getTempAvg()).isEqualTo(24.21);
        assertThat(point.getTemperatureAvg()).isEqualTo(24.21); // Alias
        assertThat(point.getTempMin()).isEqualTo(23.8);
        assertThat(point.getTempMax()).isEqualTo(24.9);

        assertThat(point.getHumidityAvg()).isEqualTo(52.15);
        assertThat(point.getHumidityMin()).isEqualTo(48.2);
        assertThat(point.getHumidityMax()).isEqualTo(55.6);

        assertThat(point.getNoiseAvg()).isEqualTo(38.46);
        assertThat(point.getNoiseMin()).isEqualTo(32.1);
        assertThat(point.getNoiseMax()).isEqualTo(64.2);

        assertThat(point.getPm25Avg()).isEqualTo(12.34);
        assertThat(point.getPm2_5Avg()).isEqualTo(12.34); // Alias
        assertThat(point.getPm25Min()).isEqualTo(8.0);
        assertThat(point.getPm25Max()).isEqualTo(18.5);

        assertThat(point.getLuxAvg()).isEqualTo(345.68);
        assertThat(point.getLuxMin()).isEqualTo(300.0);
        assertThat(point.getLuxMax()).isEqualTo(400.0);
    }
}
