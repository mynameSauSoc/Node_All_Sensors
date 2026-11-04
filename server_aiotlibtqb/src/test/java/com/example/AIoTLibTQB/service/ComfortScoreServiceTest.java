package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.*;
import com.example.AIoTLibTQB.enums.RoomType;
import com.example.AIoTLibTQB.repository.RoomRepository;
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
class ComfortScoreServiceTest {

    @Mock
    RoomRepository roomRepository;

    @InjectMocks
    ComfortScoreService comfortScoreService;

    @BeforeEach
    void setUp() {
        comfortScoreService.roomTypeCache.invalidateAll();
    }

    // =========================================================================
    // 1. STUDY_ROOM (Phòng đọc sách & tự học)
    // =========================================================================

    @Test
    @DisplayName("STUDY_ROOM - Môi trường đọc sách hoàn hảo -> 100.0 điểm Platinum")
    void studyRoom_idealEnvironment_returns100Platinum() {
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                AcousticMetrics.builder().noiseAvg(30.0).noisePeak(40.0).build(),
                AirQualityMetrics.builder().pm2_5(8.0).build(),
                EnvironmentMetrics.builder().temperature(24.5).humidity(50.0).lux(500.0).build()
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.STUDY_ROOM);

        assertThat(score).isNotNull();
        assertThat(score.getOverall()).isEqualTo(100.0);
        assertThat(score.getGrade()).isEqualTo("Platinum");
        assertThat(score.getAcousticScore()).isEqualTo(100.0);
        assertThat(score.getAirScore()).isEqualTo(100.0);
        assertThat(score.getThermalScore()).isEqualTo(100.0);
        assertThat(score.getLightScore()).isEqualTo(100.0);
    }

    @Test
    @DisplayName("STUDY_ROOM - Thảm họa tiếng ồn 85 dBA -> Liebig Gating kéo sập LCS xuống Poor")
    void studyRoom_noiseDisaster_activatesLiebigBottleneck() {
        // Tiếng ồn 85 dBA (0 điểm), các chỉ số khác hoàn hảo 100 điểm
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                AcousticMetrics.builder().noiseAvg(85.0).build(),
                AirQualityMetrics.builder().pm2_5(5.0).build(),
                EnvironmentMetrics.builder().temperature(24.0).humidity(50.0).lux(500.0).build()
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.STUDY_ROOM);

        assertThat(score).isNotNull();
        assertThat(score.getAcousticScore()).isEqualTo(0.0);
        // S_weighted = 0.35 * 0 + 0.30 * 100 + 0.20 * 100 + 0.15 * 100 = 65.0
        // S_min = 0.0 -> LCS = 65.0 * [0.30 + 0.70 * 0] = 19.5
        assertThat(score.getOverall()).isEqualTo(19.5);
        assertThat(score.getGrade()).isEqualTo("Poor");
    }

    @Test
    @DisplayName("STUDY_ROOM - Phạt xung âm tức thời (Peak Acoustic Penalty) khi Lpeak > 70 dBA")
    void studyRoom_peakAcousticPenalty_appliedCorrectly() {
        // Lavg = 35.0 (100đ cơ sở), Lpeak = 85.0 (>70 -> phạt 15đ) -> 85đ
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                AcousticMetrics.builder().noiseAvg(35.0).noisePeak(85.0).build(),
                null, null
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.STUDY_ROOM);

        assertThat(score).isNotNull();
        assertThat(score.getAcousticScore()).isEqualTo(85.0);
        assertThat(score.getOverall()).isEqualTo(85.0);
        assertThat(score.getGrade()).isEqualTo("Gold");
    }

    // =========================================================================
    // 2. BOOK_STORAGE (Kho lưu trữ & bảo quản sách)
    // =========================================================================

    @Test
    @DisplayName("BOOK_STORAGE - Môi trường bảo tồn sách hoàn hảo -> 100.0 điểm Platinum")
    void bookStorage_idealConservation_returns100Platinum() {
        // ISO 11799: 20°C, 50% RH, 50 Lux (tối), PM2.5 = 6.0, ồn 55 dBA (không ảnh hưởng sách)
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                AcousticMetrics.builder().noiseAvg(55.0).build(),
                AirQualityMetrics.builder().pm2_5(6.0).build(),
                EnvironmentMetrics.builder().temperature(20.0).humidity(50.0).lux(50.0).build()
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.BOOK_STORAGE);

        assertThat(score).isNotNull();
        assertThat(score.getOverall()).isEqualTo(100.0);
        assertThat(score.getGrade()).isEqualTo("Platinum");
        assertThat(score.getThermalScore()).isEqualTo(100.0);
        assertThat(score.getLightScore()).isEqualTo(100.0);
    }

    @Test
    @DisplayName("BOOK_STORAGE - Ẩm cao 70% (nguy cơ nấm mốc) & Quá nhiệt 28°C -> Điểm nhiệt ẩm sụp đổ")
    void bookStorage_highHumidityAndTemp_severelyPenalized() {
        // RH = 70% (>55% phạt 6đ/% -> 100 - 15*6 = 10đ)
        // Temp = 28°C (>22°C phạt 12đ/°C -> 100 - 6*12 = 28đ)
        // S_thermal = 0.5 * 28 + 0.5 * 10 = 19.0
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                null, null,
                EnvironmentMetrics.builder().temperature(28.0).humidity(70.0).build()
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.BOOK_STORAGE);

        assertThat(score).isNotNull();
        assertThat(score.getThermalScore()).isEqualTo(19.0);
        assertThat(score.getOverall()).isEqualTo(19.0);
        assertThat(score.getGrade()).isEqualTo("Poor");
    }

    @Test
    @DisplayName("BOOK_STORAGE - Ánh sáng quá sáng 600 Lux -> Phạt về 0 điểm vì phá hủy tài liệu")
    void bookStorage_brightLight_severelyPenalized() {
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                null, null,
                EnvironmentMetrics.builder().lux(600.0).build()
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.BOOK_STORAGE);

        assertThat(score).isNotNull();
        assertThat(score.getLightScore()).isEqualTo(0.0);
        assertThat(score.getOverall()).isEqualTo(0.0);
        assertThat(score.getGrade()).isEqualTo("Poor");
    }

    // =========================================================================
    // 3. CIRCULATION_HALL (Phòng / Sảnh mượn trả sách)
    // =========================================================================

    @Test
    @DisplayName("CIRCULATION_HALL - Tiếng ồn quầy 65 dBA -> Vẫn đạt 80.0 điểm âm thanh (không bị coi là thảm họa)")
    void circulationHall_counterNoise_acceptedNormally() {
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                AcousticMetrics.builder().noiseAvg(65.0).build(),
                null, null
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.CIRCULATION_HALL);

        assertThat(score).isNotNull();
        assertThat(score.getAcousticScore()).isEqualTo(80.0);
        assertThat(score.getOverall()).isEqualTo(80.0);
        assertThat(score.getGrade()).isEqualTo("Gold");
    }

    @Test
    @DisplayName("CIRCULATION_HALL - Môi trường sảnh tiêu chuẩn -> Platinum")
    void circulationHall_idealServiceArea_returnsPlatinum() {
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                AcousticMetrics.builder().noiseAvg(48.0).build(),
                AirQualityMetrics.builder().pm2_5(14.0).build(),
                EnvironmentMetrics.builder().temperature(25.0).humidity(55.0).lux(400.0).build()
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.CIRCULATION_HALL);

        assertThat(score).isNotNull();
        assertThat(score.getOverall()).isEqualTo(100.0);
        assertThat(score.getGrade()).isEqualTo("Platinum");
    }

    // =========================================================================
    // 4. Dynamic Re-weighting & Khuyết Thiếu Cảm Biến
    // =========================================================================

    @Test
    @DisplayName("Dynamic Re-weighting - Khuyết cảm biến PM2.5 và Ánh sáng -> Tái phân bổ trọng số chuẩn xác")
    void dynamicReweighting_missingSensors_reweightsAccurately() {
        // STUDY_ROOM base: w_Acoustic = 0.35, w_Thermal = 0.20 (Tổng = 0.55)
        // Normalized: w'_A = 0.35/0.55 ≈ 0.6364, w'_T = 0.20/0.55 ≈ 0.3636
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(
                AcousticMetrics.builder().noiseAvg(30.0).build(), // 100đ
                null, // Không có PM2.5
                EnvironmentMetrics.builder().temperature(24.5).humidity(50.0).build() // 100đ
        );

        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.STUDY_ROOM);

        assertThat(score).isNotNull();
        assertThat(score.getAcousticScore()).isEqualTo(100.0);
        assertThat(score.getThermalScore()).isEqualTo(100.0);
        assertThat(score.getAirScore()).isNull();
        assertThat(score.getLightScore()).isNull();
        assertThat(score.getOverall()).isEqualTo(100.0);
        assertThat(score.getGrade()).isEqualTo("Platinum");
    }

    @Test
    @DisplayName("calculate() - Bản tin không chứa chỉ số cảm biến hợp lệ nào -> Trả về null")
    void calculate_allMetricsNull_returnsNull() {
        var metrics = new TelemetrySanitizerService.SanitizedMetrics(null, null, null);
        ComfortScoreRecord score = comfortScoreService.calculate(metrics, RoomType.STUDY_ROOM);
        assertThat(score).isNull();
    }

    @Test
    @DisplayName("calculate() - Payload null -> Trả về null an toàn")
    void calculate_metricsNull_returnsNull() {
        ComfortScoreRecord score = comfortScoreService.calculate(null, RoomType.STUDY_ROOM);
        assertThat(score).isNull();
    }

    // =========================================================================
    // 5. Cache & RoomType Resolution
    // =========================================================================

    @Test
    @DisplayName("resolveRoomType() - Tra cứu từ CSDL và lưu cache RAM")
    void resolveRoomType_cachedCorrectly() {
        Room mockRoom = Room.builder().id("room-storage").type(RoomType.BOOK_STORAGE).build();
        when(roomRepository.findById("room-storage")).thenReturn(Optional.of(mockRoom));

        // Lần 1: Gọi DB
        RoomType type1 = comfortScoreService.resolveRoomType("room-storage");
        assertThat(type1).isEqualTo(RoomType.BOOK_STORAGE);

        // Lần 2: Hit Cache (DB không được gọi thêm lần nào)
        RoomType type2 = comfortScoreService.resolveRoomType("room-storage");
        assertThat(type2).isEqualTo(RoomType.BOOK_STORAGE);
        verify(roomRepository, times(1)).findById("room-storage");

        // Invalidate cache
        comfortScoreService.invalidateRoomTypeCache("room-storage");

        // Lần 3: Gọi lại DB sau khi invalidate
        RoomType type3 = comfortScoreService.resolveRoomType("room-storage");
        assertThat(type3).isEqualTo(RoomType.BOOK_STORAGE);
        verify(roomRepository, times(2)).findById("room-storage");
    }

    @Test
    @DisplayName("resolveRoomType() - RoomId null hoặc không tồn tại -> Fallback sang STUDY_ROOM")
    void resolveRoomType_fallbackStudyRoom() {
        when(roomRepository.findById("room-non-exist")).thenReturn(Optional.empty());

        RoomType t1 = comfortScoreService.resolveRoomType(null);
        RoomType t2 = comfortScoreService.resolveRoomType("room-non-exist");

        assertThat(t1).isEqualTo(RoomType.STUDY_ROOM);
        assertThat(t2).isEqualTo(RoomType.STUDY_ROOM);
    }
}
