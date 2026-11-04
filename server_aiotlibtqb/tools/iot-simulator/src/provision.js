import { env, roomsConfig } from './config.js';
import { assertSafeTarget } from './safety.js';

const FETCH_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs)
  });
}

async function fetchAllPages(baseUrl, path, authHeaders) {
  const items = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages && page < 50) {
    const res = await fetchWithTimeout(`${baseUrl}${path}?page=${page}&size=100`, {
      headers: authHeaders
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const body = await res.json();
    const content = body?.result?.content || [];
    items.push(...content);
    totalPages = typeof body?.result?.totalPages === 'number' ? body.result.totalPages : 1;
    page++;
  }

  return items;
}

/**
 * Idempotent REST provisioner for rooms (with boundaryPolygon) and devices.
 * Connects to backend API, logs in with admin credentials, and ensures
 * all configured rooms and devices exist without duplicates.
 */
export async function provisionInfrastructure(options = {}) {
  const baseUrl = options.apiBaseUrl || env.apiBaseUrl;
  const adminUser = options.adminUsername || env.adminUsername;
  const adminPass = options.adminPassword || env.adminPassword;
  const forceRemote = options.forceRemote ?? env.forceRemote;

  assertSafeTarget(baseUrl, forceRemote, 'Backend REST API');

  console.log(`[PROVISION] Connecting to backend at ${baseUrl}...`);

  // 1. Authenticate with admin account
  let token = null;
  try {
    const loginRes = await fetchWithTimeout(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUser, password: adminPass })
    });

    if (!loginRes.ok) {
      throw new Error(`Admin login failed (HTTP ${loginRes.status})`);
    }

    const loginData = await loginRes.json();
    token = loginData?.result?.token;
    if (!token) {
      throw new Error('No JWT access token returned in login response');
    }
    console.log(`[PROVISION] [SUCCESS] Authenticated as admin user: "${adminUser}".`);
  } catch (err) {
    console.error(`[PROVISION] [FAILED] Authentication error: ${err.message}`);
    throw err;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  // 2. Query existing rooms across all pages
  const roomMap = new Map(); // code -> room object { id, code, name, ... }
  try {
    const existingRooms = await fetchAllPages(baseUrl, '/api/v1/rooms', authHeaders);
    for (const r of existingRooms) {
      if (r.code) roomMap.set(r.code, r);
    }
    console.log(`[PROVISION] Found ${roomMap.size} existing room(s) in backend.`);
  } catch (err) {
    console.warn(`[PROVISION] Error querying rooms: ${err.message}`);
  }

  // 3. Create missing rooms or backfill missing boundaryPolygon
  for (const r of roomsConfig.rooms) {
    if (roomMap.has(r.code)) {
      const existingRoom = roomMap.get(r.code);
      const hasBoundary = Array.isArray(existingRoom.boundaryPolygon) && existingRoom.boundaryPolygon.length >= 3;
      if (!hasBoundary && Array.isArray(r.boundaryPolygon) && r.boundaryPolygon.length >= 3) {
        try {
          const updateRes = await fetchWithTimeout(`${baseUrl}/api/v1/rooms/${existingRoom.id}`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({
              name: r.name,
              floor: r.floor,
              capacity: r.capacity,
              description: r.description,
              targetComfortScore: r.targetComfortScore,
              type: r.type,
              boundaryPolygon: r.boundaryPolygon
            })
          });
          if (updateRes.ok) {
            const updatedData = await updateRes.json();
            if (updatedData?.result) {
              roomMap.set(r.code, updatedData.result);
            }
            console.log(`[PROVISION] [UPDATED] Room [${r.code}] boundaryPolygon synchronized.`);
          }
        } catch (err) {
          console.warn(`[PROVISION] Could not update boundaryPolygon for room [${r.code}]: ${err.message}`);
        }
      } else {
        console.log(`[PROVISION] Room [${r.code}] "${r.name}" already exists (id: ${existingRoom.id}). Skipping creation.`);
      }
      continue;
    }

    try {
      const payload = {
        code: r.code,
        name: r.name,
        floor: r.floor,
        capacity: r.capacity,
        description: r.description,
        targetComfortScore: r.targetComfortScore,
        type: r.type,
        boundaryPolygon: r.boundaryPolygon || null
      };

      const createRes = await fetchWithTimeout(`${baseUrl}/api/v1/rooms`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error(`[PROVISION] Failed to create room [${r.code}]: HTTP ${createRes.status} - ${errText}`);
        continue;
      }

      const created = await createRes.json();
      const createdRoom = created?.result;
      roomMap.set(r.code, createdRoom);
      console.log(`[PROVISION] [CREATED] Room [${r.code}] "${r.name}" created successfully (id: ${createdRoom?.id}).`);
    } catch (err) {
      console.error(`[PROVISION] Error creating room [${r.code}]: ${err.message}`);
    }
  }

  // 4. Query existing devices across all pages
  const deviceMap = new Map(); // hardwareId -> device object
  try {
    const existingDevices = await fetchAllPages(baseUrl, '/api/v1/devices', authHeaders);
    for (const d of existingDevices) {
      if (d.hardwareId) deviceMap.set(d.hardwareId, d);
    }
    console.log(`[PROVISION] Found ${deviceMap.size} existing device(s) in backend.`);
  } catch (err) {
    console.warn(`[PROVISION] Error querying devices: ${err.message}`);
  }

  // 5. Register missing devices & ensure roomId assignment
  for (const d of roomsConfig.devices) {
    const targetRoom = roomMap.get(d.roomCode);
    const targetRoomId = targetRoom?.id || null;

    if (deviceMap.has(d.hardwareId)) {
      const existing = deviceMap.get(d.hardwareId);
      console.log(`[PROVISION] Device [${d.hardwareId}] "${d.name}" already registered (id: ${existing.id}).`);

      const needsUpdate =
        (targetRoomId && existing.roomId !== targetRoomId) ||
        existing.posX !== d.posX ||
        existing.posY !== d.posY ||
        existing.location !== d.location ||
        existing.name !== d.name ||
        existing.zoneId !== d.zoneId;

      if (needsUpdate) {
        try {
          const updatePayload = {
            name: d.name,
            zoneId: d.zoneId,
            roomId: targetRoomId || existing.roomId,
            posX: d.posX,
            posY: d.posY,
            deviceType: d.deviceType || existing.deviceType || 'SENSOR_NODE',
            location: d.location,
            firmwareVersion: d.firmwareVersion || existing.firmwareVersion || '1.2.0'
          };
          const updateRes = await fetchWithTimeout(`${baseUrl}/api/v1/devices/${existing.id}`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify(updatePayload)
          });
          if (updateRes.ok) {
            console.log(`[PROVISION] [UPDATED] Device [${d.hardwareId}] updated with room [${d.roomCode}], pos (${d.posX}, ${d.posY}), loc "${d.location}".`);
          } else {
            console.warn(`[PROVISION] Failed to update device [${d.hardwareId}]: HTTP ${updateRes.status}`);
          }
        } catch (updateErr) {
          console.warn(`[PROVISION] Could not update device metadata: ${updateErr.message}`);
        }
      }
      continue;
    }

    try {
      const regPayload = {
        name: d.name,
        hardwareId: d.hardwareId,
        zoneId: d.zoneId,
        roomId: targetRoomId,
        posX: d.posX,
        posY: d.posY,
        deviceType: d.deviceType || 'SENSOR_NODE',
        location: d.location,
        firmwareVersion: d.firmwareVersion || '1.2.0'
      };

      const regRes = await fetchWithTimeout(`${baseUrl}/api/v1/devices/register`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(regPayload)
      });

      if (!regRes.ok) {
        const errText = await regRes.text();
        console.error(`[PROVISION] Failed to register device [${d.hardwareId}]: HTTP ${regRes.status} - ${errText}`);
        continue;
      }

      const registered = await regRes.json();
      const devInfo = registered?.result;
      deviceMap.set(d.hardwareId, devInfo);
      console.log(`[PROVISION] [REGISTERED] Device [${d.hardwareId}] "${d.name}" registered successfully (id: ${devInfo?.id}).`);
    } catch (err) {
      console.error(`[PROVISION] Error registering device [${d.hardwareId}]: ${err.message}`);
    }
  }

  console.log(`[PROVISION] [COMPLETE] Provisioning finished. Configured rooms: ${roomMap.size}, devices: ${deviceMap.size}.`);
  return { roomMap, deviceMap };
}

// Standalone execution support
if (process.argv[1] && process.argv[1].endsWith('provision.js')) {
  provisionInfrastructure()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error('[PROVISION] Fatal error:', err);
      process.exitCode = 1;
    });
}
