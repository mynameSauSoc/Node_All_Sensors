'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Building2,
  Cpu,
  KeyRound,
  LayoutDashboard,
  Map,
  Menu,
  MonitorPlay,
  Radar,
  ShieldAlert,
  Table2,
  UserCircle2,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { useMyInfoQuery } from '@/features/auth/queries';
import { useUnreadAlertsCountQuery } from '@/features/alerts/queries';
import {
  useGlobalAlertStream,
  useStompConnectionState,
} from '@/lib/realtime/use-room-stream';
import { UI_TEXT_VI } from '@/messages/vi';
import { Skeleton, useToast } from '@/components/ui/primitives';
import type { AlertResponse } from '@/types/api';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
  /** Chỉ coi là active khi khớp đúng (không gồm route con). */
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pushToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const user = useAuthStore((s) => s.user);
  const capabilities = useAuthStore((s) => s.capabilities);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const setUser = useAuthStore((s) => s.setUser);

  const stompConnected = useStompConnectionState();

  useEffect(() => {
    const storedRefresh = hydrateFromStorage(false);
    const state = useAuthStore.getState();
    if (!state.accessToken && !storedRefresh) {
      router.replace('/login');
    }
  }, [hydrateFromStorage, router]);

  const hasSessionToken = Boolean(accessToken || refreshToken);
  const myInfoQuery = useMyInfoQuery(hasSessionToken);

  useEffect(() => {
    if (myInfoQuery.data) {
      setUser(myInfoQuery.data);
    }
  }, [myInfoQuery.data, setUser]);

  useEffect(() => {
    if (hydrated && !accessToken && !refreshToken) {
      router.replace('/login');
    }
  }, [hydrated, accessToken, refreshToken, router]);

  // Đóng menu mobile khi đổi trang
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const unreadAlertsQuery = useUnreadAlertsCountQuery(
    Boolean(accessToken && capabilities.canViewAlerts)
  );

  const handleIncomingAlert = useCallback(
    (alert: AlertResponse) => {
      if (alert.status === 'FIRING') {
        pushToast({
          title: 'Cảnh báo mới',
          message: alert.message || `Thiết bị ${alert.hardwareId} phát cảnh báo`,
          variant: 'danger',
        });
      }
    },
    [pushToast]
  );

  useGlobalAlertStream(
    Boolean(accessToken && capabilities.canViewAlerts),
    handleIncomingAlert
  );

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        label: 'Giám sát',
        items: [
          { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, visible: true },
          { href: '/floorplan', label: 'Bản đồ tầng', icon: Map, visible: true },
          {
            href: '/alerts',
            label: 'Cảnh báo',
            icon: ShieldAlert,
            visible: capabilities.canViewAlerts,
          },
          {
            href: '/telemetry-explorer',
            label: 'Dữ liệu cảm biến',
            icon: Table2,
            visible: capabilities.canViewRawTelemetry,
          },
        ],
      },
      {
        label: 'Vận hành',
        items: [
          {
            href: '/admin/rooms',
            label: 'Phòng đọc',
            icon: Building2,
            visible: capabilities.canManageRooms,
          },
          {
            href: '/admin/devices',
            label: 'Thiết bị',
            icon: Cpu,
            visible: capabilities.canViewDevices,
            exact: true,
          },
          {
            href: '/admin/devices/discovery',
            label: 'Thiết bị mới',
            icon: Radar,
            visible: capabilities.canManageDevices,
          },
        ],
      },
      {
        label: 'Quản trị',
        items: [
          {
            href: '/admin/users',
            label: 'Người dùng',
            icon: Users,
            visible: capabilities.canManageUsers,
          },
          {
            href: '/admin/roles',
            label: 'Vai trò & quyền',
            icon: KeyRound,
            visible: capabilities.canManageRoles,
          },
        ],
      },
      {
        label: 'Khác',
        items: [
          { href: '/kiosk', label: 'Màn hình Kiosk', icon: MonitorPlay, visible: true },
        ],
      },
    ],
    [capabilities]
  );

  const isActive = useCallback(
    (item: NavItem) => {
      if (!pathname) return false;
      if (pathname === item.href) return true;
      if (item.exact) {
        // /admin/devices/[id] vẫn thuộc "Thiết bị", nhưng /admin/devices/discovery thì không
        return (
          pathname.startsWith(`${item.href}/`) &&
          !pathname.startsWith(`${item.href}/discovery`)
        );
      }
      return pathname.startsWith(`${item.href}/`);
    },
    [pathname]
  );

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-8">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  const unreadCount = unreadAlertsQuery.data ?? 0;
  const initials = (user?.username?.[0] ?? '?').toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-semibold text-white">
            TQB
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-slate-900">
              {UI_TEXT_VI.appName}
            </span>
            <span className="block text-2xs text-slate-500">Thư viện Tạ Quang Bửu</span>
          </span>
        </Link>
      </div>

      <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        {navGroups.map((group) => {
          const items = group.items.filter((i) => i.visible);
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-5">
              <p className="mb-1 px-2 text-2xs font-medium text-slate-400">{group.label}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                            : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.href === '/alerts' && unreadCount > 0 && (
                          <span className="rounded bg-red-500 px-1.5 text-2xs font-semibold tabular-nums text-white">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/80 p-3">
        <Link
          href="/profile"
          className={`flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-slate-200/50 ${
            pathname === '/profile' ? 'bg-white shadow-xs ring-1 ring-slate-200' : ''
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {initials}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium text-slate-900">
              {user?.username ?? 'Đang tải…'}
            </span>
            <span className="block truncate text-2xs text-slate-500">
              {user?.assignedZones && user.assignedZones.length > 0
                ? `Phân vùng: ${user.assignedZones.join(', ')}`
                : 'Hồ sơ & phiên đăng nhập'}
            </span>
          </span>
          <UserCircle2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );

  const allItems = navGroups.flatMap((g) => g.items);
  const currentTitle =
    pathname === '/profile'
      ? 'Hồ sơ cá nhân'
      : pathname?.startsWith('/rooms/')
      ? 'Chi tiết phòng đọc'
      : pathname?.endsWith('/polygon')
      ? 'Mặt bằng phòng'
      : allItems.find((i) => isActive(i))?.label ?? '';

  return (
    <div className="flex min-h-screen bg-canvas text-slate-900">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-200/80 bg-slate-50 lg:block">
        {sidebar}
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-slate-200 bg-slate-50 shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="btn-icon absolute right-2 top-3"
              aria-label="Đóng menu"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="btn-icon lg:hidden"
              aria-label="Mở menu"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="truncate text-sm font-medium text-slate-900">{currentTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            {!stompConnected && (
              <span
                role="status"
                aria-live="polite"
                title={UI_TEXT_VI.wsReconnectingBanner}
                className="badge-warning"
              >
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Đang kết nối lại realtime…</span>
              </span>
            )}
            {stompConnected && (
              <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Trực tiếp
              </span>
            )}

            {capabilities.canViewAlerts && (
              <Link
                href="/alerts"
                aria-label={`Cảnh báo chưa đọc: ${unreadCount}`}
                className="btn-icon relative"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
