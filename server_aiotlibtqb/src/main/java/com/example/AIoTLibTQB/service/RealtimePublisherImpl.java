package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.response.AlertResponse;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RealtimePublisherImpl implements RealtimePublisher {

    final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public RealtimePublisherImpl(@Autowired(required = false) SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public void publishRoomTelemetry(String roomId, Object payload) {
        if (messagingTemplate != null) {
            try {
                messagingTemplate.convertAndSend("/topic/rooms/" + roomId + "/telemetry", payload);
                log.debug("Published room telemetry to /topic/rooms/{}/telemetry", roomId);
            } catch (Exception e) {
                log.warn("Failed to publish room telemetry to /topic/rooms/{}/telemetry: {}", roomId, e.getMessage());
            }
        } else {
            log.debug("RealtimePublisher (stub): room telemetry for roomId={}, payload={}", roomId, payload);
        }
    }

    @Override
    public void publishAlert(AlertResponse alert) {
        if (messagingTemplate != null) {
            try {
                messagingTemplate.convertAndSend("/topic/alerts", alert);
                log.info("Published alert to /topic/alerts: id={}, type={}, status={}",
                        alert.getId(), alert.getType(), alert.getStatus());
            } catch (Exception e) {
                log.warn("Failed to publish alert to /topic/alerts: {}", e.getMessage());
            }
        } else {
            log.info("RealtimePublisher (stub): alert id={}, type={}, status={}, msg={}",
                    alert.getId(), alert.getType(), alert.getStatus(), alert.getMessage());
        }
    }
}
