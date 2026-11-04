import type { ParsedScope } from './scope-parser';

/**
 * Single source of truth for RBAC capability checks (FE-RBAC-03).
 * Mirrors Backend @PreAuthorize expressions in §5.2 of FRONTEND_STANDARD.md.
 */
export interface CapabilityMatrix {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLibrarian: boolean;
  isZoneManager: boolean;
  isMaintenance: boolean;
  isViewer: boolean;
  isUser: boolean;
  canViewDashboard: boolean;
  canViewFloorplan: boolean;
  canViewRoomDetail: boolean;
  canViewRawTelemetry: boolean;
  canManageRooms: boolean;
  canDeleteRoom: boolean;
  canViewDevices: boolean;
  canManageDevices: boolean;
  canDeleteDevice: boolean;
  canViewAlerts: boolean;
  canAcknowledgeAlert: boolean;
  canResolveAlert: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
}

function hasAnyAuthority(scope: ParsedScope, ...names: string[]): boolean {
  return names.some((n) => scope.authorities.has(n));
}

export function buildCapabilities(scope: ParsedScope): CapabilityMatrix {
  const isAuthenticated = scope.authorities.size > 0 || scope.username !== null;
  const isAdmin = hasAnyAuthority(scope, 'ADMIN');
  const isLibrarian = hasAnyAuthority(scope, 'LIBRARIAN');
  const isZoneManager = hasAnyAuthority(scope, 'ZONE_MANAGER');
  const isMaintenance = hasAnyAuthority(scope, 'MAINTENANCE');
  const isViewer = hasAnyAuthority(scope, 'VIEWER');
  const isUser = hasAnyAuthority(scope, 'USER');
  const hasExplicitPermissions = scope.permissions.size > 0;

  const canViewTelemetry = hasAnyAuthority(
    scope,
    'ADMIN',
    'LIBRARIAN',
    'ZONE_MANAGER',
    'MAINTENANCE',
    'VIEWER',
    'USER',
    'READ_SENSOR_DATA',
    'READ_SENSOR_DETAIL',
    'VIEW_ZONE_SUMMARY',
    'VIEW_ANALYTICS'
  );

  return {
    isAuthenticated,
    isAdmin,
    isLibrarian,
    isZoneManager,
    isMaintenance,
    isViewer,
    isUser,
    canViewDashboard: canViewTelemetry,
    canViewFloorplan: canViewTelemetry,
    canViewRoomDetail: canViewTelemetry,
    canViewRawTelemetry: hasAnyAuthority(
      scope,
      'ADMIN',
      'LIBRARIAN',
      'ZONE_MANAGER',
      'MAINTENANCE',
      'READ_SENSOR_DETAIL'
    ),
    canManageRooms: hasAnyAuthority(
      scope,
      'ADMIN',
      'LIBRARIAN',
      'MANAGE_ZONES'
    ),
    canDeleteRoom: isAdmin,
    canViewDevices: hasAnyAuthority(
      scope,
      'ADMIN',
      'LIBRARIAN',
      'ZONE_MANAGER',
      'MAINTENANCE',
      'VIEW_DEVICE_STATUS',
      'MANAGE_DEVICES'
    ),
    canManageDevices: hasAnyAuthority(
      scope,
      'ADMIN',
      'LIBRARIAN',
      'MANAGE_DEVICES'
    ),
    canDeleteDevice: isAdmin,
    canViewAlerts:
      isAdmin ||
      hasAnyAuthority(scope, 'VIEW_ALERTS') ||
      (!hasExplicitPermissions &&
        hasAnyAuthority(
          scope,
          'LIBRARIAN',
          'ZONE_MANAGER',
          'MAINTENANCE',
          'VIEWER'
        )),
    canAcknowledgeAlert:
      isAdmin ||
      hasAnyAuthority(scope, 'ACKNOWLEDGE_ALERT', 'MANAGE_ALERT_CONFIG') ||
      (!hasExplicitPermissions &&
        hasAnyAuthority(scope, 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE')),
    canResolveAlert:
      isAdmin ||
      hasAnyAuthority(scope, 'MANAGE_ALERT_CONFIG') ||
      (!hasExplicitPermissions && hasAnyAuthority(scope, 'LIBRARIAN')),
    canManageUsers: hasAnyAuthority(scope, 'ADMIN', 'MANAGE_USERS'),
    canManageRoles: hasAnyAuthority(scope, 'ADMIN', 'MANAGE_ROLES'),
  };
}
