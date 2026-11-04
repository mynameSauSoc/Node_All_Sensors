package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.AcousticMetrics;
import com.example.AIoTLibTQB.document.AirQualityMetrics;
import com.example.AIoTLibTQB.document.ComfortScoreRecord;
import com.example.AIoTLibTQB.document.EnvironmentMetrics;
import com.example.AIoTLibTQB.enums.RoomType;
import com.example.AIoTLibTQB.repository.RoomRepository;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;

/**
 * Động cơ Tính toán Điểm Tiện nghi Môi trường Thư viện Đa Cấu hình (Profile-based Comfort Score Engine).
 * <p>
 * Hỗ trợ 3 không gian với tiêu chuẩn chuyên ngành riêng biệt:
 * 1. STUDY_ROOM (Phòng đọc sách & tự học - Chuẩn ANSI/ASA S12.60, EN 12464-1, ASHRAE 55)
 * 2. BOOK_STORAGE (Kho bảo quản & lưu trữ sách - Chuẩn ISO 11799, IFLA)
 * 3. CIRCULATION_HALL (Phòng / Sảnh mượn trả sách & dịch vụ bạn đọc)
 * <p>
 * Áp dụng Nguyên lý Thùng gỗ Liebig (Non-linear Gating Formula) và Tái phân bổ trọng số động (Dynamic Re-weighting).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ComfortScoreService {

    RoomRepository roomRepository;

    @lombok.experimental.PackagePrivate
    final Cache<String, RoomType> roomTypeCache = Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(Duration.ofMinutes(10))
            .build();

    /**
     * Tra cứu phân loại phòng (RoomType) có hỗ trợ bộ đệm Caffeine RAM Cache để tránh nghẽn CSDL.
     */
    public RoomType resolveRoomType(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            return RoomType.STUDY_ROOM;
        }
        return roomTypeCache.get(roomId, id -> roomRepository.findById(id)
                .map(r -> r.getType() != null ? r.getType() : RoomType.STUDY_ROOM)
                .orElse(RoomType.STUDY_ROOM));
    }

    /**
     * Xóa cache phân loại phòng khi thông tin phòng bị thay đổi.
     */
    public void invalidateRoomTypeCache(String roomId) {
        if (roomId != null) {
            roomTypeCache.invalidate(roomId);
        }
    }

    /**
     * Tính toán điểm tiện nghi với roomId (tự động phân giải profile phòng).
     */
    public ComfortScoreRecord calculateForRoom(TelemetrySanitizerService.SanitizedMetrics metrics, String roomId) {
        RoomType roomType = resolveRoomType(roomId);
        return calculate(metrics, roomType);
    }

    /**
     * Tính toán điểm tiện nghi theo profile mặc định (STUDY_ROOM).
     */
    public ComfortScoreRecord calculate(TelemetrySanitizerService.SanitizedMetrics metrics) {
        return calculate(metrics, RoomType.STUDY_ROOM);
    }

    /**
     * Phương thức tính toán cốt lõi với SanitizedMetrics và RoomType rõ ràng.
     */
    public ComfortScoreRecord calculate(TelemetrySanitizerService.SanitizedMetrics metrics, RoomType roomType) {
        if (metrics == null) {
            return null;
        }

        RoomType actualType = (roomType != null) ? roomType : RoomType.STUDY_ROOM;

        Double sAcoustic = calculateAcousticScore(metrics.getAcoustics(), actualType);
        Double sAir = calculateAirScore(metrics.getAirQuality(), actualType);
        Double sThermal = calculateThermalScore(metrics.getEnvironment(), actualType);
        Double sLight = calculateLightScore(metrics.getEnvironment(), actualType);

        if (sAcoustic == null && sAir == null && sThermal == null && sLight == null) {
            return null;
        }

        ProfileWeights weights = getBaseWeights(actualType);

        double totalAvailableWeight = 0.0;
        double minScore = Double.MAX_VALUE;

        if (sAcoustic != null) {
            totalAvailableWeight += weights.acoustic();
            minScore = Math.min(minScore, sAcoustic);
        }
        if (sAir != null) {
            totalAvailableWeight += weights.air();
            minScore = Math.min(minScore, sAir);
        }
        if (sThermal != null) {
            totalAvailableWeight += weights.thermal();
            minScore = Math.min(minScore, sThermal);
        }
        if (sLight != null) {
            totalAvailableWeight += weights.light();
            minScore = Math.min(minScore, sLight);
        }

        if (totalAvailableWeight <= 0.0) {
            return null;
        }

        double weightedSum = 0.0;
        if (sAcoustic != null) {
            weightedSum += (weights.acoustic() / totalAvailableWeight) * sAcoustic;
        }
        if (sAir != null) {
            weightedSum += (weights.air() / totalAvailableWeight) * sAir;
        }
        if (sThermal != null) {
            weightedSum += (weights.thermal() / totalAvailableWeight) * sThermal;
        }
        if (sLight != null) {
            weightedSum += (weights.light() / totalAvailableWeight) * sLight;
        }

        // Áp dụng Nguyên lý Thùng gỗ Liebig: non-linear gating
        // Tối ưu hóa thực tế: Nếu phòng đang tắt đèn do vắng người (sLight thấp nhưng âm học yên tĩnh sAcoustic >= 75),
        // không để chỉ số ánh sáng làm bottleneck giả kéo sập tiện nghi nhiệt và khí.
        double effectiveMinScore = minScore;
        if (sLight != null && Double.compare(sLight, minScore) == 0 && sLight <= 40.0) {
            boolean isQuietOrStandby = (sAcoustic != null && sAcoustic >= 75.0);
            if (isQuietOrStandby) {
                double coreMin = Double.MAX_VALUE;
                if (sAcoustic != null) coreMin = Math.min(coreMin, sAcoustic);
                if (sAir != null) coreMin = Math.min(coreMin, sAir);
                if (sThermal != null) coreMin = Math.min(coreMin, sThermal);
                if (coreMin < Double.MAX_VALUE) {
                    effectiveMinScore = coreMin;
                }
            }
        }

        double bottleneckRatio = (weightedSum > 0.0) ? (effectiveMinScore / weightedSum) : 0.0;
        bottleneckRatio = Math.max(0.0, Math.min(1.0, bottleneckRatio));
        double lcsRaw = weightedSum * (0.30 + 0.70 * bottleneckRatio);
        lcsRaw = Math.max(0.0, Math.min(100.0, lcsRaw));

        Double overall = round(lcsRaw);
        String grade = determineGrade(overall);

        return ComfortScoreRecord.builder()
                .overall(overall)
                .grade(grade)
                .acousticScore(round(sAcoustic))
                .airScore(round(sAir))
                .thermalScore(round(sThermal))
                .lightScore(round(sLight))
                .build();
    }

    @lombok.experimental.PackagePrivate
    Double calculateAcousticScore(AcousticMetrics acoustics, RoomType roomType) {
        if (acoustics == null || acoustics.getNoiseAvg() == null) {
            return null;
        }
        double lAvg = acoustics.getNoiseAvg();
        Double lPeak = acoustics.getNoisePeak();

        return switch (roomType) {
            case STUDY_ROOM -> {
                double base;
                if (lAvg <= 35.0) {
                    base = 100.0;
                } else if (lAvg <= 55.0) {
                    base = 100.0 - (lAvg - 35.0) * 1.5;
                } else if (lAvg <= 70.0) {
                    base = 70.0 - (lAvg - 55.0) * (40.0 / 15.0);
                } else if (lAvg <= 80.0) {
                    base = 30.0 - (lAvg - 70.0) * 3.0;
                } else {
                    base = 0.0;
                }
                double penalty = 0.0;
                if (lPeak != null && lPeak > 70.0) {
                    penalty = Math.min(20.0, (lPeak - 70.0) * 1.0);
                }
                yield Math.max(0.0, base - penalty);
            }
            case BOOK_STORAGE -> {
                if (lAvg <= 60.0) {
                    yield 100.0;
                } else if (lAvg <= 85.0) {
                    yield Math.max(0.0, 100.0 - (lAvg - 60.0) * 4.0);
                } else {
                    yield 0.0;
                }
            }
            case CIRCULATION_HALL -> {
                double base;
                if (lAvg <= 50.0) {
                    base = 100.0;
                } else if (lAvg <= 65.0) {
                    base = 100.0 - (lAvg - 50.0) * (20.0 / 15.0);
                } else if (lAvg <= 75.0) {
                    base = 80.0 - (lAvg - 65.0) * 4.0;
                } else if (lAvg <= 85.0) {
                    base = 40.0 - (lAvg - 75.0) * 4.0;
                } else {
                    base = 0.0;
                }
                double penalty = 0.0;
                if (lPeak != null && lPeak > 80.0) {
                    penalty = Math.min(15.0, (lPeak - 80.0) * 1.0);
                }
                yield Math.max(0.0, base - penalty);
            }
        };
    }

    @lombok.experimental.PackagePrivate
    Double calculateAirScore(AirQualityMetrics airQuality, RoomType roomType) {
        if (airQuality == null || airQuality.getPm2_5() == null) {
            return null;
        }
        double pm25 = airQuality.getPm2_5();

        return switch (roomType) {
            case STUDY_ROOM, BOOK_STORAGE -> {
                if (pm25 <= 10.0) {
                    yield 100.0;
                } else if (pm25 <= 15.0) {
                    yield 100.0 - (pm25 - 10.0) * 3.0;
                } else if (pm25 <= 35.0) {
                    yield 85.0 - (pm25 - 15.0) * 1.25;
                } else if (pm25 <= 55.0) {
                    yield 60.0 - (pm25 - 35.0) * 1.5;
                } else if (pm25 <= 100.0) {
                    yield Math.max(0.0, 30.0 - (pm25 - 55.0) * (30.0 / 45.0));
                } else {
                    yield 0.0;
                }
            }
            case CIRCULATION_HALL -> {
                if (pm25 <= 15.0) {
                    yield 100.0;
                } else if (pm25 <= 25.0) {
                    yield 100.0 - (pm25 - 15.0) * 1.5;
                } else if (pm25 <= 45.0) {
                    yield 85.0 - (pm25 - 25.0) * 1.25;
                } else if (pm25 <= 65.0) {
                    yield 60.0 - (pm25 - 45.0) * 1.5;
                } else if (pm25 <= 100.0) {
                    yield Math.max(0.0, 30.0 - (pm25 - 65.0) * (30.0 / 35.0));
                } else {
                    yield 0.0;
                }
            }
        };
    }

    @lombok.experimental.PackagePrivate
    Double calculateThermalScore(EnvironmentMetrics env, RoomType roomType) {
        if (env == null || (env.getTemperature() == null && env.getHumidity() == null)) {
            return null;
        }
        Double temp = env.getTemperature();
        Double rh = env.getHumidity();

        return switch (roomType) {
            case STUDY_ROOM -> {
                Double sT = null;
                if (temp != null) {
                    if (temp >= 23.5 && temp <= 25.5) {
                        sT = 100.0;
                    } else if (temp < 23.5) {
                        sT = Math.max(0.0, 100.0 - (23.5 - temp) * 8.0);
                    } else {
                        sT = Math.max(0.0, 100.0 - (temp - 25.5) * 8.0);
                    }
                }
                Double sRh = null;
                if (rh != null) {
                    if (rh >= 40.0 && rh <= 60.0) {
                        sRh = 100.0;
                    } else if (rh < 40.0) {
                        sRh = Math.max(0.0, 100.0 - (40.0 - rh) * 2.0);
                    } else {
                        sRh = Math.max(0.0, 100.0 - (rh - 60.0) * 2.0);
                    }
                }
                if (sT != null && sRh != null) {
                    yield 0.70 * sT + 0.30 * sRh;
                } else if (sT != null) {
                    yield sT;
                } else {
                    yield sRh;
                }
            }
            case BOOK_STORAGE -> {
                Double sT = null;
                if (temp != null) {
                    if (temp >= 18.0 && temp <= 22.0) {
                        sT = 100.0;
                    } else if (temp < 18.0) {
                        sT = Math.max(0.0, 100.0 - (18.0 - temp) * 5.0);
                    } else {
                        sT = Math.max(0.0, 100.0 - (temp - 22.0) * 12.0);
                    }
                }
                Double sRh = null;
                if (rh != null) {
                    if (rh >= 45.0 && rh <= 55.0) {
                        sRh = 100.0;
                    } else if (rh < 45.0) {
                        sRh = Math.max(0.0, 100.0 - (45.0 - rh) * 3.0);
                    } else {
                        sRh = Math.max(0.0, 100.0 - (rh - 55.0) * 6.0);
                    }
                }
                if (sT != null && sRh != null) {
                    yield 0.50 * sT + 0.50 * sRh;
                } else if (sT != null) {
                    yield sT;
                } else {
                    yield sRh;
                }
            }
            case CIRCULATION_HALL -> {
                Double sT = null;
                if (temp != null) {
                    if (temp >= 24.0 && temp <= 26.5) {
                        sT = 100.0;
                    } else if (temp < 24.0) {
                        sT = Math.max(0.0, 100.0 - (24.0 - temp) * 8.0);
                    } else {
                        sT = Math.max(0.0, 100.0 - (temp - 26.5) * 8.0);
                    }
                }
                Double sRh = null;
                if (rh != null) {
                    if (rh >= 40.0 && rh <= 65.0) {
                        sRh = 100.0;
                    } else if (rh < 40.0) {
                        sRh = Math.max(0.0, 100.0 - (40.0 - rh) * 2.0);
                    } else {
                        sRh = Math.max(0.0, 100.0 - (rh - 65.0) * 2.0);
                    }
                }
                if (sT != null && sRh != null) {
                    yield 0.60 * sT + 0.40 * sRh;
                } else if (sT != null) {
                    yield sT;
                } else {
                    yield sRh;
                }
            }
        };
    }

    @lombok.experimental.PackagePrivate
    Double calculateLightScore(EnvironmentMetrics env, RoomType roomType) {
        if (env == null || env.getLux() == null) {
            return null;
        }
        double lux = env.getLux();

        return switch (roomType) {
            case STUDY_ROOM -> {
                if (lux >= 400.0 && lux <= 600.0) {
                    yield 100.0;
                } else if (lux < 400.0) {
                    if (lux <= 50.0) {
                        yield 0.0;
                    }
                    yield Math.max(0.0, (lux - 50.0) / 3.5);
                } else {
                    if (lux <= 1200.0) {
                        yield 100.0 - (lux - 600.0) * (50.0 / 600.0);
                    } else if (lux <= 2000.0) {
                        yield Math.max(0.0, 50.0 - (lux - 1200.0) * (50.0 / 800.0));
                    } else {
                        yield 0.0;
                    }
                }
            }
            case BOOK_STORAGE -> {
                if (lux <= 100.0) {
                    yield 100.0;
                } else if (lux <= 200.0) {
                    yield 100.0 - (lux - 100.0) * 0.5;
                } else if (lux <= 500.0) {
                    yield Math.max(0.0, 50.0 - (lux - 200.0) * (50.0 / 300.0));
                } else {
                    yield 0.0;
                }
            }
            case CIRCULATION_HALL -> {
                if (lux >= 300.0 && lux <= 500.0) {
                    yield 100.0;
                } else if (lux < 300.0) {
                    if (lux <= 50.0) {
                        yield 0.0;
                    }
                    yield Math.max(0.0, (lux - 50.0) / 2.5);
                } else {
                    if (lux <= 1000.0) {
                        yield 100.0 - (lux - 500.0) * (50.0 / 500.0);
                    } else if (lux <= 2000.0) {
                        yield Math.max(0.0, 50.0 - (lux - 1000.0) * (50.0 / 1000.0));
                    } else {
                        yield 0.0;
                    }
                }
            }
        };
    }

    public String determineGrade(Double overall) {
        if (overall == null) {
            return "Poor";
        }
        if (overall >= 90.0) {
            return "Platinum";
        } else if (overall >= 75.0) {
            return "Gold";
        } else if (overall >= 60.0) {
            return "Silver";
        } else if (overall >= 45.0) {
            return "Bronze";
        } else {
            return "Poor";
        }
    }

    private Double round(Double value) {
        if (value == null) {
            return null;
        }
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private record ProfileWeights(double acoustic, double air, double thermal, double light) {}

    private ProfileWeights getBaseWeights(RoomType roomType) {
        return switch (roomType) {
            case STUDY_ROOM -> new ProfileWeights(0.35, 0.30, 0.20, 0.15);
            case BOOK_STORAGE -> new ProfileWeights(0.05, 0.30, 0.50, 0.15);
            case CIRCULATION_HALL -> new ProfileWeights(0.20, 0.30, 0.25, 0.25);
        };
    }
}
