import { URL } from 'url';

/**
 * Validates that the targeted MQTT broker or backend is strictly local/loopback
 * unless the user explicitly passes --force-remote.
 */
export function assertSafeTarget(urlStr, forceRemote = false, label = 'MQTT Broker') {
  if (forceRemote) {
    console.warn(`[SAFETY] [WARNING] --force-remote is active. Targeting external ${label}: ${urlStr}`);
    return true;
  }

  try {
    if (!urlStr || typeof urlStr !== 'string') {
      throw new Error('Empty URL');
    }

    const trimmed = urlStr.trim();
    let normalized = trimmed;

    // Normalize MQTT/TCP/TLS/WS/HTTP schemes to standard URL parsing (SIM-05)
    if (/^(tcps|ssl|tls):\/\//i.test(normalized)) {
      normalized = normalized.replace(/^(tcps|ssl|tls):\/\//i, 'mqtts://');
    } else if (/^tcp:\/\//i.test(normalized)) {
      normalized = normalized.replace(/^tcp:\/\//i, 'mqtt://');
    } else if (!/^(mqtts?|wss?|https?):\/\//i.test(normalized)) {
      normalized = `mqtt://${normalized}`;
    }

    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host === 'host.docker.internal' ||
      host === 'mosquitto' ||
      host === 'backend';

    if (!isLocal) {
      const errorMsg =
        `[SAFETY GUARD VIOLATION] Refusing to connect to remote ${label}: "${urlStr}".\n` +
        `Simulator is restricted to local loopback development environments.\n` +
        `To override this safety guard for dedicated testbeds, rerun with --force-remote or FORCE_REMOTE=true.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    return true;
  } catch (err) {
    if (err.message.includes('[SAFETY GUARD VIOLATION]')) {
      throw err;
    }
    throw new Error(`[SAFETY GUARD] Invalid URL format for ${label}: "${urlStr}". Details: ${err.message}`);
  }
}
