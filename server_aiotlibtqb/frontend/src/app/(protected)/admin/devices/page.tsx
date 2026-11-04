'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  Plus,
  Radar,
  RotateCw,
} from 'lucide-react';
import {
  ConnectionBadge,
  EmptyState,
  ErrorBanner,
  ModalDialog,
  PaginationBar,
  Skeleton,
  useToast,
} from '@/components/ui/primitives';
import { useAuthStore } from '@/features/auth/store';
import { OneTimeKeyDialog } from '@/features/devices/components/OneTimeKeyDialog';
import {
  useDevicesQuery,
  useRegisterDeviceMutation,
  useToggleDeviceStatusMutation,
} from '@/features/devices/queries';
import { useRoomsQuery } from '@/features/rooms/queries';
import {
  formatRelativeTimeVi,
  formatVietnamDateTime,
} from '@/lib/format/datetime';
import { ApiError } from '@/lib/http/error-mapper';
import { ERROR_MESSAGES_VI } from '@/messages/vi';

interface RegisterDeviceForm {
  name: string;
  hardwareId: string;
  zoneId: string;
  roomId: string;
  deviceType: string;
  location: string;
  posX: string;
  posY: string;
}

const DEFAULT_REGISTER_FORM: RegisterDeviceForm = {
  name: '',
  hardwareId: '',
  zoneId: 'ZONE_FLOOR_1',
  roomId: '',
  deviceType: 'ESP32_MULTI_SENSOR',
  location: '',
  posX: '0.5',
  posY: '0.5',
};

function AdminDevicesPageContent() {
  const capabilities = useAuthStore((s) => s.capabilities);
  const { pushToast } = useToast();
  const searchParams = useSearchParams();
  const initialRoomId = searchParams.get('roomId') ?? '';

  const [page, setPage] = useState(0);
  const [zoneIdFilter, setZoneIdFilter] = useState('');
  const [roomIdFilter, setRoomIdFilter] = useState(initialRoomId);

  useEffect(() => {
    const paramRoomId = searchParams.get('roomId');
    if (paramRoomId) {
      setRoomIdFilter(paramRoomId);
      setPage(0);
    }
  }, [searchParams]);

  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const roomsQuery = useRoomsQuery({ page: 0, size: 100 });
  const rooms = roomsQuery.data?.content ?? [];
  const roomMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string; floor: number }>();
    for (const r of rooms) {
      map.set(r.id, { code: r.code, name: r.name, floor: r.floor });
    }
    return map;
  }, [rooms]);

  const devicesQuery = useDevicesQuery(
    {
      page,
      size: 10,
      zoneId: zoneIdFilter.trim() || undefined,
      roomId: roomIdFilter || undefined,
    },
    capabilities.canViewDevices
  );

  const toggleStatusMutation = useToggleDeviceStatusMutation();
  const registerMutation = useRegisterDeviceMutation();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState<RegisterDeviceForm>(
    DEFAULT_REGISTER_FORM
  );
  const [registerError, setRegisterError] = useState<string | null>(null);

  const [keyDialogState, setKeyDialogState] = useState<{
    open: boolean;
    deviceName: string;
    hardwareId: string;
    rawApiKey: string | null;
    alreadyExisted?: boolean;
  }>({
    open: false,
    deviceName: '',
    hardwareId: '',
    rawApiKey: null,
    alreadyExisted: false,
  });

  const handleToggleActive = async (
    deviceId: string,
    deviceName: string,
    nextActive: boolean
  ) => {
    try {
      await toggleStatusMutation.mutateAsync({
        id: deviceId,
        active: nextActive,
      });
      pushToast({
        title: 'Cập nhật trạng thái',
        message: `Thiết bị ${deviceName} đã ${nextActive ? 'được bật' : 'bị tắt'}.`,
        variant: 'success',
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Không thể cập nhật trạng thái thiết bị.';
      pushToast({
        title: 'Cập nhật thất bại',
        message: msg,
        variant: 'danger',
      });
    }
  };

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    const hwId = registerForm.hardwareId.trim();
    const name = registerForm.name.trim();
    const zoneId = registerForm.zoneId.trim();

    if (!hwId || !name || !zoneId) {
      setRegisterError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
      return;
    }

    const posX = parseFloat(registerForm.posX);
    const posY = parseFloat(registerForm.posY);

    try {
      const res = await registerMutation.mutateAsync({
        hardwareId: hwId,
        name,
        zoneId,
        roomId: registerForm.roomId || undefined,
        deviceType: registerForm.deviceType || 'ESP32_MULTI_SENSOR',
        location: registerForm.location || undefined,
        posX: Number.isNaN(posX) ? 0.5 : posX,
        posY: Number.isNaN(posY) ? 0.5 : posY,
      });

      setRegisterOpen(false);
      setRegisterForm(DEFAULT_REGISTER_FORM);

      setKeyDialogState({
        open: true,
        deviceName: res.name,
        hardwareId: res.hardwareId,
        rawApiKey: res.rawApiKey,
        alreadyExisted: res.alreadyExisted,
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Đăng ký thiết bị thất bại.';
      setRegisterError(msg);
    }
  };

  if (!capabilities.canViewDevices) {
    return (
      <div className="page">
        <ErrorBanner message="Bạn không có quyền truy cập danh sách thiết bị." />
      </div>
    );
  }

  const devicesPage = devicesQuery.data;
  const devices = devicesPage?.content ?? [];
  const totalPages = devicesPage?.totalPages ?? 1;
  const totalElements = devicesPage?.totalElements ?? 0;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Thiết bị Đo IoT</h1>
          <p className="page-subtitle">
            Giám sát trạng thái trạm đo ESP32, phân bổ phòng đọc và kích hoạt vận hành
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {capabilities.canManageDevices && (
            <>
              <Link
                href="/admin/devices/discovery"
                className="btn-secondary btn-sm"
              >
                <Radar className="h-4 w-4 text-brand-600" aria-hidden="true" />
                <span>Phát hiện ESP32 mới</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setRegisterError(null);
                  setRegisterOpen(true);
                }}
                className="btn-primary btn-sm"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Đăng ký thiết bị</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="filter-zone" className="label">
              Mã phân vùng (Zone ID)
            </label>
            <input
              id="filter-zone"
              type="text"
              value={zoneIdFilter}
              onChange={(e) => {
                setZoneIdFilter(e.target.value);
                setPage(0);
              }}
              placeholder="VD: ZONE_FLOOR_1..."
              className="input text-xs"
            />
          </div>

          <div>
            <label htmlFor="filter-room" className="label">
              Phòng đọc gắn kèm
            </label>
            <select
              id="filter-room"
              value={roomIdFilter}
              onChange={(e) => {
                setRoomIdFilter(e.target.value);
                setPage(0);
              }}
              className="select text-xs"
            >
              <option value="">-- Tất cả phòng đọc --</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  [{room.code}] {room.name} (Tầng {room.floor})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => {
                setZoneIdFilter('');
                setRoomIdFilter('');
                setPage(0);
              }}
              className="btn-secondary btn-sm flex-1"
            >
              Đặt lại
            </button>
            <button
              type="button"
              onClick={() => void devicesQuery.refetch()}
              className="btn-secondary btn-sm"
              aria-label="Làm mới"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* 4-State Table View */}
      <div className="card">
        {devicesQuery.isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : devicesQuery.isError ? (
          <div className="p-5">
            <ErrorBanner
              message={
                devicesQuery.error instanceof ApiError
                  ? devicesQuery.error.message
                  : ERROR_MESSAGES_VI[9999]
              }
              onRetry={() => void devicesQuery.refetch()}
            />
          </div>
        ) : devices.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Chưa có thiết bị nào phù hợp bộ lọc"
              description="Bạn có thể cấp phát tự động từ hàng đợi phát hiện ESP32 hoặc đăng ký thủ công."
              actionLabel={
                capabilities.canManageDevices ? 'Đăng ký thiết bị mới' : undefined
              }
              onAction={
                capabilities.canManageDevices
                  ? () => setRegisterOpen(true)
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên trạm & Phần cứng</th>
                    <th>Phân vùng / Phòng đọc</th>
                    <th>Trạng thái kết nối</th>
                    <th>Lần cuối gửi tin</th>
                    <th>Kích hoạt</th>
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => {
                    const roomInfo = device.roomId
                      ? roomMap.get(device.roomId)
                      : undefined;

                    return (
                      <tr key={device.id}>
                        <td>
                          <div className="font-semibold text-slate-900">
                            {device.name}
                          </div>
                          <div className="font-mono text-2xs text-slate-400">
                            {device.hardwareId} · {device.deviceType}
                          </div>
                        </td>

                        <td>
                          <span className="badge-neutral font-mono">
                            {device.zoneId}
                          </span>
                          <div className="mt-1 text-xs text-slate-600">
                            {roomInfo ? (
                              <Link
                                href={`/rooms/${device.roomId}`}
                                className="font-medium text-brand-600 hover:text-brand-700"
                              >
                                [{roomInfo.code}] {roomInfo.name}
                              </Link>
                            ) : device.roomId ? (
                              <span>Phòng: {device.roomId}</span>
                            ) : (
                              <span className="text-slate-400 italic">
                                Chưa gán phòng
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap">
                          <ConnectionBadge
                            online={device.online}
                            connectionState={device.connectionState}
                          />
                        </td>

                        <td className="whitespace-nowrap text-xs text-slate-600 tabular">
                          <div className="font-medium text-slate-800">
                            {formatRelativeTimeVi(device.lastSeenAt, nowTick)}
                          </div>
                          {device.lastSeenAt && (
                            <div className="text-2xs text-slate-400">
                              {formatVietnamDateTime(device.lastSeenAt)}
                            </div>
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={device.active}
                            aria-label={`Chuyển trạng thái kích hoạt cho ${device.name}`}
                            disabled={
                              !capabilities.canManageDevices ||
                              toggleStatusMutation.isPending
                            }
                            onClick={() =>
                              void handleToggleActive(
                                device.id,
                                device.name,
                                !device.active
                              )
                            }
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                              device.active ? 'bg-brand-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                device.active ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>

                        <td className="text-right whitespace-nowrap">
                          <Link
                            href={`/admin/devices/${device.id}`}
                            className="btn-secondary btn-sm"
                          >
                            <span>Chi tiết</span>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationBar
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Modal Đăng ký thủ công */}
      <ModalDialog
        open={registerOpen}
        title="Đăng ký Thiết bị Cảm biến Mới"
        description="Khởi tạo định danh thiết bị và sinh khóa xác thực API Key một lần."
        onClose={() => setRegisterOpen(false)}
      >
        <form
          onSubmit={(e) => void handleManualRegister(e)}
          className="space-y-3.5"
        >
          {registerError && <ErrorBanner message={registerError} />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-hw-id" className="label">
                Mã phần cứng (Hardware ID) *
              </label>
              <input
                id="reg-hw-id"
                type="text"
                required
                value={registerForm.hardwareId}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, hardwareId: e.target.value }))
                }
                placeholder="VD: ESP32-A1B2C3"
                className="input font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="reg-name" className="label">
                Tên hiển thị thiết bị *
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={registerForm.name}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="VD: Trạm bàn đọc A1 - Tầng 3"
                className="input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-zone" className="label">
                Mã phân vùng (Zone ID) *
              </label>
              <input
                id="reg-zone"
                type="text"
                required
                value={registerForm.zoneId}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, zoneId: e.target.value }))
                }
                className="input font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="reg-room" className="label">
                Phòng đọc gắn kèm
              </label>
              <select
                id="reg-room"
                value={registerForm.roomId}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, roomId: e.target.value }))
                }
                className="select text-xs"
              >
                <option value="">-- Chưa chọn phòng --</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    [{room.code}] {room.name} (Tầng {room.floor})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-type" className="label">
                Loại thiết bị *
              </label>
              <input
                id="reg-type"
                type="text"
                required
                value={registerForm.deviceType}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, deviceType: e.target.value }))
                }
                className="input text-xs"
              />
            </div>

            <div>
              <label htmlFor="reg-location" className="label">
                Vị trí lắp đặt chi tiết
              </label>
              <input
                id="reg-location"
                type="text"
                value={registerForm.location}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, location: e.target.value }))
                }
                placeholder="VD: Bàn đọc số 4 gần cửa sổ"
                className="input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-posx" className="label">
                Tọa độ X [0.0 - 1.0]
              </label>
              <input
                id="reg-posx"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={registerForm.posX}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, posX: e.target.value }))
                }
                className="input text-xs tabular"
              />
            </div>

            <div>
              <label htmlFor="reg-posy" className="label">
                Tọa độ Y [0.0 - 1.0]
              </label>
              <input
                id="reg-posy"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={registerForm.posY}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, posY: e.target.value }))
                }
                className="input text-xs tabular"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setRegisterOpen(false)}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="btn-primary btn-sm"
            >
              {registerMutation.isPending
                ? 'Đang cấp phát...'
                : 'Đăng ký & Nhận khóa'}
            </button>
          </div>
        </form>
      </ModalDialog>

      <OneTimeKeyDialog
        open={keyDialogState.open}
        deviceName={keyDialogState.deviceName}
        hardwareId={keyDialogState.hardwareId}
        rawApiKey={keyDialogState.rawApiKey}
        alreadyExisted={keyDialogState.alreadyExisted}
        onClose={() => {
          registerMutation.reset();
          setKeyDialogState({
            open: false,
            deviceName: '',
            hardwareId: '',
            rawApiKey: null,
            alreadyExisted: false,
          });
        }}
      />
    </div>
  );
}

export default function AdminDevicesPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <AdminDevicesPageContent />
    </Suspense>
  );
}
