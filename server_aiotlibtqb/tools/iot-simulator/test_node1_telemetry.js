import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'test_node_all_sensors_client',
  username: 'Node_All_Sensors',
  password: 'CHANGE_ME_LOCAL_DEV_DEVICE'
});

client.on('connect', () => {
  console.log('[TEST] Node_All_Sensors connected to Mosquitto');

  // 1. Send Online Status
  const statusPayload = {
    hardware_id: 'Node_All_Sensors',
    status: 'online',
    reason: 'power_on',
    firmware_version: '1.2.0',
    uptime_seconds: 120
  };
  client.publish('devices/Node_All_Sensors/status', JSON.stringify(statusPayload), { qos: 1 });

  // 2. Send Telemetry matching exact Altium / ESP-IDF hardware
  const telemetryPayload = {
    hardware_id: 'Node_All_Sensors',
    timestamp: Date.now(),
    wifi_rssi: -55,
    data: {
      acoustics: {
        noise_avg: 38.5,
        noise_peak: 42.0
      },
      air_quality: {
        pm1_0: 6.2,
        pm2_5: 11.4,
        pm4_0: 13.8,
        pm10: 16.5
      },
      environment: {
        temperature: 24.2,
        humidity: 52.0,
        lux: 460.0,
        co2: 485
      }
    },
    ups: {
      power_mode: 1, // AC Main
      battery_pct: 100
    },
    comfort_score: {
      lcs: 96.5,
      rank: "OPTIMAL",
      status: "SAFE"
    }
  };

  client.publish('devices/Node_All_Sensors/telemetry', JSON.stringify(telemetryPayload), { qos: 1 }, (err) => {
    if (err) {
      console.error('[TEST] Publish error:', err);
    } else {
      console.log('[TEST] Published telemetry for Node_All_Sensors successfully!');
    }
    setTimeout(() => {
      client.end();
      process.exit(0);
    }, 500);
  });
});
