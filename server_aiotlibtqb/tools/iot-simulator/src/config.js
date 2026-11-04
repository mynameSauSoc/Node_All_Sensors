import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from tools/iot-simulator/.env or current working directory
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

function loadJson(relativePath) {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw);
}

export const roomsConfig = loadJson('config/rooms.json');
export const profilesConfig = loadJson('config/profiles.json');

const rawKeepalive = parseInt(process.env.MQTT_KEEPALIVE || '30', 10);
const rawIntervalMs = parseInt(process.env.SIM_INTERVAL_MS || '5000', 10);
const rawSpeed = parseFloat(process.env.SIM_SPEED || '1');

export const env = {
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  mqttPerDeviceAuth: process.env.MQTT_PER_DEVICE_AUTH !== 'false',
  mqttUsername: process.env.MQTT_USERNAME || '',
  mqttPassword: process.env.MQTT_PASSWORD || '',
  mqttDevicePassword: process.env.MQTT_DEVICE_PASSWORD || process.env.MQTT_PASSWORD || '',
  mqttClientPrefix: process.env.MQTT_CLIENT_PREFIX || 'sim_node_',
  mqttKeepalive: Number.isFinite(rawKeepalive) && rawKeepalive > 0 ? rawKeepalive : 30,

  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8080',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',

  simIntervalMs: Number.isFinite(rawIntervalMs) && rawIntervalMs > 0 ? rawIntervalMs : 5000,
  simSpeed: Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : 1,
  defaultScenario: process.env.DEFAULT_SCENARIO || 'normal',

  forceRemote: process.env.FORCE_REMOTE === 'true'
};
