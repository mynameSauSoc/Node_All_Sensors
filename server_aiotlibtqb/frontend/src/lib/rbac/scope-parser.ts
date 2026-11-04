import type { PermissionName, RoleName } from '@/types/api';

const KNOWN_ROLES = new Set<RoleName>([
  'ADMIN',
  'LIBRARIAN',
  'ZONE_MANAGER',
  'MAINTENANCE',
  'VIEWER',
  'USER',
  'DEVICE',
]);

const KNOWN_PERMISSIONS = new Set<PermissionName>([
  'READ_SENSOR_DATA',
  'READ_SENSOR_DETAIL',
  'WRITE_SENSOR_DATA',
  'VIEW_ALERTS',
  'ACKNOWLEDGE_ALERT',
  'MANAGE_ALERT_CONFIG',
  'MANAGE_DEVICES',
  'VIEW_DEVICE_STATUS',
  'MANAGE_ZONES',
  'VIEW_ZONE_SUMMARY',
  'GENERATE_REPORT',
  'VIEW_ANALYTICS',
  'MANAGE_USERS',
  'MANAGE_ROLES',
]);

export interface ParsedScope {
  username: string | null;
  roles: Set<RoleName>;
  permissions: Set<PermissionName>;
  authorities: Set<string>;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );
  if (typeof atob === 'function') {
    return atob(padded);
  }
  return Buffer.from(padded, 'base64').toString('utf-8');
}

export function parseScopeString(
  scopeString: string | null | undefined,
  subject: string | null = null
): ParsedScope {
  const roles = new Set<RoleName>();
  const permissions = new Set<PermissionName>();
  const authorities = new Set<string>();

  if (scopeString && typeof scopeString === 'string') {
    for (const raw of scopeString.split(/\s+/)) {
      const token = raw.trim().replace(/^ROLE_/, '');
      if (!token) continue;
      authorities.add(token);
      if (KNOWN_ROLES.has(token as RoleName)) {
        roles.add(token as RoleName);
      }
      if (KNOWN_PERMISSIONS.has(token as PermissionName)) {
        permissions.add(token as PermissionName);
      }
    }
  }

  return { username: subject, roles, permissions, authorities };
}

export function decodeJwtScope(jwtToken: string | null | undefined): ParsedScope {
  if (!jwtToken) {
    return parseScopeString('');
  }
  try {
    const parts = jwtToken.split('.');
    if (parts.length < 2) {
      return parseScopeString('');
    }
    const payloadJson = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadJson) as {
      sub?: string;
      scope?: string;
    };
    return parseScopeString(payload.scope ?? '', payload.sub ?? null);
  } catch {
    return parseScopeString('');
  }
}
