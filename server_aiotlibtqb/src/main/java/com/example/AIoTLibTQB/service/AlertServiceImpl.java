package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.Alert;
import com.example.AIoTLibTQB.document.Device;
import com.example.AIoTLibTQB.document.User;
import com.example.AIoTLibTQB.dto.mqtt.TelemetryPayload;
import com.example.AIoTLibTQB.dto.response.AlertResponse;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.enums.AlertStatus;
import com.example.AIoTLibTQB.enums.AlertType;
import com.example.AIoTLibTQB.enums.ErrorCode;
import com.example.AIoTLibTQB.exception.AppException;
import com.example.AIoTLibTQB.repository.AlertRepository;
import com.example.AIoTLibTQB.repository.DeviceRepository;
import com.example.AIoTLibTQB.repository.UserRepository;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AlertServiceImpl implements AlertService {

    AlertRepository alertRepository;
    RealtimePublisher realtimePublisher;
    AlertRuleEngine alertRuleEngine;
    MongoTemplate mongoTemplate;
    Clock clock;
    UserRepository userRepository;
    DeviceRepository deviceRepository;

    public AlertServiceImpl(
            AlertRepository alertRepository,
            RealtimePublisher realtimePublisher,
            AlertRuleEngine alertRuleEngine,
            MongoTemplate mongoTemplate,
            Clock clock
    ) {
        this(alertRepository, realtimePublisher, alertRuleEngine, mongoTemplate, clock, null, null);
    }

    @Autowired
    public AlertServiceImpl(
            AlertRepository alertRepository,
            RealtimePublisher realtimePublisher,
            AlertRuleEngine alertRuleEngine,
            MongoTemplate mongoTemplate,
            @Autowired(required = false) Clock clock,
            @Autowired(required = false) UserRepository userRepository,
            @Autowired(required = false) DeviceRepository deviceRepository
    ) {
        this.alertRepository = alertRepository;
        this.realtimePublisher = realtimePublisher;
        this.alertRuleEngine = alertRuleEngine;
        this.mongoTemplate = mongoTemplate;
        this.clock = clock != null ? clock : Clock.systemUTC();
        this.userRepository = userRepository;
        this.deviceRepository = deviceRepository;
    }

    @Override
    public PageResponse<AlertResponse> getAlerts(String roomId, AlertType type, AlertStatus status, Pageable pageable) {
        Query query = new Query();
        if (roomId != null && !roomId.isBlank()) {
            query.addCriteria(Criteria.where("roomId").is(roomId));
        }
        if (type != null) {
            query.addCriteria(Criteria.where("type").is(type));
        }
        if (status != null) {
            query.addCriteria(Criteria.where("status").is(status));
        }

        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && userRepository != null && deviceRepository != null) {
            boolean isFullAccess = auth.getAuthorities().stream()
                    .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
                            || "LIBRARIAN".equals(a.getAuthority()) || "ROLE_LIBRARIAN".equals(a.getAuthority())
                            || "MAINTENANCE".equals(a.getAuthority()) || "ROLE_MAINTENANCE".equals(a.getAuthority()));
            boolean isZoneManager = !isFullAccess && auth.getAuthorities().stream()
                    .anyMatch(a -> "ZONE_MANAGER".equals(a.getAuthority()) || "ROLE_ZONE_MANAGER".equals(a.getAuthority()));
            if (isZoneManager) {
                User user = userRepository.findByUsername(auth.getName()).orElse(null);
                if (user != null && user.getAssignedZones() != null && !user.getAssignedZones().isEmpty()) {
                    List<Device> devices = deviceRepository.findAll().stream()
                            .filter(d -> d.getZoneId() != null && user.getAssignedZones().contains(d.getZoneId()))
                            .toList();
                    List<String> allowedDeviceIds = devices.stream().map(Device::getId).toList();
                    List<String> allowedRoomIds = devices.stream().map(Device::getRoomId).filter(Objects::nonNull).distinct().toList();
                    query.addCriteria(new Criteria().orOperator(
                            Criteria.where("deviceId").in(allowedDeviceIds),
                            Criteria.where("roomId").in(allowedRoomIds)
                    ));
                } else {
                    query.addCriteria(Criteria.where("_id").is("__none__"));
                }
            }
        }

        long totalElements = mongoTemplate.count(query, Alert.class);
        query.with(pageable);
        List<Alert> alerts = mongoTemplate.find(query, Alert.class);

        List<AlertResponse> content = alerts.stream()
                .map(AlertRuleEngine::toAlertResponse)
                .toList();

        int pageSize = pageable.getPageSize() > 0 ? pageable.getPageSize() : 10;
        int totalPages = (int) Math.ceil((double) totalElements / pageSize);
        if (totalPages == 0) {
            totalPages = 1;
        }
        boolean last = pageable.getPageNumber() >= totalPages - 1;

        return PageResponse.<AlertResponse>builder()
                .content(content)
                .page(pageable.getPageNumber())
                .size(pageSize)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .last(last)
                .build();
    }

    @Override
    public long getUnreadCount() {
        return mongoTemplate.count(Query.query(Criteria.where("status").is(AlertStatus.FIRING)), Alert.class);
    }

    @Override
    public AlertResponse acknowledgeAlert(String id, String username) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ALERT_NOT_EXISTED));

        if (alert.getStatus() == AlertStatus.FIRING) {
            alert.setStatus(AlertStatus.ACKNOWLEDGED);
            alert.setAcknowledgedAt(clock.instant());
            alert.setAcknowledgedBy(username);
            alert = alertRepository.save(alert);

            alertRuleEngine.onAcknowledge(id);
            AlertResponse response = AlertRuleEngine.toAlertResponse(alert);
            realtimePublisher.publishAlert(response);
            log.info("Alert acknowledged: id={}, username={}", id, username);
            return response;
        }

        return AlertRuleEngine.toAlertResponse(alert);
    }

    @Override
    public AlertResponse resolveAlert(String id, String username) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.ALERT_NOT_EXISTED));

        if (alert.getStatus() != AlertStatus.RESOLVED) {
            alert.setStatus(AlertStatus.RESOLVED);
            alert.setResolvedAt(clock.instant());
            alert = alertRepository.save(alert);

            alertRuleEngine.onResolve(id);
            AlertResponse response = AlertRuleEngine.toAlertResponse(alert);
            realtimePublisher.publishAlert(response);
            log.info("Alert resolved manually: id={}, username={}", id, username);
            return response;
        }

        return AlertRuleEngine.toAlertResponse(alert);
    }

    @Override
    public void evaluateTelemetry(String deviceId, String hardwareId, String roomId, TelemetryPayload.TelemetryData data) {
        alertRuleEngine.evaluateTelemetry(deviceId, hardwareId, roomId, data);
    }

    @Override
    public void triggerDeviceOfflineAlert(String deviceId, String hardwareId, String roomId) {
        alertRuleEngine.triggerDeviceOfflineAlert(deviceId, hardwareId, roomId);
    }

    @Override
    public void resolveDeviceOfflineAlert(String hardwareId) {
        alertRuleEngine.resolveDeviceOfflineAlert(hardwareId);
    }
}
