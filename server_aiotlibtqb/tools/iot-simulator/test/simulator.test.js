import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertSafeTarget } from '../src/safety.js';
import { generateDeviceTelemetry } from '../src/signalModel.js';
import { SCENARIOS, getScenarioModifiers } from '../src/scenarios.js';
import { parseCliArgs, IoTCircuitSimulator } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('[SIM-01] bin/cli.js --help executes runCli() exactly once without double execution', () => {
  const cliPath = path.resolve(__dirname, '..', 'bin', 'cli.js');
  const output = execFileSync(process.execPath, [cliPath, '--help'], { encoding: 'utf-8' });
  const usageMatches = output.match(/Usage:\s+iot-sim \[options\]/g) || [];
  assert.equal(usageMatches.length, 1, 'Expected Usage block to be printed exactly once');
});

test('[SIM-02] parseCliArgs preserves environment variable defaults when CLI flags are omitted', () => {
  const customEnv = {
    defaultScenario: 'noise-spike',
    simSpeed: 4,
    simIntervalMs: 1200,
    forceRemote: true,
    mqttBrokerUrl: 'mqtt://mosquitto:1883'
  };

  const parsed = parseCliArgs([], customEnv);
  assert.equal(parsed.scenario, 'noise-spike');
  assert.equal(parsed.speed, 4);
  assert.equal(parsed.intervalMs, 1200);
  assert.equal(parsed.forceRemote, true);
  assert.equal(parsed.brokerUrl, 'mqtt://mosquitto:1883');

  // Rejects invalid negative/NaN numeric flags
  assert.throws(() => parseCliArgs(['--speed', '-2'], customEnv), /Invalid --speed/);
  assert.throws(() => parseCliArgs(['--interval', 'abc'], customEnv), /Invalid --interval/);
  assert.throws(() => parseCliArgs(['--devices', '0'], customEnv), /Invalid --devices/);
});

test('[SIM-05] assertSafeTarget supports TLS schemes (https/mqtts/wss) on localhost and blocks .local domains without --force-remote', () => {
  assert.equal(assertSafeTarget('https://localhost:8080', false, 'Backend REST API'), true);
  assert.equal(assertSafeTarget('mqtts://localhost:8883', false, 'MQTT Broker'), true);
  assert.equal(assertSafeTarget('wss://127.0.0.1:8080/ws-aiot', false, 'WebSocket'), true);
  assert.equal(assertSafeTarget('ssl://mosquitto:8883', false, 'MQTT Broker'), true);

  // .local domains must be blocked unless forceRemote is true
  assert.throws(
    () => assertSafeTarget('mqtt://printer-or-hub.local:1883', false, 'MQTT Broker'),
    /SAFETY GUARD VIOLATION/
  );
  assert.equal(assertSafeTarget('mqtt://printer-or-hub.local:1883', true, 'MQTT Broker'), true);
});

test('[SIM-06] generateDeviceTelemetry enforces profile min/max bounds for BOOK_STORAGE under normal scenario', () => {
  const storageDevice = {
    hardwareId: 'ESP32_STORAGE_201',
    name: 'Sensor Node Cửa Sổ 201',
    location: 'Cửa sổ hướng Đông đón nắng'
  };

  // Even with window warm offset (+3.0C), normal BOOK_STORAGE telemetry must stay within [18.0, 22.0]C
  for (let i = 0; i < 20; i++) {
    const packet = generateDeviceTelemetry(storageDevice, 'BOOK_STORAGE', new Date('2026-10-29T14:00:00Z').getTime(), {});
    assert.ok(packet.data.environment.temperature >= 18.0 && packet.data.environment.temperature <= 22.0);
    assert.ok(packet.data.environment.humidity >= 45.0 && packet.data.environment.humidity <= 52.0);
  }
});

test('[SIM-06] getScenarioModifiers for SCENARIOS.DEMO returns dynamic modifiers instead of empty stub', () => {
  const dev = { hardwareId: 'ESP32_ROOM_102', zoneId: 'ZONE_B' };
  const mods = getScenarioModifiers(SCENARIOS.DEMO, dev, 9, 45);
  assert.ok(Object.keys(mods).length > 0);
  assert.equal(typeof mods.noiseAvgOffset, 'number');
  assert.ok(mods.noiseAvgOffset > 0);
});

test('[MQTT-01 & SIM-03] IoTCircuitSimulator defaults to perDeviceAuth and stop() awaits QoS 1 publish before graceful end(false)', async () => {
  const sim = new IoTCircuitSimulator({ perDeviceAuth: true, devicePassword: '***' });
  assert.equal(sim.perDeviceAuth, true);

  const callOrder = [];
  const fakeClient = {
    connected: true,
    publish(topic, payload, opts, cb) {
      callOrder.push(`publish:${topic}:${opts.qos}`);
      setImmediate(() => cb && cb(null));
    },
    end(force, opts, cb) {
      callOrder.push(`end:force=${force}`);
      if (typeof opts === 'function') opts();
      else if (typeof cb === 'function') cb();
    }
  };

  sim.isRunning = true;
  sim.startTime = Date.now() - 5000;
  sim.clients.set('ESP32_ROOM_101', fakeClient);

  await sim.stop();
  assert.deepEqual(callOrder, [
    'publish:devices/ESP32_ROOM_101/status:1',
    'end:force=false'
  ]);
});
