import { profilesConfig } from './config.js';

/**
 * Standard Box-Muller transform for generating normally distributed random values.
 */
function randomGaussian(mean = 0, std = 1) {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * std;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(num, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

/**
 * Generates a realistic telemetry data packet for a device at a specific virtual time.
 * Incorporates baseline, diurnal cycle, crowd effect, profile limits, and sensor noise.
 */
export function generateDeviceTelemetry(device, roomType = 'STUDY_ROOM', virtualTimestamp = Date.now(), modifiers = {}) {
  const profile = profilesConfig[roomType] || profilesConfig.STUDY_ROOM;

  const date = new Date(virtualTimestamp);
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  // Diurnal sinusoidal oscillation: peak around 14:00 (hour 14), minimum around 04:00 (hour 4)
  const diurnalRad = ((hour - 4) / 24) * 2 * Math.PI;
  const diurnalFactor = Math.sin(diurnalRad); // ranges -1 to +1

  // Crowd event factor: library busier during peak hours (10h-12h and 14h-17h)
  let crowdFactor = 0;
  if ((hour >= 10 && hour <= 12) || (hour >= 14 && hour <= 17)) {
    crowdFactor = 0.6 + 0.4 * Math.random(); // human density boost
  } else if (hour >= 21 || hour < 7) {
    crowdFactor = -0.3; // night closure / empty room
  }

  // Micro-climate spatial offsets according to sensor location in room
  let locTempOffset = 0;
  let locHumOffset = 0;
  let locNoiseOffset = 0;
  let locPmOffset = 0;
  let locLuxOffset = 0;

  const loc = ((device.location || '') + ' ' + (device.name || '')).toLowerCase();
  if (loc.includes('cửa sổ') || loc.includes('hướng đông') || loc.includes('window') || loc.includes('nắng')) {
    locTempOffset += 1.8 + Math.max(0, diurnalFactor) * 1.2;
    locHumOffset -= 5.0;
    locLuxOffset += 180.0;
    locNoiseOffset += 3.0;
  } else if (loc.includes('điều hòa') || loc.includes('mát') || loc.includes('khử ẩm')) {
    locTempOffset -= 2.2;
    locHumOffset -= 8.0;
    locPmOffset -= 3.0;
  } else if (loc.includes('cửa ra vào') || loc.includes('hành lang') || loc.includes('cửa xoay') || loc.includes('door') || loc.includes('tiếp đón')) {
    locNoiseOffset += 6.0 + Math.random() * 3.0;
    locPmOffset += 4.5;
    locTempOffset += 0.8;
  } else if (loc.includes('tranh biện') || loc.includes('thảo luận') || loc.includes('thuyết trình') || loc.includes('máy tính')) {
    locNoiseOffset += 8.5 + Math.random() * 5.0;
    locTempOffset += 0.6;
  } else if (loc.includes('yên tĩnh') || loc.includes('sách cổ') || loc.includes('bản thảo')) {
    locNoiseOffset -= 4.0;
    locTempOffset -= 0.5;
    locLuxOffset -= 50.0;
  }

  // 1. Temperature (°C) — enforce profile min/max for normal signal, then apply scenario modifiers
  const tempNoise = randomGaussian(0, profile.temperature.noiseStd);
  const tempBase = profile.temperature.baseline + profile.temperature.diurnalAmplitude * diurnalFactor + crowdFactor * 0.8;
  const tempProfileMin = profile.temperature.min ?? 0.0;
  const tempProfileMax = profile.temperature.max ?? 60.0;
  const tempNormal = clamp(tempBase + tempNoise + locTempOffset, tempProfileMin, tempProfileMax);
  let temp = clamp(tempNormal + (modifiers.tempOffset || 0), 0.0, 60.0);
  if (modifiers.tempOverride !== undefined) temp = modifiers.tempOverride;

  // 2. Humidity (%)
  const humNoise = randomGaussian(0, profile.humidity.noiseStd);
  const humBase = profile.humidity.baseline - profile.humidity.diurnalAmplitude * diurnalFactor + crowdFactor * 1.5;
  const humProfileMin = profile.humidity.min ?? 0.0;
  const humProfileMax = profile.humidity.max ?? 100.0;
  const humNormal = clamp(humBase + humNoise + locHumOffset, humProfileMin, humProfileMax);
  let hum = clamp(humNormal + (modifiers.humidityOffset || 0), 0.0, 100.0);
  if (modifiers.humidityOverride !== undefined) hum = modifiers.humidityOverride;

  // 3. Acoustics (dBA)
  const noiseJitter = randomGaussian(0, profile.acoustics.noiseStd);
  const noiseBase = profile.acoustics.baselineAvg + Math.max(0, profile.acoustics.diurnalAmplitude * diurnalFactor) + crowdFactor * 5.0;
  const noiseProfileMin = profile.acoustics.minAvg ?? 30.0;
  const noiseProfileMax = profile.acoustics.maxAvg ?? 110.0;
  const noiseNormal = clamp(noiseBase + noiseJitter + locNoiseOffset, noiseProfileMin, noiseProfileMax);
  let noiseAvg = clamp(noiseNormal + (modifiers.noiseAvgOffset || 0), 30.0, 110.0);
  if (modifiers.noiseAvgOverride !== undefined) noiseAvg = modifiers.noiseAvgOverride;

  const peakJitter = Math.abs(randomGaussian(profile.acoustics.peakOffset, 3.0));
  let noisePeak = clamp(noiseAvg + peakJitter + (modifiers.noisePeakOffset || 0), noiseAvg, 130.0);
  if (modifiers.noisePeakOverride !== undefined) noisePeak = modifiers.noisePeakOverride;

  // 4. Air Quality PM2.5 (µg/m³) & related PM fractions
  const pmNoise = randomGaussian(0, profile.airQuality.noiseStd);
  const pm25Base = profile.airQuality.baselinePm25 + Math.max(0, profile.airQuality.diurnalAmplitude * diurnalFactor) + crowdFactor * 3.5;
  let pm2_5 = clamp(pm25Base + pmNoise + locPmOffset + (modifiers.pm25Offset || 0), 0.0, 1000.0);
  if (modifiers.pm25Override !== undefined) pm2_5 = modifiers.pm25Override;

  const pm1_0 = clamp(pm2_5 * profile.airQuality.pm1_0Ratio, 0.0, pm2_5);
  const pm4_0 = clamp(pm2_5 * profile.airQuality.pm4_0Ratio, pm2_5, 1000.0);
  const pm10 = clamp(pm2_5 * profile.airQuality.pm10Ratio, pm4_0, 1000.0);

  // 5. Illuminance (Lux)
  const luxProfileMin = profile.lux.min ?? 0.0;
  const luxProfileMax = profile.lux.max ?? 65535.0;
  let luxNormal;
  if (hour >= 6 && hour <= 19) {
    const luxBase = profile.lux.baseline + profile.lux.diurnalAmplitude * Math.max(0, diurnalFactor);
    const luxNoise = randomGaussian(0, profile.lux.noiseStd);
    luxNormal = clamp(luxBase + luxNoise + locLuxOffset, luxProfileMin, luxProfileMax);
  } else {
    // Duy tri anh sang phong hoc chuan mo phong ban ngay / test
    const baseLux = (profile.lux.baseline >= 300) ? 450.0 : profile.lux.baseline;
    luxNormal = clamp(baseLux + locLuxOffset + randomGaussian(0, profile.lux.noiseStd), luxProfileMin, luxProfileMax);
  }
  let lux = clamp(luxNormal + (modifiers.luxOffset || 0), 0.0, 65535.0);
  if (modifiers.luxOverride !== undefined) lux = modifiers.luxOverride;

  // 6. CO2 Concentration (ppm, [350, 5000]) - SCD40 parity
  const co2Base = 450.0 + Math.max(0, 80.0 * diurnalFactor) + crowdFactor * 120.0;
  const co2Noise = randomGaussian(0, 12.0);
  let co2 = clamp(co2Base + co2Noise + (modifiers.co2Offset || 0), 350.0, 5000.0);
  if (modifiers.co2Override !== undefined) co2 = modifiers.co2Override;

  // 7. WiFi RSSI (-35 to -85 dBm)
  const wifiRssi = Math.round(clamp(-58 + randomGaussian(0, 3) + (modifiers.rssiOffset || 0), -85, -35));

  return {
    hardware_id: device.hardwareId,
    timestamp: virtualTimestamp,
    wifi_rssi: wifiRssi,
    data: {
      acoustics: {
        noise_avg: roundTo(noiseAvg, 1),
        noise_peak: roundTo(noisePeak, 1)
      },
      air_quality: {
        pm1_0: roundTo(pm1_0, 1),
        pm2_5: roundTo(pm2_5, 1),
        pm4_0: roundTo(pm4_0, 1),
        pm10: roundTo(pm10, 1)
      },
      environment: {
        temperature: roundTo(temp, 1),
        humidity: roundTo(hum, 1),
        lux: roundTo(lux, 1),
        co2: Math.round(co2)
      }
    }
  };
}

/**
 * Builds standard MQTT status payload matching StatusPayload DTO.
 */
export function buildStatusPayload(hardwareId, status = 'online', reason = 'power_on', uptimeSeconds = 0, firmwareVersion = '1.2.0') {
  return {
    hardware_id: hardwareId,
    status: status,
    reason: reason,
    firmware_version: firmwareVersion,
    uptime_seconds: uptimeSeconds,
    timestamp: Date.now()
  };
}
