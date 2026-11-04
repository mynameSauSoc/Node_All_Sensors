import mqtt from 'mqtt';
import { env, roomsConfig } from './config.js';
import { assertSafeTarget } from './safety.js';
import { generateDeviceTelemetry, buildStatusPayload } from './signalModel.js';
import { SCENARIOS, getScenarioModifiers, generateBadPayloadSample } from './scenarios.js';
import { provisionInfrastructure } from './provision.js';

export class IoTCircuitSimulator {
  constructor(options = {}) {
    this.brokerUrl = options.brokerUrl || env.mqttBrokerUrl;
    this.perDeviceAuth = options.perDeviceAuth ?? env.mqttPerDeviceAuth;
    this.username = options.username ?? env.mqttUsername;
    this.password = options.password ?? env.mqttPassword;
    this.devicePassword = options.devicePassword ?? env.mqttDevicePassword;
    this.clientPrefix = options.clientPrefix || env.mqttClientPrefix;
    this.keepalive = options.keepalive || env.mqttKeepalive;
    this.connectTimeoutMs = options.connectTimeoutMs || 10000;

    this.scenario = options.scenario || env.defaultScenario || SCENARIOS.NORMAL;

    const parsedSpeed = parseFloat(options.speed ?? env.simSpeed ?? 1);
    this.speed = Number.isFinite(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : 1;

    const parsedInterval = parseInt(options.intervalMs ?? env.simIntervalMs ?? 5000, 10);
    this.intervalMs = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 5000;

    const parsedDuration = options.duration !== undefined ? parseInt(options.duration, 10) : 0;
    this.durationSec = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 0;

    const parsedDevices = options.devices !== undefined && options.devices !== null
      ? parseInt(options.devices, 10)
      : null;
    this.deviceCountLimit = Number.isFinite(parsedDevices) && parsedDevices > 0 ? parsedDevices : null;

    this.forceRemote = options.forceRemote ?? env.forceRemote;
    this.autoProvision = options.provision ?? false;

    this.isRunning = false;
    this.devices = [];
    this.clients = new Map(); // hardwareId -> mqtt client
    this.timer = null;
    this.durationTimer = null;
    this.startTime = 0;
    this.virtualSimTime = Date.now();
    this.stepCount = 0;
    this.metricsCount = 0;
  }

  async start() {
    assertSafeTarget(this.brokerUrl, this.forceRemote, 'MQTT Broker');

    if (this.autoProvision) {
      console.log('[SIM] Running infrastructure pre-provisioning...');
      try {
        await provisionInfrastructure({ forceRemote: this.forceRemote });
      } catch (err) {
        console.warn(`[SIM] Pre-provisioning had warnings/errors: ${err.message}. Continuing with simulator...`);
      }
    }

    // Select configured devices
    let targetDevices = [...roomsConfig.devices];
    if (this.deviceCountLimit && this.deviceCountLimit > 0) {
      targetDevices = targetDevices.slice(0, this.deviceCountLimit);
    }
    this.devices = targetDevices;

    if (this.devices.length === 0) {
      throw new Error('No devices configured to simulate.');
    }

    console.log('========================================================================');
    console.log(' AIoTLibTQB IoT Circuit Simulator Engine');
    console.log(` Broker:      ${this.brokerUrl}`);
    console.log(` Auth Mode:   ${this.perDeviceAuth ? 'Per-Device ACL (%u = hardwareId)' : `Shared User (${this.username || 'anonymous'})`}`);
    console.log(` Scenario:    ${this.scenario}`);
    console.log(` Speed:       ${this.speed}x`);
    console.log(` Interval:    ${this.intervalMs} ms`);
    console.log(` Duration:    ${this.durationSec > 0 ? this.durationSec + ' s' : 'Infinite (Ctrl+C to stop)'}`);
    console.log(` Devices:     ${this.devices.length} (${this.devices.map(d => d.hardwareId).join(', ')})`);
    console.log('========================================================================');

    this.isRunning = true;
    this.startTime = Date.now();
    this.virtualSimTime = Date.now();

    // Schedule duration timer for ALL scenarios if specified (SIM-04)
    if (this.durationSec > 0) {
      this.durationTimer = setTimeout(async () => {
        console.log(`[SIM] Duration of ${this.durationSec}s reached. Gracefully stopping simulator...`);
        await this.stop();
      }, this.durationSec * 1000);
    }

    // Connect MQTT client for each device
    for (const dev of this.devices) {
      await this.connectDevice(dev);
    }

    // Handle special scenarios
    if (this.scenario === SCENARIOS.LWT) {
      await this.runLwtScenario();
      return;
    }

    if (this.scenario === SCENARIOS.BURST) {
      await this.runBurstScenario();
      return;
    }

    if (this.scenario === SCENARIOS.FLAP) {
      this.runFlapScenario();
      return;
    }

    // Standard interval telemetry loop
    this.timer = setInterval(() => {
      this.tick();
    }, this.intervalMs);

    // Initial immediate tick
    this.tick();
  }

  async connectDevice(device) {
    return new Promise((resolve, reject) => {
      const clientId = `${this.clientPrefix}${device.hardwareId}_${Math.random().toString(16).substring(2, 6)}`;
      const statusTopic = `devices/${device.hardwareId}/status`;

      // Resolve per-device MQTT credentials so Mosquitto %u ACL isolates each device (MQTT-01)
      const mqttUsername = this.perDeviceAuth
        ? (device.mqttUsername || device.hardwareId)
        : this.username;
      const mqttPassword = this.perDeviceAuth
        ? (device.mqttPassword || this.devicePassword || this.password)
        : this.password;

      // Configure Last Will and Testament (LWT)
      const willPayload = JSON.stringify({
        hardware_id: device.hardwareId,
        status: 'offline',
        reason: 'lwt',
        timestamp: Date.now()
      });

      let settled = false;
      const timeoutHandle = setTimeout(() => {
        if (!settled) {
          settled = true;
          client.end(true);
          reject(new Error(`Timeout (${this.connectTimeoutMs}ms) connecting device [${device.hardwareId}] to ${this.brokerUrl}`));
        }
      }, this.connectTimeoutMs);

      const client = mqtt.connect(this.brokerUrl, {
        clientId: clientId,
        username: mqttUsername || undefined,
        password: mqttPassword || undefined,
        clean: true,
        keepalive: this.keepalive,
        reconnectPeriod: 2000,
        connectTimeout: this.connectTimeoutMs,
        will: {
          topic: statusTopic,
          payload: willPayload,
          qos: 1,
          retain: false
        }
      });

      client.on('connect', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutHandle);
        }
        console.log(`[MQTT] [CONNECTED] Device [${device.hardwareId}] connected as "${mqttUsername || 'anonymous'}" (clientId: ${clientId})`);

        // Send initial online status
        const onlinePayload = buildStatusPayload(device.hardwareId, 'online', 'power_on', 0, device.firmwareVersion);
        client.publish(statusTopic, JSON.stringify(onlinePayload), { qos: 1 }, (err) => {
          if (err) console.error(`[MQTT] Failed to publish online status for ${device.hardwareId}:`, err);
        });

        resolve();
      });

      client.on('error', (err) => {
        console.error(`[MQTT] [ERROR] Device [${device.hardwareId}]: ${err.message}`);
        if (!settled) {
          settled = true;
          clearTimeout(timeoutHandle);
          client.end(true);
          reject(err);
        }
      });

      this.clients.set(device.hardwareId, client);
    });
  }

  tick() {
    if (!this.isRunning) return;

    this.stepCount++;
    const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);

    // Advance virtual simulation time by interval * speed
    this.virtualSimTime += Math.round(this.intervalMs * this.speed);

    for (const dev of this.devices) {
      const client = this.clients.get(dev.hardwareId);
      if (!client || !client.connected) continue;

      // Handle device-dropout scenario
      if (this.scenario === SCENARIOS.DEVICE_DROPOUT && this.stepCount > 2) {
        if (dev.hardwareId === this.devices[0].hardwareId) {
          if (this.stepCount === 3) {
            console.warn(`[SIM] [SCENARIO: device-dropout] Device [${dev.hardwareId}] ceasing transmission. Watchdog should mark OFFLINE after 2 minutes.`);
          }
          continue; // Dropout: stop sending telemetry
        }
      }

      // Handle bad-payload scenario
      if (this.scenario === SCENARIOS.BAD_PAYLOAD) {
        const badPayload = generateBadPayloadSample(dev, this.stepCount);
        const topic = `devices/${dev.hardwareId}/telemetry`;
        client.publish(topic, JSON.stringify(badPayload), { qos: 1 });
        this.metricsCount++;
        console.log(`[SIM] [PUBLISH: bad-payload] [${dev.hardwareId}] -> ${topic}: ${JSON.stringify(badPayload)}`);
        continue;
      }

      // Find room configuration
      const room = roomsConfig.rooms.find(r => r.code === dev.roomCode);
      const roomType = room?.type || 'STUDY_ROOM';

      const modifiers = getScenarioModifiers(this.scenario, dev, this.stepCount, elapsedSec);
      const telemetry = generateDeviceTelemetry(dev, roomType, this.virtualSimTime, modifiers);

      const topic = `devices/${dev.hardwareId}/telemetry`;
      const payloadStr = JSON.stringify(telemetry);

      client.publish(topic, payloadStr, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[SIM] Failed to publish telemetry for [${dev.hardwareId}]:`, err);
        }
      });

      this.metricsCount++;
      const metricsSummary =
        `T=${telemetry.data.environment.temperature}°C, ` +
        `H=${telemetry.data.environment.humidity}%, ` +
        `NoiseAvg=${telemetry.data.acoustics.noise_avg}dBA, ` +
        `NoisePeak=${telemetry.data.acoustics.noise_peak}dBA, ` +
        `PM2.5=${telemetry.data.air_quality.pm2_5}µg/m³, ` +
        `Lux=${telemetry.data.environment.lux}`;

      console.log(`[SIM] [STEP ${this.stepCount} | +${elapsedSec}s] [${dev.hardwareId} | ${room?.name || dev.roomCode}] -> ${metricsSummary}`);
    }
  }

  async runLwtScenario() {
    if (!this.devices || this.devices.length === 0) return;
    console.log('[SIM] [SCENARIO: lwt] Demonstrating Last Will and Testament...');
    const dev = this.devices[0];
    const client = this.clients.get(dev.hardwareId);
    if (!client) return;

    await new Promise(r => setTimeout(r, 1000));

    // Send one normal telemetry packet
    const t = generateDeviceTelemetry(dev, 'STUDY_ROOM', Date.now());
    client.publish(`devices/${dev.hardwareId}/telemetry`, JSON.stringify(t), { qos: 1 });
    this.metricsCount++;
    console.log(`[SIM] Sent pre-dropout telemetry for [${dev.hardwareId}]. Now forcefully destroying socket without MQTT DISCONNECT...`);

    setTimeout(() => {
      // Disable auto-reconnect before destroying socket so client doesn't immediately reconnect and overwrite LWT with power_on (SIM-04)
      if (client.options) {
        client.options.reconnectPeriod = 0;
      }
      client.reconnecting = false;

      if (client.stream) {
        client.stream.destroy();
      } else {
        client.end(true);
      }
      console.log(`[SIM] [LWT TRIGGERED] Socket terminated for [${dev.hardwareId}] (auto-reconnect disabled). Broker will dispatch LWT offline status to devices/${dev.hardwareId}/status.`);
    }, 1500);
  }

  async runBurstScenario() {
    if (!this.devices || this.devices.length === 0) return;
    console.log('[SIM] [SCENARIO: burst] Executing rapid burst of 100 messages to test MongoDB Semaphore limits (30 permits, 3000ms timeout)...');
    const dev = this.devices[0];
    const client = this.clients.get(dev.hardwareId);
    if (!client) return;

    await new Promise(r => setTimeout(r, 1000));

    const totalBurst = 100;
    let sent = 0;
    const publishPromises = [];
    for (let i = 0; i < totalBurst; i++) {
      const t = generateDeviceTelemetry(dev, 'STUDY_ROOM', Date.now() + i * 10);
      publishPromises.push(
        new Promise((resolve) => {
          client.publish(`devices/${dev.hardwareId}/telemetry`, JSON.stringify(t), { qos: 1 }, () => resolve());
        })
      );
      sent++;
      this.metricsCount++;
    }
    await Promise.allSettled(publishPromises);
    console.log(`[SIM] [BURST COMPLETE] Dispatched and acknowledged ${sent} telemetry messages.`);

    if (this.durationSec === 0) {
      await this.stop();
    }
  }

  runFlapScenario() {
    if (!this.devices || this.devices.length === 0) return;
    console.log('[SIM] [SCENARIO: flap] Rapid connection flapping simulation active...');
    let state = true;
    const dev = this.devices[0];
    const client = this.clients.get(dev.hardwareId);
    if (!client) return;

    this.timer = setInterval(() => {
      state = !state;
      const status = state ? 'online' : 'offline';
      const reason = state ? 'reconnected' : 'network_flap';
      const p = buildStatusPayload(dev.hardwareId, status, reason, 10, dev.firmwareVersion);
      client.publish(`devices/${dev.hardwareId}/status`, JSON.stringify(p), { qos: 1 });
      this.metricsCount++;
      console.log(`[SIM] [FLAP] Device [${dev.hardwareId}] toggled connectionState -> ${status.toUpperCase()} (${reason})`);
    }, 2500);
  }

  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.durationTimer) {
      clearTimeout(this.durationTimer);
      this.durationTimer = null;
    }

    console.log('[SIM] Shutting down simulator clients...');

    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const closePromises = [];

    for (const [hwId, client] of this.clients.entries()) {
      closePromises.push(
        new Promise((resolve) => {
          const forceTimeout = setTimeout(() => {
            try {
              client.end(true);
            } catch {
              // ignore
            }
            resolve();
          }, 1500);

          if (!client.connected) {
            clearTimeout(forceTimeout);
            try {
              client.end(true);
            } catch {
              // ignore
            }
            resolve();
            return;
          }

          try {
            const offlinePayload = buildStatusPayload(hwId, 'offline', 'graceful_shutdown', uptimeSec);
            client.publish(`devices/${hwId}/status`, JSON.stringify(offlinePayload), { qos: 1 }, () => {
              client.end(false, {}, () => {
                clearTimeout(forceTimeout);
                resolve();
              });
            });
          } catch {
            clearTimeout(forceTimeout);
            client.end(true);
            resolve();
          }
        })
      );
    }

    await Promise.allSettled(closePromises);
    this.clients.clear();
    console.log(`[SIM] [STOPPED] Total published messages: ${this.metricsCount}. Virtual duration: ${this.stepCount} steps.`);
    process.exitCode = 0;
  }
}

/**
 * Parses CLI arguments while preserving environment variable defaults when flags are omitted (SIM-02).
 */
export function parseCliArgs(argv = process.argv.slice(2), baseEnv = env) {
  const args = {
    scenario: baseEnv.defaultScenario || 'normal',
    speed: baseEnv.simSpeed || 1,
    intervalMs: baseEnv.simIntervalMs || 5000,
    duration: 0,
    devices: null,
    forceRemote: Boolean(baseEnv.forceRemote),
    provision: false,
    brokerUrl: baseEnv.mqttBrokerUrl || null,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scenario' && argv[i + 1]) {
      args.scenario = argv[++i];
    } else if (a === '--speed' && argv[i + 1]) {
      const val = parseFloat(argv[++i]);
      if (!Number.isFinite(val) || val <= 0) {
        throw new Error(`Invalid --speed value. Must be a positive number.`);
      }
      args.speed = val;
    } else if (a === '--interval' && argv[i + 1]) {
      const val = parseFloat(argv[++i]);
      if (!Number.isFinite(val) || val <= 0) {
        throw new Error(`Invalid --interval value. Must be a positive number of seconds.`);
      }
      args.intervalMs = Math.round(val * 1000);
    } else if (a === '--duration' && argv[i + 1]) {
      const val = parseInt(argv[++i], 10);
      if (!Number.isFinite(val) || val < 0) {
        throw new Error(`Invalid --duration value. Must be a non-negative integer.`);
      }
      args.duration = val;
    } else if (a === '--devices' && argv[i + 1]) {
      const val = parseInt(argv[++i], 10);
      if (!Number.isFinite(val) || val <= 0) {
        throw new Error(`Invalid --devices value. Must be a positive integer.`);
      }
      args.devices = val;
    } else if (a === '--broker' && argv[i + 1]) {
      args.brokerUrl = argv[++i];
    } else if (a === '--force-remote') {
      args.forceRemote = true;
    } else if (a === '--provision') {
      args.provision = true;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    }
  }

  return args;
}

// Direct execution helper
export function runCli(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseCliArgs(argv, env);
  } catch (err) {
    console.error(`[SIM] Argument error: ${err.message}`);
    process.exitCode = 1;
    return null;
  }

  if (args.help) {
    console.log(`
Usage: iot-sim [options]

Options:
  --scenario <name>     Scenario to simulate:
                        normal | noise-spike | pm25-high | heat/humid |
                        device-dropout | flap | lwt | bad-payload | burst | demo
                        (default: DEFAULT_SCENARIO or normal)
  --speed <number>      Time acceleration multiplier (default: SIM_SPEED or 1)
  --interval <seconds>  Interval between telemetry broadcasts per device (default: SIM_INTERVAL_MS or 5s)
  --duration <seconds>  Total duration in seconds to run before auto-stop (default: 0 = infinite)
  --devices <count>     Limit number of devices simulated (default: all in config)
  --broker <url>        MQTT broker URL (default: MQTT_BROKER_URL or mqtt://localhost:1883)
  --provision           Automatically run idempotent REST provisioning first
  --force-remote        Allow connecting to external/non-localhost MQTT broker
  --help, -h            Show this help manual
    `);
    return null;
  }

  const sim = new IoTCircuitSimulator(args);

  process.once('SIGINT', async () => {
    console.log('\n[SIM] Caught SIGINT. Exiting...');
    await sim.stop();
  });
  process.once('SIGTERM', async () => {
    console.log('\n[SIM] Caught SIGTERM. Exiting...');
    await sim.stop();
  });

  sim.start().catch((err) => {
    console.error('[SIM] Fatal error starting simulator:', err);
    process.exitCode = 1;
  });

  return sim;
}

// Only auto-execute when src/index.js is invoked directly (NOT when imported by bin/cli.js - SIM-01)
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  runCli();
}
