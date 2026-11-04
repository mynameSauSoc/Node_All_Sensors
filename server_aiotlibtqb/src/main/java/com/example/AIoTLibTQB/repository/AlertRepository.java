package com.example.AIoTLibTQB.repository;

import com.example.AIoTLibTQB.document.Alert;
import com.example.AIoTLibTQB.enums.AlertStatus;
import com.example.AIoTLibTQB.enums.AlertType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AlertRepository extends MongoRepository<Alert, String> {

    List<Alert> findByDeviceIdAndStatus(String deviceId, AlertStatus status);

    List<Alert> findByRoomIdAndStatus(String roomId, AlertStatus status);

    List<Alert> findByStatus(AlertStatus status);

    List<Alert> findByStatusIn(List<AlertStatus> statuses);

    List<Alert> findByHardwareIdAndTypeAndStatusIn(String hardwareId, AlertType type, List<AlertStatus> statuses);

    List<Alert> findByDeviceIdAndTypeAndStatusIn(String deviceId, AlertType type, List<AlertStatus> statuses);

    List<Alert> findByRoomIdOrderByStartedAtDesc(String roomId);

    Optional<Alert> findTopByDeviceIdAndTypeAndStatusOrderByStartedAtDesc(
            String deviceId, AlertType type, AlertStatus status);
}
