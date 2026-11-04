import { generateDeviceTelemetry } from './signalModel.js';

export const SCENARIOS = {
  NORMAL: 'normal',
  NOISE_SPIKE: 'noise-spike',
  PM25_HIGH: 'pm25-high',
  HEAT_HUMID: 'heat/humid',
  DEVICE_DROPOUT: 'device-dropout',
  FLAP: 'flap',
  LWT: 'lwt',
  BAD_PAYLOAD: 'bad-payload',
  BURST: 'burst',
  DEMO: 'demo'
};

/**
 * Returns modifier options for a device based on the chosen scenario and step index.
 */
export function getScenarioModifiers(scenarioName, device, stepIndex = 1, elapsedSeconds = 0) {
  switch (scenarioName) {
    case SCENARIOS.NORMAL:
      return {};

    case SCENARIOS.NOISE_SPIKE:
      // Produce noise spikes that exceed AlertRuleEngine thresholds:
      // THRESHOLD_NOISE_AVG = 65.0 dBA, THRESHOLD_NOISE_PEAK = 75.0 dBA
      return {
        noiseAvgOverride: 68.5 + (stepIndex % 3) * 1.5,
        noisePeakOverride: 82.0 + (stepIndex % 4) * 2.0
      };

    case SCENARIOS.PM25_HIGH:
      // Exceeds AlertRuleEngine THRESHOLD_PM25 = 50.0 µg/m³
      return {
        pm25Override: 68.0 + (stepIndex % 5) * 3.0
      };

    case SCENARIOS.HEAT_HUMID:
      // Exceeds AlertRuleEngine THRESHOLD_TEMP = 32.0 °C and high humidity
      return {
        tempOverride: 35.5 + (stepIndex % 3) * 0.5,
        humidityOverride: 85.0 + (stepIndex % 4) * 1.0
      };

    case SCENARIOS.DEMO: {
      // Continuous simulation with realistic periodic crowd surges (SIM-06)
      const wave = Math.sin((stepIndex / 6) * Math.PI);
      const isCollaborativeZone = device?.zoneId === 'ZONE_B' || device?.zoneId === 'ZONE_HALL';
      const surgeActive = stepIndex % 12 >= 8 && isCollaborativeZone;

      return {
        tempOffset: Number((wave * 1.2 + (surgeActive ? 1.5 : 0)).toFixed(2)),
        humidityOffset: Number((wave * 3.0).toFixed(2)),
        noiseAvgOffset: Number((Math.max(0, wave * 4.5) + (surgeActive ? 9.0 : 0)).toFixed(2)),
        noisePeakOffset: surgeActive ? 12.0 : 0,
        pm25Offset: Number((Math.max(0, wave * 3.0) + (surgeActive ? 5.0 : 0)).toFixed(2))
      };
    }

    default:
      return {};
  }
}

/**
 * Generates custom test packets for special scenarios like bad-payload.
 */
export function generateBadPayloadSample(device, variation = 0) {
  const base = generateDeviceTelemetry(device, 'STUDY_ROOM', Date.now());

  switch (variation % 4) {
    case 0:
      // Out of physical bounds (temp = 250°C, noise = 999 dBA) -> TelemetrySanitizerService should reject
      return {
        hardware_id: device.hardwareId,
        timestamp: Date.now(),
        wifi_rssi: -60,
        data: {
          acoustics: { noise_avg: 999.0, noise_peak: 1200.0 },
          air_quality: { pm1_0: -50.0, pm2_5: -100.0, pm4_0: 9999.0, pm10: 9999.0 },
          environment: { temperature: 250.0, humidity: 150.0, lux: -10.0 }
        }
      };

    case 1:
      // Missing required sub-objects (empty metrics) -> should be discarded
      return {
        hardware_id: device.hardwareId,
        timestamp: Date.now(),
        wifi_rssi: -65,
        data: {}
      };

    case 2:
      // NaN or null entries inside telemetry data
      return {
        hardware_id: device.hardwareId,
        timestamp: Date.now(),
        wifi_rssi: -50,
        data: {
          acoustics: { noise_avg: null, noise_peak: null },
          environment: { temperature: null, humidity: null, lux: null }
        }
      };

    case 3:
      // Hardware ID spoofing / mismatch (topic != payload)
      return {
        hardware_id: 'SPOOFED_ID_UNKNOWN',
        timestamp: Date.now(),
        wifi_rssi: -55,
        data: base.data
      };

    default:
      return base;
  }
}
