package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Alert;
import com.example.AIoTLibTQB.dto.mqtt.TelemetryPayload;
import com.example.AIoTLibTQB.dto.response.AlertResponse;
import com.example.AIoTLibTQB.enums.AlertStatus;
import com.example.AIoTLibTQB.enums.AlertType;
import com.example.AIoTLibTQB.repository.AlertRepository;
import jakarta.annotation.PostConstruct;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AlertRuleEngine {

    final AlertRepository alertRepository;
    final RealtimePublisher realtimePublisher;
    final Clock clock;

    static final Duration PENDING_WINDOW = Duration.ofSeconds(30);
    static final Duration HYSTERESIS_WINDOW = Duration.ofSeconds(60);

    static final double THRESHOLD_NOISE_AVG = 65.0;
    static final double THRESHOLD_NOISE_PEAK = 75.0;
    static final double THRESHOLD_TEMP = 32.0;
    static final double THRESHOLD_PM25 = 50.0;

    @Getter
    final Map<String, FsmState> fsmMap = new ConcurrentHashMap<>();

    @Autowired
    public AlertRuleEngine(
            AlertRepository alertRepository,
            RealtimePublisher realtimePublisher,
            @Autowired(required = false) Clock clock
    ) {
        this.alertRepository = alertRepository;
        this.realtimePublisher = realtimePublisher;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    @PostConstruct
    public void rehydrateActiveAlerts() {
        try {
            List<Alert> activeAlerts = alertRepository.findByStatusIn(List.of(AlertStatus.FIRING, AlertStatus.ACKNOWLEDGED));
            if (activeAlerts != null) {
                for (Alert alert : activeAlerts) {
                    String targetId = alert.getDeviceId() != null && !alert.getDeviceId().isBlank()
                            ? alert.getDeviceId()
                            : (alert.getRoomId() != null && !alert.getRoomId().isBlank() ? alert.getRoomId() : alert.getHardwareId());
                    if (targetId == null) continue;
                    String metricType = alert.getType() != null ? alert.getType().name() : "UNKNOWN";
                    String key = targetId + ":" + metricType;

                    FsmState state = new FsmState();
                    state.setStatus(alert.getStatus());
                    state.setFiringSince(alert.getStartedAt() != null ? alert.getStartedAt() : clock.instant());
                    state.setAlertId(alert.getId());
                    state.setThreshold(alert.getThreshold());
                    state.setLastValue(alert.getCurrentValue());
                    state.setAlertType(alert.getType());
                    state.setMetricType(metricType);
                    state.setDeviceId(alert.getDeviceId());
                    state.setHardwareId(alert.getHardwareId());
                    state.setRoomId(alert.getRoomId());

                    fsmMap.put(key, state);
                }
                log.info("Rehydrated {} active alert(s) into AlertRuleEngine FSM on startup", activeAlerts.size());
            }
        } catch (Exception e) {
            log.debug("Skipping FSM rehydration during test or mock environment: {}", e.getMessage());
        }
    }

    @Getter
    @Setter
    public static class FsmState {
        AlertStatus status;
        Instant pendingSince;
        Instant firingSince;
        Instant recoverySince;
        String alertId;
        Double lastValue;
        Double threshold;
        AlertType alertType;
        String metricType;
        String deviceId;
        String hardwareId;
        String roomId;
    }

    public void evaluateTelemetry(String deviceId, String hardwareId, String roomId, TelemetryPayload.TelemetryData data) {
        if (data == null) {
            return;
        }

        String targetId = deviceId != null && !deviceId.isBlank() ? deviceId : (roomId != null && !roomId.isBlank() ? roomId : hardwareId);

        // 1. noiseAvg > 65 dBA
        if (data.getAcoustics() != null && data.getAcoustics().getNoiseAvg() != null) {
            double noiseAvg = data.getAcoustics().getNoiseAvg();
            evaluateMetric(targetId, "NOISE_AVG", noiseAvg > THRESHOLD_NOISE_AVG, noiseAvg,
                    THRESHOLD_NOISE_AVG, AlertType.NOISE_EXCEEDED,
                    String.format("Average noise level (%.1f dBA) exceeded threshold (%.1f dBA)", noiseAvg, THRESHOLD_NOISE_AVG),
                    deviceId, hardwareId, roomId);
        }

        // 2. noisePeak > 75 dBA (Instantaneous spike - safe handling for null)
        if (data.getAcoustics() != null) {
            Double noisePeak = data.getAcoustics().getNoisePeak();
            if (noisePeak != null) {
                evaluateMetric(targetId, "NOISE_PEAK", noisePeak > THRESHOLD_NOISE_PEAK, noisePeak,
                        THRESHOLD_NOISE_PEAK, AlertType.NOISE_EXCEEDED,
                        String.format("Peak noise spike (%.1f dBA) exceeded threshold (%.1f dBA)", noisePeak, THRESHOLD_NOISE_PEAK),
                        deviceId, hardwareId, roomId);
            }
        }

        // 3. temp > 32°C
        if (data.getEnvironment() != null && data.getEnvironment().getTemperature() != null) {
            double temp = data.getEnvironment().getTemperature();
            evaluateMetric(targetId, "TEMPERATURE", temp > THRESHOLD_TEMP, temp,
                    THRESHOLD_TEMP, AlertType.AIR_UNHEALTHY,
                    String.format("Temperature (%.1f °C) exceeded threshold (%.1f °C)", temp, THRESHOLD_TEMP),
                    deviceId, hardwareId, roomId);
        }

        // 4. pm2.5 > 50 µg/m³
        if (data.getAirQuality() != null && data.getAirQuality().getPm2_5() != null) {
            double pm25 = data.getAirQuality().getPm2_5();
            evaluateMetric(targetId, "PM2_5", pm25 > THRESHOLD_PM25, pm25,
                    THRESHOLD_PM25, AlertType.AIR_UNHEALTHY,
                    String.format("PM2.5 particulate level (%.1f µg/m³) exceeded threshold (%.1f µg/m³)", pm25, THRESHOLD_PM25),
                    deviceId, hardwareId, roomId);
        }
    }

    private void evaluateMetric(
            String targetId,
            String metricType,
            boolean isBreached,
            double currentValue,
            double threshold,
            AlertType alertType,
            String message,
            String deviceId,
            String hardwareId,
            String roomId
    ) {
        String key = targetId + ":" + metricType;
        Instant now = clock.instant();

        final boolean[] shouldFire = { false };
        final Alert[] alertToSave = { null };
        final String[] resolveAlertId = { null };

        fsmMap.compute(key, (k, state) -> {
            if (state == null) {
                // NORMAL state
                if (isBreached) {
                    // Enter PENDING (30s) in memory without DB write
                    FsmState newState = new FsmState();
                    newState.setStatus(AlertStatus.PENDING);
                    newState.setPendingSince(now);
                    newState.setLastValue(currentValue);
                    newState.setThreshold(threshold);
                    newState.setAlertType(alertType);
                    newState.setMetricType(metricType);
                    newState.setDeviceId(deviceId);
                    newState.setHardwareId(hardwareId);
                    newState.setRoomId(roomId);
                    log.debug("Alert FSM entered PENDING: key={}, value={}, threshold={}", key, currentValue, threshold);
                    return newState;
                }
                return null;
            }

            // Existing state is PENDING
            if (state.getStatus() == AlertStatus.PENDING) {
                if (isBreached) {
                    state.setLastValue(currentValue);
                    long pendingSeconds = Duration.between(state.getPendingSince(), now).getSeconds();
                    if (pendingSeconds >= PENDING_WINDOW.getSeconds()) {
                        // TRANSITION: PENDING -> FIRING
                        state.setStatus(AlertStatus.FIRING);
                        state.setFiringSince(now);
                        state.setRecoverySince(null);

                        alertToSave[0] = Alert.builder()
                                .deviceId(deviceId)
                                .hardwareId(hardwareId)
                                .roomId(roomId)
                                .type(alertType)
                                .status(AlertStatus.FIRING)
                                .currentValue(currentValue)
                                .threshold(threshold)
                                .message(message)
                                .startedAt(now)
                                .build();
                        shouldFire[0] = true;
                    }
                    return state;
                } else {
                    // Metric dropped back within 30s -> cancel PENDING without DB write
                    log.debug("Alert FSM cancelled PENDING (false alarm filtered): key={}", key);
                    return null;
                }
            }

            // Existing state is FIRING or ACKNOWLEDGED
            if (state.getStatus() == AlertStatus.FIRING || state.getStatus() == AlertStatus.ACKNOWLEDGED) {
                if (isBreached) {
                    state.setLastValue(currentValue);
                    if (state.getRecoverySince() != null) {
                        // Metric breached again during 60s hysteresis -> reset recovery timer
                        state.setRecoverySince(null);
                        log.debug("Alert FSM recovery timer reset due to breach spike: key={}", key);
                    }
                    return state;
                } else {
                    // Metric is below threshold
                    if (state.getRecoverySince() == null) {
                        state.setRecoverySince(now);
                        log.debug("Alert FSM started recovery hysteresis window: key={}", key);
                        return state;
                    } else {
                        long recoverySeconds = Duration.between(state.getRecoverySince(), now).getSeconds();
                        if (recoverySeconds >= HYSTERESIS_WINDOW.getSeconds()) {
                            // TRANSITION: FIRING / ACKNOWLEDGED -> RESOLVED
                            if (state.getAlertId() != null) {
                                resolveAlertId[0] = state.getAlertId();
                            }
                            return null; // Evict from active in-memory state
                        }
                        return state;
                    }
                }
            }

            return state;
        });

        // Perform I/O outside compute() to prevent virtual thread carrier pinning
        if (shouldFire[0] && alertToSave[0] != null) {
            Alert savedAlert = alertRepository.save(alertToSave[0]);
            FsmState s = fsmMap.get(key);
            if (s != null && s.getStatus() == AlertStatus.FIRING) {
                s.setAlertId(savedAlert.getId());
            }
            realtimePublisher.publishAlert(toAlertResponse(savedAlert));
            log.info("Alert FSM transitioned to FIRING: key={}, alertId={}, value={}", key, savedAlert.getId(), currentValue);
        } else if (resolveAlertId[0] != null) {
            alertRepository.findById(resolveAlertId[0]).ifPresent(alert -> {
                alert.setStatus(AlertStatus.RESOLVED);
                alert.setResolvedAt(now);
                Alert saved = alertRepository.save(alert);
                realtimePublisher.publishAlert(toAlertResponse(saved));
                log.info("Alert FSM resolved after 60s hysteresis: key={}, alertId={}", key, alert.getId());
            });
        }
    }

    public void triggerDeviceOfflineAlert(String deviceId, String hardwareId, String roomId) {
        String targetId = deviceId != null && !deviceId.isBlank() ? deviceId : hardwareId;
        String key = targetId + ":DEVICE_OFFLINE";
        Instant now = clock.instant();

        final Alert[] alertToSave = { null };

        fsmMap.compute(key, (k, state) -> {
            if (state != null && (state.getStatus() == AlertStatus.FIRING || state.getStatus() == AlertStatus.ACKNOWLEDGED)) {
                return state;
            }

            alertToSave[0] = Alert.builder()
                    .deviceId(deviceId)
                    .hardwareId(hardwareId)
                    .roomId(roomId)
                    .type(AlertType.DEVICE_OFFLINE)
                    .status(AlertStatus.FIRING)
                    .currentValue(0.0)
                    .threshold(0.0)
                    .message("Device is offline: hardwareId=" + hardwareId)
                    .startedAt(now)
                    .build();

            FsmState newState = new FsmState();
            newState.setStatus(AlertStatus.FIRING);
            newState.setFiringSince(now);
            newState.setAlertType(AlertType.DEVICE_OFFLINE);
            newState.setMetricType("DEVICE_OFFLINE");
            newState.setDeviceId(deviceId);
            newState.setHardwareId(hardwareId);
            newState.setRoomId(roomId);
            return newState;
        });

        if (alertToSave[0] != null) {
            Alert savedAlert = alertRepository.save(alertToSave[0]);
            FsmState s = fsmMap.get(key);
            if (s != null) {
                s.setAlertId(savedAlert.getId());
            }
            realtimePublisher.publishAlert(toAlertResponse(savedAlert));
            log.info("Triggered DEVICE_OFFLINE alert: hardwareId={}, alertId={}", hardwareId, savedAlert.getId());
        }
    }

    public void resolveDeviceOfflineAlert(String hardwareId) {
        Instant now = clock.instant();
        // Check in-memory FSM first
        fsmMap.entrySet().removeIf(entry -> {
            FsmState state = entry.getValue();
            if (state != null && "DEVICE_OFFLINE".equals(state.getMetricType())
                    && hardwareId != null && hardwareId.equals(state.getHardwareId())) {
                if (state.getAlertId() != null) {
                    alertRepository.findById(state.getAlertId()).ifPresent(alert -> {
                        alert.setStatus(AlertStatus.RESOLVED);
                        alert.setResolvedAt(now);
                        Alert saved = alertRepository.save(alert);
                        realtimePublisher.publishAlert(toAlertResponse(saved));
                        log.info("Resolved in-memory DEVICE_OFFLINE alert: hardwareId={}, alertId={}", hardwareId, alert.getId());
                    });
                }
                return true;
            }
            return false;
        });

        // Also resolve in DB if not in in-memory state using indexed queries
        List<Alert> firingAlerts;
        try {
            firingAlerts = alertRepository.findByHardwareIdAndTypeAndStatusIn(
                    hardwareId, AlertType.DEVICE_OFFLINE, List.of(AlertStatus.FIRING, AlertStatus.ACKNOWLEDGED));
        } catch (Exception e) {
            firingAlerts = alertRepository.findByStatus(AlertStatus.FIRING).stream()
                    .filter(a -> a.getType() == AlertType.DEVICE_OFFLINE && hardwareId != null && hardwareId.equals(a.getHardwareId()))
                    .toList();
        }
        for (Alert a : firingAlerts) {
            a.setStatus(AlertStatus.RESOLVED);
            a.setResolvedAt(now);
            alertRepository.save(a);
            realtimePublisher.publishAlert(toAlertResponse(a));
        }
    }

    public void onAcknowledge(String alertId) {
        if (alertId == null) return;
        for (FsmState state : fsmMap.values()) {
            if (alertId.equals(state.getAlertId())) {
                state.setStatus(AlertStatus.ACKNOWLEDGED);
                log.debug("Updated FSM state to ACKNOWLEDGED for alertId={}", alertId);
                break;
            }
        }
    }

    public void onResolve(String alertId) {
        if (alertId == null) return;
        fsmMap.values().removeIf(state -> alertId.equals(state.getAlertId()));
        log.debug("Removed FSM state for resolved alertId={}", alertId);
    }

    public void reset() {
        fsmMap.clear();
    }

    public static AlertResponse toAlertResponse(Alert alert) {
        if (alert == null) return null;
        return AlertResponse.builder()
                .id(alert.getId())
                .deviceId(alert.getDeviceId())
                .hardwareId(alert.getHardwareId())
                .roomId(alert.getRoomId())
                .type(alert.getType())
                .status(alert.getStatus())
                .currentValue(alert.getCurrentValue())
                .threshold(alert.getThreshold())
                .message(alert.getMessage())
                .startedAt(alert.getStartedAt())
                .acknowledgedAt(alert.getAcknowledgedAt())
                .resolvedAt(alert.getResolvedAt())
                .acknowledgedBy(alert.getAcknowledgedBy())
                .build();
    }
}
