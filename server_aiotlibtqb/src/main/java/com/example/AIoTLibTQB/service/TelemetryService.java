package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Device;
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
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.MatchOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE', 'USER', 'VIEWER')")
public class TelemetryService {

    TelemetryRepository telemetryRepository;
    DeviceRepository deviceRepository;
    UserRepository userRepository;
    MongoTemplate mongoTemplate;

    public TelemetryResponse getLatestByDeviceId(String deviceId) {
        checkDeviceAccess(deviceId);
        return telemetryRepository.findTopByMetadataDeviceIdOrderByTimestampDesc(deviceId)
                .map(this::toResponse)
                .orElse(null);
    }

    public TelemetryResponse getLatestByRoomId(String roomId) {
        checkRoomAccess(roomId);
        return telemetryRepository.findTopByMetadataRoomIdOrderByTimestampDesc(roomId)
                .map(this::toResponse)
                .orElse(null);
    }

    public List<TelemetryResponse> getHistoryByDeviceId(String deviceId, Instant start, Instant end) {
        checkDeviceAccess(deviceId);
        if (start != null && end != null && start.isAfter(end)) {
            throw new AppException(ErrorCode.INVALID_TIME_RANGE);
        }
        Instant actualEnd = (end != null) ? end : Instant.now();
        Instant actualStart = (start != null) ? start : actualEnd.minus(1, ChronoUnit.HOURS);
        if (actualStart.isAfter(actualEnd)) {
            throw new AppException(ErrorCode.INVALID_TIME_RANGE);
        }

        return telemetryRepository.findByMetadataDeviceIdAndTimestampBetweenOrderByTimestampDesc(deviceId, actualStart, actualEnd)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<TelemetryResponse> getHistoryByRoomId(String roomId, Instant start, Instant end) {
        checkRoomAccess(roomId);
        if (start != null && end != null && start.isAfter(end)) {
            throw new AppException(ErrorCode.INVALID_TIME_RANGE);
        }
        Instant actualEnd = (end != null) ? end : Instant.now();
        Instant actualStart = (start != null) ? start : actualEnd.minus(1, ChronoUnit.HOURS);
        if (actualStart.isAfter(actualEnd)) {
            throw new AppException(ErrorCode.INVALID_TIME_RANGE);
        }

        return telemetryRepository.findByMetadataRoomIdAndTimestampBetweenOrderByTimestampDesc(roomId, actualStart, actualEnd)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public record IntervalConfig(String unit, int binSize, long intervalSeconds) {}

    public IntervalConfig resolveIntervalConfig(String interval) {
        if (interval == null || interval.isBlank()) {
            throw new AppException(ErrorCode.INVALID_INTERVAL);
        }
        String normalized = interval.trim().toLowerCase();
        return switch (normalized) {
            case "15m" -> new IntervalConfig("minute", 15, 900L);
            case "1h" -> new IntervalConfig("hour", 1, 3600L);
            case "1d" -> new IntervalConfig("day", 1, 86400L);
            default -> throw new AppException(ErrorCode.INVALID_INTERVAL);
        };
    }

    public TelemetryBucketResponse getBuckets(String roomId, String interval, Instant start, Instant end) {
        return getBucketsByRoomId(roomId, interval, start, end);
    }

    public TelemetryBucketResponse getBucketsByRoomId(String roomId, String interval, Instant start, Instant end) {
        checkRoomAccess(roomId);

        if (start == null || end == null || !start.isBefore(end)) {
            throw new AppException(ErrorCode.INVALID_TIME_RANGE);
        }

        IntervalConfig config = resolveIntervalConfig(interval);

        long durationSeconds = Duration.between(start, end).toSeconds();
        long bucketCount = (durationSeconds + config.intervalSeconds() - 1) / config.intervalSeconds();
        if (bucketCount > 1000) {
            throw new AppException(ErrorCode.TOO_MANY_BUCKETS);
        }

        Aggregation aggregation = buildBucketAggregation(roomId, config, start, end);
        AggregationResults<Document> results = mongoTemplate.aggregate(aggregation, "telemetry_records", Document.class);

        List<BucketDataPoint> points = results.getMappedResults().stream()
                .map(this::toBucketDataPoint)
                .collect(Collectors.toList());

        return TelemetryBucketResponse.builder()
                .roomId(roomId)
                .interval(interval.trim().toLowerCase())
                .dataPoints(points)
                .build();
    }

    public Aggregation buildBucketAggregation(String roomId, IntervalConfig config, Instant start, Instant end) {
        MatchOperation matchStage = Aggregation.match(
                Criteria.where("metadata.roomId").is(roomId)
                        .and("timestamp").gte(start).lte(end)
        );

        Document dateTrunc = new Document("$dateTrunc",
                new Document("date", "$timestamp")
                        .append("unit", config.unit())
                        .append("binSize", config.binSize())
        );

        Document groupFields = new Document("_id", dateTrunc)
                .append("comfortScoreAvg", new Document("$avg", "$comfortScore.overall"))
                .append("comfortScoreMin", new Document("$min", "$comfortScore.overall"))
                .append("comfortScoreMax", new Document("$max", "$comfortScore.overall"))
                .append("tempAvg", new Document("$avg", "$environment.temperature"))
                .append("tempMin", new Document("$min", "$environment.temperature"))
                .append("tempMax", new Document("$max", "$environment.temperature"))
                .append("humidityAvg", new Document("$avg", "$environment.humidity"))
                .append("humidityMin", new Document("$min", "$environment.humidity"))
                .append("humidityMax", new Document("$max", "$environment.humidity"))
                .append("noiseAvg", new Document("$avg", "$acoustics.noiseAvg"))
                .append("noiseMin", new Document("$min", "$acoustics.noiseAvg"))
                .append("noiseMax", new Document("$max", "$acoustics.noiseAvg"))
                .append("pm25Avg", new Document("$avg", "$airQuality.pm2_5"))
                .append("pm25Min", new Document("$min", "$airQuality.pm2_5"))
                .append("pm25Max", new Document("$max", "$airQuality.pm2_5"))
                .append("luxAvg", new Document("$avg", "$environment.lux"))
                .append("luxMin", new Document("$min", "$environment.lux"))
                .append("luxMax", new Document("$max", "$environment.lux"))
                .append("sampleCount", new Document("$sum", 1));

        AggregationOperation groupStage = context -> new Document("$group", groupFields);
        AggregationOperation sortStage = context -> new Document("$sort", new Document("_id", 1));

        return Aggregation.newAggregation(matchStage, groupStage, sortStage);
    }

    private BucketDataPoint toBucketDataPoint(Document doc) {
        return BucketDataPoint.builder()
                .bucketTime(extractInstant(doc.get("_id")))
                .sampleCount(extractLong(doc, "sampleCount"))
                .comfortScoreAvg(extractDouble(doc, "comfortScoreAvg"))
                .comfortScoreMin(extractDouble(doc, "comfortScoreMin"))
                .comfortScoreMax(extractDouble(doc, "comfortScoreMax"))
                .tempAvg(extractDouble(doc, "tempAvg"))
                .tempMin(extractDouble(doc, "tempMin"))
                .tempMax(extractDouble(doc, "tempMax"))
                .humidityAvg(extractDouble(doc, "humidityAvg"))
                .humidityMin(extractDouble(doc, "humidityMin"))
                .humidityMax(extractDouble(doc, "humidityMax"))
                .noiseAvg(extractDouble(doc, "noiseAvg"))
                .noiseMin(extractDouble(doc, "noiseMin"))
                .noiseMax(extractDouble(doc, "noiseMax"))
                .pm25Avg(extractDouble(doc, "pm25Avg"))
                .pm25Min(extractDouble(doc, "pm25Min"))
                .pm25Max(extractDouble(doc, "pm25Max"))
                .luxAvg(extractDouble(doc, "luxAvg"))
                .luxMin(extractDouble(doc, "luxMin"))
                .luxMax(extractDouble(doc, "luxMax"))
                .build();
    }

    private Instant extractInstant(Object obj) {
        if (obj instanceof Instant instant) {
            return instant;
        } else if (obj instanceof Date date) {
            return date.toInstant();
        } else if (obj instanceof String str) {
            return Instant.parse(str);
        }
        return null;
    }

    private Double extractDouble(Document doc, String field) {
        Number num = doc.get(field, Number.class);
        if (num == null) {
            return null;
        }
        return roundTo2Decimals(num.doubleValue());
    }

    private Long extractLong(Document doc, String field) {
        Number num = doc.get(field, Number.class);
        return num != null ? num.longValue() : 0L;
    }

    public Double roundTo2Decimals(Double value) {
        if (value == null || Double.isNaN(value) || Double.isInfinite(value)) {
            return null;
        }
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }


    private void checkDeviceAccess(String deviceId) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return;

        boolean isFullAccess = auth.getAuthorities().stream()
                .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
                        || "LIBRARIAN".equals(a.getAuthority()) || "ROLE_LIBRARIAN".equals(a.getAuthority()));

        if (!isFullAccess) {
            boolean isZoneManager = auth.getAuthorities().stream()
                    .anyMatch(a -> "ZONE_MANAGER".equals(a.getAuthority()) || "ROLE_ZONE_MANAGER".equals(a.getAuthority()));
            if (isZoneManager) {
                Device device = deviceRepository.findById(deviceId).orElse(null);
                if (device != null && device.getZoneId() != null) {
                    String username = auth.getName();
                    User user = userRepository.findByUsername(username)
                            .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
                    if (user.getAssignedZones() == null || !user.getAssignedZones().contains(device.getZoneId())) {
                        throw new AppException(ErrorCode.ZONE_ACCESS_DENIED);
                    }
                }
            }
        }
    }

    private void checkRoomAccess(String roomId) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return;

        boolean isFullAccess = auth.getAuthorities().stream()
                .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
                        || "LIBRARIAN".equals(a.getAuthority()) || "ROLE_LIBRARIAN".equals(a.getAuthority()));

        if (!isFullAccess) {
            boolean isZoneManager = auth.getAuthorities().stream()
                    .anyMatch(a -> "ZONE_MANAGER".equals(a.getAuthority()) || "ROLE_ZONE_MANAGER".equals(a.getAuthority()));
            if (isZoneManager) {
                String username = auth.getName();
                User user = userRepository.findByUsername(username)
                        .orElseThrow(() -> new AppException(ErrorCode.UNAUTHENTICATED));
                List<Device> devices = deviceRepository.findByRoomId(roomId);
                if (devices.isEmpty()) {
                    throw new AppException(ErrorCode.ZONE_ACCESS_DENIED);
                }
                boolean anyMatch = devices.stream()
                        .anyMatch(d -> d.getZoneId() != null && user.getAssignedZones() != null && user.getAssignedZones().contains(d.getZoneId()));
                if (!anyMatch) {
                    throw new AppException(ErrorCode.ZONE_ACCESS_DENIED);
                }
            }
        }
    }

    private TelemetryResponse toResponse(TelemetryRecord record) {
        return TelemetryResponse.builder()
                .id(record.getId())
                .timestamp(record.getTimestamp())
                .metadata(record.getMetadata())
                .acoustics(record.getAcoustics())
                .airQuality(record.getAirQuality())
                .environment(record.getEnvironment())
                .comfortScore(record.getComfortScore())
                .wifiRssi(record.getWifiRssi())
                .build();
    }
}
