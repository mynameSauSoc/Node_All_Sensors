package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Alert;
import com.example.AIoTLibTQB.dto.mqtt.TelemetryPayload;
import com.example.AIoTLibTQB.dto.response.AlertResponse;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.enums.AlertStatus;
import com.example.AIoTLibTQB.enums.AlertType;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.AlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    @Mock
    AlertRepository alertRepository;

    @Mock
    RealtimePublisher realtimePublisher;

    @Mock
    MongoTemplate mongoTemplate;

    MutableClock mutableClock;
    AlertRuleEngine alertRuleEngine;
    AlertServiceImpl alertService;

    static class MutableClock extends Clock {
        private Instant instant;

        public MutableClock(Instant initial) {
            this.instant = initial;
        }

        public void advance(Duration duration) {
            this.instant = this.instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }

    @BeforeEach
    void setUp() {
        mutableClock = new MutableClock(Instant.parse("2026-10-22T10:00:00Z"));
        alertRuleEngine = new AlertRuleEngine(alertRepository, realtimePublisher, mutableClock);
        alertService = new AlertServiceImpl(alertRepository, realtimePublisher, alertRuleEngine, mongoTemplate, mutableClock);
    }

    private TelemetryPayload.TelemetryData createAcousticsData(Double noiseAvg, Double noisePeak) {
        return TelemetryPayload.TelemetryData.builder()
                .acoustics(TelemetryPayload.AcousticsData.builder()
                        .noiseAvg(noiseAvg)
                        .noisePeak(noisePeak)
                        .build())
                .build();
    }

    private TelemetryPayload.TelemetryData createEnvironmentData(Double temp) {
        return TelemetryPayload.TelemetryData.builder()
                .environment(TelemetryPayload.EnvironmentData.builder()
                        .temperature(temp)
                        .build())
                .build();
    }

    private TelemetryPayload.TelemetryData createAirQualityData(Double pm25) {
        return TelemetryPayload.TelemetryData.builder()
                .airQuality(TelemetryPayload.AirQualityData.builder()
                        .pm2_5(pm25)
                        .build())
                .build();
    }

    @Test
    @DisplayName("FSM: Vượt ngưỡng lần đầu -> Chuyển PENDING, KHÔNG ghi MongoDB, KHÔNG publish WebSocket")
    void evaluate_firstBreach_entersPendingWithoutDbOrWebSocket() {
        TelemetryPayload.TelemetryData data = createAcousticsData(70.0, null); // 70 > 65

        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", data);

        assertThat(alertRuleEngine.getFsmMap()).containsKey("dev-1:NOISE_AVG");
        AlertRuleEngine.FsmState state = alertRuleEngine.getFsmMap().get("dev-1:NOISE_AVG");
        assertThat(state.getStatus()).isEqualTo(AlertStatus.PENDING);
        assertThat(state.getPendingSince()).isEqualTo(mutableClock.instant());

        // Tuyệt đối KHÔNG chạm DB hoặc WebSocket ở trạng thái PENDING
        verify(alertRepository, never()).save(any());
        verify(realtimePublisher, never()).publishAlert(any());
    }

    @Test
    @DisplayName("FSM: Vượt ngưỡng nhưng hạ xuống an toàn trước 30s -> Hủy PENDING, lọc báo động giả, KHÔNG ghi DB")
    void evaluate_pendingRecoversBefore30s_cancelsPendingWithoutDb() {
        TelemetryPayload.TelemetryData breachData = createAcousticsData(70.0, null);
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", breachData);
        assertThat(alertRuleEngine.getFsmMap()).containsKey("dev-1:NOISE_AVG");

        // Tiến thời gian 15s (chưa đủ 30s)
        mutableClock.advance(Duration.ofSeconds(15));
        TelemetryPayload.TelemetryData safeData = createAcousticsData(50.0, null);
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", safeData);

        // State bị xóa khỏi map (trở về bình thường)
        assertThat(alertRuleEngine.getFsmMap()).doesNotContainKey("dev-1:NOISE_AVG");

        verify(alertRepository, never()).save(any());
        verify(realtimePublisher, never()).publishAlert(any());
    }

    @Test
    @DisplayName("FSM: Vượt ngưỡng liên tục >= 30s -> Chuyển FIRING, lưu MongoDB và publish STOMP")
    void evaluate_continuousBreach30s_transitionsToFiring() {
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            a.setId("alert-001");
            return a;
        });

        // t = 0s: Vượt ngưỡng -> PENDING
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createAcousticsData(68.0, null));

        // t = 20s: Vẫn vượt ngưỡng -> Vẫn PENDING
        mutableClock.advance(Duration.ofSeconds(20));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createAcousticsData(69.0, null));
        verify(alertRepository, never()).save(any());

        // t = 30s: Đủ 30s liên tục -> Chuyển FIRING
        mutableClock.advance(Duration.ofSeconds(10));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createAcousticsData(71.0, null));

        ArgumentCaptor<Alert> alertCaptor = ArgumentCaptor.forClass(Alert.class);
        verify(alertRepository, times(1)).save(alertCaptor.capture());
        Alert saved = alertCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(AlertStatus.FIRING);
        assertThat(saved.getType()).isEqualTo(AlertType.NOISE_EXCEEDED);
        assertThat(saved.getDeviceId()).isEqualTo("dev-1");
        assertThat(saved.getRoomId()).isEqualTo("room-1");
        assertThat(saved.getCurrentValue()).isEqualTo(71.0);
        assertThat(saved.getThreshold()).isEqualTo(65.0);

        verify(realtimePublisher, times(1)).publishAlert(any(AlertResponse.class));
    }

    @Test
    @DisplayName("FSM: Vòng đời hoàn chỉnh PENDING (30s) -> FIRING -> ACKNOWLEDGED -> RESOLVED (60s hysteresis)")
    void evaluate_fullLifecycle_pendingToFiringToAckToResolved() {
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            if (a.getId() == null) a.setId("alert-123");
            return a;
        });

        // 1. t = 0s: Nhiệt độ 35°C > 32°C -> PENDING
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createEnvironmentData(35.0));

        // 2. t = 30s: Chuyển FIRING
        mutableClock.advance(Duration.ofSeconds(30));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createEnvironmentData(35.5));
        verify(alertRepository, times(1)).save(any(Alert.class));
        verify(realtimePublisher, times(1)).publishAlert(any(AlertResponse.class));

        // Mock findById cho acknowledge
        Alert firingAlert = Alert.builder()
                .id("alert-123")
                .deviceId("dev-1")
                .roomId("room-1")
                .type(AlertType.AIR_UNHEALTHY)
                .status(AlertStatus.FIRING)
                .startedAt(mutableClock.instant())
                .build();
        when(alertRepository.findById("alert-123")).thenReturn(Optional.of(firingAlert));

        // 3. Thủ thư xác nhận ACKNOWLEDGE
        mutableClock.advance(Duration.ofSeconds(15));
        AlertResponse ackResponse = alertService.acknowledgeAlert("alert-123", "librarian_john");
        assertThat(ackResponse.getStatus()).isEqualTo(AlertStatus.ACKNOWLEDGED);
        assertThat(ackResponse.getAcknowledgedBy()).isEqualTo("librarian_john");
        verify(alertRepository, times(2)).save(any(Alert.class));

        // 4. Nhiệt độ hạ xuống an toàn 28°C (< 32°C) -> Bắt đầu 60s hysteresis
        mutableClock.advance(Duration.ofSeconds(10));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createEnvironmentData(28.0));
        // Chưa đủ 60s -> Vẫn ACKNOWLEDGED, không ghi DB thêm
        verify(alertRepository, times(2)).save(any(Alert.class));

        // 5. Sau 30s an toàn (tổng cộng 30s/60s), nhiệt độ lại tăng vọt lên 34°C -> Reset recovery timer
        mutableClock.advance(Duration.ofSeconds(30));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createEnvironmentData(34.0));
        // Recovery timer bị reset

        // 6. Nhiệt độ lại hạ xuống 29°C -> Bắt đầu tính lại 60s
        mutableClock.advance(Duration.ofSeconds(5));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createEnvironmentData(29.0));

        // 7. Sau 60s liên tục an toàn -> Chuyển RESOLVED
        mutableClock.advance(Duration.ofSeconds(60));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createEnvironmentData(29.0));

        // Lần save thứ 3: Chuyển sang RESOLVED
        verify(alertRepository, times(3)).save(any(Alert.class));
        assertThat(firingAlert.getStatus()).isEqualTo(AlertStatus.RESOLVED);
        assertThat(firingAlert.getResolvedAt()).isNotNull();

        // Đã gỡ khỏi in-memory FSM
        assertThat(alertRuleEngine.getFsmMap()).doesNotContainKey("dev-1:TEMPERATURE");
    }

    @Test
    @DisplayName("Xử lý an toàn noisePeak null: Không gây NullPointerException và không kích hoạt cảnh báo sai")
    void evaluate_noisePeakNull_handledSafelyWithoutNpeOrFalseAlarm() {
        TelemetryPayload.TelemetryData data = createAcousticsData(40.0, null); // noiseAvg = 40 (an toàn), noisePeak = null

        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", data);

        assertThat(alertRuleEngine.getFsmMap()).isEmpty();
        verify(alertRepository, never()).save(any());
        verify(realtimePublisher, never()).publishAlert(any());
    }

    @Test
    @DisplayName("noisePeak > 75 dBA kích hoạt cảnh báo NOISE_EXCEEDED sau 30s")
    void evaluate_noisePeakExceeded_triggersNoiseExceededAlert() {
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            a.setId("alert-peak");
            return a;
        });

        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createAcousticsData(50.0, 80.0));
        assertThat(alertRuleEngine.getFsmMap()).containsKey("dev-1:NOISE_PEAK");

        mutableClock.advance(Duration.ofSeconds(30));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createAcousticsData(50.0, 82.0));

        ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
        verify(alertRepository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo(AlertType.NOISE_EXCEEDED);
        assertThat(captor.getValue().getCurrentValue()).isEqualTo(82.0);
        assertThat(captor.getValue().getThreshold()).isEqualTo(75.0);
    }

    @Test
    @DisplayName("pm2.5 > 50 µg/m³ kích hoạt cảnh báo AIR_UNHEALTHY")
    void evaluate_pm25Exceeded_triggersAirUnhealthyAlert() {
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            a.setId("alert-pm");
            return a;
        });

        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createAirQualityData(65.0));
        mutableClock.advance(Duration.ofSeconds(30));
        alertService.evaluateTelemetry("dev-1", "HW-1", "room-1", createAirQualityData(65.0));

        ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
        verify(alertRepository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo(AlertType.AIR_UNHEALTHY);
        assertThat(captor.getValue().getCurrentValue()).isEqualTo(65.0);
        assertThat(captor.getValue().getThreshold()).isEqualTo(50.0);
    }

    @Test
    @DisplayName("getUnreadCount() - Đếm chính xác số lượng cảnh báo FIRING")
    void getUnreadCount_returnsActiveFiringCount() {
        when(mongoTemplate.count(any(Query.class), eq(Alert.class))).thenReturn(5L);

        long count = alertService.getUnreadCount();
        assertThat(count).isEqualTo(5L);
    }

    @Test
    @DisplayName("getAlerts() - Phân trang và lọc theo roomId, type, status")
    void getAlerts_paginatedAndFiltered() {
        Alert alert1 = Alert.builder().id("a1").roomId("room-1").type(AlertType.NOISE_EXCEEDED).status(AlertStatus.FIRING).build();
        Alert alert2 = Alert.builder().id("a2").roomId("room-1").type(AlertType.NOISE_EXCEEDED).status(AlertStatus.ACKNOWLEDGED).build();

        when(mongoTemplate.count(any(Query.class), eq(Alert.class))).thenReturn(2L);
        when(mongoTemplate.find(any(Query.class), eq(Alert.class))).thenReturn(List.of(alert1, alert2));

        PageResponse<AlertResponse> response = alertService.getAlerts("room-1", AlertType.NOISE_EXCEEDED, null, PageRequest.of(0, 10));

        assertThat(response.getContent()).hasSize(2);
        assertThat(response.getTotalElements()).isEqualTo(2);
        assertThat(response.getPage()).isEqualTo(0);
        assertThat(response.getSize()).isEqualTo(10);
    }

    @Test
    @DisplayName("acknowledgeAlert() - Ném ALERT_NOT_EXISTED nếu ID không tồn tại")
    void acknowledgeAlert_notFound_throwsException() {
        when(alertRepository.findById("invalid-id")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> alertService.acknowledgeAlert("invalid-id", "user1"))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ALERT_NOT_EXISTED);
    }

    @Test
    @DisplayName("resolveAlert() - Ném ALERT_NOT_EXISTED nếu ID không tồn tại")
    void resolveAlert_notFound_throwsException() {
        when(alertRepository.findById("invalid-id")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> alertService.resolveAlert("invalid-id", "user1"))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ALERT_NOT_EXISTED);
    }

    @Test
    @DisplayName("triggerDeviceOfflineAlert() & resolveDeviceOfflineAlert() - Quản lý sự cố offline thiết bị")
    void deviceOfflineAlert_triggerAndResolve() {
        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            if (a.getId() == null) a.setId("alert-offline");
            return a;
        });

        alertService.triggerDeviceOfflineAlert("dev-offline", "HW-OFFLINE", "room-1");
        verify(alertRepository, times(1)).save(any(Alert.class));
        verify(realtimePublisher, times(1)).publishAlert(any());

        Alert offlineAlert = Alert.builder()
                .id("alert-offline")
                .deviceId("dev-offline")
                .hardwareId("HW-OFFLINE")
                .type(AlertType.DEVICE_OFFLINE)
                .status(AlertStatus.FIRING)
                .build();
        when(alertRepository.findById("alert-offline")).thenReturn(Optional.of(offlineAlert));

        alertService.resolveDeviceOfflineAlert("HW-OFFLINE");
        verify(alertRepository, times(2)).save(any(Alert.class));
        assertThat(offlineAlert.getStatus()).isEqualTo(AlertStatus.RESOLVED);
    }
}
