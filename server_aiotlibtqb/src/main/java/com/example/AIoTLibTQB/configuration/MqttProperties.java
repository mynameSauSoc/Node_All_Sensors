package com.example.AIoTLibTQB.configuration;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "mqtt")
@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MqttProperties {

    String brokerUrl = "tcp://localhost:1883";
    String clientId = "aiot_backend_consumer";
    String username = "";
    String password = "";
    String defaultTelemetryTopic = "devices/+/telemetry";
    String defaultStatusTopic = "devices/+/status";
}
